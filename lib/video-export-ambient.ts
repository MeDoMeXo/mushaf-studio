/**
 * Ambient motion layer for the export pipeline — which background motion
 * effects animate, how their frame sequences are specified, and how FFmpeg
 * composites them. Extracted from lib/video-export.ts per the 600-line rule.
 *
 * Protocol: particle-style effects upload a seamless 8-second PNG loop
 * (96 frames @ 12fps) that FFmpeg repeats with -stream_loop -1; expression
 * effects (aurora) upload a single wide frame swayed by an overlay x=sin(t)
 * expression. The client renders the frames with the exact same math as the
 * live preview so the export always matches what the user saw.
 */

/** Number of ambient frames the export protocol allows (96 @ 12fps = 8s loop). */
export const AMBIENT_MAX_FRAMES = 96;

/** Visual ambient animation effect rendered above the background during export. */
export type AmbientVisualEffect =
  | 'none'
  | 'stars'
  | 'gold-dust'
  | 'aurora'
  | 'fireflies'
  | 'petals'
  | 'bokeh'
  | 'rain'
  | 'snow';

const ANIMATED_AMBIENT_EFFECTS: ReadonlySet<string> = new Set([
  'stars',
  'gold-dust',
  'aurora',
  'fireflies',
  'petals',
  'bokeh',
  'rain',
  'snow',
]);

/** True when the export must render a live animated ambient layer instead of a frozen backdrop. */
export function shouldRenderAnimatedAmbient(effect: string | undefined | null): boolean {
  return typeof effect === 'string' && ANIMATED_AMBIENT_EFFECTS.has(effect);
}

export interface AmbientFrameSpecs {
  /** 'frames' = looping PNG particle sequence, 'single' = one swayed wide frame. */
  mode: 'frames' | 'single';
  frameCount: number;
  fps: number;
  /** Particle frame dimensions (even numbers, never exceeding half the export canvas). */
  frameWidth?: number;
  frameHeight?: number;
  /** Horizontal sway amplitude as a ratio of canvas width (aurora only). */
  swayAmplitudeRatio?: number;
  /** Rough client→server upload budget in bytes (progress display + sanity cap). */
  uploadBytesEstimate: number;
}

function toEven(n: number): number {
  return n % 2 === 0 ? n : n + 1;
}

/**
 * Resolves how each ambient visual effect is materialized for export:
 * - stars / gold-dust: a seamless 8-second particle PNG sequence (96 frames @ 12fps)
 *   uploaded by the client and looped by FFmpeg with -stream_loop -1.
 * - aurora: a single wide (1.16x) frame swayed horizontally via overlay x=sin(t).
 */
export function resolveAmbientFrameSpecs(
  effect: string,
  width: number,
  height: number,
  _fps: number
): AmbientFrameSpecs | null {
  if (!shouldRenderAnimatedAmbient(effect)) return null;
  const halfW = toEven(Math.max(160, Math.round(width / 2)));
  const halfH = toEven(Math.max(160, Math.round(height / 2)));
  if (effect === 'aurora') {
    return {
      mode: 'single',
      frameCount: 1,
      fps: 12,
      frameWidth: toEven(Math.round(halfW * 1.16)),
      frameHeight: halfH,
      swayAmplitudeRatio: 0.08,
      uploadBytesEstimate: 8 * 1024,
    };
  }
  // 96 frames @ 12fps = 8s loop; tiny particle PNGs (~4-8KB each) ≈ 0.5 MB total
  return {
    mode: 'frames',
    frameCount: 96,
    fps: 12,
    frameWidth: halfW,
    frameHeight: halfH,
    uploadBytesEstimate: 96 * 8 * 1024,
  };
}

/**
 * Builds the FFmpeg filter fragment that composites the animated ambient layer
 * above the backdrop/base label and yields `outputLabel`. The ambient input
 * stream itself (image2 sequence or single frame) is added by the render
 * pipeline via -stream_loop -1 so it loops seamlessly for the whole video.
 */
export function buildAmbientOverlayFilters(params: {
  effect: string;
  inputLabel: string;
  width: number;
  height: number;
  outputLabel: string;
  fps: number;
}): string | null {
  if (!shouldRenderAnimatedAmbient(params.effect)) return null;
  const safeW = Math.max(160, Math.round(params.width));
  const safeH = Math.max(160, Math.round(params.height));
  const safeFps = Math.max(12, Math.min(60, Math.round(params.fps || 24)));
  if (params.effect === 'aurora') {
    // Sway a single wide frame: x oscillates ±8% of canvas width at 0.6 rad/s,
    // mirroring the live preview's drawAmbientEffect('aurora') motion exactly.
    // yuva420p (not rgba): a 1080p RGBA frame costs 8.3 MB of filter-buffer RAM
    // while yuva420p costs half that — with three overlaid streams the rgba
    // graph peaked at ~1.3 GB and got OOM-killed on 4 GB hosts; yuva420p
    // completes at ~675 MB with identical visual output (OOM fix 2026-11-27).
    return [
      `scale=${safeW}:${safeH}:force_original_aspect_ratio=decrease,setsar=1,format=yuva420p[amb]`,
      `[${params.inputLabel}][amb]overlay=x='(W-w)/2+sin(t*0.6)*W*0.08':y=0,format=yuva420p[${params.outputLabel}]`,
    ].join(';');
  }
  // stars / gold-dust / fireflies / petals / bokeh / rain / snow: looping
  // particle frames scaled to the full canvas — yuva420p for the same OOM fix.
  return [
    `scale=${safeW}:${safeH}:force_original_aspect_ratio=decrease,setsar=1,fps=${safeFps},format=yuva420p[amb]`,
    `[${params.inputLabel}][amb]overlay=0:0,format=yuva420p[${params.outputLabel}]`,
  ].join(';');
}
