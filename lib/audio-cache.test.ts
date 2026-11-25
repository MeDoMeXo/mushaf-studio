import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAudioCacheKey,
  computeCacheProgress,
  MAX_BATCH_AUDIO_BYTES,
  shouldAttachAudioToBatch,
} from './audio-cache';

test('buildAudioCacheKey generates stable same-origin audio route keys', () => {
  assert.equal(buildAudioCacheKey('ar.alafasy', 1), '/api/audio/ar.alafasy/1');
  assert.equal(
    buildAudioCacheKey('ea.yasseraldossari', 286),
    '/api/audio/ea.yasseraldossari/286'
  );
});

test('computeCacheProgress accurately reports idle, loading, ready, and partial states', () => {
  assert.deepEqual(computeCacheProgress(0, 0), { pct: 0, status: 'idle' });
  assert.deepEqual(computeCacheProgress(143, 286), { pct: 50, status: 'loading' });
  assert.deepEqual(computeCacheProgress(286, 286), { pct: 100, status: 'ready' });
  assert.deepEqual(computeCacheProgress(280, 286, 6), { pct: 98, status: 'partial' });
  assert.deepEqual(computeCacheProgress(300, 286), { pct: 100, status: 'ready' });
});

test('shouldAttachAudioToBatch enforces valid blob minimum and Cloud Run batch safety cap', () => {
  assert.equal(shouldAttachAudioToBatch(0, 64), false);
  assert.equal(shouldAttachAudioToBatch(0, 85_000), true);
  assert.equal(shouldAttachAudioToBatch(MAX_BATCH_AUDIO_BYTES - 1000, 2000), false);
  assert.equal(shouldAttachAudioToBatch(MAX_BATCH_AUDIO_BYTES - 2000, 2000), true);
});
