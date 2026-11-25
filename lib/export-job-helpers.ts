/**
 * FFmpeg/ffprobe + download helpers for the export render pipeline.
 * Split from lib/export-job-manager.ts per the 600-line file rule.
 */
import { execFile, spawn, type ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { getUpstreamAudioUrl } from '@/lib/quran-utils';
import { parseFfmpegTimeSeconds } from '@/lib/video-export';
import { readCachedAudio, writeCachedAudio } from '@/lib/server-audio-cache';
import { resolveReciterOption } from '@/lib/reciter-filter';
import { getOrSliceVerseAudio } from '@/lib/mp3quran-timing';
import { resolveFfmpegPath, resolveFfprobePath } from '@/lib/ffmpeg-resolver';
import type { ActiveJobRuntime } from './export-job-manager';

export { resolveFfmpegPath, resolveFfprobePath };

const execFileAsync = promisify(execFile);

export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<void>,
  isCancelled: () => boolean
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      if (isCancelled()) return;
      const current = cursor++;
      await worker(items[current], current);
    }
  });
  await Promise.all(runners);
}

export interface AudioProbeInfo {
  duration: number;
  sampleRate: number;
  channels: number;
}

export async function probeAudioInfo(filePath: string): Promise<AudioProbeInfo> {
  const { stdout } = await execFileAsync(resolveFfprobePath(), [
    '-v',
    'error',
    '-select_streams',
    'a:0',
    '-show_entries',
    'format=duration:stream=sample_rate,channels',
    '-of',
    'json',
    filePath,
  ]);
  try {
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: { sample_rate?: string; channels?: number }[];
    };
    const duration = Number.parseFloat(parsed.format?.duration ?? '');
    const sampleRate = Number.parseInt(parsed.streams?.[0]?.sample_rate ?? '', 10);
    const channels = Number(parsed.streams?.[0]?.channels ?? 0);
    return {
      duration: Number.isFinite(duration) && duration > 0 ? duration : 3.5,
      sampleRate: Number.isFinite(sampleRate) && sampleRate >= 8000 ? sampleRate : 44100,
      channels: channels === 1 || channels === 2 ? channels : 2,
    };
  } catch {
    return { duration: 3.5, sampleRate: 44100, channels: 2 };
  }
}

export interface OutputVideoProbeInfo {
  hasVideo: boolean;
  hasAudio: boolean;
  width: number;
  height: number;
  durationSec: number;
}

export async function probeOutputVideo(filePath: string): Promise<OutputVideoProbeInfo> {
  try {
    const { stdout } = await execFileAsync(resolveFfprobePath(), [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=codec_type,width,height',
      '-of',
      'json',
      filePath,
    ]);
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: { codec_type?: string; width?: number; height?: number }[];
    };
    const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
    const videoStream = streams.find((s) => s.codec_type === 'video');
    const audioStream = streams.find((s) => s.codec_type === 'audio');
    const durationSec = Number.parseFloat(parsed.format?.duration ?? '');
    return {
      hasVideo: Boolean(videoStream && (videoStream.width ?? 0) > 0 && (videoStream.height ?? 0) > 0),
      hasAudio: Boolean(audioStream),
      width: Number(videoStream?.width ?? 0),
      height: Number(videoStream?.height ?? 0),
      durationSec: Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0,
    };
  } catch {
    return { hasVideo: false, hasAudio: false, width: 0, height: 0, durationSec: 0 };
  }
}

export async function downloadVerseAudio(
  reciterSlug: string,
  verseId: number,
  destPath: string
): Promise<void> {
  const cached = await readCachedAudio(reciterSlug, verseId);
  if (cached && cached.byteLength >= 128) {
    await fs.writeFile(destPath, cached);
    return;
  }

  // MP3Quran reciters with verse timing: slice verse into exact timing segment
  const reciter = resolveReciterOption(reciterSlug);
  if (reciter.source === 'mp3quran' && reciter.mp3quranReadId) {
    const sliced = await getOrSliceVerseAudio(reciter, verseId);
    if (sliced && sliced.byteLength >= 128) {
      await fs.writeFile(destPath, sliced);
      return;
    }
  }

  const url = getUpstreamAudioUrl(reciterSlug, verseId);
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for verse ${verseId}`);
      }
      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength < 128) {
        throw new Error(`Empty audio for verse ${verseId}`);
      }
      const buf = Buffer.from(arrayBuf);
      await fs.writeFile(destPath, buf);
      void writeCachedAudio(reciterSlug, verseId, buf);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, attempt === 0 ? 350 : 900));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Failed to fetch verse audio ${verseId}`);
}

export function spawnFfmpegTracked(
  args: string[],
  runtime: ActiveJobRuntime,
  onTimeSec?: (sec: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (runtime.cancelled) {
      reject(new Error('CANCELLED'));
      return;
    }
    const child = spawn(resolveFfmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    runtime.activeProc = child;

    let stderrTail = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderrTail = (stderrTail + chunk).slice(-4000);
      if (onTimeSec) {
        const sec = parseFfmpegTimeSeconds(chunk);
        if (sec !== null) onTimeSec(sec);
      }
    });

    child.on('error', (err) => {
      if (runtime.activeProc === child) runtime.activeProc = null;
      reject(err);
    });

    child.on('close', (code) => {
      if (runtime.activeProc === child) runtime.activeProc = null;
      if (runtime.cancelled) {
        reject(new Error('CANCELLED'));
        return;
      }
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderrTail.slice(-600)}`));
      }
    });
  });
}

/**
 * Builds standard FFmpeg scale/pad and chained xfade filter expressions
 * across consecutive slide video streams.
 */
export function buildChainedXfadeFilters(params: {
  slideCount: number;
  normalizedDurs: number[];
  transDur: number;
  xfadeName: string | null;
  width: number;
  height: number;
  effectiveFps: number;
  isRgba?: boolean;
  inputOffset?: number;
  finalLabel?: string;
}): { filters: string[]; outLabel: string } {
  const {
    slideCount,
    normalizedDurs,
    transDur,
    xfadeName,
    width,
    height,
    effectiveFps,
    isRgba = false,
    inputOffset = 0,
    finalLabel = 'ov',
  } = params;
  const vFilters: string[] = [];
  const fmt = isRgba ? 'format=rgba' : 'format=yuv420p';
  const padColor = isRgba ? ':color=black@0' : '';
  const trans = xfadeName || 'fade';

  for (let i = 0; i < slideCount; i++) {
    const inputIdx = i + inputOffset;
    vFilters.push(
      `[${inputIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2${padColor},setsar=1,fps=${effectiveFps},${fmt}[v${i}]`
    );
  }

  let offset = 0;
  let prevLabel = 'v0';
  for (let i = 1; i < slideCount; i++) {
    offset += normalizedDurs[i - 1];
    const outLabel = i === slideCount - 1 ? finalLabel : `vx${i}`;
    vFilters.push(
      `[${prevLabel}][v${i}]xfade=transition=${trans}:duration=${transDur.toFixed(2)}:offset=${Math.max(0.1, offset).toFixed(3)}[${outLabel}]`
    );
    prevLabel = outLabel;
  }
  return { filters: vFilters, outLabel: prevLabel };
}
