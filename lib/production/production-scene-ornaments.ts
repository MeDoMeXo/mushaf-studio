/**
 * production-scene-ornaments — زخارف مشهد «استوديو الإنتاج».
 *
 * رسّامون نقيون للكانفيس: القوسان المدببان المؤطّران بالشباك، القناديل
 * المعلّقة المتوهّجة، أفق المسجد (قباب ومآذن)، الجسيمات الذهبية الطائرة،
 * والفاصل الزخرفي. كلها حتمية بدلالة الزمن — ما تراه هو ما يُصدَّر.
 */

// ── لوحة الألوان الثابتة ────────────────────────────────────────────────
const GOLD = '#d4af37';
const GOLD_SOFT = '#e6c75a';
const GOLD_DEEP = '#9a7b1e';
const EMERALD_MID = '#0b3d2e';
const EMERALD_DEEP = '#062318';

// ── أدوات هندسية صغيرة ─────────────────────────────────────────────────

function hash01(i: number, salt = 0): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}


// ── القوس الذهبي المؤطّر ───────────────────────────────────────────────

/** قوس مدبب (عثماني) — مسار كامل يبدأ من القاعدة اليمنى وينتهي باليسرى. */
function archPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  aw: number,
  ah: number
): void {
  const half = aw / 2;
  const shoulder = baseY - ah * 0.55;
  const apex = baseY - ah;
  ctx.beginPath();
  ctx.moveTo(cx + half, baseY);
  ctx.lineTo(cx + half, shoulder);
  ctx.quadraticCurveTo(cx + half * 0.92, baseY - ah * 0.78, cx, apex);
  ctx.quadraticCurveTo(cx - half * 0.92, baseY - ah * 0.78, cx - half, shoulder);
  ctx.lineTo(cx - half, baseY);
  ctx.closePath();
}

/** قوس واحد: إطار ذهبي مزدوج + شبكة مشربية داخلية. */
export function paintArch(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  aw: number,
  ah: number,
  glow: number
): void {
  ctx.save();
  // شبكة المشربية داخل القوس
  archPath(ctx, cx, baseY, aw * 0.94, ah * 0.94);
  ctx.clip();
  ctx.strokeStyle = withAlpha(GOLD, 0.16 + glow * 0.08);
  ctx.lineWidth = Math.max(1, aw * 0.008);
  for (let i = 1; i < 6; i++) {
    const x = cx - aw / 2 + (aw * i) / 6;
    ctx.beginPath();
    ctx.moveTo(x, baseY - ah);
    ctx.lineTo(x + aw * 0.08, baseY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, baseY - ah);
    ctx.lineTo(x - aw * 0.08, baseY);
    ctx.stroke();
  }
  for (let j = 1; j < 4; j++) {
    const y = baseY - (ah * j) / 4;
    ctx.beginPath();
    ctx.moveTo(cx - aw / 2, y);
    ctx.quadraticCurveTo(cx, y - ah * 0.06, cx + aw / 2, y);
    ctx.stroke();
  }
  ctx.restore();
  // الإطار الذهبي المزدوج
  archPath(ctx, cx, baseY, aw, ah);
  ctx.strokeStyle = withAlpha(GOLD, 0.55 + glow * 0.3);
  ctx.lineWidth = Math.max(1.5, aw * 0.014);
  ctx.stroke();
  archPath(ctx, cx, baseY, aw * 0.86, ah * 0.86);
  ctx.strokeStyle = withAlpha(GOLD_SOFT, 0.35 + glow * 0.25);
  ctx.lineWidth = Math.max(1, aw * 0.008);
  ctx.stroke();
}

/** قوسان جانبيان (يسار/يمين) بتوهّج يتنفس مع الزمن. */
export function paintArches(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const glow = 0.5 + 0.5 * Math.sin(t * 0.7);
  const aw = w * 0.3;
  const ah = h * 0.52;
  paintArch(ctx, w * 0.19, h * 0.86, aw, ah, glow);
  paintArch(ctx, w * 0.81, h * 0.86, aw, ah, glow);
}

