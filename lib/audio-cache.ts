import {
  AUDIO_BATCH_CLIENT_CHUNK_SIZE,
  computeRateLimitBackoffMs,
  decodeAudioBatchFrames,
  isRetryableHttpStatus,
} from './audio-batch-codec';
import { RECITERS } from './quran-data';
import { getReciterAudioUrl, getUpstreamAudioUrl } from './quran-utils';
import { getClientCustomReciters } from './custom-reciters-registry';

export const AUDIO_CACHE_NAME = 'mushaf-studio-audio-v2';
export const MAX_MEMORY_AUDIO_ENTRIES = 360;
export const MAX_BATCH_AUDIO_BYTES = 14 * 1024 * 1024; // 14 MB audio budget per slide+audio batch (well under 32 MB Cloud Run cap)

export type AudioCacheStatus = 'idle' | 'loading' | 'ready' | 'partial';

export interface AudioCacheProgress {
  status: AudioCacheStatus;
  cached: number;
  total: number;
  failed: number;
  fromCacheHits: number;
}

export function buildAudioCacheKey(reciterSlug: string, verseId: number): string {
  return getReciterAudioUrl(reciterSlug, verseId);
}

export function computeCacheProgress(
  cached: number,
  total: number,
  failed = 0
): { pct: number; status: AudioCacheStatus } {
  const safeTotal = Math.max(0, Math.floor(total));
  const safeCached = Math.max(0, Math.min(safeTotal, Math.floor(cached)));
  const safeFailed = Math.max(0, Math.floor(failed));

  if (safeTotal === 0) {
    return { pct: 0, status: 'idle' };
  }
  const pct = Math.min(100, Math.round((safeCached / safeTotal) * 100));
  if (safeCached >= safeTotal) {
    return { pct: 100, status: 'ready' };
  }
  if (safeCached + safeFailed >= safeTotal && safeFailed > 0) {
    return { pct, status: 'partial' };
  }
  return { pct, status: 'loading' };
}

export function shouldAttachAudioToBatch(
  currentBatchAudioBytes: number,
  nextBlobBytes: number,
  maxBytes = MAX_BATCH_AUDIO_BYTES
): boolean {
  if (nextBlobBytes < 128) return false;
  return currentBatchAudioBytes + nextBlobBytes <= maxBytes;
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// Fast in-memory hot cache (LRU order via Map insertion) backed by browser Cache Storage API
const memoryAudioCache = new Map<string, Blob>();

function setMemoryAudio(key: string, blob: Blob): void {
  if (memoryAudioCache.has(key)) {
    memoryAudioCache.delete(key);
  }
  memoryAudioCache.set(key, blob);
  while (memoryAudioCache.size > MAX_MEMORY_AUDIO_ENTRIES) {
    const oldestKey = memoryAudioCache.keys().next().value;
    if (!oldestKey) break;
    memoryAudioCache.delete(oldestKey);
  }
}

async function openAudioCacheStorage(): Promise<Cache | null> {
  if (typeof window === 'undefined' || typeof caches === 'undefined') {
    return null;
  }
  try {
    return await caches.open(AUDIO_CACHE_NAME);
  } catch {
    return null;
  }
}

export async function getCachedVerseAudioBlob(
  reciterSlug: string,
  verseId: number
): Promise<Blob | null> {
  const key = buildAudioCacheKey(reciterSlug, verseId);
  const mem = memoryAudioCache.get(key);
  if (mem && mem.size >= 128) {
    return mem;
  }

  const store = await openAudioCacheStorage();
  if (!store) return null;

  try {
    const match = await store.match(key);
    if (!match || !match.ok) return null;
    const blob = await match.blob();
    if (blob.size < 128) return null;
    setMemoryAudio(key, blob);
    return blob;
  } catch {
    return null;
  }
}

export async function putCachedVerseAudioBlob(
  reciterSlug: string,
  verseId: number,
  blob: Blob
): Promise<void> {
  if (blob.size < 128) return;
  const key = buildAudioCacheKey(reciterSlug, verseId);
  setMemoryAudio(key, blob);

  const store = await openAudioCacheStorage();
  if (!store) return;

  try {
    const res = new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': blob.type || 'audio/mpeg',
        'X-Audio-Cached-At': String(Date.now()),
      },
    });
    await store.put(key, res);
  } catch {
    // QuotaExceededError or private mode — in-memory cache still holds the blob
  }
}

