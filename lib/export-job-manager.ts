import type { ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getBuiltinBackground, isBuiltinBackgroundId } from './background-library';
import { RECITERS } from '@/lib/quran-data';
import { toArabicDigits } from '@/lib/quran-utils';
import {
  isValidEveryayahFolder,
  isValidMp3quranReadId,
  isValidMp3quranServer,
} from '@/lib/custom-reciter-spec';
import {
  DEFAULT_VIDEO_EXPORT_SETTINGS,
  MAX_EXPORT_SLIDES,
  MAX_EXPORT_VERSES,
  MAX_WORD_SLIDES,
  shouldRenderAnimatedAmbient,
  type AmbientSoundPreset,
  type AudioEffectPreset,
  type ExportJobStatus,
  type SlideTransitionType,
  type VideoExportFormat,
  type VideoFpsOption,
  type VideoQualityTier,
  type VideoResolutionTier,
} from '@/lib/video-export';
import { INTRO_COVER_DURATION_SEC } from '@/lib/surah-cover';

export const JOBS_ROOT = path.join(os.tmpdir(), 'quran-export-jobs');
const JOB_TTL_MS = 25 * 60 * 1000;
const UUID_RE = /^[a-f0-9-]{36}$/i;

export interface KaraokeWordTimelineEntry {
  /** Index of the verse inside meta.verseIds. */
  verseIdx: number;
  /** Word being recited on this slide (segment-first word for segment slides). */
  wordIdx: number;
  /** Inclusive highlight-range end (segment-granular slides — absent on word slides). */
  wordTo?: number;
  /** Relative spoken-duration weight inside the verse. */
  weight: number;
}

export interface ExportJobMeta {
  surahId: number;
  surahName?: string;
  fromAyah: number;
  toAyah: number;
  reciter: string;
  reciterName?: string;
  /** Custom-reciter wire spec (EveryAyah folder) — validated at session creation. */
  reciterFolder?: string;
  /** Custom-reciter wire spec (MP3Quran server base URL) — validated at session creation. */
  reciterServer?: string;
  /** Custom-reciter wire spec (MP3Quran timing read id for verse slicing). */
  reciterReadId?: number;
  verseIds: number[];
  /** Optional index-aligned verse texts (Uthmani) for synchronized SRT output. */
  verseTexts?: string[];
  /** Optional index-aligned verse translations for the English SRT track. */
  verseTranslations?: string[];
  /** Karaoke word/segment timeline — per-slide entries whose durations split the verse audio. */
  wordTimeline?: KaraokeWordTimelineEntry[];
  /**
   * Verse start times (seconds) inside the uploaded custom audio — computed
   * client-side (silence detection or manual). When present and aligned with
   * verseIds, slide durations lock to the real recitation instead of the
   * even/near-even split.
   */
  customVerseBounds?: number[];
  baseWidth: number;
  baseHeight: number;
  slideCount: number;
  hasCustomAudio: boolean;
  hasBgVideo: boolean;
  /** Built-in library background id (whitelist-checked) — server copies the asset. */
  bgLibraryId?: string;
  bgBlur: number;
  bgVideoSpeed: number;
  format: VideoExportFormat;
  resolution: VideoResolutionTier;
  fps: VideoFpsOption;
  quality: VideoQualityTier;
  transition: SlideTransitionType;
  transitionDurationMs: number;
  audioPreset: AudioEffectPreset;
  ambientSound: AmbientSoundPreset;
  ambientVolume: number;
  /** Visual ambient animation ('stars' | 'gold-dust' | 'aurora' | 'none') rendered live above the backdrop. */
  ambient: string;
  audioBitrate: 128 | 192 | 320;
  audioFade: boolean;
  verseGapSec: number;
  includeIntroCover?: boolean;
  introCoverDurationSec?: number;
}

export interface ActiveJobRuntime {
  cancelled: boolean;
  activeProc: ChildProcess | null;
}

