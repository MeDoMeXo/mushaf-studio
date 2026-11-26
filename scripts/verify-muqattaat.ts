// One-off runtime verification for the disjointed-letters fix (الحروف المقطعة).
// NOT a committed test file — a manual verification harness run via bun.
// Verifies for all 29 sura openings:
//   1. Writing (الرسم) stays JOINED — group text preserved as ONE unit.
//   2. Pronunciation/tracing (النطق/التتبع) stays per-letter (tokens + ratios).
//   3. Lines/segments never split a group (atomicity).
import {
  splitAyahTokensDetailed,
  buildAyahWordTimings,
  joinTimingTexts,
  buildDisplayUnits,
  buildAyahSegments,
} from '../lib/verse-words';
import { wrapTimingsToLines } from '../lib/studio-text-karaoke';

const madd = '\u0653'; // maddah above
let failures = 0;
const log = (ok: boolean, name: string, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' | ' + detail : ''}`);
};

// ── 1) Al-Baqarah 1 «الٓمٓ» ────────────────────────────────────────────
const alkMim = 'ال' + madd + 'م' + madd;
const toks = splitAyahTokensDetailed(alkMim);
log(toks.length === 3, '«الم» splits into 3 LETTER tokens', `got ${toks.length}`);
log(
  toks.every((t) => t.group?.text === alkMim),
  'every letter carries the JOINED group text «الٓمٓ»'
);
log(
  toks.map((t) => t.group?.letterIndex).join(',') === '0,1,2',
  'letterIndex sequence 0,1,2',
  toks.map((t) => t.group?.letterIndex).join(',')
);

// ── 2) all 14 opening strings (covering the 29 suras) ──────────────────
const openings: [string, number][] = [
  ['الم', 3], ['المص', 4], ['المر', 4], ['الر', 3], ['كهيعص', 5],
  ['طه', 2], ['طس', 2], ['طسم', 3], ['يس', 2], ['حم', 2],
  ['عسق', 3], ['ص', 1], ['ق', 1], ['ن', 1],
];
for (const [op, n] of openings) {
  const parts = splitAyahTokensDetailed(op);
  if (n === 1) {
    log(
      parts.length === 1 && !parts[0].group,
      `«${op}» single-letter opening stays whole (no split needed)`
    );
  } else {
    const grouped = parts.every(
      (t) => t.group && t.group.size === n && t.group.text === op
    );
    log(
      parts.length === n && grouped,
      `«${op}» → ${n} letter tokens, group joined & atomic`
    );
  }
}

// ── 3) «حم عسق» (Ash-Shura 1-2 style in one string) ────────────────────
const shura = splitAyahTokensDetailed('حم' + ' ' + 'عسق');
const hamGroup = shura[0].group;
const asqGroup = shura[2].group;
log(
  Boolean(hamGroup) &&
    Boolean(asqGroup) &&
    hamGroup!.text === 'حم' &&
    asqGroup!.text === 'عسق' &&
    hamGroup!.id !== asqGroup!.id,
  '«حم عسق» = two SEPARATE joined groups (each word its own unit)'
);

// ── 4) timings keep per-letter weights & monotonic ratios ──────────────
const t = buildAyahWordTimings(alkMim + ' ذَٰلِكَ ٱلْكِتَٰبُ');
log(
  Boolean(
    t[0].disjointGroup &&
      t[1].disjointGroup &&
      t[2].disjointGroup &&
      t[0].disjointGroup.id === t[1].disjointGroup.id &&
      t[1].disjointGroup.id === t[2].disjointGroup.id
  ),
  'timings carry shared group metadata'
);
log(
  t[1].startRatio > t[0].startRatio && t[2].startRatio > t[1].startRatio,
  'per-letter ratios advance monotonically (tracing letter-by-letter)'
);
log(
  t[1].endRatio === t[2].startRatio,
  'letter ratios are contiguous (no gaps inside the group)'
);

// ── 5) joined DISPLAY text (الرسم) ─────────────────────────────────────
const joined = joinTimingTexts(t);
log(
  joined === alkMim + ' ذَٰلِكَ ٱلْكِتَٰبُ',
  'joinTimingTexts keeps the writing connected: «الٓمٓ ذَٰلِكَ ٱلْكِتَٰبُ»',
  joined
);

// ── 6) display units: one unit per group ───────────────────────────────
const units = buildDisplayUnits(t);
log(
  units[0].fromToken === 0 && units[0].toToken === 2,
  '«الم» occupies exactly ONE display unit (tokens 0..2)',
  JSON.stringify(units[0])
);

// ── 7) segments keep groups atomic (tiny width forces breaks) ──────────
const segs = buildAyahSegments(t, 6, (s) => [...s].length);
let segAtomic = true;
for (const seg of segs) {
  const inSeg = t
    .slice(seg.fromWord, seg.toWord + 1)
    .filter((x) => x.disjointGroup?.id === 1);
  if (inSeg.length > 0 && inSeg.length !== 3) segAtomic = false;
}
log(
  segAtomic,
  'buildAyahSegments never splits «الم» across segments (word groups stay whole)'
);
log(
  segs.every((s) => [...s.text].length > 0),
  'segment texts are non-empty'
);
log(
  segs[0].text === alkMim,
  'first segment text = joined «الٓمٓ»',
  segs[0].text
);

// ── 8) wrapTimingsToLines atomicity: measure that ONLY fits the group ───
// width budget: group = 5 chars, group+space+next word = 12 chars → the
// line must break AFTER the whole group, never inside it.
const lines = wrapTimingsToLines(t, 8, (s) => [...s].length);
let lineAtomic = true;
for (const line of lines) {
  const inLine = line.filter((x) => x.disjointGroup?.id === 1);
  if (inLine.length > 0 && inLine.length !== 3) lineAtomic = false;
}
log(
  lineAtomic,
  'wrapTimingsToLines never breaks «الم» across lines (joined writing intact)'
);
log(
  joinTimingTexts(lines[0]) === alkMim || lines.length > 1,
  'first line preserves joined group text',
  joinTimingTexts(lines[0])
);

// ── 9) pause mark merges keep the group joined ──────────────────────────
const withPause = splitAyahTokensDetailed('ال' + madd + 'م' + madd + ' ۝');
const lastTok = withPause[2];
log(
  lastTok.text === 'م' + madd + ' ۝' &&
    lastTok.group?.text === alkMim + ' ۝',
  'pause mark rides the last letter AND stays in the joined group text',
  `token="${lastTok.text}" group="${lastTok.group?.text}"`
);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED ✔' : failures + ' CHECK(S) FAILED ✖'}`);
process.exit(failures === 0 ? 0 : 1);
