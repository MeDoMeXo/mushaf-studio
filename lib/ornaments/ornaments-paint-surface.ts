/**
 * Canvas 2D painters: surface ornament layers (corner rosettes, surah
 * banners, ayah medallions). Split from lib/ornaments/ornaments-painters.ts
 * per the 600-line file rule.
 */
import {
  buildCartoucheBounds,
  buildRubElHizbSquares,
  buildStarPolygonPoints,
  hexToRgba,
} from './ornaments-geometry';
import { traceClosedPolygon } from './ornaments-paint-background';
import type {
  IslamicAyahMedallionStyle,
  IslamicCornerStyle,
  Point2D,
  ResolvedOrnamentConfig,
  SurahBannerStyle,
} from './ornaments-types';

export function drawIslamicCornerOrnaments(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: IslamicCornerStyle,
  ornamentColor: string,
) {
  if (style === 'none') return;

  const minDim = Math.min(width, height);
  const inset = Math.max(52, Math.round(minDim * 0.078));
  const radius = Math.max(15, Math.round(minDim * 0.024));
  const thin = Math.max(1.2, minDim * 0.0018);

  const corners = [
    { x: inset, y: inset, sx: 1, sy: 1 },
    { x: width - inset, y: inset, sx: -1, sy: 1 },
    { x: inset, y: height - inset, sx: 1, sy: -1 },
    { x: width - inset, y: height - inset, sx: -1, sy: -1 },
  ];

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const c of corners) {
    ctx.save();
    ctx.translate(c.x, c.y);

    if (style === 'rub_el_hizb') {
      const { squareA, squareB } = buildRubElHizbSquares(0, 0, radius);
      ctx.fillStyle = hexToRgba(ornamentColor, 0.16);
      ctx.strokeStyle = hexToRgba(ornamentColor, 0.78);
      ctx.lineWidth = thin * 1.15;

      traceClosedPolygon(ctx, squareA);
      ctx.fill();
      ctx.stroke();
      traceClosedPolygon(ctx, squareB);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.36, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(ornamentColor, 0.7);
      ctx.lineWidth = thin;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.14, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(ornamentColor, 0.92);
      ctx.fill();
    } else if (style === 'shamsa') {
      // 12-petal gilded Shamsa rosette
      const outerStar = buildStarPolygonPoints(0, 0, radius * 1.08, radius * 0.68, 12);
      traceClosedPolygon(ctx, outerStar);
      ctx.fillStyle = hexToRgba(ornamentColor, 0.18);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(ornamentColor, 0.8);
      ctx.lineWidth = thin;
      ctx.stroke();

      const innerStar = buildStarPolygonPoints(0, 0, radius * 0.56, radius * 0.3, 12, Math.PI / 12);
      traceClosedPolygon(ctx, innerStar);
      ctx.strokeStyle = hexToRgba(ornamentColor, 0.62);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(ornamentColor, 0.95);
      ctx.fill();
    } else if (style === 'floral_corner') {
      // Mamluk illuminated corner spandrel (Turrah) pointing inward
      ctx.scale(c.sx, c.sy);
      const arm = radius * 1.55;
      const offset = -radius * 0.6;

      ctx.strokeStyle = hexToRgba(ornamentColor, 0.8);
      ctx.lineWidth = thin * 1.25;
      ctx.beginPath();
      ctx.moveTo(offset, offset + arm);
      ctx.lineTo(offset, offset);
      ctx.lineTo(offset + arm, offset);
      ctx.stroke();

      // Inner curved illuminated spandrel arc
      ctx.beginPath();
      ctx.moveTo(offset, offset + arm * 0.86);
      ctx.quadraticCurveTo(offset + arm * 0.42, offset + arm * 0.42, offset + arm * 0.86, offset);
      ctx.strokeStyle = hexToRgba(ornamentColor, 0.62);
      ctx.lineWidth = thin;
      ctx.stroke();

      // 8-point corner jewel tucked in the spandrel
      const jewel = buildStarPolygonPoints(
        offset + arm * 0.28,
        offset + arm * 0.28,
        radius * 0.38,
        radius * 0.18,
        8,
      );
      traceClosedPolygon(ctx, jewel);
      ctx.fillStyle = hexToRgba(ornamentColor, 0.26);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(ornamentColor, 0.85);
      ctx.stroke();

      // Finial beads on arm tips
      for (const [bx, by] of [
        [offset + arm, offset],
        [offset, offset + arm],
      ]) {
        ctx.beginPath();
        ctx.arc(bx, by, Math.max(2.5, radius * 0.13), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(ornamentColor, 0.88);
        ctx.fill();
      }
    } else if (style === 'crescent_star') {
      // Andalusian crescent + 8-point star emblem
      ctx.strokeStyle = hexToRgba(ornamentColor, 0.5);
      ctx.lineWidth = thin;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Crescent via two arcs
      const cr = radius * 0.66;
      ctx.fillStyle = hexToRgba(ornamentColor, 0.85);
      ctx.beginPath();
      ctx.arc(-radius * 0.08, 0, cr, 0.38 * Math.PI, 1.62 * Math.PI, false);
      ctx.arc(radius * 0.18, 0, cr * 0.8, 1.48 * Math.PI, 0.52 * Math.PI, true);
      ctx.closePath();
      ctx.fill();

      // Companion 8-point star
      const miniStar = buildStarPolygonPoints(
        radius * 0.34,
        -radius * 0.05,
        radius * 0.28,
        radius * 0.12,
        8,
      );
      traceClosedPolygon(ctx, miniStar);
      ctx.fillStyle = hexToRgba(ornamentColor, 0.92);
      ctx.fill();
    }

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draw the illuminated Surah Name heading in one of 4 authentic Mushaf styles.
 */
export function drawSurahTitleBanner(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  surahLabel: string,
  fontSize: number,
  fontFamily: string,
  ornamentColor: string,
  style: SurahBannerStyle,
  maxWidth: number,
) {
  ctx.save();
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const measuredW = ctx.measureText(surahLabel).width;
  const thin = Math.max(1.2, fontSize * 0.042);

  if (style === 'cartouche') {
    // Authentic illuminated Mushaf Surah Cartouche with lobed circular side finials
    const b = buildCartoucheBounds(centerX, centerY, measuredW, fontSize, maxWidth);
    const r = b.height * 0.34;

    // Soft gilded cartouche plate
    ctx.beginPath();
    ctx.roundRect(b.left, b.top, b.width, b.height, r);
    ctx.fillStyle = hexToRgba(ornamentColor, 0.14);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.78);
    ctx.lineWidth = thin * 1.4;
    ctx.stroke();

    // Inner hairline border
    const inset = Math.max(4, b.height * 0.11);
    ctx.beginPath();
    ctx.roundRect(
      b.left + inset,
      b.top + inset,
      b.width - inset * 2,
      b.height - inset * 2,
      Math.max(4, r - inset * 0.6),
    );
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.42);
    ctx.lineWidth = thin;
    ctx.stroke();

    // Left and right illuminated Mushaf rosettes (Shamsa end-medallions)
    const medR = b.height * 0.36;
    for (const side of [-1, 1]) {
      const mx = side === -1 ? b.left : b.right;
      const star = buildStarPolygonPoints(mx, centerY, medR, medR * 0.56, 8);
      traceClosedPolygon(ctx, star);
      ctx.fillStyle = hexToRgba(ornamentColor, 0.28);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(ornamentColor, 0.85);
      ctx.lineWidth = thin * 1.1;
      ctx.stroke();

      // Outward finial spear tip
      const tipX = mx + side * (medR * 1.65);
      ctx.beginPath();
      ctx.moveTo(mx + side * medR, centerY);
      ctx.lineTo(tipX, centerY);
      ctx.strokeStyle = hexToRgba(ornamentColor, 0.72);
      ctx.lineWidth = thin;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(tipX, centerY, Math.max(2.2, thin * 1.6), 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(ornamentColor, 0.9);
      ctx.fill();
    }
  } else if (style === 'mihrab_crest') {
    // Pointed miniature arch crest framing the Surah title
    const b = buildCartoucheBounds(centerX, centerY, measuredW, fontSize, maxWidth);
    const crownH = b.height * 0.42;

    ctx.beginPath();
    ctx.moveTo(b.left, b.bottom);
    ctx.lineTo(b.right, b.bottom);
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.65);
    ctx.lineWidth = thin * 1.3;
    ctx.stroke();

    // Upper ogee crest arch
    ctx.beginPath();
    ctx.moveTo(b.left + b.width * 0.08, b.top + b.height * 0.25);
    ctx.quadraticCurveTo(centerX - b.width * 0.16, b.top - crownH * 0.3, centerX, b.top - crownH);
    ctx.quadraticCurveTo(
      centerX + b.width * 0.16,
      b.top - crownH * 0.3,
      b.right - b.width * 0.08,
      b.top + b.height * 0.25,
    );
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.78);
    ctx.lineWidth = thin * 1.35;
    ctx.stroke();

    // Apex diamond jewel
    const d = Math.max(4.5, fontSize * 0.16);
    ctx.beginPath();
    ctx.moveTo(centerX, b.top - crownH - d);
    ctx.lineTo(centerX + d * 0.75, b.top - crownH);
    ctx.lineTo(centerX, b.top - crownH + d);
    ctx.lineTo(centerX - d * 0.75, b.top - crownH);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(ornamentColor, 0.92);
    ctx.fill();
  } else if (style === 'classic') {
    // Classic horizontal gilded lines + diamond studs
    const lineHalf = Math.min(maxWidth * 0.44, measuredW / 2 + fontSize * 1.8);
    const gap = measuredW / 2 + fontSize * 0.55;
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.62);
    ctx.lineWidth = thin * 1.1;

    if (lineHalf > gap + 12) {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(centerX + side * gap, centerY);
        ctx.lineTo(centerX + side * lineHalf, centerY);
        ctx.stroke();

        const dx = centerX + side * (gap - fontSize * 0.22);
        const d = Math.max(3.5, fontSize * 0.12);
        ctx.beginPath();
        ctx.moveTo(dx, centerY - d);
        ctx.lineTo(dx + d, centerY);
        ctx.lineTo(dx, centerY + d);
        ctx.lineTo(dx - d, centerY);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(ornamentColor, 0.85);
        ctx.fill();
      }
    }
  }
  // 'minimal' renders pure text without extra graphic ornament

  // Render Surah text with soft legibility glow
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = ornamentColor;
  ctx.fillText(surahLabel, centerX, centerY + fontSize * 0.04);
  ctx.restore();
}

