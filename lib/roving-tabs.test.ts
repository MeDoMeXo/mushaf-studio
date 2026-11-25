import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTabDomIds, resolveRovingTabIndex } from './roving-tabs';

const TABS = [
  { id: 'all' },
  { id: 'makkah' },
  { id: 'madinah' },
];

test('RTL ArrowLeft moves forward and wraps around', () => {
  assert.equal(resolveRovingTabIndex(TABS, 0, 'ArrowLeft', 'rtl'), 1);
  assert.equal(resolveRovingTabIndex(TABS, 1, 'ArrowLeft', 'rtl'), 2);
  assert.equal(resolveRovingTabIndex(TABS, 2, 'ArrowLeft', 'rtl'), 0);
});

test('RTL ArrowRight moves backward and wraps around', () => {
  assert.equal(resolveRovingTabIndex(TABS, 2, 'ArrowRight', 'rtl'), 1);
  assert.equal(resolveRovingTabIndex(TABS, 0, 'ArrowRight', 'rtl'), 2);
});

test('LTR ArrowRight moves forward and ArrowLeft moves backward', () => {
  assert.equal(resolveRovingTabIndex(TABS, 0, 'ArrowRight', 'ltr'), 1);
  assert.equal(resolveRovingTabIndex(TABS, 0, 'ArrowLeft', 'ltr'), 2);
});

test('Home and End jump to first and last enabled tabs', () => {
  const withDisabled = [
    { id: 'a', disabled: true },
    { id: 'b' },
    { id: 'c', disabled: true },
    { id: 'd' },
    { id: 'e', disabled: true },
  ];
  assert.equal(resolveRovingTabIndex(withDisabled, 3, 'Home', 'rtl'), 1);
  assert.equal(resolveRovingTabIndex(withDisabled, 1, 'End', 'rtl'), 3);
  assert.equal(resolveRovingTabIndex(withDisabled, 1, 'ArrowLeft', 'rtl'), 3);
  assert.equal(resolveRovingTabIndex(withDisabled, 3, 'ArrowRight', 'rtl'), 1);
});

test('returns null for unrelated keys or empty/all-disabled lists', () => {
  assert.equal(resolveRovingTabIndex(TABS, 0, 'Enter', 'rtl'), null);
  assert.equal(resolveRovingTabIndex(TABS, 0, 'ArrowDown', 'rtl'), null);
  assert.equal(resolveRovingTabIndex([], 0, 'ArrowLeft', 'rtl'), null);
  assert.equal(
    resolveRovingTabIndex([{ id: 'x', disabled: true }], 0, 'Home', 'rtl'),
    null
  );
});

test('buildTabDomIds produces deterministic hydration-safe IDs', () => {
  assert.deepEqual(buildTabDomIds('studio-inspector', 'templates'), {
    tabId: 'studio-inspector-tab-templates',
    panelId: 'studio-inspector-panel-templates',
  });
});
