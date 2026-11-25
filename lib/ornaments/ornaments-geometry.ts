/**
 * Islamic ornament catalogs + pure geometry builders (star polygons, Rub el
 * Hizb, Mihrab arches, cartouches). Split from lib/islamic-ornaments.ts per
 * the 600-line file rule; re-exported there for backward compatibility.
 */
import type {
  IslamicAyahMedallionStyle,
  Point2D,
  IslamicCornerStyle,
  IslamicFrameStyle,
  IslamicPatternStyle,
  OrnamentColorPreset,
  OrnamentInputState,
  OrnamentOptionMeta,
  ResolvedOrnamentConfig,
  SurahBannerStyle,
} from './ornaments-types';

export const ISLAMIC_FRAME_OPTIONS: OrnamentOptionMeta<IslamicFrameStyle>[] = [
  { id: 'none', name: 'بدون إطار', subtitle: 'مساحة حرة بدون حدود' },
  { id: 'mushaf', name: 'مصحف ملكي', subtitle: 'إطار ثلاثي مذهّب ومداليات جانبية', era: 'تذهيب المصاحف' },
  { id: 'mihrab', name: 'محراب نبوي', subtitle: 'قوس محراب مدبّب وتاج علوي', era: 'عمارة الحرمين' },
  { id: 'andalus', name: 'أندلسي متشابك', subtitle: 'شريط هندسي أندلسي بنقش الحمراء', era: 'غرناطة والأندلس' },
  { id: 'ottoman', name: 'سلطاني عثماني', subtitle: 'حدود مزدوجة وتاج تذهيب علوي وسفلي', era: 'التذهيب العثماني' },
  { id: 'classic', name: 'كلاسيكي ذهبي', subtitle: 'إطار مزدوج رفيع ونقي', era: 'تقليدي' },
];

export const ISLAMIC_PATTERN_OPTIONS: OrnamentOptionMeta<IslamicPatternStyle>[] = [
  { id: 'none', name: 'بدون نقش', subtitle: 'خلفية صافية' },
  { id: 'khatam8', name: 'خاتم ثماني', subtitle: 'نجمة ربع الحزب الثمانية المتشابكة' },
  { id: 'girih12', name: 'جريه مملوكي', subtitle: 'وردة هندسية ذات ١٢ شعاعاً' },
  { id: 'arabesque', name: 'مشربية وقوس', subtitle: 'أقواس إسلامية مدبّبة متكررة' },
  { id: 'hexgrid', name: 'سداسي قدسي', subtitle: 'نجمة سداسية مترابطة كقبة الصخرة' },
];

export const ISLAMIC_CORNER_OPTIONS: OrnamentOptionMeta<IslamicCornerStyle>[] = [
  { id: 'none', name: 'بدون زوايا', subtitle: 'إخفاء زخارف الزوايا' },
  { id: 'rub_el_hizb', name: 'ربع الحزب ۞', subtitle: 'مربعان متداخلان بزاوية ٤٥°' },
  { id: 'shamsa', name: 'شمسة مذهّبة', subtitle: 'وردة شمسية إسلامية بـ ١٢ بتلة' },
  { id: 'floral_corner', name: 'طُرَّة ركنية', subtitle: 'زخرفة ركنية مملوكية متدرّجة' },
  { id: 'crescent_star', name: 'هلال ونجمة', subtitle: 'هلال أندلسي مع نجمة ثمانية' },
];

export const SURAH_BANNER_OPTIONS: OrnamentOptionMeta<SurahBannerStyle>[] = [
  { id: 'cartouche', name: 'شريط مصحفي', subtitle: 'خرطوشة سورة مذهّبة بأطراف مفصّصة' },
  { id: 'mihrab_crest', name: 'تاج محرابي', subtitle: 'قوس علوي مزخرف فوق اسم السورة' },
  { id: 'classic', name: 'كلاسيكي', subtitle: 'خطوط ذهبية ومعيّنات جانبية' },
  { id: 'minimal', name: 'بسيط نقي', subtitle: 'اسم السورة فقط بخط واضح' },
];

export const AYAH_MEDALLION_OPTIONS: OrnamentOptionMeta<IslamicAyahMedallionStyle>[] = [
  { id: 'rosette', name: 'وردة مصحفية', subtitle: 'إكليل مسنّن بـ ١٢ بتلة' },
  { id: 'rub_el_hizb', name: 'ربع الحزب ۞', subtitle: 'نجمة ثمانية متشابكة' },
  { id: 'shamsa', name: 'شمسة ملكية', subtitle: 'هالة مضاعفة بـ ١٦ شعاعاً' },
  { id: 'ornate', name: 'زخرفة مزهرة', subtitle: 'دائرة مزدوجة ببتلات أربع' },
  { id: 'minimal', name: 'حلقة هادئة', subtitle: 'إطار دائري رفيع بسيط' },
];

export const ORNAMENT_COLOR_PRESETS: OrnamentColorPreset[] = [
  { id: 'royal-gold', name: 'ذهب ملكي', hex: '#D4AF37', secondaryHex: '#F3DC87' },
  { id: 'antique-gold', name: 'ذهب عتيق', hex: '#B88A1E', secondaryHex: '#E5C36A' },
  { id: 'luminous-gold', name: 'ذهب مضيء', hex: '#F2D675', secondaryHex: '#FFF1B8' },
  { id: 'pearl-silver', name: 'فضة لؤلؤية', hex: '#CBD5E1', secondaryHex: '#F8FAFC' },
  { id: 'emerald-ink', name: 'زمردي تراثي', hex: '#1F7A5B', secondaryHex: '#63C29F' },
  { id: 'warm-copper', name: 'نحاس أندلسي', hex: '#C98552', secondaryHex: '#ECC19C' },
];

