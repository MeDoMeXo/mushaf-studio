import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArabicCoverFilename,
  buildArabicExportFilename,
  buildVideoFileFromBlob,
  buildVideoShareMetadata,
  canShareVideoFile,
  formatShareCaptionForClipboard,
  isLikelyMobileDevice,
  shareExportedVideoFile,
  YOUTUBE_UPLOAD_URL,
} from './video-share';

test('buildVideoShareMetadata formats Arabic surah, ayah range, and reciter cleanly', () => {
  const meta = buildVideoShareMetadata({
    surahName: 'الفاتحة',
    fromAyah: 1,
    toAyah: 7,
    reciterName: 'مشاري راشد العفاسي',
    filename: 'quran_surah_1_1-7.mp4',
  });
  assert.match(meta.title, /سورة الفاتحة/);
  assert.match(meta.title, /١–٧/);
  assert.match(meta.title, /مشاري راشد العفاسي/);
  assert.match(meta.text, /#القرآن_الكريم/);

  const single = buildVideoShareMetadata({
    surahName: 'البقرة',
    fromAyah: 255,
    toAyah: 255,
    reciterName: 'محمود خليل الحصري',
    filename: 'quran_surah_2_255-255.mp4',
  });
  assert.match(single.title, /آية ٢٥٥/);
});

test('buildVideoFileFromBlob preserves MIME type and filename', () => {
  const blob = new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])]);
  const mp4File = buildVideoFileFromBlob(blob, 'recitation.mp4', 'mp4');
  assert.equal(mp4File.name, 'recitation.mp4');
  assert.equal(mp4File.type, 'video/mp4');

  const webmFile = buildVideoFileFromBlob(blob, 'recitation.webm', 'webm');
  assert.equal(webmFile.type, 'video/webm');
});

test('canShareVideoFile handles supported, unsupported, and throwing navigator.canShare', () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
  assert.equal(canShareVideoFile(null, file), false);
  assert.equal(canShareVideoFile({}, file), false);
  assert.equal(
    canShareVideoFile({ share: async () => {}, canShare: () => false }, file),
    false
  );
  assert.equal(
    canShareVideoFile(
      {
        share: async () => {},
        canShare: () => {
          throw new TypeError('unsupported');
        },
      },
      file
    ),
    false
  );
  assert.equal(
    canShareVideoFile({ share: async () => {}, canShare: (d) => Boolean(d?.files?.length) }, file),
    true
  );
});

test('shareExportedVideoFile invokes navigator.share synchronously with attached file and handles cancel/fallback', async () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
  let captured: { files?: File[]; title?: string; text?: string } | null = null;

  const shared = await shareExportedVideoFile({
    nav: {
      canShare: () => true,
      share: async (data) => {
        captured = data;
      },
    },
    file,
    title: 'سورة الفاتحة',
    text: 'وصف',
  });
  assert.equal(shared.status, 'shared');
  const capturedFiles = (captured as { files?: File[] } | null)?.files;
  assert.equal(capturedFiles?.[0]?.name, 'clip.mp4');

  // User cancelling the OS share dialog should not raise an error
  const abortErr = new Error('Share canceled');
  abortErr.name = 'AbortError';
  const cancelled = await shareExportedVideoFile({
    nav: {
      canShare: () => true,
      share: async () => {
        throw abortErr;
      },
    },
    file,
    title: 't',
    text: 'x',
  });
  assert.equal(cancelled.status, 'cancelled');

  // Unsupported desktop browser triggers manual download fallback
  let fallbackCalled = false;
  const unsupported = await shareExportedVideoFile({
    nav: {
      canShare: () => false,
      share: async () => {},
    },
    file,
    title: 't',
    text: 'x',
    onFallbackDownload: () => {
      fallbackCalled = true;
    },
  });
  assert.equal(unsupported.status, 'unsupported');
  assert.equal(fallbackCalled, true);
});

test('YouTube desktop upload helpers format clipboard text and detect mobile vs PC', () => {
  assert.equal(YOUTUBE_UPLOAD_URL, 'https://www.youtube.com/upload');
  const clip = formatShareCaptionForClipboard({
    title: 'سورة الفاتحة (١–٧)',
    text: 'وصف التلاوة #القرآن_الكريم',
  });
  assert.match(clip, /^سورة الفاتحة/);
  assert.match(clip, /#القرآن_الكريم$/);

  assert.equal(isLikelyMobileDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false);
  assert.equal(isLikelyMobileDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), false);
  assert.equal(isLikelyMobileDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)'), true);
  assert.equal(isLikelyMobileDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), true);

  const arName = buildArabicExportFilename({
    surahName: 'الفاتحة',
    fromAyah: 1,
    toAyah: 7,
    reciterName: 'مشاري راشد العفاسي',
    format: 'mp4',
  });
  assert.equal(arName, 'سورة الفاتحة (1-7) - مشاري راشد العفاسي.mp4');

  const sanitized = buildArabicExportFilename({
    surahName: 'الأنعام:*/test',
    fromAyah: 5,
    toAyah: 5,
    reciterName: 'القارئ|الأول',
    format: 'webm',
  });
  assert.equal(/[<>:"/\\|?*]/.test(sanitized), false);
  assert.match(sanitized, /\.webm$/);

  assert.equal(
    buildArabicCoverFilename({
      surahName: 'الفاتحة',
      ayahNumber: 1,
      reciterName: 'مشاري راشد العفاسي',
      format: 'png',
    }),
    'غلاف سورة الفاتحة (آية 1) - مشاري راشد العفاسي.png'
  );
  assert.equal(
    buildArabicCoverFilename({
      surahName: 'البقرة',
      ayahNumber: 255,
      reciterName: '',
      format: 'jpeg',
    }),
    'غلاف سورة البقرة (آية 255).jpg'
  );
});
