/**
 * Verse highlight (karaoke) unit painters — split from
 * lib/studio-text-renderer.ts per the 600-line file rule. The three painters
 * keep the exact drawing semantics of the main renderer: joined
 * disjointed-letter groups paint as ONE unit (الرسم متصل) while the highlight
 * zone tracks the ACTIVE LETTER so the tracing advances letter-by-letter
 * exactly like the mushaf writing.
 */
import type { WordHighlightStyle } from './quran-data-types';
import { hexToRgba } from './ornaments/ornaments-geometry';
import { fillRoundedRect } from './studio-text-karaoke';
import type { DisjointGroupMeta } from './verse-words';

export interface VerseHighlightPaintContext {
  ctx: CanvasRenderingContext2D;
  /** Same measure() the renderer uses — keeps zones aligned with paint. */
  measure: (s: string) => number;
  arFontSize: number;
  spaceW: number;
  highlightStyle: WordHighlightStyle;
  highlightColor: string;
  highlightOpacity: number;
  textColor: string;
  fontFamily: string;
  weight: number;
  needsSyntheticBold: boolean;
  strokeWidth: number;
}

/**
 * Creates the three unit painters bound to one drawing context. Pure move of
 * the original closures from drawMainText — no behavior change whatsoever.
 */
export function createVerseHighlightPainters(hp: VerseHighlightPaintContext) {
  const {
    ctx,
    measure,
    arFontSize,
    spaceW,
    highlightStyle,
    highlightColor,
    highlightOpacity,
    textColor,
    fontFamily,
    weight,
    needsSyntheticBold,
    strokeWidth,
  } = hp;

  /**
   * Approximate RTL letter zones inside a joined disjointed group. The
   * canvas API exposes no per-glyph metrics for shaped Arabic, so each
   * letter's share is its ISOLATED measured width normalized to the
   * group's drawn width — precise enough for the highlight rect/tint and
   * it keeps the letters flowing right → left like the writing itself.
   */
  const letterZones = (
    g: DisjointGroupMeta,
    groupW: number,
    right: number
  ): { left: number; width: number }[] | null => {
    const letters: string[] = [];
    for (const ch of g.text) {
      const isLetter =
        (ch >= '\u0621' && ch <= '\u064A') || (ch >= '\u0671' && ch <= '\u06D3');
      if (isLetter) letters.push(ch);
    }
    if (letters.length !== g.size) return null; // defensive: whole-unit highlight
    const shares = letters.map((L) => Math.max(1, measure(L)));
    const total = shares.reduce((a, b) => a + b, 0);
    if (total <= 0 || groupW <= 0) return null;
    const scale = groupW / total;
    const zones: { left: number; width: number }[] = [];
    let edge = right;
    for (let i = 0; i < letters.length; i++) {
      const w = shares[i] * scale;
      zones.push({ left: edge - w, width: w });
      edge -= w;
    }
    return zones;
  };

  /**
   * Feathered tint sweep across a joined group: base color everywhere
   * except a soft highlight zone over the active letter — the coloring
   * (التلوين) advances letter-by-letter inside the connected writing
   * without hard-cutting shaped glyphs mid-stroke.
   */
  const groupTintGradient = (
    textLeft: number,
    right: number,
    textW: number,
    hlLeft: number,
    hlW: number
  ): CanvasGradient => {
    const grad = ctx.createLinearGradient(textLeft, 0, right, 0);
    const pos = (px: number) =>
      Math.max(0, Math.min(1, (px - textLeft) / (textW || 1)));
    const feather = Math.max(2, Math.min(hlW * 0.35, textW * 0.08));
    const stops: [number, string][] = [
      [0, textColor],
      [pos(hlLeft - feather), textColor],
      [pos(hlLeft + feather * 0.4), highlightColor],
      [pos(hlLeft + hlW - feather * 0.4), highlightColor],
      [pos(hlLeft + hlW + feather), textColor],
      [1, textColor],
    ];
    stops.sort((a, b) => a[0] - b[0]);
    let prev = -1;
    for (const [p, c] of stops) {
      const cp = Math.max(prev + 0.0015, p);
      if (cp > 1) break;
      grad.addColorStop(cp, c);
      prev = cp;
    }
    return grad;
  };

  /**
   * Paints ONE drawing unit — a plain word, or a whole joined disjointed
   * group whose highlight zone tracks the active letter. Returns the next
   * right-edge cursor (RTL: the unit ends at `right`, next starts after a
   * word space to its left).
   */
  const paintUnit = (p: {
    text: string;
    textW: number;
    right: number;
    y: number;
    zones: { left: number; width: number }[] | null;
    /** -1 = inactive; 0 = active plain word; ≥0 = active letter zone index. */
    activeZone: number;
  }): number => {
    const { text, textW, right, y, zones, activeZone } = p;
    const textLeft = right - textW;
    const isHighlighted = activeZone >= 0;
    let hlLeft = textLeft;
    let hlW = textW;
    if (isHighlighted && zones && zones[activeZone]) {
      hlLeft = zones[activeZone].left;
      hlW = zones[activeZone].width;
    }

    // Highlight shape 1 — soft rounded block behind the word/letter (تظليل)
    if (isHighlighted && highlightStyle === 'block') {
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = hexToRgba(highlightColor, highlightOpacity);
      const padX = arFontSize * 0.14;
      const padY = arFontSize * 0.1;
      fillRoundedRect(
        ctx,
        hlLeft - padX,
        y - arFontSize * 0.62 - padY * 0.4,
        hlW + padX * 2,
        arFontSize * 1.04 + padY,
        Math.max(4, arFontSize * 0.14)
      );
      ctx.restore();
    }

    // Highlight shape 3 — tinted glyphs (تلوين): plain words take the flat
    // highlight color; joined groups take a feathered sweep over the active
    // letter's zone so the coloring steps letter-by-letter inside the joint.
    ctx.fillStyle =
      isHighlighted && highlightStyle === 'tint'
        ? zones
          ? groupTintGradient(textLeft, right, textW, hlLeft, hlW)
          : highlightColor
        : textColor;

    if (fontFamily === 'Amiri Quran' && weight === 300) {
      ctx.save();
      ctx.globalAlpha = ctx.globalAlpha * 0.88;
      ctx.fillText(text, right, y);
      ctx.restore();
    } else {
      ctx.fillText(text, right, y);
    }

    if (needsSyntheticBold) {
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = textColor;
      ctx.lineWidth = Math.max(1, strokeWidth);
      ctx.lineJoin = 'round';
      ctx.strokeText(text, right, y);
      ctx.restore();
    }

    // Highlight shape 2 — underline bar beneath the word/letter
    if (isHighlighted && highlightStyle === 'underline') {
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = highlightColor;
      const barH = Math.max(2, arFontSize * 0.055);
      fillRoundedRect(ctx, hlLeft, y + arFontSize * 0.42, hlW, barH, barH / 2);
      ctx.restore();
    }

    return textLeft - spaceW;
  };

  return { letterZones, groupTintGradient, paintUnit };
}
