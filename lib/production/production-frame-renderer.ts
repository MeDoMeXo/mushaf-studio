/**
 * production-frame-renderer — راسم إطار «استوديو الإنتاج».
 *
 * يرسم المشهد المرجعي كاملاً على كانفيس: خلفية (إطار فيديو/صورة أو
 * تدرّج) + قوسان ذهبيان مؤطّران بالشباك + قناديل معلّقة مضيئة + أفق
 * مسجد (قباب ومآذن) + جسيمات ذهبية طائرة + عنوان السورة بخط كليغرافي +
 * اسم القارئ + فاصل زخرفي + الآية (كاليوكي بتلوين الكلمة الجارية، أو
 * سطر واحد، بموضع قابل للتحكم) + الترجمة + مقاطع النص + إطار ذهبي
 * وعلامة مائية.
 *
 * الرسم حتمي بالكامل بدلالة timeSec — إطار المعاينة عند t يساوي إطار
 * التصدير عند t، فما تراه هو ما يُصدَّر.
 */
import { resolveCanvasFontFamily } from '@/lib/studio-renderer-shared';
import { STUDIO_GRADIENTS } from '@/lib/quran-data';
import {
  paintArches,
  paintLanterns,
  paintSkyline,
  paintParticles,
  paintDivider,
} from './production-scene-ornaments';
import type { ProductionTextClip, ProductionVisuals } from './production-types';

export interface ProductionVerseInfo {
  /** نص الآية بالرسم العثماني. */
  text: string;
  /** رقم الآية داخل السورة. */
  ayahNumber: number;
  /** كلمات الآية (بعد التقطيع النطقي). */
  words: string[];
  /** نسبة تقدّم النطق داخل الآية 0..1 (للكاليوكي). */
  progressRatio: number;
}

export interface ProductionFramePayload {
  width: number;
  height: number;
  timeSec: number;
  totalSec: number;
  /** إطار الخلفية الحالي (فيديو/صورة) أو null للتدرّج. */
  bgCanvas: CanvasImageSource | null;
  visuals: ProductionVisuals;
  verse: ProductionVerseInfo | null;
  surahName: string;
  reciterName: string;
  /** نص الترجمة (إن فُعِل عرضها). */
  translationText: string | null;
  /** المقاطع النصية النشطة عند هذا الزمن. */
  activeTextClips: ProductionTextClip[];
}

// ── لوحة الألوان الثابتة ────────────────────────────────────────────────
const GOLD = '#d4af37';
const GOLD_SOFT = '#e6c75a';
const EMERALD_DEEP = '#062318';
const EMERALD_MID = '#0b3d2e';
const CREAM = '#faf7f0';

