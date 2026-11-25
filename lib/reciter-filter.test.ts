import test from 'node:test';
import assert from 'node:assert/strict';
import { RECITERS } from './quran-data';
import {
  filterAndSortReciters,
  getActiveReciters,
  getAllAdminReciters,
  getReaderPlaybackAudioUrl,
  resolveReciterOption,
  toggleFavoriteReciterSlug,
} from './reciter-filter';

test('resolveReciterOption returns matched reciter or defaults safely to first reciter', () => {
  assert.equal(resolveReciterOption('ea.yasseraldossari').name, 'ياسر الدوسري');
  assert.equal(resolveReciterOption('nonexistent.slug').slug, RECITERS[0].slug);
  assert.equal(resolveReciterOption(null).slug, RECITERS[0].slug);
});

test('toggleFavoriteReciterSlug adds and removes reciter slugs without duplicates', () => {
  const added = toggleFavoriteReciterSlug([], 'ea.yasseraldossari');
  assert.deepEqual(added, ['ea.yasseraldossari']);

  const second = toggleFavoriteReciterSlug(added, 'ar.husary');
  assert.deepEqual(second, ['ar.husary', 'ea.yasseraldossari']);

  const removed = toggleFavoriteReciterSlug(second, 'ea.yasseraldossari');
  assert.deepEqual(removed, ['ar.husary']);
});

test('filterAndSortReciters filters by style tab, favorites, and Arabic search query', () => {
  const warsh = filterAndSortReciters(RECITERS, {
    query: '',
    tab: 'warsh',
    favoriteSlugs: [],
  });
  assert.ok(warsh.length >= 3);
  assert.ok(warsh.every((r) => r.style === 'warsh'));

  const byCountry = filterAndSortReciters(RECITERS, {
    query: 'الجزائر',
    tab: 'all',
    favoriteSlugs: [],
  });
  assert.ok(byCountry.length >= 1);
  assert.ok(byCountry.some((r) => r.slug === 'ea.warsh_yassin_jazairi'));

  const favSorted = filterAndSortReciters(RECITERS, {
    query: '',
    tab: 'all',
    favoriteSlugs: ['ea.husary_muallim'],
  });
  assert.equal(favSorted[0].slug, 'ea.husary_muallim');

  const favOnly = filterAndSortReciters(RECITERS, {
    query: '',
    tab: 'favorites',
    favoriteSlugs: ['ea.yasseraldossari', 'ar.minshawi'],
  });
  assert.equal(favOnly.length, 2);
});

test('getReaderPlaybackAudioUrl routes EveryAyah reciters directly to CDN and Islamic Network via same-origin proxy', () => {
  assert.equal(
    getReaderPlaybackAudioUrl('ea.yasseraldossari', 1),
    'https://everyayah.com/data/Yasser_Ad-Dussary_128kbps/001001.mp3'
  );
  assert.equal(
    getReaderPlaybackAudioUrl('ar.alafasy', 1),
    'https://everyayah.com/data/Alafasy_128kbps/001001.mp3'
  );
  assert.equal(
    getReaderPlaybackAudioUrl('ea.warsh_yassin_jazairi', 8),
    'https://everyayah.com/data/warsh/warsh_yassin_al_jazaery_64kbps/002001.mp3'
  );
});

test('getActiveReciters and getAllAdminReciters handle custom and disabled reciters', () => {
  const dummyCustom = {
    slug: 'custom.testreciter',
    name: 'قارئ تجريبي',
    style: 'murattal' as const,
    styleLabel: 'مرتل',
    bitrate: 128 as const,
    source: 'mp3quran' as const,
    mp3quranServer: 'https://cdn.mp3quran.net/audio/test/r1/',
  };

  const active = getActiveReciters([dummyCustom], ['ar.alafasy']);
  assert.ok(active.some((r) => r.slug === 'custom.testreciter'));
  assert.ok(!active.some((r) => r.slug === 'ar.alafasy'));

  const allAdmin = getAllAdminReciters([dummyCustom], ['ar.alafasy']);
  const alafasy = allAdmin.find((r) => r.slug === 'ar.alafasy');
  assert.ok(alafasy && alafasy.isDisabled && !alafasy.isCustom);

  const customAdmin = allAdmin.find((r) => r.slug === 'custom.testreciter');
  assert.ok(customAdmin && customAdmin.isCustom && !customAdmin.isDisabled);

  // resolveReciterOption can find custom reciter
  assert.equal(
    resolveReciterOption('custom.testreciter', [dummyCustom]).name,
    'قارئ تجريبي'
  );
});

test('getStudioActiveReciters strictly filters to verse-segmented reciters and excludes unsegmented whole-surah reciters', () => {
  const { getStudioActiveReciters } = require('./reciter-filter');
  const studioReciters = getStudioActiveReciters();

  // All returned reciters must be native verse-by-verse (EveryAyah or Islamic Network)
  for (const r of studioReciters) {
    assert.equal(
      r.source === 'everyayah' || r.source === 'islamic',
      true,
      `Reciter ${r.slug} must be native verse-by-verse`
    );
  }

  // Verify non-verse whole surah reciters (Mansour Al-Salimi, Islam Sobhi, etc.) are excluded
  assert.ok(!studioReciters.some((r: any) => r.slug === 'mq.mansoursalimi'));
  assert.ok(!studioReciters.some((r: any) => r.slug === 'mq.islamsobhi'));
  assert.ok(!studioReciters.some((r: any) => r.slug === 'mq.baderturki'));
  assert.ok(!studioReciters.some((r: any) => r.slug === 'mq.abdelazizsheim'));
  assert.ok(!studioReciters.some((r: any) => r.slug === 'mq.ahmadnufais'));
  assert.ok(!studioReciters.some((r: any) => r.slug === 'mq.hassansaleh'));

  // Verify authentic EveryAyah verse-by-verse reciters are present
  assert.ok(studioReciters.some((r: any) => r.slug === 'ar.alafasy'));
  assert.ok(studioReciters.some((r: any) => r.slug === 'ea.nasseralqatami'));
  assert.ok(studioReciters.some((r: any) => r.slug === 'ea.yasseraldossari'));
  assert.ok(studioReciters.some((r: any) => r.slug === 'ar.minshawi'));
  assert.ok(studioReciters.some((r: any) => r.slug === 'ar.husary'));
});