function supportsDirectBrowserCors(reciterSlug: string): boolean {
  const extras = getClientCustomReciters();
  const found =
    RECITERS.find((r) => r.slug === reciterSlug) ??
    extras.find((r) => r.slug === reciterSlug);
  // EveryAyah CDN sends Access-Control-Allow-Origin: * so browser can fetch directly with 0 Cloud Run proxy requests
  return found?.source === 'everyayah';
}

async function fetchDirectEveryAyahBlob(
  reciterSlug: string,
  verseId: number,
  signal?: AbortSignal
): Promise<Blob | null> {
  const directUrl = getUpstreamAudioUrl(reciterSlug, verseId);
  try {
    const res = await fetch(directUrl, { signal, mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size < 128) return null;
    await putCachedVerseAudioBlob(reciterSlug, verseId, blob);
    return blob;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return null;
  }
}

async function fetchBatchFromServer(
  reciterSlug: string,
  verseIds: number[],
  signal?: AbortSignal
): Promise<{ okIds: number[]; failedIds: number[] }> {
  const okIds: number[] = [];
  const failedIds: number[] = [];

  // EveryAyah custom reciters need their folder spec in the request body so
  // the server proxy can resolve the upstream URL for a non-whitelisted slug.
  const isBuiltIn = RECITERS.some((r) => r.slug === reciterSlug);
  const customFolder = isBuiltIn
    ? undefined
    : getClientCustomReciters().find(
        (r) => r.slug === reciterSlug && r.source === 'everyayah' && r.everyayahFolder
      )?.everyayahFolder;

  let res: Response | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Audio prefetch aborted', 'AbortError');
    }
    try {
      const candidate = await fetch('/api/audio/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          customFolder
            ? { reciter: reciterSlug, verseIds, folder: customFolder }
            : { reciter: reciterSlug, verseIds }
        ),
        signal,
      });
      if (candidate.ok) {
        res = candidate;
        break;
      }
      if (isRetryableHttpStatus(candidate.status) && attempt < 4) {
        const waitMs = computeRateLimitBackoffMs(attempt, candidate.headers.get('retry-after'));
        await abortableSleep(waitMs, signal);
        continue;
      }
      break;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      if (attempt < 4) {
        await abortableSleep(computeRateLimitBackoffMs(attempt), signal);
      }
    }
  }

  if (!res) {
    return { okIds: [], failedIds: [...verseIds] };
  }

  const ab = await res.arrayBuffer();
  const frames = decodeAudioBatchFrames(ab);
  const handled = new Set<number>();

  for (const frame of frames) {
    handled.add(frame.verseId);
    if (frame.data.byteLength >= 128) {
      const blob = new Blob([frame.data.buffer.slice(frame.data.byteOffset, frame.data.byteOffset + frame.data.byteLength) as ArrayBuffer], {
        type: 'audio/mpeg',
      });
      await putCachedVerseAudioBlob(reciterSlug, frame.verseId, blob);
      okIds.push(frame.verseId);
    } else {
      failedIds.push(frame.verseId);
    }
  }

  for (const vid of verseIds) {
    if (!handled.has(vid)) failedIds.push(vid);
  }

  return { okIds, failedIds };
}

export async function fetchAndCacheVerseAudio(
  reciterSlug: string,
  verseId: number,
  signal?: AbortSignal
): Promise<Blob> {
  const existing = await getCachedVerseAudioBlob(reciterSlug, verseId);
  if (existing) return existing;

  if (supportsDirectBrowserCors(reciterSlug)) {
    const direct = await fetchDirectEveryAyahBlob(reciterSlug, verseId, signal);
    if (direct) return direct;
  }

  const url = buildAudioCacheKey(reciterSlug, verseId);
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Audio prefetch aborted', 'AbortError');
    }
    try {
      const res = await fetch(url, { signal });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size < 128) {
          throw new Error(`Empty audio blob for ${url}`);
        }
        await putCachedVerseAudioBlob(reciterSlug, verseId, blob);
        return blob;
      }
      if (isRetryableHttpStatus(res.status) && attempt < 2) {
        await abortableSleep(computeRateLimitBackoffMs(attempt, res.headers.get('retry-after')), signal);
        continue;
      }
      throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      lastErr = err;
      if (attempt < 2) {
        await abortableSleep(computeRateLimitBackoffMs(attempt), signal);
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(`Failed to cache verse ${verseId}`);
}