// ── أدوات هندسية صغيرة ─────────────────────────────────────────────────

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** تدرّج زمردي عميق افتراضي حين لا خلفية — أو تدرّج مختار N. */
function paintFallbackGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  gradientId: number | null
): void {
  const preset = gradientId !== null ? STUDIO_GRADIENTS[gradientId] : null;
  const angle = ((preset?.angle ?? 150) * Math.PI) / 180;
  const g = ctx.createLinearGradient(0, 0, Math.cos(angle) * w, Math.sin(angle) * h);
  if (preset) {
    for (const [pos, color] of preset.stops) g.addColorStop(Math.min(1, pos / 100), color);
  } else {
    g.addColorStop(0, '#04150f');
    g.addColorStop(0.45, EMERALD_MID);
    g.addColorStop(1, EMERALD_DEEP);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** رسم الخلفية بملء التغطية (cover) + طبقة تعتيم للقراءة. */
function paintBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bg: CanvasImageSource | null,
  gradientId: number | null
): void {
  if (bg) {
    const bw = 'videoWidth' in bg ? (bg as HTMLVideoElement).videoWidth : (bg as HTMLImageElement).naturalWidth;
    const bh = 'videoHeight' in bg ? (bg as HTMLVideoElement).videoHeight : (bg as HTMLImageElement).naturalHeight;
    if (bw > 0 && bh > 0) {
      const scale = Math.max(w / bw, h / bh);
      const dw = bw * scale;
      const dh = bh * scale;
      ctx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
      // طبقة زمردية شفافة تضمن قراءة النص فوق أي خلفية.
      ctx.fillStyle = 'rgba(6, 35, 24, 0.42)';
      ctx.fillRect(0, 0, w, h);
      return;
    }
  }
  paintFallbackGradient(ctx, w, h, gradientId);
}


// ── الرسم الرئيسي ──────────────────────────────────────────────────────

export function drawProductionFrame(
  ctx: CanvasRenderingContext2D,
  payload: ProductionFramePayload
): void {
  const { width: w, height: h, timeSec: t, visuals } = payload;
  const k = w / 1080; // معامل القياس على عرض 1080

  const gradientId = visuals.bgId.startsWith('gradient:')
    ? Number(visuals.bgId.split(':')[1]) || 0
    : null;
  paintBackground(ctx, w, h, payload.bgCanvas, gradientId);
  paintArches(ctx, w, h, t);
  paintLanterns(ctx, w, h, t);
  paintSkyline(ctx, w, h);
  paintParticles(ctx, w, h, t);

  // عنوان السورة + القارئ + الفاصل — القسم العلوي
  const quranStack = resolveCanvasFontFamily(visuals.fontFamily || 'Amiri Quran');
  const uiStack = resolveCanvasFontFamily('Cairo');
  let cursorY = h * 0.11;

  if (visuals.showSurahTitle) {
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    const titleSize = Math.max(22, 52 * k);
    ctx.font = `600 ${titleSize}px ${quranStack}`;
    // ظل ذهبي ناعم ثم نص ذهبي
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillText(payload.surahName, w / 2 + 2 * k, cursorY + 2 * k);
    const grad = ctx.createLinearGradient(w * 0.3, cursorY - titleSize, w * 0.7, cursorY);
    grad.addColorStop(0, GOLD_SOFT);
    grad.addColorStop(0.5, GOLD);
    grad.addColorStop(1, GOLD_SOFT);
    ctx.fillStyle = grad;
    ctx.fillText(payload.surahName, w / 2, cursorY);
    cursorY += titleSize * 1.15;

    if (visuals.showReciterName) {
      const recSize = Math.max(14, 26 * k);
      ctx.font = `500 ${recSize}px ${uiStack}`;
      ctx.fillStyle = withAlpha(CREAM, 0.92);
      ctx.fillText(payload.reciterName, w / 2, cursorY);
      cursorY += recSize * 1.3;
    }
    paintDivider(ctx, w / 2, cursorY, Math.min(w * 0.36, 380 * k));
    cursorY += 24 * k;
  }

  // ── الآية ────────────────────────────────────────────────────────────
  if (payload.verse) {
    const v = payload.verse;
    const baseSize = Math.max(18, visuals.fontSize * k);
    ctx.font = `400 ${baseSize}px ${quranStack}`;
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';

    // لفّ الكلمات أسطراً (أو سطر واحد مصغّر)
    let size = baseSize;
    let lines: string[][] = [];
    const maxW = w * 0.82;
    const words = v.words.length ? v.words : v.text.split(/\s+/).filter(Boolean);
    const wrap = (): string[][] => {
      const out: string[][] = [];
      let line: string[] = [];
      const space = ctx.measureText(' ').width;
      let width = 0;
      for (const word of words) {
        const ww = ctx.measureText(word).width;
        if (line.length && width + space + ww > maxW) {
          out.push(line);
          line = [];
          width = 0;
        }
        line.push(word);
        width += ww + (line.length > 1 ? space : 0);
      }
      if (line.length) out.push(line);
      return out;
    };
    lines = wrap();
    if (visuals.oneLine && lines.length > 1) {
      // ضغّط الحجم حتى تسع الأسطر في سطر واحد (حد أدنى 55% من الأساسي).
      while (size > baseSize * 0.5 && lines.length > 1) {
        size *= 0.9;
        ctx.font = `400 ${size}px ${quranStack}`;
        lines = wrap();
      }
    }
    const lineH = size * 1.75;
    const blockH = lines.length * lineH;

    // الموضع العمودي: versePosition (0 أعلى .. 1 أسفل) حول منطقة آمنة.
    const topArea = cursorY + h * 0.03;
    const bottomArea = h * 0.86;
    const usable = Math.max(lineH, bottomArea - topArea);
    let blockTop = topArea + (usable - blockH) * visuals.versePosition;
    blockTop = Math.max(topArea, Math.min(blockTop, bottomArea - blockH));

    // followAudio: نافذة عرض تسقط السطر الجاري وسط الشاشة بنعومة.
    let startLine = 0;
    if (visuals.followAudio && lines.length > 3) {
      const visible = Math.max(2, Math.floor((bottomArea - topArea) / lineH) - 1);
      let active = 0;
      if (payload.verse.progressRatio > 0) {
        let acc = 0;
        for (let li = 0; li < lines.length; li++) {
          acc += lines[li].length;
          if (payload.verse.progressRatio * words.length <= acc) {
            active = li;
            break;
          }
          active = li;
        }
      }
      startLine = Math.max(0, Math.min(Math.max(0, lines.length - visible), active - Math.floor(visible / 2)));
      const shown = lines.slice(startLine, startLine + visible);
      const shownH = shown.length * lineH;
      const shownTop = topArea + (usable - shownH) / 2;
      const total = lines.length;
      const scroll = total > visible
        ? (payload.verse.progressRatio * (total - visible)) * lineH
        : 0;
      blockTop = shownTop - scroll * 0.25; // نعومة
    }

    // رسم الأسطر كلمة كلمة (كاليوكي) أو نصاً صلباً
    ctx.textAlign = 'right';
    let wordIdx = 0;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const y = blockTop + li * lineH + lineH * 0.66;
      if (y < topArea - lineH || y > bottomArea + lineH) {
        wordIdx += line.length;
        continue;
      }
      const space = ctx.measureText(' ').width;
      const lineW = line.reduce((acc, word) => acc + ctx.measureText(word).width + space, 0) - space;
      let x = (w - lineW) / 2 + lineW; // مركز الأسطر مع محاذاة يمين داخلها
      for (const word of line) {
        const ww = ctx.measureText(word).width;
        const isActive =
          visuals.karaoke &&
          payload.verse.progressRatio > 0 &&
          wordIdx === Math.min(words.length - 1, Math.round(payload.verse.progressRatio * (words.length - 1)));
        // ظل ناعم خلف كل كلمة
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.fillText(word, x + 1.5 * k, y + 1.5 * k);
        ctx.fillStyle = isActive ? GOLD_SOFT : visuals.textColor || CREAM;
        ctx.fillText(word, x, y);
        x -= ww + space;
        wordIdx++;
      }
    }

    // ميدالية رقم الآية تحت النص
    const medY = Math.min(bottomArea, blockTop + blockH + size * 0.8);
    const mr = Math.max(12, size * 0.42);
    ctx.beginPath();
    ctx.arc(w / 2, medY, mr, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(GOLD, 0.85);
    ctx.lineWidth = Math.max(1.2, mr * 0.1);
    ctx.stroke();
    ctx.fillStyle = withAlpha(EMERALD_DEEP, 0.85);
    ctx.fill();
    ctx.font = `600 ${Math.max(10, mr * 0.95)}px ${uiStack}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD_SOFT;
    ctx.fillText(`﴿${v.ayahNumber}﴾`, w / 2, medY + mr * 0.35);
    cursorY = medY + mr + 16 * k;
  }

  // ── الترجمة ───────────────────────────────────────────────────────────
  if (visuals.showTranslation && payload.translationText) {
    const trSize = Math.max(12, 24 * k);
    ctx.font = `400 ${trSize}px ${uiStack}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = withAlpha(CREAM, 0.8);
    wrapLatin(
      ctx,
      payload.translationText,
      w * 0.8,
      Math.min(h - 30 * k, Math.max(cursorY, h * 0.9) - trSize),
      trSize
    );
  }

  // ── مقاطع النص النشطة (البسملة/عناوين/نصوص مخصصة) ───────────────────
  for (const clip of payload.activeTextClips) {
    const cs = Math.max(12, 30 * k * clip.scale);
    ctx.font = `500 ${cs}px ${clip.kind === 'basmala' || clip.kind === 'surah-title' ? quranStack : uiStack}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillText(clip.text, w / 2 + 1.5 * k, h * 0.955 + 1.5 * k);
    ctx.fillStyle = clip.color || GOLD_SOFT;
    ctx.fillText(clip.text, w / 2, h * 0.955);
  }

  // ── الإطار الذهبي والعلامة المائية ────────────────────────────────────
  if (visuals.goldFrame) {
    const inset = Math.min(w, h) * 0.02;
    ctx.strokeStyle = withAlpha(GOLD, 0.65);
    ctx.lineWidth = Math.max(2, 3 * k);
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
    ctx.strokeStyle = withAlpha(GOLD_SOFT, 0.35);
    ctx.lineWidth = Math.max(1, 1.5 * k);
    ctx.strokeRect(inset * 1.8, inset * 1.8, w - inset * 3.6, h - inset * 3.6);
    // معيّنات الزوايا
    const c = inset * 1.4;
    for (const [px, py, dx, dy] of [
      [c, c, 1, 1],
      [w - c, c, -1, 1],
      [c, h - c, 1, -1],
      [w - c, h - c, -1, -1],
    ]) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      const d = Math.max(4, 8 * k);
      ctx.fillStyle = GOLD;
      ctx.fillRect(-d / 2, -d / 2, d, d);
      ctx.restore();
    }
  }

  if (visuals.watermark) {
    const ws = Math.max(10, 18 * k);
    ctx.font = `500 ${ws}px ${uiStack}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = withAlpha(GOLD, 0.55);
    ctx.fillText(visuals.watermark, w / 2, h - Math.min(w, h) * 0.045);
  }
}

/** لفّ نص لاتيني (الترجمة) أسطراً وسط الشاشة عند y المحدد. */
function wrapLatin(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  y: number,
  fontSize: number
): void {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const lh = fontSize * 1.35;
  lines.slice(0, 3).forEach((l, i) => {
    ctx.fillText(l, ctx.canvas.width / 2, y + i * lh);
  });
}
