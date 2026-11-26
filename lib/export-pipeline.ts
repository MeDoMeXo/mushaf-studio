/**
 * Export session pipeline (client-side) — extracted from StudioExportModal
 * per the 600-line file rule. This is the full export flow as a pure-ish
 * async function: create session → upload bg video chunks → render & upload
 * slide batches → trigger render → poll → fetch verified result. All UI state
 * changes are reported through the progress callbacks the modal passes in.
 */
import type { QulVerse, StudioState } from '@/lib/quran-data';
import { RECITERS } from '@/lib/quran-data';
import { isBuiltinBackgroundId } from '@/lib/background-library';
import { toArabicDigits } from '@/lib/quran-utils';
import { resolveReciterOption } from '@/lib/reciter-filter';
import { buildCustomReciterSpec } from '@/lib/custom-reciter-spec';
import {
  drawStudioFrame,
  renderAmbientFrames,
  renderExportBackdropCanvas,
  renderStaticBackdropCanvas,
  renderVideoOverlayCanvas,
} from '@/lib/studio-renderer';
import {
  getCachedVerseAudioBlob,
  shouldAttachAudioToBatch,
} from '@/lib/audio-cache';
import {
  abortableSleep,
  extractErrorMessage,
  fetchWithRateLimitRetry,
} from '@/lib/export-network';
import {
  BG_VIDEO_CHUNK_BYTES,
  BLOB_DOWNLOAD_MAX_BYTES,
  chunkIndices,
  EXPORT_SLIDE_BATCH_SIZE,
  MAX_EXPORT_VERSES,
  resolveAmbientFrameSpecs,
  shouldRenderAnimatedAmbient,
  XFADE_MAX_SLIDES,
  type VideoExportFormat,
  type VideoExportSettings,
} from '@/lib/video-export';
import {
  buildIntroAlignedVerseTexts,
  INTRO_COVER_DURATION_SEC,
  resolveIntroCoverSlideCount,
} from '@/lib/surah-cover';
import { waitForExportCompletion } from './export-pipeline-poll';
import { buildKaraokeExportPlan } from './export-karaoke-plan';

export interface ExportPipelineInput {
  studioState: StudioState;
  exportSettings: VideoExportSettings;
  selectedVerses: QulVerse[];
  surahName: string;
  reciterName: string;
  customAudioFile: File | null;
  bgVideoFile: File | null;
  getBgImageEl: () => HTMLImageElement | null;
  targetDims: { width: number; height: number };
  signal: AbortSignal;
}

export interface ExportPipelineCallbacks {
  onJobCreated?: (jobId: string) => void;
  onStage: (stage: 'rendering_slides' | 'encoding_video') => void;
  onProgress: (pct: number) => void;
  onStageLabel: (label: string) => void;
  onErrorToast: (msg: string) => void;
  onExportSuccess: (payload: {
    filename: string;
    format: VideoExportFormat;
    streamUrl: string;
    downloadUrl: string;
    srtUrl: string | null;
    sizeMb: string;
    durationSec: string;
    renderSec: string;
    dimensions: string;
    isLocalBlob: boolean;
    localBlobUrl: string | null;
    localBlob: Blob | null;
  }) => void;
}

/**
 * Runs the whole export flow. Throws Error with an Arabic message on failure,
 * or DOMException AbortError when the signal fires. On success it reports
 * result metadata through onExportSuccess and triggers the download.
 */
