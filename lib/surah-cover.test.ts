import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIntroAlignedVerseTexts,
  COVER_BASMALA_TEXT,
  estimateVideoExportDurationSec,
  INTRO_COVER_DURATION_SEC,
  resolveCoverBasmala,
  resolveIntroCoverSlideCount,
  UNIFIED_COVER_TEMPLATE_ID,
} from './surah-cover';
import { buildSrtFromTimeline } from './srt-subtitles';
import { STUDIO_TEMPLATES } from './quran-data';
import { computeCoverLayoutMetrics } from './cover-canvas-renderer';

test('resolveCoverBasmala renders Basmala below reciter for Surahs except Surah At-Tawbah (9)', () => {
  assert.equal(INTRO_COVER_DURATION_SEC, 2.5);
  assert.equal(resolveCoverBasmala(1), `﴿ ${COVER_BASMALA_TEXT} ﴾`);
  assert.equal(resolveCoverBasmala(2), `﴿ ${COVER_BASMALA_TEXT} ﴾`);
  assert.equal(resolveCoverBasmala(9), null);
  assert.equal(resolveCoverBasmala(114), `﴿ ${COVER_BASMALA_TEXT} ﴾`);
});

test('resolveIntroCoverSlideCount & buildIntroAlignedVerseTexts align cover slide 0 cleanly', () => {
  assert.equal(resolveIntroCoverSlideCount(7, true), 8);
  assert.equal(resolveIntroCoverSlideCount(7, false), 7);
  assert.equal(resolveIntroCoverSlideCount(286, true), 287);
  assert.equal(resolveIntroCoverSlideCount(0, true), 0);

  const aligned = buildIntroAlignedVerseTexts(['الآية الأولى', 'الآية الثانية'], true);
  assert.deepEqual(aligned, ['', 'الآية الأولى', 'الآية الثانية']);
  assert.deepEqual(buildIntroAlignedVerseTexts(['الآية الأولى'], false), ['الآية الأولى']);

  // Verify SRT timing skips empty slide_0 cover while offsetting Ayah 1 by 2.5s
  const srt = buildSrtFromTimeline([INTRO_COVER_DURATION_SEC, 4.0, 3.5], aligned);
  assert.match(srt, /^1\r\n00:00:02,500 --> 00:00:06,500\r\nالآية الأولى/m);
  assert.match(srt, /^2\r\n00:00:06,500 --> 00:00:10,000\r\nالآية الثانية/m);
});

test('estimateVideoExportDurationSec includes 2.5s silent cover duration when enabled', () => {
  const withCover = estimateVideoExportDurationSec({
    verseCount: 3,
    verseGapSec: 0.35,
    includeIntroCover: true,
  });
  const withoutCover = estimateVideoExportDurationSec({
    verseCount: 3,
    verseGapSec: 0.35,
    includeIntroCover: false,
  });
  assert.equal(Number((withCover - withoutCover).toFixed(2)), 2.5);
});

test('STUDIO_TEMPLATES includes the fixed unified channel cover preset cleanly', () => {
  const tpl = STUDIO_TEMPLATES.find((t) => t.id === UNIFIED_COVER_TEMPLATE_ID);
  assert.ok(tpl, 'Expected unified-channel-cover preset in STUDIO_TEMPLATES');
  assert.equal(tpl.patch.coverMode, true);
  // Fixed template intentionally activates coverMode without overwriting user styling/colors
  assert.equal(tpl.patch.bgIdx, undefined);
  assert.equal(tpl.patch.textColor, undefined);
});

test('computeCoverLayoutMetrics maintains hero scale, strict vertical ordering, and zero overlap across aspect ratios', () => {
  const presets = [
    { name: '16:9', width: 1920, height: 1080 },
    { name: '1:1', width: 1080, height: 1080 },
    { name: '9:16', width: 1080, height: 1920 },
  ];

  for (const preset of presets) {
    for (const hasBasmala of [true, false]) {
      const m = computeCoverLayoutMetrics({
        width: preset.width,
        height: preset.height,
        hasBasmala,
        hasWatermark: true,
      });

      // Surah Title must be the undisputed hero focal element (> 2x Basmala)
      assert.ok(
        m.titleMaxSize > m.basmalaSize * 2,
        `${preset.name}: expected titleMaxSize (${m.titleMaxSize}) > 2 * basmalaSize (${m.basmalaSize})`
      );

      // Crown arch apex must clear the top frame safe area cleanly
      assert.ok(
        m.crownBaseY - m.crownH >= m.minSide * 0.08,
        `${preset.name}: crown apex too close to top edge`
      );

      // Strict top-to-bottom visual hierarchy
      assert.ok(m.crownBaseY < m.titleY, `${preset.name}: crown should sit above title`);
      assert.ok(m.titleY < m.dividerY, `${preset.name}: title above rosette divider`);
      assert.ok(m.dividerY < m.reciterY, `${preset.name}: rosette divider above reciter cartouche`);
      assert.ok(m.reciterY < m.basmalaY, `${preset.name}: reciter cartouche above basmala`);
      assert.ok(m.basmalaY < m.watermarkY, `${preset.name}: basmala above watermark`);

      // Zero collision between lower Basmala boundary and upper Watermark pill boundary
      if (hasBasmala) {
        const basmalaBottom = m.basmalaY + m.basmalaSize * 0.65;
        const watermarkTop = m.watermarkY - m.watermarkBoxH * 0.65;
        assert.ok(
          basmalaBottom < watermarkTop,
          `${preset.name}: basmalaBottom (${basmalaBottom}) overlapped watermarkTop (${watermarkTop})`
        );
      }
    }
  }
});

