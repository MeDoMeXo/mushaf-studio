export const AUDIO_BATCH_MAX_VERSES = 20;
export const AUDIO_BATCH_CLIENT_CHUNK_SIZE = 16;
export const AUDIO_BATCH_MAX_RESPONSE_BYTES = 18 * 1024 * 1024; // 18 MB safe ceiling under Cloud Run 32 MB limit

export interface AudioBatchFrame {
  verseId: number;
  data: Uint8Array;
}

/**
 * Encodes an array of { verseId, data } into a compact binary stream:
 * Repeated [uint32BE verseId][uint32BE byteLength][raw bytes].
 * Zero base64 bloat, zero external dependencies.
 */
export function encodeAudioBatchFrames(frames: AudioBatchFrame[]): Uint8Array {
  let totalBytes = 0;
  for (const frame of frames) {
    totalBytes += 8 + frame.data.byteLength;
  }

  const out = new Uint8Array(totalBytes);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  let offset = 0;

  for (const frame of frames) {
    view.setUint32(offset, frame.verseId >>> 0, false);
    view.setUint32(offset + 4, frame.data.byteLength >>> 0, false);
    offset += 8;
    if (frame.data.byteLength > 0) {
      out.set(frame.data, offset);
      offset += frame.data.byteLength;
    }
  }

  return out;
}

/**
 * Decodes a binary stream created by encodeAudioBatchFrames back into frames.
 */
export function decodeAudioBatchFrames(buffer: ArrayBuffer | Uint8Array): AudioBatchFrame[] {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const frames: AudioBatchFrame[] = [];
  let offset = 0;

  while (offset + 8 <= bytes.byteLength) {
    const verseId = view.getUint32(offset, false);
    const length = view.getUint32(offset + 4, false);
    offset += 8;
    if (offset + length > bytes.byteLength) {
      break;
    }
    const data = bytes.slice(offset, offset + length);
    offset += length;
    frames.push({ verseId, data });
  }

  return frames;
}

/**
 * Parses an HTTP Retry-After header (seconds or HTTP-date) into milliseconds, clamped to [500, 30000].
 */
export function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds > 0) {
    return Math.min(30_000, Math.max(500, Math.round(asSeconds * 1000)));
  }
  const parsedDate = Date.parse(trimmed);
  if (Number.isFinite(parsedDate)) {
    const diff = parsedDate - Date.now();
    if (diff > 0) return Math.min(30_000, Math.max(500, diff));
  }
  return null;
}

/**
 * Computes exponential backoff delay for HTTP 429 / transient 5xx responses.
 */
export function computeRateLimitBackoffMs(
  attempt: number,
  retryAfterHeader: string | null = null
): number {
  const fromHeader = parseRetryAfterMs(retryAfterHeader);
  if (fromHeader !== null) return fromHeader;
  const schedule = [2000, 4000, 7000, 11000, 15000, 20000];
  return schedule[Math.min(Math.max(0, attempt), schedule.length - 1)];
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 408 || status === 502 || status === 503 || status === 504;
}
