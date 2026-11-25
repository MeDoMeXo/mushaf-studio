import test from 'node:test';
import assert from 'node:assert/strict';
import { isReciterVerseSynced, parseAyatTimingResponse } from './mp3quran-timing';
import type { ReciterOption } from './quran-data-types';

test('isReciterVerseSynced correctly identifies verse-synced vs full-surah reciters', () => {
  const alafasy: ReciterOption = {
    slug: 'ar.alafasy',
    name: 'مشاري العفاسي',
    style: 'murattal',
    styleLabel: 'مرتل',
    bitrate: 128,
    source: 'islamic',
  };
  const qatami: ReciterOption = {
    slug: 'ea.nasseralqatami',
    name: 'ناصر القطامي',
    style: 'murattal',
    styleLabel: 'مرتل',
    bitrate: 128,
    source: 'everyayah',
  };
  const salimiWithReadId: ReciterOption = {
    slug: 'mq.mansoursalimi',
    name: 'منصور السالمي',
    style: 'murattal',
    styleLabel: 'مرتل',
    bitrate: 128,
    source: 'mp3quran',
    mp3quranReadId: 245,
  };
  const sobhiWithoutReadId: ReciterOption = {
    slug: 'mq.islamsobhi',
    name: 'إسلام صبحي',
    style: 'murattal',
    styleLabel: 'مرتل',
    bitrate: 128,
    source: 'mp3quran',
  };

  assert.equal(isReciterVerseSynced(alafasy), true);
  assert.equal(isReciterVerseSynced(qatami), true);
  assert.equal(isReciterVerseSynced(salimiWithReadId), false);
  assert.equal(isReciterVerseSynced(sobhiWithoutReadId), false);
});

test('parseAyatTimingResponse correctly extracts ayah millisecond boundaries into seconds', () => {
  const mockApiData = [
    { ayah: 1, start_time: 1440, end_time: 7080 },
    { ayah: 2, start_time: 7080, end_time: 13080 },
    { ayah: 3, start_time: 13080, end_time: 17500 },
  ];

  const parsed = parseAyatTimingResponse(mockApiData);
  assert.equal(parsed.size, 3);

  const ayah1 = parsed.get(1);
  assert.ok(ayah1);
  assert.equal(ayah1.startSec, 1.44);
  assert.equal(ayah1.endSec, 7.08);
  assert.equal(ayah1.durationSec, 5.64);

  const ayah2 = parsed.get(2);
  assert.ok(ayah2);
  assert.equal(ayah2.startSec, 7.08);
  assert.equal(ayah2.endSec, 13.08);
  assert.equal(ayah2.durationSec, 6.0);
});

test('getOrSliceVerseAudio fetches timing and slices verse 1 for Mansour Al-Salimi', async () => {
  const salimi: ReciterOption = {
    slug: 'mq.mansoursalimi',
    name: 'منصور السالمي',
    style: 'murattal',
    styleLabel: 'مرتل',
    bitrate: 128,
    source: 'mp3quran',
    mp3quranServer: 'https://cdn.mp3quran.net/audio/mansour-salimi/r1/',
    mp3quranReadId: 245,
  };

  const { getOrSliceVerseAudio } = await import('./mp3quran-timing');
  const buf = await getOrSliceVerseAudio(salimi, 1);
  assert.ok(buf);
  assert.ok(buf.byteLength > 1000);
});
