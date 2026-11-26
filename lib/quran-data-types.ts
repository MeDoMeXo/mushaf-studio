/**
 * Shared Quran/Studio type definitions. Split from lib/quran-data.ts per
 * the 600-line file rule; re-exported from there for compatibility.
 */
import type {
  IslamicAyahMedallionStyle,
  IslamicCornerStyle,
  IslamicFrameStyle,
  IslamicPatternStyle,
  SurahBannerStyle,
} from './islamic-ornaments';

export interface QulChapter {
  id: number;
  revelation_place: 'makkah' | 'madinah' | string;
  revelation_order: number;
  bismillah_pre: boolean;
  name_simple: string;
  name_complex?: string;
  name_arabic: string;
  verses_count: number;
  pages: [number, number];
  translated_name?: {
    language_name?: string;
    name: string;
  };
}

export interface QulTranslation {
  id: number;
  resource_id?: number;
  text: string;
  name?: string;
}

export interface QulVerse {
  id: number;
  verse_number?: number;
  verse_key: string;
  page_number?: number;
  text_uthmani: string;
  translations?: QulTranslation[];
}

export type ReciterStyle = 'murattal' | 'mujawwad' | 'warsh' | 'muallim';

export interface ReciterOption {
  slug: string;
  name: string;
  style: ReciterStyle;
  styleLabel: string;
  country?: string;
  bitrate: 32 | 40 | 48 | 64 | 128 | 192;
  source?: 'islamic' | 'everyayah' | 'mp3quran';
  everyayahFolder?: string;
  mp3quranServer?: string;
  mp3quranReadId?: number;
  popular?: boolean;
}

export interface TranslationOption {
  id: number;
  name: string;
  lang: string;
}

export interface GradientPreset {
  id: number;
  name: string;
  angle: number;
  stops: [number, string][];
}

export type AspectPresetId = '9:16' | '1:1' | '16:9' | 'custom';
export type AmbientEffect =
  | 'none'
  | 'stars'
  | 'gold-dust'
  | 'aurora'
  | 'fireflies'
  | 'petals'
  | 'bokeh'
  | 'rain'
  | 'snow';
export type TextSourceMode = 'uthmani' | 'translation' | 'both';
/** Verse text layout on the studio canvas: wrapped lines (default) or one auto-shrunk line. */
export type VerseLineMode = 'wrap' | 'single';
/** Shape of the recited-word highlight (karaoke) — the main text color is never replaced. */
export type WordHighlightStyle = 'block' | 'underline' | 'tint';
export type LabelPosition = 'top' | 'bottom' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'hidden';
export type ColorLutId = 'none' | 'golden' | 'cinema' | 'emerald' | 'sepia' | 'midnight';
export type AyahNumberStyle = IslamicAyahMedallionStyle;
export type StudioTemplateCategory = 'mushaf' | 'haramain' | 'andalus' | 'nature' | 'minimal';

