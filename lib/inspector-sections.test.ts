import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getInspectorSectionsByTab,
  INSPECTOR_SECTIONS,
  INSPECTOR_TAB_ORDER,
  isInspectorSectionHidden,
  isInspectorSectionId,
  sanitizeHiddenInspectorSections,
  toggleHiddenInspectorSection,
} from './inspector-sections';

test('INSPECTOR_SECTIONS excludes admin-only links manager and covers all 5 studio tabs', () => {
  assert.equal(isInspectorSectionId('txt-links'), false);
  assert.equal(INSPECTOR_SECTIONS.some((s) => s.id === 'txt-links'), false);
  for (const tab of INSPECTOR_TAB_ORDER) {
    assert.ok(getInspectorSectionsByTab(tab).length > 0, `tab ${tab} must have sections`);
  }
});

test('sanitizeHiddenInspectorSections deduplicates and drops invalid IDs', () => {
  assert.deepEqual(sanitizeHiddenInspectorSections(null), []);
  assert.deepEqual(sanitizeHiddenInspectorSections('bad'), []);
  assert.deepEqual(
    sanitizeHiddenInspectorSections([
      'txt-watermark',
      'invalid-section',
      'txt-watermark',
      'aud-dsp',
      123,
    ]),
    ['txt-watermark', 'aud-dsp']
  );
});

test('toggleHiddenInspectorSection adds/removes valid IDs and ignores unknown IDs', () => {
  const step1 = toggleHiddenInspectorSection([], 'txt-watermark');
  assert.deepEqual(step1, ['txt-watermark']);
  assert.equal(isInspectorSectionHidden(step1, 'txt-watermark'), true);
  assert.equal(isInspectorSectionHidden(step1, 'aud-dsp'), false);

  const step2 = toggleHiddenInspectorSection(step1, 'txt-watermark');
  assert.deepEqual(step2, []);

  const step3 = toggleHiddenInspectorSection(step1, 'not-a-real-id');
  assert.deepEqual(step3, ['txt-watermark']);
});
