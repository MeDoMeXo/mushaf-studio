/**
 * Expanded ambient motion effects (fireflies / petals / bokeh / rain / snow)
 * for the studio canvas renderer. Extracted from studio-renderer.ts per the
 * 600-line rule. Each draw function is pure canvas math using the same
 * deterministic-seed style as STAR_SEED so the export's frame renderer
 * (renderAmbientFrames) produces pixel-identical loops to the live preview.
 */

interface AmbientParticle {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
}

function hashNoise(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function buildSeeds(count: number, salt: number): AmbientParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    x: hashNoise(i + 1 + salt),
    y: hashNoise(i + 101 + salt),
    r: 0.9 + hashNoise(i + 201 + salt) * 2.2,
    speed: 0.4 + hashNoise(i + 301 + salt) * 1.4,
    phase: hashNoise(i + 401 + salt) * Math.PI * 2,
  }));
}

const FIREFLY_SEED = buildSeeds(46, 900);
const PETAL_SEED = buildSeeds(26, 4000);
const BOKEH_SEED = buildSeeds(16, 7000);
const RAIN_SEED = buildSeeds(72, 11000);
const SNOW_SEED = buildSeeds(60, 15000);

/** Fireflies: green-gold glowing dots wandering on lissajous paths, pulsing. */
export function drawFireflies(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number
): void {
  const scale = Math.min(w, h) / 1080;
  for (const p of FIREFLY_SEED) {
    const x = (p.x + Math.sin(timeSec * 0.35 * p.speed + p.phase) * 0.06 + 1) % 1;
    const y = (p.y + Math.cos(timeSec * 0.28 * p.speed + p.phase * 1.7) * 0.05 + 1) % 1;
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 2.2 * p.speed + p.phase);
    const radius = p.r * scale * 1.6;
    const glow = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, radius * 3.2);
    glow.addColorStop(0, `rgba(214, 255, 170, ${0.5 * pulse + 0.1})`);
    glow.addColorStop(0.4, `rgba(160, 220, 110, ${0.28 * pulse})`);
    glow.addColorStop(1, 'rgba(120, 200, 90, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x * w, y * h, radius * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Petals: soft pink/white petals falling with rotation and lateral sway. */
export function drawPetals(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number
): void {
  const scale = Math.min(w, h) / 1080;
  const palette = ['rgba(244, 194, 194, 0.85)', 'rgba(249, 217, 226, 0.8)', 'rgba(255, 236, 240, 0.75)'];
  for (let i = 0; i < PETAL_SEED.length; i++) {
    const p = PETAL_SEED[i];
    const fall = 0.03 * p.speed;
    const y = (p.y + timeSec * fall) % 1;
    const x = (p.x + Math.sin(timeSec * 0.6 * p.speed + p.phase) * 0.03 + 1) % 1;
    const rot = timeSec * (0.8 + p.speed * 0.6) + p.phase;
    const size = (7 + p.r * 5) * scale;
    ctx.save();
    ctx.translate(x * w, y * h);
    ctx.rotate(rot);
    ctx.fillStyle = palette[i % palette.length];
    ctx.beginPath();
    // petal = two mirrored quadratic curves forming a leaf shape
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(size * 0.9, 0, 0, size);
    ctx.quadraticCurveTo(-size * 0.9, 0, 0, -size);
    ctx.fill();
    ctx.restore();
  }
}

/** Bokeh: soft large light discs of varying sizes, slowly rising and breathing. */
export function drawBokeh(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number
): void {
  const scale = Math.min(w, h) / 1080;
  const palette = ['rgba(255, 236, 180, 0.16)', 'rgba(230, 199, 90, 0.13)', 'rgba(180, 215, 255, 0.12)'];
  for (let i = 0; i < BOKEH_SEED.length; i++) {
    const p = BOKEH_SEED[i];
    const y = (p.y - timeSec * 0.012 * p.speed + 1) % 1;
    const x = (p.x + Math.sin(timeSec * 0.25 + p.phase) * 0.015 + 1) % 1;
    const breathe = 0.75 + 0.25 * Math.sin(timeSec * 0.9 * p.speed + p.phase);
    const radius = (18 + p.r * 22) * scale * breathe;
    const grad = ctx.createRadialGradient(x * w, y * h, radius * 0.55, x * w, y * h, radius);
    grad.addColorStop(0, palette[i % palette.length]);
    grad.addColorStop(0.85, palette[i % palette.length]);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x * w, y * h, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Rain: thin slanted streaks falling fast, with a subtle night shimmer. */
export function drawRain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number
): void {
  const scale = Math.min(w, h) / 1080;
  ctx.strokeStyle = 'rgba(190, 214, 240, 0.34)';
  ctx.lineWidth = Math.max(1, 1.3 * scale);
  const slant = 0.18; // dx per dy
  for (const p of RAIN_SEED) {
    const speed = 0.55 + p.speed * 0.45;
    const y = (p.y + timeSec * speed) % 1;
    const x = (p.x + y * slant) % 1;
    const len = (26 + p.r * 16) * scale;
    ctx.beginPath();
    ctx.moveTo(x * w, y * h);
    ctx.lineTo((x - (slant * len) / h) * w, y * h + len);
    ctx.stroke();
  }
}

/** Snow: white flakes of varied size drifting down with gentle sway. */
export function drawSnow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number
): void {
  const scale = Math.min(w, h) / 1080;
  for (const p of SNOW_SEED) {
    const speed = 0.02 + p.speed * 0.03;
    const y = (p.y + timeSec * speed) % 1;
    const x = (p.x + Math.sin(timeSec * 0.5 * p.speed + p.phase) * 0.02 + 1) % 1;
    const radius = p.r * scale * 1.5;
    const alpha = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(timeSec * p.speed + p.phase));
    ctx.beginPath();
    ctx.arc(x * w, y * h, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
    ctx.fill();
  }
}
