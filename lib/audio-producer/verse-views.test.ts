/**
 * اختبارات اشتقاق مقاطع الآيات (verse-views) لعرض الخط الزمني والمكتبة:
 * الحدود من العلامات (آخر آية حتى نهاية المصدر)، تراكب المحفوظ من
 * فترات التحرير وحالات (محفوظة/مقصوصة جزئياً/محذوفة)، والحدود الطرفية.
 */
import test from 'node:test';
import assert from 'node:assert';
import { buildVerseViews, verseStatusOf } from './verse-views';
import { createInitialEditState, type ProducerEditState } from './audio-producer-edit';
import type { ProducerSource } from './audio-producer-engine';

function fakeSource(verseMarkersSec: number[], durationSec: number): ProducerSource {
  return {
    buffer: {} as AudioBuffer,
    durationSec,
    sampleRate: 8000,
    verseMarkersSec,
    verseNumbers: verseMarkersSec.map((_, i) => i + 1),
    label: 'اختبار',
    kind: 'verses',
  };
}

test('verseStatusOf: removed/partial/kept boundaries', () => {
  assert.equal(verseStatusOf(5, 0), 'removed');
  assert.equal(verseStatusOf(5, 0.005), 'removed');
  assert.equal(verseStatusOf(5, 4.9), 'partial');
  assert.equal(verseStatusOf(5, 4.997), 'kept');
});

test('buildVerseViews: spans derive from markers, last verse to source end', () => {
  const src = fakeSource([0, 3.5, 6], 9.25);
  const views = buildVerseViews(src, createInitialEditState(9.25));
  assert.equal(views.length, 3);
  assert.equal(views[0].startSec, 0);
  assert.equal(views[0].endSec, 3.5);
  assert.equal(views[2].startSec, 6);
  assert.equal(views[2].endSec, 9.25);
  assert.ok(Math.abs(views[2].totalSec - 3.25) < 1e-9);
  assert.equal(views[1].number, 2);
});

test('buildVerseViews: kept reflects intervals overlap of the edit state', () => {
  const src = fakeSource([0, 4, 8], 12);
  // interval محفوظ واحد يغطي النصف الأول فقط
  const edit: ProducerEditState = {
    durationSec: 12,
    intervals: [{ id: 1, startSec: 0, endSec: 6, gainDb: 0, fadeInSec: 0, fadeOutSec: 0 }],
    masterGainDb: 0,
    normalize: false,
    nextId: 2,
  };
  const views = buildVerseViews(src, edit);
  // الآية ١: [0,4] كاملة داخل المحفوظ => kept
  assert.ok(Math.abs(views[0].keptSec - 4) < 1e-9);
  assert.equal(views[0].status, 'kept');
  // الآية ٢: [4,8] تحتفظ بـ [4,6] => partial
  assert.ok(Math.abs(views[1].keptSec - 2) < 1e-9);
  assert.equal(views[1].status, 'partial');
  // الآية ٣: [8,12] خارج المحفوظ => removed
  assert.ok(Math.abs(views[2].keptSec) < 1e-9);
  assert.equal(views[2].status, 'removed');
});

test('buildVerseViews: empty markers yield empty views', () => {
  const src = fakeSource([], 5);
  assert.deepEqual(buildVerseViews(src, createInitialEditState(5)), []);
});

test('buildVerseViews: no edit state keeps whole spans', () => {
  const src = fakeSource([0, 2], 4);
  const views = buildVerseViews(src, null);
  assert.ok(Math.abs(views[0].keptSec - 2) < 1e-9);
  assert.equal(views[0].status, 'kept');
});
