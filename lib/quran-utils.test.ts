import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArabicSearchRegex,
  clampVerseRange,
  filterChapters,
  formatAudioTime,
  getReciterAudioUrl,
  getTranslationDirection,
  getUpstreamAudioUrl,
  globalVerseIdToSurahAyah,
  mergeSiteConfig,
  pickVerseOfDay,
  recordStatEvent,
  resolveTranslationOption,
  sanitizeFooterLinkHref,
  stripArabicDiacritics,
  stripHtmlTags,
  SURAH_VERSE_COUNTS,
  toArabicDigits,
  validatePinChange,
  wrapWordsToLines,
} from './quran-utils';
import {
  DEFAULT_TRANSLATION_ID,
  FALLBACK_CHAPTERS,
  RECITERS,
  TRANSLATIONS,
} from './quran-data';

test('toArabicDigits converts western numerals to Arabic-Indic numerals', () => {
  assert.equal(toArabicDigits(114), '١١٤');
  assert.equal(toArabicDigits('2:255'), '٢:٢٥٥');
});

test('formatAudioTime handles valid and edge durations', () => {
  assert.equal(formatAudioTime(0), '0:00');
  assert.equal(formatAudioTime(65), '1:05');
  assert.equal(formatAudioTime(-5), '0:00');
  assert.equal(formatAudioTime(Number.NaN), '0:00');
});

test('stripHtmlTags removes footnote sups and html tags cleanly', () => {
  const raw = 'All praise is for Allah<sup foot_note=296787>1</sup>—Lord of <em>all</em> worlds.';
  assert.equal(stripHtmlTags(raw), 'All praise is for Allah—Lord of all worlds.');
});

test('buildArabicSearchRegex matches Uthmani text ignoring diacritics and alef variants', () => {
  const uthmani = 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ';
  const rx1 = buildArabicSearchRegex('الحمد');
  assert.ok(rx1 && rx1.test(uthmani));
  const rx2 = buildArabicSearchRegex('رب');
  assert.ok(rx2 && rx2.test(uthmani));
  assert.equal(stripArabicDiacritics('إِنَّا أَعْطَيْنَاكَ'), 'انا اعطيناك');
});

test('filterChapters filters by revelation place, Arabic name, English name, and number', () => {
  const madinah = filterChapters(FALLBACK_CHAPTERS, '', 'madinah');
  assert.ok(madinah.every((c) => c.revelation_place === 'madinah'));
  const kahf = filterChapters(FALLBACK_CHAPTERS, 'الكهف', 'all');
  assert.equal(kahf.length, 1);
  assert.equal(kahf[0].id, 18);
  const byNum = filterChapters(FALLBACK_CHAPTERS, '112', 'all');
  assert.equal(byNum.length, 1);
  assert.equal(byNum[0].name_simple, 'Al-Ikhlas');
  const baqarahNorm = filterChapters(FALLBACK_CHAPTERS, 'البقره', 'all');
  assert.equal(baqarahNorm.length, 1);
  assert.equal(baqarahNorm[0].id, 2);
});

test('getReciterAudioUrl returns same-origin proxy path and getUpstreamAudioUrl resolves both Islamic Network and EveryAyah reciters', () => {
  assert.equal(getReciterAudioUrl('ar.alafasy', 1), '/api/audio/ar.alafasy/1');
  assert.equal(
    getReciterAudioUrl('ar.abdulbasitmurattal', 7),
    '/api/audio/ar.abdulbasitmurattal/7'
  );
  assert.equal(
    getUpstreamAudioUrl('ar.alafasy', 1),
    'https://everyayah.com/data/Alafasy_128kbps/001001.mp3'
  );
  assert.equal(
    getUpstreamAudioUrl('ar.abdulbasitmurattal', 7),
    'https://everyayah.com/data/Abdul_Basit_Murattal_192kbps/001007.mp3'
  );
  assert.equal(
    getUpstreamAudioUrl('ea.warsh_ibrahim_dosary', 1),
    'https://everyayah.com/data/warsh/warsh_ibrahim_aldosary_128kbps/001001.mp3'
  );
  assert.equal(
    getUpstreamAudioUrl('ea.yasseraldossari', 262),
    'https://everyayah.com/data/Yasser_Ad-Dussary_128kbps/002255.mp3'
  );
  const customIslamic = {
    slug: 'custom.legacy',
    name: 'قارئ إسلامي',
    style: 'murattal' as const,
    styleLabel: 'مرتل',
    source: 'islamic' as const,
    bitrate: 128 as const,
  };
  assert.equal(
    getUpstreamAudioUrl('custom.legacy', 1, [customIslamic]),
    'https://cdn.islamic.network/quran/audio/128/custom.legacy/1.mp3'
  );
});

test('SURAH_VERSE_COUNTS has 114 surahs summing to 6236 and globalVerseIdToSurahAyah maps boundary verses accurately', () => {
  assert.equal(SURAH_VERSE_COUNTS.length, 114);
  assert.equal(
    SURAH_VERSE_COUNTS.reduce((acc, n) => acc + n, 0),
    6236
  );
  assert.deepEqual(globalVerseIdToSurahAyah(1), { surah: 1, ayah: 1 });
  assert.deepEqual(globalVerseIdToSurahAyah(7), { surah: 1, ayah: 7 });
  assert.deepEqual(globalVerseIdToSurahAyah(8), { surah: 2, ayah: 1 });
  assert.deepEqual(globalVerseIdToSurahAyah(262), { surah: 2, ayah: 255 });
  assert.deepEqual(globalVerseIdToSurahAyah(6236), { surah: 114, ayah: 6 });
  assert.ok(RECITERS.length >= 35);
  assert.equal(RECITERS.filter((r) => r.style === 'warsh').length, 3);
});

