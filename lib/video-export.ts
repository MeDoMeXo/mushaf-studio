export * from './video-export-presets';
import {
  type VideoResolutionTier,
  type VideoQualityTier,
  type VideoFpsOption,
  type VideoExportFormat,
  type SlideTransitionType,
  type AudioEffectPreset,
  type AmbientSoundPreset,
} from './video-export-presets';

function toEven(n: number): number {
  const rounded = Math.max(2, Math.round(n));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

/**
 * Scales any aspect ratio (9:16, 1:1, 16:9, or custom) to the target short-side resolution tier,
 * guaranteeing even integer dimensions required by H.264 (yuv420p) encoders.
 */
export function resolveExportDimensions(
  baseWidth: number,
  baseHeight: number,
  tier: VideoResolutionTier
): { width: number; height: number } {
  const safeW = Math.max(160, baseWidth || 1080);
  const safeH = Math.max(160, baseHeight || 1920);
  const targetShortSide = tier === '480p' ? 480 : tier === '720p' ? 720 : 1080;
  const currentShortSide = Math.min(safeW, safeH);
  const scale = targetShortSide / currentShortSide;
  return {
    width: Math.min(1920, toEven(safeW * scale)),
    height: Math.min(1920, toEven(safeH * scale)),
  };
}

export function getCrfForQuality(
  format: VideoExportFormat,
  quality: VideoQualityTier
): number {
  if (format === 'mp4') {
    return quality === 'high' ? 20 : quality === 'compact' ? 28 : 24;
  }
  return quality === 'high' ? 24 : quality === 'compact' ? 36 : 30;
}

export interface VideoBitrateBounds {
  maxrate: string;
  bufsize: string;
}

/**
 * Returns resolution- and quality-tiered bitrate bounds (-maxrate and -bufsize)
 * to keep exported Quran videos compact without sacrificing crisp typography.
 */
export function resolveVideoBitrateBounds(
  resolution: VideoResolutionTier,
  quality: VideoQualityTier,
  hasBgVideo = false
): VideoBitrateBounds {
  if (hasBgVideo) {
    if (resolution === '1080p') {
      return quality === 'high'
        ? { maxrate: '3500k', bufsize: '7000k' }
        : quality === 'compact'
          ? { maxrate: '1800k', bufsize: '3600k' }
          : { maxrate: '2600k', bufsize: '5200k' };
    }
    if (resolution === '720p') {
      return quality === 'high'
        ? { maxrate: '2000k', bufsize: '4000k' }
        : quality === 'compact'
          ? { maxrate: '1100k', bufsize: '2200k' }
          : { maxrate: '1500k', bufsize: '3000k' };
    }
    return quality === 'high'
      ? { maxrate: '1100k', bufsize: '2200k' }
      : quality === 'compact'
        ? { maxrate: '600k', bufsize: '1200k' }
        : { maxrate: '850k', bufsize: '1700k' };
  }

  // Static slides without video backgrounds: bounded rates save 65-80% file size on long surahs
  if (resolution === '1080p') {
    return quality === 'high'
      ? { maxrate: '1500k', bufsize: '3000k' }
      : quality === 'compact'
        ? { maxrate: '650k', bufsize: '1300k' }
        : { maxrate: '1000k', bufsize: '2000k' };
  }
  if (resolution === '720p') {
    return quality === 'high'
      ? { maxrate: '900k', bufsize: '1800k' }
      : quality === 'compact'
        ? { maxrate: '450k', bufsize: '900k' }
        : { maxrate: '650k', bufsize: '1300k' };
  }
  return quality === 'high'
    ? { maxrate: '550k', bufsize: '1100k' }
    : quality === 'compact'
      ? { maxrate: '280k', bufsize: '560k' }
      : { maxrate: '400k', bufsize: '800k' };
}

/**
 * Returns an FFmpeg audio filter chain matching each Arabic Studio audio engineering preset.
 */
export function buildAudioEffectFilter(preset: AudioEffectPreset): string {
  switch (preset) {
    case 'haram':
      return 'highpass=f=70,aecho=0.8:0.86:55|110|185:0.36|0.24|0.14,equalizer=f=240:t=q:w=1.2:g=2,equalizer=f=3200:t=q:w=1.5:g=1.5';
    case 'mosque':
      return 'highpass=f=75,aecho=0.82:0.84:42|92:0.28|0.16,equalizer=f=300:t=q:w=1.2:g=2.5';
    case 'studio':
      return 'highpass=f=80,equalizer=f=220:t=q:w=1.1:g=2,equalizer=f=3600:t=q:w=1.4:g=3,acompressor=threshold=-18dB:ratio=3:attack=8:release=120:makeup=2';
    case 'warm':
      return 'lowpass=f=9500,equalizer=f=180:t=q:w=1.1:g=3,aecho=0.85:0.82:36:0.18';
    case 'deep':
      return 'equalizer=f=110:t=q:w=1.0:g=5.5,equalizer=f=240:t=q:w=1.2:g=2.5,acompressor=threshold=-16dB:ratio=2.5:attack=10:release=140';
    case 'clean':
      return 'highpass=f=95,lowpass=f=11500,afftdn=nf=-24,acompressor=threshold=-18dB:ratio=2.5:attack=8:release=100:makeup=1.5';
    case 'natural':
    default:
      return 'anull';
  }
}

/**
 * Generates a procedural non-musical natural ambient soundbed filter via FFmpeg anoisesrc.
 */
export function buildAmbientNoiseFilter(
  ambient: AmbientSoundPreset,
  durationSec: number,
  volume: number
): string | null {
  if (ambient === 'none') return null;
  const safeDur = Math.max(1, Number(durationSec.toFixed(2)));
  const safeVol = Math.max(0.02, Math.min(0.55, volume));
  switch (ambient) {
    case 'rain':
      return `anoisesrc=color=pink:sample_rate=44100:duration=${safeDur},bandpass=f=1450:width_type=h:w=1800,lowpass=f=4200,volume=${(safeVol * 0.42).toFixed(3)}`;
    case 'night':
      return `anoisesrc=color=brown:sample_rate=44100:duration=${safeDur},lowpass=f=520,tremolo=f=0.22:d=0.35,volume=${(safeVol * 0.48).toFixed(3)}`;
    case 'ocean':
      return `anoisesrc=color=brown:sample_rate=44100:duration=${safeDur},lowpass=f=950,tremolo=f=0.14:d=0.72,volume=${(safeVol * 0.55).toFixed(3)}`;
    case 'breeze':
      return `anoisesrc=color=pink:sample_rate=44100:duration=${safeDur},bandpass=f=460:width_type=h:w=420,tremolo=f=0.18:d=0.5,volume=${(safeVol * 0.46).toFixed(3)}`;
    default:
      return null;
  }
}

export function getXfadeTransitionName(transition: SlideTransitionType): string | null {
  switch (transition) {
    case 'fade':
      return 'fade';
    case 'fadeblack':
      return 'fadeblack';
    case 'fadewhite':
      return 'fadewhite';
    case 'zoomin':
    case 'zoom':
      return 'zoomin';
    case 'slideup':
      return 'slideup';
    case 'dissolve':
      return 'dissolve';
    case 'none':
    default:
      return null;
  }
}

/**
 * Computes normalized transition progress (0..1) and fade alpha for canvas
 * renderers during active recitation playback or manual slide navigation.
 */
export function calculateTransitionProgress(params: {
  elapsedMs: number;
  durationMs: number;
  isPlaying: boolean;
  isManualNav?: boolean;
}): { progress: number; fadeAlpha: number } {
  const transDuration = Math.max(200, Number(params.durationMs) || 750);
  if (!params.isPlaying && !params.isManualNav) {
    return { progress: 1, fadeAlpha: 1 };
  }
  const raw = Math.max(0, Math.min(1, params.elapsedMs / transDuration));
  return { progress: raw, fadeAlpha: raw };
}

export function estimateExportSizeMb(params: {
  durationSec: number;
  width: number;
  height: number;
  fps: VideoFpsOption;
  quality: VideoQualityTier;
  audioBitrateKbps: number;
}): number {
  const safeDur = Math.max(1, params.durationSec);
  const pixelFactor = (params.width * params.height) / (1080 * 1920);
  const fpsFactor = params.fps / 30;
  // Static/gentle-transition Quranic slides compress very efficiently with x264
  const baseVideoKbps =
    params.quality === 'high' ? 1400 : params.quality === 'compact' ? 500 : 900;
  const totalKbps = baseVideoKbps * Math.max(0.25, pixelFactor) * Math.sqrt(fpsFactor) + params.audioBitrateKbps;
  const mb = (totalKbps * safeDur) / 8 / 1024;
  return Math.max(0.2, Number(mb.toFixed(1)));
}

export const MAX_EXPORT_VERSES = 286;
export const MAX_EXPORT_SLIDES = MAX_EXPORT_VERSES + 1;
/**
 * Chained xfade on Windows creates large command lines (scaling + xfade filters per slide).
 * To guarantee strict immunity against Windows CreateProcessW 32,767-character buffer limits
 * (ENAMETOOLONG / uv_spawn errno -4064), we keep chained xfade to <= 30 slides (~10KB args)
 * and route larger exports (like 70 verses) to the ultra-fast concat demuxer engine.
 */
export const XFADE_MAX_SLIDES = 30;
/** Above XFADE_MAX_SLIDES the long-surah path (concat) still honors the chosen
 *  transition by rendering each slide with a short in-slide fade in/out. */
export const EXPORT_SLIDE_BATCH_SIZE = 20;
export const BG_VIDEO_CHUNK_BYTES = 8 * 1024 * 1024; // 8 MB chunks stay well under Cloud Run 32MB limit while halving request count
export const BLOB_DOWNLOAD_MAX_BYTES = 120 * 1024 * 1024; // Fetch verified in-memory Blob up to 120 MB for reliable iframe preview & download

// Upload hardening caps — reject oversized or malformed payloads at the trust boundary
// before they ever reach disk or FFmpeg (see security review, issue #1).
export const MAX_UPLOADED_SLIDE_BYTES = 12 * 1024 * 1024; // one rendered verse slide (PNG/JPEG) never legitimately exceeds 12 MB
export const MAX_UPLOADED_AUDIO_BYTES = 80 * 1024 * 1024; // a full-surah custom audio track stays under ~80 MB
export const MAX_EXPORT_FORM_BYTES = 512 * 1024 * 1024; // whole multipart body ceiling (286 slides x 12 MB worst case is far below in practice)

/**
 * Validates the leading magic bytes of an uploaded media payload so a renamed
 * executable, an HTML error page, or arbitrary junk can never be persisted and
 * later piped into FFmpeg.
 * - PNG: 8-byte signature 89 50 4E 47 0D 0A 1A 0A
 * - JPEG: FF D8 FF
 * - MP3: ID3v2 (49 44 33) or MPEG audio frame sync (FF Ex/Fx)
 * - WAV: "RIFF"...."WAVE"
 */
export function isValidUploadedMediaHeader(
  bytes: Uint8Array,
  kind: 'png' | 'jpg' | 'mp3' | 'wav' | 'audio' | 'video'
): boolean {
  if (!bytes || bytes.byteLength < 12) return false;
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isMp3 =
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || // "ID3"
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0); // MPEG frame sync
  const isWav =
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45; // "WAVE"
  switch (kind) {
    case 'png':
      return isPng;
    case 'jpg':
      return isJpg;
    case 'mp3':
      return isMp3;
    case 'wav':
      return isWav;
    case 'audio':
      return isMp3 || isWav;
    case 'video':
      return isWav ? false : true; // video validated separately by isValidVideoBinaryHeader
    default:
      return false;
  }
}

