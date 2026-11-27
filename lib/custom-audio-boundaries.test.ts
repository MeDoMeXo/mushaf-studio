import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEvenFallbackBounds,
  buildVerseBoundsFromStarts,
  detectBoundariesFromPeakLevels,
  findVerseIndexAtTime,
  formatBoundarySec,
  normalizeManualBounds,
  verseProgressAtTime,
  MIN_VERSE_SEC,
} from './custom-audio-boundaries';

/**
 * محرّك حدود الآيات للملف الصوتي المرفوع — اختبارات الوحدة.
 * كل الحالات مبنية على ذروات نوافذ اصطناعية (0 = سكوت، 1 = صوت) بمقاطع
 * بمدد معروفة، فتكون الحدود المتوقعة قابلة للحساب يدوياً.
 */

const W = 0.05; // نافذة 50ms — الدقة القياسية للمحلّل

/** يبني ذروات نوافذ لمقطع فيه مقاطع صوت وفواصل سكوت بالمدد المعطاة. */
function peaksFromSegments(segments: { sec: number; voice: boolean }[]): {
  peaks: number[];
  durationSec: number;
} {
  const peaks: number[] = [];
  let durationSec = 0;
  for (const seg of segments) {
    const windows = Math.max(1, Math.round(seg.sec / W));
    for (let i = 0; i < windows; i++) peaks.push(seg.voice ? 0.8 : 0.001);
    durationSec += windows * W;
  }
  return { peaks, durationSec };
}

test('detectBoundariesFromPeakLevels finds verse starts from silence gaps', () => {
  // ٣ آيات: 4s صوت، 0.8s سكوت، 5s صوت، 1s سكوت، 6s صوت
  const { peaks, durationSec } = peaksFromSegments([
    { sec: 4, voice: true },
    { sec: 0.8, voice: false },
    { sec: 5, voice: true },
    { sec: 1.0, voice: false },
    { sec: 6, voice: true },
  ]);
  const res = detectBoundariesFromPeakLevels(peaks, 3, W, durationSec, {
    silencePaddingSec: 0.08,
  });
  assert.equal(res.ok, true);
  assert.equal(res.starts.length, 3);
  assert.equal(res.starts[0], 0);
  // بداية الآية الثانية ≈ نهاية السكوت الأول (4.8s) − الهامش (0.08s)
  assert.ok(Math.abs(res.starts[1] - 4.72) < 0.15, `start1=${res.starts[1]}`);
  // بداية الآية الثالثة ≈ نهاية السكوت الثاني (10.8s) − 0.08s
  assert.ok(Math.abs(res.starts[2] - 10.72) < 0.15, `start2=${res.starts[2]}`);
});

test('detectBoundariesFromPeakLevels picks the LONGEST gaps when more silences exist', () => {
  // وقفة قصيرة داخل آية (0.25s) يجب تجاهلها لصالح الفواصل الطويلة
  const { peaks, durationSec } = peaksFromSegments([
    { sec: 2, voice: true },
    { sec: 0.25, voice: false }, // وقفة داخلية — أقصر من minSilence
    { sec: 2, voice: true },
    { sec: 0.9, voice: false }, // فاصل آية حقيقي
    { sec: 3, voice: true },
  ]);
  const res = detectBoundariesFromPeakLevels(peaks, 2, W, durationSec);
  assert.equal(res.ok, true);
  assert.equal(res.starts.length, 2);
  assert.equal(res.starts[0], 0);
  assert.ok(Math.abs(res.starts[1] - 5.0) < 0.2, `start1=${res.starts[1]}`);
});

test('detectBoundariesFromPeakLevels fails politely when gaps are too few', () => {
  // آيتان مطلوبتان لكن لا يوجد أي فاصل
  const { peaks, durationSec } = peaksFromSegments([{ sec: 6, voice: true }]);
  const res = detectBoundariesFromPeakLevels(peaks, 2, W, durationSec);
  assert.equal(res.ok, false);
  assert.equal(res.starts.length, 0);
  assert.ok(res.message && res.message.includes('يدوياً'));
});

