/**
 * production-ambient — المحيطات الصوتية الإجرائية (متصفح فقط).
 *
 * يولّد بافرات ضجيج ملوّنة حتمية البذرة (مطر/ليل/بحر/نسيم) بطول ثوانٍ
 * محددة تُشغَّل كحلقات (loop) بمكسب منضبط — بلا أي ملف خارجي، وبنفس
 * النكهة التي يولّدها anoisesrc في خط تصدير الاستوديو على الخادم.
 */

export type AmbientKind = 'rain' | 'night' | 'ocean' | 'breeze';

/** مدة الحلقة الواحدة (ثوانٍ) — قصيرة كفاية للذاكرة وطويلة لعدم النقر. */
const LOOP_SEC = 6;

/** مولّد ضجيج أبيض ببذرة حتمية (xorshift صغير). */
function seededNoise(seed: number, n: number): Float32Array {
  const out = new Float32Array(n);
  let x = seed || 0x9e3779b9;
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    out[i] = ((x >>> 0) / 0xffffffff) * 2 - 1;
  }
  return out;
}

/** مرشّح تمريرة منخفضة أولي (one-pole) — ينعّم الأبيض إلى بني ناعم. */
function lowpass(input: Float32Array, coef: number): Float32Array {
  const out = new Float32Array(input.length);
  let y = 0;
  for (let i = 0; i < input.length; i++) {
    y += coef * (input[i] - y);
    out[i] = y;
  }
  return out;
}

/** تكرار مرشّح التمريرة المنخفضة p مرة (أعلى p = أعمق/أنعم). */
function lowpassN(input: Float32Array, coef: number, passes: number): Float32Array {
  let cur = input;
  for (let p = 0; p < passes; p++) cur = lowpass(cur, coef);
  return cur;
}

/**
 * توليد حلقة محيط واحدة (أحادية القناة، 44.1kHz).
 * كل نوع يُصمَم ليشبه نظيره الخادمي (export-audio-prep):
 * - rain: أبيض خفيف التنعيم + رشقات زخرفية.
 * - night: بني عميق جداً + وميض صئات متباعد.
 * - ocean: بني متوسط مع تنفّس أمواج بطيء.
 * - breeze: بني فاتح مع تمايل نسبي لطيف.
 */
export function buildAmbientLoop(
  ctx: BaseAudioContext,
  kind: AmbientKind
): AudioBuffer | null {
  const sr = ctx.sampleRate;
  const n = Math.floor(LOOP_SEC * sr);
  const seed = kind === 'rain' ? 1234567 : kind === 'night' ? 7654321 : kind === 'ocean' ? 24680 : 13579;
  const white = seededNoise(seed, n);
  let signal: Float32Array;

  if (kind === 'rain') {
    // أبيض خفيف التنعيم (مطر رقيق) + رشقات أعلى كثافة عابرة.
    signal = lowpassN(white, 0.28, 1);
    for (let i = 0; i < n; i++) {
      const burstGate = 0.6 + 0.4 * Math.sin((i / n) * Math.PI * 7 + i % 1024);
      signal[i] *= 0.5 + 0.5 * burstGate;
    }
  } else if (kind === 'night') {
    // بني عميق (هديل بعيد) + صئات متقطعة كل بضع ثوانٍ.
    const brownish = lowpassN(white, 0.055, 3);
    signal = brownish;
    for (let chirp = 0; chirp < 8; chirp++) {
      const start = Math.floor((n / 8) * chirp + (seed % 997) % (n / 16));
      const len = Math.floor(sr * 0.09);
      for (let i = 0; i < len && start + i < n; i++) {
        const env = Math.sin((Math.PI * i) / len);
        signal[start + i] += env * Math.sin((i / sr) * 2 * Math.PI * 3200) * 0.12;
      }
    }
  } else if (kind === 'ocean') {
    // بني متوسط مع تنفّس أمواج (تضمين سعة 0.08Hz).
    const brownish = lowpassN(white, 0.09, 2);
    signal = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const breath = 0.45 + 0.55 * Math.sin((2 * Math.PI * (i / n) * 0.5) + Math.PI * 0.2);
      signal[i] = brownish[i] * (0.35 + 0.65 * breath);
    }
  } else {
    // breeze: بني فاتح مع تمايل ناعم (تضمين 0.25Hz).
    const brownish = lowpassN(white, 0.16, 1);
    signal = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const sway = 0.5 + 0.5 * Math.sin((2 * Math.PI * (i / n) * 1.5));
      signal[i] = brownish[i] * (0.3 + 0.7 * sway);
    }
  }

  // تطبيع إلى ذروة ~0.35 (محيط خلفي مؤدب) + تلاشي طرفي الحلقة (بلا نقرات).
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(signal[i]));
  const norm = peak > 1e-6 ? 0.35 / peak : 1;
  const fade = Math.min(Math.floor(sr * 0.35), Math.floor(n / 4));
  for (let i = 0; i < n; i++) {
    let a = 1;
    if (i < fade) a = i / fade;
    if (i > n - fade) a = (n - i) / fade;
    signal[i] *= norm * a;
  }

  const buf = ctx.createBuffer(1, n, sr);
  const ch = buf.getChannelData(0);
  ch.set(signal);
  return buf;
}

/** تسميات عربية للأسماء (تُستعمل في الواجهة والمؤثرات). */
export const AMBIENT_LABELS: Record<AmbientKind, string> = {
  rain: 'مطر هادئ',
  night: 'ليل ساكن',
  ocean: 'بحر بعيد',
  breeze: 'نسيم خفيف',
};