export async function preloadVersesToBrowserCache(options: {
  reciterSlug: string;
  verseIds: number[];
  signal?: AbortSignal;
  onProgress?: (progress: AudioCacheProgress) => void;
}): Promise<AudioCacheProgress> {
  const { reciterSlug, verseIds, signal, onProgress } = options;
  const total = verseIds.length;
  if (total === 0) {
    const empty: AudioCacheProgress = {
      status: 'idle',
      cached: 0,
      total: 0,
      failed: 0,
      fromCacheHits: 0,
    };
    onProgress?.(empty);
    return empty;
  }

  // Phase 1: Fast scan of browser Cache Storage & memory so already-cached verses appear immediately
  const missing: number[] = [];
  let cached = 0;
  let fromCacheHits = 0;

  const store = await openAudioCacheStorage();
  for (let i = 0; i < verseIds.length; i++) {
    if (signal?.aborted) {
      return { status: 'idle', cached, total, failed: 0, fromCacheHits };
    }
    const vid = verseIds[i];
    const key = buildAudioCacheKey(reciterSlug, vid);
    if (memoryAudioCache.has(key)) {
      cached++;
      fromCacheHits++;
      continue;
    }
    if (store) {
      try {
        const hit = await store.match(key);
        if (hit && hit.ok) {
          cached++;
          fromCacheHits++;
          continue;
        }
      } catch {
        // treat as miss
      }
    }
    missing.push(vid);
  }

  const emitProgress = (failedCount: number) => {
    const { status } = computeCacheProgress(cached, total, failedCount);
    onProgress?.({
      status,
      cached,
      total,
      failed: failedCount,
      fromCacheHits,
    });
  };

  emitProgress(0);

  if (missing.length === 0) {
    return { status: 'ready', cached, total, failed: 0, fromCacheHits };
  }

  let failed = 0;

  // Phase 2A: EveryAyah reciters fetch directly from CDN (CORS *, 0 Cloud Run proxy requests!)
  if (supportsDirectBrowserCors(reciterSlug)) {
    const fallbackIds: number[] = [];
    let cursor = 0;
    let lastEmitAt = 0;
    const workerCount = Math.min(6, missing.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (cursor < missing.length) {
          if (signal?.aborted) return;
          const vid = missing[cursor++];
          const blob = await fetchDirectEveryAyahBlob(reciterSlug, vid, signal);
          if (blob) {
            cached++;
          } else {
            fallbackIds.push(vid);
          }
          const now = Date.now();
          if (cached + fallbackIds.length >= total || now - lastEmitAt >= 150) {
            lastEmitAt = now;
            emitProgress(failed);
          }
        }
      })
    );

    // Fallback to batched server proxy only for any verses direct CORS couldn't fetch
    for (let start = 0; start < fallbackIds.length; start += AUDIO_BATCH_CLIENT_CHUNK_SIZE) {
      if (signal?.aborted) break;
      const chunk = fallbackIds.slice(start, start + AUDIO_BATCH_CLIENT_CHUNK_SIZE);
      const res = await fetchBatchFromServer(reciterSlug, chunk, signal);
      cached += res.okIds.length;
      failed += res.failedIds.length;
      emitProgress(failed);
    }
  } else {
    // Phase 2B: Batched sequential server fetch (16 verses per HTTP request -> only 18 requests for all 286 verses of Al-Baqarah!)
    for (let start = 0; start < missing.length; start += AUDIO_BATCH_CLIENT_CHUNK_SIZE) {
      if (signal?.aborted) break;
      const chunk = missing.slice(start, start + AUDIO_BATCH_CLIENT_CHUNK_SIZE);
      const res = await fetchBatchFromServer(reciterSlug, chunk, signal);
      cached += res.okIds.length;
      failed += res.failedIds.length;
      emitProgress(failed);
      if (start + AUDIO_BATCH_CLIENT_CHUNK_SIZE < missing.length && !signal?.aborted) {
        try {
          await abortableSleep(140, signal);
        } catch {
          break;
        }
      }
    }
  }

  const finalStatus = computeCacheProgress(cached, total, failed).status;
  const finalResult: AudioCacheProgress = {
    status: signal?.aborted ? 'idle' : finalStatus,
    cached,
    total,
    failed,
    fromCacheHits,
  };
  if (!signal?.aborted) {
    onProgress?.(finalResult);
  }
  return finalResult;
}

export async function clearBrowserAudioCache(): Promise<void> {
  memoryAudioCache.clear();
  if (typeof window !== 'undefined' && typeof caches !== 'undefined') {
    await caches.delete(AUDIO_CACHE_NAME).catch(() => {});
  }
}
