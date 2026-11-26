/**
 * Verse text + label painters for the studio canvas renderer.
 * Split from lib/studio-renderer.ts per the 600-line file rule.
 */
import type { StudioState, WordHighlightStyle } from './quran-data-types';
import { hexToRgba, resolveOrnamentConfig } from './ornaments/ornaments-geometry';
import {
  drawIslamicAyahMedallionV2,
} from './ornaments/ornaments-paint-surface';
import {
  buildAyahSegments,
  buildAyahWordTimings,
  segmentIndexForWord,
  type AyahSegment,
  type AyahWordTiming,
} from './verse-words';
import { toArabicDigits, wrapWordsToLines } from './quran-utils';
import { isLightColor, resolveCanvasFontFamily } from './studio-renderer-shared';
import {
  computeSafeTextColumn,
  computeVerticalBudget,
  drawTranslationBlock,
  estimateBlockHeight,
  fillRoundedRect,
  splitTranslationForSegment,
  wrapTimingsToLines,
} from './studio-text-karaoke';

export interface MainTextExtras {
  /** Index of the word currently being recited (karaoke audio tracking). */
  activeWordIndex?: number;
}

export { computeSafeTextColumn } from './studio-text-karaoke';

export function drawMainText(
  ctx: CanvasRenderingContext2D,
  state: StudioState,
  arabicText: string,
  translationText: string,
  ayahNumStr: string,
  extras?: MainTextExtras
): void {
  const w = state.width;
  const h = state.height;
  const { safeLeft, safeRight, maxW } = computeSafeTextColumn(state);
  const scaleFactor = Math.min(w, h) / 1080;
  const primaryFontSize = Math.round(state.fontSize * scaleFactor);
  const primaryFontStack = resolveCanvasFontFamily(state.fontFamily);
  const cairoFontStack = resolveCanvasFontFamily('Cairo');
  const amiriFontStack = resolveCanvasFontFamily('Amiri');
  const ornaments = resolveOrnamentConfig(state);
  const weight = state.fontWeight || 400;
  const x =
    state.align === 'center'
      ? w / 2
      : state.align === 'right'
        ? safeRight
        : safeLeft;

  const showArabic = state.textSource === 'uthmani' || state.textSource === 'both';
  const showTrans = state.textSource === 'translation' || state.textSource === 'both';
  const showMedallion = state.showAyahNumber !== false && Boolean(ayahNumStr);

  const singleMode = (state.verseLineMode || 'wrap') === 'single';
  const timings = showArabic && arabicText ? buildAyahWordTimings(arabicText) : [];
  const activeWordIndex = extras?.activeWordIndex ?? -1;
  const highlightOn =
    state.wordHighlight === true &&
    activeWordIndex >= 0 &&
    activeWordIndex < timings.length;
  const highlightStyle: WordHighlightStyle = state.wordHighlightStyle || 'block';
  const highlightColor = state.wordHighlightColor || '#C9A227';
  const highlightOpacity = Math.max(0.15, Math.min(0.85, state.wordHighlightOpacity ?? 0.35));

  const setArFont = (size: number) => {
    ctx.font = `${weight} ${Math.max(12, size)}px ${primaryFontStack}`;
  };
  const measure = (s: string) => ctx.measureText(s).width;

  let arLines: AyahWordTiming[][] = [];
  let arFontSize = primaryFontSize;
  let trLines: string[] = [];
  let transFontSize = Math.max(
    24,
    Math.round(
      state.textSource === 'translation' ? primaryFontSize * 0.58 : primaryFontSize * 0.44
    )
  );
  const baseTransFontSize = transFontSize;

  // Vertical budget — auto-fit keeps the wrapped block clear of the top
  // banner, bottom reciter label, progress dots and the frame itself.
  const { reservedTop, availH } = computeVerticalBudget(state);

  // The translation text actually displayed: in single-line mode the chunk
  // matching the visible pronunciation segment (same line treatment as the
  // Arabic); otherwise the whole verse translation.
  let translationForDisplay = translationText;

  // Translation wrapping is font-size dependent: re-wrap at every candidate
  // size so shrinking also merges lines (containment for the translation —
  // نفس معاملة احتواء النص العربي).
  const wrapTransAt = (tfs: number): string[] => {
    if (!showTrans || !translationForDisplay) return [];
    ctx.font = `500 ${Math.max(14, tfs)}px ${cairoFontStack}`;
    return wrapWordsToLines(translationForDisplay, maxW * 0.88, (ln) => ctx.measureText(ln).width);
  };

  if (timings.length > 0) {
    setArFont(primaryFontSize);
    if (singleMode) {
      // ── Pronunciation-segmented single line ──
      // No whole-ayah shrinking: the ayah splits into recitation phrases that
      // each fit one line at full size; the visible segment follows the audio.
      const segments = buildAyahSegments(timings, maxW, measure);
      const visibleSegIdx = Math.max(0, Math.min(segments.length - 1, segmentIndexForWord(segments, activeWordIndex)));
      const seg = segments[visibleSegIdx];
      const segWidth = measure(seg.text);
      if (segWidth > maxW && segWidth > 0) {
        // Only when a single token alone overflows (extremely long words).
        arFontSize = Math.max(
          Math.round(primaryFontSize * 0.34),
          Math.floor(primaryFontSize * (maxW / segWidth))
        );
        setArFont(arFontSize);
      }
      arLines = [timings.slice(seg.fromWord, seg.toWord + 1)];
      // Apply the line treatment to the translation too: only the chunk that
      // matches this recitation segment shows (contained, follows the audio).
      if (showTrans && translationText) {
        translationForDisplay = splitTranslationForSegment(translationText, seg);
      }
      if (translationForDisplay) {
        transFontSize = baseTransFontSize;
        trLines = wrapTransAt(transFontSize);
      }
    } else {
      // ── Wrapped multi-line with auto-fit ──
      // Shrinks (floor 42%) when a single word overflows the column or the
      // whole block grows past the vertical budget — fixes oversized text
      // escaping the frame. The translation scales with the Arabic (floor
      // 45% of its own base) and re-wraps at every candidate size.
      const arLineH = (fs: number) => fs * state.lineHeight;
      const gapBetween = Math.round(primaryFontSize * 0.72);
      let scale = 1;
      for (let iter = 0; iter < 14; iter++) {
        const fs = Math.round(primaryFontSize * scale);
        const tfs = Math.max(
          16,
          Math.round(baseTransFontSize * Math.max(0.45, scale))
        );
        setArFont(fs);
        arLines = wrapTimingsToLines(timings, maxW, measure);
        trLines = wrapTransAt(tfs);
        const widestWord = timings.reduce((m, t) => Math.max(m, measure(t.text)), 0);
        const medallionR = Math.max(16, Math.round(fs * 0.43));
        const standaloneH =
          showMedallion && arLines.length > 0 ? Math.round(medallionR * 2.55) : 0;
        const blockH = estimateBlockHeight(
          arLines.length,
          arLineH(fs),
          standaloneH,
          trLines.length,
          tfs * 1.55,
          trLines.length ? gapBetween : 0
        );
        const overflowX = widestWord > maxW && widestWord > 0;
        const overflowY = blockH > availH;
        transFontSize = tfs;
        if ((!overflowX && !overflowY) || scale <= 0.42) break;
        scale = overflowX
          ? Math.max(0.42, (scale * (maxW / widestWord)) * 0.98)
          : Math.max(0.42, scale * 0.9);
      }
      arFontSize = Math.round(primaryFontSize * scale);
      setArFont(arFontSize);
      arLines = wrapTimingsToLines(timings, maxW, measure);
      trLines = wrapTransAt(transFontSize);
    }
  } else if (showTrans && translationText) {
    // ── Translation-only mode ──
    transFontSize = baseTransFontSize;
    trLines = wrapTransAt(transFontSize);
  }

  // ── Stage 2 — translation containment ──
  // Independent of the verse font: when the block (Arabic + medallion + gap +
  // translation) still exceeds the vertical budget, shrink the translation
  // alone (floor ≈ 30% of its base / 15px) re-wrapping at each size until the
  // whole composition fits inside the frame.
  if (trLines.length) {
    const arLineH = arFontSize * state.lineHeight;
    const gap = trLines.length ? Math.round(primaryFontSize * 0.72) : 0;
    const medallionR = Math.max(16, Math.round(arFontSize * 0.43));
    const standaloneH =
      showMedallion && arLines.length > 0 ? Math.round(medallionR * 2.55) : 0;
    const fixedH = arLines.length * arLineH + standaloneH + gap;
    // Start from the translation scale the joint pass already reached (never
    // grow it back), then keep shrinking translation-only until it all fits.
    let tScale = Math.max(0.05, transFontSize / Math.max(1, baseTransFontSize));
    for (let i = 0; i < 14; i++) {
      const tfs = Math.max(15, Math.round(baseTransFontSize * tScale));
      const lines = wrapTransAt(tfs);
      const blockH = fixedH + lines.length * (tfs * 1.55);
      transFontSize = tfs;
      trLines = lines;
      if (blockH <= availH || tScale <= 0.3) break;
      tScale *= 0.9;
    }
  }

  const arLineHeight = arFontSize * state.lineHeight;
  const trLineHeight = transFontSize * 1.55;
  const medallionRadius = Math.max(16, Math.round(arFontSize * 0.43));
  const medallionPad = Math.round(medallionRadius * 0.55);

  // Inline medallion fits at the RTL end of the last Arabic line — the strict
  // bound (no 1.04 slack + shift only when it truly fits) keeps the final
  // line inside the safe column instead of spilling over the frame.
  let medallionInline = false;
  let lastArLineWidth = 0;
  let lastArLineTokens: AyahWordTiming[] = [];
  if (showMedallion && arLines.length > 0) {
    setArFont(arFontSize);
    lastArLineTokens = arLines[arLines.length - 1];
    lastArLineWidth = measure(lastArLineTokens.map((t) => t.text).join(' '));
    const neededExtra = medallionRadius * 2 + medallionPad;
    medallionInline = lastArLineWidth + neededExtra <= maxW;
  }

  const standaloneMedallionHeight =
    showMedallion && !medallionInline ? Math.round(medallionRadius * 2.55) : 0;

  const gapBetween = arLines.length && trLines.length ? Math.round(primaryFontSize * 0.72) : 0;

  const totalHeight =
    arLines.length * arLineHeight +
    standaloneMedallionHeight +
    trLines.length * trLineHeight +
    gapBetween;

  const verticalShiftPx = Math.round(h * ((state.verticalOffset || 0) / 100));
  let y = reservedTop + Math.max(0, (availH - totalHeight) / 2) + verticalShiftPx;

  // Apply text shadow / glow
  if (state.glow) {
    ctx.shadowColor = state.textColor;
    ctx.shadowBlur = primaryFontSize * 0.38;
    ctx.shadowOffsetY = 0;
  } else if (state.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = primaryFontSize * 0.18;
    ctx.shadowOffsetY = Math.max(2, primaryFontSize * 0.045);
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  ctx.textAlign = state.align;
  ctx.textBaseline = 'middle';

  let lastArLineY = y;
  let lastDrawnLineRight = 0;

  if (arLines.length > 0) {
    setArFont(arFontSize);
    ctx.fillStyle = state.textColor;
    ctx.direction = 'rtl';
    y += arLineHeight / 2;

    // Amiri Quran ships a single regular weight; emulate crisp bold/extra-bold with subtle stroke thickening
    const needsSyntheticBold = state.fontFamily === 'Amiri Quran' && weight >= 600;
    const strokeWidth =
      weight >= 800
        ? arFontSize * 0.036
        : weight >= 700
          ? arFontSize * 0.025
          : arFontSize * 0.015;

    const spaceW = Math.max(measure(' '), arFontSize * 0.22);

    for (let idx = 0; idx < arLines.length; idx++) {
      const lineTokens = arLines[idx];
      const isLastLine = idx === arLines.length - 1;
      const lineText = lineTokens.map((t) => t.text).join(' ');
      const lineWidth = measure(lineText);

      // RTL word run: right edge anchored per alignment, words flow right → left.
      const lineRight =
        state.align === 'center'
          ? x + lineWidth / 2
          : state.align === 'right'
            ? x
            : x + lineWidth;
      // When centered + inline medallion the (text + medallion) group is
      // centered as a unit: shift the line right by half the medallion span,
      // clamped to the safe column edge so nothing ever spills over.
      const shiftedRight =
        isLastLine && medallionInline && state.align === 'center'
          ? Math.min(
              lineRight + (medallionRadius + medallionPad * 0.5),
              safeRight
            )
          : lineRight;
      if (isLastLine) lastDrawnLineRight = shiftedRight;

      ctx.textAlign = 'right';
      let cursorRight = shiftedRight;

      for (const tok of lineTokens) {
        const wordW = measure(tok.text);
        const wordLeft = cursorRight - wordW;
        const isHighlighted = highlightOn && tok.index === activeWordIndex;

        // Highlight shape 1 — soft rounded block behind the word (تظليل)
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
            wordLeft - padX,
            y - arFontSize * 0.62 - padY * 0.4,
            wordW + padX * 2,
            arFontSize * 1.04 + padY,
            Math.max(4, arFontSize * 0.14)
          );
          ctx.restore();
        }

        // Highlight shape 3 — tinted word glyphs (تلوين) without touching
        // the main text color of the rest of the verse.
        ctx.fillStyle = isHighlighted && highlightStyle === 'tint'
          ? highlightColor
          : state.textColor;

        if (state.fontFamily === 'Amiri Quran' && weight === 300) {
          ctx.save();
          ctx.globalAlpha = ctx.globalAlpha * 0.88;
          ctx.fillText(tok.text, cursorRight, y);
          ctx.restore();
        } else {
          ctx.fillText(tok.text, cursorRight, y);
        }

        if (needsSyntheticBold) {
          ctx.save();
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          ctx.strokeStyle = state.textColor;
          ctx.lineWidth = Math.max(1, strokeWidth);
          ctx.lineJoin = 'round';
          ctx.strokeText(tok.text, cursorRight, y);
          ctx.restore();
        }

        // Highlight shape 2 — underline bar beneath the word
        if (isHighlighted && highlightStyle === 'underline') {
          ctx.save();
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          ctx.fillStyle = highlightColor;
          const barH = Math.max(2, arFontSize * 0.055);
          fillRoundedRect(
            ctx,
            wordLeft,
            y + arFontSize * 0.42,
            wordW,
            barH,
            barH / 2
          );
          ctx.restore();
        }

        cursorRight = wordLeft - spaceW;
      }

      if (isLastLine) {
        lastArLineY = y;
      }
      y += arLineHeight;
    }
    y -= arLineHeight / 2;
  }

  // Draw Islamic Ayah Number Medallion (inline at RTL end of verse, or centered cleanly below)
  if (showMedallion) {
    let mx = w / 2;
    let my = y + standaloneMedallionHeight * 0.52;

    if (medallionInline && arLines.length > 0) {
      my = lastArLineY + Math.round(primaryFontSize * 0.03);
      if (state.align === 'center') {
        // The medallion hugs the ACTUAL drawn left edge of the shifted line.
        const drawnLineLeft = lastDrawnLineRight - lastArLineWidth;
        mx = drawnLineLeft - medallionPad - medallionRadius;
      } else if (state.align === 'right') {
        mx = x - lastArLineWidth - medallionPad - medallionRadius;
      } else {
        mx = x + lastArLineWidth + medallionPad + medallionRadius;
      }
    } else {
      y += standaloneMedallionHeight;
    }

    const digitColor = isLightColor(state.textColor) ? '#FAF7F0' : '#0B3D2E';
    drawIslamicAyahMedallionV2(
      ctx,
      mx,
      my,
      medallionRadius,
      toArabicDigits(ayahNumStr),
      ornaments.ayahNumberStyle,
      ornaments.ornamentColor,
      digitColor,
      amiriFontStack,
      ctx.globalAlpha
    );
  }

  if (trLines.length > 0) {
    y = drawTranslationBlock(ctx, {
      state,
      trLines,
      transFontSize,
      trLineHeight,
      gapBetween,
      maxW,
      x,
      y,
      hasArabic: arLines.length > 0,
      scaleFactor,
      ornamentColor: ornaments.ornamentColor,
      cairoFontStack,
    });
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}
