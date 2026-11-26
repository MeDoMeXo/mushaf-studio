/**
 * Ayah word-level pronunciation engine (تقسيم الآية حسب النطق).
 *
 * Splits a verse into recitation tokens (standalone waqf/pause marks merge
 * into the preceding word), estimates each token's spoken duration weight
 * (letters + diacritics + elongation marks + pause bonuses), derives
 * cumulative start/end ratios inside the verse timeline, and groups tokens
 * into pronunciation segments for the single-line karaoke layout.
 *
 * For the disjointed openings (الحروف المقطعة) the engine keeps THREE
 * dimensions strictly separated:
 *   - النطق (pronunciation): the opening is spoken letter-by-letter
 *     («أَلِفْ لَامْ مِيمْ»), so timing weights are per LETTER.
 *   - الرسم (writing/drawing): the opening stays ONE joined token exactly as
 *     the mushaf writes it («الٓمٓ», «كهيعص») — never drawn as separated
 *     letters. The renderer receives the group metadata to draw it as a
 *     single unit while highlighting still steps letter-by-letter.
 *   - التلوين والتتبع (highlighting/tracing): follows the pronunciation — the
 *     highlight zone advances letter-by-letter INSIDE the joined group.
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

/* ────────────────────────────────────────────────────────────────────────
 * الحروف المقطعة (fawātiḥ) — the 29 surah openings are recited letter by
 * letter: «الم» is spoken «أَلِفْ لَامْ مِيمْ», «كهيعص» as «كَافْ هَا يَا
 * عَيْنْ صَادْ». Text-length weights badly underestimate them (a 3-letter
 * token ≈ ⅓ of its real spoken duration), so the karaoke highlight races
 * ahead of the reciter. The engine therefore:
 *   1. splits an opening into per-LETTER timing tokens — pronunciation,
 *      weighting and tracing all stay letter-by-letter, and
 *   2. weights every letter by its SPOKEN NAME duration (ألف، لام، ميم…)
 *      plus the natural inter-letter breathing reciters take, while
 *   3. attaching disjointGroup metadata to those tokens so every renderer
 *      draws the opening as its ORIGINAL JOINED token («الٓمٓ») — the
 *      writing (الرسم) is never broken, exactly like the mushaf.
 * ──────────────────────────────────────────────────────────────────────── */

/** The 14 disjointed-letter strings, normalized (alef-wasla → plain alef). */
const DISJOINTED_OPENINGS = new Set([
  'الم', 'المص', 'المر', 'الر', 'كهيعص', 'طه', 'طس', 'طسم', 'يس', 'حم',
  'عسق', 'ص', 'ق', 'ن',
]);

/**
 * Spoken-name weights for the 14 disjointed letters. Calibrated against the
 * generic token weights: a two-syllable name (مِيمْ، صَادْ…) ≈ a short
 * 3-letter word with reciter madd; a single-syllable name (هَا، رَا) ≈ a
 * 2-letter word, plus inter-letter breathing baked in.
 */
const LETTER_NAME_WEIGHTS = new Map<string, number>([
  ['ا', 2.9], // أَلِفْ — reciters elongate heavily (أَلِيـــفْ)
  ['ل', 2.5], // لَامْ
  ['م', 2.7], // مِيمْ
  ['ص', 2.6], // صَادْ
  ['ق', 2.6], // قَافْ
  ['ن', 2.6], // نُونْ
  ['ط', 1.9], // طَا
  ['ه', 1.8], // هَا
  ['ي', 1.8], // يَا
  ['ع', 2.7], // عَيْنْ
  ['ك', 2.6], // كَافْ
  ['ر', 1.8], // رَا
  ['س', 2.6], // سِينْ
  ['ح', 1.8], // حَا
]);

/** Marks that may trail a disjointed letter (diacritics, madd, waqf signs). */
const LETTER_TRAILING_MARK_RE = /^[\u064B-\u0655\u0670\u06D6-\u06DD\u06E4-\u06E6\u0640 ]*$/;

/** Reduces a token to its bare Arabic letters (alef-wasla & Farsi yeh folded). */
function normalizeToLetters(token: string): string {
  let out = '';
  for (const ch of token) {
    if (ch === '\u0671') {
      out += '\u0627';
    } else if (ch === '\u06CC') {
      out += '\u064A'; // Farsi yeh → Arabic yeh (defensive: QUL chapter names use it)
    } else if (
      (ch >= '\u0621' && ch <= '\u064A') ||
      (ch >= '\u0671' && ch <= '\u06D3')
    ) {
      out += ch;
    }
  }
  return out;
}

/**
 * Splits a disjointed-opening token into per-letter tokens («الٓمٓ» →
 * «ا»، «لٓ»، «مٓ»), each letter keeping its diacritics/madd; a trailing waqf
 * mark stays attached to the last letter. Returns null when the token is
 * not one of the openings (or is a single letter like «صٓ» — nothing to
 * split, its weight is boosted by spokenTokenWeight instead).
 */
