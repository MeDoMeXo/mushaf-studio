import { isLightColor, resolveCanvasFontFamily } from './studio-renderer-shared';
import { STUDIO_GRADIENTS, type ColorLutId, type LabelPosition, type StudioState } from './quran-data';
import type { SlideTransitionType } from './video-export';
import {
  getTranslationDirection,
  resolveTranslationOption,
  stripHtmlTags,
  toArabicDigits,
  wrapWordsToLines,
} from './quran-utils';
import {
  drawIslamicAyahMedallionV2,
  drawIslamicCornerOrnaments,
  drawIslamicFrameLayer,
  drawIslamicPatternLayer,
  drawSurahTitleBanner,
  hexToRgba,
  resolveOrnamentConfig,
} from './islamic-ornaments';



export interface RenderFramePayload {
  state: StudioState;
  verseText: string;
  translationText: string;
  surahName: string;
  ayahLabel: string;
  ayahNumber?: number | string;
  reciterName: string;
  bgImageEl: HTMLImageElement | null;
  bgVideoEl?: HTMLVideoElement | null;
  timeSec?: number;
  fadeAlpha?: number;
  transitionType?: SlideTransitionType;
  transitionProgress?: number;
  activeVerseIndex?: number;
  totalVerses?: number;
  preRenderedBackdrop?: HTMLCanvasElement | null;
  transparentBackdrop?: boolean;
  overlayOnly?: boolean;
}

/**
 * Pre-renders all verse-invariant backdrop layers (background fill/image/blur,
 * color LUT, static ambient layer, overlay, vignette, gold frame, corner rosettes,
 * and watermark) once onto an offscreen canvas for 5–10x faster 200+ slide exports.
 */
export function renderStaticBackdropCanvas(
  state: StudioState,
  bgImageEl: HTMLImageElement | null
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = state.width;
  cv.height = state.height;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  drawBackdropLayers(ctx, state, bgImageEl, null, 0, false);
  if (!state.coverMode) drawWatermarkLayer(ctx, state);
  return cv;
}

/**
 * Pre-renders the complete stationary background frame (fill/image, ornaments,
 * gold frame, watermark, and surah title/reciter banner) for video export.
 * This stationary backdrop stays completely stable during all slide transitions.
 */
export function renderExportBackdropCanvas(
  state: StudioState,
  bgImageEl: HTMLImageElement | null,
  surahName: string,
  reciterName: string
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = state.width;
  cv.height = state.height;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  drawBackdropLayers(ctx, state, bgImageEl, null, 0, false);
  drawMetadataLabels(ctx, state, surahName, '', reciterName);
  drawWatermarkLayer(ctx, state);
  return cv;
}

/**
 * Pre-renders the semi-transparent overlay layers (color LUT, darkening overlay,
 * vignette, gold frame, corner rosettes, and watermark) onto a transparent canvas
 * for FFmpeg video-background compositing.
 */
export function renderTransparentOverlayBackdropCanvas(
  state: StudioState
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = state.width;
  cv.height = state.height;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, state.width, state.height);
  drawBackdropLayers(ctx, state, null, null, 0, true);
  if (!state.coverMode) drawWatermarkLayer(ctx, state);
  return cv;
}

/**
 * Renders the animated ambient effect (stars / gold-dust / aurora) as a series of
 * transparent PNG frame Blobs for video export. Each frame uses the exact same
 * drawAmbientEffect() math as the live preview, sampled at evenly spaced times
 * so FFmpeg can loop the sequence (-stream_loop -1) and the exported background
 * animates exactly like the preview instead of freezing at timeSec=0.
 */
