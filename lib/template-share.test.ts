import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEMPLATE_PATCH_FIELDS,
  TEMPLATE_SHARE_FORMAT,
  TEMPLATE_SHARE_MAX_TEMPLATES,
  TEMPLATE_SHARE_VERSION,
  buildSavedDesignTemplate,
  exportTemplatesToJson,
  importTemplatesFromJson,
  isValidSharedTemplate,
  sanitizeTemplatePatch,
} from './template-share';
import { CONFIG_DEFAULTS } from './quran-data';
import { buildInitialStudioState } from './studio-initial-state';

const sampleTemplate = {
  id: 'tpl_1',
  name: 'قالب ذهبي',
  createdAt: 1700000000000,
  patch: { fontFamily: 'Amiri Quran', fontSize: 64, textColor: '#C9A227', showFooter: true },
};

test('sanitizeTemplatePatch keeps valid fields and drops unknown or mistyped ones', () => {
  const clean = sanitizeTemplatePatch({
    fontFamily: 'Amiri',
    fontSize: 64,
    textColor: '#C9A227',
    malicious: '<script>',
    fontSizeBad: 'not-a-number',
    bgColor: 'javascript:alert(1)', // fails hex guard
  });
  assert.equal(clean.fontFamily, 'Amiri');
  assert.equal(clean.fontSize, 64);
  assert.equal(clean.textColor, '#C9A227');
  assert.equal('malicious' in clean, false);
  assert.equal('fontSizeBad' in clean, false);
  assert.equal('bgColor' in clean, false);

  // Non-object inputs return an empty patch
  assert.deepEqual(sanitizeTemplatePatch(null), {});
  assert.deepEqual(sanitizeTemplatePatch('x'), {});
  assert.deepEqual(sanitizeTemplatePatch([1, 2]), {});
});

test('isValidSharedTemplate enforces id/name/createdAt/patch shape', () => {
  assert.equal(isValidSharedTemplate(sampleTemplate), true);
  // Missing or malformed required fields
  assert.equal(isValidSharedTemplate({ ...sampleTemplate, id: '' }), false);
  assert.equal(isValidSharedTemplate({ ...sampleTemplate, name: '   ' }), false);
  assert.equal(isValidSharedTemplate({ ...sampleTemplate, createdAt: 'soon' }), false);
  assert.equal(isValidSharedTemplate({ ...sampleTemplate, patch: 'nope' }), false);
  // Patch with zero whitelisted fields is useless
  assert.equal(isValidSharedTemplate({ ...sampleTemplate, patch: { hack: 1 } }), false);
  assert.equal(isValidSharedTemplate(null), false);
});

test('exportTemplatesToJson round-trips through importTemplatesFromJson', () => {
  const json = exportTemplatesToJson([sampleTemplate]);
  const parsed = JSON.parse(json);
  assert.equal(parsed.format, TEMPLATE_SHARE_FORMAT);
  assert.equal(parsed.version, TEMPLATE_SHARE_VERSION);

  const res = importTemplatesFromJson(json);
  assert.equal(res.ok, true);
  assert.equal(res.templates.length, 1);
  assert.equal(res.templates[0].name, 'قالب ذهبي');
  assert.deepEqual(res.templates[0].patch, sampleTemplate.patch);
});

test('importTemplatesFromJson rejects malformed payloads with clear errors', () => {
  assert.equal(importTemplatesFromJson('not json').ok, false);
  assert.equal(importTemplatesFromJson('42').ok, false);
  assert.equal(importTemplatesFromJson('{}').ok, false); // missing format
  assert.equal(importTemplatesFromJson('{"format":"other","templates":[]}').ok, false);
  // Future version
  assert.equal(
    importTemplatesFromJson(
      `{"format":"${TEMPLATE_SHARE_FORMAT}","version":99,"templates":[]}`
    ).ok,
    false
  );
  // Empty template list
  assert.equal(
    importTemplatesFromJson(
      `{"format":"${TEMPLATE_SHARE_FORMAT}","version":1,"templates":[]}`
    ).ok,
    false
  );
});

test('importTemplatesFromJson re-seeds colliding ids and drops invalid rows silently', () => {
  const file = {
    format: TEMPLATE_SHARE_FORMAT,
    version: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    templates: [
      sampleTemplate, // collides with existing id
      { id: 'tpl_2', name: 'ثانٍ', createdAt: 1, patch: { fontSize: 40 } }, // valid
      { id: 'tpl_3', name: 'سيء', createdAt: 1, patch: { evil: true } }, // dropped
    ],
  };
  const res = importTemplatesFromJson(JSON.stringify(file), new Set(['tpl_1']));
  assert.equal(res.ok, true);
  assert.equal(res.templates.length, 2);
  // The colliding template got a re-seeded id, not the original
  assert.notEqual(res.templates[0].id, 'tpl_1');
  assert.match(res.templates[0].id, /^tpl_1_/);
  assert.equal(res.templates[1].id, 'tpl_2');
});

test('export caps bulk size and constants stay sane', () => {
  const bulk = Array.from({ length: TEMPLATE_SHARE_MAX_TEMPLATES + 20 }, (_, i) => ({
    id: `tpl_${i}`,
    name: `t${i}`,
    createdAt: i,
    patch: { fontSize: 40 },
  }));
  const json = exportTemplatesToJson(bulk);
  const parsed = JSON.parse(json);
  assert.equal(parsed.templates.length, TEMPLATE_SHARE_MAX_TEMPLATES);
  // The import refuses a handcrafted oversized payload
  const oversized = JSON.stringify({
    format: TEMPLATE_SHARE_FORMAT,
    version: 1,
    templates: bulk,
  });
  assert.equal(importTemplatesFromJson(oversized).ok, false);
  // Patch whitelist is non-trivial and stable
  assert.ok(TEMPLATE_PATCH_FIELDS.length >= 30);
});

test('buildSavedDesignTemplate builds Arabic-named design snapshot and guards oversized bgImage', () => {
  const baseState = buildInitialStudioState(CONFIG_DEFAULTS, 1, 1, 3, 'ar.alafasy', 131);
  const autoSaved = buildSavedDesignTemplate({
    state: baseState,
    surahName: 'الفاتحة',
    now: 1700000005000,
  });
  assert.equal(autoSaved.id, 'tpl_1700000005000');
  assert.equal(autoSaved.name, 'تصميم الفاتحة (١–٣)');
  assert.equal(isValidSharedTemplate(autoSaved), true);

  const singleSaved = buildSavedDesignTemplate({
    state: { ...baseState, fromAyah: 255, toAyah: 255, watermark: 'قناتي', bgBlur: 6 },
    surahName: 'البقرة',
  });
  assert.equal(singleSaved.name, 'تصميم البقرة (٢٥٥)');
  assert.equal(singleSaved.patch.watermark, 'قناتي');
  assert.equal(singleSaved.patch.bgBlur, 6);

  const oversizedBg = buildSavedDesignTemplate({
    state: { ...baseState, bgType: 'image', bgImage: `data:image/png;base64,${'A'.repeat(500_000)}` },
    surahName: 'الفاتحة',
    customName: 'غلاف مخصص',
  });
  assert.equal(oversizedBg.name, 'غلاف مخصص');
  assert.equal(oversizedBg.patch.bgImage, null);
  assert.equal(oversizedBg.patch.bgType, 'gradient');
});