export async function runExportPipeline(
  input: ExportPipelineInput,
  cb: ExportPipelineCallbacks
): Promise<void> {
  const {
    studioState,
    exportSettings,
    selectedVerses,
    surahName,
    reciterName,
    customAudioFile,
    bgVideoFile,
    getBgImageEl,
    targetDims,
    signal,
  } = input;

  if (!selectedVerses.length) {
    cb.onErrorToast('اختر آية واحدة على الأقل قبل التصدير');
    return;
  }
  if (selectedVerses.length > MAX_EXPORT_VERSES) {
    cb.onErrorToast(
      `الحد الأقصى لتصدير الفيديو الواحد هو ${toArabicDigits(MAX_EXPORT_VERSES)} آية (سورة البقرة كاملة)`
    );
    return;
  }

  const bgLibraryId =
    studioState.bgType === 'video' &&
    typeof studioState.bgLibraryId === 'string' &&
    isBuiltinBackgroundId(studioState.bgLibraryId)
      ? studioState.bgLibraryId
      : undefined;
  // A built-in library background streams server-side from public/ — the
  // client never uploads it, so bgVideoFile stays null for library picks.
  const hasBgVideo = studioState.bgType === 'video' && (Boolean(bgVideoFile) || Boolean(bgLibraryId));
  const includeIntroCover = exportSettings.includeIntroCover !== false;

  // Karaoke plan — word/segment-granular slides that track the recitation
  // (null → classic per-verse slides, zero change to existing flows).
  const karaokePlan = buildKaraokeExportPlan(studioState, selectedVerses, targetDims, includeIntroCover);
  const timeline = karaokePlan?.entries ?? null;
  const totalSlides = timeline
    ? karaokePlan!.totalSlides
    : resolveIntroCoverSlideCount(selectedVerses.length, includeIntroCover);

  // Custom reciters are not in the server's static whitelist — send the
  // validated wire spec so the export job can download/slice their verses.
  const resolvedReciter = resolveReciterOption(studioState.reciter);
  const isCustomReciter = !RECITERS.some((r) => r.slug === resolvedReciter.slug);
  const reciterSpec = isCustomReciter
    ? (buildCustomReciterSpec(resolvedReciter) ?? undefined)
    : undefined;

  // Ensure selected Arabic font weight is loaded
  try {
    await document.fonts.load(
      `${studioState.fontWeight || 400} ${studioState.fontSize}px "${studioState.fontFamily}"`
    );
  } catch {
    // fallback font
  }

  // 1) Create lightweight export session on server (zero large payload)
  // verseTexts travel alongside verseIds so the server can emit a
  // synchronized SRT subtitle track (empty string on slide_0 advances offset by 2.5s).
  const rawVerseTexts = selectedVerses.map((v) => v.text_uthmani ?? '');
  const meta = {
    ...exportSettings,
    surahId: studioState.surah,
    surahName,
    fromAyah: studioState.fromAyah,
    toAyah: studioState.toAyah,
    reciter: studioState.reciter,
    reciterName,
    reciterFolder: reciterSpec?.folder,
    reciterServer: reciterSpec?.server,
    reciterReadId: reciterSpec?.readId,
    verseIds: selectedVerses.map((v) => v.id),
    verseTexts: timeline
      ? karaokePlan!.alignedVerseTexts
      : buildIntroAlignedVerseTexts(rawVerseTexts, includeIntroCover),
    // Karaoke timeline — the server splits each verse's real audio duration
    // across these word/segment weights so slides stay audio-locked.
    wordTimeline: timeline ?? undefined,
    slideCount: totalSlides,
    includeIntroCover,
    introCoverDurationSec: includeIntroCover ? INTRO_COVER_DURATION_SEC : 0,
    baseWidth: studioState.width,
    baseHeight: studioState.height,
    hasBgVideo,
    bgLibraryId,
    ambient: studioState.ambient,
    bgBlur: studioState.bgBlur,
    bgVideoSpeed: studioState.bgVideoSpeed,
  };

  let sessionRes: Response;
  if (customAudioFile) {
    const initForm = new FormData();
    initForm.append('meta', JSON.stringify(meta));
    initForm.append('customAudio', customAudioFile, customAudioFile.name);
    sessionRes = await fetchWithRateLimitRetry(
      '/api/studio/export/session',
      {
        method: 'POST',
        body: initForm,
      },
      {
        signal,
        onRetry: () =>
          cb.onStageLabel('الخادم مزدحم مؤقتاً — جاري إعادة محاولة بدء الجلسة تلقائياً...'),
      }
    );
  } else {
    sessionRes = await fetchWithRateLimitRetry(
      '/api/studio/export/session',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meta),
      },
      {
        signal,
        onRetry: () =>
          cb.onStageLabel('الخادم مزدحم مؤقتاً — جاري إعادة محاولة بدء الجلسة تلقائياً...'),
      }
    );
  }

  if (!sessionRes.ok) {
    throw new Error(await extractErrorMessage(sessionRes, 'تعذّر بدء جلسة التصدير'));
  }

  const { jobId } = (await sessionRes.json()) as { jobId: string };
  cb.onJobCreated?.(jobId);

  // 1b) If animated video background is active, upload it in 8MB chunks with 429 backoff & pacing
  if (hasBgVideo && bgVideoFile) {
    const totalChunks = Math.max(1, Math.ceil(bgVideoFile.size / BG_VIDEO_CHUNK_BYTES));
    for (let c = 0; c < totalChunks; c++) {
      if (signal.aborted) {
        throw new DOMException('Export aborted', 'AbortError');
      }
      const chunkLabel = `جاري رفع الفيديو الخلفي المتحرك (${toArabicDigits(c + 1)} من ${toArabicDigits(totalChunks)})...`;
      cb.onStageLabel(chunkLabel);
      const slice = bgVideoFile.slice(
        c * BG_VIDEO_CHUNK_BYTES,
        Math.min(bgVideoFile.size, (c + 1) * BG_VIDEO_CHUNK_BYTES)
      );
      const upRes = await fetchWithRateLimitRetry(
        `/api/studio/export/session?id=${encodeURIComponent(jobId)}&kind=bgvideo&chunk=${c}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: slice,
        },
        {
          signal,
          maxAttempts: 6,
          onRetry: () =>
            cb.onStageLabel(
              `الخادم مزدحم مؤقتاً — إعادة رفع جزء الفيديو الخلفي (${toArabicDigits(c + 1)}/${toArabicDigits(totalChunks)})...`
            ),
        }
      );
      if (!upRes.ok) {
        throw new Error(await extractErrorMessage(upRes, 'تعذّر رفع الفيديو الخلفي المتحرك'));
      }
      cb.onProgress(4 + Math.round(((c + 1) / totalChunks) * 8));
      if (c < totalChunks - 1) {
        await abortableSleep(180, signal);
      }
    }
  }

  // 2) Render & upload slides sequentially in 20-slide batches (never bursts parallel PUTs)
  const offscreen = document.createElement('canvas');
  offscreen.width = targetDims.width;
  offscreen.height = targetDims.height;
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('تعذّر تهيئة محرك الرسم');

  const renderState: StudioState = {
    ...studioState,
    coverMode: false,
    width: targetDims.width,
    height: targetDims.height,
  };

  const imgEnc = { mime: 'image/png' as const, ext: 'png' as const };
  const batches = chunkIndices(totalSlides, EXPORT_SLIDE_BATCH_SIZE);

  // Animated ambient layer: client renders the particle/aurora frames and the
  // server composites them live between backdrop and verse slides (matching
  // the preview's drawAmbientEffect animation instead of a frozen frame).
  const wantsAnimatedAmbient =
    shouldRenderAnimatedAmbient(studioState.ambient) &&
    resolveAmbientFrameSpecs(studioState.ambient, targetDims.width, targetDims.height, exportSettings.fps) !== null;
  const ambientSpec = wantsAnimatedAmbient
    ? resolveAmbientFrameSpecs(studioState.ambient, targetDims.width, targetDims.height, exportSettings.fps)!
    : null;
  const ambientFrames: Blob[] = [];
  if (ambientSpec) {
    cb.onStageLabel('جاري توليد إطارات حركة الخلفية المتحركة...');
    ambientFrames.push(
      ...(await renderAmbientFrames(
        studioState.ambient,
        ambientSpec.frameCount,
        ambientSpec.fps,
        ambientSpec.frameWidth ?? targetDims.width,
        ambientSpec.frameHeight ?? targetDims.height
      ))
    );
  }

  // The backdrop canvas is always generated when no bg video exists — it carries
  // the background fill, ornaments, overlay, vignette and watermark. When an
  // animated ambient layer is active, the ambient effect itself is EXCLUDED from
  // the backdrop (it would freeze at timeSec=0) and rendered live by the server
  // as looping frames composited between backdrop and verse slides.
  const backdropCanvas = !hasBgVideo
    ? renderExportBackdropCanvas(
        ambientSpec
          ? { ...renderState, ambient: 'none' }
          : renderState,
        getBgImageEl(),
        surahName,
        reciterName
      )
    : null;
  const backdropBlob = backdropCanvas
    ? await new Promise<Blob | null>((res) => backdropCanvas.toBlob(res, 'image/png'))
    : null;

  // Ornament overlay for animated video backgrounds: the bg-video FFmpeg path
  // composites only [bg video] → [ambient] → [verse slides], which used to lose
  // the Islamic frame (البرواز), pattern, LUT, vignette, banners and watermark
  // entirely (preview/export parity break). This transparent PNG — carrying all
  // of those layers — is uploaded once and composited between the ambient layer
  // and the verse slides server-side.
  const overlayCanvas = hasBgVideo
    ? renderVideoOverlayCanvas(renderState, surahName, reciterName)
    : null;
  const overlayBlob = overlayCanvas
    ? await new Promise<Blob | null>((res) => overlayCanvas.toBlob(res, 'image/png'))
    : null;

  const uploadStartPct = hasBgVideo ? 12 : 4;
  const uploadSpanPct = hasBgVideo ? 22 : 30;

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const batch = batches[bIdx];
    if (signal.aborted) {
      throw new DOMException('Export aborted', 'AbortError');
    }

    const usingBrowserAudioCache = !customAudioFile;
    cb.onStageLabel(
      usingBrowserAudioCache
        ? `تجهيز الشرائح والصوت من كاش المتصفح (${toArabicDigits(batch.start + 1)}–${toArabicDigits(batch.end)} من ${toArabicDigits(totalSlides)})...`
        : `تجهيز ورفع الشرائح (${toArabicDigits(batch.start + 1)}–${toArabicDigits(batch.end)} من ${toArabicDigits(totalSlides)})...`
    );

    const batchForm = new FormData();
    if (bIdx === 0 && backdropBlob) {
      batchForm.append('backdrop', backdropBlob, 'backdrop.png');
    }
    if (bIdx === 0 && overlayBlob) {
      batchForm.append('overlay', overlayBlob, 'overlay.png');
    }
    if (bIdx === 0 && ambientFrames.length) {
      for (let f = 0; f < ambientFrames.length; f++) {
        batchForm.append(
          `ambient_${String(f).padStart(3, '0')}`,
          ambientFrames[f],
          `ambient_${String(f).padStart(3, '0')}.png`
        );
      }
    }
    let batchAudioBytes = 0;
    // First slide index of every verse inside the word timeline — verse audio
    // blobs attach only there (word slides of one verse share that audio).
    const verseFirstSlideIdx = new Map<number, number>();
    if (timeline) {
      timeline.forEach((entry, i) => {
        if (!verseFirstSlideIdx.has(entry.verseIdx)) {
          verseFirstSlideIdx.set(entry.verseIdx, i + (includeIntroCover ? 1 : 0));
        }
      });
    }

    for (let sIdx = batch.start; sIdx < batch.end; sIdx++) {
      if (signal.aborted) {
        throw new DOMException('Export aborted', 'AbortError');
      }

      const isIntroCover = includeIntroCover && sIdx === 0;
      const timelineEntry = timeline
        ? timeline[sIdx - (includeIntroCover ? 1 : 0)]
        : undefined;
      const vIdx = timelineEntry
        ? timelineEntry.verseIdx
        : isIntroCover
          ? -1
          : sIdx - (includeIntroCover ? 1 : 0);
      const verse = timelineEntry
        ? selectedVerses[timelineEntry.verseIdx]
        : isIntroCover
          ? undefined
          : selectedVerses[vIdx];
      const ayahNum = verse
        ? verse.verse_key.split(':')[1] || String(studioState.fromAyah + Math.max(0, vIdx))
        : undefined;

      drawStudioFrame(ctx, {
        state: { ...renderState, coverMode: isIntroCover },
        verseText: verse?.text_uthmani ?? '',
        translationText: verse?.translations?.[0]?.text ?? '',
        surahName,
        ayahLabel: ayahNum ? `آية ${ayahNum}` : '',
        ayahNumber: ayahNum,
        reciterName,
        bgImageEl: null,
        overlayOnly: true,
        activeVerseIndex: Math.max(0, vIdx),
        totalVerses: selectedVerses.length,
        activeWordIndex: timelineEntry?.wordIdx,
      });

      const shouldAttachVerseAudio =
        !isIntroCover &&
        verse &&
        usingBrowserAudioCache &&
        (timelineEntry === undefined || verseFirstSlideIdx.get(timelineEntry.verseIdx) === sIdx);
      if (shouldAttachVerseAudio) {
        try {
          const audioBlob = await getCachedVerseAudioBlob(studioState.reciter, verse.id);
          if (audioBlob && shouldAttachAudioToBatch(batchAudioBytes, audioBlob.size)) {
            batchForm.append(`audio_${vIdx}`, audioBlob, `verse_${vIdx}.mp3`);
            batchAudioBytes += audioBlob.size;
          }
        } catch {
          // Non-fatal: server downloads any missing verse audio directly
        }
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        offscreen.toBlob(resolve, 'image/png')
      );
      if (!blob) throw new Error(`فشل تجهيز الشريحة ${sIdx + 1}`);
      batchForm.append(`slide_${sIdx}`, blob, `slide_${sIdx}.png`);

      if ((sIdx + 1) % 6 === 0) {
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }

    const uploadRes = await fetchWithRateLimitRetry(
      `/api/studio/export/session?id=${encodeURIComponent(jobId)}`,
      {
        method: 'PUT',
        body: batchForm,
      },
      {
        signal,
        maxAttempts: 6,
        onRetry: () =>
          cb.onStageLabel(
            `الخادم مزدحم مؤقتاً — إعادة رفع دفعة الشرائح (${toArabicDigits(bIdx + 1)}/${toArabicDigits(batches.length)})...`
          ),
      }
    );
    if (!uploadRes.ok) {
      throw new Error(await extractErrorMessage(uploadRes, 'تعذّر رفع دفعة الشرائح'));
    }

    const uploadPct =
      uploadStartPct + Math.round((batch.end / totalSlides) * uploadSpanPct);
    cb.onProgress(uploadPct);

    if (bIdx < batches.length - 1) {
      await abortableSleep(140, signal);
    }
  }

  // 3) Trigger asynchronous background rendering on server (returns 202 immediately)
  cb.onStage('encoding_video');
  cb.onProgress(35);
  cb.onStageLabel(
    totalSlides > XFADE_MAX_SLIDES
      ? `جاري بدء المحرك السريع لدمج ${toArabicDigits(selectedVerses.length)} آية...`
      : `جاري تجهيز وترميز الفيديو (${exportSettings.format.toUpperCase()})...`
  );

  const startRes = await fetchWithRateLimitRetry(
    `/api/studio/export/session?id=${encodeURIComponent(jobId)}`,
    {
      method: 'PATCH',
    },
    {
      signal,
      maxAttempts: 6,
      onRetry: () =>
        cb.onStageLabel('الخادم مزدحم مؤقتاً — إعادة محاولة بدء الترميز تلقائياً...'),
    }
  );
  if (!startRes.ok) {
    throw new Error(await extractErrorMessage(startRes, 'تعذّر بدء ترميز الفيديو'));
  }

  // 4) Poll real-time server progress + report result + trigger download
  // (adaptive interval, patient 429 backoff, verified blob download).
  await waitForExportCompletion(
    {
      jobId,
      signal,
      totalSlides,
      surahName,
      fromAyah: studioState.fromAyah,
      toAyah: studioState.toAyah,
      reciterName,
      hasVerseTexts: selectedVerses.some((v) => (v.text_uthmani ?? '').trim()),
      blobDownloadMaxBytes: BLOB_DOWNLOAD_MAX_BYTES,
    },
    cb
  );
}
