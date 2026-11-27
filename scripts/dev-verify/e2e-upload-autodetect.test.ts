/**
 * E2E probe — auto-detect on upload path (browser Web Audio simulation).
 *
 * Verifies the exact flow handleAudioFileUpload now runs: analyze a REAL
 * audio file (synthesized recitation with silence gaps) through
 * analyzeCustomAudioFile's pure core (detectBoundariesFromPeakLevels fed by
 * the same windowSec logic), then asserts the resulting bounds would drive
 * word tracking via verseProgressAtTime — i.e. the "not effective" bug is
 * gone: ratio advances inside every verse segment even before the user
 * touches anything.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildEvenFallbackBounds,
  detectBoundariesFromPeakLevels,
  findVerseIndexAtTime,
  verseProgressAtTime,
} from '../../lib/custom-audio-boundaries';

const WORK = '/tmp/e2e-upload-autodetect';
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });

/** Same windowSec math as analyzeCustomAudioFile. */
const WINDOW_SEC = 0.05;

/** Builds peak levels from a real decoded WAV (16-bit mono PCM). */
function peaksFromWav(wavPath: string): { peaks: number[]; durationSec: number } {
  const buf = fs.readFileSync(wavPath);
  // Parse minimal WAV header: find 'data' chunk
  let pos = 12;
  let dataStart = -1;
  let sampleRate = 44100;
  while (pos < buf.length - 8) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') sampleRate = buf.readUInt32LE(pos + 12);
    if (id === 'data') {
      dataStart = pos + 8;
      break;
    }
    pos += 8 + size + (size % 2);
  }
  if (dataStart < 0) throw new Error('no data chunk');
  const nSamples = Math.floor((buf.length - dataStart) / 2);
  const winSamples = Math.max(1, Math.floor(WINDOW_SEC * sampleRate));
  const peaks: number[] = [];
  for (let p = dataStart; p + winSamples * 2 <= buf.length; p += winSamples * 2) {
    let peak = 0;
    for (let j = 0; j < winSamples; j += 4) {
      const v = Math.abs(buf.readInt16LE(p + j * 2)) / 32768;
      if (v > peak) peak = v;
    }
    peaks.push(peak);
  }
  return { peaks, durationSec: nSamples / sampleRate };
}

test('upload auto-detect: real audio file yields working verse tracking', () => {
  // ٣ آيات حقيقية: 4s نغمة، 0.9s سكوت، 6s نغمة، 1.1s سكوت، 3s نغمة
  const wav = path.join(WORK, 'recite.wav');
  execFileSync('/usr/bin/ffmpeg', [
    '-y',
    '-filter_complex',
    [
      'sine=frequency=200:duration=4[a]',
      'anullsrc=r=44100:cl=mono:d=0.9[s1]',
      'sine=frequency=240:duration=6[b]',
      'anullsrc=r=44100:cl=mono:d=1.1[s2]',
      'sine=frequency=280:duration=3[c]',
      '[a][s1][b][s2][c]concat=n=5:v=0:a=1,loudnorm=I=-20[out]',
    ].join(';'),
    '-map', '[out]', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', wav,
  ], { stdio: 'pipe' });

  // نفس مسار الكشف التلقائي الذي يستدعيه handleAudioFileUpload فور الرفع
  const { peaks, durationSec } = peaksFromWav(wav);
  const result = detectBoundariesFromPeakLevels(peaks, 3, WINDOW_SEC, durationSec);

  assert.equal(result.ok, true, `auto-detect must succeed: ${result.message ?? ''}`);
  assert.equal(result.starts.length, 3);
  assert.equal(result.starts[0], 0);
  // الفاصل الأول ينتهي عند 4.9s — البداية الفعلية للآية 2 قريبة منها
  assert.ok(Math.abs(result.starts[1] - 4.82) < 0.25, `start1=${result.starts[1]}`);
  // الفاصل الثاني ينتهي عند 12.0s — بداية الآية 3 قريبة منها
  assert.ok(Math.abs(result.starts[2] - 11.92) < 0.25, `start2=${result.starts[2]}`);

  // محاكاة تشغيل الملف والتحقق أن التتبّع يتقدّم داخل كل آية (الخلل القديم:
  // بلا حدود كان ratio=0 دائماً فلا تتبّع)
  for (const [t, wantIdx, wantProgressAbove] of [
    [2.0, 0, 0.4],   // منتصف الآية 1
    [5.0, 1, 0.01],  // بداية الآية 2 (تبدأ عند ~4.87 → التقدّم ~0.018)
    [8.5, 1, 0.45],  // منتصف الآية 2 (مدتها ~7.1s → التقدّم ≈ 0.51)
    [13.5, 2, 0.4],  // داخل الآية 3
  ] as const) {
    const idx = findVerseIndexAtTime(result.starts, t, durationSec);
    assert.equal(idx, wantIdx, `t=${t}`);
    const prog = verseProgressAtTime(result.starts, t, durationSec);
    assert.ok(
      prog > wantProgressAbove && prog <= 1,
      `t=${t} progress=${prog.toFixed(3)} must be > ${wantProgressAbove}`
    );
  }
});

test('upload fallback: even bounds keep tracking alive when detection fails', () => {
  // تلاوة متصلة بلا فواصل = الكشف يفشل → احتياطي متساوٍ يبقي التتبّع حياً
  const wav = path.join(WORK, 'continuous.wav');
  execFileSync('/usr/bin/ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'sine=frequency=200:duration=15',
    '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', wav,
  ], { stdio: 'pipe' });

  const { peaks, durationSec } = peaksFromWav(wav);
  const failed = detectBoundariesFromPeakLevels(peaks, 3, WINDOW_SEC, durationSec);
  assert.equal(failed.ok, false, 'no gaps → detection must fail → fallback kicks in');

  const fallback = buildEvenFallbackBounds(3, durationSec);
  assert.deepEqual(fallback.map((t) => Math.round(t)), [0, 5, 10]);
  // التتبّع يعمل حتى بالاحتياطي (نصف المقطع = منتصف الآية 2)
  const prog = verseProgressAtTime(fallback, 7.5, durationSec);
  assert.ok(Math.abs(prog - 0.5) < 0.01, `progress=${prog}`);
  assert.equal(findVerseIndexAtTime(fallback, 7.5, durationSec), 1);
});
