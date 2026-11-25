import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRateLimitBackoffMs,
  decodeAudioBatchFrames,
  encodeAudioBatchFrames,
  isRetryableHttpStatus,
  parseRetryAfterMs,
} from './audio-batch-codec';

test('encodeAudioBatchFrames and decodeAudioBatchFrames round-trip multiple MP3 payloads accurately', () => {
  const input = [
    { verseId: 8, data: new Uint8Array([0xff, 0xfb, 0x90, 0x00, 1, 2, 3]) },
    { verseId: 9, data: new Uint8Array([]) },
    { verseId: 289, data: new Uint8Array([10, 20, 30, 40, 50]) },
  ];
  const encoded = encodeAudioBatchFrames(input);
  const decoded = decodeAudioBatchFrames(encoded);

  assert.equal(decoded.length, 3);
  assert.equal(decoded[0].verseId, 8);
  assert.deepEqual(Array.from(decoded[0].data), [0xff, 0xfb, 0x90, 0x00, 1, 2, 3]);
  assert.equal(decoded[1].verseId, 9);
  assert.equal(decoded[1].data.byteLength, 0);
  assert.equal(decoded[2].verseId, 289);
  assert.deepEqual(Array.from(decoded[2].data), [10, 20, 30, 40, 50]);
});

test('rate-limit Retry-After parsing and backoff schedule handle 429 cleanly', () => {
  assert.equal(parseRetryAfterMs('5'), 5000);
  assert.equal(parseRetryAfterMs('120'), 30000);
  assert.equal(parseRetryAfterMs(null), null);

  assert.equal(computeRateLimitBackoffMs(0, null), 2000);
  assert.equal(computeRateLimitBackoffMs(2, null), 7000);
  assert.equal(computeRateLimitBackoffMs(1, '6'), 6000);

  assert.equal(isRetryableHttpStatus(429), true);
  assert.equal(isRetryableHttpStatus(503), true);
  assert.equal(isRetryableHttpStatus(400), false);
  assert.equal(isRetryableHttpStatus(404), false);
});