export async function renderAmbientFrames(
  effect: StudioState['ambient'],
  frameCount: number,
  fps: number,
  frameWidth: number,
  frameHeight: number
): Promise<Blob[]> {
  if (typeof document === 'undefined' || effect === 'none') return [];
  const cv = document.createElement('canvas');
  cv.width = frameWidth;
  cv.height = frameHeight;
  const ctx = cv.getContext('2d');
  if (!ctx) return [];

  const blobs: Blob[] = [];
  const loopSec = frameCount / Math.max(1, fps);
  for (let i = 0; i < frameCount; i++) {
    // Sample time inside ONE seamless loop period; the sequence repeats forever.
    const timeSec = (i / frameCount) * loopSec;
    ctx.clearRect(0, 0, frameWidth, frameHeight);
    drawAmbientEffect(ctx, effect, frameWidth, frameHeight, timeSec);
    const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'));
    if (blob) blobs.push(blob);
    if ((i + 1) % 16 === 0) {
      // Yield to the event loop so the export modal stays responsive on 96 frames
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }
  return blobs;
}

function drawBackdropLayers(
  ctx: CanvasRenderingContext2D,
  state: StudioState,
  bgImageEl: HTMLImageElement | null,
  bgVideoEl: HTMLVideoElement | null,
  timeSec: number,
  transparentBackdrop: boolean
): void {
  const w = state.width;
  const h = state.height;

  // 1) Background fill (skipped when rendering transparent overlay PNGs for FFmpeg video bg)
  if (!transparentBackdrop) {
    ctx.save();
    if (state.bgBlur > 0) {
      const scaledBlur = Math.round(state.bgBlur * (Math.min(w, h) / 1080));
      if (scaledBlur > 0) ctx.filter = `blur(${scaledBlur}px)`;
    }
    if (state.bgType === 'solid') {
      ctx.fillStyle = state.bgColor;
      ctx.fillRect(-30, -30, w + 60, h + 60);
    } else if (
      state.bgType === 'video' &&
      bgVideoEl &&
      bgVideoEl.readyState >= 2 &&
      bgVideoEl.videoWidth > 0
    ) {
      drawCoverMedia(
        ctx,
        bgVideoEl,
        bgVideoEl.videoWidth,
        bgVideoEl.videoHeight,
        w,
        h,
        state.bgBlur > 0 ? 1.06 : 1
      );
    } else if (state.bgType === 'image' && bgImageEl) {
      drawCoverMedia(
        ctx,
        bgImageEl,
        bgImageEl.width,
        bgImageEl.height,
        w,
        h,
        state.bgBlur > 0 ? 1.06 : 1
      );
    } else {
      const preset = STUDIO_GRADIENTS[state.bgIdx] ?? STUDIO_GRADIENTS[0];
      ctx.fillStyle = buildLinearGradient(ctx, preset.angle, preset.stops, w, h);
      ctx.fillRect(-30, -30, w + 60, h + 60);
    }
    ctx.restore();
  }

  // 1b) Cinematic Color Grading LUT overlay
  if (state.colorLut && state.colorLut !== 'none') {
    drawColorLutOverlay(ctx, state.colorLut, w, h);
  }

  const ornaments = resolveOrnamentConfig(state);

  // 1c) Authentic Islamic Geometric Background Pattern (drawn softly before vignette)
  if (!transparentBackdrop && ornaments.patternStyle !== 'none' && ornaments.patternOpacity > 0) {
    drawIslamicPatternLayer(
      ctx,
      w,
      h,
      ornaments.patternStyle,
      ornaments.ornamentColor,
      ornaments.patternOpacity
    );
  }

  // 2) Ambient animated layer
  if (state.ambient !== 'none') {
    drawAmbientEffect(ctx, state.ambient, w, h, timeSec);
  }

  // 3) Darkening overlay
  if (state.overlay > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${state.overlay})`;
    ctx.fillRect(0, 0, w, h);
  }

  // 4) Soft vignette
  if (state.vignette > 0) {
    const grad = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.28,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.78
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, state.vignette)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // 5) Authentic Islamic Frame (Mushaf, Mihrab, Andalus, Ottoman, Classic)
  if (ornaments.frameStyle !== 'none') {
    drawIslamicFrameLayer(ctx, w, h, ornaments.frameStyle, ornaments.ornamentColor);
  }

  // 6) Authentic Islamic Corner Illuminations (Rub el Hizb, Shamsa, Turrah, Crescent)
  if (ornaments.cornerStyle !== 'none') {
    drawIslamicCornerOrnaments(ctx, w, h, ornaments.cornerStyle, ornaments.ornamentColor);
  }
}

function drawWatermarkLayer(ctx: CanvasRenderingContext2D, state: StudioState): void {
  if (!state.watermark.trim()) return;
  const w = state.width;
  const h = state.height;
  const minSide = Math.min(w, h);
  const ornaments = resolveOrnamentConfig(state);
  const hasFrame = ornaments.frameStyle !== 'none';
  const hasCorners = ornaments.cornerStyle !== 'none';
  const frameInsetY = hasFrame ? Math.round(minSide * 0.04) + 34 : Math.round(minSide * 0.045);
  const frameInsetX = hasCorners
    ? Math.max(frameInsetY, Math.round(minSide * 0.135))
    : frameInsetY;
  const wmSize = Math.max(15, Math.round(minSide * 0.018));
  ctx.font = `600 ${wmSize}px ${resolveCanvasFontFamily('Cairo')}`;
  ctx.fillStyle =
    isLightColor(state.textColor)
      ? 'rgba(250, 247, 240, 0.48)'
      : 'rgba(11, 61, 46, 0.45)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.direction = 'ltr';
  ctx.fillText(state.watermark.trim(), frameInsetX, h - frameInsetY);
}

interface StarParticle {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
}

const STAR_SEED: StarParticle[] = Array.from({ length: 68 }, (_, i) => {
  const hash = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  };
  return {
    x: hash(i + 1),
    y: hash(i + 101),
    r: 0.9 + hash(i + 201) * 2.2,
    speed: 0.4 + hash(i + 301) * 1.4,
    phase: hash(i + 401) * Math.PI * 2,
  };
});

export function drawStudioFrame(
  ctx: CanvasRenderingContext2D,
  payload: RenderFramePayload
): void {
  const {
    state,
    verseText,
    translationText,
    surahName,
    ayahLabel,
    ayahNumber,
    reciterName,
    bgImageEl,
    bgVideoEl = null,
    timeSec = 0,
    fadeAlpha = 1,
    activeVerseIndex = 0,
    totalVerses = 1,
    preRenderedBackdrop = null,
    transparentBackdrop = false,
  } = payload;

  const w = state.width;
  const h = state.height;

  const resolvedAyahNum =
    ayahNumber !== undefined && ayahNumber !== null && String(ayahNumber).trim() !== ''
      ? String(ayahNumber).replace(/[^\d]/g, '') || ayahLabel.replace(/[^\d]/g, '')
      : ayahLabel.replace(/[^\d]/g, '');

  if (payload.overlayOnly) {
    ctx.clearRect(0, 0, w, h);
    if (state.coverMode) {
      drawUnifiedCoverTypography(ctx, state, surahName, reciterName);
    } else {
      drawMainText(ctx, state, verseText, stripHtmlTags(translationText), resolvedAyahNum);
      if (state.showProgressDots && totalVerses > 1 && totalVerses <= 24) {
        drawProgressDots(ctx, state, activeVerseIndex, totalVerses);
      }
    }
    return;
  }

  ctx.save();
  if (preRenderedBackdrop) {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(preRenderedBackdrop, 0, 0, w, h);
  } else {
    ctx.clearRect(0, 0, w, h);
    drawBackdropLayers(ctx, state, bgImageEl, bgVideoEl, timeSec, transparentBackdrop);
  }

  if (state.coverMode) {
    // Unified Channel Cover Mode: Surah Title + Reciter + Admin Channel Watermark
    drawUnifiedCoverTypography(ctx, state, surahName, reciterName);
  } else {
    // 7) Main Quranic / translation text + Islamic Ayah Medallion
    ctx.save();
    const progress = Math.max(0, Math.min(1, payload.transitionProgress ?? fadeAlpha));
    const transType = payload.transitionType ?? 'fade';

    if (transType === 'slideup' && progress < 1) {
      const slideOffsetY = (1 - progress) * (h * 0.035);
      ctx.translate(0, slideOffsetY);
    } else if ((transType === 'zoomin' || transType === 'zoom') && progress < 1) {
      const scale = 0.94 + 0.06 * progress;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
    } else if (transType === 'fadeblack' && progress < 1) {
      ctx.globalAlpha = Math.max(0, Math.min(1, Math.pow(progress, 1.4)));
    }

    ctx.globalAlpha = Math.max(0, Math.min(1, fadeAlpha));
    drawMainText(ctx, state, verseText, stripHtmlTags(translationText), resolvedAyahNum);
    ctx.restore();

    // 8) Independent Surah & Ayah Label + Reciter Name Label
    drawMetadataLabels(ctx, state, surahName, ayahLabel, reciterName);

    // 8b) Optional Slide Progress Dots (bottom center)
    if (state.showProgressDots && totalVerses > 1 && totalVerses <= 24) {
      drawProgressDots(ctx, state, activeVerseIndex, totalVerses);
    }

    // 9) Subtle Watermark (already included in preRenderedBackdrop when cached)
    if (!preRenderedBackdrop) {
      drawWatermarkLayer(ctx, state);
    }
  }

  ctx.restore();
}

function drawColorLutOverlay(
  ctx: CanvasRenderingContext2D,
  lut: ColorLutId,
  w: number,
  h: number
): void {
  ctx.save();
  if (lut === 'golden') {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgba(235, 162, 52, 0.24)');
    grad.addColorStop(0.55, 'rgba(196, 118, 32, 0.16)');
    grad.addColorStop(1, 'rgba(72, 38, 12, 0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (lut === 'cinema') {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgba(14, 96, 114, 0.26)');
    grad.addColorStop(0.5, 'rgba(18, 38, 52, 0.12)');
    grad.addColorStop(1, 'rgba(208, 118, 48, 0.24)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (lut === 'emerald') {
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.35, w * 0.08, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
    grad.addColorStop(0, 'rgba(22, 138, 98, 0.22)');
    grad.addColorStop(1, 'rgba(4, 38, 28, 0.32)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (lut === 'sepia') {
    ctx.fillStyle = 'rgba(146, 108, 62, 0.26)';
    ctx.fillRect(0, 0, w, h);
  } else if (lut === 'midnight') {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(18, 52, 124, 0.28)');
    grad.addColorStop(1, 'rgba(8, 16, 42, 0.30)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

function drawCoverMedia(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  mediaW: number,
  mediaH: number,
  w: number,
  h: number,
  overscan = 1
): void {
  if (!mediaW || !mediaH) return;
  const ratio = Math.max(w / mediaW, h / mediaH) * overscan;
  const nw = mediaW * ratio;
  const nh = mediaH * ratio;
  ctx.drawImage(media, (w - nw) / 2, (h - nh) / 2, nw, nh);
}

function buildLinearGradient(
  ctx: CanvasRenderingContext2D,
  angleDeg: number,
  stops: [number, string][],
  w: number,
  h: number
): CanvasGradient {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const length = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = w / 2;
  const cy = h / 2;
  const grad = ctx.createLinearGradient(
    cx - (dx * length) / 2,
    cy - (dy * length) / 2,
    cx + (dx * length) / 2,
    cy + (dy * length) / 2
  );
  for (const [pct, color] of stops) {
    grad.addColorStop(pct / 100, color);
  }
  return grad;
}

function drawAmbientEffect(
  ctx: CanvasRenderingContext2D,
  effect: StudioState['ambient'],
  w: number,
  h: number,
  timeSec: number
): void {
  ctx.save();
  if (effect === 'stars' || effect === 'gold-dust') {
    const isGold = effect === 'gold-dust';
    for (const star of STAR_SEED) {
      const driftY = isGold ? (star.y - timeSec * 0.015 * star.speed + 10) % 1 : star.y;
      const driftX = isGold
        ? (star.x + Math.sin(timeSec * 0.5 + star.phase) * 0.012 + 1) % 1
        : star.x;
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(timeSec * star.speed * 1.8 + star.phase));
      const radius = star.r * (Math.min(w, h) / 1080) * (isGold ? 1.5 : 1.15);
      ctx.beginPath();
      ctx.arc(driftX * w, driftY * h, radius, 0, Math.PI * 2);
      ctx.fillStyle = isGold
        ? `rgba(230, 199, 90, ${twinkle * 0.55})`
        : `rgba(245, 248, 255, ${twinkle * 0.72})`;
      ctx.fill();
    }
  } else if (effect === 'aurora') {
    const wave = Math.sin(timeSec * 0.6) * w * 0.08;
    const rad = ctx.createRadialGradient(
      w * 0.5 + wave,
      h * 0.25,
      w * 0.05,
      w * 0.5,
      h * 0.3,
      w * 0.75
    );
    rad.addColorStop(0, 'rgba(68, 178, 152, 0.22)');
    rad.addColorStop(0.5, 'rgba(201, 162, 39, 0.09)');
    rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}


export { drawMainText, resolveLabelCoords } from './studio-text-renderer';
import { drawUnifiedCoverTypography } from './cover-canvas-renderer';
import {
  drawMainText,
  drawMetadataLabels,
  drawProgressDots,
} from './studio-text-renderer';
