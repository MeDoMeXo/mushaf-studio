/**
 * MP3Quran Timing & Audio Slicing Engine
 *
 * Fetches millisecond-precise ayah timings from the official MP3Quran API
 * and slices full-surah MP3 audio files into verse-by-verse segments using FFmpeg.
 * This guarantees 100% slide-to-audio synchronization for MP3Quran reciters
 * such as Mansour Al-Salimi (read 245), Ahmad Al-Nufais (read 259), and Hassan Saleh (read 299).
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import type { ReciterOption } from './quran-data-types';
import { globalVerseIdToSurahAyah } from './quran-utils';
import { resolveFfmpegPath } from './ffmpeg-resolver';
import { readCachedAudio, writeCachedAudio } from './server-audio-cache';
import { isReciterVerseSynced } from './reciter-filter';

export { isReciterVerseSynced };

const execFileAsync = promisify(execFile);

export interface AyahTimingInfo {
  ayah: number;
  startSec: number;
  endSec: number;
  durationSec: number;
}

export interface RawMp3QuranTimingItem {
  ayah: number;
  start_time: number; // in milliseconds
  end_time: number;   // in milliseconds
}

// In-memory LRU cache for fetched timing tables: key = `${surah}_${readId}`
const TIMING_CACHE = new Map<string, Map<number, AyahTimingInfo>>();

/**
 * Parses raw JSON timing array from MP3Quran API into a structured map indexed by ayah number.
 */
export function parseAyatTimingResponse(items: RawMp3QuranTimingItem[]): Map<number, AyahTimingInfo> {
  const map = new Map<number, AyahTimingInfo>();
  if (!Array.isArray(items)) return map;

  for (const item of items) {
    if (typeof item.ayah !== 'number' || typeof item.start_time !== 'number' || typeof item.end_time !== 'number') {
      continue;
    }
    const startSec = Math.round((item.start_time / 1000) * 1000) / 1000;
    const endSec = Math.round((item.end_time / 1000) * 1000) / 1000;
    const durationSec = Math.max(0.2, Math.round((endSec - startSec) * 1000) / 1000);
    map.set(item.ayah, {
      ayah: item.ayah,
      startSec,
      endSec,
      durationSec,
    });
  }
  return map;
}

/**
 * Fetches ayah timing data for a specific surah and read ID from the MP3Quran API.
 */
export async function fetchAyatTiming(surah: number, readId: number): Promise<Map<number, AyahTimingInfo> | null> {
  const cacheKey = `${surah}_${readId}`;
  const existing = TIMING_CACHE.get(cacheKey);
  if (existing) return existing;

  const url = `https://mp3quran.net/api/v3/ayat_timing?surah=${surah}&read=${readId}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MushafStudio/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as RawMp3QuranTimingItem[];
    const parsed = parseAyatTimingResponse(data);
    if (parsed.size > 0) {
      TIMING_CACHE.set(cacheKey, parsed);
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

const SURAHS_CACHE_DIR = path.join(process.cwd(), 'public', 'audio-cache', 'surahs');
const SLICED_CACHE_DIR = path.join(process.cwd(), 'public', 'audio-cache', 'sliced');

/**
 * Ensures a full-surah MP3 is downloaded locally to allow fast FFmpeg slicing.
 */
async function ensureSurahAudioFile(reciter: ReciterOption, surah: number): Promise<string | null> {
  if (!reciter.mp3quranServer) return null;
  await fs.mkdir(SURAHS_CACHE_DIR, { recursive: true });

  const sss = String(surah).padStart(3, '0');
  const safeSlug = reciter.slug.replace(/[^a-z0-9_-]/gi, '_');
  const localSurahPath = path.join(SURAHS_CACHE_DIR, `${safeSlug}_${sss}.mp3`);

  try {
    const stat = await fs.stat(localSurahPath);
    if (stat.size >= 1024) return localSurahPath;
  } catch {
    // Need download
  }

  const upstreamUrl = `${reciter.mp3quranServer}${sss}.mp3`;
  try {
    const res = await fetch(upstreamUrl, {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;

    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength < 1024) return null;

    await fs.writeFile(localSurahPath, Buffer.from(arrayBuf));
    return localSurahPath;
  } catch {
    return null;
  }
}

/**
 * Slices a single ayah from a full surah MP3 and returns the sliced audio Buffer.
 * Caches the sliced verse both in memory/disk and in the project's server audio cache.
 */
export async function getOrSliceVerseAudio(
  reciter: ReciterOption,
  globalVerseId: number
): Promise<Buffer | null> {
  // 1) First check durable server cache
  const existing = await readCachedAudio(reciter.slug, globalVerseId);
  if (existing && existing.byteLength >= 1024) {
    return existing;
  }

  if (reciter.source !== 'mp3quran' || !reciter.mp3quranReadId || !reciter.mp3quranServer) {
    return null;
  }

  const { surah, ayah } = globalVerseIdToSurahAyah(globalVerseId);

  // 2) Fetch ayah timing
  const timingMap = await fetchAyatTiming(surah, reciter.mp3quranReadId);
  if (!timingMap) return null;

  const timing = timingMap.get(ayah);
  if (!timing) return null;

  // 3) Download/ensure full surah MP3 exists
  const surahPath = await ensureSurahAudioFile(reciter, surah);
  if (!surahPath) return null;

  // 4) Execute FFmpeg slice
  await fs.mkdir(SLICED_CACHE_DIR, { recursive: true });
  const safeSlug = reciter.slug.replace(/[^a-z0-9_-]/gi, '_');
  const destAyahPath = path.join(SLICED_CACHE_DIR, `${safeSlug}_${globalVerseId}.mp3`);

  const ffmpeg = resolveFfmpegPath();
  try {
    await execFileAsync(ffmpeg, [
      '-y',
      '-ss', timing.startSec.toFixed(3),
      '-t', timing.durationSec.toFixed(3),
      '-i', surahPath,
      '-c:a', 'libmp3lame',
      '-b:a', `${reciter.bitrate || 128}k`,
      destAyahPath,
    ]);

    const slicedBuf = await fs.readFile(destAyahPath);
    if (slicedBuf.byteLength >= 512) {
      // Store in durable server audio cache for instant future serving
      await writeCachedAudio(reciter.slug, globalVerseId, slicedBuf);
      return slicedBuf;
    }
    return null;
  } catch (err) {
    console.error(`[mp3quran-timing] FFmpeg slicing error for ${reciter.slug} verse ${globalVerseId}:`, err);
    return null;
  }
}
