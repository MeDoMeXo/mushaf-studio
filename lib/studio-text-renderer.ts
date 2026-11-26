/**
 * Verse text + label painters for the studio canvas renderer.
 * Split from lib/studio-renderer.ts per the 600-line file rule.
 */
import type { LabelPosition, StudioState } from './quran-data-types';
import type { Point2D } from './ornaments/ornaments-types';
import { hexToRgba, resolveOrnamentConfig } from './ornaments/ornaments-geometry';
import {
  drawIslamicAyahMedallionV2,
  drawSurahTitleBanner,
} from './ornaments/ornaments-paint-surface';
import { getTranslationDirection, resolveTranslationOption, toArabicDigits, wrapWordsToLines } from './quran-utils';
import { isLightColor, resolveCanvasFontFamily } from './studio-renderer-shared';

export function drawMainText(
  ctx: CanvasRenderingContext2D,
  state: StudioState,
  arabicText: string,
  translationText: string,
  ayahNumStr: string
): void {
  const w = state.width;
  const h = state.height;
  const maxW = w * 0.78;
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
        ? w * 0.89
        : w * 0.11;

  const showArabic = state.textSource === 'uthmani' || state.textSource === 'both';
  const showTrans = state.textSource === 'translation' || state.textSource === 'both';
  const showMedallion = state.showAyahNumber !== false && Boolean(ayahNumStr);

  let arLines: string[] = [];
  let trLines: string[] = [];
  // Effective Arabic font size — the requested size in wrap mode; in
  // single-line mode long verses auto-shrink to fit the text column width
  // (floor: 30% of the requested size so extreme surahs stay readable).
  let arFontSize = primaryFontSize;

  if (showArabic && arabicText) {
    ctx.font = `${weight} ${primaryFontSize}px ${primaryFontStack}`;
    if ((state.verseLineMode || 'wrap') === 'single') {
      const fullWidth = ctx.measureText(arabicText).width;
      if (fullWidth > maxW && fullWidth > 0) {
        const fit = maxW / fullWidth;
        arFontSize = Math.max(
          Math.round(primaryFontSize * 0.3),
          Math.floor(primaryFontSize * fit)
        );
      }
      ctx.font = `${weight} ${arFontSize}px ${primaryFontStack}`;
      arLines = [arabicText];
    } else {
      arLines = wrapWordsToLines(arabicText, maxW, (ln) => ctx.measureText(ln).width);
    }
  }

  const transFontSize = Math.max(
    26,
    Math.round(
      state.textSource === 'translation' ? primaryFontSize * 0.58 : primaryFontSize * 0.44
    )
  );

  if (showTrans && translationText) {
    ctx.font = `500 ${transFontSize}px ${cairoFontStack}`;
    trLines = wrapWordsToLines(translationText, maxW * 0.88, (ln) => ctx.measureText(ln).width);
  }

  const arLineHeight = arFontSize * state.lineHeight;
  const trLineHeight = transFontSize * 1.55;
  const medallionRadius = Math.max(16, Math.round(arFontSize * 0.43));
  const medallionPad = Math.round(medallionRadius * 0.55);

  // Measure whether the Islamic ayah medallion fits inline at the end (left edge in RTL) of the last Arabic line
  let medallionInline = false;
  let lastArLineWidth = 0;
  if (showMedallion && arLines.length > 0) {
    ctx.font = `${weight} ${arFontSize}px ${primaryFontStack}`;
    lastArLineWidth = ctx.measureText(arLines[arLines.length - 1]).width;
    const neededExtra = medallionRadius * 2 + medallionPad;
    medallionInline = lastArLineWidth + neededExtra <= maxW * 1.04;
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
  let y = (h - totalHeight) / 2 - Math.round(h * 0.01) + verticalShiftPx;

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

  if (arLines.length > 0) {
    ctx.font = `${weight} ${arFontSize}px ${primaryFontStack}`;
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

    for (let idx = 0; idx < arLines.length; idx++) {
      const line = arLines[idx];
      const isLastLine = idx === arLines.length - 1;
      // When centered + inline medallion, shift the final line slightly right so (text + medallion) is visually balanced
      const lineX =
        isLastLine && medallionInline && state.align === 'center'
          ? x + (medallionRadius + medallionPad * 0.5)
          : x;

      if (state.fontFamily === 'Amiri Quran' && weight === 300) {
        ctx.save();
        ctx.globalAlpha = ctx.globalAlpha * 0.88;
        ctx.fillText(line, lineX, y);
        ctx.restore();
      } else {
        ctx.fillText(line, lineX, y);
      }

      if (needsSyntheticBold) {
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = state.textColor;
        ctx.lineWidth = Math.max(1, strokeWidth);
        ctx.lineJoin = 'round';
        ctx.strokeText(line, lineX, y);
        ctx.restore();
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
        const shiftedTextCenter = x + (medallionRadius + medallionPad * 0.5);
        mx = shiftedTextCenter - lastArLineWidth / 2 - medallionPad - medallionRadius;
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


