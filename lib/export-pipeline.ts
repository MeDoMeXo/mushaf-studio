/**
 * Export session pipeline (client-side) — extracted from StudioExportModal
 * per the 600-line file rule. This is the full export flow as a pure-ish
 * async function: create session → upload bg video chunks → render & upload
 * slide batches → trigger render → poll → fetch verified result. All UI state
 * changes are reported through the progress callbacks the modal passes in.
 */
import type { QulVerse, StudioState } from '@/lib/quran-data';
import { toArabicDigits } from '@/lib/quran-utils';
import {
  drawStudioFrame,
  renderExportBackdropCanvas,
  renderStaticBackdropCanvas,
  renderTransparentOverlayBackdropCanvas,
} from '@/lib/studio-renderer';
import {
  getCachedVerseAudioBlob,
  shouldAttachAudioToBatch,
} from '@/lib/audio-cache';
import {
  abortableSleep,
  fetchVerifiedVideoBlob,
  fetchWithRateLimitRetry,
  triggerDownload,
  verifyAndDownload,
} from '@/lib/export-network';
import {
  BG_VIDEO_CHUNK_BYTES,
  BLOB_DOWNLOAD_MAX_BYTES,
  chunkIndices,
  EXPORT_SLIDE_BATCH_SIZE,
  getPollIntervalMs,
  getSlideImageEncoding,
  MAX_EXPORT_VERSES,
  XFADE_MAX_SLIDES,
  type ExportJobStatus,
  type VideoExportFormat,
  type VideoExportSettings,
} from '@/lib/video-export';
import {
  buildIntroAlignedVerseTexts,
  INTRO_COVER_DURATION_SEC,
  resolveIntroCoverSlideCount,
} from '@/lib/surah-cover';
import { buildArabicExportFilename } from '@/lib/video-share';

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

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string };
    if (json.error) return json.error;
  } catch {
    // non-JSON proxy response
  }
  return `${fallback} (رمز ${res.status})`;
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

  const hasBgVideo = studioState.bgType === 'video' && Boolean(bgVideoFile);
  const includeIntroCover = exportSettings.includeIntroCover !== false;
  const totalSlides = resolveIntroCoverSlideCount(selectedVerses.length, includeIntroCover);

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
    verseIds: selectedVerses.map((v) => v.id),
    verseTexts: buildIntroAlignedVerseTexts(rawVerseTexts, includeIntroCover),
    slideCount: totalSlides,
    includeIntroCover,
    introCoverDurationSec: includeIntroCover ? INTRO_COVER_DURATION_SEC : 0,
    baseWidth: studioState.width,
    baseHeight: studioState.height,
    hasBgVideo,
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
  const backdropCanvas = !hasBgVideo
    ? renderExportBackdropCanvas(renderState, getBgImageEl(), surahName, reciterName)
    : null;
  const backdropBlob = backdropCanvas
    ? await new Promise<Blob | null>((res) => backdropCanvas.toBlob(res, 'image/png'))
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
    let batchAudioBytes = 0;

    for (let sIdx = batch.start; sIdx < batch.end; sIdx++) {
      if (signal.aborted) {
        throw new DOMException('Export aborted', 'AbortError');
      }

      const isIntroCover = includeIntroCover && sIdx === 0;
      const vIdx = includeIntroCover ? sIdx - 1 : sIdx;
      const verse = isIntroCover ? undefined : selectedVerses[vIdx];
      const ayahNum = verse
        ? verse.verse_key.split(':')[1] || String(studioState.fromAyah + vIdx)
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
      });

      if (!isIntroCover && verse && usingBrowserAudioCache) {
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

  // 4) Poll real-time server progress with adaptive interval & patient 429 backoff (never abort on 429!)
  const basePollMs = getPollIntervalMs(totalSlides);
  let nextPollDelayMs = basePollMs;
  let consecutivePollErrors = 0;
  let rateLimitHits = 0;

  while (true) {
    if (signal.aborted) {
      throw new DOMException('Export aborted', 'AbortError');
    }
    await abortableSleep(nextPollDelayMs, signal);

    let pollRes: Response;
    try {
      pollRes = await fetch(
        `/api/studio/export/session?id=${encodeURIComponent(jobId)}`,
        {
          method: 'GET',
          cache: 'no-store',
          signal,
        }
      );
    } catch (pollErr) {
      if (pollErr instanceof DOMException && pollErr.name === 'AbortError') throw pollErr;
      consecutivePollErrors++;
      if (consecutivePollErrors >= 8) {
        throw new Error('انقطع الاتصال بالخادم أثناء متابعة التصدير — أعد المحاولة');
      }
      nextPollDelayMs = computeBackoff(consecutivePollErrors);
      continue;
    }

    if (pollRes.status === 429 || isRetryableStatus(pollRes.status)) {
      // Server is still rendering in the background; back off patiently instead of failing!
      rateLimitHits++;
      nextPollDelayMs = Math.max(basePollMs, computeBackoffWithHeader(rateLimitHits, pollRes.headers.get('retry-after')));
      cb.onStageLabel('المعالجة مستمرة على الخادم — جاري انتظار تحديث الحالة...');
      continue;
    }

    if (!pollRes.ok) {
      consecutivePollErrors++;
      if (pollRes.status === 404 || consecutivePollErrors >= 5) {
        throw new Error(await extractErrorMessage(pollRes, 'تعذّر متابعة حالة التصدير'));
      }
      nextPollDelayMs = computeBackoff(consecutivePollErrors);
      continue;
    }

    consecutivePollErrors = 0;
    rateLimitHits = 0;
    nextPollDelayMs = basePollMs;

    const { status: jobStatus } = (await pollRes.json()) as { status: ExportJobStatus };
    cb.onProgress(jobStatus.progressPct);
    if (jobStatus.stageLabel) {
      cb.onStageLabel(jobStatus.stageLabel);
    }

    if (jobStatus.stage === 'error') {
      throw new Error(jobStatus.error || 'تعذّر معالجة وتصدير الفيديو');
    }

    if (jobStatus.stage === 'done' && jobStatus.result) {
      const streamUrl = `/api/studio/export/download?id=${encodeURIComponent(jobId)}`;
      const downloadUrl = `${streamUrl}&download=1`;
      const outputFormat: VideoExportFormat =
        jobStatus.result.format === 'webm' ? 'webm' : 'mp4';
      const filename =
        jobStatus.result.displayFilename ||
        buildArabicExportFilename({
          surahName,
          fromAyah: studioState.fromAyah,
          toAyah: studioState.toAyah,
          reciterName,
          format: outputFormat,
        });

      let localBlobUrl: string | null = null;
      let localBlob: Blob | null = null;
      if (jobStatus.result.sizeBytes <= BLOB_DOWNLOAD_MAX_BYTES) {
        cb.onProgress(99);
        cb.onStageLabel('جاري تحميل الملف النهائي والتحقق من سلامة التشغيل...');
        const verified = await fetchVerifiedVideoBlob(
          streamUrl,
          outputFormat,
          signal
        );
        localBlobUrl = verified?.url ?? null;
        localBlob = verified?.blob ?? null;
      }

      cb.onExportSuccess({
        filename,
        format: outputFormat,
        streamUrl,
        downloadUrl,
        srtUrl: selectedVerses.some((v) => (v.text_uthmani ?? '').trim())
          ? `${streamUrl}&kind=srt`
          : null,
        sizeMb: (jobStatus.result.sizeBytes / (1024 * 1024)).toFixed(2),
        durationSec: jobStatus.result.durationSec.toFixed(1),
        renderSec: (jobStatus.result.renderMs / 1000).toFixed(1),
        dimensions: jobStatus.result.dimensions,
        isLocalBlob: Boolean(localBlobUrl),
        localBlobUrl,
        localBlob,
      });

      if (localBlobUrl) {
        triggerDownload(localBlobUrl, filename);
      } else {
        void verifyAndDownload(streamUrl, downloadUrl, filename, outputFormat, {
          localBlobUrl: null,
          onErrorToast: cb.onErrorToast,
        });
      }
      return;
    }
  }
}

// Thin wrappers keep the retry-policy imports in one place (audio-batch-codec).
import {
  computeRateLimitBackoffMs,
  isRetryableHttpStatus,
} from '@/lib/audio-batch-codec';

function computeBackoff(attempt: number): number {
  return computeRateLimitBackoffMs(attempt, null);
}

function computeBackoffWithHeader(attempt: number, retryAfter: string | null): number {
  return computeRateLimitBackoffMs(attempt, retryAfter);
}

function isRetryableStatus(status: number): boolean {
  return isRetryableHttpStatus(status);
}
