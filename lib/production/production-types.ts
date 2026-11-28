/**
 * production-types — عقد بيانات «استوديو تحرير القرآن الكريم» (استوديو الإنتاج).
 *
 * الاستوديو يجمع في واجهة واحدة: منتج الصوت (عقل التلاوة والتحرير غير
 * المدمّر من useAudioProducer)، راسم إطار الفيديو (المعاينة/التصدير)،
 * المسارات الزمنية المتعددة (تلاوة/موسيقى/مؤثرات/نصوص/فيديو)، والإعدادات.
 *
 * هذا الملف هو العقد المشترك بين الواجهات والمخالب (hooks) — نقية 100%.
 */
import type { ProducerEchoSettings } from '@/lib/audio-producer/producer-echo';
import type { ProducerEditState } from '@/lib/audio-producer/audio-producer-edit';

// ── أنماط العمل ────────────────────────────────────────────────────────

/** نمط التحرير: متقدم (كل الأدوات)، سريع (اقتطاع وتطبيع فقط)، معاينة. */
export type ProductionEditMode = 'advanced' | 'quick' | 'preview';

// ── المقاطع الزمنية ─────────────────────────────────────────────────────

/** مقطع نص على مسار النصوص (أزرق فاتح في الخط الزمني). */
export interface ProductionTextClip {
  id: string;
  text: string;
  /** نوع النص — يحدد موضعه ودوره في الرسم. */
  kind: 'basmala' | 'surah-title' | 'reciter' | 'custom' | 'verse';
  startSec: number;
  endSec: number;
  /** لون النص (#RRGGBB). */
  color: string;
  /** حجم نسبي 0.5..2 (مقابل حجم الخط الأساسي). */
  scale: number;
  /** مقاطع الآيات: إخفاء نص الآية عن الكانفيس (مسار فقط). */
  hidden?: boolean;
}

/** مؤثر صوتي على مسار المؤثرات (برتقالي في الخط الزمني). */
export interface ProductionEffectClip {
  id: string;
  kind: 'ambient' | 'echo';
  /** نوع المحيط الصوتي (kind=ambient). */
  ambient: ProductionAmbientKind;
  startSec: number;
  endSec: number;
  /** مكسب المؤثر 0..1. */
  gain: number;
}

/** المحيطات الصوتية الإجرائية (تُولَّد في المتصفح — مطر/ليل/بحر/نسيم). */
export type ProductionAmbientKind = 'rain' | 'night' | 'ocean' | 'breeze';

export const AMBIENT_LIBRARY: {
  kind: ProductionAmbientKind;
  label: string;
  hint: string;
}[] = [
  { kind: 'rain', label: 'مطر هادئ', hint: 'تساقط رطب يغسل الخلفية' },
  { kind: 'night', label: 'ليل ساكن', hint: 'هدأة ليلية بصئات متباعدة' },
  { kind: 'ocean', label: 'بحر بعيد', hint: 'أمواج بطيئة تتنفس' },
  { kind: 'breeze', label: 'نسيم خفيف', hint: 'هواء دافئ ينساب' },
];

// ── الإعدادات البصرية ───────────────────────────────────────────────────

/** الإعدادات البصرية للإطار (خلفية/خط/ألوان/كاليوكي). */
export interface ProductionVisuals {
  /** خلفية: معرف من مكتبة الخلفيات المدمجة أو 'gradient:N'. */
  bgId: string;
  /** عرض اسم القارئ أسفل العنوان. */
  showReciterName: boolean;
  /** عرض عنوان السورة (خط كليغرافي). */
  showSurahTitle: boolean;
  /** عرض الترجمة أسفل الآية. */
  showTranslation: boolean;
  /** الكاليوكي: تلوين الكلمة الجارية مع الصوت. */
  karaoke: boolean;
  /** الآية في سطر واحد (تتصاغر لتسع العرض). */
  oneLine: boolean;
  /** موضع الآية العمودي 0..1 (0 أعلى، 1 أسفل). */
  versePosition: number;
  /** حركة الآية مع الصوت (نافذة تمرير للنص الطويل). */
  followAudio: boolean;
  /** انتقال الآيات: بلا/تلاشي/ذوبان. */
  transition: 'none' | 'fade' | 'dissolve';
  /** الخط القرآني. */
  fontFamily: string;
  /** حجم الخط الأساسي (px على عرض 1080). */
  fontSize: number;
  /** لون نص الآية. */
  textColor: string;
  /** العلامة المائية (فراغ = بلا). */
  watermark: string;
  /** زخرفة الإطار الذهبي. */
  goldFrame: boolean;
}

export const DEFAULT_PRODUCTION_VISUALS: ProductionVisuals = {
  bgId: 'islamic-4-lanterns',
  showReciterName: true,
  showSurahTitle: true,
  showTranslation: false,
  karaoke: true,
  oneLine: false,
  versePosition: 0.5,
  followAudio: true,
  transition: 'fade',
  fontFamily: 'Amiri Quran',
  fontSize: 64,
  textColor: '#FAF7F0',
  watermark: 'مصحف الاستوديو',
  goldFrame: true,
};

// ── إعدادات التصدير ─────────────────────────────────────────────────────

export type ProductionExportFormat = 'mp3' | 'wav' | 'mp4' | 'webm';
export type ProductionExportMode = 'audio' | 'video';
export type ProductionQuality = '480' | '720' | '1080';
export type ProductionAspect = '9:16' | '1:1' | '16:9';

