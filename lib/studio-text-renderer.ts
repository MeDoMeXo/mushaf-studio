/**
 * Verse text + label painters for the studio canvas renderer.
 * Split from lib/studio-renderer.ts per the 600-line file rule.
 */
import type { LabelPosition, StudioState, WordHighlightStyle } from './quran-data-types';
import type { Point2D } from './ornaments/ornaments-types';
import { hexToRgba, resolveOrnamentConfig } from './ornaments/ornaments-geometry';
import {
  drawIslamicAyahMedallionV2,
  drawSurahTitleBanner,
} from './ornaments/ornaments-paint-surface';
import {
  buildAyahSegments,
  buildAyahWordTimings,
  segmentIndexForWord,
  type AyahSegment,
  type AyahWordTiming,
} from './verse-words';
import { getTranslationDirection, resolveTranslationOption, toArabicDigits, wrapWordsToLines } from './quran-utils';
import { isLightColor, resolveCanvasFontFamily } from './studio-renderer-shared';
import {
  computeSafeTextColumn,
  computeVerticalBudget,
  estimateBlockHeight,
  fillRoundedRect,
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

  const transFontSize = Math.max(
    26,
    Math.round(
      state.textSource === 'translation' ? primaryFontSize * 0.58 : primaryFontSize * 0.44
    )
  );

  // Vertical budget — auto-fit keeps the wrapped block clear of the top
  // banner, bottom reciter label, progress dots and the frame itself.
  const { reservedTop, availH } = computeVerticalBudget(state);

  if (showTrans && translationText) {
    ctx.font = `500 ${transFontSize}px ${cairoFontStack}`;
    trLines = wrapWordsToLines(translationText, maxW * 0.88, (ln) => ctx.measureText(ln).width);
  }

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
    } else {
      // ── Wrapped multi-line with auto-fit ──
      // Shrinks (floor 42%) when a single word overflows the column or the
      // whole block grows past the vertical budget — fixes oversized text
      // escaping the frame.
      const arLineH = (fs: number) => fs * state.lineHeight;
      const trLineH = transFontSize * 1.55;
      const gapBetween = trLines.length ? Math.round(primaryFontSize * 0.72) : 0;
      let scale = 1;
      for (let iter = 0; iter < 14; iter++) {
        const fs = Math.round(primaryFontSize * scale);
        setArFont(fs);
        arLines = wrapTimingsToLines(timings, maxW, measure);
        const widestWord = timings.reduce((m, t) => Math.max(m, measure(t.text)), 0);
        const medallionR = Math.max(16, Math.round(fs * 0.43));
        const standaloneH =
          showMedallion && arLines.length > 0 ? Math.round(medallionR * 2.55) : 0;
        const blockH = estimateBlockHeight(
          arLines.length,
          arLineH(fs),
          standaloneH,
          trLines.length,
          trLineH,
          gapBetween
        );
        const overflowX = widestWord > maxW && widestWord > 0;
        const overflowY = blockH > availH;
        if ((!overflowX && !overflowY) || scale <= 0.42) break;
        scale = overflowX
          ? Math.max(0.42, (scale * (maxW / widestWord)) * 0.98)
          : Math.max(0.42, scale * 0.9);
      }
      arFontSize = Math.round(primaryFontSize * scale);
      setArFont(arFontSize);
      arLines = wrapTimingsToLines(timings, maxW, measure);
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
    const trMeta = resolveTranslationOption(state.translationId);
    if (arLines.length > 0) {
      const dividerY = y + gapBetween * 0.5;
      const dividerHalfW = Math.min(72, Math.round(maxW * 0.12));
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.strokeStyle = hexToRgba(ornaments.ornamentColor, 0.42);
      ctx.lineWidth = Math.max(1.5, Math.round(scaleFactor * 1.8));
      ctx.beginPath();
      ctx.moveTo(x - dividerHalfW, dividerY);
      ctx.lineTo(x + dividerHalfW, dividerY);
      ctx.stroke();
      ctx.restore();
    }
    y += gapBetween + trLineHeight / 2;
    ctx.font = `500 ${transFontSize}px ${cairoFontStack}`;
    ctx.textAlign = state.align;
    ctx.fillStyle = isLightColor(state.textColor)
      ? 'rgba(244, 241, 232, 0.90)'
      : 'rgba(31, 27, 22, 0.86)';
    ctx.direction = getTranslationDirection(trMeta.lang);
    ctx.shadowBlur = state.shadow ? 8 : 0;
    for (const line of trLines) {
      ctx.fillText(line, x, y);
      y += trLineHeight;
    }
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

export function resolveLabelCoords(
  position: LabelPosition,
  offsetYPct: number,
  w: number,
  h: number,
  goldFrame: boolean,
  hasBottomDots: boolean
): { x: number; y: number; align: CanvasTextAlign; isTop: boolean } {
  const minSide = Math.min(w, h);
  const frameInset = goldFrame ? Math.round(minSide * 0.038) + 32 : Math.round(minSide * 0.052);
  const sideInset = Math.max(frameInset + 10, Math.round(w * 0.075));
  const isTop = position === 'top' || position === 'top-right' || position === 'top-left';

  let x = w / 2;
  let align: CanvasTextAlign = 'center';
  if (position === 'top-right' || position === 'bottom-right') {
    x = w - sideInset;
    align = 'right';
  } else if (position === 'top-left' || position === 'bottom-left') {
    x = sideInset;
    align = 'left';
  }

  const baseTopY = frameInset + Math.round(minSide * 0.045);
  const dotsReserve = hasBottomDots && position === 'bottom' ? Math.round(minSide * 0.036) : 0;
  const baseBottomY = h - frameInset - Math.round(minSide * 0.028) - dotsReserve;
  const shiftY = Math.round(h * ((offsetYPct || 0) / 100));

  return {
    x,
    y: (isTop ? baseTopY : baseBottomY) + shiftY,
    align,
    isTop,
  };
}

export function drawMetadataLabels(
  ctx: CanvasRenderingContext2D,
  state: StudioState,
  surahName: string,
  ayahLabel: string,
  reciterName: string
): void {
  const w = state.width;
  const h = state.height;
  const minSide = Math.min(w, h);
  const ornaments = resolveOrnamentConfig(state);
  const hasFrame = ornaments.frameStyle !== 'none';
  const lightText = isLightColor(state.textColor);
  const accentColor = ornaments.ornamentColor;
  const mutedColor = lightText ? 'rgba(250, 247, 240, 0.84)' : 'rgba(11, 61, 46, 0.8)';
  const metaWeight = state.metaFontWeight || 600;
  const kufiStack = resolveCanvasFontFamily('Reem Kufi');
  const cairoStack = resolveCanvasFontFamily('Cairo');

  const surahPos: LabelPosition = state.surahPosition || 'top';
  const reciterPos: LabelPosition = state.reciterPosition || 'bottom';
  const drawSurah = state.showFooter && surahPos !== 'hidden';
  const drawReciter = state.showReciterFooter && Boolean(reciterName) && reciterPos !== 'hidden';
  const shareSameSlot = drawSurah && drawReciter && surahPos === reciterPos;

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';

  if (drawSurah) {
    const coords = resolveLabelCoords(
      surahPos,
      state.surahOffsetY,
      w,
      h,
      hasFrame,
      state.showProgressDots
    );
    const fSize = Math.max(22, Math.round(minSide * 0.03));
    // Give extra breathing room below Mihrab arch apex or Ottoman crown when positioned at top center
    const archTopPad =
      coords.isTop && coords.align === 'center'
        ? ornaments.frameStyle === 'mihrab'
          ? Math.round(minSide * 0.095)
          : ornaments.frameStyle === 'ottoman'
            ? Math.round(minSide * 0.055)
            : 0
        : 0;
    const baseY = coords.y + archTopPad;
    const yPos = shareSameSlot && !coords.isTop ? baseY - Math.round(minSide * 0.038) : baseY;
    const labelText = `سورة ${surahName} · ${toArabicDigits(ayahLabel)}`;

    if (coords.align === 'center') {
      drawSurahTitleBanner(
        ctx,
        coords.x,
        yPos,
        labelText,
        fSize,
        kufiStack,
        accentColor,
        ornaments.surahBannerStyle,
        w * 0.72
      );
    } else {
      ctx.textAlign = coords.align;
      ctx.font = `${metaWeight} ${fSize}px ${kufiStack}`;
      ctx.fillStyle = accentColor;
      if (state.shadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 2;
      }
      ctx.fillText(`﴿ ${labelText} ﴾`, coords.x, yPos);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
  }

  if (drawReciter) {
    const coords = resolveLabelCoords(
      reciterPos,
      state.reciterOffsetY,
      w,
      h,
      hasFrame,
      state.showProgressDots
    );
    const rSize = Math.max(17, Math.round(minSide * 0.022));
    const yPos = shareSameSlot && coords.isTop ? coords.y + Math.round(minSide * 0.045) : coords.y;

    ctx.textAlign = coords.align;
    ctx.font = `${metaWeight} ${rSize}px ${cairoStack}`;
    ctx.fillStyle = mutedColor;
    if (state.shadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 1;
    }
    ctx.fillText(`بصوت القارئ ${reciterName}`, coords.x, yPos);
  }

  ctx.restore();
}

export function drawProgressDots(
  ctx: CanvasRenderingContext2D,
  state: StudioState,
  activeIdx: number,
  total: number
): void {
  const w = state.width;
  const h = state.height;
  const minSide = Math.min(w, h);
  const ornaments = resolveOrnamentConfig(state);
  const hasFrame = ornaments.frameStyle !== 'none';
  const frameInset = hasFrame ? Math.round(minSide * 0.04) + 30 : Math.round(minSide * 0.042);
  const dotR = Math.max(4, Math.round(minSide * 0.0062));
  const gap = Math.round(dotR * 3.1);
  const totalW = (total - 1) * gap;
  const startX = w / 2 + totalW / 2; // RTL right-to-left progression
  const y = h - frameInset - Math.round(dotR * 1.4);
  const lightText = isLightColor(state.textColor);

  for (let i = 0; i < total; i++) {
    const cx = startX - i * gap;
    ctx.beginPath();
    ctx.arc(cx, y, i === activeIdx ? dotR * 1.35 : dotR, 0, Math.PI * 2);
    ctx.fillStyle =
      i === activeIdx
        ? ornaments.ornamentColor
        : lightText
          ? 'rgba(250, 247, 240, 0.32)'
          : 'rgba(11, 61, 46, 0.28)';
    ctx.fill();
  }
}


