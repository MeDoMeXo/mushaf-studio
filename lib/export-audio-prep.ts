/**
 * Audio-preparation phase of the studio export pipeline (downloads verse
 * recitations / processes custom audio into the final encoded track and
 * computes per-slide durations, including 2.5s silent intro cover when enabled).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { toArabicDigits } from '@/lib/quran-utils';
import { INTRO_COVER_DURATION_SEC } from '@/lib/surah-cover';
import { distributeWordDurations } from '@/lib/verse-words';
import {
  buildAmbientNoiseFilter,
  buildAudioEffectFilter,
  buildFfmpegConcatAudioManifest,
  MAX_EXPORT_VERSES,
  type ExportJobStatus,
} from '@/lib/video-export';
import { writeJobStatus, type ActiveJobRuntime, type ExportJobMeta } from './export-job-manager';
import {
  downloadVerseAudio,
  probeAudioInfo,
  runWithConcurrency,
  spawnFfmpegTracked,
} from './export-job-helpers';

export interface PrepareAudioContext {
  jobId: string;
  dir: string;
  meta: ExportJobMeta;
  status: ExportJobStatus;
  runtime: ActiveJobRuntime;
  slidePaths: string[];
  checkCancelled: () => void;
}

export interface PrepareAudioResult {
  processedAudioPath: string;
  outputExt: string;
  slideDurations: number[];
  totalAudioDur: number;
}

export async function prepareExportAudio(
  ctx: PrepareAudioContext
): Promise<PrepareAudioResult> {
  const { dir, meta, status, runtime, slidePaths, checkCancelled } = ctx;
  const filesInDir = await fs.readdir(dir);
  const outputExt = meta.format === 'webm' ? 'webm' : 'mp4';
  const processedAudioPath = path.join(
    dir,
    meta.format === 'webm' ? 'audio_final.ogg' : 'audio_final.m4a'
  );
  const slideDurations: number[] = new Array(slidePaths.length).fill(3.5);
  const hasIntro = Boolean(meta.includeIntroCover) && slidePaths.length > 1;
  const introDurSec = hasIntro ? (meta.introCoverDurationSec || INTRO_COVER_DURATION_SEC) : 0;
  const introSecStr = introDurSec.toFixed(3);
  // Karaoke timeline — one slide per recited word/segment; verse audio is
  // split across its entries by spoken weight so slides stay audio-locked.
  let wordTimeline =
    Array.isArray(meta.wordTimeline) && meta.wordTimeline.length > 0
      ? meta.wordTimeline
      : null;
  const karaokeSlideCount = wordTimeline
    ? wordTimeline.length + (hasIntro ? 1 : 0)
    : 0;
  if (wordTimeline && karaokeSlideCount !== slidePaths.length) {
    // Defensive: timeline must match the uploaded slide count exactly.
    wordTimeline = null;
  }
  const targetRate = meta.format === 'webm' ? 48000 : 44100;
  const audioEncodeArgs =
    meta.format === 'webm'
      ? ['-c:a', 'libopus', '-b:a', `${meta.audioBitrate}k`, '-ar', '48000', '-ac', '2']
      : ['-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', `${meta.audioBitrate}k`, '-ar', '44100', '-ac', '2'];

  let totalAudioDur = 0;

  if (meta.hasCustomAudio) {
    status.stage = 'mixing_audio';
    status.progressPct = 45;
    status.stageLabel = 'جاري معالجة الملف الصوتي المرفق...';
    await writeJobStatus(status);

    const customPath = path.join(dir, 'custom_audio_in');
    const customInfo = await probeAudioInfo(customPath);
    const rawCustomDur = customInfo.duration;
    const verseSlideCount = Math.max(
      1,
      slidePaths.length - (hasIntro ? 1 : 0)
    );
    if (hasIntro) slideDurations[0] = introDurSec;
    if (wordTimeline) {
      // Custom audio + karaoke: split the single track across word entries
      // by spoken weight so highlight slides still advance with the audio.
      const durs = distributeWordDurations(
        wordTimeline.map((e) => e.weight),
        Math.max(1, rawCustomDur)
      );
      for (let i = 0; i < durs.length; i++) {
        slideDurations[hasIntro ? i + 1 : i] = durs[i];
      }
    } else {
      const perSlide = Math.max(0.5, rawCustomDur / verseSlideCount);
      for (let i = hasIntro ? 1 : 0; i < slidePaths.length; i++) {
        slideDurations[i] = perSlide;
      }
    }
    totalAudioDur = rawCustomDur + introDurSec;

    const effectChain = buildAudioEffectFilter(meta.audioPreset);
    const ambientFilter = buildAmbientNoiseFilter(
      meta.ambientSound,
      totalAudioDur,
      meta.ambientVolume
    );
    const fadeOutStart = Math.max(introDurSec, totalAudioDur - 0.55).toFixed(2);
    const fadeInStart = hasIntro ? introDurSec.toFixed(2) : '0';
    const fadeChain = meta.audioFade
      ? `,afade=t=in:st=${fadeInStart}:d=0.25,afade=t=out:st=${fadeOutStart}:d=0.55`
      : '';
    const silenceGateAmb =
      ambientFilter && hasIntro
        ? `${ambientFilter},volume=enable='lt(t,${introSecStr})':volume=0`
        : ambientFilter;

    const audioArgs = hasIntro
      ? [
          '-y',
          '-i',
          customPath,
          '-filter_complex',
          [
            `anullsrc=r=${targetRate}:cl=stereo,atrim=0:${introSecStr},asetpts=N/SR/TB[intro_s]`,
            `[0:a]${effectChain},aresample=${targetRate}:async=1:first_pts=0,aformat=sample_rates=${targetRate}:channel_layouts=stereo[main_a]`,
            `[intro_s][main_a]concat=n=2:v=0:a=1[full_a]`,
            silenceGateAmb
              ? `${silenceGateAmb}[amb];[full_a][amb]amix=inputs=2:duration=first:dropout_transition=1,alimiter=limit=0.95${fadeChain}[mix]`
              : `[full_a]alimiter=limit=0.95${fadeChain}[mix]`,
          ].join(';'),
          '-map',
          '[mix]',
          ...audioEncodeArgs,
          processedAudioPath,
        ]
      : silenceGateAmb
        ? [
            '-y',
            '-i',
            customPath,
            '-filter_complex',
            `[0:a]${effectChain}[rec];${silenceGateAmb}[amb];[rec][amb]amix=inputs=2:duration=first:dropout_transition=1,alimiter=limit=0.95${fadeChain}[mix]`,
            '-map',
            '[mix]',
            ...audioEncodeArgs,
            processedAudioPath,
          ]
        : [
            '-y',
            '-i',
            customPath,
            '-af',
            `${effectChain},alimiter=limit=0.95${fadeChain}`,
            ...audioEncodeArgs,
            processedAudioPath,
          ];

    await spawnFfmpegTracked(audioArgs, runtime);
    await fs.unlink(customPath).catch(() => {});
    const probed = await probeAudioInfo(processedAudioPath);
    if (probed.duration > 0) totalAudioDur = probed.duration;
  } else {
    const verseCountTarget = Math.max(1, slidePaths.length - (hasIntro ? 1 : 0));
    const verseIds = meta.verseIds.slice(0, Math.min(MAX_EXPORT_VERSES, verseCountTarget));
    const mp3Filenames: string[] = new Array(verseIds.length);
    const verseDurations: number[] = new Array(verseIds.length).fill(3.5);
    const gapMs = Math.round(meta.verseGapSec * 1000);

    const preUploadedSet = new Set(
      filesInDir.filter((f) => /^verse_\d+\.mp3$/.test(f))
    );
    const cachedCountOnDisk = verseIds.filter((_, idx) =>
      preUploadedSet.has(`verse_${idx}.mp3`)
    ).length;

    status.stage = 'downloading_audio';
    status.downloadedAudio = cachedCountOnDisk;
    status.totalAudio = verseIds.length;
    status.progressPct = 36;
    status.stageLabel =
      cachedCountOnDisk === verseIds.length
        ? `جاري قراءة التوقيتات من كاش المتصفح (${toArabicDigits(verseIds.length)} آية)...`
        : `جاري تجهيز التلاوات (${toArabicDigits(cachedCountOnDisk)} / ${toArabicDigits(verseIds.length)} آية)...`;
    await writeJobStatus(status);

    let completedAudio = 0;
    let lastStatusUpdate = Date.now();

    await runWithConcurrency(
      verseIds,
      10,
      async (vid, idx) => {
        checkCancelled();
        const mp3Name = `verse_${idx}.mp3`;
        const mp3Path = path.join(dir, mp3Name);

        let alreadyFromCache = false;
        if (preUploadedSet.has(mp3Name)) {
          try {
            const st = await fs.stat(mp3Path);
            if (st.size >= 128) alreadyFromCache = true;
          } catch {
            alreadyFromCache = false;
          }
        }

        if (!alreadyFromCache) {
          await downloadVerseAudio(meta.reciter, vid, mp3Path, {
            folder: meta.reciterFolder,
            server: meta.reciterServer,
            readId: meta.reciterReadId,
          });
        }

        const info = await probeAudioInfo(mp3Path);
        mp3Filenames[idx] = mp3Name;
        const isLast = idx === verseIds.length - 1;
        verseDurations[idx] = info.duration + (!isLast && gapMs > 0 ? meta.verseGapSec : 0);

        completedAudio++;
        const now = Date.now();
        if (completedAudio === verseIds.length || now - lastStatusUpdate > 450) {
          lastStatusUpdate = now;
          status.downloadedAudio = completedAudio;
          status.progressPct = 36 + Math.round((completedAudio / verseIds.length) * 24);
          status.stageLabel =
            cachedCountOnDisk === verseIds.length
              ? `تم تجهيز التوقيتات من الكاش (${toArabicDigits(completedAudio)} / ${toArabicDigits(verseIds.length)} آية)...`
              : `جاري تجهيز التلاوات (${toArabicDigits(completedAudio)} / ${toArabicDigits(verseIds.length)} آية)...`;
          await writeJobStatus(status);
        }
      },
      () => runtime.cancelled
    );

    checkCancelled();

    if (hasIntro) slideDurations[0] = introDurSec;
    if (wordTimeline) {
      // Split each verse's REAL audio duration across its word/segment
      // entries by spoken weight; the inter-verse gap lands on the verse's
      // final word slide so audio and slides stay in perfect lockstep.
      const groups = new Map<number, { slideIdx: number[]; weights: number[] }>();
      wordTimeline.forEach((entry, i) => {
        const slideIdx = hasIntro ? i + 1 : i;
        let g = groups.get(entry.verseIdx);
        if (!g) {
          g = { slideIdx: [], weights: [] };
          groups.set(entry.verseIdx, g);
        }
        g.slideIdx.push(slideIdx);
        g.weights.push(entry.weight);
      });
      for (const [verseIdx, group] of groups) {
        const isLastVerse = verseIdx >= verseDurations.length - 1;
        const gapSec = !isLastVerse && gapMs > 0 ? meta.verseGapSec : 0;
        const audioDur = Math.max(
          0.5,
          (verseDurations[verseIdx] ?? 3.5) - gapSec
        );
        const durs = distributeWordDurations(group.weights, audioDur);
        group.slideIdx.forEach((slideIdx, k) => {
          slideDurations[slideIdx] = durs[k] + (k === durs.length - 1 ? gapSec : 0);
        });
      }
    } else {
      for (let i = 0; i < verseDurations.length; i++) {
        slideDurations[hasIntro ? i + 1 : i] = verseDurations[i];
      }
    }
    totalAudioDur = slideDurations.reduce((a, b) => a + b, 0);

    status.stage = 'mixing_audio';
    status.progressPct = 62;
    status.stageLabel = `جاري دمج ومعالجة الصوت لـ ${toArabicDigits(verseIds.length)} آية...`;
    await writeJobStatus(status);

    const effectChain = buildAudioEffectFilter(meta.audioPreset);
    const ambientFilter = buildAmbientNoiseFilter(
      meta.ambientSound,
      totalAudioDur,
      meta.ambientVolume
    );
    const silenceGateAmb =
      ambientFilter && hasIntro
        ? `${ambientFilter},volume=enable='lt(t,${introSecStr})':volume=0`
        : ambientFilter;
    const fadeOutStart = Math.max(introDurSec, totalAudioDur - 0.55).toFixed(2);
    const fadeInStart = hasIntro ? introDurSec.toFixed(2) : '0';
    const fadeChain = meta.audioFade
      ? `,afade=t=in:st=${fadeInStart}:d=0.25,afade=t=out:st=${fadeOutStart}:d=0.55`
      : '';

    const chunkExt = meta.format === 'webm' ? 'ogg' : 'm4a';
    const AUDIO_MIX_CHUNK_SIZE = 32;
    const totalChunks = Math.ceil(mp3Filenames.length / AUDIO_MIX_CHUNK_SIZE);

    const buildChunkConcatFilter = (
      count: number,
      includeTrailingGap: boolean,
      includeLeadingSilence: boolean
    ): { filter: string; outLabel: string } => {
      const parts: string[] = [];
      const concatInputs: string[] = [];
      const hasGap = gapMs > 0;
      const gapSecStr = meta.verseGapSec.toFixed(3);

      if (includeLeadingSilence) {
        parts.push(
          `anullsrc=r=${targetRate}:cl=stereo,atrim=0:${introSecStr},asetpts=N/SR/TB[intro_s]`
        );
        concatInputs.push('[intro_s]');
      }

      for (let j = 0; j < count; j++) {
        parts.push(
          `[${j}:a]aresample=${targetRate}:async=1:first_pts=0,aformat=sample_rates=${targetRate}:channel_layouts=stereo[a${j}]`
        );
        concatInputs.push(`[a${j}]`);
        const needsGap = hasGap && (j < count - 1 || includeTrailingGap);
        if (needsGap) {
          parts.push(
            `anullsrc=r=${targetRate}:cl=stereo,atrim=0:${gapSecStr},asetpts=N/SR/TB[g${j}]`
          );
          concatInputs.push(`[g${j}]`);
        }
      }

      parts.push(`${concatInputs.join('')}concat=n=${concatInputs.length}:v=0:a=1[chunk_out]`);
      return { filter: parts.join(';'), outLabel: '[chunk_out]' };
    };

    if (totalChunks === 1) {
      const inputArgs: string[] = [];
      for (const fn of mp3Filenames) {
        inputArgs.push('-err_detect', 'ignore_err', '-i', path.join(dir, fn));
      }

      const { filter: baseFilter } = buildChunkConcatFilter(mp3Filenames.length, false, hasIntro);
      const fullFilter = silenceGateAmb
        ? `${baseFilter};[chunk_out]${effectChain}[rec];${silenceGateAmb}[amb];[rec][amb]amix=inputs=2:duration=first:dropout_transition=1,alimiter=limit=0.95${fadeChain}[mix]`
        : `${baseFilter};[chunk_out]${effectChain},alimiter=limit=0.95${fadeChain}[mix]`;

      let lastMixUpdate = Date.now();
      await spawnFfmpegTracked(
        [
          '-y',
          ...inputArgs,
          '-filter_complex',
          fullFilter,
          '-map',
          '[mix]',
          ...audioEncodeArgs,
          processedAudioPath,
        ],
        runtime,
        (sec) => {
          const now = Date.now();
          if (now - lastMixUpdate > 700 && totalAudioDur > 0) {
            lastMixUpdate = now;
            const ratio = Math.min(1, sec / totalAudioDur);
            status.progressPct = 62 + Math.round(ratio * 10);
            void writeJobStatus(status);
          }
        }
      );

      await Promise.all(
        mp3Filenames.map((fn) => fs.unlink(path.join(dir, fn)).catch(() => {}))
      );
    } else {
      const chunkFilenames: string[] = [];
      for (let c = 0; c < totalChunks; c++) {
        checkCancelled();
        const start = c * AUDIO_MIX_CHUNK_SIZE;
        const end = Math.min(mp3Filenames.length, start + AUDIO_MIX_CHUNK_SIZE);
        const slice = mp3Filenames.slice(start, end);
        const isLastChunk = c === totalChunks - 1;

        status.progressPct = 62 + Math.round((c / totalChunks) * 8);
        status.stageLabel = `جاري دمج ومعالجة الصوت (${toArabicDigits(start + 1)}–${toArabicDigits(end)} من ${toArabicDigits(verseIds.length)} آية)...`;
        await writeJobStatus(status);

        const inputArgs: string[] = [];
        for (const fn of slice) {
          inputArgs.push('-err_detect', 'ignore_err', '-i', path.join(dir, fn));
        }
        const { filter: chunkFilter } = buildChunkConcatFilter(
          slice.length,
          !isLastChunk,
          c === 0 && hasIntro
        );
        const chunkName = `audio_chunk_${c}.${chunkExt}`;
        const chunkPath = path.join(dir, chunkName);

        await spawnFfmpegTracked(
          [
            '-y',
            ...inputArgs,
            '-filter_complex',
            chunkFilter,
            '-map',
            '[chunk_out]',
            ...audioEncodeArgs,
            chunkPath,
          ],
          runtime
        );

        chunkFilenames.push(chunkName);
        await Promise.all(slice.map((fn) => fs.unlink(path.join(dir, fn)).catch(() => {})));
      }

      checkCancelled();
      status.progressPct = 71;
      status.stageLabel = `جاري تجميع الصوت النهائي لـ ${toArabicDigits(verseIds.length)} آية...`;
      await writeJobStatus(status);

      const audioListPath = path.join(dir, 'audio_list.txt');
      await fs.writeFile(
        audioListPath,
        buildFfmpegConcatAudioManifest(chunkFilenames, null),
        'utf8'
      );

      const needsPostFx =
        effectChain !== 'anull' || Boolean(silenceGateAmb) || Boolean(meta.audioFade);

      const finalMixArgs = !needsPostFx
        ? [
            '-y',
            '-f',
            'concat',
            '-safe',
            '0',
            '-i',
            audioListPath,
            '-c:a',
            'copy',
            processedAudioPath,
          ]
        : silenceGateAmb
          ? [
              '-y',
              '-f',
              'concat',
              '-safe',
              '0',
              '-i',
              audioListPath,
              '-filter_complex',
              `[0:a]${effectChain}[rec];${silenceGateAmb}[amb];[rec][amb]amix=inputs=2:duration=first:dropout_transition=1,alimiter=limit=0.95${fadeChain}[mix]`,
              '-map',
              '[mix]',
              ...audioEncodeArgs,
              processedAudioPath,
            ]
          : [
              '-y',
              '-f',
              'concat',
              '-safe',
              '0',
              '-i',
              audioListPath,
              '-af',
              `${effectChain},alimiter=limit=0.95${fadeChain}`,
              ...audioEncodeArgs,
              processedAudioPath,
            ];

      await spawnFfmpegTracked(finalMixArgs, runtime);

      await Promise.all([
        ...chunkFilenames.map((fn) => fs.unlink(path.join(dir, fn)).catch(() => {})),
        fs.unlink(audioListPath).catch(() => {}),
      ]);
    }

    const probedFinal = await probeAudioInfo(processedAudioPath);
    if (probedFinal.duration > 0) {
      totalAudioDur = probedFinal.duration;
    }
  }

  checkCancelled();

  return {
    processedAudioPath,
    outputExt,
    slideDurations,
    totalAudioDur,
  };
}