const globalForJobs = globalThis as typeof globalThis & {
  __quranExportActiveJobs?: Map<string, ActiveJobRuntime>;
};

export const activeJobs: Map<string, ActiveJobRuntime> =
  globalForJobs.__quranExportActiveJobs ?? new Map<string, ActiveJobRuntime>();
globalForJobs.__quranExportActiveJobs = activeJobs;

export function isValidJobId(jobId: string): boolean {
  return UUID_RE.test(jobId);
}

/**
 * Resolves a built-in library background for an export job: copies the
 * whitelisted asset from public/assets/bg-library/ into the job dir as
 * bg_video.bin (so the render pipeline needs no changes) and persists the
 * resolved id in meta.json. Rejects anything outside the registry.
 */
export async function resolveBuiltinBackgroundForJob(
  meta: Pick<ExportJobMeta, 'bgLibraryId'>,
  jobDir: string
): Promise<boolean> {
  const id = meta.bgLibraryId;
  if (!id) return false;
  if (!isBuiltinBackgroundId(id)) {
    throw new Error('الخلفية المختارة غير متوفرة — اختر خلفية أخرى من المكتبة');
  }
  const bg = getBuiltinBackground(id);
  if (!bg) {
    throw new Error('الخلفية المختارة غير متوفرة — اختر خلفية أخرى من المكتبة');
  }
  const src = path.join(process.cwd(), 'public', 'assets', 'bg-library', bg.file);
  const dst = path.join(jobDir, 'bg_video.bin');
  try {
    await fs.copyFile(src, dst);
  } catch {
    throw new Error('الخلفية المختارة غير متوفرة — جرّب إعادة المحاولة أو خلفية أخرى');
  }
  const metaPath = path.join(jobDir, 'meta.json');
  try {
    const raw = JSON.parse(await fs.readFile(metaPath, 'utf8')) as ExportJobMeta;
    raw.bgLibraryId = id;
    await fs.writeFile(metaPath, JSON.stringify(raw), 'utf8');
  } catch {
    // meta persistence is best-effort; the copied file is what matters
  }
  return true;
}

export function getJobDir(jobId: string): string {
  if (!isValidJobId(jobId)) {
    throw new Error('معرّف مهمة التصدير غير صالح');
  }
  return path.join(JOBS_ROOT, jobId);
}

function getStatusPath(jobId: string): string {
  return path.join(getJobDir(jobId), 'status.json');
}

export function getMetaPath(jobId: string): string {
  return path.join(getJobDir(jobId), 'meta.json');
}

export async function writeJobStatus(status: ExportJobStatus): Promise<void> {
  const dir = getJobDir(status.jobId);
  const tmpPath = path.join(dir, `status.${crypto.randomBytes(4).toString('hex')}.tmp`);
  const target = getStatusPath(status.jobId);
  const next = { ...status, updatedAt: Date.now() };
  try {
    await fs.writeFile(tmpPath, JSON.stringify(next), 'utf8');
    await fs.rename(tmpPath, target);
  } catch {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

export async function readJobStatus(jobId: string): Promise<ExportJobStatus | null> {
  if (!isValidJobId(jobId)) return null;
  try {
    const raw = await fs.readFile(getStatusPath(jobId), 'utf8');
    return JSON.parse(raw) as ExportJobStatus;
  } catch {
    return null;
  }
}

export async function cleanupExpiredJobs(): Promise<void> {
  try {
    await fs.mkdir(JOBS_ROOT, { recursive: true });
    const entries = await fs.readdir(JOBS_ROOT, { withFileTypes: true });
    const now = Date.now();
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isDirectory() || !isValidJobId(entry.name)) return;
        if (activeJobs.has(entry.name)) return;
        const full = path.join(JOBS_ROOT, entry.name);
        try {
          const st = await fs.stat(full);
          if (now - st.mtimeMs > JOB_TTL_MS) {
            await fs.rm(full, { recursive: true, force: true });
          }
        } catch {
          // ignore
        }
      })
    );
  } catch {
    // ignore
  }
}

