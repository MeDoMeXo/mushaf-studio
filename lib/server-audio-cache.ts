/**
 * Server-side persistent audio cache (roadmap item 4).
 *
 * The single-ayah proxy re-fetches the same MP3 from the upstream CDN on every
 * cold client. This module adds a durable on-disk LRU-ish cache layer:
 *
 *  -  cache hit  → served instantly from /tmp (or a configured root), no upstream call
 *  -  cache miss → streamed to the client WHILE a background task writes the file
 *  -  bounds     → total bytes + file count capped; evicts oldest files when exceeded
 *
 * Range requests are served from cache only when we have the FULL file (a
 * partial slice can't answer arbitrary ranges), otherwise they pass through.
 */
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const AUDIO_CACHE_ROOT = process.env.AUDIO_CACHE_DIR ?? join(tmpdir(), 'quran-audio-cache');
export const AUDIO_CACHE_MAX_BYTES = 256 * 1024 * 1024; // 256 MB total budget
export const AUDIO_CACHE_MAX_FILES = 4096;
export const AUDIO_CACHE_MAX_FILE_BYTES = 4 * 1024 * 1024; // one verse MP3 is 100–600 KB; 4 MB is generous

/** Builds the deterministic cache key for one reciter + global verse id. */
export function buildServerAudioCacheKey(reciterSlug: string, globalVerseId: number): string {
  const safeId = Math.max(1, Math.min(6236, Math.floor(globalVerseId || 1)));
  const sanitized = reciterSlug.replace(/[^a-z0-9.-]/gi, '_');
  return `${sanitized}_${safeId}.mp3`;
}

/** A file qualifies for caching only when fully downloaded and within bounds. */
export function isCacheableAudioPayload(
  status: number,
  contentLength: number | null,
  contentType: string | null
): boolean {
  if (status !== 200) return false; // 206 partials are never stored as full files
  if (contentType && !/audio\//i.test(contentType) && !/octet-stream/i.test(contentType)) {
    return false; // don't persist HTML error pages disguised as audio
  }
  if (contentLength === null) return false; // unknown size → can't enforce bounds
  return contentLength > 0 && contentLength <= AUDIO_CACHE_MAX_FILE_BYTES;
}

/** Eviction: drop oldest files until both byte and count budgets fit again. */
export function pickEvictionVictims(
  entries: { key: string; size: number; mtimeMs: number }[],
  maxBytes: number,
  maxFiles: number
): string[] {
  const victims: string[] = [];
  let total = entries.reduce((acc, e) => acc + e.size, 0);
  const byOldest = [...entries].sort((a, b) => a.mtimeMs - b.mtimeMs);
  let fileCount = entries.length;
  for (const e of byOldest) {
    if (total <= maxBytes && fileCount <= maxFiles) break;
    victims.push(e.key);
    total -= e.size;
    fileCount -= 1;
  }
  return victims;
}

/**
 * Reads a cached verse payload. Returns null on any miss/error — callers
 * fall back to the upstream path, so cache failures must never 5xx the route.
 */
export async function readCachedAudio(
  reciterSlug: string,
  globalVerseId: number
): Promise<Buffer | null> {
  const key = buildServerAudioCacheKey(reciterSlug, globalVerseId);
  const filePath = join(AUDIO_CACHE_ROOT, key);
  try {
    const st = await stat(filePath);
    if (!st.isFile() || st.size === 0 || st.size > AUDIO_CACHE_MAX_FILE_BYTES) {
      return null;
    }
    return await readFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Persists a fetched payload in the background (fire-and-forget safe): the
 * caller keeps streaming to the client while this runs.
 */
export async function writeCachedAudio(
  reciterSlug: string,
  globalVerseId: number,
  payload: Buffer
): Promise<boolean> {
  try {
    if (payload.byteLength === 0 || payload.byteLength > AUDIO_CACHE_MAX_FILE_BYTES) {
      return false;
    }
    await mkdir(AUDIO_CACHE_ROOT, { recursive: true });
    await writeFile(join(AUDIO_CACHE_ROOT, buildServerAudioCacheKey(reciterSlug, globalVerseId)), payload);

    // Cheap enforcement of the global budgets after each write.
    const names = await readdir(AUDIO_CACHE_ROOT);
    const entries: { key: string; size: number; mtimeMs: number }[] = [];
    for (const name of names) {
      const st = await stat(join(AUDIO_CACHE_ROOT, name));
      if (st.isFile()) {
        entries.push({ key: name, size: st.size, mtimeMs: st.mtimeMs });
      }
    }
    const victims = pickEvictionVictims(entries, AUDIO_CACHE_MAX_BYTES, AUDIO_CACHE_MAX_FILES);
    await Promise.all(victims.map((k) => unlink(join(AUDIO_CACHE_ROOT, k)).catch(() => {})));
    return true;
  } catch {
    return false; // cache write failures are never fatal
  }
}
