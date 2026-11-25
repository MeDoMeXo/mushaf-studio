/**
 * Export network helpers (client-side) — extracted from StudioExportModal
 * per the 600-line file rule. Pure fetch/download logic, no React.
 */
import {
  computeRateLimitBackoffMs,
  isRetryableHttpStatus,
} from '@/lib/audio-batch-codec';
import {
  isValidVideoBinaryHeader,
  type VideoExportFormat,
} from '@/lib/video-export';

/** Sleep that rejects with AbortError the moment the signal fires. */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Export aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Export aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** fetch with bounded retries honoring 429 Retry-After backoff. */
export async function fetchWithRateLimitRetry(
  url: string,
  init: RequestInit,
  opts: { signal?: AbortSignal; maxAttempts?: number; onRetry?: (attempt: number, status: number) => void } = {}
): Promise<Response> {
  const maxAttempts = opts.maxAttempts ?? 6;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (opts.signal?.aborted) {
      throw new DOMException('Export aborted', 'AbortError');
    }
    try {
      const res = await fetch(url, { ...init, signal: opts.signal });
      if (res.ok || !isRetryableHttpStatus(res.status) || attempt === maxAttempts - 1) {
        return res;
      }
      lastResponse = res;
      opts.onRetry?.(attempt + 1, res.status);
      const waitMs = computeRateLimitBackoffMs(attempt, res.headers.get('retry-after'));
      await abortableSleep(waitMs, opts.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      if (attempt === maxAttempts - 1) {
        throw err;
      }
      opts.onRetry?.(attempt + 1, 0);
      await abortableSleep(computeRateLimitBackoffMs(attempt, null), opts.signal);
    }
  }

  if (lastResponse) return lastResponse;
  throw new Error('تعذّر الاتصال بالخادم بعد عدة محاولات');
}

/** Anchored <a download> click that releases the node immediately. */
export function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function fetchVerifiedVideoBlob(
  streamUrl: string,
  format: VideoExportFormat,
  signal?: AbortSignal
): Promise<{ url: string; blob: Blob } | null> {
  try {
    const res = await fetchWithRateLimitRetry(
      streamUrl,
      {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      },
      { signal, maxAttempts: 5 }
    );
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.startsWith('video/')) return null;

    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength < 16_384) return null;

    const headerBytes = new Uint8Array(arrayBuf, 0, Math.min(16, arrayBuf.byteLength));
    if (!isValidVideoBinaryHeader(headerBytes, format)) {
      return null;
    }

    const mime = format === 'webm' ? 'video/webm' : 'video/mp4';
    const blob = new Blob([arrayBuf], { type: mime });
    return { url: URL.createObjectURL(blob), blob };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return null;
  }
}

/**
 * Fetches the rendered video binary and verifies its MP4 ("ftyp") or WebM
 * (EBML) magic header so proxy HTML/429 responses can never be saved as video.
 */
export async function fetchVerifiedVideoBlobUrl(
  streamUrl: string,
  format: VideoExportFormat,
  signal?: AbortSignal
): Promise<string | null> {
  const result = await fetchVerifiedVideoBlob(streamUrl, format, signal);
  return result ? result.url : null;
}

/**
 * Fallback for very large files (>120 MB): probe the first 16 bytes via Range,
 * verify the magic header, then trigger the streamed download.
 */
export async function verifyAndDownload(
  streamUrl: string,
  downloadUrl: string,
  filename: string,
  format: VideoExportFormat,
  opts: { localBlobUrl?: string | null; onErrorToast: (msg: string) => void }
): Promise<boolean> {
  if (opts.localBlobUrl && opts.localBlobUrl.startsWith('blob:')) {
    triggerDownload(opts.localBlobUrl, filename);
    return true;
  }
  try {
    const probeRes = await fetchWithRateLimitRetry(
      streamUrl,
      {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Range: 'bytes=0-15' },
        cache: 'no-store',
      },
      { maxAttempts: 5 }
    );
    const ct = (probeRes.headers.get('content-type') || '').toLowerCase();
    if ((probeRes.status === 200 || probeRes.status === 206) && ct.startsWith('video/')) {
      const probeBuf = await probeRes.arrayBuffer();
      const probeHeader = new Uint8Array(probeBuf, 0, Math.min(16, probeBuf.byteLength));
      if (isValidVideoBinaryHeader(probeHeader, format)) {
        triggerDownload(downloadUrl, filename);
        return true;
      }
    }
    opts.onErrorToast('الخادم مزدحم مؤقتاً عند تنزيل الملف — اضغط زر «تنزيل الفيديو» بعد ثوانٍ');
    return false;
  } catch {
    opts.onErrorToast('تعذّر بدء التنزيل التلقائي — اضغط زر «تنزيل الفيديو» لإعادة المحاولة');
    return false;
  }
}