/**
 * Draw an authentic Islamic Ayah Number Medallion in 5 distinct manuscript styles.
 */
export function drawIslamicAyahMedallionV2(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  arabicDigits: string,
  style: IslamicAyahMedallionStyle,
  ornamentColor: string,
  textColor: string,
  fontFamily: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.translate(cx, cy);

  const fillBg = hexToRgba(ornamentColor, 0.14);
  const strokeMain = hexToRgba(ornamentColor, 0.9);
  const strokeSoft = hexToRgba(ornamentColor, 0.46);
  const lw = Math.max(1.2, radius * 0.075);

  if (style === 'rosette') {
    // 12-petal scalloped Mushaf Ayah rosette
    const petals = 12;
    ctx.beginPath();
    for (let i = 0; i <= petals * 4; i++) {
      const a = (i / (petals * 4)) * Math.PI * 2;
      const r = radius * (0.94 + 0.11 * Math.cos(petals * a));
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fillBg;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = strokeMain;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, radius * 0.05);
    ctx.strokeStyle = strokeSoft;
    ctx.stroke();

    // Cardinal jewels
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * radius * 0.85, Math.sin(a) * radius * 0.85, Math.max(1.2, radius * 0.055), 0, Math.PI * 2);
      ctx.fillStyle = strokeMain;
      ctx.fill();
    }
  } else if (style === 'rub_el_hizb') {
    // Authentic Rub el Hizb overlapping squares (۞)
    const { squareA, squareB } = buildRubElHizbSquares(0, 0, radius * 1.04);
    ctx.fillStyle = fillBg;
    ctx.strokeStyle = strokeMain;
    ctx.lineWidth = lw;

    traceClosedPolygon(ctx, squareA);
    ctx.fill();
    ctx.stroke();
    traceClosedPolygon(ctx, squareB);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.66, 0, Math.PI * 2);
    ctx.strokeStyle = strokeSoft;
    ctx.lineWidth = Math.max(1, radius * 0.048);
    ctx.stroke();
  } else if (style === 'shamsa') {
    // 16-ray royal gilded Shamsa medallion
    const outerStar = buildStarPolygonPoints(0, 0, radius * 1.12, radius * 0.82, 16);
    traceClosedPolygon(ctx, outerStar);
    ctx.fillStyle = fillBg;
    ctx.fill();
    ctx.strokeStyle = strokeMain;
    ctx.lineWidth = lw * 0.92;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
    ctx.strokeStyle = strokeMain;
    ctx.lineWidth = Math.max(1, radius * 0.055);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
    ctx.strokeStyle = strokeSoft;
    ctx.lineWidth = Math.max(0.8, radius * 0.035);
    ctx.stroke();
  } else if (style === 'ornate') {
    // Double gilded circle with 4 directional floral finials
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.94, 0, Math.PI * 2);
    ctx.fillStyle = fillBg;
    ctx.fill();
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = strokeMain;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.74, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, radius * 0.048);
    ctx.strokeStyle = strokeSoft;
    ctx.stroke();

    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -radius * 1.18);
      ctx.quadraticCurveTo(radius * 0.19, -radius * 0.98, 0, -radius * 0.88);
      ctx.quadraticCurveTo(-radius * 0.19, -radius * 0.98, 0, -radius * 1.18);
      ctx.fillStyle = strokeMain;
      ctx.fill();
      ctx.restore();
    }
  } else {
    // Minimal clean gilded ring
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.88, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(ornamentColor, 0.1);
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.78);
    ctx.stroke();
  }

  // Eastern Arabic-Indic Ayah number centered inside medallion
  const digitCount = arabicDigits.length;
  const numScale = digitCount >= 3 ? 0.68 : digitCount === 2 ? 0.84 : 0.96;
  const numFontSize = Math.max(11, Math.round(radius * numScale));
  ctx.font = `700 ${numFontSize}px ${fontFamily}`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 4;
  ctx.fillText(arabicDigits, 0, Math.max(1, numFontSize * 0.06));

  ctx.restore();
}
