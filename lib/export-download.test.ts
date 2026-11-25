import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSrtDownloadFilename,
  parseByteRangeHeader,
  resolveExportDownloadDisposition,
} from './export-download';

test('parseByteRangeHeader handles full, explicit, open-ended, and suffix byte ranges', () => {
  assert.deepEqual(parseByteRangeHeader(null, 1000), {
    ok: true,
    start: 0,
    end: 999,
    isPartial: false,
  });

  assert.deepEqual(parseByteRangeHeader('bytes=0-15', 1000), {
    ok: true,
    start: 0,
    end: 15,
    isPartial: true,
  });

  assert.deepEqual(parseByteRangeHeader('bytes=500-', 1000), {
    ok: true,
    start: 500,
    end: 999,
    isPartial: true,
  });

  assert.deepEqual(parseByteRangeHeader('bytes=900-5000', 1000), {
    ok: true,
    start: 900,
    end: 999,
    isPartial: true,
  });

  assert.deepEqual(parseByteRangeHeader('bytes=-100', 1000), {
    ok: true,
    start: 900,
    end: 999,
    isPartial: true,
  });
});

test('parseByteRangeHeader rejects empty files and invalid or unsatisfiable ranges', () => {
  assert.deepEqual(parseByteRangeHeader(null, 0), { ok: false, unsatisfiable: true });
  assert.deepEqual(parseByteRangeHeader('bytes=1000-1010', 1000), { ok: false, unsatisfiable: true });
  assert.deepEqual(parseByteRangeHeader('bytes=200-100', 1000), { ok: false, unsatisfiable: true });
  assert.deepEqual(parseByteRangeHeader('bytes=-0', 1000), { ok: false, unsatisfiable: true });
  assert.deepEqual(parseByteRangeHeader('bytes=-', 1000), { ok: false, unsatisfiable: true });
  assert.deepEqual(parseByteRangeHeader('items=0-5', 1000), { ok: false, unsatisfiable: true });
});

test('buildSrtDownloadFilename and resolveExportDownloadDisposition produce safe headers', () => {
  assert.equal(buildSrtDownloadFilename('quran_surah_1_1-7.mp4'), 'quran_surah_1_1-7.srt');
  assert.equal(buildSrtDownloadFilename('quran_surah_2_1-286.webm'), 'quran_surah_2_1-286.srt');
  assert.equal(buildSrtDownloadFilename(''), 'subtitles.srt');
  assert.equal(buildSrtDownloadFilename(null), 'subtitles.srt');

  assert.equal(resolveExportDownloadDisposition('1'), 'attachment');
  assert.equal(resolveExportDownloadDisposition('true'), 'attachment');
  assert.equal(resolveExportDownloadDisposition(null), 'inline');
  assert.equal(resolveExportDownloadDisposition('0'), 'inline');
});
