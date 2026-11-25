/**
 * cover-canvas-renderer.ts — Museum-grade Unified Channel Cover Canvas renderer
 * and pure aspect-aware layout geometry (16:9 YouTube, 1:1 Instagram, 9:16 Reels).
 * Split from lib/studio-text-renderer.ts to keep modules crisp and <= 600 lines.
 */
import type { StudioState } from './quran-data-types';
import {
  buildStarPolygonPoints,
  hexToRgba,
  resolveOrnamentConfig,
} from './ornaments/ornaments-geometry';
import { traceClosedPolygon } from './ornaments/ornaments-paint-background';
import { isLightColor, resolveCanvasFontFamily } from './studio-renderer-shared';
import { resolveCoverBasmala } from './surah-cover';

export interface CoverLayoutMetrics {
  minSide: number;
  isPortrait: boolean;
  crownBaseY: number;
  crownSpanW: number;
  crownH: number;
  titleMaxSize: number;
  titleMaxWidth: number;
  titleY: number;
  dividerY: number;
  dividerHalfW: number;
  rosetteRadius: number;
  reciterY: number;
  reciterMaxFontSize: number;
  reciterMaxBoxW: number;
  reciterBoxH: number;
  basmalaY: number;
  basmalaSize: number;
  basmalaMaxW: number;
  watermarkY: number;
  watermarkFontSize: number;
  watermarkBoxH: number;
}

/**
 * Pure aspect-aware cover layout calculator guaranteeing hierarchical Surah Title
 * prominence, independent Reciter cartouche framing, spacious Basmala, and clean
 * lower-anchor Watermark spacing with zero overlaps across 16:9, 1:1, and 9:16.
 */
export function computeCoverLayoutMetrics(params: {
  width: number;
  height: number;
  hasBasmala: boolean;
  hasWatermark: boolean;
  verticalOffsetPct?: number;
}): CoverLayoutMetrics {
  const { width: w, height: h, hasBasmala, hasWatermark, verticalOffsetPct = 0 } = params;
  const minSide = Math.min(w, h);
  const isPortrait = h > w * 1.15;
  const shiftY = Math.round(h * (verticalOffsetPct / 100));

  const titleMaxSize = Math.round(minSide * (isPortrait ? 0.136 : 0.148));
  const titleMaxWidth = w * (isPortrait ? 0.84 : 0.78);
  const crownSpanW = Math.min(w * 0.50, minSide * 0.46);
  const crownH = Math.round(minSide * (isPortrait ? 0.095 : 0.112));

  const dividerHalfW = Math.min(w * 0.34, minSide * 0.32);
  const rosetteRadius = Math.max(13, Math.round(minSide * 0.018));

  const reciterMaxFontSize = Math.max(24, Math.round(minSide * 0.034));
  const reciterBoxH = Math.max(56, Math.round(minSide * 0.070));
  const reciterMaxBoxW = w * (isPortrait ? 0.82 : 0.74);

  const basmalaSize = Math.max(30, Math.round(minSide * (isPortrait ? 0.056 : 0.058)));
  const basmalaMaxW = w * (isPortrait ? 0.84 : 0.78);

  const watermarkFontSize = Math.max(22, Math.round(minSide * 0.032));
  const watermarkBoxH = Math.max(48, Math.round(watermarkFontSize * 1.95));
  const watermarkY = isPortrait ? h * 0.795 : h * 0.835;

  // Vertical spacing gaps scaled smoothly to frame dimensions
  const titleToDividerGap = Math.round(titleMaxSize * 0.72);
  const dividerToReciterGap = Math.round(reciterBoxH * 0.5 + minSide * 0.044);
  const reciterToBasmalaGap = Math.round(reciterBoxH * 0.5 + minSide * 0.078);

  const rawTitleY =
    (isPortrait ? h * (hasBasmala ? 0.355 : 0.40) : h * (hasBasmala ? 0.325 : 0.37)) + shiftY;
  const minTitleY = Math.round(minSide * 0.105 + crownH + titleMaxSize * 0.64);
  let titleY = Math.max(minTitleY, rawTitleY);

  // Clamp upward smoothly if Basmala would otherwise crowd the lower watermark zone
  if (hasBasmala) {
    const projectedBasmalaBottom =
      titleY + titleToDividerGap + dividerToReciterGap + reciterToBasmalaGap + basmalaSize * 0.68;
    const maxAllowedBottom = (hasWatermark ? watermarkY - watermarkBoxH * 0.68 : h * 0.88) - minSide * 0.035;
    if (projectedBasmalaBottom > maxAllowedBottom) {
      titleY = Math.max(minTitleY, titleY - (projectedBasmalaBottom - maxAllowedBottom));
    }
  }

  const crownBaseY = titleY - Math.round(titleMaxSize * 0.66);
  const dividerY = titleY + titleToDividerGap;
  const reciterY = dividerY + dividerToReciterGap;
  const basmalaY = reciterY + reciterToBasmalaGap;

  return {
    minSide,
    isPortrait,
    crownBaseY,
    crownSpanW,
    crownH,
    titleMaxSize,
    titleMaxWidth,
    titleY,
    dividerY,
    dividerHalfW,
    rosetteRadius,
    reciterY,
    reciterMaxFontSize,
    reciterMaxBoxW,
    reciterBoxH,
    basmalaY,
    basmalaSize,
    basmalaMaxW,
    watermarkY,
    watermarkFontSize,
    watermarkBoxH,
  };
}

function fitTextFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontWeight: number,
  fontStack: string,
  preferredSize: number,
  maxWidth: number,
  minSize: number
): number {
  let size = preferredSize;
  ctx.font = `${fontWeight} ${size}px ${fontStack}`;
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth && measured > 0) {
    size = Math.max(minSize, Math.floor(size * (maxWidth / measured)));
  }
  return size;
}

function drawCoverCrownArch(
  ctx: CanvasRenderingContext2D,
  cx: number,
  m: CoverLayoutMetrics,
  accent: string
): void {
  const halfW = m.crownSpanW * 0.5;
  const baseY = m.crownBaseY;
  const apexY = baseY - m.crownH;
  const thin = Math.max(1.8, m.minSide * 0.0024);

  ctx.save();
  const grad = ctx.createLinearGradient(cx - halfW, baseY, cx + halfW, baseY);
  grad.addColorStop(0, hexToRgba(accent, 0));
  grad.addColorStop(0.24, hexToRgba(accent, 0.78));
  grad.addColorStop(0.5, hexToRgba(accent, 0.98));
  grad.addColorStop(0.76, hexToRgba(accent, 0.78));
  grad.addColorStop(1, hexToRgba(accent, 0));

  // Outer sweeping Islamic ogee arch framing the Surah Title hero
  ctx.strokeStyle = grad;
  ctx.lineWidth = thin * 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, baseY);
  ctx.bezierCurveTo(
    cx - halfW * 0.62,
    baseY - m.crownH * 0.56,
    cx - halfW * 0.28,
    apexY + m.crownH * 0.42,
    cx,
    apexY
  );
  ctx.bezierCurveTo(
    cx + halfW * 0.28,
    apexY + m.crownH * 0.42,
    cx + halfW * 0.62,
    baseY - m.crownH * 0.56,
    cx + halfW,
    baseY
  );
  ctx.stroke();

  // Miniature inner mihrab silhouette crest
  const innerW = halfW * 0.24;
  const innerTop = apexY + m.crownH * 0.30;
  const innerBot = baseY - m.crownH * 0.05;
  ctx.strokeStyle = hexToRgba(accent, 0.68);
  ctx.lineWidth = thin;
  ctx.beginPath();
  ctx.moveTo(cx - innerW, innerBot);
  ctx.lineTo(cx - innerW, innerTop + m.crownH * 0.28);
  ctx.quadraticCurveTo(cx - innerW * 0.65, innerTop + m.crownH * 0.14, cx, innerTop);
  ctx.quadraticCurveTo(
    cx + innerW * 0.65,
    innerTop + m.crownH * 0.14,
    cx + innerW,
    innerTop + m.crownH * 0.28
  );
  ctx.lineTo(cx + innerW, innerBot);
  ctx.stroke();

  // Apex finial star bead
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx, apexY, Math.max(3.2, thin * 1.9), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCoverRosetteDivider(
  ctx: CanvasRenderingContext2D,
  cx: number,
  m: CoverLayoutMetrics,
  accent: string
): void {
  const y = m.dividerY;
  const gap = m.rosetteRadius * 1.55;
  const thin = Math.max(1.8, m.minSide * 0.0022);

  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  for (const dir of [-1, 1]) {
    const startX = cx + dir * gap;
    const endX = cx + dir * m.dividerHalfW;
    const grad = ctx.createLinearGradient(startX, y, endX, y);
    grad.addColorStop(0, hexToRgba(accent, 0.92));
    grad.addColorStop(1, hexToRgba(accent, 0));
    ctx.strokeStyle = grad;
    ctx.lineWidth = thin;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  // Central 8-point illuminated Islamic rosette jewel
  const star = buildStarPolygonPoints(cx, y, m.rosetteRadius, m.rosetteRadius * 0.54, 8);
  traceClosedPolygon(ctx, star);
  ctx.fillStyle = hexToRgba(accent, 0.22);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(accent, 0.94);
  ctx.lineWidth = thin * 0.95;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, y, m.rosetteRadius * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.restore();
}

function drawCoverReciterCartouche(
  ctx: CanvasRenderingContext2D,
  cx: number,
  m: CoverLayoutMetrics,
  reciterLabel: string,
  cairoFont: string,
  accent: string,
  lightText: boolean
): void {
  const fontSize = fitTextFontSize(
    ctx,
    reciterLabel,
    700,
    cairoFont,
    m.reciterMaxFontSize,
    m.reciterMaxBoxW - m.minSide * 0.075,
    18
  );
  ctx.font = `700 ${fontSize}px ${cairoFont}`;
  const textW = ctx.measureText(reciterLabel).width;
  const padX = Math.round(fontSize * 1.45);
  const boxW = Math.min(m.reciterMaxBoxW, Math.max(m.minSide * 0.38, textW + padX * 2));
  const boxH = m.reciterBoxH;
  const halfW = boxW / 2;
  const halfH = boxH / 2;
  const y = m.reciterY;
  const pointExt = Math.round(halfH * 0.55);
  const thin = Math.max(1.8, m.minSide * 0.0022);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;

  // Chamfered pointed Islamic plaque path
  const traceCartouche = (inset = 0, extScale = 1) => {
    const hw = halfW - inset;
    const hh = halfH - inset;
    const pe = pointExt * extScale;
    ctx.beginPath();
    ctx.moveTo(cx - hw, y - hh);
    ctx.lineTo(cx + hw, y - hh);
    ctx.lineTo(cx + hw + pe, y);
    ctx.lineTo(cx + hw, y + hh);
    ctx.lineTo(cx - hw, y + hh);
    ctx.lineTo(cx - hw - pe, y);
    ctx.closePath();
  };

  traceCartouche(0, 1);
  ctx.fillStyle = lightText ? 'rgba(4, 24, 18, 0.78)' : 'rgba(250, 246, 236, 0.92)';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = hexToRgba(accent, 0.9);
  ctx.lineWidth = thin * 1.15;
  ctx.stroke();

  // Inner hairline frame
  traceCartouche(Math.max(4, Math.round(boxH * 0.1)), 0.72);
  ctx.strokeStyle = hexToRgba(accent, 0.34);
  ctx.lineWidth = thin * 0.65;
  ctx.stroke();

  // Left & right ornamental rosette finials outside cartouche tips
  const tipStarR = Math.max(8, Math.round(boxH * 0.22));
  for (const dir of [-1, 1]) {
    const tipX = cx + dir * (halfW + pointExt + tipStarR * 0.7);
    const tipStar = buildStarPolygonPoints(tipX, y, tipStarR, tipStarR * 0.5, 6);
    traceClosedPolygon(ctx, tipStar);
    ctx.fillStyle = hexToRgba(accent, 0.24);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(accent, 0.82);
    ctx.lineWidth = thin * 0.8;
    ctx.stroke();
  }

  ctx.fillStyle = lightText ? '#FAF7F0' : '#0B3D2E';
  ctx.fillText(reciterLabel, cx, y + 1);
  ctx.restore();
}

function drawCoverWatermarkAnchor(
  ctx: CanvasRenderingContext2D,
  cx: number,
  m: CoverLayoutMetrics,
  channelName: string,
  cairoFont: string,
  accent: string,
  lightText: boolean
): void {
  const fontSize = fitTextFontSize(
    ctx,
    channelName,
    700,
    cairoFont,
    m.watermarkFontSize,
    m.reciterMaxBoxW * 0.78,
    16
  );
  ctx.font = `700 ${fontSize}px ${cairoFont}`;
  const textW = ctx.measureText(channelName).width;
  const padX = Math.round(fontSize * 1.25);
  const pillW = Math.min(m.reciterMaxBoxW * 0.9, textW + padX * 2);
  const pillH = m.watermarkBoxH;
  const pillX = cx - pillW / 2;
  const y = m.watermarkY;
  const thin = Math.max(1.6, m.minSide * 0.002);

  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Flanking gold guide rules + diamond tips
  const ruleGap = Math.round(m.minSide * 0.018);
  const ruleLen = Math.min(m.minSide * 0.18, (m.dividerHalfW * 1.15 - pillW / 2) * 0.9);
  if (ruleLen > 24) {
    const dSize = Math.max(4, Math.round(m.minSide * 0.007));
    for (const dir of [-1, 1]) {
      const rx1 = cx + dir * (pillW / 2 + ruleGap);
      const rx2 = rx1 + dir * ruleLen;
      ctx.fillStyle = hexToRgba(accent, 0.9);
      ctx.beginPath();
      ctx.moveTo(rx1, y - dSize);
      ctx.lineTo(rx1 + dSize, y);
      ctx.lineTo(rx1, y + dSize);
      ctx.lineTo(rx1 - dSize, y);
      ctx.closePath();
      ctx.fill();

      const grad = ctx.createLinearGradient(rx1, y, rx2, y);
      grad.addColorStop(0, hexToRgba(accent, 0.75));
      grad.addColorStop(1, hexToRgba(accent, 0));
      ctx.strokeStyle = grad;
      ctx.lineWidth = thin * 0.85;
      ctx.beginPath();
      ctx.moveTo(rx1 + dir * dSize * 1.3, y);
      ctx.lineTo(rx2, y);
      ctx.stroke();
    }
  }

  // Watermark stadium pill
  ctx.fillStyle = lightText ? 'rgba(4, 22, 16, 0.82)' : 'rgba(250, 247, 240, 0.92)';
  ctx.strokeStyle = hexToRgba(accent, 0.88);
  ctx.lineWidth = thin * 1.1;
  ctx.beginPath();
  ctx.roundRect(pillX, y - pillH / 2, pillW, pillH, Math.round(pillH * 0.5));
  ctx.fill();
  ctx.stroke();

  // Miniature ornamental crest directly below watermark pill
  const crestY = y + pillH / 2 + Math.max(8, Math.round(m.minSide * 0.012));
  const crestR = Math.max(6, Math.round(m.minSide * 0.01));
  ctx.strokeStyle = hexToRgba(accent, 0.65);
  ctx.lineWidth = thin * 0.85;
  ctx.beginPath();
  ctx.moveTo(cx - crestR * 2.4, crestY);
  ctx.quadraticCurveTo(cx - crestR, crestY + crestR * 0.9, cx, crestY);
  ctx.quadraticCurveTo(cx + crestR, crestY + crestR * 0.9, cx + crestR * 2.4, crestY);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.fillText(channelName, cx, y + 1);
  ctx.restore();
}

/**
 * Renders the Unified Channel Cover Layout:
 * Crown Arch + Hero Surah Title + Rosette Divider + Independent Reciter Frame
 * + Spacious Basmala + Lower-Anchored Channel Watermark, adapting to all live Studio styles.
 */
export function drawUnifiedCoverTypography(
  ctx: CanvasRenderingContext2D,
  state: StudioState,
  surahName: string,
  reciterName: string
): void {
  const w = state.width;
  const h = state.height;
  const cx = w / 2;
  const ornaments = resolveOrnamentConfig(state);
  const lightText = isLightColor(state.textColor);
  const primaryFont = resolveCanvasFontFamily(state.fontFamily || 'Amiri Quran');
  const quranFont = resolveCanvasFontFamily('Amiri Quran');
  const cairoFont = resolveCanvasFontFamily('Cairo');
  const accent = ornaments.ornamentColor || '#E6C75A';
  const basmalaLine = resolveCoverBasmala(state.surah);
  const channelName = (state.watermark || '').trim();

  const m = computeCoverLayoutMetrics({
    width: w,
    height: h,
    hasBasmala: Boolean(basmalaLine),
    hasWatermark: Boolean(channelName),
    verticalOffsetPct: state.verticalOffset || 0,
  });

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';

  // Central contrast radial scrim for effortless readability over any backdrop
  const scrim = ctx.createRadialGradient(
    cx,
    h * 0.45,
    m.minSide * 0.05,
    cx,
    h * 0.45,
    Math.max(w, h) * 0.52
  );
  scrim.addColorStop(0, lightText ? 'rgba(4, 16, 12, 0.48)' : 'rgba(250, 246, 236, 0.60)');
  scrim.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, w, h);

  // 1) Crown Ogee Arch + Hero Surah Title (`سورة الفاتحة`)
  drawCoverCrownArch(ctx, cx, m, accent);

  const surahText = `سورة ${(surahName || 'الفاتحة').trim()}`;
  const titleFontSize = fitTextFontSize(
    ctx,
    surahText,
    700,
    primaryFont,
    m.titleMaxSize,
    m.titleMaxWidth,
    46
  );
  ctx.font = `700 ${titleFontSize}px ${primaryFont}`;
  ctx.fillStyle = state.textColor;
  if (state.glow) {
    ctx.shadowColor = state.textColor;
    ctx.shadowBlur = Math.round(titleFontSize * 0.30);
    ctx.shadowOffsetY = 0;
  } else if (state.shadow) {
    ctx.shadowColor = lightText ? 'rgba(0, 0, 0, 0.72)' : 'rgba(255, 255, 255, 0.50)';
    ctx.shadowBlur = Math.round(titleFontSize * 0.22);
    ctx.shadowOffsetY = Math.max(3, Math.round(titleFontSize * 0.045));
  }
  ctx.fillText(surahText, cx, m.titleY);
  if (state.fontFamily === 'Amiri Quran') {
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = state.textColor;
    ctx.lineWidth = Math.max(1.2, titleFontSize * 0.014);
    ctx.lineJoin = 'round';
    ctx.strokeText(surahText, cx, m.titleY);
    ctx.restore();
  }

  // 2) Ornamental Divider + Illuminated 8-Point Rosette
  drawCoverRosetteDivider(ctx, cx, m, accent);

  // 3) Independent Ornamental Reciter Cartouche Frame
  const cleanReciter = (reciterName || 'تلاوة قرآنية').trim();
  drawCoverReciterCartouche(
    ctx,
    cx,
    m,
    `بصوت القارئ ${cleanReciter}`,
    cairoFont,
    accent,
    lightText
  );

  // 4) Spacious Calligraphic Basmala (`﴿ بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ ﴾`)
  if (basmalaLine) {
    const basmalaFit = fitTextFontSize(
      ctx,
      basmalaLine,
      400,
      quranFont,
      m.basmalaSize,
      m.basmalaMaxW,
      24
    );
    ctx.font = `400 ${basmalaFit}px ${quranFont}`;
    ctx.fillStyle = accent;
    if (state.glow) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = Math.round(basmalaFit * 0.28);
      ctx.shadowOffsetY = 0;
    } else if (state.shadow) {
      ctx.shadowColor = lightText ? 'rgba(0, 0, 0, 0.60)' : 'rgba(255, 255, 255, 0.38)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    ctx.fillText(basmalaLine, cx, m.basmalaY);
  }

  // 5) Lower-Anchored Channel Watermark with flanking diamond guide rules
  if (channelName) {
    drawCoverWatermarkAnchor(ctx, cx, m, channelName, cairoFont, accent, lightText);
  }

  ctx.restore();
}
