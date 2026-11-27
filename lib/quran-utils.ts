import {
  AUDIO_CDN_BASE,
  CONFIG_DEFAULTS,
  DEFAULT_TRANSLATION_ID,
  EMPTY_STATS,
  EVERYAYAH_CDN_BASE,
  RECITERS,
  TRANSLATIONS,
  VERSE_OF_DAY_CURATED,
  type DailyStatBucket,
  type QulChapter,
  type ReciterOption,
  type SiteConfig,
  type SiteStats,
  type TranslationOption,
} from './quran-data';
import { buildCustomReciterSpecQuery } from './custom-reciter-spec';
import { getClientCustomReciters } from './custom-reciters-registry';
import { sanitizeHiddenInspectorSections } from './inspector-sections';

// Exact Hafs verse counts for all 114 Surahs (sum = 6236)
export const SURAH_VERSE_COUNTS: readonly number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

export function globalVerseIdToSurahAyah(globalVerseId: number): { surah: number; ayah: number } {
  let remaining = Math.max(1, Math.min(6236, Math.floor(globalVerseId || 1)));
  for (let i = 0; i < SURAH_VERSE_COUNTS.length; i++) {
    const count = SURAH_VERSE_COUNTS[i];
    if (remaining <= count) {
      return { surah: i + 1, ayah: remaining };
    }
    remaining -= count;
  }
  return { surah: 114, ayah: 6 };
}

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
}

const ARABIC_INDIC_DIGIT_RE = /[٠-٩۰-۹]/g;