/**
 * Verifies the leading magic bytes of a downloaded video payload so an HTML/JSON proxy error
 * response can never be mistaken for a valid MP4 or WebM file.
 * - MP4 / ISO BMFF: ASCII "ftyp" at bytes 4..7 (box size >= 8)
 * - WebM / Matroska: EBML magic header 0x1A 0x45 0xDF 0xA3 at bytes 0..3
 */
export function isValidVideoBinaryHeader(
  bytes: Uint8Array,
  format: VideoExportFormat
): boolean {
  if (!bytes || bytes.byteLength < 12) return false;
  if (format === 'webm') {
    return (
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    );
  }
  // MP4 ISO Base Media File Format: 4-byte size + "ftyp" (0x66 0x74 0x79 0x70)
  return (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  );
}

export function getPollIntervalMs(slideCount: number): number {
  if (slideCount > 80) return 4000;
  if (slideCount > 24) return 3000;
  return 2000;
}

export function shouldUseFastConcatEngine(
  slideCount: number,
  transition: SlideTransitionType
): boolean {
  // Past XFADE_MAX_SLIDES a single chained-xfade filter_complex gets risky on
  // constrained server memory; the concat path then carries the transition via
  // per-slide in/out fades instead of dropping it silently.
  return slideCount > XFADE_MAX_SLIDES || transition === 'none';
}

