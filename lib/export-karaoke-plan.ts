/**
 * Karaoke export plan — word/segment-granular slide timeline builder.
 * Split from lib/export-pipeline.ts per the 600-line file rule. Mirrors the
 * drawMainText layout math (same safe column, same scaled font) so exported
 * segments match the live preview one-to-one.
 *
 * Graceful degradation: a long selection can overflow MAX_WORD_SLIDES with
 * word-granular slides. Instead of silently dropping the word tracking (the
 * preview tracked while the export lost it entirely — the exact regression
 * this guards against), the plan degrades to SEGMENT-granular slides whose
 * highlight covers the whole recited phrase (wordIdx..wordTo range). Only
 * when even segments overflow does it return null (per-verse fallback).
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
  /**
   * Inclusive highlight-range end. Present on segment slides (the whole
   * phrase [wordIdx..wordTo] highlights); absent on word slides so the
   * renderer keeps letter-by-letter tracing inside disjointed openings.
   */
  wordTo?: number;
  /** Relative spoken-duration weight inside the verse. */
  weight: number;
}

export interface KaraokeExportPlan {
  entries: KaraokeTimelineEntry[];
  /** Verse texts aligned slide-by-slide (verse text on its first slide, '' otherwise). */
  alignedVerseTexts: string[];
  totalSlides: number;
  /** 'word' = per-word slides · 'segment' = phrase-level (degraded long selections). */
  granularity: 'word' | 'segment';
}

/** One slide spec before it becomes a timeline entry. */
interface SlideSpec {
  verseIdx: number;
  fromWord: number;
  toWord: number;
  weight: number;
}

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

  // Word-level slide specs (wordTracking on, either line mode): one slide per
  // recited token — disjointed-opening LETTERS included, so the highlight
  // steps letter-by-letter exactly like the live preview.
  const buildWordSlides = (vIdx: number, timings: AyahWordTiming[]): SlideSpec[] =>
    timings.map((t) => ({
      verseIdx: vIdx,
      fromWord: t.index,
      toWord: t.index,
      weight: t.weight,
    }));

  // Segment-level slide specs: one slide per pronunciation phrase — the
  // highlight range covers the whole phrase [fromWord..toWord].
  const buildSegmentSlides = (vIdx: number, timings: AyahWordTiming[]): SlideSpec[] =>
    buildAyahSegments(timings, maxW, measure).map((s) => ({
      verseIdx: vIdx,
      fromWord: s.fromWord,
      toWord: s.toWord,
      weight: s.weight,
    }));

  const verseTimings: AyahWordTiming[][] = selectedVerses.map((v) => {
    const text = v.text_uthmani ?? '';
    return text.trim() ? buildAyahWordTimings(text) : [];
  });

  const finalize = (
    specs: SlideSpec[],
    granularity: 'word' | 'segment'
  ): KaraokeExportPlan | null => {
    if (!specs.length) return null;
    const entries: KaraokeTimelineEntry[] = specs.map((s) =>
      granularity === 'segment'
        ? { verseIdx: s.verseIdx, wordIdx: s.fromWord, wordTo: s.toWord, weight: s.weight }
        : { verseIdx: s.verseIdx, wordIdx: s.fromWord, weight: s.weight }
    );
    const aligned: string[] = entries.map(() => '');
    let lastVerse = -1;
    entries.forEach((e, i) => {
      if (e.verseIdx !== lastVerse) {
        lastVerse = e.verseIdx;
        aligned[i] = selectedVerses[e.verseIdx]?.text_uthmani ?? '';
      }
    });
    const alignedVerseTexts = includeIntroCover ? ['', ...aligned] : aligned;
    const totalSlides = entries.length + (includeIntroCover ? 1 : 0);
    if (totalSlides > MAX_WORD_SLIDES) return null;
    return { entries, alignedVerseTexts, totalSlides, granularity };
  };

  // Single-line mode without word tracking: segment slides (existing
  // behavior — the visible segment follows the audio, no highlight).
  if (singleMode && !wordTracking) {
    const specs = verseTimings.flatMap((timings, vIdx) =>
      timings.length ? buildSegmentSlides(vIdx, timings) : []
    );
    return finalize(specs, 'segment');
  }

  // Word tracking: word slides first — the premium export the user sees in
  // the live preview (highlight moves word by word, letter by letter).
  const wordSpecs = verseTimings.flatMap((timings, vIdx) =>
    timings.length ? buildWordSlides(vIdx, timings) : []
  );
  const wordPlan = finalize(wordSpecs, 'word');
  if (wordPlan) return wordPlan;

  // Degradation: too many words for the slide ceiling → phrase-granular
  // slides keep the highlight alive (the whole recited phrase lights up and
  // the band advances phrase by phrase) instead of losing tracking silently.
  const segmentSpecs = verseTimings.flatMap((timings, vIdx) =>
    timings.length ? buildSegmentSlides(vIdx, timings) : []
  );
  return finalize(segmentSpecs, 'segment');
}
