/**
 * Helpers for the synchronous export route (app/api/studio/export/route.ts).
 * Extracted per the 600-line file rule: duration probing, verse-audio
 * download, bounded concurrency, and the shared FFmpeg-missing error string.
 */
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import { getUpstreamAudioUrl } from '@/lib/quran-utils';
import {
  isFfmpegAvailable,
  isFfprobeAvailable,
  resolveFfmpegPath,
  resolveFfprobePath,
} from '@/lib/export-job-helpers';
import type {
  AmbientSoundPreset,
  AudioEffectPreset,
  SlideTransitionType,
  VideoExportFormat,
  VideoFpsOption,
  VideoQualityTier,
  VideoResolutionTier,
} from '@/lib/video-export';

const execFileAsync = promisify(execFile);

/** Human-readable Arabic error shown when FFmpeg is not installed. */
export const FFMPEG_MISSING_ERROR =
  'لم يتم العثور على FFmpeg على النظام — ثبّته (winget install Gyan.FFmpeg على ويندوز، أو brew install ffmpeg على ماك) ثم أعد التصدير مباشرة؛ وإن ثبّته يدوياً فأضبطه على PATH وأعد تشغيل خادم التطوير، أو اضبط FFMPEG_PATH.';

export interface ExportPayloadMeta {
  surahId: number;
  fromAyah: number;
  toAyah: number;
  reciter: string;
  verseIds: number[];
  baseWidth: number;
  baseHeight: number;
  format: VideoExportFormat;
  resolution: VideoResolutionTier;
  fps: VideoFpsOption;
  quality: VideoQualityTier;
  transition: SlideTransitionType;
  transitionDurationMs: number;
  audioPreset: AudioEffectPreset;
  ambientSound: AmbientSoundPreset;
  ambientVolume: number;
  audioBitrate: 128 | 192 | 320;
  audioFade: boolean;
  verseGapSec: number;
}

/** Run an async worker over items with a bounded concurrency limit. */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const current = cursor++;
      await worker(items[current], current);
    }
  });
  await Promise.all(runners);
}

/**
 * Probe media duration in seconds. Prefers ffprobe JSON output; falls back to
 * parsing ffmpeg's `-i` stderr banner when ffprobe is unavailable (common on
 * Windows where spawn('ffprobe') ENOENTs even with PATH set). Returns 3.5s
 * as a last resort so the pipeline never hard-fails on probing alone.
 */
export async function probeDurationSeconds(filePath: string): Promise<number> {
  if (isFfprobeAvailable()) {
    try {
      const { stdout } = await execFileAsync(resolveFfprobePath(), [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ]);
      const parsed = Number.parseFloat(stdout.trim());
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } catch {
      // fall through to ffmpeg banner parsing
    }
  }
  if (isFfmpegAvailable()) {
    try {
      await execFileAsync(resolveFfmpegPath(), ['-hide_banner', '-i', filePath], {
        timeout: 15000,
      });
    } catch (err: unknown) {
      const stderr =
        err && typeof err === 'object' && 'stderr' in err
          ? String((err as { stderr: string }).stderr)
          : '';
      const m = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{1,3})/);
      if (m) {
        const secs =
          Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
        if (Number.isFinite(secs) && secs > 0) return secs;
      }
    }
  }
  return 3.5;
}

/** Download a verse recitation MP3 with one retry (250ms backoff). */
export async function downloadVerseAudio(
  reciterSlug: string,
  verseId: number,
  destPath: string
): Promise<void> {
  const url = getUpstreamAudioUrl(reciterSlug, verseId);
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch verse audio ${verseId} (${res.status})`);
      }
      const arrayBuf = await res.arrayBuffer();
      await fs.writeFile(destPath, Buffer.from(arrayBuf));
      return;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Failed to fetch verse audio ${verseId}`);
}