/**
 * Per-slide fade in/out duration used by the long-surah concat engine so the
 * user's chosen "تلاشي ناعم" still reads visually when chained xfade is not used.
 */
export function getConcatSlideFadeSec(transitionDurationMs: number): number {
  return Math.max(0.25, Math.min(0.8, transitionDurationMs / 1000 / 2));
}

/**
 * Optimizes frame rate for still-slide long surahs while keeping >= 15 FPS so strict
 * hardware/mobile/Windows/WhatsApp H.264 decoders never stall or reject the stream.
 */
export function getEffectiveExportFps(
  requestedFps: VideoFpsOption,
  slideCount: number,
  transition: SlideTransitionType,
  hasBgVideo = false
): number {
  if (hasBgVideo) {
    return Math.min(requestedFps, 30);
  }
  if (!shouldUseFastConcatEngine(slideCount, transition)) {
    return requestedFps;
  }
  if (slideCount > 60) return 15;
  return Math.min(requestedFps, 24);
}

/**
 * Builds the FFmpeg filter_complex graph that scales/crops/blurs/speed-adjusts a looping
 * animated background video [0:v] and composites synchronized transparent verse slides [1:v] on top.
 */
export function buildVideoBackgroundFilterGraph(params: {
  width: number;
  height: number;
  bgBlur: number;
  bgVideoSpeed: number;
  fps: number;
}): string {
  const safeW = Math.max(160, Math.round(params.width));
  const safeH = Math.max(160, Math.round(params.height));
  const safeSpeed = Math.max(0.25, Math.min(2.5, Number(params.bgVideoSpeed) || 1));
  const safeFps = Math.max(12, Math.min(60, Math.round(params.fps || 24)));
  const scaledBlur =
    params.bgBlur > 0 ? Math.max(1, Math.round(params.bgBlur * (Math.min(safeW, safeH) / 1080))) : 0;

  const bgSteps: string[] = [
    `scale=${safeW}:${safeH}:force_original_aspect_ratio=increase`,
    `crop=${safeW}:${safeH}`,
    'setsar=1',
  ];
  if (Math.abs(safeSpeed - 1) > 0.01) {
    bgSteps.push(`setpts=PTS/${safeSpeed.toFixed(2)}`);
  }
  if (scaledBlur > 0) {
    bgSteps.push(`gblur=sigma=${scaledBlur}`);
  }
  bgSteps.push(`fps=${safeFps}`, 'format=rgba');

  return `[0:v]${bgSteps.join(',')}[bg];[1:v]scale=${safeW}:${safeH}:force_original_aspect_ratio=decrease,pad=${safeW}:${safeH}:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1,format=rgba[ov];[bg][ov]overlay=0:0:shortest=1:eof_action=repeat,format=yuv420p[vout]`;
}

