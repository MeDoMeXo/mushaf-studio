/**
 * Karaoke word-layout engine for the studio text renderer.
 * Split from lib/studio-text-renderer.ts per the 600-line file rule:
 * frame-aware safe column, word-timing wrap, vertical auto-fit budget and
 * the rounded-rect highlight painter shared by the main text layer.
 */
import type { StudioState } from './quran-data-types';
import { hexToRgba, resolveOrnamentConfig } from './ornaments/ornaments-geometry';
import {
  getTranslationDirection,
  resolveTranslationOption,
} from './quran-utils';
import { isLightColor } from './studio-renderer-shared';
import type { AyahSegment, AyahWordTiming } from './verse-words';

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

/**
 * Slices the verse translation chunk that corresponds to one pronunciation
 * segment (single-line mode): translation words map proportionally onto the
 * ayah timeline [0..1] and the segment's [startRatio, endRatio] window picks
 * the words being "covered" by that recitation phrase — the same line
 * treatment the Arabic gets, keeping the translation contained per segment
 * instead of repeating the whole block on every slide.
 */
export function splitTranslationForSegment(
  translationText: string,
  segment: AyahSegment
): string {
  const words = (translationText || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const total = words.length;
  const picked: string[] = [];
  for (let i = 0; i < total; i++) {
    const mid = (i + 0.5) / total;
    if (mid >= segment.startRatio - 1e-9 && mid <= segment.endRatio + 1e-9) {
      picked.push(words[i]);
    }
  }
  if (picked.length) return picked.join(' ');
  // Rounding fallback — proportional slice by count.
  const from = Math.min(total - 1, Math.max(0, Math.floor(segment.startRatio * total)));
  const to = Math.max(from + 1, Math.min(total, Math.ceil(segment.endRatio * total)));
  return words.slice(from, to).join(' ');
}

export interface TranslationBlockParams {
  state: StudioState;
  trLines: string[];
  transFontSize: number;
  trLineHeight: number;
  gapBetween: number;
  maxW: number;
  x: number;
  y: number;
  hasArabic: boolean;
  scaleFactor: number;
  ornamentColor: string;
  cairoFontStack: string;
}

/**
 * Paints the (already auto-fitted) translation lines below the verse: a thin
 * ornament divider when Arabic is present, then the wrapped lines with the
 * translation's own direction and muted color. Returns the advanced y cursor.
 */
export function drawTranslationBlock(
  ctx: CanvasRenderingContext2D,
  p: TranslationBlockParams
): number {
  const { state, trLines, transFontSize, trLineHeight, gapBetween, maxW, x, y } = p;
  const trMeta = resolveTranslationOption(state.translationId);
  let cursor = y;

  if (p.hasArabic) {
    const dividerY = cursor + gapBetween * 0.5;
    const dividerHalfW = Math.min(72, Math.round(maxW * 0.12));
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hexToRgba(p.ornamentColor, 0.42);
    ctx.lineWidth = Math.max(1.5, Math.round(p.scaleFactor * 1.8));
    ctx.beginPath();
    ctx.moveTo(x - dividerHalfW, dividerY);
    ctx.lineTo(x + dividerHalfW, dividerY);
    ctx.stroke();
    ctx.restore();
  }

  cursor += gapBetween + trLineHeight / 2;
  ctx.font = `500 ${transFontSize}px ${p.cairoFontStack}`;
  ctx.textAlign = state.align;
  ctx.fillStyle = isLightColor(state.textColor)
    ? 'rgba(244, 241, 232, 0.90)'
    : 'rgba(31, 27, 22, 0.86)';
  ctx.direction = getTranslationDirection(trMeta.lang);
  ctx.shadowBlur = state.shadow ? 8 : 0;
  for (const line of trLines) {
    ctx.fillText(line, x, cursor);
    cursor += trLineHeight;
  }
  return cursor;
}
