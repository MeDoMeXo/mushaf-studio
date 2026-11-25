import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AYAH_MEDALLION_OPTIONS,
  DEFAULT_ORNAMENT_COLOR,
  ISLAMIC_CORNER_OPTIONS,
  ISLAMIC_FRAME_OPTIONS,
  ISLAMIC_PATTERN_OPTIONS,
  ORNAMENT_COLOR_PRESETS,
  SURAH_BANNER_OPTIONS,
  buildCartoucheBounds,
  buildMihrabArchGeometry,
  buildRubElHizbSquares,
  buildStarPolygonPoints,
  filterTemplatesByCategory,
  hexToRgba,
  resolveOrnamentConfig,
} from './islamic-ornaments';

test('catalogs expose complete authentic Islamic ornament options', () => {
  assert.equal(ISLAMIC_FRAME_OPTIONS.length, 6);
  assert.equal(ISLAMIC_PATTERN_OPTIONS.length, 5);
  assert.equal(ISLAMIC_CORNER_OPTIONS.length, 5);
  assert.equal(SURAH_BANNER_OPTIONS.length, 4);
  assert.equal(AYAH_MEDALLION_OPTIONS.length, 5);
  assert.ok(ORNAMENT_COLOR_PRESETS.length >= 6);
});

test('buildStarPolygonPoints generates symmetric alternating outer and inner vertices', () => {
  const pts = buildStarPolygonPoints(100, 200, 50, 25, 8);
  assert.equal(pts.length, 16);
  for (let i = 0; i < pts.length; i++) {
    const dist = Math.hypot(pts[i].x - 100, pts[i].y - 200);
    const expected = i % 2 === 0 ? 50 : 25;
    assert.ok(Math.abs(dist - expected) < 1e-6, `vertex ${i} radius mismatch`);
  }
});

test('buildRubElHizbSquares generates two rotated overlapping squares of equal radius', () => {
  const { squareA, squareB } = buildRubElHizbSquares(50, 50, 30);
  assert.equal(squareA.length, 4);
  assert.equal(squareB.length, 4);
  for (const p of [...squareA, ...squareB]) {
    const d = Math.hypot(p.x - 50, p.y - 50);
    assert.ok(Math.abs(d - 30) < 1e-6);
  }
  // Square A and Square B vertices must be offset by 45 degrees (distinct)
  assert.ok(Math.hypot(squareA[0].x - squareB[0].x, squareA[0].y - squareB[0].y) > 10);
});

test('buildMihrabArchGeometry adapts cleanly to portrait, square, and landscape canvases', () => {
  for (const [w, h] of [
    [1080, 1920],
    [1080, 1080],
    [1920, 1080],
  ]) {
    const g = buildMihrabArchGeometry(w, h, 44);
    assert.equal(g.apexX, w / 2);
    assert.ok(g.apexY < g.springY);
    assert.ok(g.springY < g.bottom);
    assert.ok(g.innerInset >= 8);
  }
});

test('buildCartoucheBounds clamps width cleanly within maxWidth', () => {
  const b = buildCartoucheBounds(540, 120, 900, 36, 700);
  assert.equal(b.width, 700);
  assert.equal(b.left, 190);
  assert.equal(b.right, 890);
  assert.ok(b.height >= 44);
});

test('resolveOrnamentConfig preserves backwards compatibility and clamps opacity', () => {
  const legacyDisabled = resolveOrnamentConfig({ goldFrame: false, corners: false });
  assert.equal(legacyDisabled.frameStyle, 'none');
  assert.equal(legacyDisabled.cornerStyle, 'none');
  assert.equal(legacyDisabled.ornamentColor, DEFAULT_ORNAMENT_COLOR);

  const clamped = resolveOrnamentConfig({
    frameStyle: 'mihrab',
    cornerStyle: 'shamsa',
    patternStyle: 'girih12',
    patternOpacity: 2.5,
    surahBannerStyle: 'mihrab_crest',
    ayahNumberStyle: 'rub_el_hizb',
    ornamentColor: 'not-a-color',
  });
  assert.equal(clamped.frameStyle, 'mihrab');
  assert.equal(clamped.cornerStyle, 'shamsa');
  assert.equal(clamped.patternStyle, 'girih12');
  assert.equal(clamped.patternOpacity, 0.45);
  assert.equal(clamped.ornamentColor, DEFAULT_ORNAMENT_COLOR);
});

test('hexToRgba handles 3-digit, 6-digit, and malformed hex strings safely', () => {
  assert.equal(hexToRgba('#D4AF37', 0.5), 'rgba(212, 175, 55, 0.5)');
  assert.equal(hexToRgba('#fff', 1), 'rgba(255, 255, 255, 1)');
  assert.equal(hexToRgba('zzz', 0.25), 'rgba(212, 175, 55, 0.25)');
  assert.equal(hexToRgba('not-a-hex', 0.5), 'rgba(212, 175, 55, 0.5)');
});

test('filterTemplatesByCategory returns all or filtered subset accurately', () => {
  const sample = [
    { id: '1', category: 'mushaf' },
    { id: '2', category: 'haramain' },
    { id: '3', category: 'mushaf' },
  ];
  assert.equal(filterTemplatesByCategory(sample, 'all').length, 3);
  assert.equal(filterTemplatesByCategory(sample, 'mushaf').length, 2);
  assert.equal(filterTemplatesByCategory(sample, 'haramain').length, 1);
  assert.equal(filterTemplatesByCategory(sample, 'andalus').length, 0);
});