// ── القناديل المعلّقة ──────────────────────────────────────────────────

/** قنديل واحد: حبل + قبّة + جسم مضلّع + توهّج دافئ يرقص. */
export function paintLantern(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  size: number,
  t: number,
  seed: number
): void {
  const flicker = 0.75 + 0.25 * Math.sin(t * 2.2 + seed * 5.3);
  const ropeH = topY + size * 0.5;
  // الحبل
  ctx.strokeStyle = withAlpha(GOLD, 0.45);
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx, ropeH);
  ctx.stroke();
  // التوهّج
  const glowR = size * (1.1 + 0.15 * flicker);
  const g = ctx.createRadialGradient(cx, ropeH + size * 0.55, 1, cx, ropeH + size * 0.55, glowR);
  g.addColorStop(0, `rgba(255, 214, 120, ${0.55 * flicker})`);
  g.addColorStop(1, 'rgba(255, 214, 120, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, ropeH + size * 0.55, glowR, 0, Math.PI * 2);
  ctx.fill();
  // القبّة
  ctx.beginPath();
  ctx.moveTo(cx, ropeH);
  ctx.quadraticCurveTo(cx + size * 0.16, ropeH + size * 0.1, cx + size * 0.14, ropeH + size * 0.18);
  ctx.lineTo(cx - size * 0.14, ropeH + size * 0.18);
  ctx.quadraticCurveTo(cx - size * 0.16, ropeH + size * 0.1, cx, ropeH);
  ctx.fillStyle = withAlpha(GOLD, 0.85);
  ctx.fill();
  // الجسم (شبه منحرف مضلّع)
  const bodyTop = ropeH + size * 0.18;
  const bodyH = size * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.17, bodyTop);
  ctx.lineTo(cx + size * 0.17, bodyTop);
  ctx.lineTo(cx + size * 0.12, bodyTop + bodyH);
  ctx.lineTo(cx - size * 0.12, bodyTop + bodyH);
  ctx.closePath();
  ctx.fillStyle = `rgba(230, 199, 90, ${0.28 + 0.3 * flicker})`;
  ctx.fill();
  ctx.strokeStyle = withAlpha(GOLD, 0.8);
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.stroke();
  // مضلّعات زجاجية
  ctx.strokeStyle = withAlpha(GOLD_DEEP, 0.5);
  for (let i = 1; i < 3; i++) {
    const y = bodyTop + (bodyH * i) / 3;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.16, y);
    ctx.lineTo(cx + size * 0.16, y);
    ctx.stroke();
  }
  // ذيل القنديل
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.05, bodyTop + bodyH);
  ctx.lineTo(cx + size * 0.05, bodyTop + bodyH);
  ctx.lineTo(cx, bodyTop + bodyH + size * 0.1);
  ctx.closePath();
  ctx.fillStyle = withAlpha(GOLD, 0.7);
  ctx.fill();
}

export function paintLanterns(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const s = Math.min(w, h) * 0.11;
  paintLantern(ctx, w * 0.3, h * 0.02, s, t, 1);
  paintLantern(ctx, w * 0.7, h * 0.05, s * 0.85, t, 2);
}

// ── أفق المسجد (قباب ومآذن) ────────────────────────────────────────────

