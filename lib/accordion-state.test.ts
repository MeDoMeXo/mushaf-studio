import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areAllCurtainsCollapsed,
  areAllCurtainsExpanded,
  collapseAllCurtains,
  DEFAULT_OPEN_INSPECTOR_CURTAINS,
  DEFAULT_OPEN_RECITATION_CURTAINS,
  expandAllCurtains,
  isCurtainOpen,
  RECITATION_CURTAIN_IDS,
  toggleCurtainId,
} from './accordion-state';

test('toggleCurtainId adds missing id and removes existing id without mutating input', () => {
  const initial = ['rec-surah'];
  const opened = toggleCurtainId(initial, 'rec-reciters');
  assert.deepEqual(opened, ['rec-surah', 'rec-reciters']);
  assert.deepEqual(initial, ['rec-surah']);

  const closed = toggleCurtainId(opened, 'rec-surah');
  assert.deepEqual(closed, ['rec-reciters']);
});

test('isCurtainOpen reports membership accurately', () => {
  assert.equal(isCurtainOpen(['a', 'b'], 'a'), true);
  assert.equal(isCurtainOpen(['a', 'b'], 'c'), false);
});

test('expandAllCurtains merges visibleIds while preserving unrelated open ids', () => {
  const current = ['other-tab-sec', 'orn-frame'];
  const visible = ['orn-harmony', 'orn-frame', 'orn-pattern'];
  const result = expandAllCurtains(current, visible);

  assert.equal(result.includes('other-tab-sec'), true);
  assert.equal(result.includes('orn-harmony'), true);
  assert.equal(result.includes('orn-frame'), true);
  assert.equal(result.includes('orn-pattern'), true);
  assert.equal(
    result.filter((id) => id === 'orn-frame').length,
    1,
    'must not duplicate already open ids'
  );
});

test('collapseAllCurtains removes only visibleIds and leaves other tabs intact', () => {
  const current = ['other-tab-sec', 'orn-harmony', 'orn-frame'];
  const visible = ['orn-harmony', 'orn-frame', 'orn-pattern'];
  const result = collapseAllCurtains(current, visible);

  assert.deepEqual(result, ['other-tab-sec']);
});

test('areAllCurtainsExpanded & areAllCurtainsCollapsed handle empty and partial states', () => {
  const visible = ['a', 'b', 'c'];

  assert.equal(areAllCurtainsExpanded(['a', 'b', 'c', 'z'], visible), true);
  assert.equal(areAllCurtainsExpanded(['a', 'b'], visible), false);
  assert.equal(areAllCurtainsExpanded([], []), false);

  assert.equal(areAllCurtainsCollapsed(['z'], visible), true);
  assert.equal(areAllCurtainsCollapsed(['a', 'z'], visible), false);
  assert.equal(areAllCurtainsCollapsed([], []), true);
});

test('default curtain lists reference valid ids', () => {
  for (const id of DEFAULT_OPEN_RECITATION_CURTAINS) {
    assert.equal(
      (RECITATION_CURTAIN_IDS as readonly string[]).includes(id),
      true
    );
  }
  assert.equal(DEFAULT_OPEN_INSPECTOR_CURTAINS.length > 0, true);
});
