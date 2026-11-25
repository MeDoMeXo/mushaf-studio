/**
 * Native Web Share API Level 2 helper for sharing rendered recitation videos
 * directly to mobile apps (YouTube, Instagram, WhatsApp, Telegram) with ZERO
 * OAuth, API quotas, or third-party approvals.
 *
 * Pure logic decoupled from React UI for fast unit testing via node:test.
 */
import { toArabicDigits } from './quran-utils';
import type { VideoExportFormat } from './video-export';

export interface ShareNavigatorLike {
  canShare?: (data?: { files?: File[]; title?: string; text?: string }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
}

export interface VideoShareMetadataInput {
  surahName: string;
  fromAyah: number;
  toAyah: number;
  reciterName: string;
  filename: string;
}

export interface VideoShareMetadata {
  title: string;
  text: string;
}

export type ShareVideoOutcome =
  | { status: 'shared' }
  | { status: 'cancelled' }
  | { status: 'unsupported'; reason: string }
  | { status: 'error'; message: string };

/** Builds social-ready Arabic title + description for YouTube Shorts / Reels. */
export function buildVideoShareMetadata(input: VideoShareMetadataInput): VideoShareMetadata {
  const cleanSurah = input.surahName.trim() || 'القرآن الكريم';
  const cleanReciter = input.reciterName.trim() || 'تلاوة خاشعة';
  const fromStr = toArabicDigits(Math.max(1, Math.floor(input.fromAyah || 1)));
  const toStr = toArabicDigits(Math.max(1, Math.floor(input.toAyah || 1)));
  const rangeStr = fromStr === toStr ? `آية ${fromStr}` : `الآيات ${fromStr}–${toStr}`;

  const title = `سورة ${cleanSurah} (${rangeStr}) — ${cleanReciter}`;
  const text = `${title}\nتلاوة قرآنية مُصمّمة عبر مصحف الاستوديو\n#القرآن_الكريم #تلاوة #${cleanSurah.replace(/\s+/g, '_')}`;

  return { title, text };
}

/** Wraps a verified Blob in a File object with the expected MIME type. */
export function buildVideoFileFromBlob(
  blob: Blob,
  filename: string,
  format: VideoExportFormat
): File {
  const mime = format === 'webm' ? 'video/webm' : 'video/mp4';
  const safeName = filename.trim() || `quran_recitation.${format === 'webm' ? 'webm' : 'mp4'}`;
  return new File([blob], safeName, { type: mime, lastModified: Date.now() });
}

/**
 * Safely checks whether the current browser supports Web Share API Level 2
 * file sharing for this video File (returns false on unsupported desktop browsers).
 */
export function canShareVideoFile(
  nav: ShareNavigatorLike | null | undefined,
  file: File | null
): boolean {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function' || !file) {
    return false;
  }
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Opens the native OS share sheet with the rendered video file attached so the
 * user can pick YouTube / Instagram directly. Falls back to manual download on
 * unsupported desktop browsers without treating user cancellation as an error.
 */
export async function shareExportedVideoFile(params: {
  nav: ShareNavigatorLike | null | undefined;
  file: File | null;
  title: string;
  text: string;
  onFallbackDownload?: () => void;
}): Promise<ShareVideoOutcome> {
  const { nav, file, title, text, onFallbackDownload } = params;

  if (!file) {
    onFallbackDownload?.();
    return {
      status: 'unsupported',
      reason: 'حجم الملف كبير على الذاكرة المؤقتة — تم بدء التنزيل اليدوي لتتمكن من رفعه مباشرة عبر تطبيق يوتيوب أو إنستغرام.',
    };
  }

  if (!canShareVideoFile(nav, file) || !nav?.share) {
    onFallbackDownload?.();
    return {
      status: 'unsupported',
      reason: 'المتصفح الحالي لا يدعم مشاركة ملفات الفيديو عبر النظام (متاح غالباً على متصفحات الجوال iOS وAndroid) — تم تنزيل الفيديو يدوياً لرفعه من جهازك.',
    };
  }

  try {
    await nav.share({
      files: [file],
      title,
      text,
    });
    return { status: 'shared' };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { status: 'cancelled' };
    }
    const detail = err instanceof Error ? err.message : '';
    if (/NotAllowedError/i.test(err instanceof Error ? err.name : '')) {
      onFallbackDownload?.();
      return {
        status: 'unsupported',
        reason: 'تعذّر فتح قائمة مشاركة النظام في هذه الجلسة — تم تنزيل الفيديو يدوياً على جهازك.',
      };
    }
    return {
      status: 'error',
      message: detail || 'تعذّر إرسال الملف إلى قائمة مشاركة النظام — استخدم زر التنزيل اليدوي.',
    };
  }
}

export const YOUTUBE_UPLOAD_URL = 'https://www.youtube.com/upload';

/** Builds formatted title + description + hashtags ready to paste into YouTube Studio. */
export function formatShareCaptionForClipboard(meta: VideoShareMetadata): string {
  return `${meta.title}\n\n${meta.text}`;
}

/**
 * Builds a readable, OS-safe Arabic filename so dragging the exported MP4 into
 * YouTube Studio auto-fills a clean Arabic title instead of "quran surah 1 1 3".
 */
export function buildArabicExportFilename(input: {
  surahName?: string | null;
  fromAyah: number;
  toAyah: number;
  reciterName?: string | null;
  format: VideoExportFormat;
}): string {
  const cleanSurah = (input.surahName || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cleanReciter = (input.reciterName || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const f = Math.max(1, Math.floor(input.fromAyah || 1));
  const t = Math.max(f, Math.floor(input.toAyah || f));
  const rangePart = f === t ? `آية ${f}` : `${f}-${t}`;
  const ext = input.format === 'webm' ? 'webm' : 'mp4';

  const base = cleanSurah
    ? cleanReciter
      ? `سورة ${cleanSurah} (${rangePart}) - ${cleanReciter}`
      : `سورة ${cleanSurah} (${rangePart})`
    : `تلاوة قرآنية (${rangePart})`;

  return `${base.slice(0, 95).trim()}.${ext}`;
}

/** Builds an OS-safe Arabic filename for exported cover images (PNG / JPG). */
export function buildArabicCoverFilename(input: {
  surahName?: string | null;
  ayahNumber?: number | string;
  reciterName?: string | null;
  format: 'png' | 'jpeg';
  isIntroCover?: boolean;
}): string {
  const cleanSurah = (input.surahName || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cleanReciter = (input.reciterName || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const ayahStr = String(input.ayahNumber || 1).replace(/[^\d]/g, '') || '1';
  const ext = input.format === 'jpeg' ? 'jpg' : 'png';

  const base = input.isIntroCover
    ? cleanSurah
      ? cleanReciter
        ? `غلاف سورة ${cleanSurah} - ${cleanReciter}`
        : `غلاف سورة ${cleanSurah}`
      : 'غلاف تلاوة قرآنية'
    : cleanSurah
      ? cleanReciter
        ? `غلاف سورة ${cleanSurah} (آية ${ayahStr}) - ${cleanReciter}`
        : `غلاف سورة ${cleanSurah} (آية ${ayahStr})`
      : `غلاف تلاوة (آية ${ayahStr})`;

  return `${base.slice(0, 95).trim()}.${ext}`;
}

/** Detects mobile touch platforms (Android / iOS) where YouTube registers as an OS Share Target. */
export function isLikelyMobileDevice(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
}
