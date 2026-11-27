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

export const MAX_UPLOAD_BATCH_BYTES = 14 * 1024 * 1024; // 14 MB safe request ceiling under Cloud Run 32 MB limit

export function isHtmlPayloadText(text: string): boolean {
  const head = text.trimStart().slice(0, 256).toLowerCase();
  if (!head) return false;
  return (
    head.startsWith('<!doctype') ||
    head.startsWith('<html') ||
    head.startsWith('<head') ||
    head.startsWith('<body') ||
    (head.startsWith('<!--') && head.includes('<html'))
  );
}

export function isHtmlResponse(res: Response): boolean {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  return ct.includes('text/html') || ct.includes('application/xhtml+xml');
}

export function buildProxyHtmlErrorMessage(
  status: number,
  contextLabel: string,
  redirected?: boolean
): string {
  if (status === 413) {
    return `حجم ملفات التصدير المرفوعة تجاوز حد الخادم (رمز 413) — جرّب دقة أخف أو تقليل عدد الآيات ثم أعد المحاولة`;
  }
  if (status === 401 || status === 403 || redirected) {
    return `انتهت جلسة الاتصال أو تعذّر التحقق من الصلاحية أثناء ${contextLabel} (رمز ${status}) — حدّث الصفحة ثم أعد المحاولة`;
  }
  if (status === 404) {
    return `تعذّر العثور على خدمة التصدير على الخادم أثناء ${contextLabel} (رمز 404) — حدّث الصفحة وأعد المحاولة`;
  }
  if (status === 502 || status === 503 || status === 504) {
    return `الخادم أو البوابة الوسيطة مشغولة مؤقتاً أثناء ${contextLabel} (رمز ${status}) — أعد المحاولة بعد ثوانٍ`;
  }
  return `${contextLabel}: أعاد الخادم صفحة HTML بدلاً من بيانات التصدير (رمز ${status}) — حدّث الصفحة وأعد المحاولة`;
}

/**
 * Safely parses a JSON HTTP response without ever throwing raw SyntaxError
 * ("Unexpected token '<', <!doctype ..."). Detects proxy/auth HTML pages first.
 */
export async function safeParseJsonResponse<T>(
  res: Response,
  contextLabel: string
): Promise<T> {
  const rawText = await res.text();
  if (isHtmlResponse(res) || isHtmlPayloadText(rawText)) {
    throw new Error(buildProxyHtmlErrorMessage(res.status, contextLabel, res.redirected));
  }
  if (!rawText.trim()) {
    throw new Error(`${contextLabel}: استجابة فارغة من الخادم (رمز ${res.status})`);
  }
  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error(`${contextLabel}: استجابة غير صالحة من الخادم (رمز ${res.status})`);
  }
}

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

function mergeJsonAcceptHeaders(headers: HeadersInit | undefined, expectJson?: boolean): Headers | undefined {
  if (!expectJson) return headers ? new Headers(headers) : undefined;
  const merged = new Headers(headers);
  if (!merged.has('Accept')) {
    merged.set('Accept', 'application/json');
  }
  return merged;
}

async function isUnexpectedHtmlOnOkJson(res: Response): Promise<boolean> {
  if (isHtmlResponse(res)) return true;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('json')) return false;
  try {
    const text = await res.clone().text();
    return isHtmlPayloadText(text);
  } catch {
    return false;
  }
}

/** fetch with bounded retries honoring 429 Retry-After backoff and transient HTML proxy pages. */
export async function fetchWithRateLimitRetry(
  url: string,
  init: RequestInit,
  opts: {
    signal?: AbortSignal;
    maxAttempts?: number;
    expectJson?: boolean;
    retryDelayOverrideMs?: number;
    onRetry?: (attempt: number, status: number) => void;
  } = {}
): Promise<Response> {
  const maxAttempts = opts.maxAttempts ?? 6;
  let lastResponse: Response | null = null;
  const headers = mergeJsonAcceptHeaders(init.headers, opts.expectJson);
  const finalInit: RequestInit = {
    credentials: 'same-origin',
    ...init,
    ...(headers ? { headers } : {}),
  };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (opts.signal?.aborted) {
      throw new DOMException('Export aborted', 'AbortError');
    }
    try {
      const res = await fetch(url, { ...finalInit, signal: opts.signal });
      const htmlInterstitial =
        res.ok && opts.expectJson ? await isUnexpectedHtmlOnOkJson(res) : false;

      if (htmlInterstitial) {
        lastResponse = res;
        if (attempt === maxAttempts - 1) return res;
        opts.onRetry?.(attempt + 1, res.status);
        const waitMs =
          opts.retryDelayOverrideMs ??
          computeRateLimitBackoffMs(attempt, res.headers.get('retry-after'));
        await abortableSleep(waitMs, opts.signal);
        continue;
      }

      if (res.ok || !isRetryableHttpStatus(res.status) || attempt === maxAttempts - 1) {
        return res;
      }
      lastResponse = res;
      opts.onRetry?.(attempt + 1, res.status);
      const waitMs =
        opts.retryDelayOverrideMs ??
        computeRateLimitBackoffMs(attempt, res.headers.get('retry-after'));
      await abortableSleep(waitMs, opts.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      if (attempt === maxAttempts - 1) {
        throw err;
      }
      opts.onRetry?.(attempt + 1, 0);
      const waitMs =
        opts.retryDelayOverrideMs ?? computeRateLimitBackoffMs(attempt, null);
      await abortableSleep(waitMs, opts.signal);
    }
  }

  if (lastResponse) return lastResponse;
  throw new Error('تعذّر الاتصال بالخادم بعد عدة محاولات');
}

