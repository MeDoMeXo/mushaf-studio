export type VideoExportFormat = 'mp4' | 'webm';
export type VideoResolutionTier = '480p' | '720p' | '1080p';
export type VideoQualityTier = 'high' | 'balanced' | 'compact';
export type VideoFpsOption = 24 | 30 | 60;
export type SlideTransitionType =
  | 'fade'
  | 'fadeblack'
  | 'fadewhite'
  | 'zoomin'
  | 'zoom'
  | 'slideup'
  | 'dissolve'
  | 'none';
export type AudioEffectPreset =
  | 'natural'
  | 'haram'
  | 'mosque'
  | 'studio'
  | 'warm'
  | 'deep'
  | 'clean';
export type AmbientSoundPreset = 'none' | 'rain' | 'night' | 'ocean' | 'breeze';

export interface VideoExportSettings {
  format: VideoExportFormat;
  resolution: VideoResolutionTier;
  fps: VideoFpsOption;
  quality: VideoQualityTier;
  transition: SlideTransitionType;
  transitionDurationMs: number; // 200..1200
  audioPreset: AudioEffectPreset;
  ambientSound: AmbientSoundPreset;
  ambientVolume: number; // 0..0.5
  audioBitrate: 128 | 192 | 320;
  audioFade: boolean;
  verseGapSec: number; // 0..1.5
  includeIntroCover: boolean;
  /** تصدير متتابع: آية بآية — ملف فيديو مستقل لكل آية في النطاق المحدد (افتراضي معطّل). */
  sequentialAyahExport?: boolean;
}

export const DEFAULT_VIDEO_EXPORT_SETTINGS: VideoExportSettings = {
  format: 'mp4',
  resolution: '1080p',
  fps: 30,
  quality: 'balanced',
  transition: 'fade',
  transitionDurationMs: 750,
  audioPreset: 'natural',
  ambientSound: 'none',
  ambientVolume: 0.16,
  audioBitrate: 192,
  audioFade: true,
  verseGapSec: 0.35,
  includeIntroCover: true,
  sequentialAyahExport: false,
};

export interface ExportQualityPreset {
  id: string;
  label: string;
  description: string;
  patch: Partial<VideoExportSettings>;
}

export const EXPORT_QUALITY_PRESETS: ExportQualityPreset[] = [
  {
    id: 'youtube_wide',
    label: 'يوتيوب عريض 16:9 (عالية الجودة)',
    description: 'أوضح خط للآيات على الشاشة الكاملة — اضبط الأبعاد على «YouTube 16:9».',
    patch: { format: 'mp4', resolution: '1080p', fps: 30, quality: 'high', audioBitrate: 320 },
  },
  {
    id: 'reels_1080',
    label: 'Reels / Shorts عالي (1080p · 30fps)',
    description: 'مثالي لإنستغرام وتيك توك ويوتيوب شورتس.',
    patch: { format: 'mp4', resolution: '1080p', fps: 30, quality: 'balanced', audioBitrate: 192 },
  },
  {
    id: 'youtube_60',
    label: 'يوتيوب فائق السلاسة (1080p · 60fps)',
    description: 'فيديو عالي الجودة 60 إطار/ثانية للعرض الاحترافي.',
    patch: { format: 'mp4', resolution: '1080p', fps: 60, quality: 'high', audioBitrate: 320 },
  },
  {
    id: 'balanced_720',
    label: 'متوازن وسريع (720p · 30fps)',
    description: 'جودة واضحة بحجم ملف خفيف وتصدير أسرع.',
    patch: { format: 'mp4', resolution: '720p', fps: 30, quality: 'balanced', audioBitrate: 192 },
  },
  {
    id: 'fast_480',
    label: 'حجم صغير للمشاركة (480p · 24fps)',
    description: 'تصدير فوري ومناسب للمشاركة السريعة عبر واتساب.',
    patch: { format: 'mp4', resolution: '480p', fps: 24, quality: 'compact', audioBitrate: 128 },
  },
];

export const EXPORT_DHIKR_LIST: string[] = [
  'لا إله إلا الله',
  'سبحان الله وبحمده',
  'الحمد لله رب العالمين',
  'الله أكبر كبيراً',
  'أستغفر الله العظيم',
  'اللهم صلِّ وسلِّم على نبينا محمد',
];

export const AUDIO_EFFECT_PRESETS: {
  id: AudioEffectPreset;
  label: string;
  subtitle: string;
}[] = [
  { id: 'natural', label: 'طبيعي', subtitle: 'بدون معالجة' },
  { id: 'haram', label: 'صدى الحرم', subtitle: 'مقام الحرم المكي' },
  { id: 'mosque', label: 'المسجد', subtitle: 'محراب دافئ' },
  { id: 'studio', label: 'استوديو', subtitle: 'حضور إذاعي' },
  { id: 'warm', label: 'خاشع دافئ', subtitle: 'رخامة وهدوء' },
  { id: 'deep', label: 'قرار عميق', subtitle: 'تعزيز الباس' },
  { id: 'clean', label: 'تنقية الصوت', subtitle: 'للمقاطع المرفوعة' },
];

export const AMBIENT_SOUND_PRESETS: {
  id: AmbientSoundPreset;
  label: string;
}[] = [
  { id: 'none', label: 'بدون خلفية' },
  { id: 'rain', label: 'مطر خفيف' },
  { id: 'night', label: 'سكون الليل' },
  { id: 'ocean', label: 'أمواج البحر' },
  { id: 'breeze', label: 'نسيم الجبل' },
];

export const SLIDE_TRANSITION_OPTIONS: {
  id: SlideTransitionType;
  label: string;
}[] = [
  { id: 'fade', label: 'تلاشي ناعم متداخل (Crossfade)' },
  { id: 'fadeblack', label: 'تلاشي وقور عبر السواد (Fade Black)' },
  { id: 'fadewhite', label: 'إشراقة نورانية عبر البياض (Fade White)' },
  { id: 'zoomin', label: 'تقريب سينمائي تدريجي (Cinematic Zoom)' },
  { id: 'slideup', label: 'انزلاق عمودي صاعد (Slide Up)' },
  { id: 'dissolve', label: 'ذوبان تدريجي (Dissolve)' },
  { id: 'none', label: 'بدون انتقال (قطع مباشر)' },
];