function splitDisjointedToken(token: string): string[] | null {
  const norm = normalizeToLetters(token);
  if (!DISJOINTED_OPENINGS.has(norm) || norm.length < 2) return null;
  const parts: string[] = [];
  let current = '';
  for (const ch of token) {
    const isLetter =
      (ch >= '\u0621' && ch <= '\u064A') || (ch >= '\u0671' && ch <= '\u06D3');
    if (isLetter) {
      if (current) parts.push(current);
      current = ch;
    } else if (current && LETTER_TRAILING_MARK_RE.test(ch)) {
      current += ch; // diacritic / madd / waqf — attaches to its letter
    }
  }
  if (current) parts.push(current);
  return parts.length === norm.length ? parts : null;
}

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
  /** Joined-writing group for disjointed openings (فواتح السور): the token is
   * one LETTER for tracing/timing, but the renderer must draw the group as
   * its original joined token so the writing (الرسم) stays connected. */
  disjointGroup?: DisjointGroupMeta;
}

export interface DisjointGroupMeta {
  /** Unique id within the ayah — shared by every letter token of the group. */
  id: number;
  /** Joined writing text (الرسم) — the ORIGINAL token as the mushaf writes it. */
  text: string;
  /** This letter's position inside the group (0 = first letter). */
  letterIndex: number;
  /** Total letters in the group. */
  size: number;
}

export interface AyahTokenMeta {
  /** Token display text (letters keep their diacritics; pauses merge into the previous token). */
  text: string;
  /** Present when this token is a letter of a disjointed opening (فواتح السور). */
  group?: DisjointGroupMeta;
}

/**
 * Splits ayah text into recitation tokens with disjointed-opening metadata:
 * each opening («الٓمٓ») expands into per-LETTER tokens for pronunciation,
 * weighting and tracing — while every letter carries `group` metadata whose
 * `group.text` is the ORIGINAL joined token, so renderers draw the writing
 * (الرسم) as one connected unit exactly like the mushaf.
 */
export function splitAyahTokensDetailed(text: string): AyahTokenMeta[] {
  const raw = (text || '').trim().split(/\s+/).filter(Boolean);
  const tokens: AyahTokenMeta[] = [];
  let groupId = 0;
  for (const t of raw) {
    const expanded = splitDisjointedToken(t);
    if (expanded) {
      // Letters flow into timing/weight/tracing (النطق حرفاً بحرفاً)…
      groupId++;
      expanded.forEach((letter, li) => {
        tokens.push({
          text: letter,
          group: { id: groupId, text: t, letterIndex: li, size: expanded.length },
        });
      });
    } else if (STANDALONE_PAUSE_RE.test(t) && tokens.length > 0) {
      const prev = tokens[tokens.length - 1];
      prev.text = `${prev.text} ${t}`;
      if (prev.group) {
        // The pause mark rides the last letter — keep the JOINED writing text
        // in sync so the group still renders «الٓمٓ ۝» as one connected unit.
        prev.group.text = `${prev.group.text} ${t}`;
      }
    } else {
      tokens.push({ text: t });
    }
  }
  return tokens;
}

/** Plain-token splitter (timing texts only) — see splitAyahTokensDetailed. */
export function splitAyahTokens(text: string): string[] {
  return splitAyahTokensDetailed(text).map((m) => m.text);
}

/**
 * Estimates the relative spoken duration of one token. Disjointed opening
 * letters are weighted by their spoken NAMES («مٓ» is recited «مِيمْ», not a
 * bare consonant), which is what keeps the highlight locked to the reciter
 * while he spells the opening.
 */
