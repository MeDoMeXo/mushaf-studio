import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOB_DOWNLOAD_MAX_BYTES,
  buildAmbientNoiseFilter,
  buildAudioEffectFilter,
  buildFfmpegConcatAudioManifest,
  buildFfmpegConcatSlidesManifest,
  buildSafeExportFilename,
  buildVideoBackgroundFilterGraph,
  calculateTransitionProgress,
  chunkIndices,
  DEFAULT_VIDEO_EXPORT_SETTINGS,
  estimateExportSizeMb,
  EXPORT_SLIDE_BATCH_SIZE,
  getCrfForQuality,
  getEffectiveExportFps,
  getPollIntervalMs,
  getSlideImageEncoding,
  getXfadeTransitionName,
  isValidUploadedMediaHeader,
  isValidVideoBinaryHeader,
  MAX_EXPORT_FORM_BYTES,
  MAX_EXPORT_SLIDES,
  MAX_EXPORT_VERSES,
  MAX_UPLOADED_AUDIO_BYTES,
  MAX_UPLOADED_SLIDE_BYTES,
  parseFfmpegTimeSeconds,
  resolveExportDimensions,
  resolveVideoBitrateBounds,
  getConcatSlideFadeSec,
  shouldUseFastConcatEngine,
} from './video-export';

test('resolveExportDimensions produces even dimensions preserving aspect ratio', () => {
  assert.deepEqual(resolveExportDimensions(1080, 1920, '1080p'), { width: 1080, height: 1920 });
  assert.deepEqual(resolveExportDimensions(1080, 1920, '720p'), { width: 720, height: 1280 });
  assert.deepEqual(resolveExportDimensions(1080, 1920, '480p'), { width: 480, height: 854 });
  assert.deepEqual(resolveExportDimensions(1920, 1080, '720p'), { width: 1280, height: 720 });
  assert.deepEqual(resolveExportDimensions(1080, 1080, '720p'), { width: 720, height: 720 });
  const custom = resolveExportDimensions(777, 1111, '720p');
  assert.equal(custom.width % 2, 0);
  assert.equal(custom.height % 2, 0);
});

test('getCrfForQuality maps mp4 and webm quality tiers properly', () => {
  // 2026-11-26: 'high' targets visually lossless calligraphy (CRF 18) for
  // readable verses on YouTube fullscreen; tiers stay strictly decreasing.
  assert.equal(getCrfForQuality('mp4', 'high'), 18);
  assert.equal(getCrfForQuality('mp4', 'balanced'), 22);
  assert.equal(getCrfForQuality('mp4', 'compact'), 27);
  assert.ok(getCrfForQuality('webm', 'high') < getCrfForQuality('webm', 'compact'));
});

test('resolveVideoBitrateBounds sets bounded rates for static slides and video backgrounds', () => {
  // Static slides: raised 'high' caps keep thin diacritic strokes crisp while
  // long-surah exports stay far below unbounded single-pass rates.
  const slide1080Balanced = resolveVideoBitrateBounds('1080p', 'balanced', false);
  assert.equal(slide1080Balanced.maxrate, '1400k');
  assert.equal(slide1080Balanced.bufsize, '2800k');

  const slide1080High = resolveVideoBitrateBounds('1080p', 'high', false);
  assert.equal(slide1080High.maxrate, '2400k');
  assert.equal(slide1080High.bufsize, '4800k');

  const slide720Compact = resolveVideoBitrateBounds('720p', 'compact', false);
  assert.equal(slide720Compact.maxrate, '450k');
  assert.equal(slide720Compact.bufsize, '900k');

  const slide480High = resolveVideoBitrateBounds('480p', 'high', false);
  assert.equal(slide480High.maxrate, '900k');
  assert.equal(slide480High.bufsize, '1800k');

  // Video backgrounds: higher ceilings to preserve camera motion and grain
  const video1080High = resolveVideoBitrateBounds('1080p', 'high', true);
  assert.equal(video1080High.maxrate, '5000k');
  assert.equal(video1080High.bufsize, '10000k');
});

test('calculateTransitionProgress computes normalized progress for playback and manual transitions', () => {
  assert.deepEqual(
    calculateTransitionProgress({ elapsedMs: 100, durationMs: 750, isPlaying: false, isManualNav: false }),
    { progress: 1, fadeAlpha: 1 }
  );
  assert.deepEqual(
    calculateTransitionProgress({ elapsedMs: 375, durationMs: 750, isPlaying: false, isManualNav: true }),
    { progress: 0.5, fadeAlpha: 0.5 }
  );
  assert.deepEqual(
    calculateTransitionProgress({ elapsedMs: 0, durationMs: 500, isPlaying: true }),
    { progress: 0, fadeAlpha: 0 }
  );
  assert.deepEqual(
    calculateTransitionProgress({ elapsedMs: 900, durationMs: 750, isPlaying: true }),
    { progress: 1, fadeAlpha: 1 }
  );
});

