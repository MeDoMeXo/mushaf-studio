import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractErrorMessage,
  fetchWithRateLimitRetry,
  isHtmlPayloadText,
  isHtmlResponse,
  MAX_UPLOAD_BATCH_BYTES,
  safeParseJsonResponse,
  splitAmbientFramesByBytes,
} from './export-network';

test('isHtmlPayloadText detects HTML doctype, html tags, and ignores valid JSON', () => {
  assert.equal(isHtmlPayloadText('<!doctype html><html><body>Hi</body></html>'), true);
  assert.equal(isHtmlPayloadText('  \n<!DOCTYPE HTML PUBLIC "-//W3C//DTD">'), true);
  assert.equal(isHtmlPayloadText('<html><head><title>502</title></head></html>'), true);
  assert.equal(isHtmlPayloadText('{"jobId":"123"}'), false);
  assert.equal(isHtmlPayloadText('[{"a":1}]'), false);
  assert.equal(isHtmlPayloadText(''), false);
});

test('isHtmlResponse checks content-type header safely', () => {
  const htmlRes = new Response('<!doctype html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
  const jsonRes = new Response('{"ok":true}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  assert.equal(isHtmlResponse(htmlRes), true);
  assert.equal(isHtmlResponse(jsonRes), false);
});

test('safeParseJsonResponse parses valid JSON and never leaks raw SyntaxError on HTML', async () => {
  const okRes = new Response(JSON.stringify({ jobId: 'abc-123' }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
  const parsed = await safeParseJsonResponse<{ jobId: string }>(okRes, 'بدء جلسة التصدير');
  assert.deepEqual(parsed, { jobId: 'abc-123' });

  const htmlOkRes = new Response('<!doctype html><html><body>Auth Gate</body></html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
  await assert.rejects(
    () => safeParseJsonResponse(htmlOkRes, 'بدء جلسة التصدير'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(!err.message.includes('Unexpected token'), 'must not leak raw JSON.parse SyntaxError');
      assert.ok(!err.message.includes('<!doctype'), 'must not leak raw HTML doctype');
      assert.ok(err.message.includes('بدء جلسة التصدير'));
      return true;
    }
  );

  // Even if proxy strips Content-Type header, body starting with <!doctype must be caught cleanly
  const headerlessHtmlRes = new Response('<!doctype html><html></html>', {
    status: 200,
  });
  await assert.rejects(
    () => safeParseJsonResponse(headerlessHtmlRes, 'متابعة حالة التصدير'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(!err.message.includes('Unexpected token'));
      assert.ok(err.message.includes('متابعة حالة التصدير'));
      return true;
    }
  );
});

test('extractErrorMessage reads JSON error and translates proxy HTML errors cleanly', async () => {
  const jsonErr = new Response(JSON.stringify({ error: 'الخلفية المختارة غير متوفرة' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
  assert.equal(
    await extractErrorMessage(jsonErr, 'تعذّر بدء جلسة التصدير'),
    'الخلفية المختارة غير متوفرة'
  );

  const html413 = new Response('<!doctype html><html><title>413 Payload Too Large</title></html>', {
    status: 413,
    headers: { 'Content-Type': 'text/html' },
  });
  const msg413 = await extractErrorMessage(html413, 'تعذّر رفع دفعة الشرائح');
  assert.ok(msg413.includes('413') || msg413.includes('حجم'));
  assert.ok(!msg413.includes('Unexpected token'));

  const html502 = new Response('<!doctype html><html><title>502 Bad Gateway</title></html>', {
    status: 502,
    headers: { 'Content-Type': 'text/html' },
  });
  const msg502 = await extractErrorMessage(html502, 'تعذّر بدء جلسة التصدير');
  assert.ok(msg502.includes('502'));
  assert.ok(!msg502.includes('Unexpected token'));
});

test('fetchWithRateLimitRetry with expectJson retries transient 200 text/html proxy responses', async () => {
  const origFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async () => {
    calls++;
    if (calls === 1) {
      return new Response('<!doctype html><html><body>Warmup</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }
    return new Response(JSON.stringify({ jobId: 'recovered-job' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const res = await fetchWithRateLimitRetry(
      '/api/studio/export/session',
      { method: 'POST', body: '{}' },
      { expectJson: true, maxAttempts: 3, retryDelayOverrideMs: 5 }
    );
    assert.equal(calls, 2);
    const data = await safeParseJsonResponse<{ jobId: string }>(res, 'بدء جلسة التصدير');
    assert.equal(data.jobId, 'recovered-job');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('splitAmbientFramesByBytes partitions ambient frames safely under Cloud Run payload budget', () => {
  const makeBlob = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/png' });
  // 10 frames of 2 MB each = 20 MB > MAX_UPLOAD_BATCH_BYTES -> must split into multiple batches
  const frames = Array.from({ length: 10 }, () => makeBlob(2 * 1024 * 1024));
  const groups = splitAmbientFramesByBytes(frames, 10 * 1024 * 1024);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].length, 5);
  assert.equal(groups[0][0].index, 0);
  assert.equal(groups[1][0].index, 5);
  assert.ok(MAX_UPLOAD_BATCH_BYTES <= 16 * 1024 * 1024);
});