export interface StudioState {
  surah: number;
  fromAyah: number;
  toAyah: number;
  textSource: TextSourceMode;
  translationId: number;
  reciter: string;
  bgType: 'gradient' | 'solid' | 'image' | 'video';
  bgIdx: number;
  bgColor: string;
  bgImage: string | null;
  /** Built-in library background id when bgType==='video' via the library grid. */
  bgLibraryId?: string | null;
  bgVideoSpeed: number;
  bgBlur: number;
  colorLut: ColorLutId;
  ambient: AmbientEffect;
  overlay: number;
  vignette: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: 300 | 400 | 500 | 600 | 700 | 800;
  metaFontWeight: 400 | 600 | 700;
  lineHeight: number;
  verticalOffset: number;
  /** خط الترجمة المستقل — يتحكم بمظهر نص الترجمة أسفل الآية (افتراضي Cairo). */
  translationFontFamily?: string;
  /** مسافة إضافية بين حروف الآية العربية (px، ‎-2..8) — تُطبّق على الرسم العثماني فقط. */
  letterSpacing?: number;
  /** فاصل صمت اختياري بين الآيات أثناء تشغيل المعاينة في الاستوديو (ثوانٍ، ‎0..5). */
  playbackGapSec?: number;
  /** معايرة يدوية لمزامنة تتبع الكلمات مع الصوت (مللي ثانية، ‎-1000..1000). */
  wordSyncOffsetMs?: number;
  textColor: string;
  align: 'center' | 'right' | 'left';
  shadow: boolean;
  glow: boolean;
  /** Verse layout: wrapped auto-fitted lines (default) or single-line pronunciation segments that follow the recitation. */
  verseLineMode?: VerseLineMode;
  /** Hide verse text entirely (audio + background + ornaments only) for voice-only videos. */
  hideVerses?: boolean;
  /** Word-level highlight following the recitation audio (karaoke tracking). */
  wordHighlight?: boolean;
  /** Highlight shape: background block / underline / tinted word color. */
  wordHighlightStyle?: WordHighlightStyle;
  /** Highlight color (main text color stays untouched). */
  wordHighlightColor?: string;
  /** Highlight opacity for the block/underline shapes (0.15–0.85). */
  wordHighlightOpacity?: number;
  goldFrame: boolean;
  corners: boolean;
  frameStyle: IslamicFrameStyle;
  cornerStyle: IslamicCornerStyle;
  patternStyle: IslamicPatternStyle;
  patternOpacity: number;
  surahBannerStyle: SurahBannerStyle;
  ornamentColor: string;
  activeTemplateId?: string;
  showAyahNumber: boolean;
  ayahNumberStyle: AyahNumberStyle;
  showFooter: boolean;
  showReciterFooter: boolean;
  surahPosition: LabelPosition;
  surahOffsetY: number;
  reciterPosition: LabelPosition;
  reciterOffsetY: number;
  showProgressDots: boolean;
  watermark: string;
  coverMode?: boolean;
  aspect: AspectPresetId;
  width: number;
  height: number;
}

export interface StudioTemplate {
  id: string;
  name: string;
  subtitle: string;
  category: StudioTemplateCategory;
  previewBg: string;
  previewTextColor: string;
  accentColor: string;
  frameStyle: IslamicFrameStyle;
  patternStyle: IslamicPatternStyle;
  patch: Partial<StudioState>;
}

export interface SavedCustomTemplate {
  id: string;
  name: string;
  createdAt: number;
  patch: Partial<StudioState>;
}

export interface SiteFooterLink {
  label: string;
  href: string;
}

export interface SiteFooterConfig {
  enabled: boolean;
  description: string;
  copyright: string;
  showQuickLinks: boolean;
  showCredits: boolean;
  customLinks: SiteFooterLink[];
}

export interface SiteConfig {
  siteName: string;
  tagline: string;
  heroTitle: string;
  badge: string;
  verseOfDay: { surah: number; ayah: number } | null;
  primaryColor: string;
  accentColor: string;
  defaultTheme: 'light' | 'dark';
  defaultTranslation: number;
  defaultReciter: string;
  defaultVsize: number;
  defaultShowTrans: boolean;
  studio: {
    fontFamily: string;
    bgIdx: number;
    fontSize: number;
    color: string;
    watermark: string;
    footer: boolean;
  };
  footer: SiteFooterConfig;
  customReciters?: ReciterOption[];
  disabledReciters?: string[];
  updatedAt: number;
}

export interface DailyStatBucket {
  visits: number;
  reads: number;
  plays: number;
  exports: number;
  searches: number;
}

export interface StatLogEntry {
  t: number;
  e: keyof DailyStatBucket;
  d: string;
}

export interface SiteStats {
  visits: number;
  reads: number;
  plays: number;
  exports: number;
  searches: number;
  firstVisit: number;
  lastVisit: number;
  daily: Record<string, DailyStatBucket>;
  log: StatLogEntry[];
}