test('buildAudioEffectFilter builds valid FFmpeg chains for all studio audio presets', () => {
  assert.equal(buildAudioEffectFilter('natural'), 'anull');
  assert.match(buildAudioEffectFilter('haram'), /aecho=/);
  assert.match(buildAudioEffectFilter('mosque'), /aecho=/);
  assert.match(buildAudioEffectFilter('studio'), /acompressor=/);
  assert.match(buildAudioEffectFilter('clean'), /afftdn=/);
  assert.match(buildAudioEffectFilter('deep'), /equalizer=/);
});

test('buildAmbientNoiseFilter returns null for none and valid procedural noise chains otherwise', () => {
  assert.equal(buildAmbientNoiseFilter('none', 15, 0.2), null);
  const rain = buildAmbientNoiseFilter('rain', 15, 0.2);
  assert.ok(rain && rain.includes('anoisesrc=color=pink') && rain.includes('duration=15'));
  const ocean = buildAmbientNoiseFilter('ocean', 12.5, 0.25);
  assert.ok(ocean && ocean.includes('anoisesrc=color=brown') && ocean.includes('tremolo='));
});

test('getXfadeTransitionName, estimateExportSizeMb, and buildSafeExportFilename behave deterministically', () => {
  assert.equal(getXfadeTransitionName('fade'), 'fade');
  assert.equal(getXfadeTransitionName('fadeblack'), 'fadeblack');
  assert.equal(getXfadeTransitionName('fadewhite'), 'fadewhite');
  assert.equal(getXfadeTransitionName('zoomin'), 'zoomin');
  assert.equal(getXfadeTransitionName('zoom'), 'zoomin');
  assert.equal(getXfadeTransitionName('slideup'), 'slideup');
  assert.equal(getXfadeTransitionName('dissolve'), 'dissolve');
  assert.equal(getXfadeTransitionName('none'), null);

  const highSize = estimateExportSizeMb({
    durationSec: 20,
    width: 1080,
    height: 1920,
    fps: 30,
    quality: 'high',
    audioBitrateKbps: 192,
  });
  const compactSize = estimateExportSizeMb({
    durationSec: 20,
    width: 720,
    height: 1280,
    fps: 24,
    quality: 'compact',
    audioBitrateKbps: 128,
  });
  assert.ok(highSize > compactSize && compactSize >= 0.2);

  assert.equal(buildSafeExportFilename(1, 1, 7, 'mp4'), 'quran_surah_1_1-7.mp4');
  assert.equal(buildSafeExportFilename(2, 1, 286, 'mp4'), 'quran_surah_2_1-286.mp4');
  assert.equal(buildSafeExportFilename(112, 1, 4, 'webm'), 'quran_surah_112_1-4.webm');
});

test('full-surah export supports up to 286 verses plus intro cover slide and builds valid FFmpeg concat demuxer manifests', () => {
  assert.equal(MAX_EXPORT_VERSES, 286);
  assert.equal(MAX_EXPORT_SLIDES, 287);
  assert.equal(DEFAULT_VIDEO_EXPORT_SETTINGS.includeIntroCover, true);
  // Chained xfade is bounded to XFADE_MAX_SLIDES (30) to guard against Windows ENAMETOOLONG,
  // so fade falls back to the concat engine past that ceiling (or when disabled).
  assert.equal(shouldUseFastConcatEngine(10, 'fade'), false);
  assert.equal(shouldUseFastConcatEngine(10, 'none'), true);
  assert.equal(shouldUseFastConcatEngine(25, 'fade'), false);
  assert.equal(shouldUseFastConcatEngine(30, 'fade'), false);
  assert.equal(shouldUseFastConcatEngine(31, 'fade'), true);
  assert.equal(shouldUseFastConcatEngine(70, 'fade'), true);
  assert.equal(shouldUseFastConcatEngine(286, 'fade'), true);
  // The concat engine still honors fade via per-slide fade-in (>= 0.25s).
  assert.equal(getConcatSlideFadeSec(400), 0.25);
  assert.equal(getConcatSlideFadeSec(1200), 0.6);
  assert.ok(getConcatSlideFadeSec(150) >= 0.25);

  const slideManifest = buildFfmpegConcatSlidesManifest([
    { filename: 'slide_0.jpg', durationSec: 4.5 },
    { filename: 'slide_1.jpg', durationSec: 6.125 },
  ]);
  assert.equal(
    slideManifest,
    "file 'slide_0.jpg'\nduration 4.500\nfile 'slide_1.jpg'\nduration 6.125\nfile 'slide_1.jpg'\n"
  );

  const audioManifest = buildFfmpegConcatAudioManifest(
    ['v0.mp3', 'v1.mp3', 'v2.mp3'],
    'gap.mp3'
  );
  assert.equal(
    audioManifest,
    "file 'v0.mp3'\nfile 'gap.mp3'\nfile 'v1.mp3'\nfile 'gap.mp3'\nfile 'v2.mp3'\n"
  );
});

