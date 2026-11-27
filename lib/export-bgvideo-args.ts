/**
 * Background-video FFmpeg argument builders for the export render pipeline.
 * Extracted from lib/export-render-pipeline.ts per the 600-line file rule.
 *
 * Layer order (preview/export parity): [bg video → bg] → (optional animated
 * ambient → bgamb) → (optional ornament overlay still → bgfr: Islamic frame,
 * pattern, LUT, vignette, banners, watermark) → verse slides → format tail.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  buildFfmpegConcatSlidesManifest,
  buildVideoBackgroundFilterGraph,
  XFADE_MAX_SLIDES,
} from '@/lib/video-export';
import type { AmbientLayerResolution } from './export-ambient-layer';
import type { ExportJobMeta } from './export-job-manager';
import { buildChainedXfadeFilters } from './export-job-helpers';

export interface BgVideoRenderArgsParams {
  meta: ExportJobMeta;
  dir: string;
  width: number;
  height: number;
  effectiveFps: number;
  xfadeName: string | null;
  slidePaths: string[];
  slideFilenames: string[];
  normalizedDurs: number[];
  ambientLayer: AmbientLayerResolution;
  hasAmbientFrames: boolean;
  hasOverlayFile: boolean;
  overlayPath: string;
  bgVideoPath: string;
  processedAudioPath: string;
}

function buildOrnamentOverlayFilters(
  overlayInputIdx: number,
  baseLabel: string,
  width: number,
  height: number
): string[] {
  // yuva420p (not rgba): halves per-frame filter RAM — part of the 2026-11-27
  // OOM fix (rgba 3-stream overlay graphs peaked ~1.3 GB at 1080p).
  return [
    `[${overlayInputIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1,format=yuva420p[ovframe]`,
    `[${baseLabel}][ovframe]overlay=0:0[bgfr]`,
  ];
}

/**
 * Builds the complete videoArgs fragment for an animated background video
 * (built-in library or uploaded), covering both the chained-xfade path
 * (≤ XFADE_MAX_SLIDES with a transition) and the concat path.
 */