export function spokenTokenWeight(token: string): number {
  const norm = normalizeToLetters(token);
  const nameW = norm.length === 1 ? LETTER_NAME_WEIGHTS.get(norm) : undefined;
  if (nameW !== undefined) {
    // Single disjointed letter («صٓ», «نٓ», or a letter produced by
    // splitAyahTokens expanding an opening): spoken-name duration + waqf.
    return nameW + (TRAILING_PAUSE_RE.test(token) ? 1.8 : 0);
  }
  if (norm.length >= 2 && DISJOINTED_OPENINGS.has(norm)) {
    // Un-split opening token (defensive — splitAyahTokens already expands
    // these): weight the whole group by the sum of its letters' names.
    let sum = 0;
    for (const ch of norm) sum += LETTER_NAME_WEIGHTS.get(ch) ?? 2.4;
    return sum + (TRAILING_PAUSE_RE.test(token) ? 1.8 : 0);
  }
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
  const metas = splitAyahTokensDetailed(text);
  if (!metas.length) return [];
  const weights = metas.map((m) => spokenTokenWeight(m.text));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0;
  return metas.map((m, i) => {
    const startRatio = cursor / total;
    cursor += weights[i];
    const endRatio = Math.min(1, cursor / total);
    return {
      index: i,
      text: m.text,
      weight: weights[i],
      startRatio,
      endRatio,
      hasPause: TRAILING_PAUSE_RE.test(m.text),
      disjointGroup: m.group ? { ...m.group } : undefined,
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

export interface AyahDisplayUnit {
  /** Inclusive token range of the unit (a word, or a whole disjointed group). */
  fromToken: number;
  toToken: number;
}

/** True when tokens[startIdx] begins a fully-present disjointed group. */
function isCompleteGroupAt(
  tokens: AyahWordTiming[],
  startIdx: number,
  g: DisjointGroupMeta
): boolean {
  if (startIdx + g.size > tokens.length) return false;
  for (let k = 0; k < g.size; k++) {
    const t = tokens[startIdx + k].disjointGroup;
    if (!t || t.id !== g.id || t.letterIndex !== k) return false;
  }
  return true;
}

/**
 * Display units: plain words stay individual units, while the letters of a
 * disjointed opening fuse into ONE unit — the writing (الرسم) must never
 * break across lines or segments even though tracing stays letter-by-letter.
 */
export function buildDisplayUnits(tokens: AyahWordTiming[]): AyahDisplayUnit[] {
  const units: AyahDisplayUnit[] = [];
  let i = 0;
  while (i < tokens.length) {
    const g = tokens[i].disjointGroup;
    if (g && g.letterIndex === 0 && isCompleteGroupAt(tokens, i, g)) {
      units.push({ fromToken: i, toToken: i + g.size - 1 });
      i += g.size;
    } else {
      // Orphan group letter (defensive — atomic upstream makes this rare):
      // fall back to a single-token unit instead of dropping the letter.
      units.push({ fromToken: i, toToken: i });
      i++;
    }
  }
  return units;
}

/**
 * Joins timing tokens into display text with JOINED writing for disjointed
 * openings — the group renders as its original mushaf token («الٓمٓ») while
 * plain tokens stay space-separated. Shared by the renderer, the line
 * wrapper and the segment builder so they all agree on the drawn width.
 */
export function joinTimingTexts(tokens: AyahWordTiming[]): string {
  const parts: string[] = [];
  for (const u of buildDisplayUnits(tokens)) {
    parts.push(joinUnitText(tokens, u));
  }
  return parts.join(' ');
}

/** Joined writing text of one display unit. */
function joinUnitText(tokens: AyahWordTiming[], u: AyahDisplayUnit): string {
  const g = tokens[u.fromToken].disjointGroup;
  if (u.toToken > u.fromToken && g) return g.text;
  return tokens[u.fromToken].text;
}

export interface AyahSegment {
  /** Inclusive token range. */
  fromWord: number;
  toWord: number;
  /** Joined display text of the segment (disjointed groups stay connected). */
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
 * the widest run of consecutive DISPLAY UNITS (words or whole disjointed
 * groups — a group is never split, keeping the writing connected) that fits
 * `maxWidth` at the current font. Breaks prefer natural waqf (pause)
 * boundaries once the line is at least half full, so segments read like
 * natural recitation phrases.
 */
export function buildAyahSegments(
  timings: AyahWordTiming[],
  maxWidth: number,
  measure: (text: string) => number
): AyahSegment[] {
  const n = timings.length;
  if (!n) return [];
  const units = buildDisplayUnits(timings);
  const join = (from: number, to: number) =>
    joinTimingTexts(timings.slice(from, to + 1));
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
  // Pause flag of a unit rides its LAST token (waqf marks trail the word).
  const unitHasPause = (u: AyahDisplayUnit) => timings[u.toToken].hasPause;

  const segments: AyahSegment[] = [];
  let from = 0;
  while (from < units.length) {
    // Extend while the run fits on one line.
    let end = from;
    while (
      end + 1 < units.length &&
      measure(join(units[from].fromToken, units[end + 1].toToken)) <= maxWidth
    ) {
      end++;
    }
    if (end === from) {
      // Single unit wider than the line — its own segment (font will shrink).
      segments.push(makeSegment(units[from].fromToken, units[from].toToken));
      from++;
      continue;
    }
    // Prefer ending on a pronunciation pause in the latter half of the line
    // when the natural overflow point isn't already a pause boundary.
    let breakAt = end;
    if (!unitHasPause(units[end]) && end + 1 < units.length) {
      for (let k = end - 1; k > from; k--) {
        if (
          unitHasPause(units[k]) &&
          measure(join(units[from].fromToken, units[k].toToken)) >= maxWidth * 0.5
        ) {
          breakAt = k;
          break;
        }
      }
    }
    segments.push(makeSegment(units[from].fromToken, units[breakAt].toToken));
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