export const DEFAULT_ORNAMENT_COLOR = '#D4AF37';

/**
 * Pure helper to safely normalize ornament settings while keeping backwards
 * compatibility with older StudioState objects that only had `goldFrame` & `corners`.
 */
export function resolveOrnamentConfig(input: OrnamentInputState): ResolvedOrnamentConfig {
  const frameStyle: IslamicFrameStyle = input.frameStyle
    ? input.frameStyle
    : input.goldFrame === false
      ? 'none'
      : 'mushaf';

  const cornerStyle: IslamicCornerStyle = input.cornerStyle
    ? input.cornerStyle
    : input.corners === false
      ? 'none'
      : 'rub_el_hizb';

  const patternStyle: IslamicPatternStyle = input.patternStyle ?? 'none';

  const rawOpacity = typeof input.patternOpacity === 'number' && Number.isFinite(input.patternOpacity)
    ? input.patternOpacity
    : 0.14;
  const patternOpacity = Math.max(0, Math.min(0.45, rawOpacity));

  const surahBannerStyle: SurahBannerStyle = input.surahBannerStyle ?? 'cartouche';
  const ayahNumberStyle: IslamicAyahMedallionStyle = input.ayahNumberStyle ?? 'rosette';

  const colorCandidate = (input.ornamentColor || '').trim();
  const ornamentColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(colorCandidate)
    ? colorCandidate
    : DEFAULT_ORNAMENT_COLOR;

  return {
    frameStyle,
    cornerStyle,
    patternStyle,
    patternOpacity,
    surahBannerStyle,
    ayahNumberStyle,
    ornamentColor,
  };
}

/**
 * Parse a 3- or 6-digit hex string into an rgba() color string.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const clean = hex.replace('#', '').trim();
  let r = 212;
  let g = 175;
  let b = 55;
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  } else {
    return `rgba(212, 175, 55, ${safeAlpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

/**
 * Generate alternating outer/inner vertices of an n-pointed Islamic star polygon.
 * Returns exactly `points * 2` vertices.
 */
export function buildStarPolygonPoints(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  points: number,
  rotationOffset = -Math.PI / 2,
): Point2D[] {
  const count = Math.max(3, Math.floor(points));
  const vertices: Point2D[] = [];
  const total = count * 2;
  for (let i = 0; i < total; i++) {
    const angle = rotationOffset + (i * Math.PI) / count;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    vertices.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    });
  }
  return vertices;
}

/**
 * Generate the two overlapping squares of the authentic Rub el Hizb (۞) symbol:
 * squareA rotated at 0° (axis-aligned) and squareB rotated at 45°.
 */
export function buildRubElHizbSquares(
  cx: number,
  cy: number,
  radius: number,
): { squareA: Point2D[]; squareB: Point2D[] } {
  const makeSquare = (offsetRad: number): Point2D[] => {
    const pts: Point2D[] = [];
    for (let i = 0; i < 4; i++) {
      const a = offsetRad + (i * Math.PI) / 2;
      pts.push({
        x: cx + Math.cos(a) * radius,
        y: cy + Math.sin(a) * radius,
      });
    }
    return pts;
  };
  return {
    squareA: makeSquare(Math.PI / 4),
    squareB: makeSquare(0),
  };
}

/**
 * Compute geometric anchor points for a pointed Islamic Mihrab arch frame
 * that adapts cleanly to both portrait (9:16), square (1:1), and landscape (16:9).
 */
export interface MihrabArchGeometry {
  left: number;
  right: number;
  top: number;
  bottom: number;
  springY: number;
  apexX: number;
  apexY: number;
  innerInset: number;
}

export function buildMihrabArchGeometry(
  width: number,
  height: number,
  margin: number,
): MihrabArchGeometry {
  const left = margin;
  const right = width - margin;
  const top = margin;
  const bottom = height - margin;
  const innerWidth = Math.max(100, right - left);
  const innerHeight = Math.max(100, bottom - top);
  const archDrop = Math.min(innerHeight * 0.24, innerWidth * 0.32);
  return {
    left,
    right,
    top,
    bottom,
    springY: top + archDrop,
    apexX: width / 2,
    apexY: top + Math.max(6, margin * 0.14),
    innerInset: Math.max(8, Math.round(Math.min(width, height) * 0.013)),
  };
}

/**
 * Compute responsive Mushaf Surah Cartouche bounding geometry around measured text width.
 */
export interface CartoucheBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  lobeRadius: number;
}

export function buildCartoucheBounds(
  centerX: number,
  centerY: number,
  textWidth: number,
  fontSize: number,
  maxWidth: number,
): CartoucheBounds {
  const padX = Math.max(fontSize * 1.4, 42);
  const targetWidth = Math.min(maxWidth, Math.max(textWidth + padX * 2, fontSize * 6.5));
  const height = Math.max(fontSize * 1.95, 44);
  const lobeRadius = height * 0.42;
  return {
    left: centerX - targetWidth / 2,
    right: centerX + targetWidth / 2,
    top: centerY - height / 2,
    bottom: centerY + height / 2,
    width: targetWidth,
    height,
    lobeRadius,
  };
}

/**
 * Filter templates by category key ('all' returns all).
 */
export function filterTemplatesByCategory<T extends { category: string }>(
  templates: readonly T[],
  category: string,
): T[] {
  if (!category || category === 'all') return [...templates];
  return templates.filter((t) => t.category === category);
}

/* ============================================================================
 * CANVAS 2D RENDERING ENGINE FOR ISLAMIC PATTERNS, FRAMES, CORNERS & BANNERS
 * ========================================================================== */

