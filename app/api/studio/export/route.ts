import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { NextRequest, NextResponse } from 'next/server';
import { RECITERS } from '@/lib/quran-data';
import {
  buildAmbientNoiseFilter,
  buildAudioEffectFilter,
  buildFfmpegConcatAudioManifest,
  buildFfmpegConcatSlidesManifest,
  buildSafeExportFilename,
  DEFAULT_VIDEO_EXPORT_SETTINGS,
  getCrfForQuality,
  getXfadeTransitionName,
  isValidUploadedMediaHeader,
  MAX_EXPORT_FORM_BYTES,
  MAX_UPLOADED_AUDIO_BYTES,
  MAX_UPLOADED_SLIDE_BYTES,
  MAX_EXPORT_VERSES,
  resolveExportDimensions,
  shouldUseFastConcatEngine,
  type AmbientSoundPreset,
  type AudioEffectPreset,
  type SlideTransitionType,
  type VideoExportFormat,
  type VideoFpsOption,
  type VideoQualityTier,
  type VideoResolutionTier,
} from '@/lib/video-export';
import {
  FFMPEG_MISSING_ERROR,
  downloadVerseAudio,
  probeDurationSeconds,
  runWithConcurrency,
  type ExportPayloadMeta,
} from '@/lib/export-route-helpers';
import { isFfmpegAvailable, resolveFfmpegPath } from '@/lib/export-job-helpers';