test('detectBoundariesFromPeakLevels: single verse resolves to [0]', () => {
  const { peaks, durationSec } = peaksFromSegments([{ sec: 3, voice: true }]);
  const res = detectBoundariesFromPeakLevels(peaks, 1, W, durationSec);
  assert.equal(res.ok, true);
  assert.deepEqual(res.starts, [0]);
});

test('detectBoundariesFromPeakLevels rejects fully silent audio', () => {
  const peaks = new Array(100).fill(0);
  const res = detectBoundariesFromPeakLevels(peaks, 3, W, 5);
  assert.equal(res.ok, false);
  assert.ok(res.message);
});

test('normalizeManualBounds enforces strict ascending order and clamps', () => {
  const norm = normalizeManualBounds([0, 9, 5, 12, 12], 15);
  assert.equal(norm.length, 5);
  assert.equal(norm[0], 0);
  // 9 ثم 5 → 5 تُرفع إلى 9 (تصاعد صارم، لا تراجع)
  assert.ok(norm[1] <= norm[2] && norm[2] <= norm[3] && norm[3] <= norm[4]);
  assert.ok(norm.every((v, i, a) => i === 0 || v >= a[i - 1]));
});

test('normalizeManualBounds clamps to duration and keeps verse0 at zero', () => {
  const norm = normalizeManualBounds([3, 2, 20], 10);
  assert.equal(norm[0], 0); // الآية الأولى تبدأ من الصفر دائماً
  assert.ok(norm[2] <= 10);
});

test('buildEvenFallbackBounds divides duration evenly', () => {
  const starts = buildEvenFallbackBounds(4, 20);
  assert.deepEqual(starts, [0, 5, 10, 15]);
  assert.deepEqual(buildEvenFallbackBounds(0, 10), []);
  assert.deepEqual(buildEvenFallbackBounds(3, 0), []);
});

test('buildVerseBoundsFromStarts builds end from next start / duration', () => {
  const bounds = buildVerseBoundsFromStarts([0, 4, 9], 15);
  assert.equal(bounds.length, 3);
  assert.deepEqual(bounds[0], { start: 0, end: 4 });
  assert.deepEqual(bounds[1], { start: 4, end: 9 });
  assert.deepEqual(bounds[2], { start: 9, end: 15 });
  assert.deepEqual(buildVerseBoundsFromStarts([], 15), []);
});

test('findVerseIndexAtTime locates the active verse', () => {
  const starts = [0, 4.5, 10];
  assert.equal(findVerseIndexAtTime(starts, 0), 0);
  assert.equal(findVerseIndexAtTime(starts, 4.5), 1);
  assert.equal(findVerseIndexAtTime(starts, 5), 1);
  assert.equal(findVerseIndexAtTime(starts, 12.7), 2);
  assert.equal(findVerseIndexAtTime(starts, -1), 0);
});

test('verseProgressAtTime returns 0..1 inside the verse segment', () => {
  const starts = [0, 4, 8];
  assert.equal(verseProgressAtTime(starts, 4, 12), 0); // بداية الآية 2
  assert.ok(Math.abs(verseProgressAtTime(starts, 6, 12) - 0.5) < 1e-9); // منتصفها
  assert.ok(verseProgressAtTime(starts, 11.9, 12) > 0.97); // قرب نهاية الملف
  assert.equal(verseProgressAtTime(starts, 2, 12), 0.5);
});

test('verseProgressAtTime degenerate segment returns 1', () => {
  assert.equal(verseProgressAtTime([0, 4], 5, 4), 1);
});

test('formatBoundarySec renders seconds and minutes', () => {
  // toArabicDigits تحوّل الأرقام فقط وتبقي الفاصلة العشرية كما هي (.)
  const ar = (n: number | string) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  assert.equal(formatBoundarySec(4.25, ar), '٤.٣ ث');
  assert.equal(formatBoundarySec(62, ar), '١:٠٢');
  assert.equal(formatBoundarySec(60, ar), '١:٠٠');
});

test('MIN_VERSE_SEC is a sane positive floor', () => {
  assert.ok(MIN_VERSE_SEC >= 0.2 && MIN_VERSE_SEC <= 0.5);
});
