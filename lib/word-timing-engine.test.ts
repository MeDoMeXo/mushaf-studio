/**
 * اختبارات محرّك توقيتات الكلمات من غلاف الطاقة (word-timing-engine).
 * حالات حرجة: توزيع الأوزان على الخط المنطوق، استبعاد السكوت التمهيدي/
 * الختامي، إسناد الوقفة للكلمة السابقة، ملف صامت، كلمة واحدة، تطابق
 * مجموع مدد شرائح التصدير مع المدة الصوتية بالضبط، واختيار الكلمة
 * النشطة عند الحدود والوقفات.
 */
import test from 'node:test';
import assert from 'node:assert';
import {
  WORD_TIMING_HOP_MS,
  buildSlideDurationsFromSpans,
  buildWordTimingSpans,
  computeRmsEnvelope,
  envelopeVoiceThreshold,
  findActiveWordIndexBySec,
  findVoicedRuns,
} from './word-timing-engine';

const HOP = WORD_TIMING_HOP_MS; // 10ms

/** يبني غلافاً تركيبياً من مقاطع {ثوانٍ، مطوال أم صامت}. */
function synthEnv(segments: Array<{ sec: number; amp: number }>): Float32Array {
  const hops = segments.reduce((a, s) => a + Math.round(s.sec * 1000 / HOP), 0);
  const env = new Float32Array(hops);
  let h = 0;
  for (const s of segments) {
    const n = Math.round((s.sec * 1000) / HOP);
    for (let i = 0; i < n; i++) env[h++] = s.amp;
  }
  return env;
}

test('computeRmsEnvelope: قيم RMS صحيحة لثابت السعة', () => {
  // 80 عينة بمعدل 8000Hz = نافذة واحدة 10ms بسعة ±16384 (نصف السعة)
  const pcm = new Int16Array(80);
  for (let i = 0; i < 80; i++) pcm[i] = i % 2 === 0 ? 16384 : -16384;
  const env = computeRmsEnvelope(pcm, 8000, 10);
  assert.equal(env.length, 1);
  assert.ok(Math.abs(env[0] - 0.5) < 1e-6);
});

