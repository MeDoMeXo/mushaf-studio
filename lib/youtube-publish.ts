/**
 * YouTube Publish Kit (حزمة النشر ليوتيوب) — pure, client-safe module.
 *
 * Builds the full metadata pack a Quran channel needs for every upload:
 * bilingual titles (AR + EN), structured descriptions with YouTube chapter
 * timestamps (parsed from the exported SRT so they can never drift from the
 * rendered video), verse listings, hashtags and a ready-to-paste tag box.
 *
 * No DOM / no fetch here — the UI fetches the SRT body and passes cues in.
 */

import { stripHtmlTags, toArabicDigits } from './quran-utils';

/** YouTube enforces a 100-char title, 5000-char description, 500-char tag box. */
export const YOUTUBE_TITLE_MAX = 100;
export const YOUTUBE_TAGS_MAX = 500;
/** YouTube chapters need >= 3 entries and the first one at 0:00. */
const MIN_CHAPTERS = 3;

export interface SrtCueSpan {
  startSec: number;
  endSec: number;
}

export interface YouTubePublishInput {
  surahNameAr: string;
  surahNameEn?: string | null;
  fromAyah: number;
  toAyah: number;
  verseCount: number;
  isFullSurah?: boolean;
  reciterName: string;
  translationName?: string | null;
  /** Uthmani verse texts, index-aligned with the exported slides. */
  verseTexts: string[];
  /** English translation texts, index-aligned with verseTexts (may be empty). */
  translationTexts?: string[];
  /** Cue spans parsed from the exported Arabic SRT (one per verse). */
  cueSpans?: SrtCueSpan[] | null;
  /** Total exported video duration in seconds (display + fallback chapters). */
  durationSec?: number | null;
}

export interface YouTubePublishKit {
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  /** Comma-separated, deduped, 500-char-clamped tag box value. */
  tagsValue: string;
  hashtagsAr: string[];
  hashtagsEn: string[];
}

/** Formats seconds as a YouTube chapter timestamp `M:SS` / `H:MM:SS`. */
export function formatYouTubeChapterTime(totalSec: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Parses an SRT body into plain cue spans (timestamps only, text ignored). */
export function parseSrtCueSpans(srtBody: string): SrtCueSpan[] {
  const spans: SrtCueSpan[] = [];
  if (!srtBody) return spans;
  const re = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(srtBody)) !== null) {
    const start =
      Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
    const end =
      Number(match[5]) * 3600 + Number(match[6]) * 60 + Number(match[7]) + Number(match[8]) / 1000;
    spans.push({ startSec: start, endSec: end });
  }
  return spans;
}

function clampTitle(title: string): string {
  return title.slice(0, YOUTUBE_TITLE_MAX).trim();
}

function buildRangeLabelAr(input: YouTubePublishInput): string {
  const from = toArabicDigits(Math.max(1, input.fromAyah));
  const to = toArabicDigits(Math.max(1, input.toAyah));
  if (input.isFullSurah) return 'كاملة';
  return from === to ? `آية ${from}` : `الآيات ${from}-${to}`;
}

function buildRangeLabelEn(input: YouTubePublishInput): string {
  if (input.isFullSurah) return 'Full Surah';
  const from = Math.max(1, input.fromAyah);
  const to = Math.max(from, Math.max(1, input.toAyah));
  return from === to ? `Verse ${from}` : `Verses ${from}-${to}`;
}

/** Cleans one verse text for a description line (HTML footnotes removed). */
function cleanVerseLine(text: string): string {
  return stripHtmlTags(text || '').slice(0, 240);
}

export interface ChapterEntry {
  timeSec: number;
  labelAr: string;
  labelEn: string;
}

/**
 * Builds the YouTube chapter list from SRT cue spans: the first verse cue is
 * shifted to 0:00 when an intro cover precedes it, and a lead-in entry is
 * inserted when the timeline doesn't already start at zero.
 */
export function buildChapters(
  input: YouTubePublishInput
): ChapterEntry[] {
  const spans = input.cueSpans?.filter((c) => Number.isFinite(c.startSec)) ?? [];
  const chapters: ChapterEntry[] = [];

  if (spans.length) {
    if (spans[0].startSec >= 1) {
      chapters.push({ timeSec: 0, labelAr: 'المقدمة والغلاف', labelEn: 'Intro' });
    }
    spans.forEach((cue, i) => {
      chapters.push({
        timeSec: i === 0 && chapters.length === 0 ? 0 : cue.startSec,
        labelAr: `الآية ${toArabicDigits(i + input.fromAyah)}`,
        labelEn: `Verse ${i + input.fromAyah}`,
      });
    });
  }

  // Fallback (no SRT): approximate equal split so the description still ships
  // usable chapters.
  if (!chapters.length && input.verseCount > 0 && input.durationSec && input.durationSec > 4) {
    const per = input.durationSec / Math.max(1, input.verseCount);
    if (per >= 0.8) {
      for (let i = 0; i < input.verseCount; i++) {
        chapters.push({
          timeSec: Math.round(i * per),
          labelAr: `الآية ${toArabicDigits(i + input.fromAyah)}`,
          labelEn: `Verse ${i + input.fromAyah}`,
        });
      }
    }
  }

  return chapters.length >= MIN_CHAPTERS ? chapters : [];
}

function buildVerseListings(
  input: YouTubePublishInput,
  max = 20
): { ar: string[]; en: string[] } {
  const ar: string[] = [];
  const en: string[] = [];
  const count = Math.min(max, Math.min(input.verseTexts.length, input.verseCount));
  for (let i = 0; i < count; i++) {
    const verseLine = cleanVerseLine(input.verseTexts[i] ?? '');
    if (verseLine) {
      ar.push(`${i + input.fromAyah}. ${verseLine}`);
    }
    const trLine = cleanVerseLine(input.translationTexts?.[i] ?? '');
    if (trLine) {
      en.push(`${i + input.fromAyah}. ${trLine}`);
    }
  }
  return { ar, en };
}