export interface ProductionExportSettings {
  mode: ProductionExportMode;
  format: ProductionExportFormat;
  /** معدل البت الصوتي (كبت/ث) — 96..320. */
  bitrateKbps: number;
  quality: ProductionQuality;
  /** معدل العينات (كيلوهرتز) — للعرض في الشريط الفرعي. */
  sampleRateKhz: 44.1 | 48;
  aspect: ProductionAspect;
  /** مجلد الحفظ المعروض في الواجهة (التنزيل عبر المتصفح). */
  saveFolder: string;
}

export const DEFAULT_PRODUCTION_EXPORT: ProductionExportSettings = {
  mode: 'audio',
  format: 'mp3',
  bitrateKbps: 192,
  quality: '720',
  sampleRateKhz: 44.1,
  aspect: '9:16',
  saveFolder: 'D:\\Quran Studio',
};

export const AUDIO_BITRATES = [96, 128, 160, 192, 256, 320] as const;

/** أبعاد الرسم (كانفاس) حسب الجودة والنسبة — أضلاع زوجية دائماً. */
export function productionCanvasSize(
  aspect: ProductionAspect,
  quality: ProductionQuality
): { width: number; height: number } {
  const long = quality === '480' ? 480 : quality === '720' ? 720 : 1080;
  const ratio = aspect === '9:16' ? 9 / 16 : aspect === '1:1' ? 1 : 16 / 9;
  const even = (v: number) => Math.max(2, Math.round(v / 2) * 2);
  if (aspect === '9:16') return { width: even(long * ratio), height: even(long) };
  if (aspect === '1:1') return { width: even(long), height: even(long) };
  return { width: even(long), height: even(long * ratio) };
}

// ── المشروع القابل للتخزين ──────────────────────────────────────────────

/** بيانات المشروع كما تُحفظ (JSON في localStorage) — بلا بافرات. */
export interface ProductionProjectData {
  version: 1;
  name: string;
  surahId: number;
  fromAyah: number;
  toAyah: number;
  reciterSlug: string;
  reciterName: string;
  translationId: number;
  /** تحرير الصوت (مقاطع محفوظة) — يُطبَّق بعد إعادة التحميل. */
  edit: ProducerEditState | null;
  /** حدود الآيات على خط المصدر. */
  verseMarkersSec: number[] | null;
  echo: ProducerEchoSettings;
  visual: ProductionVisuals;
  exportSettings: ProductionExportSettings;
  textClips: ProductionTextClip[];
  effectClips: ProductionEffectClip[];
  /** اسم ملف الموسيقى المرفوعة (تُطلب إعادة ربطها عند الفتح). */
  musicName: string | null;
  musicGain: number;
  volume: number;
  rate: number;
  mode: ProductionEditMode;
}

/** بطاقة مشروع في قائمة المشاريع. */
export interface ProductionProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  surahId: number;
  surahName: string;
  fromAyah: number;
  toAyah: number;
  reciterName: string;
  durationSec: number;
}

// ── أوامر القوائم ───────────────────────────────────────────────────────

/**
 * معرّف أمر يأتي من قوائم الشريط العلوي. الصيغة: 'نطاق:أمر'.
 * الخريطة الكاملة في use-production-studio.ts (productionCommands).
 */
export type ProductionMenuActionId =
  // المشاريع
  | 'project:new'
  | 'project:open'
  | 'project:save'
  | 'project:restore'
  // مكتبة القرآن
  | 'quran:surahs'
  | 'quran:verses'
  | 'quran:recitation'
  | 'quran:reciters'
  // مكتبة الصوت
  | 'sound:recordings'
  | 'sound:effects'
  | 'sound:ambient'
  // مكتبة الصور
  | 'images:backgrounds'
  | 'images:ornaments'
  | 'images:logos'
  // تحرير الصوت
  | 'audio:clean'
  | 'audio:denoise'
  | 'audio:level'
  // تحرير الفيديو
  | 'video:cut'
  | 'video:merge'
  | 'video:transitions'
  | 'video:animate'
  // النصوص
  | 'text:verses'
  | 'text:surah'
  | 'text:reciter'
  | 'text:custom'
  // الترجمة
  | 'translation:pick'
  | 'translation:toggle'
  // التوقيت والمزامنة
  | 'sync:verses'
  // التصدير
  | 'export:mp3'
  | 'export:wav'
  | 'export:mp4'
  | 'export:quality'
  // أدوات الشريط الأيسر (نفس مسار الأوامر)
  | 'tool:cut'
  | 'tool:merge'
  | 'tool:effects'
  | 'tool:enhance'
  | 'tool:music'
  | 'tool:text'
  | 'tool:image'
  | 'tool:record'
  | 'tool:upload'
  // إعدادات/مساعدة
  | 'app:settings'
  | 'app:help'
  | 'app:export'
  | 'app:save';

/** كل الحوارات القابلة للفتح من القوائم. null = مغلق. */
export type ProductionDialogId =
  | 'surah-picker'
  | 'verse-range'
  | 'reciters'
  | 'recordings'
  | 'effects'
  | 'ambient'
  | 'bg-images'
  | 'ornaments'
  | 'watermark'
  | 'clean'
  | 'denoise'
  | 'level'
  | 'cut'
  | 'transitions'
  | 'animate'
  | 'custom-text'
  | 'translation'
  | 'sync'
  | 'record'
  | 'music'
  | 'settings'
  | 'help'
  | 'open-project'
  | 'save-as'
  | 'export-progress'
  | null;

// ── تسميات مشتركة للعرض ─────────────────────────────────────────────────

/** تنسيق زمن hh:mm:ss (المسطرة الكبيرة والشريط العلوي). */
export function formatProductionClock(sec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const two = (v: number) => String(v).padStart(2, '0');
  return `${two(h)}:${two(m)}:${two(r)}`;
}

/** m:ss للمسطرة الدقيقة. */
export function formatProductionShort(sec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