/**
 * Selects optimal slide image encoding so each batch stays well below Cloud Run's 32MB request cap.
 */
export function getSlideImageEncoding(slideCount: number): {
  mime: 'image/png' | 'image/jpeg';
  ext: 'png' | 'jpg';
  quality?: number;
} {
  if (slideCount <= 30) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (slideCount <= 80) {
    return { mime: 'image/jpeg', ext: 'jpg', quality: 0.9 };
  }
  return { mime: 'image/jpeg', ext: 'jpg', quality: 0.84 };
}

export function chunkIndices(
  total: number,
  batchSize = EXPORT_SLIDE_BATCH_SIZE
): { start: number; end: number }[] {
  const safeTotal = Math.max(0, Math.floor(total));
  const safeBatch = Math.max(1, Math.floor(batchSize));
  const batches: { start: number; end: number }[] = [];
  for (let start = 0; start < safeTotal; start += safeBatch) {
    batches.push({ start, end: Math.min(safeTotal, start + safeBatch) });
  }
  return batches;
}

/**
 * Parses FFmpeg stderr progress string `time=HH:MM:SS.xx` into elapsed seconds.
 */
export function parseFfmpegTimeSeconds(chunk: string): number | null {
  const matches = [...chunk.matchAll(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g)];
  if (!matches.length) return null;
  const last = matches[matches.length - 1];
  const hours = Number(last[1]);
  const mins = Number(last[2]);
  const secs = Number(last[3]);
  if (!Number.isFinite(hours) || !Number.isFinite(mins) || !Number.isFinite(secs)) {
    return null;
  }
  return hours * 3600 + mins * 60 + secs;
}

