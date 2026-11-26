/**
 * FFmpeg render pipeline for export jobs (slides → audio → muxed video).
 * Split from lib/export-job-manager.ts per the 600-line file rule; the
 * session-storage layer imports nothing from here, this module owns the
 * whole heavy render pipeline and reports progress via job status files.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { toArabicDigits } from '@/lib/quran-utils';
import { buildExportSrtBodies } from './export-srt-emit';
import {
  buildFfmpegConcatSlidesManifest,
  getConcatSlideFadeSec,
  getCrfForQuality,
  getEffectiveExportFps,
  getXfadeTransitionName,
  resolveExportDimensions,
  shouldUseFastConcatEngine,
  XFADE_MAX_SLIDES,
  type ExportJobStatus,
} from '@/lib/video-export';
import { buildBgVideoRenderArgs } from './export-bgvideo-args';
import { resolveAmbientLayer } from './export-ambient-layer';
import { appendEncodeTail } from './export-encode-args';

// Shared session-layer symbols (storage half of the old module)
import {
  activeJobs,
  getJobDir,
  getMetaPath,
  readJobStatus,
  resolveBuiltinBackgroundForJob,
  writeJobStatus,
  type ActiveJobRuntime,
  type ExportJobMeta,
} from './export-job-manager';
import {
  buildChainedXfadeFilters,
  probeOutputVideo,
  spawnFfmpegTracked,
} from './export-job-helpers';
import { prepareExportAudio } from './export-audio-prep';


export async function runExportPipeline(jobId: string): Promise<void> {
  const renderStarted = Date.now();
  const dir = getJobDir(jobId);
  const runtime: ActiveJobRuntime = { cancelled: false, activeProc: null };
  activeJobs.set(jobId, runtime);

  const status = await readJobStatus(jobId);
  if (!status) {
    activeJobs.delete(jobId);
    return;
  }

  const checkCancelled = () => {
    if (runtime.cancelled) throw new Error('CANCELLED');
  };

  try {
    const meta = JSON.parse(await fs.readFile(getMetaPath(jobId), 'utf8')) as ExportJobMeta;
    // Built-in library background: copy the whitelisted asset into the job dir
    // as bg_video.bin before any hasBgVideo checks (client never uploads it).
    if (meta.bgLibraryId) {
      await resolveBuiltinBackgroundForJob(meta, dir);
    }
    const filesInDir = await fs.readdir(dir);

    // Collect uploaded slide files in strict index order
    const slideFilenames: string[] = [];
    const slidePaths: string[] = [];
    for (let i = 0; i < meta.slideCount; i++) {
      const jpg = `slide_${i}.jpg`;
      const png = `slide_${i}.png`;
      const name = filesInDir.includes(png) ? png : filesInDir.includes(jpg) ? jpg : null;
      if (!name) throw new Error(`الشريحة رقم ${i + 1} مفقودة — يرجى إعادة المحاولة`);
      slideFilenames.push(name);
      slidePaths.push(path.join(dir, name));
    }

    const { width, height } = resolveExportDimensions(
      meta.baseWidth,
      meta.baseHeight,
      meta.resolution
    );

    const audioPrep = await prepareExportAudio({
      jobId,
      dir,
      meta,
      status,
      runtime,
      slidePaths,
      checkCancelled,
    });
    const outputExt = audioPrep.outputExt;
    const processedAudioPath = audioPrep.processedAudioPath;
    const slideDurations = audioPrep.slideDurations;
    let totalAudioDur = audioPrep.totalAudioDur;

    // 2) Render Video Slides + Mux with already-encoded audio (-c:a copy!)
    const outputPath = path.join(dir, `output.${outputExt}`);
    // Karaoke slides step word-by-word — crossfades between them would read as
    // flicker, so the timeline renders with clean hard cuts (the concat engine).
    const isKaraoke = Array.isArray(meta.wordTimeline) && meta.wordTimeline.length > 0;
    const crf = getCrfForQuality(meta.format, meta.quality);
    const xfadeName = isKaraoke ? null : getXfadeTransitionName(meta.transition);
    const hasValidFile = (p: string) => fs.stat(p).then((s) => s.size > 256).catch(() => false);
    const bgVideoPath = path.join(dir, 'bg_video.bin');
    const hasBgVideoFile = meta.hasBgVideo ? await hasValidFile(bgVideoPath) : false;
    const backdropPath = path.join(dir, 'backdrop.png');
    const hasBackdropFile = await hasValidFile(backdropPath);
    // Transparent ornament/grading overlay for bg-video exports — carries the
    // Islamic frame (البرواز), pattern, LUT, vignette, banners and watermark.
    const overlayPath = path.join(dir, 'overlay.png');
    const hasOverlayFile = hasBgVideoFile ? await hasValidFile(overlayPath) : false;

    // Hard guard (black-video protection): with no animated bg-video file the
    // verse slides are TRANSPARENT cards that MUST composite over backdrop.png.
    // When both are absent (lost/failed upload) every branch below would
    // flatten the transparent slides onto pure black — the exact "black video
    // with only ayah text" failure mode. Fail loudly instead of shipping a
    // broken video; the client already retried each upload 6x with backoff.
    if (!hasBgVideoFile && !hasBackdropFile) {
      throw new Error(
        'خلفية الفيديو (backdrop) مفقودة من جلسة التصدير — فشل رفع الخلفية، يرجى إعادة المحاولة'
      );
    }

    const useFastConcat =
      isKaraoke || shouldUseFastConcatEngine(slidePaths.length, meta.transition);
    const effectiveFps = getEffectiveExportFps(
      meta.fps,
      slidePaths.length,
      meta.transition,
      hasBgVideoFile
    );

    // Animated ambient layer (stars / gold-dust / aurora) composited live between
    // the stationary backdrop and the verse slides — mirrors the preview animation
    // instead of the frozen timeSec=0 frame baked into backdrop.png.
    const ambientLayer = resolveAmbientLayer({
      ambientEffect: meta.ambient,
      hasBgVideoFile,
      jobDir: dir,
      filesInDir,
      width,
      height,
      effectiveFps,
      // With a bg video the processed stream is labeled [bg] (scale/crop/
      // speed/blur from buildVideoBackgroundFilterGraph) — the ambient layer
      // must composite above THAT, never the raw [0:v] (dangling [bg] label).
      baseLabel: hasBgVideoFile ? 'bg' : '0:v',
    });
    const hasAmbientFrames = ambientLayer.active;

    const sumDurs = slideDurations.reduce((a, b) => a + b, 0) || totalAudioDur;
    const scaleDur = totalAudioDur / sumDurs;
    // Karaoke word slides can legitimately be sub-second — the 0.4s floor
    // would accumulate drift across dozens of words, so it drops to 0.2 there.
    const slideDurFloor = isKaraoke ? 0.2 : 0.4;
    const normalizedDurs = slideDurations.map((d) => Math.max(slideDurFloor, d * scaleDur));

    const ayahSlideCount = Math.max(1, slidePaths.length - (meta.includeIntroCover ? 1 : 0));
    status.stage = 'encoding_video';
    status.progressPct = 74;
    status.stageLabel = hasBgVideoFile
      ? `جاري دمج الخلفية المتحركة مع ${toArabicDigits(ayahSlideCount)} آية (${meta.resolution})...`
      : ayahSlideCount > 24
        ? `جاري ترميز الفيديو بالمحرك السريع (${toArabicDigits(ayahSlideCount)} آية · ${meta.resolution})...`
        : `جاري ترميز الفيديو إلى ${meta.format.toUpperCase()} · ${meta.resolution} · ${effectiveFps} FPS...`;
    await writeJobStatus(status);

    const videoArgs: string[] = ['-y'];

    if (hasBgVideoFile) {
      // Animated background video (library/uploaded) — xfade or concat engine
      // plus optional ambient + ornament overlay layers. Extracted per the
      // 600-line rule into lib/export-bgvideo-args.ts.
      videoArgs.push(
        ...(await buildBgVideoRenderArgs({
          meta,
          dir,
          width,
          height,
          effectiveFps,
          xfadeName,
          slidePaths,
          slideFilenames,
          normalizedDurs,
          ambientLayer,
          hasAmbientFrames,
          hasOverlayFile,
          overlayPath,
          bgVideoPath,
          processedAudioPath,
        }))
      );
    } else if (hasBackdropFile && xfadeName && slidePaths.length > 1 && slidePaths.length <= XFADE_MAX_SLIDES) {
      // Stationary backdrop [0:v] + smoothly xfade transparent verse overlay slides + mux audio
      const shortestSlide = Math.min(...normalizedDurs);
      const requestedTransSec = meta.transitionDurationMs / 1000;
      const transDur = Math.min(requestedTransSec, Math.max(0.25, shortestSlide * 0.45));

      videoArgs.push(
        '-loop', '1',
        '-framerate', String(effectiveFps),
        '-t', (totalAudioDur + 1.0).toFixed(3),
        '-i', backdropPath
      );

      // Animated ambient input: looping particle sequence or single swayed frame
      if (hasAmbientFrames) {
        videoArgs.push(...ambientLayer.inputArgs);
      }

      for (let i = 0; i < slidePaths.length; i++) {
        const clipDur =
          i < slidePaths.length - 1
            ? normalizedDurs[i] + transDur
            : normalizedDurs[i] + 1.0;
        videoArgs.push(
          '-loop', '1',
          '-framerate', String(effectiveFps),
          '-t', clipDur.toFixed(3),
          '-i', slidePaths[i]
        );
      }
      videoArgs.push('-i', processedAudioPath);
      const audioInputIdx = slidePaths.length + (hasAmbientFrames ? 2 : 1);

      const { filters: vFilters, outLabel } = buildChainedXfadeFilters({
        slideCount: slidePaths.length,
        normalizedDurs,
        transDur,
        xfadeName,
        width,
        height,
        effectiveFps,
        isRgba: true,
        inputOffset: hasAmbientFrames ? 2 : 1,
        finalLabel: 'ov',
      });
      if (hasAmbientFrames && ambientLayer.ambientFilters) {
        // backdrop [0:v] + animated ambient [1:v] → [bgamb], then slides overlay [bgamb]
        vFilters.unshift(...ambientLayer.ambientFilters);
        vFilters.push(`[bgamb][${outLabel}]overlay=0:0,format=yuv420p[vout]`);
      } else {
        vFilters.push(`[0:v][${outLabel}]overlay=0:0,format=yuv420p[vout]`);
      }
      videoArgs.push('-filter_complex', vFilters.join(';'));
      videoArgs.push('-map', '[vout]', '-map', `${audioInputIdx}:a`);
    } else if (hasBackdropFile) {
      // Stationary backdrop [0:v] + concat transparent PNG verse overlays [1:v] + engineered audio [2:a]
      const slidesListPath = path.join(dir, 'slides_list.txt');
      const slidesManifest = buildFfmpegConcatSlidesManifest(
        slideFilenames.map((filename, i) => ({
          filename,
          durationSec:
            i === slideFilenames.length - 1 ? normalizedDurs[i] + 1.0 : normalizedDurs[i],
        }))
      );
      await fs.writeFile(slidesListPath, slidesManifest, 'utf8');

      videoArgs.push(
        '-loop', '1',
        '-framerate', String(effectiveFps),
        '-t', (totalAudioDur + 1.0).toFixed(3),
        '-i', backdropPath
      );
      if (hasAmbientFrames) {
        videoArgs.push(...ambientLayer.inputArgs);
      }
      videoArgs.push(
        '-f', 'concat',
        '-safe', '0',
        '-i', slidesListPath,
        '-i', processedAudioPath
      );
      const ambientFilters = ambientLayer.ambientFilters;
      const slidesSrc = hasAmbientFrames ? 'bgamb' : '0:v';
      const filters = hasAmbientFrames && ambientFilters
        ? [
            ...ambientFilters,
            `[2:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1,fps=${effectiveFps},format=rgba[slides]`,
            `[${slidesSrc}][slides]overlay=0:0,format=yuv420p[vout]`,
          ]
        : [
            `[1:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1,fps=${effectiveFps},format=rgba[slides]`,
            `[${slidesSrc}][slides]overlay=0:0,format=yuv420p[vout]`,
          ];
      videoArgs.push(
        '-filter_complex',
        filters.join(';'),
        '-map', '[vout]',
        '-map', `${hasAmbientFrames ? 3 : 2}:a:0`
      );
    } else if (useFastConcat || slidePaths.length === 1) {
      const slidesListPath = path.join(dir, 'slides_list.txt');
      const slidesManifest = buildFfmpegConcatSlidesManifest(
        slideFilenames.map((filename, i) => ({
          filename,
          durationSec:
            i === slideFilenames.length - 1 ? normalizedDurs[i] + 1.0 : normalizedDurs[i],
        }))
      );
      await fs.writeFile(slidesListPath, slidesManifest, 'utf8');

      // Long-surah concat path: the chosen soft-fade transition is honored via a
      // per-slide fade-in (st=0) so every verse change still reads as a gentle
      // fade instead of a hard cut — disabled for karaoke (word slides must cut
      // cleanly or the whole text block would pulse at every word change).
      const concatFade =
        !isKaraoke && xfadeName && slidePaths.length > 1
          ? getConcatSlideFadeSec(meta.transitionDurationMs)
          : 0;
      const fadeFilter = concatFade > 0 ? `,fade=t=in:st=0:d=${concatFade.toFixed(2)}` : '';

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
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${effectiveFps},format=yuv420p${fadeFilter}`,
        '-map',
        '0:v:0',
        '-map',
        '1:a:0'
      );
    } else {
      const shortestSlide = Math.min(...normalizedDurs);
      const requestedTransSec = meta.transitionDurationMs / 1000;
      // Keep the user's chosen duration visible: floor is 0.3s (was 0.15s which
      // produced an imperceptible 6-frame fade at 30fps) and cap by slide length.
      const transDur = xfadeName
        ? Math.min(requestedTransSec, Math.max(0.25, shortestSlide * 0.45))
        : 0;

      for (let i = 0; i < slidePaths.length; i++) {
        // Each slide stays visible for normalizedDurs[i], plus transDur overlap for outgoing xfade,
        // and the final slide gets +1.0s buffer so -t totalAudioDur trims video & audio in exact lockstep.
        const clipDur =
          i < slidePaths.length - 1
            ? normalizedDurs[i] + transDur
            : normalizedDurs[i] + 1.0;
        videoArgs.push(
          '-loop',
          '1',
          '-framerate',
          String(effectiveFps),
          '-t',
          clipDur.toFixed(3),
          '-i',
          slidePaths[i]
        );
      }
      videoArgs.push('-i', processedAudioPath);
      const audioInputIdx = slidePaths.length;

      const { filters: vFilters, outLabel } = buildChainedXfadeFilters({
        slideCount: slidePaths.length,
        normalizedDurs,
        transDur,
        xfadeName,
        width,
        height,
        effectiveFps,
        isRgba: false,
        inputOffset: 0,
        finalLabel: 'vout',
      });
      videoArgs.push('-filter_complex', vFilters.join(';'));
      videoArgs.push('-map', `[${outLabel}]`, '-map', `${audioInputIdx}:a`);
    }

    // Final encoding tail (filenames, container metadata, codec args) lives in
    // lib/export-encode-args.ts per the 600-line rule.
    const { filename, displayFilename } = appendEncodeTail(videoArgs, {
      meta,
      crf,
      effectiveFps,
      hasBgVideoFile,
      hasAnimatedVisualLayer: hasAmbientFrames,
      slideCount: slidePaths.length,
      totalAudioDur,
      outputPath,
    });

    let lastEncUpdate = Date.now();
    await spawnFfmpegTracked(videoArgs, runtime, (sec) => {
      const now = Date.now();
      if (now - lastEncUpdate > 650 && totalAudioDur > 0) {
        lastEncUpdate = now;
        const ratio = Math.min(1, sec / totalAudioDur);
        const encPct = Math.round(ratio * 100);
        status.progressPct = Math.min(98, 74 + Math.round(ratio * 24));
        status.stageLabel = `جاري ترميز الفيديو النهائي (${toArabicDigits(encPct)}%)...`;
        void writeJobStatus(status);
      }
    });

    checkCancelled();

    // Free slide images, bg video & intermediate audio immediately after muxing
    await Promise.all([
      ...slidePaths.map((p) => fs.unlink(p).catch(() => {})),
      fs.unlink(processedAudioPath).catch(() => {}),
      hasBgVideoFile ? fs.unlink(bgVideoPath).catch(() => {}) : Promise.resolve(),
      hasOverlayFile ? fs.unlink(overlayPath).catch(() => {}) : Promise.resolve(),
    ]);

    const stat = await fs.stat(outputPath);
    if (stat.size < 16_384) {
      throw new Error('OUTPUT_TOO_SMALL: ناتج الفيديو غير مكتمل — جرّب دقة 720p أو 480p وأعد المحاولة');
    }

    const probedOutput = await probeOutputVideo(outputPath);
    if (!probedOutput.hasVideo || !probedOutput.hasAudio || probedOutput.durationSec < 0.3) {
      throw new Error('OUTPUT_INVALID_STREAMS: ملف الفيديو الناتج غير مكتمل — أعد المحاولة بدقة 720p');
    }

    const renderMs = Date.now() - renderStarted;

    // Roadmap item 5: emit synchronized SRT subtitle tracks alongside the
    // video, derived from the exact normalized durations the concat manifest
    // was built from — subtitles can never drift from the rendered timeline.
    // Arabic (Uthmani) + English translation track share the same cue grid.
    if (Array.isArray(meta.verseTexts) && meta.verseTexts.some((t) => t && t.trim())) {
      try {
        const { srtAr, srtEn } = buildExportSrtBodies({
          normalizedDurs,
          verseTexts: meta.verseTexts ?? [],
          verseTranslations: meta.verseTranslations,
          isKaraoke,
          includeIntroCover: meta.includeIntroCover !== false,
        });
        if (srtAr) {
          await fs.writeFile(path.join(getJobDir(jobId), 'output.srt'), srtAr, 'utf8');
        }
        if (srtEn) {
          await fs.writeFile(path.join(getJobDir(jobId), 'output_en.srt'), srtEn, 'utf8');
        }
      } catch (err) {
        console.warn(`[studio/export/job:${jobId}] SRT generation skipped:`, err);
      }
    }

    status.stage = 'done';
    status.progressPct = 100;
    status.stageLabel = 'اكتمل تصدير الفيديو بنجاح';
    status.result = {
      filename,
      displayFilename,
      format: meta.format,
      sizeBytes: stat.size,
      durationSec: Number(probedOutput.durationSec.toFixed(2)),
      renderMs,
      dimensions: `${probedOutput.width}x${probedOutput.height}`,
      slideCount: slidePaths.length,
      effectiveFps,
    };
    await writeJobStatus(status);
  } catch (err) {
    if (runtime.cancelled || (err instanceof Error && err.message === 'CANCELLED')) {
      return;
    }
    console.error(`[studio/export/job:${jobId}] failed:`, err);
    const detail = err instanceof Error ? err.message : '';
    let userMsg = 'تعذّر معالجة وتصدير الفيديو — جرّب اختيار دقة 720p أو 480p أو أعد المحاولة';
    if (detail.includes('Failed to fetch verse audio') || detail.includes('HTTP ')) {
      userMsg = 'تعذّر تحميل بعض تلاوات القارئ من المصدر — جرّب إعادة المحاولة أو اختيار قارئ آخر';
    } else if (detail.includes('مفقودة') || detail.includes('الخلفية المختارة')) {
      userMsg = detail;
    }
    status.stage = 'error';
    status.error = userMsg;
    status.stageLabel = userMsg;
    await writeJobStatus(status);
  } finally {
    activeJobs.delete(jobId);
  }
}

export async function startExportJob(jobId: string): Promise<ExportJobStatus> {
  const status = await readJobStatus(jobId);
  if (!status) {
    throw new Error('لم يتم العثور على جلسة التصدير');
  }
  if (status.stage !== 'uploading') {
    return status;
  }
  status.stage = 'queued';
  status.progressPct = Math.max(status.progressPct, 35);
  status.stageLabel = 'جاري بدء معالجة الفيديو على الخادم...';
  await writeJobStatus(status);

  // Run asynchronously so the HTTP trigger returns immediately (zero Cloud Run request timeout)
  void runExportPipeline(jobId);
  return status;
}