export function paintSkyline(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const baseY = h * 0.9;
  const skyline = withAlpha(EMERALD_MID, 0.9);
  ctx.fillStyle = skyline;
  // شريط الأرض
  const grad = ctx.createLinearGradient(0, baseY, 0, h);
  grad.addColorStop(0, withAlpha(EMERALD_MID, 0.85));
  grad.addColorStop(1, withAlpha(EMERALD_DEEP, 0.95));
  ctx.fillStyle = grad;
  ctx.fillRect(0, baseY, w, h - baseY);
  // قباب ومآذن موزعة
  ctx.fillStyle = skyline;
  const spots = [0.06, 0.13, 0.24, 0.34, 0.5, 0.66, 0.76, 0.87, 0.94];
  spots.forEach((sp, i) => {
    const cx = w * sp;
    const r = w * (i % 3 === 1 ? 0.05 : 0.032);
    const domeY = baseY;
    // قبة
    ctx.beginPath();
    ctx.arc(cx, domeY, r, Math.PI, 0);
    ctx.fill();
    // قاعدة القبة
    ctx.fillRect(cx - r, domeY, r * 2, r * 0.4);
    if (i % 3 === 1) {
      // مئذنة بجانب القبة الكبيرة
      const mh = h * 0.07;
      const mw = w * 0.012;
      ctx.fillRect(cx - r - mw * 1.6, domeY - mh, mw, mh);
      ctx.beginPath();
      ctx.arc(cx - r - mw * 1.1, domeY - mh, mw, Math.PI, 0);
      ctx.fill();
    }
  });
  // خيط أفق ذهبي خافت
  ctx.strokeStyle = withAlpha(GOLD, 0.22);
  ctx.lineWidth = Math.max(1, h * 0.0015);
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  ctx.lineTo(w, baseY);
  ctx.stroke();
}

// ── الجسيمات الذهبية الطائرة ────────────────────────────────────────────

export function paintParticles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const n = 26;
  for (let i = 0; i < n; i++) {
    const speed = 6 + hash01(i, 1) * 18;
    const drift = Math.sin(t * (0.3 + hash01(i, 2)) + i) * w * 0.02;
    const x = (hash01(i, 3) * w + drift + w) % w;
    const y = (h - ((t * speed + hash01(i, 4) * h * 2) % (h * 1.15)) + h) % h;
    const r = (0.7 + hash01(i, 5) * 1.8) * (Math.min(w, h) / 720);
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (1.2 + hash01(i, 6)) + i));
    ctx.fillStyle = `rgba(230, 199, 90, ${0.5 * tw})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (r > 1.6) {
      ctx.fillStyle = `rgba(230, 199, 90, ${0.12 * tw})`;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── الفاصل الزخرفي ──────────────────────────────────────────────────────

/** فاصل ذهبي: خط + معيّن مركزي + التفافات طرفية. */
export function paintDivider(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number): void {
  const half = w / 2;
  ctx.strokeStyle = withAlpha(GOLD, 0.75);
  ctx.lineWidth = Math.max(1, w * 0.008);
  ctx.beginPath();
  ctx.moveTo(cx - half, cy);
  ctx.lineTo(cx - w * 0.09, cy);
  ctx.moveTo(cx + w * 0.09, cy);
  ctx.lineTo(cx + half, cy);
  ctx.stroke();
  // المعيّن المركزي (معطّر 45°) + إطار رقيق
  const dw = w * 0.045;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = GOLD_SOFT;
  ctx.fillRect(-dw / 2, -dw / 2, dw, dw);
  ctx.strokeStyle = withAlpha(GOLD_DEEP, 0.8);
  ctx.lineWidth = 1;
  ctx.strokeRect(-dw * 0.85, -dw * 0.85, dw * 1.7, dw * 1.7);
  ctx.restore();
  // التفافات طرفية
  for (const dir of [-1, 1]) {
    const ex = cx + dir * half;
    ctx.strokeStyle = withAlpha(GOLD, 0.6);
    ctx.beginPath();
    ctx.moveTo(ex, cy);
    ctx.quadraticCurveTo(ex + dir * w * 0.03, cy - w * 0.028, ex + dir * w * 0.055, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex, cy);
    ctx.quadraticCurveTo(ex + dir * w * 0.03, cy + w * 0.028, ex + dir * w * 0.055, cy);
    ctx.stroke();
  }
}