export function splitAmbientFramesByBytes(
  frames: Blob[],
  maxBatchBytes = MAX_UPLOAD_BATCH_BYTES
): { index: number; blob: Blob }[][] {
  if (!frames.length) return [];
  const cap = Math.max(256 * 1024, maxBatchBytes);
  const groups: { index: number; blob: Blob }[][] = [];
  let current: { index: number; blob: Blob }[] = [];
  let currentBytes = 0;

  for (let i = 0; i < frames.length; i++) {
    const blob = frames[i];
    if (current.length > 0 && currentBytes + blob.size > cap) {
      groups.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push({ index: i, blob });
    currentBytes += blob.size;
  }
  if (current.length > 0) {
    groups.push(current);
  }
  return groups;
}

/**
 * Uploads static backdrop/overlay and animated ambient frames in byte-bounded
 * PUTs before slide batches so Cloud Run's 32 MB limit is never exceeded.
 */
export async function uploadExportSetupAssets(params: {
  jobId: string;
  backdropBlob: Blob | null;
  overlayBlob: Blob | null;
  ambientFrames: Blob[];
  signal: AbortSignal;
  onRetryLabel: (label: string) => void;
}): Promise<void> {
  const { jobId, backdropBlob, overlayBlob, ambientFrames, signal, onRetryLabel } = params;
  const uploadForm = async (form: FormData, label: string) => {
    const res = await fetchWithRateLimitRetry(
      `/api/studio/export/session?id=${encodeURIComponent(jobId)}`,
      { method: 'PUT', body: form },
      {
        signal,
        maxAttempts: 6,
        expectJson: true,
        onRetry: () => onRetryLabel(label),
      }
    );
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'تعذّر رفع أصول الخلفية للتصدير'));
    }
  };

  if (backdropBlob || overlayBlob) {
    const combinedBytes = (backdropBlob?.size ?? 0) + (overlayBlob?.size ?? 0);
    if (backdropBlob && overlayBlob && combinedBytes > MAX_UPLOAD_BATCH_BYTES) {
      const f1 = new FormData();
      f1.append('backdrop', backdropBlob, 'backdrop.png');
      await uploadForm(f1, 'الخادم مزدحم مؤقتاً — إعادة رفع الخلفية...');
      const f2 = new FormData();
      f2.append('overlay', overlayBlob, 'overlay.png');
      await uploadForm(f2, 'الخادم مزدحم مؤقتاً — إعادة رفع طبقة الزخرفة...');
    } else {
      const form = new FormData();
      if (backdropBlob) form.append('backdrop', backdropBlob, 'backdrop.png');
      if (overlayBlob) form.append('overlay', overlayBlob, 'overlay.png');
      await uploadForm(form, 'الخادم مزدحم مؤقتاً — إعادة رفع الخلفية...');
    }
  }

  const ambientGroups = splitAmbientFramesByBytes(ambientFrames, MAX_UPLOAD_BATCH_BYTES);
  for (let g = 0; g < ambientGroups.length; g++) {
    if (signal.aborted) {
      throw new DOMException('Export aborted', 'AbortError');
    }
    const form = new FormData();
    for (const item of ambientGroups[g]) {
      const key = `ambient_${String(item.index).padStart(3, '0')}`;
      form.append(key, item.blob, `${key}.png`);
    }
    await uploadForm(form, 'الخادم مزدحم مؤقتاً — إعادة رفع إطارات الحركة...');
    if (g < ambientGroups.length - 1) {
      await abortableSleep(120, signal);
    }
  }
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

/** Extracts a JSON error message from a failed response, translating proxy HTML pages clearly. */
export async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  const rawText = await res.text().catch(() => '');
  if (isHtmlResponse(res) || isHtmlPayloadText(rawText)) {
    return buildProxyHtmlErrorMessage(res.status, fallback, res.redirected);
  }
  if (rawText.trim()) {
    try {
      const json = JSON.parse(rawText) as { error?: string };
      if (json.error) return json.error;
    } catch {
      // non-JSON proxy response
    }
  }
  return `${fallback} (رمز ${res.status})`;
}