test('200-verse chunking, static-slide FPS optimization, image encoding tiers, and FFmpeg progress parser work accurately', () => {
  assert.equal(getEffectiveExportFps(30, 10, 'fade'), 30);
  assert.equal(getEffectiveExportFps(30, 10, 'none'), 24);
  assert.equal(getEffectiveExportFps(30, 25, 'fade'), 30);
  assert.equal(getEffectiveExportFps(60, 25, 'fade'), 60);
  assert.equal(getEffectiveExportFps(30, 40, 'fade'), 24);
  assert.equal(getEffectiveExportFps(30, 70, 'fade'), 15);
  assert.equal(getEffectiveExportFps(60, 200, 'fade'), 15);
  assert.equal(getEffectiveExportFps(30, 286, 'fade'), 15);

  // 2026-11-26: PNG (lossless glyph edges) up to 80 slides, then high-quality
  // JPEG tiers for long word-tracking exports.
  assert.equal(getSlideImageEncoding(10).mime, 'image/png');
  assert.equal(getSlideImageEncoding(80).mime, 'image/png');
  assert.equal(getSlideImageEncoding(120).mime, 'image/jpeg');
  assert.equal(getSlideImageEncoding(120).quality, 0.94);
  assert.equal(getSlideImageEncoding(200).mime, 'image/jpeg');
  assert.equal(getSlideImageEncoding(200).quality, 0.94);
  assert.equal(getSlideImageEncoding(400).mime, 'image/jpeg');
  assert.equal(getSlideImageEncoding(400).quality, 0.9);

  assert.equal(EXPORT_SLIDE_BATCH_SIZE, 20);
  assert.equal(getPollIntervalMs(10), 2000);
  assert.equal(getPollIntervalMs(40), 3000);
  assert.equal(getPollIntervalMs(286), 4000);

  const batches200 = chunkIndices(200, EXPORT_SLIDE_BATCH_SIZE);
  assert.equal(batches200.length, 10);
  assert.equal(batches200[0].start, 0);
  assert.equal(batches200[batches200.length - 1].end, 200);
  assert.equal(
    batches200.reduce((sum, b) => sum + (b.end - b.start), 0),
    200
  );

  assert.equal(parseFfmpegTimeSeconds('frame= 120 fps=25 time=00:01:23.45 bitrate=500kbits/s'), 83.45);
  assert.equal(parseFfmpegTimeSeconds('time=00:10:00.00 ... time=01:02:03.50'), 3723.5);
  assert.equal(parseFfmpegTimeSeconds('no timestamp here'), null);
});

test('animated video background filter graph and FPS preservation behave cleanly', () => {
  assert.equal(getEffectiveExportFps(30, 200, 'fade', true), 30);
  assert.equal(getEffectiveExportFps(60, 200, 'fade', true), 30);
  assert.equal(getEffectiveExportFps(24, 5, 'fade', true), 24);

  const filterPlain = buildVideoBackgroundFilterGraph({
    width: 720,
    height: 1280,
    bgBlur: 0,
    bgVideoSpeed: 1,
    fps: 24,
  });
  assert.ok(filterPlain.includes('scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280'));
  assert.ok(filterPlain.includes('overlay=0:0:shortest=1'));
  assert.ok(!filterPlain.includes('gblur='));
  assert.ok(!filterPlain.includes('setpts='));

  const filterStyled = buildVideoBackgroundFilterGraph({
    width: 1080,
    height: 1920,
    bgBlur: 8,
    bgVideoSpeed: 0.75,
    fps: 30,
  });
  assert.ok(filterStyled.includes('gblur=sigma=8'));
  assert.ok(filterStyled.includes('setpts=PTS/0.75'));
  assert.ok(filterStyled.includes('fps=30'));
});

