/**
 * Karaoke word-layout engine for the studio text renderer.
 * Split from lib/studio-text-renderer.ts per the 600-line file rule:
 * frame-aware safe column, word-timing wrap, vertical auto-fit budget and
 * the rounded-rect highlight painter shared by the main text layer.
 */
import type { StudioState } from './quran-data-types';
import { resolveOrnamentConfig } from './ornaments/ornaments-geometry';
import type { AyahWordTiming } from './verse-words';

/** Rounded-rect helper with manual fallback for older canvas implementations. */
export function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  ctx.fill();
}

/**
 * Computes the frame-aware safe text column (horizontal): the Islamic frame
 * band and the corner rosettes reserve real pixels on the sides, so the verse
 * column must stay inside [safeLeft, safeRight] to never collide with them.
 * Also used by the karaoke export timeline (segment width must match the
 * renderer exactly).
 */
export function computeSafeTextColumn(
  state: StudioState
): { safeLeft: number; safeRight: number; maxW: number } {
  const w = state.width;
  const minSide = Math.min(state.width, state.height);
  const ornaments = resolveOrnamentConfig(state);
  const frameInset =
    ornaments.frameStyle !== 'none'
      ? Math.max(24, Math.round(minSide * 0.04)) + Math.round(minSide * 0.032)
      : Math.round(minSide * 0.045);
  const cornerExtent =
    ornaments.cornerStyle !== 'none'
      ? Math.round(minSide * 0.078) + Math.round(minSide * 0.048)
      : 0;
  const sideInset = Math.max(frameInset, cornerExtent);
  const maxW = Math.min(w * 0.8, Math.max(w * 0.52, w - sideInset * 2));
  return { safeLeft: (w - maxW) / 2, safeRight: (w + maxW) / 2, maxW };
}

/**
 * Wraps recitation tokens (not raw text) into lines of word timings so the
 * karaoke renderer can address every word individually.
 */
export function wrapTimingsToLines(
  timings: AyahWordTiming[],
  maxWidth: number,
  measure: (text: string) => number
): AyahWordTiming[][] {
  if (!timings.length) return [];
  const spaceW = measure(' ');
  const lines: AyahWordTiming[][] = [];
  let current: AyahWordTiming[] = [];
  let currentW = 0;
  for (const tok of timings) {
    const wordW = measure(tok.text);
    const addW = current.length ? spaceW + wordW : wordW;
    if (current.length && currentW + addW > maxWidth) {
      lines.push(current);
      current = [tok];
      currentW = wordW;
    } else {
      current.push(tok);
      currentW += addW;
    }
  }
  if (current.length) lines.push(current);
  return lines;
}

/** Total block height estimate (Arabic lines + medallion + gap + translation). */
export function estimateBlockHeight(
  arLineCount: number,
  arLineH: number,
  standaloneMedallionH: number,
  trLineCount: number,
  trLineH: number,
  gapBetween: number
): number {
  return arLineCount * arLineH + standaloneMedallionH + trLineCount * trLineH + gapBetween;
}

/**
 * Vertical auto-fit budget: the wrapped block must stay clear of the top
 * banner, the bottom reciter label, the progress dots and the frame itself.
 */
export function computeVerticalBudget(state: StudioState): {
  reservedTop: number;
  reservedBottom: number;
  availH: number;
} {
  const h = state.height;
  const minSide = Math.min(state.width, state.height);
  const ornaments = resolveOrnamentConfig(state);
  const frameInsetY =
    ornaments.frameStyle !== 'none'
      ? Math.max(24, Math.round(minSide * 0.04)) + 30
      : Math.round(minSide * 0.045);
  const hasTopLabel =
    state.showFooter &&
    (state.surahPosition || 'top') !== 'hidden' &&
    (state.surahPosition || 'top').startsWith('top');
  const hasBottomLabel =
    state.showReciterFooter &&
    (state.reciterPosition || 'bottom') !== 'hidden' &&
    ((state.reciterPosition || 'bottom') === 'bottom' ||
      (state.reciterPosition || 'bottom').startsWith('bottom'));
  const hasBottomDots = state.showProgressDots === true;
  const reservedTop =
    frameInsetY + (hasTopLabel ? Math.round(minSide * 0.12) : Math.round(minSide * 0.04));
  const reservedBottom =
    frameInsetY +
    (hasBottomLabel ? Math.round(minSide * 0.08) : Math.round(minSide * 0.04)) +
    (hasBottomDots ? Math.round(minSide * 0.06) : 0);
  const availH = Math.max(h * 0.42, h - reservedTop - reservedBottom);
  return { reservedTop, reservedBottom, availH };
}