export async function buildBgVideoRenderArgs(
  p: BgVideoRenderArgsParams
): Promise<string[]> {
  const {
    meta,
    dir,
    width,
    height,
    effectiveFps,
    xfadeName,
    slidePaths,
    slideFilenames,
    normalizedDurs,
    ambientLayer,
    hasAmbientFrames,
    hasOverlayFile,
    overlayPath,
    bgVideoPath,
    processedAudioPath,
  } = p;

  const videoArgs: string[] = [];
  const ambientInputOffset = hasAmbientFrames ? 1 : 0;
  const overlayInputOffset = hasOverlayFile ? 1 : 0;
  const ambientBase = hasAmbientFrames ? 'bgamb' : 'bg';
  const frameBase = hasOverlayFile ? 'bgfr' : ambientBase;

  const bgFilter = buildVideoBackgroundFilterGraph({
    width,
    height,
    bgBlur: meta.bgBlur,
    bgVideoSpeed: meta.bgVideoSpeed,
    fps: effectiveFps,
  });

  const useXfade =
    Boolean(xfadeName) && slidePaths.length > 1 && slidePaths.length <= XFADE_MAX_SLIDES;

  if (useXfade) {
    // Loop background video [0:v] + (optional animated ambient) + (optional
    // ornament overlay) + smoothly xfade transparent verse slides + mux audio
    const shortestSlide = Math.min(...normalizedDurs);
    const requestedTransSec = meta.transitionDurationMs / 1000;
    const transDur = Math.min(requestedTransSec, Math.max(0.25, shortestSlide * 0.45));

    videoArgs.push('-stream_loop', '-1', '-i', bgVideoPath);
    if (hasAmbientFrames) {
      videoArgs.push(...ambientLayer.inputArgs);
    }
    if (hasOverlayFile) {
      // Looping still-image ornament overlay sits between the ambient layer
      // and the verse slides (preview layer parity: frame above everything).
      videoArgs.push(
        '-loop', '1',
        '-framerate', String(effectiveFps),
        '-i', overlayPath
      );
    }
    const baseInputOffset = 1 + ambientInputOffset + overlayInputOffset;

    for (let i = 0; i < slidePaths.length; i++) {
      const clipDur =
        i < slidePaths.length - 1
          ? normalizedDurs[i] + transDur
          : normalizedDurs[i] + 1.0;
      videoArgs.push(
        '-loop',
        '1',
        '-framerate',
        String(effectiveFps),
        '-t',
        clipDur.toFixed(3),
        '-i',
        slidePaths[i]
      );
    }
    videoArgs.push('-i', processedAudioPath);
    const audioInputIdx = slidePaths.length + baseInputOffset;

    // First fragment maps [0:v] (the bg video) into [bg]; ambient composites
    // above it (label bgamb) exactly like the preview layer order.
    const vFilters: string[] = [bgFilter.split(';')[0]];
    if (hasAmbientFrames && ambientLayer.ambientFilters) {
      vFilters.push(...ambientLayer.ambientFilters);
    }
    if (hasOverlayFile) {
      vFilters.push(...buildOrnamentOverlayFilters(1 + ambientInputOffset, ambientBase, width, height));
    }
    const { filters: slideFilters, outLabel } = buildChainedXfadeFilters({
      slideCount: slidePaths.length,
      normalizedDurs,
      transDur,
      xfadeName: xfadeName ?? 'fade',
      width,
      height,
      effectiveFps,
      isRgba: true,
      inputOffset: baseInputOffset,
      finalLabel: 'ov',
    });
    vFilters.push(...slideFilters);
    vFilters.push(`[${frameBase}][${outLabel}]overlay=0:0:shortest=1:eof_action=repeat,format=yuv420p[vout]`);
    videoArgs.push('-filter_complex', vFilters.join(';'));
    videoArgs.push('-map', '[vout]', '-map', `${audioInputIdx}:a`);
    return videoArgs;
  }

  // Concat path: [0]=bg video → [1]=ambient? → [2]=ornament overlay? →
  // [3]=concat slides → [4]=audio. The ornament overlay restores the
  // frame/pattern/LUT/vignette/banners/watermark that this path used to drop
  // entirely (preview/export parity fix).
  const slidesListPath = path.join(dir, 'slides_list.txt');
  const slidesManifest = buildFfmpegConcatSlidesManifest(
    slideFilenames.map((filename, i) => ({
      filename,
      durationSec:
        i === slideFilenames.length - 1 ? normalizedDurs[i] + 1.0 : normalizedDurs[i],
    }))
  );
  await fs.writeFile(slidesListPath, slidesManifest, 'utf8');

  videoArgs.push(
    '-stream_loop',
    '-1',
    '-i',
    bgVideoPath,
    ...(hasAmbientFrames ? ambientLayer.inputArgs : []),
    ...(hasOverlayFile
      ? ['-loop', '1', '-framerate', String(effectiveFps), '-i', overlayPath]
      : []),
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    slidesListPath,
    '-i',
    processedAudioPath
  );
  const audioInputIdx = 2 + ambientInputOffset + overlayInputOffset;

  const scaled = bgFilter.split(';');
  // scaled[0] maps [0:v] (bg video) → [bg]; scaled[1] maps the slides input
  // → [ov]. Slides input index shifts by ambient + overlay inputs.
  const bgPrep = scaled[0];
  const slideInputIdx = 1 + ambientInputOffset + overlayInputOffset;
  const slidePrep = scaled[1].replace(/^\[1:v\]/, `[${slideInputIdx}:v]`);

  const filters = [
    bgPrep,
    ...(hasAmbientFrames && ambientLayer.ambientFilters ? ambientLayer.ambientFilters : []),
    ...(hasOverlayFile
      ? buildOrnamentOverlayFilters(1 + ambientInputOffset, ambientBase, width, height)
      : []),
    slidePrep,
    `[${frameBase}][ov]overlay=0:0:shortest=1:eof_action=repeat,format=yuv420p[vout]`,
  ];
  videoArgs.push(
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[vout]',
    '-map',
    `${audioInputIdx}:a:0`
  );
  return videoArgs;
}