export const runtime = 'nodejs';
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  const renderStarted = Date.now();
  const workDir = path.join(os.tmpdir(), `quran-export-${crypto.randomUUID()}`);

  try {
    // Preflight: FFmpeg is required for every render path. Fail fast with a
    // clear, actionable Arabic message instead of a cryptic ENOENT mid-pipeline.
    if (!isFfmpegAvailable()) {
      return NextResponse.json({ error: FFMPEG_MISSING_ERROR }, { status: 503 });
    }

    const formData = await req.formData();
    const metaRaw = formData.get('meta');
    if (typeof metaRaw !== 'string') {
      return NextResponse.json({ error: 'بيانات التصدير غير مكتملة' }, { status: 400 });
    }

    const parsed = JSON.parse(metaRaw) as Partial<ExportPayloadMeta>;
    const slideFiles: File[] = [];
    for (let i = 0; i < MAX_EXPORT_VERSES; i++) {
      const f = formData.get(`slide_${i}`);
      if (f instanceof File) {
        slideFiles.push(f);
      } else {
        break;
      }
    }

    if (slideFiles.length === 0) {
      return NextResponse.json({ error: 'لم يتم إرسال شرائح الآيات' }, { status: 400 });
    }

    // Trust boundary: cap the whole multipart body and validate every uploaded
    // slide's size + magic bytes before anything is written to disk or FFmpeg.
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_EXPORT_FORM_BYTES) {
      return NextResponse.json(
        { error: 'حجم طلب التصدير يتجاوز الحد المسموح' },
        { status: 413 }
      );
    }
    for (const f of slideFiles) {
      if (f.size > MAX_UPLOADED_SLIDE_BYTES) {
        return NextResponse.json(
          { error: `حجم الشريحة يتجاوز الحد المسموح (${f.name || 'شريحة'})` },
          { status: 413 }
        );
      }
      const head = new Uint8Array(await f.slice(0, 12).arrayBuffer());
      const isJpg = f.type === 'image/jpeg' || f.name.endsWith('.jpg');
      if (!isValidUploadedMediaHeader(head, isJpg ? 'jpg' : 'png')) {
        return NextResponse.json(
          { error: 'صيغة الشريحة غير صالحة — يُسمح بصور PNG أو JPEG فقط' },
          { status: 415 }
        );
      }
    }
    const customAudioUpload = formData.get('customAudio');
    if (customAudioUpload instanceof File && customAudioUpload.size > MAX_UPLOADED_AUDIO_BYTES) {
      return NextResponse.json(
        { error: 'حجم الملف الصوتي المخصص يتجاوز الحد المسموح' },
        { status: 413 }
      );
    }
    if (customAudioUpload instanceof File && customAudioUpload.size > 0) {
      const head = new Uint8Array(await customAudioUpload.slice(0, 12).arrayBuffer());
      if (!isValidUploadedMediaHeader(head, 'audio')) {
        return NextResponse.json(
          { error: 'الملف الصوتي غير صالح — يُسمح بـ MP3 أو WAV فقط' },
          { status: 415 }
        );
      }
    }

    const reciterObj = RECITERS.find((r) => r.slug === parsed.reciter) ?? RECITERS[0];
    const format: VideoExportFormat = parsed.format === 'webm' ? 'webm' : 'mp4';
    const resolution: VideoResolutionTier =
      parsed.resolution === '480p' || parsed.resolution === '720p' ? parsed.resolution : '1080p';
    const fps: VideoFpsOption =
      parsed.fps === 24 || parsed.fps === 60 ? parsed.fps : 30;
    const quality: VideoQualityTier =
      parsed.quality === 'high' || parsed.quality === 'compact' ? parsed.quality : 'balanced';
    const transition: SlideTransitionType =
      parsed.transition === 'fadeblack' ||
      parsed.transition === 'fadewhite' ||
      parsed.transition === 'zoomin' ||
      parsed.transition === 'zoom' ||
      parsed.transition === 'slideup' ||
      parsed.transition === 'dissolve' ||
      parsed.transition === 'none'
        ? parsed.transition
        : 'fade';
    const transitionDurationMs = Math.max(
      150,
      Math.min(
        1200,
        Number(parsed.transitionDurationMs ?? DEFAULT_VIDEO_EXPORT_SETTINGS.transitionDurationMs)
      )
    );
    const audioPreset: AudioEffectPreset =
      parsed.audioPreset ?? DEFAULT_VIDEO_EXPORT_SETTINGS.audioPreset;
    const ambientSound: AmbientSoundPreset = parsed.ambientSound ?? 'none';
    const ambientVolume = Math.max(0, Math.min(0.55, Number(parsed.ambientVolume ?? 0.16)));
    const audioBitrate: 128 | 192 | 320 =
      parsed.audioBitrate === 128 || parsed.audioBitrate === 320 ? parsed.audioBitrate : 192;
    const audioFade = parsed.audioFade !== false;
    const verseGapSec = Math.max(0, Math.min(1.5, Number(parsed.verseGapSec ?? 0.35)));
    const { width, height } = resolveExportDimensions(
      Number(parsed.baseWidth || 1080),
      Number(parsed.baseHeight || 1920),
      resolution
    );

    const verseIds = Array.isArray(parsed.verseIds)
      ? parsed.verseIds
          .slice(0, slideFiles.length)
          .map((n) => Math.max(1, Math.min(6236, Math.floor(Number(n) || 1))))
      : [1];

    await fs.mkdir(workDir, { recursive: true });

    // 1) Save uploaded slide images (supports both PNG and JPEG seamlessly)
    const slideFilenames: string[] = [];
    const slidePaths: string[] = [];
    for (let i = 0; i < slideFiles.length; i++) {
      const f = slideFiles[i];
      const ext = f.type === 'image/jpeg' || f.name.endsWith('.jpg') ? 'jpg' : 'png';
      const filename = `slide_${i}.${ext}`;
      const p = path.join(workDir, filename);
      await fs.writeFile(p, Buffer.from(await f.arrayBuffer()));
      slideFilenames.push(filename);
      slidePaths.push(p);
    }

    // 2) Prepare Audio Track (custom uploaded audio OR synchronized verse audio via scalable concat demuxer)
    const customAudioFile = formData.get('customAudio');
    const slideDurations: number[] = new Array(slidePaths.length).fill(3.5);
    const masterAudioRawPath = path.join(workDir, 'audio_raw.wav');

    if (customAudioFile instanceof File && customAudioFile.size > 0) {
      const customPath = path.join(workDir, 'custom_audio_in');
      await fs.writeFile(customPath, Buffer.from(await customAudioFile.arrayBuffer()));
      await execFileAsync(resolveFfmpegPath(), [
        '-y',
        '-i',
        customPath,
        '-ar',
        '44100',
        '-ac',
        '2',
        masterAudioRawPath,
      ]);
      const totalDur = await probeDurationSeconds(masterAudioRawPath);
      const perSlide = Math.max(1.0, totalDur / slidePaths.length);
      for (let i = 0; i < slidePaths.length; i++) {
        slideDurations[i] = perSlide;
      }
    } else {
      const wavFilenames: string[] = new Array(verseIds.length);
      const gapMs = Math.round(verseGapSec * 1000);

      // Download & normalize each verse audio to uniform 44.1kHz stereo WAV with bounded concurrency
      await runWithConcurrency(verseIds, 8, async (vid, idx) => {
        const mp3Path = path.join(workDir, `verse_${idx}.mp3`);
        const wavName = `verse_${idx}.wav`;
        const wavPath = path.join(workDir, wavName);
        await downloadVerseAudio(reciterObj.slug, vid, mp3Path);
        await execFileAsync(resolveFfmpegPath(), [
          '-y',
          '-i',
          mp3Path,
          '-ar',
          '44100',
          '-ac',
          '2',
          '-c:a',
          'pcm_s16le',
          wavPath,
        ]);
        const dur = await probeDurationSeconds(wavPath);
        const isLast = idx === verseIds.length - 1;
        slideDurations[idx] = dur + (!isLast && gapMs > 0 ? verseGapSec : 0);
        wavFilenames[idx] = wavName;
      });

      let gapWavName: string | null = null;
      if (gapMs > 0 && verseIds.length > 1) {
        gapWavName = 'gap.wav';
        await execFileAsync(resolveFfmpegPath(), [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'anullsrc=r=44100:cl=stereo',
          '-t',
          verseGapSec.toFixed(3),
          '-c:a',
          'pcm_s16le',
          path.join(workDir, gapWavName),
        ]);
      }

      if (wavFilenames.length === 1) {
        await fs.copyFile(path.join(workDir, wavFilenames[0]), masterAudioRawPath);
      } else {
        const audioListPath = path.join(workDir, 'audio_list.txt');
        const audioManifest = buildFfmpegConcatAudioManifest(wavFilenames, gapWavName);
        await fs.writeFile(audioListPath, audioManifest, 'utf8');
        await execFileAsync(resolveFfmpegPath(), [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          audioListPath,
          '-c',
          'copy',
          masterAudioRawPath,
        ]);
      }
    }

    const totalAudioDur = await probeDurationSeconds(masterAudioRawPath);

    // 3) Apply Studio Audio Engineering Preset + Natural Ambience + Audio Fade
    const processedAudioPath = path.join(workDir, 'audio_final.wav');
    const effectChain = buildAudioEffectFilter(audioPreset);
    const ambientFilter = buildAmbientNoiseFilter(ambientSound, totalAudioDur, ambientVolume);
    const fadeOutStart = Math.max(0, totalAudioDur - 0.55).toFixed(2);
    const fadeChain = audioFade
      ? `,afade=t=in:st=0:d=0.25,afade=t=out:st=${fadeOutStart}:d=0.55`
      : '';

    if (ambientFilter) {
      const complexAudio = `[0:a]${effectChain}[rec];${ambientFilter}[amb];[rec][amb]amix=inputs=2:duration=first:dropout_transition=1,alimiter=limit=0.95${fadeChain}[mix]`;
      await execFileAsync(resolveFfmpegPath(), [
        '-y',
        '-i',
        masterAudioRawPath,
        '-filter_complex',
        complexAudio,
        '-map',
        '[mix]',
        '-ar',
        '44100',
        '-ac',
        '2',
        processedAudioPath,
      ]);
    } else {
      await execFileAsync(resolveFfmpegPath(), [
        '-y',
        '-i',
        masterAudioRawPath,
        '-af',
        `${effectChain},alimiter=limit=0.95${fadeChain}`,
        '-ar',
        '44100',
        '-ac',
        '2',
        processedAudioPath,
      ]);
    }

    // 4) Render Video Slides + Transitions + Mux with Engineered Audio
    const outputExt = format === 'webm' ? 'webm' : 'mp4';
    const outputPath = path.join(workDir, `output.${outputExt}`);
    const crf = getCrfForQuality(format, quality);
    const xfadeName = getXfadeTransitionName(transition);
    const useFastConcat = shouldUseFastConcatEngine(slidePaths.length, transition);

    // Normalize slide durations so total timeline matches totalAudioDur cleanly
    const sumDurs = slideDurations.reduce((a, b) => a + b, 0) || totalAudioDur;
    const scaleDur = totalAudioDur / sumDurs;
    const normalizedDurs = slideDurations.map((d) => Math.max(0.5, d * scaleDur));

    const videoArgs: string[] = ['-y'];

    if (useFastConcat || slidePaths.length === 1) {
      // Scalable low-memory concat demuxer engine — handles up to full 286-verse surahs effortlessly
      const slidesListPath = path.join(workDir, 'slides_list.txt');
      const slidesManifest = buildFfmpegConcatSlidesManifest(
        slideFilenames.map((filename, i) => ({
          filename,
          durationSec: normalizedDurs[i],
        }))
      );
      await fs.writeFile(slidesListPath, slidesManifest, 'utf8');

      videoArgs.push(
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        slidesListPath,
        '-i',
        processedAudioPath,
        '-vf',
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`,
        '-map',
        '0:v:0',
        '-map',
        '1:a:0'
      );
    } else {
      // Short clip (<= 24 slides) with smooth FFmpeg xfade transitions
      const shortestSlide = Math.min(...normalizedDurs);
      const requestedTransSec = transitionDurationMs / 1000;
      const transDur = xfadeName
        ? Math.min(requestedTransSec, Math.max(0.15, shortestSlide * 0.4))
        : 0;

      for (let i = 0; i < slidePaths.length; i++) {
        const clipDur =
          transDur > 0 && i < slidePaths.length - 1
            ? normalizedDurs[i] + transDur
            : normalizedDurs[i];
        videoArgs.push(
          '-loop',
          '1',
          '-framerate',
          String(fps),
          '-t',
          clipDur.toFixed(3),
          '-i',
          slidePaths[i]
        );
      }
      videoArgs.push('-i', processedAudioPath);
      const audioInputIdx = slidePaths.length;

      const vFilters: string[] = [];
      for (let i = 0; i < slidePaths.length; i++) {
        vFilters.push(
          `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}]`
        );
      }

      let offset = 0;
      let prevLabel = 'v0';
      for (let i = 1; i < slidePaths.length; i++) {
        offset += normalizedDurs[i - 1];
        const outLabel = i === slidePaths.length - 1 ? 'vout' : `vx${i}`;
        vFilters.push(
          `[${prevLabel}][v${i}]xfade=transition=${xfadeName}:duration=${transDur.toFixed(2)}:offset=${Math.max(0.1, offset - transDur).toFixed(3)}[${outLabel}]`
        );
        prevLabel = outLabel;
      }

      videoArgs.push('-filter_complex', vFilters.join(';'));
      videoArgs.push('-map', '[vout]', '-map', `${audioInputIdx}:a`);
    }

    if (format === 'mp4') {
      videoArgs.push(
        '-c:v',
        'libx264',
        '-preset',
        slidePaths.length > 30 ? 'ultrafast' : 'veryfast',
        '-tune',
        'stillimage',
        '-crf',
        String(crf),
        '-pix_fmt',
        'yuv420p',
        '-r',
        String(fps),
        '-c:a',
        'aac',
        '-b:a',
        `${audioBitrate}k`,
        '-movflags',
        '+faststart',
        '-shortest',
        outputPath
      );
    } else {
      videoArgs.push(
        '-c:v',
        'libvpx',
        '-deadline',
        'realtime',
        '-cpu-used',
        slidePaths.length > 30 ? '6' : '4',
        '-crf',
        String(crf),
        '-b:v',
        quality === 'high' ? '3M' : quality === 'compact' ? '900k' : '1800k',
        '-r',
        String(fps),
        '-c:a',
        'libopus',
        '-b:a',
        `${audioBitrate}k`,
        '-shortest',
        outputPath
      );
    }

    await execFileAsync(resolveFfmpegPath(), videoArgs, { maxBuffer: 25 * 1024 * 1024 });

    const fileBuffer = await fs.readFile(outputPath);
    const filename = buildSafeExportFilename(
      Number(parsed.surahId || 1),
      Number(parsed.fromAyah || 1),
      Number(parsed.toAyah || 1),
      format
    );
    const renderMs = Date.now() - renderStarted;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': format === 'mp4' ? 'video/mp4' : 'video/webm',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileBuffer.byteLength),
        'X-Video-Duration': totalAudioDur.toFixed(2),
        'X-Render-Ms': String(renderMs),
        'X-Video-Dimensions': `${width}x${height}`,
        'X-Slide-Count': String(slidePaths.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[studio/export] render failed:', err);
    const msg = err instanceof Error ? err.message : String(err);
    const errnoCode =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    // Surface a clear install hint when FFmpeg/ffprobe is the root cause.
    const isMissingFfmpeg =
      errnoCode === 'ENOENT' ||
      /ENOENT|spawn (ffmpeg|ffprobe)|not found/i.test(msg);
    return NextResponse.json(
      {
        error: isMissingFfmpeg
          ? FFMPEG_MISSING_ERROR
          : 'تعذّر معالجة وتصدير الفيديو — حاول اختيار دقة أخف أو أعد المحاولة',
      },
      { status: isMissingFfmpeg ? 503 : 500 }
    );
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