test('isValidVideoBinaryHeader validates real MP4/WebM magic bytes and rejects HTML/JSON error pages', () => {
  assert.ok(BLOB_DOWNLOAD_MAX_BYTES >= 64 * 1024 * 1024);

  // Real MP4 ISO BMFF header: 00 00 00 20 'f' 't' 'y' 'p' 'm' 'p' '4' '2'
  const validMp4 = new Uint8Array([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
  ]);
  assert.equal(isValidVideoBinaryHeader(validMp4, 'mp4'), true);
  assert.equal(isValidVideoBinaryHeader(validMp4, 'webm'), false);

  // Real WebM EBML header: 1A 45 DF A3 ...
  const validWebm = new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81,
  ]);
  assert.equal(isValidVideoBinaryHeader(validWebm, 'webm'), true);
  assert.equal(isValidVideoBinaryHeader(validWebm, 'mp4'), false);

  // HTML proxy error page (e.g. Cloud Run 429 or auth redirect) must be rejected
  const htmlError = new TextEncoder().encode('<!DOCTYPE html><html><body>429 Too Many Requests</body></html>');
  assert.equal(isValidVideoBinaryHeader(htmlError, 'mp4'), false);
  assert.equal(isValidVideoBinaryHeader(htmlError, 'webm'), false);

  // JSON error payload & truncated buffers must be rejected
  const jsonError = new TextEncoder().encode('{"error":"not found"}');
  assert.equal(isValidVideoBinaryHeader(jsonError, 'mp4'), false);
  assert.equal(isValidVideoBinaryHeader(new Uint8Array([0x00, 0x00]), 'mp4'), false);
});

test('isValidUploadedMediaHeader validates PNG/JPEG/MP3/WAV magic bytes and rejects disguised payloads', () => {
  // Real PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const validPng = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  assert.equal(isValidUploadedMediaHeader(validPng, 'png'), true);
  assert.equal(isValidUploadedMediaHeader(validPng, 'jpg'), false);

  // Real JPEG SOI: FF D8 FF E0 (JFIF)
  const validJpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  assert.equal(isValidUploadedMediaHeader(validJpg, 'jpg'), true);
  assert.equal(isValidUploadedMediaHeader(validJpg, 'png'), false);

  // MP3 with ID3v2 tag (10-byte header + padding to the 12-byte minimum)
  const validMp3Id3 = new Uint8Array([
    0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  assert.equal(isValidUploadedMediaHeader(validMp3Id3, 'mp3'), true);
  // MP3 with raw MPEG frame sync: FF FB 90 00
  const validMp3Sync = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  assert.equal(isValidUploadedMediaHeader(validMp3Sync, 'mp3'), true);
  assert.equal(isValidUploadedMediaHeader(validMp3Sync, 'audio'), true);

  // WAV: "RIFF" + size + "WAVE"
  const validWav = new TextEncoder().encode('RIFF\x24\x08\x00\x00WAVEfmt ');
  assert.equal(isValidUploadedMediaHeader(validWav, 'wav'), true);
  assert.equal(isValidUploadedMediaHeader(validWav, 'audio'), true);
  assert.equal(isValidUploadedMediaHeader(validWav, 'mp3'), false);

  // Renamed executable (ELF) and HTML error pages must be rejected in every mode
  const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]);
  assert.equal(isValidUploadedMediaHeader(elf, 'png'), false);
  assert.equal(isValidUploadedMediaHeader(elf, 'jpg'), false);
  assert.equal(isValidUploadedMediaHeader(elf, 'mp3'), false);
  assert.equal(isValidUploadedMediaHeader(elf, 'audio'), false);
  const htmlError = new TextEncoder().encode('<!DOCTYPE html>');
  assert.equal(isValidUploadedMediaHeader(htmlError, 'png'), false);
  assert.equal(isValidUploadedMediaHeader(htmlError, 'audio'), false);

  // Truncated buffers are rejected
  assert.equal(isValidUploadedMediaHeader(new Uint8Array([0x89, 0x50]), 'png'), false);
  assert.equal(isValidUploadedMediaHeader(new Uint8Array(0), 'png'), false);
});

test('upload hardening caps are sane and mutually consistent', () => {
  // A single slide (12 MB cap) must fit comfortably within the whole form budget
  assert.ok(MAX_UPLOADED_SLIDE_BYTES <= MAX_EXPORT_FORM_BYTES);
  assert.ok(MAX_UPLOADED_SLIDE_BYTES === 12 * 1024 * 1024);
  // Custom audio (80 MB) must fit within the whole form budget too
  assert.ok(MAX_UPLOADED_AUDIO_BYTES <= MAX_EXPORT_FORM_BYTES);
  assert.ok(MAX_UPLOADED_AUDIO_BYTES === 80 * 1024 * 1024);
  // Whole-form ceiling allows the documented worst case: 286 slides plus audio
  assert.ok(MAX_EXPORT_FORM_BYTES >= MAX_UPLOADED_AUDIO_BYTES + MAX_UPLOADED_SLIDE_BYTES);
  // Slide cap stays above the largest legit single rendered verse slide (~8 MB for 1080p PNG)
  assert.ok(MAX_UPLOADED_SLIDE_BYTES > 8 * 1024 * 1024);
});

