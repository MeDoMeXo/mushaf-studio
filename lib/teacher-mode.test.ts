import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEACHER_MODE_DEFAULTS,
  TEACHER_MODE_MAX_REPEATS,
  TEACHER_MODE_MIN_REPEATS,
  describeTeacherProgress,
  resolveTeacherStep,
  sanitizeTeacherMode,
  studentAdvanceAction,
} from './teacher-mode';

test('sanitizeTeacherMode clamps every field into valid ranges', () => {
  const clean = sanitizeTeacherMode({ enabled: true, repeatCount: 99, interRepeatGapSec: 42 });
  assert.equal(clean.enabled, true);
  assert.equal(clean.repeatCount, TEACHER_MODE_MAX_REPEATS);
  assert.equal(clean.interRepeatGapSec, 5);
  // Floor clamps and defaults (repeatCount 0 is treated as "unset" → default)
  const low = sanitizeTeacherMode({ repeatCount: 0 });
  assert.equal(low.repeatCount, TEACHER_MODE_DEFAULTS.repeatCount);
  assert.equal(low.interRepeatGapSec, 1);
  // Null/undefined fall back to defaults with the mode off
  const dflt = sanitizeTeacherMode(null);
  assert.deepEqual(dflt, TEACHER_MODE_DEFAULTS);
  // pauseAfterEachVerse defaults to true; explicit false survives
  assert.equal(sanitizeTeacherMode({}).pauseAfterEachVerse, true);
  assert.equal(sanitizeTeacherMode({ pauseAfterEachVerse: false }).pauseAfterEachVerse, false);
});

test('resolveTeacherStep chains verses when teacher mode is off', () => {
  assert.deepEqual(resolveTeacherStep(0, { ...TEACHER_MODE_DEFAULTS, enabled: false }, true), {
    action: 'advance-to-next-verse',
  });
  assert.deepEqual(resolveTeacherStep(0, { ...TEACHER_MODE_DEFAULTS, enabled: false }, false), {
    action: 'stop',
  });
});

test('resolveTeacherStep replays the same verse until repeatCount is reached', () => {
  const mode = { ...TEACHER_MODE_DEFAULTS, enabled: true, repeatCount: 3 };
  // 0 → replay (1), 1 → replay (2), 2 → wait-for-student
  assert.deepEqual(resolveTeacherStep(0, mode, true), { action: 'replay-same-verse', nextRepeat: 1 });
  assert.deepEqual(resolveTeacherStep(1, mode, true), { action: 'replay-same-verse', nextRepeat: 2 });
  assert.deepEqual(resolveTeacherStep(2, mode, true), { action: 'wait-for-student' });
  // repeatCount=1 means zero re-chants: go straight to the wait
  const once = { ...TEACHER_MODE_DEFAULTS, enabled: true, repeatCount: 1 };
  assert.deepEqual(resolveTeacherStep(0, once, true), { action: 'wait-for-student' });
});

test('resolveTeacherStep respects pauseAfterEachVerse=false by advancing', () => {
  const mode = { ...TEACHER_MODE_DEFAULTS, enabled: true, repeatCount: 2, pauseAfterEachVerse: false };
  assert.deepEqual(resolveTeacherStep(1, mode, true), { action: 'advance-to-next-verse' });
  // Last verse with no pause → stop as usual
  assert.deepEqual(resolveTeacherStep(1, mode, false), { action: 'stop' });
});

test('describeTeacherProgress and studentAdvanceAction drive the UI correctly', () => {
  const mode = { ...TEACHER_MODE_DEFAULTS, enabled: true, repeatCount: 4 };
  assert.equal(describeTeacherProgress(0, mode), 'التكرار 1 من 4');
  assert.equal(describeTeacherProgress(3, mode), 'التكرار 4 من 4');
  // Clamp beyond repeatCount
  assert.equal(describeTeacherProgress(9, mode), 'التكرار 4 من 4');
  // Off mode renders no badge text
  assert.equal(describeTeacherProgress(0, TEACHER_MODE_DEFAULTS), '');

  // Student tap: resumes to the next verse (or stops at the surah end)
  assert.deepEqual(studentAdvanceAction(mode, true), { action: 'advance-to-next-verse' });
  assert.deepEqual(studentAdvanceAction(mode, false), { action: 'stop' });
});