export async function createExportSession(
  rawMeta: Partial<ExportJobMeta>,
  customAudioBuffer?: Buffer | null
): Promise<ExportJobStatus> {
  await cleanupExpiredJobs();

  const includeIntroCover = rawMeta.includeIntroCover !== false;
  const verseIds = Array.isArray(rawMeta.verseIds)
    ? rawMeta.verseIds
        .slice(0, MAX_EXPORT_VERSES)
        .map((n) => Math.max(1, Math.min(6236, Math.floor(Number(n) || 1))))
    : [1];

  // Karaoke word/segment timeline — numeric-only sanitization: valid verse
  // indices, non-negative words, positive weights, hard count ceiling.
  const rawTimeline = Array.isArray((rawMeta as { wordTimeline?: unknown }).wordTimeline)
    ? ((rawMeta as { wordTimeline: unknown[] }).wordTimeline as unknown[])
    : null;
  const wordTimeline = rawTimeline
    ? rawTimeline
        .slice(0, MAX_WORD_SLIDES)
        .map((raw) => {
          if (typeof raw === 'string') {
            try {
              return JSON.parse(raw) as KaraokeWordTimelineEntry;
            } catch {
              return null;
            }
          }
          return raw as Record<string, unknown> | null;
        })
        .filter((e): e is Record<string, unknown> => Boolean(e && typeof e === 'object'))
        .map((e) => {
          const from = Math.max(0, Math.min(999, Math.floor(Number(e.wordIdx ?? 0) || 0)));
          const rawTo = Math.floor(Number(e.wordTo ?? from) || from);
          const entry: KaraokeWordTimelineEntry = {
            verseIdx: Math.max(
              0,
              Math.min(verseIds.length - 1, Math.floor(Number(e.verseIdx ?? 0) || 0))
            ),
            wordIdx: from,
            weight: Math.max(0.1, Math.min(500, Number(e.weight ?? 1) || 1)),
          };
          // نطاق تظليل العبارة (شرائح مستوى العبارة فقط): نهاية صالحة ≥ البداية
          if (Number.isFinite(rawTo) && rawTo >= from) {
            entry.wordTo = Math.min(999, rawTo);
          }
          return entry;
        })
    : undefined;

  const slideCeiling = wordTimeline && wordTimeline.length ? MAX_WORD_SLIDES : MAX_EXPORT_SLIDES;
  const slideCount = Math.max(
    1,
    Math.min(
      slideCeiling,
      Math.floor(
        Number(
          rawMeta.slideCount ||
            (wordTimeline && wordTimeline.length
              ? wordTimeline.length + (includeIntroCover ? 1 : 0)
              : includeIntroCover
                ? verseIds.length + 1
                : verseIds.length) ||
              1
        )
      )
    )
  );

  // Optional index-aligned verse texts for SRT: strings only, length-capped,
  // trimmed to the same slide count so subtitles stay in lockstep with slides.
  const verseTexts = Array.isArray(rawMeta.verseTexts)
    ? rawMeta.verseTexts
        .slice(0, slideCount)
        .map((t) => String(typeof t === 'string' ? t : '').slice(0, 500))
    : undefined;

  // English SRT track source — same alignment discipline as verseTexts.
  const verseTranslations = Array.isArray(rawMeta.verseTranslations)
    ? rawMeta.verseTranslations
        .slice(0, slideCount)
        .map((t) => String(typeof t === 'string' ? t : '').slice(0, 900))
    : undefined;

  // Custom-audio verse boundaries — strictly increasing start seconds, one per
  // verse, finite and capped. Only meaningful with an uploaded custom audio.
  const customVerseBounds = Array.isArray(rawMeta.customVerseBounds)
    ? rawMeta.customVerseBounds
        .slice(0, verseIds.length)
        .map((t) => Number(t))
        .filter((t) => Number.isFinite(t) && t >= 0 && t <= 7200)
        .reduce<number[]>((acc, t) => {
          if (acc.length < verseIds.length && (acc.length === 0 || t > acc[acc.length - 1])) {
            acc.push(Math.round(t * 1000) / 1000);
          }
          return acc;
        }, [])
    : undefined;
  const validCustomVerseBounds =
    customVerseBounds && customVerseBounds.length === verseIds.length
      ? customVerseBounds
      : undefined;

  const requestedReciterSlug = typeof rawMeta.reciter === 'string' ? rawMeta.reciter : '';
  const matchedReciter = RECITERS.find((r) => r.slug === requestedReciterSlug);
  // Custom-reciter wire spec: built-ins ignore it entirely (whitelist stays
  // authoritative); custom slugs only keep server-validated values.
  const isBuiltInReciter = Boolean(matchedReciter);
  const rawFolder = isBuiltInReciter ? undefined : rawMeta.reciterFolder;
  const rawServer = isBuiltInReciter ? undefined : rawMeta.reciterServer;
  const rawReadId = isBuiltInReciter ? undefined : rawMeta.reciterReadId;
  const validFolder =
    typeof rawFolder === 'string' && isValidEveryayahFolder(rawFolder)
      ? rawFolder
      : undefined;
  const validServer =
    typeof rawServer === 'string' && isValidMp3quranServer(rawServer)
      ? rawServer
      : undefined;
  const validReadId =
    typeof rawReadId === 'number' && isValidMp3quranReadId(rawReadId)
      ? rawReadId
      : undefined;
  // A custom slug is accepted only when it carries a server-validated spec
  // (folder or server URL) — otherwise the job falls back to the first
  // built-in reciter so audio download can never target an unresolved slug.
  const hasValidCustomSpec = Boolean(validFolder || validServer);
  const validCustomSlugForm = /^[a-z0-9][a-z0-9._-]{0,63}$/.test(requestedReciterSlug);
  const finalReciterSlug = matchedReciter
    ? matchedReciter.slug
    : hasValidCustomSpec && validCustomSlugForm
      ? requestedReciterSlug
      : RECITERS[0].slug;
  const meta: ExportJobMeta = {
    surahId: Math.max(1, Math.min(114, Math.floor(Number(rawMeta.surahId || 1)))),
    surahName:
      typeof rawMeta.surahName === 'string' && rawMeta.surahName.trim()
        ? rawMeta.surahName.trim().slice(0, 60)
        : undefined,
    fromAyah: Math.max(1, Math.floor(Number(rawMeta.fromAyah || 1))),
    toAyah: Math.max(1, Math.floor(Number(rawMeta.toAyah || 1))),
    reciter: finalReciterSlug,
    reciterName:
      typeof rawMeta.reciterName === 'string' && rawMeta.reciterName.trim()
        ? rawMeta.reciterName.trim().slice(0, 80)
        : matchedReciter?.name ?? RECITERS[0].name,
    reciterFolder: validFolder,
    reciterServer: validServer,
    reciterReadId: validReadId,
    verseIds,
    verseTexts,
    verseTranslations,
    wordTimeline: wordTimeline && wordTimeline.length ? wordTimeline : undefined,
    customVerseBounds: validCustomVerseBounds,
    baseWidth: Math.max(160, Math.floor(Number(rawMeta.baseWidth || 1080))),
    baseHeight: Math.max(160, Math.floor(Number(rawMeta.baseHeight || 1920))),
    slideCount,
    hasCustomAudio: Boolean(customAudioBuffer && customAudioBuffer.byteLength > 0),
    hasBgVideo: Boolean(rawMeta.hasBgVideo),
    bgLibraryId: (() => {
      const raw = rawMeta.bgLibraryId;
      if (raw === undefined || raw === null || raw === '') return undefined;
      // An explicitly-supplied id outside the whitelist is rejected outright —
      // silently dropping it would render the export over black instead of
      // failing with a clear message (see review I2).
      if (typeof raw !== 'string' || !isBuiltinBackgroundId(raw)) {
        throw new Error('الخلفية المختارة غير متوفرة — اختر خلفية أخرى من المكتبة');
      }
      return raw;
    })(),
    bgBlur: Math.max(0, Math.min(20, Number(rawMeta.bgBlur ?? 0))),
    bgVideoSpeed: Math.max(0.25, Math.min(2.5, Number(rawMeta.bgVideoSpeed ?? 1))),
    format: rawMeta.format === 'webm' ? 'webm' : 'mp4',
    resolution:
      rawMeta.resolution === '480p' || rawMeta.resolution === '720p' ? rawMeta.resolution : '1080p',
    fps: rawMeta.fps === 24 || rawMeta.fps === 60 ? rawMeta.fps : 30,
    quality:
      rawMeta.quality === 'high' || rawMeta.quality === 'compact' ? rawMeta.quality : 'balanced',
    transition:
      rawMeta.transition === 'fadeblack' ||
      rawMeta.transition === 'fadewhite' ||
      rawMeta.transition === 'zoomin' ||
      rawMeta.transition === 'zoom' ||
      rawMeta.transition === 'slideup' ||
      rawMeta.transition === 'dissolve' ||
      rawMeta.transition === 'none'
        ? rawMeta.transition
        : 'fade',
    transitionDurationMs: Math.max(
      150,
      Math.min(
        1200,
        Number(rawMeta.transitionDurationMs ?? DEFAULT_VIDEO_EXPORT_SETTINGS.transitionDurationMs)
      )
    ),
    audioPreset: rawMeta.audioPreset ?? DEFAULT_VIDEO_EXPORT_SETTINGS.audioPreset,
    ambientSound: rawMeta.ambientSound ?? 'none',
    ambientVolume: Math.max(0, Math.min(0.55, Number(rawMeta.ambientVolume ?? 0.16))),
    ambient: shouldRenderAnimatedAmbient(rawMeta.ambient)
      ? (rawMeta.ambient as string)
      : 'none',
    audioBitrate:
      rawMeta.audioBitrate === 128 || rawMeta.audioBitrate === 320 ? rawMeta.audioBitrate : 192,
    audioFade: rawMeta.audioFade !== false,
    verseGapSec: Math.max(0, Math.min(1.5, Number(rawMeta.verseGapSec ?? 0.35))),
    includeIntroCover,
    introCoverDurationSec: includeIntroCover ? INTRO_COVER_DURATION_SEC : 0,
  };

  const jobId = crypto.randomUUID();
  const dir = getJobDir(jobId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(getMetaPath(jobId), JSON.stringify(meta), 'utf8');

  if (customAudioBuffer && customAudioBuffer.byteLength > 0) {
    await fs.writeFile(path.join(dir, 'custom_audio_in'), customAudioBuffer);
  }

  const now = Date.now();
  const status: ExportJobStatus = {
    jobId,
    stage: 'uploading',
    progressPct: 2,
    stageLabel: 'جاري تهيئة جلسة التصدير...',
    slideCount: meta.slideCount,
    uploadedSlides: 0,
    downloadedAudio: 0,
    totalAudio: meta.hasCustomAudio ? 1 : meta.verseIds.length,
    createdAt: now,
    updatedAt: now,
  };
  await writeJobStatus(status);
  return status;
}

export async function saveUploadedSlideBatch(
  jobId: string,
  slides: { index: number; ext: 'png' | 'jpg'; buffer: Buffer }[],
  audios: { index: number; buffer: Buffer }[] = [],
  backdropBuffer?: Buffer,
  ambientFrames: { index: number; buffer: Buffer }[] = [],
  overlayBuffer?: Buffer
): Promise<{ uploadedSlides: number; uploadedAudios: number }> {
  const dir = getJobDir(jobId);
  const status = await readJobStatus(jobId);
  if (!status) {
    throw new Error('انتهت صلاحية جلسة التصدير — أعد المحاولة');
  }

  await Promise.all([
    ...(backdropBuffer && backdropBuffer.byteLength > 0
      ? [fs.writeFile(path.join(dir, 'backdrop.png'), backdropBuffer)]
      : []),
    // Ornament/grading overlay for bg-video exports (transparent PNG carrying
    // the Islamic frame, pattern, LUT, vignette, banners and watermark).
    ...(overlayBuffer && overlayBuffer.byteLength > 0
      ? [fs.writeFile(path.join(dir, 'overlay.png'), overlayBuffer)]
      : []),
    // Animated ambient layer frames (stars/gold-dust particle sequence or single aurora frame)
    ...ambientFrames
      .filter((f) => f.index >= 0 && f.index < 96 && f.buffer.byteLength > 0)
      .map((f) =>
        fs.writeFile(path.join(dir, `ambient_${String(f.index).padStart(3, '0')}.png`), f.buffer)
      ),
    ...slides.map(async (s) => {
      if (s.index < 0 || s.index >= MAX_EXPORT_SLIDES) return;
      const filename = `slide_${s.index}.${s.ext}`;
      await fs.writeFile(path.join(dir, filename), s.buffer);
    }),
    ...audios.map(async (a) => {
      if (a.index < 0 || a.index >= MAX_EXPORT_VERSES || a.buffer.byteLength < 128) return;
      await fs.writeFile(path.join(dir, `verse_${a.index}.mp3`), a.buffer);
    }),
  ]);

  const files = await fs.readdir(dir);
  const uploadedSlides = files.filter((f) => /^slide_\d+\.(png|jpg)$/.test(f)).length;
  const uploadedAudios = files.filter((f) => /^verse_\d+\.mp3$/.test(f)).length;
  status.uploadedSlides = uploadedSlides;
  status.downloadedAudio = Math.max(status.downloadedAudio, uploadedAudios);
  status.progressPct = Math.min(35, 3 + Math.round((uploadedSlides / Math.max(1, status.slideCount)) * 32));
  status.stageLabel =
    uploadedAudios > 0
      ? `تم رفع ${toArabicDigits(uploadedSlides)} شريحة و${toArabicDigits(uploadedAudios)} تلاوة من كاش المتصفح...`
      : `تم رفع ${toArabicDigits(uploadedSlides)} من ${toArabicDigits(status.slideCount)} شريحة...`;
  await writeJobStatus(status);

  return { uploadedSlides, uploadedAudios };
}

export async function appendBgVideoChunk(
  jobId: string,
  chunkIndex: number,
  chunkBuffer: Buffer
): Promise<{ ok: boolean }> {
  const dir = getJobDir(jobId);
  const status = await readJobStatus(jobId);
  if (!status) {
    throw new Error('انتهت صلاحية جلسة التصدير — أعد المحاولة');
  }
  const dest = path.join(dir, 'bg_video.bin');
  if (chunkIndex === 0) {
    await fs.writeFile(dest, chunkBuffer);
  } else {
    await fs.appendFile(dest, chunkBuffer);
  }
  return { ok: true };
}

export async function cancelExportJob(jobId: string): Promise<void> {
  if (!isValidJobId(jobId)) return;
  const runtime = activeJobs.get(jobId);
  if (runtime) {
    runtime.cancelled = true;
    try {
      runtime.activeProc?.kill('SIGKILL');
    } catch {
      // ignore
    }
    activeJobs.delete(jobId);
  }
  await fs.rm(getJobDir(jobId), { recursive: true, force: true }).catch(() => {});
}