test('pickVerseOfDay honors custom override and rotates consistently by UTC day', () => {
  assert.deepEqual(pickVerseOfDay({ surah: 18, ayah: 10 }), { surah: 18, ayah: 10 });
  const earlyUtc = pickVerseOfDay(null, new Date('2026-11-22T00:05:00Z'));
  const lateUtc = pickVerseOfDay(null, new Date('2026-11-22T23:55:00Z'));
  assert.deepEqual(earlyUtc, lateUtc);
  assert.ok(earlyUtc.surah >= 1 && earlyUtc.surah <= 114 && earlyUtc.ayah >= 1);
});

test('wrapWordsToLines wraps text according to measured width', () => {
  const lines = wrapWordsToLines('one two three four', 10, (s) => s.length);
  assert.deepEqual(lines, ['one two', 'three four']);
});

test('recordStatEvent increments totals, daily buckets, and trims logs', () => {
  const t = Date.UTC(2026, 10, 22, 12, 0, 0);
  const s1 = recordStatEvent(null, 'exports', '2:255', t);
  assert.equal(s1.exports, 1);
  assert.equal(s1.daily['2026-11-22'].exports, 1);
  assert.equal(s1.log[0].e, 'exports');
  const s2 = recordStatEvent(s1, 'reads', '1', t + 1000);
  assert.equal(s2.reads, 1);
  assert.equal(s2.exports, 1);
  assert.equal(s2.log.length, 2);
});

test('mergeSiteConfig safely merges partial nested studio and footer configs', () => {
  const merged = mergeSiteConfig({
    siteName: 'اختبار',
    studio: { fontFamily: 'Reem Kufi', bgIdx: 4, fontSize: 90, color: '#fff', watermark: 'w', footer: false },
    footer: {
      enabled: true,
      description: 'وصف مخصص',
      copyright: '© اختبار',
      showQuickLinks: false,
      showCredits: true,
      customLinks: [
        { label: 'سياسة الخصوصية', href: '/privacy' },
        { label: 'موقع خارجي', href: 'https://example.com' },
        { label: 'رابط غير آمن', href: 'javascript:alert(1)' },
      ],
    },
  });
  assert.equal(merged.siteName, 'اختبار');
  assert.equal(merged.studio.fontFamily, 'Reem Kufi');
  assert.equal(merged.defaultTranslation, 131);
  assert.equal(merged.footer.description, 'وصف مخصص');
  assert.equal(merged.footer.showQuickLinks, false);
  assert.equal(merged.footer.customLinks.length, 2);
  assert.equal(merged.footer.customLinks[0].href, '/privacy');
  assert.deepEqual(merged.studio.hiddenInspectorSections, []);

  const withHidden = mergeSiteConfig({
    studio: {
      fontFamily: 'Amiri Quran',
      bgIdx: 2,
      fontSize: 82,
      color: '#FAF7F0',
      watermark: '',
      footer: true,
      hiddenInspectorSections: ['txt-watermark', 'unknown-id', 'txt-watermark', 'aud-dsp'],
    },
  });
  assert.deepEqual(withHidden.studio.hiddenInspectorSections, ['txt-watermark', 'aud-dsp']);

  const legacyMerged = mergeSiteConfig({ siteName: 'قديم' });
  assert.equal(legacyMerged.footer.enabled, true);
  assert.equal(legacyMerged.footer.showQuickLinks, true);
  assert.deepEqual(legacyMerged.studio.hiddenInspectorSections, []);
});

test('sanitizeFooterLinkHref permits safe relative/http/mailto URLs and blocks unsafe schemes', () => {
  assert.equal(sanitizeFooterLinkHref('/quran'), '/quran');
  assert.equal(sanitizeFooterLinkHref('https://qul.tarteel.ai'), 'https://qul.tarteel.ai/');
  assert.equal(sanitizeFooterLinkHref('mailto:info@example.com'), 'mailto:info@example.com');
  assert.equal(sanitizeFooterLinkHref('javascript:alert(1)'), null);
  assert.equal(sanitizeFooterLinkHref('//evil.example'), null);
  assert.equal(sanitizeFooterLinkHref('   '), null);
});

test('validatePinChange enforces current pin, numeric length, and confirmation', () => {
  assert.equal(validatePinChange('1234', '0000', '5678', '5678').ok, false);
  assert.equal(validatePinChange('1234', '1234', '12', '12').ok, false);
  assert.equal(validatePinChange('1234', '1234', '5678', '9999').ok, false);
  assert.equal(validatePinChange('1234', '1234', '5678', '5678').ok, true);
});

test('clampVerseRange keeps from <= to within surah bounds', () => {
  assert.deepEqual(clampVerseRange(5, 2, 7), { fromAyah: 5, toAyah: 5 });
  assert.deepEqual(clampVerseRange(0, 99, 7), { fromAyah: 1, toAyah: 7 });
});

test('resolveTranslationOption resolves all approved QUL translations with safe fallback', () => {
  assert.ok(TRANSLATIONS.length >= 6);
  for (const t of TRANSLATIONS) {
    assert.equal(resolveTranslationOption(t.id).id, t.id);
  }
  assert.equal(resolveTranslationOption(999999).id, DEFAULT_TRANSLATION_ID);
  assert.equal(resolveTranslationOption(undefined).id, DEFAULT_TRANSLATION_ID);
  assert.equal(getTranslationDirection('en'), 'ltr');
  assert.equal(getTranslationDirection('ar'), 'rtl');
  assert.equal(getTranslationDirection('ur-PK'), 'rtl');
});
