/**
 * Ayah word-level pronunciation engine (تقسيم الآية حسب النطق).
 *
 * Splits a verse into recitation tokens (standalone waqf/pause marks merge
 * into the preceding word), estimates each token's spoken duration weight
 * (letters + diacritics + elongation marks + pause bonuses), derives
 * cumulative start/end ratios inside the verse timeline, and groups tokens
 * into pronunciation segments for the single-line karaoke layout.
 *
 * Pure module — no DOM/canvas: callers pass a width-measure callback.
 * Shared by the live canvas renderer (preview), the export slide renderer,
 * and the server-side word-duration distribution.
 */
import { stripArabicDiacritics } from './quran-utils';

/** Standalone Quranic pause/waqf marks (ۖ ۗ ۘ ۙ ۚ ۛ ۜ ۝ ۞). */
const STANDALONE_PAUSE_RE = /^[\u06D6-\u06DE]+$/;
const TRAILING_PAUSE_RE = /[\u06D6-\u06DC]\s*$/;

const ARABIC_LETTER_RE = /[\u0621-\u064A\u0671-\u06D3]/g;
const DIACRITIC_RE = /[\u064B-\u0652\u0670]/g;
const ELONGATION_RE = /[\u0653-\u0655\u06E4-\u06E6]/g;

export interface AyahWordTiming {
  /** Token index inside the ayah. */
  index: number;
  /** Display text (pause marks already merged into the previous word). */
  text: string;
  /** Relative spoken-duration weight. */
  weight: number;
  /** Cumulative start ratio inside the ayah [0..1]. */
  startRatio: number;
  /** Cumulative end ratio inside the ayah [0..1]. */
  endRatio: number;
  /** True when the token ends with a waqf/pause mark. */
  hasPause: boolean;
}

/** Splits ayah text into display tokens, merging standalone pause marks. */
export function splitAyahTokens(text: string): string[] {
  const raw = (text || '').trim().split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  for (const t of raw) {
    if (STANDALONE_PAUSE_RE.test(t) && tokens.length > 0) {
      tokens[tokens.length - 1] = `${tokens[tokens.length - 1]} ${t}`;
    } else {
      tokens.push(t);
    }
  }
  return tokens;
}

/** Estimates the relative spoken duration of one token. */
export function spokenTokenWeight(token: string): number {
  const letters = (token.match(ARABIC_LETTER_RE) || []).length;
  const stripped = stripArabicDiacritics(token);
  const solidLetters = (stripped.match(ARABIC_LETTER_RE) || []).length;
  const diacritics = (token.match(DIACRITIC_RE) || []).length;
  const elongations = (token.match(ELONGATION_RE) || []).length;
  // Reciters elongate vowels heavily — elongation marks weigh ~⅔ of a letter.
  let w = Math.max(letters, solidLetters) + diacritics * 0.16 + elongations * 0.7;
  if (TRAILING_PAUSE_RE.test(token)) w += 1.8;
  return Math.max(0.8, w);
}

/** Builds the full word-timing table for one ayah. */
export function buildAyahWordTimings(text: string): AyahWordTiming[] {
  const tokens = splitAyahTokens(text);
  if (!tokens.length) return [];
  const weights = tokens.map(spokenTokenWeight);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0;
  return tokens.map((tok, i) => {
    const startRatio = cursor / total;
    cursor += weights[i];
    const endRatio = Math.min(1, cursor / total);
    return {
      index: i,
      text: tok,
      weight: weights[i],
      startRatio,
      endRatio,
      hasPause: TRAILING_PAUSE_RE.test(tok),
    };
  });
}

/**
 * Finds the index of the word being recited at `ratio` (0..1 of the ayah's
 * audio). Returns -1 when nothing is active yet (ratio < first word start).
 */
