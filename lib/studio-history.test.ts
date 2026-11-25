import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canRedoHistory,
  canUndoHistory,
  createStudioHistory,
  pushStudioHistory,
  redoStudioHistory,
  replaceStudioPresent,
  shallowEqualStudioObject,
  undoStudioHistory,
} from './studio-history';

test('createStudioHistory starts with empty past and future', () => {
  const h = createStudioHistory({ fontSize: 80, color: '#fff' }, 10);
  assert.equal(canUndoHistory(h), false);
  assert.equal(canRedoHistory(h), false);
  assert.deepEqual(h.present, { fontSize: 80, color: '#fff' });
});

test('push, undo, and redo navigate snapshots accurately', () => {
  let h = createStudioHistory({ fontSize: 80, color: '#fff' }, 10);
  h = pushStudioHistory(h, { fontSize: 92, color: '#fff' }, shallowEqualStudioObject);
  h = pushStudioHistory(h, { fontSize: 92, color: '#D4AF37' }, shallowEqualStudioObject);

  assert.equal(h.past.length, 2);
  assert.equal(canUndoHistory(h), true);
  assert.equal(canRedoHistory(h), false);

  h = undoStudioHistory(h);
  assert.deepEqual(h.present, { fontSize: 92, color: '#fff' });
  assert.equal(canRedoHistory(h), true);

  h = undoStudioHistory(h);
  assert.deepEqual(h.present, { fontSize: 80, color: '#fff' });
  assert.equal(canUndoHistory(h), false);

  h = redoStudioHistory(h);
  assert.deepEqual(h.present, { fontSize: 92, color: '#fff' });
});

test('push deduplicates equal states and clears redo future branch', () => {
  let h = createStudioHistory({ fontSize: 80, color: '#fff' }, 10);
  h = pushStudioHistory(h, { fontSize: 80, color: '#fff' }, shallowEqualStudioObject);
  assert.equal(h.past.length, 0);

  h = pushStudioHistory(h, { fontSize: 96, color: '#fff' }, shallowEqualStudioObject);
  h = undoStudioHistory(h);
  assert.equal(canRedoHistory(h), true);

  h = pushStudioHistory(h, { fontSize: 104, color: '#fff' }, shallowEqualStudioObject);
  assert.equal(canRedoHistory(h), false);
  assert.equal(h.present.fontSize, 104);
});

test('history enforces maxLength bound', () => {
  let h = createStudioHistory({ step: 0 }, 3);
  for (let i = 1; i <= 6; i++) {
    h = pushStudioHistory(h, { step: i }, shallowEqualStudioObject);
  }
  assert.equal(h.past.length, 3);
  assert.deepEqual(
    h.past.map((s) => s.step),
    [3, 4, 5]
  );
  assert.equal(h.present.step, 6);
});

test('replaceStudioPresent updates present without growing history stack', () => {
  let h = createStudioHistory({ step: 0 }, 5);
  h = pushStudioHistory(h, { step: 1 });
  h = replaceStudioPresent(h, { step: 2 });
  assert.equal(h.past.length, 1);
  assert.equal(h.present.step, 2);
});