function buildHashtagsAr(input: YouTubePublishInput): string[] {
  const surahTag = input.surahNameAr.replace(/\s+/g, '_');
  const tags = ['القرآن_الكريم', 'تلاوة_خاشعة', `سورة_${surahTag}`, 'قرآن', 'quran'];
  if (input.isFullSurah) tags.push('سورة_كاملة');
  return dedupe(tags).slice(0, 8);
}

function buildHashtagsEn(input: YouTubePublishInput): string[] {
  const surahEn = (input.surahNameEn || '').replace(/[^A-Za-z0-9]/g, '') || 'Quran';
  return dedupe(['Quran', 'QuranRecitation', surahEn, 'Islam', 'PeacefulRecitation']).slice(0, 8);
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((t) => {
    const key = t.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildTagsValue(input: YouTubePublishInput): string {
  const surahEn = input.surahNameEn?.trim() || '';
  const candidates = [
    'قرآن كريم',
    'القرآن الكريم',
    'تلاوة',
    'تلاوة خاشعة',
    `سورة ${input.surahNameAr}`,
    input.surahNameAr,
    'quran',
    'quran recitation',
    'quran karim',
    'coran',
    'koran',
    surahEn ? `surah ${surahEn}` : '',
    surahEn,
    'islam',
    'muslim',
    'recitation',
    'peaceful quran',
    'قرآن مرتل',
    'تجويد',
    input.reciterName,
    'quran with english subtitles',
    'تلاوة القرآن',
    'holy quran',
    'القرآن مع الترجمة',
  ];
  const cleaned = dedupe(candidates.map((t) => t.trim()).filter(Boolean));
  let value = '';
  for (const tag of cleaned) {
    const candidate = value ? `${value},${tag}` : tag;
    if (candidate.length > YOUTUBE_TAGS_MAX) break;
    value = candidate;
  }
  return value;
}

function buildChaptersBlock(chapters: ChapterEntry[], lang: 'ar' | 'en'): string[] {
  return chapters.map((c) => {
    const time = formatYouTubeChapterTime(c.timeSec);
    return `${time} ${lang === 'ar' ? c.labelAr : c.labelEn}`;
  });
}

/** Builds the complete YouTube publish kit for one exported video. */
export function buildYouTubePublishKit(input: YouTubePublishInput): YouTubePublishKit {
  const surahAr = input.surahNameAr.trim() || 'القرآن الكريم';
  const surahEn = (input.surahNameEn || '').trim();
  const reciter = input.reciterName.trim();
  const rangeAr = buildRangeLabelAr(input);
  const rangeEn = buildRangeLabelEn(input);

  const titleAr = clampTitle(
    `سورة ${surahAr} ${rangeAr} | تلاوة خاشعة${reciter ? ` — ${reciter}` : ''} | قرآن كريم`
  );

  const enReciter = reciter ? ` | Qari: ${reciter}` : '';
  const titleEn = clampTitle(
    `Surah ${surahEn || 'Quran'} (${rangeEn}) — Peaceful Recitation${enReciter}`
  );

  const chapters = buildChapters(input);
  const listings = buildVerseListings(input);
  const hashtagsAr = buildHashtagsAr(input);
  const hashtagsEn = buildHashtagsEn(input);
  const translation = (input.translationName || '').trim();

  const descArLines: string[] = [
    `تلاوة خاشعة من سورة ${surahAr} (${rangeAr})${reciter ? ` بصوت القارئ ${reciter}` : ''}.`,
    'فيديو قرآني مصمم بخط عثماني واضح ومقروء' +
      (translation ? ` مع ترجمة ${translation} متزامنة` : '') +
      '.',
    '',
  ];
  if (chapters.length) {
    descArLines.push('⏱ الفصول (Chapters):', ...buildChaptersBlock(chapters, 'ar'), '');
  }
  if (listings.ar.length) {
    descArLines.push('📖 نص الآيات:', ...listings.ar);
    if (input.verseTexts.length > listings.ar.length) {
      descArLines.push(
        `… (${toArabicDigits(input.verseTexts.length - listings.ar.length)} آيات أخرى في الفيديو)`
      );
    }
    descArLines.push('');
  }
  descArLines.push(
    '🎧 استمع بتدبر، وانشر المقطع لتكون سبباً في نشر القرآن.',
    '',
    hashtagsAr.map((h) => `#${h}`).join(' ')
  );

  const descEnLines: string[] = [
    `A peaceful recitation of Surah ${surahEn || surahAr} (${rangeEn})${
      reciter ? ` by Qari ${reciter}` : ''
    }.`,
    'Designed with crisp Uthmani calligraphy' +
      (translation ? ` and synchronized English subtitles (${translation})` : '') +
      ' for easy reading.',
    '',
  ];
  if (chapters.length) {
    descEnLines.push('⏱ Chapters:', ...buildChaptersBlock(chapters, 'en'), '');
  }
  if (listings.en.length) {
    descEnLines.push('📖 Verses:', ...listings.en, '');
  }
  descEnLines.push(
    '🎧 Listen with reflection — share this video to spread the Quran.',
    '',
    hashtagsEn.map((h) => `#${h}`).join(' ')
  );

  return {
    titleAr,
    titleEn,
    descriptionAr: descArLines.join('\n').slice(0, 4800).trim() + '\n',
    descriptionEn: descEnLines.join('\n').slice(0, 4800).trim() + '\n',
    tagsValue: buildTagsValue(input),
    hashtagsAr,
    hashtagsEn,
  };
}
