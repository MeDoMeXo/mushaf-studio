/**
 * Canvas 2D painters: background ornament layers (pattern fill + illuminated
 * frames). Split from lib/ornaments/ornaments-painters.ts per the 600-line
 * file rule.
 */
import type { Point2D } from './ornaments-types';
import {
  hexToRgba,
  buildCartoucheBounds,
  buildMihrabArchGeometry,
  buildRubElHizbSquares,
  buildStarPolygonPoints,
} from './ornaments-geometry';
import type { IslamicFrameStyle, IslamicPatternStyle } from './ornaments-types';
import type { ResolvedOrnamentConfig } from './ornaments-types';

export function traceClosedPolygon(ctx: CanvasRenderingContext2D, pts: Point2D[]) {
  if (pts.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();
}

/**
 * Draw authentic repeating Islamic geometric tessellations across the canvas.
 * Uses subtle radial masking so the center recitation area remains ultra-legible.
 */
export function drawIslamicPatternLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: IslamicPatternStyle,
  ornamentColor: string,
  opacity: number,
) {
  if (style === 'none' || opacity <= 0.005) return;

  const minDim = Math.min(width, height);
  ctx.save();
  ctx.strokeStyle = hexToRgba(ornamentColor, opacity);
  ctx.fillStyle = hexToRgba(ornamentColor, opacity * 0.25);
  ctx.lineWidth = Math.max(1, minDim * 0.0014);
  ctx.lineJoin = 'round';

  if (style === 'khatam8') {
    // 8-fold Andalusian Khatam / Rub el Hizb star-and-cross tessellation
    const cell = Math.max(72, Math.round(minDim * 0.13));
    const rOuter = cell * 0.36;
    const rInner = cell * 0.17;
    const cols = Math.ceil(width / cell) + 2;
    const rows = Math.ceil(height / cell) + 2;
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const cx = col * cell + (row % 2 === 0 ? 0 : cell * 0.5);
        const cy = row * cell;
        const { squareA, squareB } = buildRubElHizbSquares(cx, cy, rOuter);
        traceClosedPolygon(ctx, squareA);
        ctx.stroke();
        traceClosedPolygon(ctx, squareB);
        ctx.stroke();

        // Connecting cross diagonals between adjacent stars
        ctx.beginPath();
        ctx.moveTo(cx - cell * 0.5, cy);
        ctx.lineTo(cx - rOuter, cy);
        ctx.moveTo(cx + rOuter, cy);
        ctx.lineTo(cx + cell * 0.5, cy);
        ctx.moveTo(cx, cy - cell * 0.5);
        ctx.lineTo(cx, cy - rOuter);
        ctx.moveTo(cx, cy + rOuter);
        ctx.lineTo(cx, cy + cell * 0.5);
        ctx.stroke();

        // Inner octagon jewel
        const innerStar = buildStarPolygonPoints(cx, cy, rInner, rInner * 0.62, 8);
        traceClosedPolygon(ctx, innerStar);
        ctx.fill();
      }
    }
  } else if (style === 'girih12') {
    // 12-fold Mamluk Girih star rosette tessellation
    const cell = Math.max(96, Math.round(minDim * 0.17));
    const rowStep = cell * 0.866;
    const rOuter = cell * 0.44;
    const rMid = cell * 0.27;
    const rCore = cell * 0.12;
    const cols = Math.ceil(width / cell) + 2;
    const rows = Math.ceil(height / rowStep) + 2;
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const cx = col * cell + (row % 2 === 0 ? 0 : cell * 0.5);
        const cy = row * rowStep;
        const star12 = buildStarPolygonPoints(cx, cy, rOuter, rMid, 12);
        traceClosedPolygon(ctx, star12);
        ctx.stroke();

        const inner12 = buildStarPolygonPoints(cx, cy, rMid * 0.86, rCore, 12, Math.PI / 12);
        traceClosedPolygon(ctx, inner12);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, rCore * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (style === 'arabesque') {
    // Pointed Ogee / Moroccan Mashrabiya lattice
    const tileW = Math.max(64, Math.round(minDim * 0.11));
    const tileH = tileW * 1.45;
    const cols = Math.ceil(width / tileW) + 2;
    const rows = Math.ceil(height / (tileH * 0.5)) + 2;
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const cx = col * tileW + (row % 2 === 0 ? 0 : tileW * 0.5);
        const cy = row * (tileH * 0.5);
        const halfW = tileW * 0.5;
        const halfH = tileH * 0.5;

        ctx.beginPath();
        ctx.moveTo(cx, cy - halfH);
        ctx.bezierCurveTo(
          cx + halfW * 0.28,
          cy - halfH * 0.45,
          cx + halfW,
          cy - halfH * 0.25,
          cx + halfW,
          cy,
        );
        ctx.bezierCurveTo(
          cx + halfW,
          cy + halfH * 0.25,
          cx + halfW * 0.28,
          cy + halfH * 0.45,
          cx,
          cy + halfH,
        );
        ctx.bezierCurveTo(
          cx - halfW * 0.28,
          cy + halfH * 0.45,
          cx - halfW,
          cy + halfH * 0.25,
          cx - halfW,
          cy,
        );
        ctx.bezierCurveTo(
          cx - halfW,
          cy - halfH * 0.25,
          cx - halfW * 0.28,
          cy - halfH * 0.45,
          cx,
          cy - halfH,
        );
        ctx.closePath();
        ctx.stroke();

        // Central diamond bud
        const bud = tileW * 0.085;
        ctx.beginPath();
        ctx.moveTo(cx, cy - bud);
        ctx.lineTo(cx + bud * 0.75, cy);
        ctx.lineTo(cx, cy + bud);
        ctx.lineTo(cx - bud * 0.75, cy);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (style === 'hexgrid') {
    // 6-fold Dome of the Rock interlaced hexagram lattice
    const r = Math.max(42, Math.round(minDim * 0.075));
    const dx = r * Math.sqrt(3);
    const dy = r * 1.5;
    const cols = Math.ceil(width / dx) + 2;
    const rows = Math.ceil(height / dy) + 2;
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const cx = col * dx + (row % 2 === 0 ? 0 : dx * 0.5);
        const cy = row * dy;

        // Outer hexagon
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 6 + (i * Math.PI) / 3;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();

        // Inner 6-pointed star
        const hexStar = buildStarPolygonPoints(cx, cy, r * 0.62, r * 0.34, 6);
        traceClosedPolygon(ctx, hexStar);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

/**
 * Draw one of 6 museum-grade Islamic frame designs around the composition.
 */
export function drawIslamicFrameLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: IslamicFrameStyle,
  ornamentColor: string,
) {
  if (style === 'none') return;

  const minDim = Math.min(width, height);
  const margin = Math.max(24, Math.round(minDim * 0.04));
  const thin = Math.max(1.2, minDim * 0.0018);
  const medium = Math.max(2.2, minDim * 0.003);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (style === 'classic') {
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.58);
    ctx.lineWidth = medium;
    ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);

    const inner = margin + Math.max(10, Math.round(minDim * 0.013));
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.28);
    ctx.lineWidth = thin;
    ctx.strokeRect(inner, inner, width - inner * 2, height - inner * 2);
  } else if (style === 'mushaf') {
    // Royal Mushaf illuminated triple border with stepped corner notches and side medallions
    const outer = margin;
    const band = Math.max(12, Math.round(minDim * 0.016));
    const inner = outer + band;
    const step = Math.max(18, Math.round(minDim * 0.028));

    // Soft gilded band fill
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.14);
    ctx.lineWidth = band;
    ctx.strokeRect(
      outer + band / 2,
      outer + band / 2,
      width - (outer + band / 2) * 2,
      height - (outer + band / 2) * 2,
    );

    // Outer double rule
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.74);
    ctx.lineWidth = medium;
    ctx.strokeRect(outer, outer, width - outer * 2, height - outer * 2);

    ctx.strokeStyle = hexToRgba(ornamentColor, 0.48);
    ctx.lineWidth = thin;
    ctx.strokeRect(inner, inner, width - inner * 2, height - inner * 2);

    // Innermost notched border (classic Madinah Mushaf stepped corners)
    const n = inner + Math.max(6, Math.round(minDim * 0.008));
    const l = n;
    const r = width - n;
    const t = n;
    const b = height - n;

    ctx.strokeStyle = hexToRgba(ornamentColor, 0.62);
    ctx.lineWidth = thin * 1.15;
    ctx.beginPath();
    ctx.moveTo(l + step, t);
    ctx.lineTo(r - step, t);
    ctx.lineTo(r - step, t + step);
    ctx.lineTo(r, t + step);
    ctx.lineTo(r, b - step);
    ctx.lineTo(r - step, b - step);
    ctx.lineTo(r - step, b);
    ctx.lineTo(l + step, b);
    ctx.lineTo(l + step, b - step);
    ctx.lineTo(l, b - step);
    ctx.lineTo(l, t + step);
    ctx.lineTo(l + step, t + step);
    ctx.closePath();
    ctx.stroke();

    // Marginal Hizb side medallions (left & right midpoint)
    const medR = Math.max(9, Math.round(minDim * 0.014));
    for (const mx of [outer + band / 2, width - outer - band / 2]) {
      const my = height / 2;
      const star = buildStarPolygonPoints(mx, my, medR, medR * 0.56, 8);
      traceClosedPolygon(ctx, star);
      ctx.fillStyle = hexToRgba(ornamentColor, 0.25);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(ornamentColor, 0.78);
      ctx.lineWidth = thin;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(mx, my, medR * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(ornamentColor, 0.85);
      ctx.fill();
    }
  } else if (style === 'mihrab') {
    // Pointed Mosque Mihrab arch with inner double contour and apex finial
    const g = buildMihrabArchGeometry(width, height, margin);

    const traceArch = (inset: number) => {
      const l = g.left + inset;
      const r = g.right - inset;
      const b = g.bottom - inset;
      const sy = g.springY + inset * 0.35;
      const ay = g.apexY + inset * 1.1;
      const span = r - l;

      ctx.beginPath();
      ctx.moveTo(l, b);
      ctx.lineTo(l, sy);
      // Left ogee pointed curve to apex
      ctx.bezierCurveTo(
        l,
        sy - (sy - ay) * 0.62,
        g.apexX - span * 0.22,
        ay + (sy - ay) * 0.16,
        g.apexX,
        ay,
      );
      // Right ogee pointed curve from apex
      ctx.bezierCurveTo(
        g.apexX + span * 0.22,
        ay + (sy - ay) * 0.16,
        r,
        sy - (sy - ay) * 0.62,
        r,
        sy,
      );
      ctx.lineTo(r, b);
      ctx.closePath();
    };

    // Subtle rectangular outer shrine border
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.34);
    ctx.lineWidth = thin;
    ctx.strokeRect(g.left, g.top, g.right - g.left, g.bottom - g.top);

    // Primary pointed Mihrab arch
    traceArch(0);
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.78);
    ctx.lineWidth = medium * 1.1;
    ctx.stroke();

    // Inner illuminated arch line
    traceArch(g.innerInset);
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.45);
    ctx.lineWidth = thin;
    ctx.stroke();

    // Apex star finial crest
    const finialR = Math.max(9, Math.round(minDim * 0.014));
    const apexStar = buildStarPolygonPoints(g.apexX, g.apexY, finialR, finialR * 0.48, 8);
    traceClosedPolygon(ctx, apexStar);
    ctx.fillStyle = hexToRgba(ornamentColor, 0.32);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.85);
    ctx.lineWidth = thin;
    ctx.stroke();

    // Decorative side columns notches at springline
    for (const sx of [g.left, g.right]) {
      ctx.beginPath();
      ctx.arc(sx, g.springY, Math.max(4, minDim * 0.0055), 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(ornamentColor, 0.8);
      ctx.fill();
    }
  } else if (style === 'andalus') {
    // Alhambra geometric interlaced diamond-chain border
    const outer = margin;
    const band = Math.max(16, Math.round(minDim * 0.022));
    const inner = outer + band;

    ctx.strokeStyle = hexToRgba(ornamentColor, 0.72);
    ctx.lineWidth = medium;
    ctx.strokeRect(outer, outer, width - outer * 2, height - outer * 2);

    ctx.strokeStyle = hexToRgba(ornamentColor, 0.54);
    ctx.lineWidth = thin * 1.2;
    ctx.strokeRect(inner, inner, width - inner * 2, height - inner * 2);

    // Interlaced repeating geometric diamonds along all 4 sides
    const step = band * 1.15;
    const midBand = band / 2;
    ctx.strokeStyle = hexToRgba(ornamentColor, 0.45);
    ctx.lineWidth = thin;

    const drawDiamond = (cx: number, cy: number, rx: number, ry: number) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - ry);
      ctx.lineTo(cx + rx, cy);
      ctx.lineTo(cx, cy + ry);
      ctx.lineTo(cx - rx, cy);
      ctx.closePath();
      ctx.stroke();
    };

    const hSpan = width - (outer + band) * 2;
    const hCount = Math.max(4, Math.floor(hSpan / step));
    const hStep = hSpan / hCount;
    for (let i = 0; i < hCount; i++) {
      const cx = inner + hStep * (i + 0.5);
      drawDiamond(cx, outer + midBand, hStep * 0.44, midBand * 0.68);
      drawDiamond(cx, height - outer - midBand, hStep * 0.44, midBand * 0.68);
    }

    const vSpan = height - (outer + band) * 2;
    const vCount = Math.max(4, Math.floor(vSpan / step));
    const vStep = vSpan / vCount;
    for (let i = 0; i < vCount; i++) {
      const cy = inner + vStep * (i + 0.5);
      drawDiamond(outer + midBand, cy, midBand * 0.68, vStep * 0.44);
      drawDiamond(width - outer - midBand, cy, midBand * 0.68, vStep * 0.44);
    }
  } else if (style === 'ottoman') {
    // Ottoman Tezhip gilded double border with top & bottom crown crests (Taj)
    const outer = margin;
    const inner = margin + Math.max(10, Math.round(minDim * 0.014));

    ctx.strokeStyle = hexToRgba(ornamentColor, 0.78);
    ctx.lineWidth = medium;
    ctx.strokeRect(outer, outer, width - outer * 2, height - outer * 2);

    ctx.strokeStyle = hexToRgba(ornamentColor, 0.42);
    ctx.lineWidth = thin;
    ctx.strokeRect(inner, inner, width - inner * 2, height - inner * 2);

    // Top & bottom Ottoman gilded crown medallions
    const crestW = Math.min(width * 0.24, Math.max(90, minDim * 0.22));
    const crestH = Math.max(14, Math.round(minDim * 0.02));
    const drawCrown = (cy: number, dir: 1 | -1) => {
      const cx = width / 2;
      ctx.beginPath();
      ctx.moveTo(cx - crestW / 2, cy);
      ctx.quadraticCurveTo(cx - crestW * 0.22, cy, cx - crestW * 0.14, cy + dir * crestH * 0.72);
      ctx.quadraticCurveTo(cx, cy + dir * crestH * 1.35, cx + crestW * 0.14, cy + dir * crestH * 0.72);
      ctx.quadraticCurveTo(cx + crestW * 0.22, cy, cx + crestW / 2, cy);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(ornamentColor, 0.22);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(ornamentColor, 0.8);
      ctx.lineWidth = thin * 1.2;
      ctx.stroke();

      // Jewel dot at crown center
      ctx.beginPath();
      ctx.arc(cx, cy + dir * crestH * 0.48, Math.max(3, minDim * 0.0042), 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(ornamentColor, 0.9);
      ctx.fill();
    };

    drawCrown(outer, 1);
    drawCrown(height - outer, -1);
  }

  ctx.restore();
}

/**
 * Draw authentic Islamic corner illuminations at all four corners of the frame.
 */
