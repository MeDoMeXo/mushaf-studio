/**
 * SRT emission for export jobs (Arabic + English tracks).
 * Split from lib/export-render-pipeline.ts per the 600-line file rule:
 * owns the karaoke cue-merging math (word slides of one verse merge into a
 * single verse-level cue) and renders both language bodies from the exact
 * normalized slide durations the concat manifest was built from.
 *
 * The Arabic verse grid is authoritative: the translation track reuses the
 * exact same cue spans (translations are verse-index-aligned by construction),
 * so AR and EN files never drift from each other or from the rendered video.
 */

import { buildSrtFromTimeline } from './srt-subtitles';

export interface SrtEmitInput {
  /** Normalized per-slide durations (seconds), intro cover included. */
  normalizedDurs: number[];
  /** Verse texts aligned slide-by-slide (verse text on its first slide, '' otherwise). */
  verseTexts: string[];
  /** Translation texts aligned the same way (English track source). */
  verseTranslations?: string[];
  /** Karaoke word/segment timeline active (merges word slides per verse). */
  isKaraoke: boolean;
  includeIntroCover: boolean;
}

interface MergedVerseGrid {
  durations: number[];
  arabicTexts: string[];
  translationTexts: string[];
}

/**
 * Merges karaoke word slides back into verse-level cues. The boundary trigger
 * is the NON-EMPTY ARABIC slot (the verse's first word slide) for BOTH tracks:
 * the verse's Arabic text and its translation ride the same cue span, and
 * verses without a translation simply keep a silent EN slot — the grids stay
 * identical no matter which verses carry translations.
 */
function mergeVerseGrid(
  restDur: number[],
  arabicSlots: string[],
  transSlots: string[]
): MergedVerseGrid {
  const durations: number[] = [];
  const arabicTexts: string[] = [];
  const translationTexts: string[] = [];
  let accDur = 0;
  let accAr = '';
  let accTr = '';
  for (let i = 0; i < restDur.length; i++) {
    const ar = (arabicSlots[i] ?? '').trim();
    if (ar && accAr) {
      durations.push(accDur);
      arabicTexts.push(accAr);
      translationTexts.push(accTr);
      accDur = 0;
      accAr = '';
      accTr = '';
    }
    if (ar && !accAr) {
      accAr = ar;
      accTr = (transSlots[i] ?? '').trim();
    }
    accDur += restDur[i];
  }
  if (accAr) {
    durations.push(accDur);
    arabicTexts.push(accAr);
    translationTexts.push(accTr);
  }
  return { durations, arabicTexts, translationTexts };
}

export interface SrtEmitResult {
  /** Arabic (Uthmani) SRT body, or '' when no verse texts exist. */
  srtAr: string;
  /** English translation SRT body, or '' when no translations exist. */
  srtEn: string;
}

/**
 * Builds both subtitle bodies from the final normalized timeline. Both files
 * share one cue grid; the EN track simply leaves a slot silent when its verse
 * has no translation, so timestamps match the AR track one-to-one.
 */
export function buildExportSrtBodies(input: SrtEmitInput): SrtEmitResult {
  const { normalizedDurs, verseTexts, isKaraoke, includeIntroCover } = input;
  const arabic = Array.isArray(verseTexts) ? verseTexts : [];
  const translations = Array.isArray(input.verseTranslations)
    ? input.verseTranslations
    : ([] as string[]);
  const hasArabic = arabic.some((t) => t && t.trim());
  const hasEnglish = translations.some((t) => t && t.trim());
  if (!hasArabic && !hasEnglish) return { srtAr: '', srtEn: '' };

  let grid: MergedVerseGrid;
  if (isKaraoke) {
    const introOffset = includeIntroCover ? 1 : 0;
    const merged = mergeVerseGrid(
      normalizedDurs.slice(introOffset),
      arabic.slice(introOffset),
      translations.slice(introOffset)
    );
    grid = introOffset
      ? {
          durations: [normalizedDurs[0], ...merged.durations],
          arabicTexts: ['', ...merged.arabicTexts],
          translationTexts: ['', ...merged.translationTexts],
        }
      : merged;
  } else {
    grid = {
      durations: normalizedDurs,
      arabicTexts: arabic,
      translationTexts: translations,
    };
  }

  // English slots mirror the Arabic grid: silent wherever the Arabic slot is
  // empty (intro cover) or the translation is missing.
  const parallel: string[] = grid.arabicTexts.map((ar, i) =>
    ar && ar.trim() ? grid.translationTexts[i] ?? '' : ''
  );

  const srtAr = hasArabic ? buildSrtFromTimeline(grid.durations, grid.arabicTexts) : '';
  const srtEn = hasEnglish ? buildSrtFromTimeline(grid.durations, parallel) : '';
  return { srtAr, srtEn };
}
