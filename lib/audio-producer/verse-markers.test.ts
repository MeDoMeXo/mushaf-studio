/**
 * اختبارات تحرير موضع الآيات (verse-markers): القيود بين الجيران بفجوة
 * دنيا، عدم التغيير = null، والإزاحة الموجبة/السالبة عبر نفس المسار.
 */
import test from 'node:test';
import assert from 'node:assert';
import {
  MIN_VERSE_GAP_SEC,
  clampVerseMarkerSec,
  moveVerseMarker,
  nudgeVerseMarker,
} from './verse-markers';

const MARKERS = [0, 4.2, 8.9, 13.5];
const DUR = 18.7;

test('clampVerseMarkerSec: bounded by neighbours ± min gap', () => {
  // idx=1: أدنى = سابقتها 0 + 0.4، وأعلى = تاليها 8.9 - 0.4 = 8.5
  assert.equal(clampVerseMarkerSec(MARKERS, DUR, 1, -5), 0.4);
  assert.equal(clampVerseMarkerSec(MARKERS, DUR, 1, 100), 8.5);
  assert.equal(clampVerseMarkerSec(MARKERS, DUR, 1, 3.0), 3.0);
});

test('clampVerseMarkerSec: first marker floor 0, last marker capped at duration', () => {
  assert.equal(clampVerseMarkerSec(MARKERS, DUR, 0, -3), 0);
  // آخر علامة (13.5): لا تالي → الحد الأعلى = نهاية المصدر.
  assert.equal(clampVerseMarkerSec(MARKERS, DUR, 3, 999), DUR);
  // بين السابقة+الفجوة (9.3) والنهاية — قيمة داخل المدى تمر كما هي.
  assert.equal(clampVerseMarkerSec(MARKERS, DUR, 3, 11), 11);
  assert.equal(clampVerseMarkerSec(MARKERS, DUR, 3, 5), 9.3, 'floored onto previous gap');
});

test('moveVerseMarker: returns new array, no mutation, null on no-change', () => {
  const before = [...MARKERS];
  const next = moveVerseMarker(MARKERS, DUR, 1, 3.0);
  assert.ok(next, 'valid move returns a new array');
  assert.equal(next![1], 3.0);
  assert.deepEqual(MARKERS, before, 'input untouched');
  assert.equal(moveVerseMarker(MARKERS, DUR, 1, 4.2), null, 'same value → null');
  assert.equal(moveVerseMarker(MARKERS, DUR, 9, 5), null, 'bad index → null');
});

test('moveVerseMarker: clamps into legal range, rounds to ms', () => {
  const next = moveVerseMarker(MARKERS, DUR, 1, 999);
  assert.equal(next![1], 8.5, 'clamped high into gap before next marker');
  const next2 = moveVerseMarker(MARKERS, DUR, 2, 4.87654);
  assert.equal(next2![2], 4.877, 'rounded to milliseconds');
});

test('nudgeVerseMarker: positive and negative travel through clamp', () => {
  const right = nudgeVerseMarker(MARKERS, DUR, 2, +0.5);
  assert.equal(right![2], 9.4);
  const left = nudgeVerseMarker(MARKERS, DUR, 2, -0.5);
  assert.equal(left![2], 8.4);
  // إزاحة ضخمة تُقيَّد — لا تكسر الترتيب أبداً.
  const big = nudgeVerseMarker(MARKERS, DUR, 1, -50);
  assert.ok((big![1] as number) > MARKERS[0], 'stays after previous marker');
});

test('min gap constant keeps verses separable', () => {
  assert.ok(MIN_VERSE_GAP_SEC >= 0.4, 'gap floor at least 0.4s');
});
