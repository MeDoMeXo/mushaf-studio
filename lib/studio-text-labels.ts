/**
 * Surah/reciter metadata labels + ayah progress dots painters.
 * Split from lib/studio-text-renderer.ts per the 600-line file rule.
 */
import type { LabelPosition, StudioState } from './quran-data-types';
import { resolveOrnamentConfig } from './ornaments/ornaments-geometry';
import {
  drawSurahTitleBanner,
} from './ornaments/ornaments-paint-surface';
import { toArabicDigits } from './quran-utils';
import { isLightColor, resolveCanvasFontFamily } from './studio-renderer-shared';

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