export type ExportJobStage =
  | 'uploading'
  | 'queued'
  | 'downloading_audio'
  | 'mixing_audio'
  | 'encoding_video'
  | 'done'
  | 'error'
  | 'cancelled';

// Ambient motion layer (effect registry, frame specs, overlay filters) moved to
// lib/video-export-ambient.ts per the 600-line file rule; re-exported for compat.
export {
  AMBIENT_MAX_FRAMES,
  type AmbientVisualEffect,
  buildAmbientOverlayFilters,
  type AmbientFrameSpecs,
  resolveAmbientFrameSpecs,
  shouldRenderAnimatedAmbient,
} from './video-export-ambient';

export interface ExportJobStatus {
  jobId: string;
  stage: ExportJobStage;
  progressPct: number;
  stageLabel: string;
  slideCount: number;
  uploadedSlides: number;
  downloadedAudio: number;
  totalAudio: number;
  error?: string;
  result?: {
    filename: string;
    displayFilename?: string;
    format: VideoExportFormat;
    sizeBytes: number;
    durationSec: number;
    renderMs: number;
    dimensions: string;
    slideCount: number;
    effectiveFps: number;
  };
  createdAt: number;
  updatedAt: number;
}

export function buildFfmpegConcatSlidesManifest(
  entries: { filename: string; durationSec: number }[]
): string {
  if (!entries.length) return '';
  const lines: string[] = [];
  for (const item of entries) {
    const safeName = item.filename.replace(/'/g, "'\\''");
    const safeDur = Math.max(0.25, Number(item.durationSec) || 1).toFixed(3);
    lines.push(`file '${safeName}'`);
    lines.push(`duration ${safeDur}`);
  }
  // FFmpeg concat demuxer requires repeating the final file without a duration line
  const lastSafe = entries[entries.length - 1].filename.replace(/'/g, "'\\''");
  lines.push(`file '${lastSafe}'`);
  return lines.join('\n') + '\n';
}

export function buildFfmpegConcatAudioManifest(
  filenames: string[],
  gapFilename?: string | null
): string {
  if (!filenames.length) return '';
  const lines: string[] = [];
  for (let i = 0; i < filenames.length; i++) {
    const safeName = filenames[i].replace(/'/g, "'\\''");
    lines.push(`file '${safeName}'`);
    if (gapFilename && i < filenames.length - 1) {
      const safeGap = gapFilename.replace(/'/g, "'\\''");
      lines.push(`file '${safeGap}'`);
    }
  }
  return lines.join('\n') + '\n';
}

export function buildSafeExportFilename(
  surahId: number,
  fromAyah: number,
  toAyah: number,
  format: VideoExportFormat
): string {
  const s = Math.max(1, Math.min(114, Math.floor(surahId || 1)));
  const f = Math.max(1, Math.floor(fromAyah || 1));
  const t = Math.max(f, Math.floor(toAyah || f));
  const ext = format === 'webm' ? 'webm' : 'mp4';
  return `quran_surah_${s}_${f}-${t}.${ext}`;
}
