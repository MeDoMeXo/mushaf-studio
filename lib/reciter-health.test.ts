import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECITER_HEALTH_SAMPLE_VERSE,
  checkAllRecitersHealth,
  getReciterProbeUrl,
  isHealthyStatus,
  probeSingleReciterHealth,
  renderHealthReport,
  resolveProbeUrlForReciter,
  toHealthResult,
} from './reciter-health';

test('getReciterProbeUrl resolves both islamic and everyayah upstreams for the sample verse', () => {
  // Built-in EveryAyah reciters resolve directly to EveryAyah CDN
  assert.match(
    getReciterProbeUrl('ar.alafasy'),
    /everyayah\.com\/data\/Alafasy_128kbps\/001001\.mp3$/
  );
  assert.match(
    getReciterProbeUrl('ea.yasseraldossari'),
    /everyayah\.com\/data\/Yasser_Ad-Dussary_128kbps\/001001\.mp3$/
  );
  // Unknown slug falls back to the first reciter (ar.alafasy)
  assert.match(getReciterProbeUrl('does.not.exist'), /Alafasy_128kbps\/001001\.mp3$/);

  // Custom Islamic Network reciter probe resolves to Islamic Network upstream
  const dummyIslamic = {
    slug: 'custom.legacy_islamic',
    name: 'قارئ شبكة إسلامية',
    style: 'murattal' as const,
    styleLabel: 'مرتل',
    source: 'islamic' as const,
    bitrate: 128 as const,
  };
  assert.match(
    resolveProbeUrlForReciter(dummyIslamic),
    /cdn\.islamic\.network\/quran\/audio\/128\/custom\.legacy_islamic\/1\.mp3$/
  );
});

test('isHealthyStatus accepts 200/206/405 and rejects everything else', () => {
  assert.equal(isHealthyStatus(200), true);
  assert.equal(isHealthyStatus(206), true);
  assert.equal(isHealthyStatus(405), true); // HEAD rejected but GET works
  assert.equal(isHealthyStatus(null), false); // network error
  assert.equal(isHealthyStatus(403), false);
  assert.equal(isHealthyStatus(404), false);
  assert.equal(isHealthyStatus(502), false);
});

test('toHealthResult maps a probe outcome into a structured row', () => {
  const okRow = toHealthResult(
    { slug: 'ar.alafasy', name: 'مشاري راشد العفاسي', source: 'islamic' },
    'https://cdn.islamic.network/128/ar.alafasy/1.mp3',
    { ok: true, status: 200 },
    120
  );
  assert.equal(okRow.ok, true);
  assert.equal(okRow.status, 200);
  assert.equal(okRow.ms, 120);
  assert.equal(okRow.source, 'islamic');
  assert.equal(okRow.error, undefined);

  const brokenRow = toHealthResult(
    { slug: 'ea.yasseraldossary', name: 'ياسر الدوسري', source: 'everyayah' },
    'https://everyayah.com/Yasser_Ad-Dussary_128kbps/001001.mp3',
    { ok: false, status: null, error: 'timeout' },
    10000
  );
  assert.equal(brokenRow.ok, false);
  assert.equal(brokenRow.status, null);
  assert.equal(brokenRow.error, 'timeout');
});

test('renderHealthReport summarizes totals and marks broken reciters', () => {
  const report = {
    checkedAt: '2026-11-23T00:00:00.000Z',
    total: 2,
    healthy: 1,
    broken: 1,
    results: [
      {
        slug: 'ar.alafasy',
        name: 'مشاري راشد العفاسي',
        source: 'islamic' as const,
        url: 'u1',
        ok: true,
        status: 200,
        ms: 80,
      },
      {
        slug: 'ea.x',
        name: 'قارئ مكسور',
        source: 'everyayah' as const,
        url: 'u2',
        ok: false,
        status: null,
        error: 'ENOTFOUND',
        ms: 3000,
      },
    ],
  };
  const out = renderHealthReport(report);
  assert.match(out, /الإجمالي: 2 · سليم: 1 · معطّل: 1/);
  assert.match(out, /✓ ar\.alafasy/);
  assert.match(out, /✗ ea\.x .*ENOTFOUND/);
});

test('sample verse stays pinned to Al-Fatiha 1:1 so probe URLs are deterministic', () => {
  assert.equal(RECITER_HEALTH_SAMPLE_VERSE, 1);
});

test('resolveProbeUrlForReciter supports everyayah, mp3quran, and islamic network sources', () => {
  const eaReciter = {
    slug: 'ea.custom',
    name: 'تخصيص',
    style: 'murattal' as const,
    styleLabel: 'مرتل',
    bitrate: 128 as const,
    source: 'everyayah' as const,
    everyayahFolder: 'Custom_Folder',
  };
  assert.equal(
    resolveProbeUrlForReciter(eaReciter),
    'https://everyayah.com/data/Custom_Folder/001001.mp3'
  );

  const mqReciter = {
    slug: 'mq.custom',
    name: 'تخصيص mp3quran',
    style: 'murattal' as const,
    styleLabel: 'مرتل',
    bitrate: 128 as const,
    source: 'mp3quran' as const,
    mp3quranServer: 'https://cdn.mp3quran.net/audio/custom/r1/',
  };
  assert.equal(
    resolveProbeUrlForReciter(mqReciter),
    'https://cdn.mp3quran.net/audio/custom/r1/001.mp3'
  );

  const islamicReciter = {
    slug: 'ar.alafasy',
    name: 'مشاري راشد العفاسي',
    style: 'murattal' as const,
    styleLabel: 'مرتل',
    bitrate: 128 as const,
    source: 'islamic' as const,
  };
  assert.equal(
    resolveProbeUrlForReciter(islamicReciter),
    'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3'
  );

  // In browser context (window defined):
  (globalThis as { window?: unknown }).window = {};
  assert.equal(
    resolveProbeUrlForReciter(islamicReciter),
    '/api/audio/ar.alafasy/1'
  );
  delete (globalThis as { window?: unknown }).window;
});

test('probeSingleReciterHealth uses mock fetchImpl and returns structured result', async () => {
  const mockFetch = async () => new Response(null, { status: 200 });
  const reciter = {
    slug: 'mock.reciter',
    name: 'قارئ وهمي',
    style: 'murattal' as const,
    styleLabel: 'مرتل',
    bitrate: 128 as const,
    source: 'mp3quran' as const,
    mp3quranServer: 'https://cdn.mp3quran.net/audio/mock/r1/',
  };
  const result = await probeSingleReciterHealth(reciter, 2000, mockFetch as unknown as typeof fetch);
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.slug, 'mock.reciter');
});