export function findActiveWordIndex(
  timings: AyahWordTiming[],
  ratio: number
): number {
  if (!timings.length) return -1;
  const r = Math.max(0, Math.min(1, ratio));
  for (let i = timings.length - 1; i >= 0; i--) {
    if (r >= timings[i].startRatio) return i;
  }
  return r > 0 ? 0 : -1;
}

export interface AyahSegment {
  /** Inclusive token range. */
  fromWord: number;
  toWord: number;
  /** Joined display text of the segment. */
  text: string;
  /** Sum of word weights inside the segment. */
  weight: number;
  /** Cumulative start ratio inside the ayah [0..1]. */
  startRatio: number;
  /** Cumulative end ratio inside the ayah [0..1]. */
  endRatio: number;
}

/**
 * Groups ayah words into single-line pronunciation segments: each segment is
 * the widest run of consecutive words that fits `maxWidth` at the current
 * font. Breaks prefer natural waqf (pause) boundaries once the line is at
 * least half full, so segments read like natural recitation phrases.
 */
export function buildAyahSegments(
  timings: AyahWordTiming[],
  maxWidth: number,
  measure: (text: string) => number
): AyahSegment[] {
  const n = timings.length;
  if (!n) return [];
  const join = (from: number, to: number) =>
    timings.slice(from, to + 1).map((w) => w.text).join(' ');
  const makeSegment = (from: number, to: number): AyahSegment => {
    const weight = timings.slice(from, to + 1).reduce((a, w) => a + w.weight, 0);
    return {
      fromWord: from,
      toWord: to,
      text: join(from, to),
      weight,
      startRatio: timings[from].startRatio,
      endRatio: Math.min(1, timings[to].endRatio),
    };
  };

  const segments: AyahSegment[] = [];
  let from = 0;
  while (from < n) {
    // Extend while the run fits on one line.
    let end = from;
    while (end + 1 < n && measure(join(from, end + 1)) <= maxWidth) {
      end++;
    }
    if (end === from) {
      // Single word wider than the line — its own segment (font will shrink).
      segments.push(makeSegment(from, from));
      from++;
      continue;
    }
    // Prefer ending on a pronunciation pause in the latter half of the line
    // when the natural overflow point isn't already a pause boundary.
    let breakAt = end;
    if (!timings[end].hasPause && end + 1 < n) {
      for (let k = end - 1; k > from; k--) {
        if (
          timings[k].hasPause &&
          measure(join(from, k)) >= maxWidth * 0.5
        ) {
          breakAt = k;
          break;
        }
      }
    }
    segments.push(makeSegment(from, breakAt));
    from = breakAt + 1;
  }
  return segments;
}

/** Index of the segment containing the given word index (0 when invalid). */
export function segmentIndexForWord(
  segments: AyahSegment[],
  wordIndex: number
): number {
  if (!segments.length) return 0;
  for (let i = 0; i < segments.length; i++) {
    if (wordIndex >= segments[i].fromWord && wordIndex <= segments[i].toWord) {
      return i;
    }
  }
  if (wordIndex < 0) return 0;
  return segments.length - 1;
}

/**
 * Distributes a verse's real audio duration across estimated word weights,
 * keeping the total exact: clamps each word to a readable minimum then
 * renormalizes so Σdurations === totalSec (no timeline drift).
 */
export function distributeWordDurations(
  weights: number[],
  totalSec: number,
  minWordSec = 0.32
): number[] {
  const n = weights.length;
  if (!n) return [];
  const safeTotal = Math.max(n * minWordSec, Number.isFinite(totalSec) && totalSec > 0 ? totalSec : 0);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => Math.max(minWordSec, (w / sum) * safeTotal));
  const rawSum = raw.reduce((a, b) => a + b, 0);
  if (rawSum <= 0) return new Array(n).fill(safeTotal / n);
  // Renormalize the clamped values back to the exact total.
  const scale = safeTotal / rawSum;
  return raw.map((d) => Math.max(minWordSec, d * scale));
}
