/**
 * Animated ambient layer resolution for the server-side export pipeline.
 * Extracted from lib/export-render-pipeline.ts per the 600-line file rule.
 *
 * The client uploads either a looping particle PNG sequence (stars / gold-dust:
 * ambient_000.png .. ambient_095.png @ 12fps = seamless 8s loop) or a single
 * wide frame (aurora, swayed by FFmpeg overlay x=sin(t*0.6)). This module
 * resolves what exists on disk and provides the FFmpeg input args + filter
 * fragment that composite the layer between the backdrop and the verse slides.
 */
import path from 'node:path';
import {
  buildAmbientOverlayFilters,
  shouldRenderAnimatedAmbient,
} from '@/lib/video-export';

/** Number of ambient frames the export protocol allows (96 @ 12fps = 8s loop). */
export const AMBIENT_MAX_FRAMES = 96;

export interface AmbientLayerResolution {
  /** True when animated ambient frames exist on disk and compositing is enabled. */
  active: boolean;
  /** FFmpeg input arguments for the looping ambient stream (empty when inactive). */
  inputArgs: string[];
  /**
   * Filter fragment that composites the ambient layer above the backdrop and
   * labels the result `bgamb` (null when inactive). The first filter maps the
   * ambient input stream; subsequent ones are pure labeled chains.
   */
  ambientFilters: string[] | null;
}

interface AmbientLayerParams {
  ambientEffect: string;
  hasBgVideoFile: boolean;
  jobDir: string;
  filesInDir: string[];
  width: number;
  height: number;
  effectiveFps: number;
}

/**
 * Detects uploaded ambient frames on disk and, when present, returns the FFmpeg
 * input args (`-stream_loop -1 -framerate 12 -i ambient_%03d.png`) plus the
 * overlay filter chain that turns the backdrop label into an animated `bgamb`.
 */
export function resolveAmbientLayer(params: AmbientLayerParams): AmbientLayerResolution {
  const { ambientEffect, hasBgVideoFile, jobDir, filesInDir } = params;
  const enabled = shouldRenderAnimatedAmbient(ambientEffect) && !hasBgVideoFile;
  if (!enabled) {
    return { active: false, inputArgs: [], ambientFilters: null };
  }

  let frameCount = 0;
  for (let i = 0; i < AMBIENT_MAX_FRAMES; i++) {
    const name = `ambient_${String(i).padStart(3, '0')}.png`;
    if (!filesInDir.includes(name)) break;
    frameCount++;
  }
  if (frameCount < 1) {
    return { active: false, inputArgs: [], ambientFilters: null };
  }

  const inputArgs = [
    '-stream_loop', '-1',
    '-framerate', '12',
    '-start_number', '0',
    '-i', path.join(jobDir, 'ambient_%03d.png'),
  ];

  const chain = buildAmbientOverlayFilters({
    effect: ambientEffect,
    inputLabel: '0:v',
    width: params.width,
    height: params.height,
    outputLabel: 'bgamb',
    fps: params.effectiveFps,
  });
  if (!chain) {
    return { active: false, inputArgs: [], ambientFilters: null };
  }

  // The first fragment has no input label prefix — it maps the ambient input
  // stream itself (appended after the backdrop input, i.e. stream index 1).
  const ambientFilters = chain.split(';').map((part) =>
    part.startsWith('[') ? part : `[1:v]${part}`
  );

  return { active: true, inputArgs, ambientFilters };
}
