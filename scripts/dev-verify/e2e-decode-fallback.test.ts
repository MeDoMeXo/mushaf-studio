/**
 * E2E probe — decode-failure fallback chain (the "تعذّر فك ترميز الملف
 * الصوتي" bug).
 *
 * analyzeCustomAudioFile now degrades in three stages so word tracking never
 * dies: (1) full Web Audio decode, (2) <audio> element duration, (3) size
 * estimate. This test simulates a browser where stage 1 fails (the reported
 * bug: unsupported/oversized file) and asserts stages 2-3 keep producing
 * usable even-fallback bounds that drive verseProgressAtTime.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const WORK = '/tmp/e2e-decode-fallback';
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });

// بيئة متصفح مُحاكاة: AudioContext يفشل دائماً (استنساخ الخطأ المُبلَّغ)،
// لكن <audio> يعمل عبر duration حقيقية نضبطها.
class FailingAudioContext {
  async decodeAudioData(): Promise<AudioBuffer> {
    throw new DOMException('Unable to decode audio data', 'EncodingError');
  }
  async close(): Promise<void> {}
}

function installBrowserEnv(opts: { audioDuration: number }) {
  (globalThis as Record<string, unknown>).window = {
    AudioContext: FailingAudioContext,
    // setTimeout حقيقي كي يعمل مهلة الأمان (8s) في getDurationViaAudioElement
    setTimeout: (fn: () => void, ms?: number) =>
      setTimeout(fn, Math.min(ms ?? 0, 50)) as unknown as number,
  };
  (globalThis as Record<string, unknown>).document = {
    createElement: (): {
      _duration: number;
      _onMeta?: () => void;
      _onDur?: () => void;
      _onErr?: () => void;
      _onTime?: () => void;
      preload: string;
      muted: boolean;
      onloadedmetadata: () => void;
      ondurationchange: () => void;
      onerror: () => void;
      ontimeupdate: () => void;
      currentTime: number;
      src: string;
      readonly duration: number;
      load(): void;
      removeAttribute(): void;
    } => ({
      _duration: 0,
      set preload(_v: string) {},
      set muted(_v: boolean) {},
      set onloadedmetadata(fn: () => void) {
        this._onMeta = fn;
      },
      set ondurationchange(fn: () => void) {
        this._onDur = fn;
      },
      set onerror(fn: () => void) {
        this._onErr = fn;
      },
      set ontimeupdate(fn: () => void) {
        this._onTime = fn;
      },
      set currentTime(_v: number) {
        // شقلبة البحث إلى المستقبل: متصفح حقيقي يضبط duration ثم يطلق
        // timeupdate — نحاكي ذلك فوراً
        Promise.resolve().then(() => {
          if (this._duration === 0) this._duration = opts.audioDuration;
          this._onTime?.();
        });
      },
      set src(_v: string) {
        Promise.resolve().then(() => {
          if (opts.audioDuration > 0) {
            this._duration = opts.audioDuration;
            this._onMeta?.();
            this._onDur?.();
          } else {
            // فشل التحميل: onerror (مدة تبقى 0)
            this._onErr?.();
          }
        });
      },
      get duration() {
        return this._duration;
      },
      load() {},
      removeAttribute() {},
    }),
  };
  // نمدّ URL الحقيقي (لا نستبدله — new File يحتاج مُنشئه) بدوال blob وهمية
  const RealURL = URL;
  (globalThis as Record<string, unknown>).URL = class extends RealURL {
    static createObjectURL(): string {
      return 'blob:mock';
    }
    static revokeObjectURL(): void {}
  };
  return { flushTimeouts: () => {} };
}

// بيئة المتصفح تُجهَّز داخل كل اختبار قبل الاستيراد الديناميكي للوحدة
// (analyzeCustomAudioFile يقرأ window عند الاستدعاء وقت التشغيل).
async function loadModule() {
  return await import('../../lib/custom-audio-boundaries');
}

test('decode failure → <audio> duration fallback keeps tracking alive', async () => {
  const { analyzeCustomAudioFile, verseProgressAtTime } = await loadModule();
  // ملف OGG حقيقي من FFmpeg — Web Audio يفشل هنا (بيئتنا المصمّمة للفشل)
  const ogg = path.join(WORK, 'recite.ogg');
  execFileSync('/usr/bin/ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=30',
    '-c:a', 'libvorbis', '-q:a', '4', ogg,
  ], { stdio: 'pipe' });
  const file = new File([fs.readFileSync(ogg)], 'recite.ogg', { type: 'audio/ogg' });

  const env = installBrowserEnv({ audioDuration: 30 });
  const result = await analyzeCustomAudioFile(file, 5);
  env.flushTimeouts();

  // المرحلة 2 نجحت: المدة من <audio> وليست 0 — الخلل القديم كان
  // durationSec=0 → لا حدود → ratio=0 → تتبّع ميت.
  assert.equal(result.durationSec, 30);
  assert.equal(result.durationSource, 'audio-element');
  assert.equal(result.ok, true, 'fallback result must be usable');
  assert.equal(result.starts.length, 5);
  assert.ok(result.message?.includes('توزيع متساوٍ'), 'guidance message shown');

  // التتبّع يعمل: t=15 منتصف المقطع = منتصف الآية الثالثة (progress 0.5)
  const idx0 = Math.floor(result.starts.filter((s) => s <= 15).length) - 1;
  assert.equal(idx0, 2);
  const prog = verseProgressAtTime(result.starts, 15, 30);
  assert.ok(Math.abs(prog - 0.5) < 0.02, `progress=${prog} should be ~0.5 mid-verse`);
  // لحظة بداية آية: t=18 = بداية الآية 4 → progress داخل الآية = 0 (سلوك سليم)
  assert.equal(verseProgressAtTime(result.starts, 18, 30), 0);
});

test('decode failure + <audio> failure → size estimate keeps tracking alive', async () => {
  const { analyzeCustomAudioFile, verseProgressAtTime } = await loadModule();
  // MP3 حقيقي 60 ثانية بمعدل 64kbps — محتوى مركّب (نغمات متعددة + ضوضاء)
  // كي لا يفرط الضغط في تصغير الحجم كما مع نغمة نقية واحدة
  const mp3 = path.join(WORK, 'recite.mp3');
  execFileSync('/usr/bin/ffmpeg', [
    '-y',
    '-filter_complex',
    [
      'sine=frequency=180:duration=60[a]',
      'anoisesrc=d=60:c=pink[a2]',
      'sine=frequency=520:duration=60[b]',
      '[a][a2][b]amix=inputs=3:normalize=1,volume=0.9[out]',
    ].join(';'),
    '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '64k', mp3,
  ], { stdio: 'pipe' });
  const file = new File([fs.readFileSync(mp3)], 'recite.mp3', { type: 'audio/mpeg' });
  const actualKB = fs.statSync(mp3).size / 1024;
  // عند 64kbps الفعلي: 60s × 8KB/s = ~480KB — نطاق تقدير ±35% معقول لتقدير تقريبي
  const expectedSec = actualKB / 8;

  // <audio> يفشل: مدة 0 (onerror)
  const env = installBrowserEnv({ audioDuration: 0 });
  const result = await analyzeCustomAudioFile(file, 3);
  env.flushTimeouts();

  // المرحلة 3: تقدير من الحجم
  assert.equal(result.durationSource, 'estimated');
  assert.ok(
    Math.abs(result.durationSec - expectedSec) / expectedSec < 0.35,
    `estimate=${result.durationSec}s vs expected~${expectedSec.toFixed(0)}s (file ${actualKB.toFixed(0)}KB)`
  );
  assert.equal(result.starts.length, 3);
  assert.ok(result.ok);
  // حتى بالتقدير: التتبّع يعمل داخل نطاق معقول
  const prog = verseProgressAtTime(result.starts, result.durationSec / 2, result.durationSec);
  assert.ok(Math.abs(prog - 0.5) < 0.01);
});

test('even fallback stays valid for single-verse clips', async () => {
  const { buildEvenFallbackBounds } = await loadModule();
  const bounds = buildEvenFallbackBounds(1, 42.5);
  assert.deepEqual(bounds, [0]);
});
