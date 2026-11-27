/**
 * Final-pass encoder arguments for the export render pipeline.
 * Extracted from lib/export-render-pipeline.ts per the 600-line file rule:
 * builds filenames, container metadata, and the mp4/webm encoding tail
 * (codec, CRF, bitrate bounds, GOP, faststart) appended to videoArgs.
 */
import {
  buildSafeExportFilename,
  resolveVideoBitrateBounds,
  type VideoQualityTier,
  type VideoResolutionTier,
  type VideoExportFormat,
} from '@/lib/video-export';
import { buildArabicExportFilename, buildVideoShareMetadata } from '@/lib/video-share';

export interface EncodeTailParams {
  meta: {
    surahId: number;
    surahName?: string;
    fromAyah: number;
    toAyah: number;
    reciterName?: string;
    format: VideoExportFormat;
    resolution: VideoResolutionTier;
    quality: VideoQualityTier;
  };
  crf: number;
  effectiveFps: number;
  hasBgVideoFile: boolean;
  hasAnimatedVisualLayer: boolean;
  slideCount: number;
  totalAudioDur: number;
  outputPath: string;
}

/**
 * Appends the final encoding arguments (metadata + codec tail) to videoArgs.
 * `hasAnimatedVisualLayer` disables x264's stillimage tune when an animated
 * ambient layer (or bg video) is composited, since stillimage hurts motion.
 */
export function appendEncodeTail(videoArgs: string[], params: EncodeTailParams): {
  filename: string;
  displayFilename: string;
} {
  const { meta, crf, effectiveFps, slideCount, totalAudioDur, outputPath } = params;

  const filename = buildSafeExportFilename(
    meta.surahId,
    meta.fromAyah,
    meta.toAyah,
    meta.format
  );
  const displayFilename = buildArabicExportFilename({
    surahName: meta.surahName ?? '',
    fromAyah: meta.fromAyah,
    toAyah: meta.toAyah,
    reciterName: meta.reciterName ?? '',
    format: meta.format,
  });
  const containerMeta = buildVideoShareMetadata({
    surahName: meta.surahName || `رقم ${meta.surahId}`,
    fromAyah: meta.fromAyah,
    toAyah: meta.toAyah,
    reciterName: meta.reciterName || '',
    filename: displayFilename,
  });

  const metadataArgs = [
    '-metadata',
    `title=${containerMeta.title}`,
    '-metadata',
    `artist=${meta.reciterName || 'مصحف الاستوديو'}`,
    '-metadata',
    'album=مصحف الاستوديو',
    '-metadata',
    `comment=${containerMeta.text.replace(/\n/g, ' ')}`,
  ];

  const gopSize = Math.max(15, effectiveFps * 2);
  const bitrateBounds = resolveVideoBitrateBounds(meta.resolution, meta.quality, params.hasBgVideoFile);
  // stillimage tune is only for fully static slides; animated layers need normal tuning
  const useStillImageTune = !params.hasBgVideoFile && !params.hasAnimatedVisualLayer;
  // Thread cap (OOM fix 2026-11-27): ffmpeg's default thread pool (frame
  // threads × filter threads) more than doubles encoder RSS — measured 1.0–1.6 GB
  // at 1080p getting OOM-killed on 4 GB hosts vs ~650 MB with an explicit cap.
  // 2 threads keeps full speed on typical 2-core containers and small VPSes.
  const threadCap = ['-threads', '2'];

  if (meta.format === 'mp4') {
    const mp4EncArgs = [
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-profile:v', 'main',
      '-level:v', '4.0',
      '-crf', String(crf),
      '-maxrate', bitrateBounds.maxrate,
      '-bufsize', bitrateBounds.bufsize,
      ...threadCap,
    ];
    if (useStillImageTune) {
      mp4EncArgs.push('-tune', 'stillimage');
    }
    videoArgs.push(
      ...mp4EncArgs,
      '-pix_fmt', 'yuv420p',
      '-tag:v', 'avc1',
      '-colorspace', 'bt709',
      '-color_primaries', 'bt709',
      '-color_trc', 'bt709',
      '-fps_mode', 'cfr',
      '-r', String(effectiveFps),
      '-g', String(gopSize),
      '-c:a', 'copy',
      ...metadataArgs,
      '-brand', 'mp42',
      '-movflags', '+faststart',
      '-t', totalAudioDur.toFixed(3),
      outputPath
    );
  } else {
    videoArgs.push(
      '-c:v', 'libvpx',
      '-deadline', 'realtime',
      '-cpu-used',
      params.hasBgVideoFile || slideCount > 60 ? '8' : slideCount > 24 ? '6' : '4',
      '-crf', String(crf),
      '-b:v', bitrateBounds.maxrate,
      ...threadCap,
      '-pix_fmt', 'yuv420p',
      '-fps_mode', 'cfr',
      '-r', String(effectiveFps),
      '-g', String(gopSize),
      '-c:a', 'copy',
      ...metadataArgs,
      '-t', totalAudioDur.toFixed(3),
      outputPath
    );
  }

  return { filename, displayFilename };
}
