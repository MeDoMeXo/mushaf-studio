/**
 * Export completion polling (client-side) — extracted from
 * lib/export-pipeline.ts per the 600-line file rule. Owns the adaptive
 * poll loop, patient 429/rate-limit backoff, result metadata reporting,
 * verified blob download and the final download trigger.
 */
import {
  abortableSleep,
  extractErrorMessage,
  fetchVerifiedVideoBlob,
  triggerDownload,
  verifyAndDownload,
} from '@/lib/export-network';
import {
  computeRateLimitBackoffMs,
  isRetryableHttpStatus,
} from '@/lib/audio-batch-codec';
import {
  getPollIntervalMs,
  type ExportJobStatus,
  type VideoExportFormat,
} from '@/lib/video-export';
import { buildArabicExportFilename } from '@/lib/video-share';
import type { ExportPipelineCallbacks } from './export-pipeline';

export interface ExportPollContext {
  jobId: string;
  signal: AbortSignal;
  totalSlides: number;
  surahName: string;
  fromAyah: number;
  toAyah: number;
  reciterName: string;
  /** Whether any selected verse carries Uthmani text (SRT availability). */
  hasVerseTexts: boolean;
  /** Max blob size (bytes) eligible for local verified download. */
  blobDownloadMaxBytes: number;
}

function computeBackoff(attempt: number): number {
  return computeRateLimitBackoffMs(attempt, null);
}

function computeBackoffWithHeader(attempt: number, retryAfter: string | null): number {
  return computeRateLimitBackoffMs(attempt, retryAfter);
}

/**
 * Polls the server render job until it finishes (or fails), then reports the
 * result through the callbacks and triggers the download. Throws Error with
 * an Arabic message on failure, or DOMException AbortError when aborted.
 */
export async function waitForExportCompletion(
  ctx: ExportPollContext,
  cb: ExportPipelineCallbacks
): Promise<void> {
  const { jobId, signal, totalSlides } = ctx;

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

    if (pollRes.status === 429 || isRetryableHttpStatus(pollRes.status)) {
      // Server is still rendering in the background; back off patiently instead of failing!
      rateLimitHits++;
      nextPollDelayMs = Math.max(
        basePollMs,
        computeBackoffWithHeader(rateLimitHits, pollRes.headers.get('retry-after'))
      );
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
          surahName: ctx.surahName,
          fromAyah: ctx.fromAyah,
          toAyah: ctx.toAyah,
          reciterName: ctx.reciterName,
          format: outputFormat,
        });

      let localBlobUrl: string | null = null;
      let localBlob: Blob | null = null;
      if (jobStatus.result.sizeBytes <= ctx.blobDownloadMaxBytes) {
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
        srtUrl: ctx.hasVerseTexts ? `${streamUrl}&kind=srt` : null,
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
