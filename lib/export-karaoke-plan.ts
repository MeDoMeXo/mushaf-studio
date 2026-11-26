/**
 * Karaoke export plan — word/segment-granular slide timeline builder.
 * Split from lib/export-pipeline.ts per the 600-line file rule. Mirrors the
 * drawMainText layout math (same safe column, same scaled font) so exported
 * segments match the live preview one-to-one.
 */
import type { QulVerse, StudioState } from '@/lib/quran-data';
import { computeSafeTextColumn } from '@/lib/studio-text-karaoke';
import {
  buildAyahSegments,
  buildAyahWordTimings,
  type AyahWordTiming,
} from '@/lib/verse-words';
import { resolveCanvasFontFamily } from '@/lib/studio-renderer-shared';
import { MAX_WORD_SLIDES } from '@/lib/video-export';

export interface KaraokeTimelineEntry {
  /** Index of the verse inside selectedVerses. */
  verseIdx: number;
  /** Word being recited on this slide (segment-first word for segment slides). */
  wordIdx: number;
  /** Relative spoken-duration weight inside the verse. */
  weight: number;
}

export interface KaraokeExportPlan {
  entries: KaraokeTimelineEntry[];
  /** Verse texts aligned slide-by-slide (verse text on its first slide, '' otherwise). */
  alignedVerseTexts: string[];
  totalSlides: number;
}

/**
 * Builds the word/segment-granular slide timeline for karaoke exports.
 * Mirrors drawMainText layout math exactly (same safe column, same scaled
 * font) so exported segments match the live preview one-to-one.
 * Returns null when the design doesn't need tracking or the slide count
 * would explode past MAX_WORD_SLIDES (long surahs fall back to verse slides).
 */
export function buildKaraokeExportPlan(
  studioState: StudioState,
  selectedVerses: QulVerse[],
  targetDims: { width: number; height: number },
  includeIntroCover: boolean
): KaraokeExportPlan | null {
  if (
    typeof document === 'undefined' ||
    !selectedVerses.length ||
    studioState.hideVerses === true ||
    studioState.coverMode === true ||
    studioState.textSource === 'translation'
  ) {
    return null;
  }

  const singleMode = (studioState.verseLineMode || 'wrap') === 'single';
  const wordTracking = studioState.wordHighlight === true;
  if (!singleMode && !wordTracking) return null;

  const renderState: StudioState = { ...studioState, width: targetDims.width, height: targetDims.height };
  const { maxW } = computeSafeTextColumn(renderState);
  const scaleFactor = Math.min(targetDims.width, targetDims.height) / 1080;
  const fontPx = Math.max(12, Math.round((studioState.fontSize || 86) * scaleFactor));
  const weight = studioState.fontWeight || 400;

  const probe = document.createElement('canvas');
  probe.width = 8;
  probe.height = 8;
  const pctx = probe.getContext('2d');
  if (!pctx) return null;
  pctx.font = `${weight} ${fontPx}px ${resolveCanvasFontFamily(studioState.fontFamily)}`;
  const measure = (s: string) => pctx.measureText(s).width;

  const entries: KaraokeTimelineEntry[] = [];
  const aligned: string[] = [];

  for (let vIdx = 0; vIdx < selectedVerses.length; vIdx++) {
    const text = selectedVerses[vIdx].text_uthmani ?? '';
    const timings: AyahWordTiming[] = text.trim() ? buildAyahWordTimings(text) : [];
    if (!timings.length) continue;

    let wordsPerSlide: { fromWord: number; toWord: number; weight: number }[];
    if (singleMode && !wordTracking) {
      // One slide per pronunciation segment — its first word drives the layout.
      const segs = buildAyahSegments(timings, maxW, measure);
      wordsPerSlide = segs.map((s) => ({
        fromWord: s.fromWord,
        toWord: s.toWord,
        weight: s.weight,
      }));
    } else {
      // Word-by-word tracking (single mode shows the word's segment).
      wordsPerSlide = timings.map((t) => ({
        fromWord: t.index,
        toWord: t.index,
        weight: t.weight,
      }));
    }

    for (const slide of wordsPerSlide) {
      entries.push({ verseIdx: vIdx, wordIdx: slide.fromWord, weight: slide.weight });
      aligned.push('');
    }
    if (wordsPerSlide.length) aligned[aligned.length - wordsPerSlide.length] = text;
  }

  if (!entries.length) return null;
  const totalSlides = entries.length + (includeIntroCover ? 1 : 0);
  if (totalSlides > MAX_WORD_SLIDES) return null;

  const alignedVerseTexts = includeIntroCover ? ['', ...aligned] : aligned;
  return { entries, alignedVerseTexts, totalSlides };
}