/** Converts Arabic-Indic/Persian digits (١٨ / ۱۸) to ASCII digits ("18"). */
export function normalizeArabicDigits(input: string): string {
  if (!input) return input;
  return input.replace(ARABIC_INDIC_DIGIT_RE, (d) => {
    const cp = d.codePointAt(0) ?? 0;
    if (cp >= 0x0660 && cp <= 0x0669) return String(cp - 0x0660);
    if (cp >= 0x06f0 && cp <= 0x06f9) return String(cp - 0x06f0);
    return d;
  });
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function stripHtmlTags(html: string): string {
  if (!html) return '';
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripArabicDiacritics(input: string): string {
  return input
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    // Farsi yeh (QUL uses it in «یسٓ») folds to Arabic yeh so user queries match.
    .replace(/\u06CC/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A')
    .trim();
}

export function buildArabicSearchRegex(query: string): RegExp | null {
  const cleaned = stripArabicDiacritics(query);
  if (!cleaned) return null;
  const diac = '[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]*';
  const charMap: Record<string, string> = {
    '\u0627': '[\u0622\u0623\u0625\u0671\u0670\u0627]',
    '\u0647': '[\u0629\u0647]',
    '\u064A': '[\u0649\u064A]',
  };
  const pattern = [...cleaned]
    .map((ch) => {
      if (ch === ' ') return '\\s+';
      if (charMap[ch]) return charMap[ch];
      return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join(diac);
  try {
    return new RegExp(pattern, 'gi');
  } catch {
    return null;
  }
}

export function filterChapters(
  chapters: QulChapter[],
  query: string,
  place: 'all' | 'makkah' | 'madinah'
): QulChapter[] {
  // Arabic-Indic digits fold to ASCII so «١٨» finds سورة 18 just like "18".
  const qNorm = normalizeArabicDigits(stripArabicDiacritics(query)).toLowerCase();
  return chapters.filter((ch) => {
    if (place !== 'all' && ch.revelation_place !== place) return false;
    if (!qNorm) return true;
    const arNorm = stripArabicDiacritics(ch.name_arabic).toLowerCase();
    const enNorm = `${ch.name_simple} ${ch.translated_name?.name ?? ''}`.toLowerCase();
    return arNorm.includes(qNorm) || enNorm.includes(qNorm) || String(ch.id) === qNorm;
  });
}

function resolveReciterForUrl(
  reciterSlug: string,
  customReciters?: readonly ReciterOption[]
): ReciterOption {
  const extras = customReciters && customReciters.length > 0 ? customReciters : getClientCustomReciters();
  const all = extras && extras.length > 0 ? [...RECITERS, ...extras] : RECITERS;
  return all.find((r) => r.slug === reciterSlug) ?? RECITERS[0];
}

function isBuiltInReciterSlug(reciterSlug: string): boolean {
  return RECITERS.some((r) => r.slug === reciterSlug);
}

export function getUpstreamAudioUrl(
  reciterSlug: string,
  globalVerseId: number,
  customReciters?: readonly ReciterOption[]
): string {
  const reciter = resolveReciterForUrl(reciterSlug, customReciters);
  const safeId = Math.max(1, Math.min(6236, Math.floor(globalVerseId || 1)));
  if (reciter.source === 'everyayah' && reciter.everyayahFolder) {
    const { surah, ayah } = globalVerseIdToSurahAyah(safeId);
    const sss = String(surah).padStart(3, '0');
    const aaa = String(ayah).padStart(3, '0');
    return `${EVERYAYAH_CDN_BASE}/${reciter.everyayahFolder}/${sss}${aaa}.mp3`;
  }
  if (reciter.source === 'mp3quran' && reciter.mp3quranServer) {
    const { surah } = globalVerseIdToSurahAyah(safeId);
    const sss = String(surah).padStart(3, '0');
    return `${reciter.mp3quranServer}${sss}.mp3`;
  }
  return `${AUDIO_CDN_BASE}/${reciter.bitrate}/${reciter.slug}/${safeId}.mp3`;
}

export function getReciterAudioUrl(
  reciterSlug: string,
  globalVerseId: number,
  customReciters?: readonly ReciterOption[]
): string {
  const reciter = resolveReciterForUrl(reciterSlug, customReciters);
  const safeId = Math.max(1, Math.min(6236, Math.floor(globalVerseId || 1)));
  const base = `/api/audio/${reciter.slug}/${safeId}`;
  // Custom reciters are not in the server's static whitelist — append the
  // strictly-validated wire spec so the proxy can fetch/slice for them.
  if (!isBuiltInReciterSlug(reciter.slug)) {
    return base + buildCustomReciterSpecQuery(reciter);
  }
  return base;
}

/**
 * استعلام مواصفة القارئ المخصص (folder/server/readId) للإلحاق بمسارات
 * API التي تحتاج نفس آلية وكيل الصوت — سلسلة فارغة للقراء المدمجين.
 */
export function getReciterSpecQuery(reciterSlug: string): string {
  if (isBuiltInReciterSlug(reciterSlug)) return '';
  const reciter = resolveReciterForUrl(reciterSlug);
  if (isBuiltInReciterSlug(reciter.slug)) return ''; // لم تُعرف مواصفة صالحة
  return buildCustomReciterSpecQuery(reciter);
}

export function pickVerseOfDay(
  customVod: { surah: number; ayah: number } | null | undefined,
  now: Date = new Date()
): { surah: number; ayah: number } {
  if (customVod && customVod.surah >= 1 && customVod.surah <= 114 && customVod.ayah >= 1) {
    return { surah: customVod.surah, ayah: customVod.ayah };
  }
  const startOfUtcYear = Date.UTC(now.getUTCFullYear(), 0, 0);
  const currentUtcDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const dayOfYear = Math.max(0, Math.floor((currentUtcDay - startOfUtcYear) / 86_400_000));
  const picked = VERSE_OF_DAY_CURATED[dayOfYear % VERSE_OF_DAY_CURATED.length];
  return { surah: picked.surah, ayah: picked.ayah };
}

export function wrapWordsToLines(
  text: string,
  maxWidth: number,
  measureTextWidth: (line: string) => number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureTextWidth(candidate) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function sanitizeFooterLinkHref(rawHref: string): string | null {
  const trimmed = rawHref.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol === 'https:' ||
      parsed.protocol === 'http:' ||
      parsed.protocol === 'mailto:'
    ) {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function mergeSiteConfig(raw: Partial<SiteConfig> | null | undefined): SiteConfig {
  const safe = raw ?? {};
  const rawFooter = safe.footer;
  const sanitizedLinks = Array.isArray(rawFooter?.customLinks)
    ? rawFooter.customLinks
        .filter(
          (item): item is { label: string; href: string } =>
            Boolean(item) &&
            typeof item.label === 'string' &&
            typeof item.href === 'string'
        )
        .map((item) => {
          const label = item.label.trim().slice(0, 40);
          const href = sanitizeFooterLinkHref(item.href);
          return label && href ? { label, href } : null;
        })
        .filter((item): item is { label: string; href: string } => item !== null)
        .slice(0, 6)
    : CONFIG_DEFAULTS.footer.customLinks;

  const customReciters = Array.isArray(safe.customReciters)
    ? safe.customReciters.filter(
        (r) => Boolean(r) && typeof r.slug === 'string' && typeof r.name === 'string'
      )
    : [];
  const disabledReciters = Array.isArray(safe.disabledReciters)
    ? safe.disabledReciters.filter((s) => typeof s === 'string')
    : [];

  return {
    ...CONFIG_DEFAULTS,
    ...safe,
    studio: {
      ...CONFIG_DEFAULTS.studio,
      ...(safe.studio ?? {}),
      hiddenInspectorSections: sanitizeHiddenInspectorSections(
        safe.studio?.hiddenInspectorSections
      ),
    },
    footer: {
      ...CONFIG_DEFAULTS.footer,
      ...(rawFooter ?? {}),
      customLinks: sanitizedLinks,
    },
    customReciters,
    disabledReciters,
  };
}

export function recordStatEvent(
  prev: SiteStats | null | undefined,
  kind: keyof DailyStatBucket,
  detail: string,
  nowMs: number = Date.now()
): SiteStats {
  const base: SiteStats = prev
    ? {
        ...EMPTY_STATS,
        ...prev,
        daily: { ...(prev.daily ?? {}) },
        log: [...(prev.log ?? [])],
      }
    : { ...EMPTY_STATS, daily: {}, log: [] };

  const dayKey = new Date(nowMs).toISOString().slice(0, 10);
  const prevBucket = base.daily[dayKey] ?? {
    visits: 0,
    reads: 0,
    plays: 0,
    exports: 0,
    searches: 0,
  };

  base[kind] = (base[kind] ?? 0) + 1;
  base.lastVisit = nowMs;
  if (!base.firstVisit) base.firstVisit = nowMs;

  base.daily[dayKey] = {
    ...prevBucket,
    [kind]: (prevBucket[kind] ?? 0) + 1,
  };

  const sortedDays = Object.keys(base.daily).sort();
  while (sortedDays.length > 30) {
    const oldest = sortedDays.shift();
    if (oldest) delete base.daily[oldest];
  }

  base.log.unshift({ t: nowMs, e: kind, d: detail.slice(0, 60) });
  base.log = base.log.slice(0, 60);
  return base;
}

export function validatePinChange(
  actualPin: string,
  enteredCurrent: string,
  newPin: string,
  confirmPin: string
): { ok: true } | { ok: false; error: string } {
  if (enteredCurrent !== actualPin) {
    return { ok: false, error: 'الرمز الحالي غير صحيح' };
  }
  if (!/^\d{4,8}$/.test(newPin)) {
    return { ok: false, error: 'الرمز الجديد يجب أن يكون بين ٤ و٨ أرقام' };
  }
  if (newPin !== confirmPin) {
    return { ok: false, error: 'تأكيد الرمز الجديد لا يطابق' };
  }
  return { ok: true };
}

export function clampVerseRange(
  fromAyah: number,
  toAyah: number,
  maxVerses: number
): { fromAyah: number; toAyah: number } {
  const safeMax = Math.max(1, maxVerses);
  const from = Math.min(Math.max(1, Math.floor(fromAyah || 1)), safeMax);
  const to = Math.min(Math.max(from, Math.floor(toAyah || from)), safeMax);
  return { fromAyah: from, toAyah: to };
}

const RTL_LANG_CODES = new Set(['ar', 'ur', 'fa', 'he', 'ps', 'ku', 'dv', 'sd']);

export function resolveTranslationOption(
  translationId: number | null | undefined
): TranslationOption {
  const found = TRANSLATIONS.find((t) => t.id === translationId);
  if (found) return found;
  return (
    TRANSLATIONS.find((t) => t.id === DEFAULT_TRANSLATION_ID) ?? TRANSLATIONS[0]
  );
}

export function getTranslationDirection(lang?: string | null): 'rtl' | 'ltr' {
  if (!lang) return 'ltr';
  const base = lang.trim().toLowerCase().split(/[-_]/)[0];
  return RTL_LANG_CODES.has(base) ? 'rtl' : 'ltr';
}