test('findVoicedRuns: يقص النطاقات الأقصر من الحد ويستبعد السكوت', () => {
  // voiced(5 hops) + silence(4) + voiced(3) + silence(10)
  const env = new Float32Array([
    .5, .5, .5, .5, .5,
    0, 0, 0, 0,
    .4, .4, .4,
    0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const runs = findVoicedRuns(env, 0.05, 3);
  assert.equal(runs.length, 2);
  assert.equal(runs[0].fromHop, 0);
  assert.equal(runs[0].toHop, 5);
  assert.equal(runs[1].fromHop, 9);
  assert.equal(runs[1].toHop, 12);
});

test('envelopeVoiceThreshold: ٥٪ من الذروة وبحد أدنى', () => {
  const env = new Float32Array([0.4, 0.8, 0.1]);
  assert.ok(Math.abs(envelopeVoiceThreshold(env) - 0.04) < 1e-9);
  const tiny = new Float32Array([0.001, 0.002]);
  assert.ok(envelopeVoiceThreshold(tiny) >= 0.006);
  assert.equal(envelopeVoiceThreshold(new Float32Array(0)), 1);
});

test('buildWordTimingSpans: سكوت البداية مستبعد وحدود الكلمات على الخط المنطوق', () => {
  // 0.3s سكوت + 2.0s نطق + 0.5s سكوت + 2.0s نطق + 0.3s سكوت
  const env = synthEnv([
    { sec: 0.3, amp: 0 },
    { sec: 2.0, amp: 0.5 },
    { sec: 0.5, amp: 0 },
    { sec: 2.0, amp: 0.5 },
    { sec: 0.3, amp: 0 },
  ]);
  const spans = buildWordTimingSpans(env, [1, 1, 1, 1], HOP);
  assert.ok(spans);
  assert.equal(spans.length, 4);
  // أول كلمة تبدأ عند أول نطق فعلي (بعد السكوت التمهيدي 0.3s)
  assert.ok(Math.abs(spans[0].startSec - 0.3) < 0.03, `start0=${spans[0].startSec}`);
  // النطق المنطوق الكلي = 4s؛ كل ربع = 1s من الخط المنطوق
  // word0: 0.3→1.3 ، word1: 1.3→2.8 (الحد وقع على بداية النطق الثاني
  // فيقفز فوق الفاصل 0.5s — الوقفة تتبع الكلمة السابقة)
  assert.ok(Math.abs(spans[0].endSec - 1.3) < 0.03, `end0=${spans[0].endSec}`);
  assert.ok(Math.abs(spans[1].startSec - 1.3) < 0.05, `start1=${spans[1].startSec}`);
  assert.ok(Math.abs(spans[1].endSec - 2.8) < 0.05, `end1=${spans[1].endSec}`);
  // آخر كلمة تنتهي عند آخر نطق (قبل سكوت الختام) وليس عند نهاية الملف
  assert.ok(Math.abs(spans[3].endSec - 4.8) < 0.05, `end3=${spans[3].endSec}`);
  // حدود متصاعدة دائماً
  for (let k = 1; k < 4; k++) {
    assert.ok(spans[k].startSec >= spans[k - 1].endSec - 0.02);
  }
});

test('buildWordTimingSpans: ملف صامت/فارغ ← null', () => {
  assert.equal(buildWordTimingSpans(new Float32Array(100).fill(0), [1, 2], HOP), null);
  assert.equal(buildWordTimingSpans(new Float32Array(0), [1], HOP), null);
  assert.equal(buildWordTimingSpans(synthEnv([{ sec: 1, amp: 0.5 }]), [], HOP), null);
});

test('buildWordTimingSpans: كلمة واحدة تغطي كل النطق', () => {
  const env = synthEnv([
    { sec: 0.2, amp: 0 },
    { sec: 1.5, amp: 0.6 },
    { sec: 0.4, amp: 0 },
  ]);
  const spans = buildWordTimingSpans(env, [3], HOP);
  assert.ok(spans);
  assert.equal(spans.length, 1);
  assert.ok(Math.abs(spans[0].startSec - 0.2) < 0.03);
  assert.ok(Math.abs(spans[0].endSec - 1.7) < 0.03);
});

test('findActiveWordIndexBySec: قبل النطق -1 والوقفة تُبقي الكلمة السابقة', () => {
  const spans = [
    { index: 0, startSec: 0.3, endSec: 1.3 },
    { index: 1, startSec: 1.4, endSec: 2.8 },
    { index: 2, startSec: 3.0, endSec: 4.0 },
  ];
  assert.equal(findActiveWordIndexBySec(spans, 0.1), -1); // سكوت تمهيدي
  assert.equal(findActiveWordIndexBySec(spans, 0.3), 0);
  assert.equal(findActiveWordIndexBySec(spans, 2.0), 1);
  assert.equal(findActiveWordIndexBySec(spans, 2.9), 1); // وقفة بين كلمتين → السابقة
  assert.equal(findActiveWordIndexBySec(spans, 4.5), 2); // بعد آخر حد
  assert.equal(findActiveWordIndexBySec(spans, -1), -1); // سالب → مقصوص لصفر → -1
});

test('buildSlideDurationsFromSpans: المجموع يطابق المدة الكاملة بالضبط', () => {
  const spans = [
    { index: 0, startSec: 0.1, endSec: 1.0 },
    { index: 1, startSec: 1.2, endSec: 2.1 },
    { index: 2, startSec: 2.4, endSec: 3.0 },
  ];
  const durs = buildSlideDurationsFromSpans(spans, 3.6, 0.12);
  assert.equal(durs.length, 3);
  const sum = durs.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 3.6) < 1e-3, `sum=${sum}`);
  for (const d of durs) assert.ok(d >= 0.05);
  // مدة الشريحة الأولى = حتى بداية الكلمة التالية (الوقفة تتبع السابقة)
  assert.ok(Math.abs(durs[0] - 1.1) < 0.05, `d0=${durs[0]}`);
});

test('buildSlideDurationsFromSpans: قصّ الحد الأدنى لا يخربش المجموع', () => {
  // ١٠ كلمات في 1.2s: الحد الأدنى 0.12 يفرض قيماً متساوية تقريباً
  const spans = Array.from({ length: 10 }, (_, i) => ({
    index: i,
    startSec: i * 0.1,
    endSec: i * 0.1 + 0.09,
  }));
  const durs = buildSlideDurationsFromSpans(spans, 1.2, 0.12);
  const sum = durs.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1.2) < 1e-2, `sum=${sum}`);
});
