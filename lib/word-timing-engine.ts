/**
 * محرّك توقيتات الكلمات من الطاقة الصوتية الفعلية (غلاف RMS).
 *
 * المشكلة القديمة: كان التتبّع يوزّع مدة ملف الآية على الكلمات بأوزان
 * نطق تقديرية ثابتة لكل القرّاء (طول الملف × نسبة الوزن) — فتجاهل فروق
 * الإيقاع بين القراء، والسكوت التمهيدي/الختامي داخل الملف، ومدّ القارئ
 * للمدود. الخطأ المرصود بلغ ~٠.٩ ثانية في آخر آية (التحقق الحي ١:٥ و١:٧
 * والحصري/العفاسي).
 *
 * الحل: نحلّل غلاف الطاقة (RMS كل ١٠ مللي) للملف الفعلي، نستبعد السكوت،
 * ثم نوزّع حدود الكلمات على «الخط الزمني المنطوق» تراكمياً بالأوزان —
 * فيتكيّف التتبّع مع إيقاع كل قارئ: سكوت البداية لا يُحسب على أول كلمة،
 * والكلمة الأخيرة لا تبقى مضيئة في سكوت النهاية، والوقفات الداخلية
 * تُسند للكلمة السابقة.
 *
 * وحدة نقية (لا DOM/لا ffmpeg): الخادم يغذّيها بغلاف PCM المفكوك،
 * والعميل يستهلك الناتج فقط (أزمنة ثابتة عبر JSON). مشتركة بين
 * المعاينة الحية (use-studio-canvas) وخطة التصدير (export-audio-prep).
 */

/** نافذة التحليل بالمللي ثانية — دقة ١٠ مللي تكفي التتبّع البصري. */
export const WORD_TIMING_HOP_MS = 10;

export interface WordTimingSpan {
  /** فهرس الكلمة داخل الآية (يطابق AyahWordTiming.index). */
  index: number;
  /** بداية نطق الكلمة (ثانية من بداية ملف الآية الصوتي). */
  startSec: number;
  /** نهاية نطق الكلمة (ثانية). */
  endSec: number;
}

/** مقطع منطوق متصل (بوحدات النطاقات hop): [fromHop, toHop). */
export interface VoicedRun {
  fromHop: number;
  toHop: number;
}

/**
 * يحسب غلاف RMS لكل نافذة hopMs من PCM أحادي القناة.
 * قيم الغلاف 0..1 (نسبة السعة الكاملة 32768).
 */
export function computeRmsEnvelope(
  pcm: Int16Array,
  sampleRate: number,
  hopMs: number = WORD_TIMING_HOP_MS
): Float32Array {
  const hopSamples = Math.max(1, Math.floor((sampleRate * hopMs) / 1000));
  const hops = Math.floor(pcm.length / hopSamples);
  const env = new Float32Array(Math.max(0, hops));
  for (let h = 0; h < hops; h++) {
    const base = h * hopSamples;
    let acc = 0;
    for (let i = 0; i < hopSamples; i++) {
      const v = pcm[base + i] / 32768;
      acc += v * v;
    }
    env[h] = Math.sqrt(acc / hopSamples);
  }
  return env;
}

/**
 * عتبة الصوت: ٥٪ من أعلى ذروة الغلاف (بحد أدنى يمنع ضجيج الخلفية
 * الرقمي الصفري من أن يُحسب «نطقاً»). معايرة على تلاوات حقيقية
 * (العفاسي/الحصري) — تعزل السكوت دون قص المدود الخافتة.
 */
export function envelopeVoiceThreshold(envelope: Float32Array): number {
  let maxRms = 0;
  for (let i = 0; i < envelope.length; i++) {
    if (envelope[i] > maxRms) maxRms = envelope[i];
  }
  if (maxRms <= 0) return 1; // ملف صامت تماماً — كل شيء تحت العتبة
  return Math.max(0.006, maxRms * 0.05);
}

/** يجمع النطاقات المتجاورة فوق العتبة في مقاطع منطوقة (≥ minHop نطاق). */
export function findVoicedRuns(
  envelope: Float32Array,
  threshold: number,
  minHop = 3
): VoicedRun[] {
  const runs: VoicedRun[] = [];
  let start = -1;
  for (let i = 0; i < envelope.length; i++) {
    const voiced = envelope[i] >= threshold;
    if (voiced && start < 0) start = i;
    if (!voiced && start >= 0) {
      if (i - start >= minHop) runs.push({ fromHop: start, toHop: i });
      start = -1;
    }
  }
  if (start >= 0 && envelope.length - start >= minHop) {
    runs.push({ fromHop: start, toHop: envelope.length });
  }
  return runs;
}

/**
 * يبني حدود الكلمات على «الخط الزمني المنطوق»:
 *
 *   1) تُسلسَل المقاطع المنطوقة (السكوت بين الآيات/الوقفات يُستبعد).
 *   2) كل حد تراكمي للأوزان (q = وزن الكلمات حتى k ÷ المجموع) يُقاس
 *      على الموضع المنطوق المقابل: hop عند الموضع ⌊q × عدد النطاقات
 *      المنطوقة⌋ — أي تُوزَّع المدة المنطوقة الفعلية على الكلمات بأوزانها.
 *   3) إن وقع الحد داخل سكوت بين كلمتين، يُقفز إلى أول نطق بعده —
 *      فالوقفة تُسند للكلمة السابقة (تبقى مضيئة أثناء وقفة القارئ
 *      تماماً كما يفعل الإنسان عند القراءة).
 *
 * الفروق عن النموذج القديم (نسبة زمنية على كامل الملف):
 *   - سكوت تمهيدي (بلغ ٠.٣٣ ثانية عند الحصري) لم يعد يُحسب على أول كلمة.
 *   - سكوت ختامي (بلغ ٠.٩ ثانية عند العفاسي 112:1) لم يعد يُبقي آخر
 *     كلمة مضيئة بعد انتهاء النطق.
 *   - إيقاع القارئ الفعلي (مدود/تسريع) ينعكس على حدود الكلمات.
 */
export function buildWordTimingSpans(
  envelope: Float32Array,
  weights: readonly number[],
  hopMs: number = WORD_TIMING_HOP_MS
): WordTimingSpan[] | null {
  const n = weights.length;
  if (!n || envelope.length < 4) return null;

  const threshold = envelopeVoiceThreshold(envelope);
  const runs = findVoicedRuns(envelope, threshold);
  if (!runs.length) return null;

  // voicedHops[p] = رقم النطاق (hop) للموضع المنطوق p.
  const voicedHops: number[] = [];
  // voiced: هل النطاق h منطوق؟ (للقفز فوق السكوت عند بدايات الكلمات)
  const voiced: boolean[] = new Array(envelope.length).fill(false);
  for (const r of runs) {
    for (let h = r.fromHop; h < r.toHop; h++) {
      voiced[h] = true;
      voicedHops.push(h);
    }
  }
  const totalVoiced = voicedHops.length;
  if (!totalVoiced) return null;

  const lastVoicedHop = voicedHops[totalVoiced - 1];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (!(totalWeight > 0)) return null;

  const hopTime = (h: number) => Number(((h * hopMs) / 1000).toFixed(3));

  const spans: WordTimingSpan[] = [];
  // بداية الكلمة الأولى = أول نطق فعلي (بعد السكوت التمهيدي).
  let prevEndHop = -1;
  let cumWeight = 0;

  for (let k = 0; k < n; k++) {
    cumWeight += weights[k];
    // الموضع المنطوق للحد التراكمي (بحد أقصى آخر موضع منطوق).
    const vEnd = Math.min(totalVoiced - 1, Math.round((cumWeight / totalWeight) * totalVoiced));
    let endHop = voicedHops[vEnd];
    // بداية الكلمة: أول نطق بعد نهاية الكلمة السابقة (يقفز فوق السكوت).
    let startHop: number;
    if (prevEndHop < 0) {
      startHop = voicedHops[0];
    } else {
      let h = prevEndHop + 1;
      while (h < envelope.length && !voiced[h]) h++;
      startHop = Math.min(h, lastVoicedHop);
    }
    if (endHop < startHop) endHop = startHop;
    if (endHop > lastVoicedHop) endHop = lastVoicedHop;
    if (startHop > lastVoicedHop) startHop = lastVoicedHop;
    spans.push({
      index: k,
      startSec: hopTime(startHop),
      endSec: hopTime(Math.max(startHop, endHop)),
    });
    prevEndHop = Math.max(prevEndHop, endHop);
  }
  return spans;
}

/**
 * فهرس الكلمة النشطة عند اللحظة tSec من ملف الآية (النموذج الحقيقي).
 * يعرج للخلف: أول كلمة تبدأ قبل t — الوقفة بعد كلمة تبقيها مضيئة
 * (السكوت بين الكلمات يتبع الكلمة السابقة). -1 قبل أول نطق.
 */
export function findActiveWordIndexBySec(
  spans: readonly WordTimingSpan[],
  tSec: number
): number {
  const n = spans.length;
  if (!n) return -1;
  const t = Math.max(0, tSec);
  for (let i = n - 1; i >= 0; i--) {
    if (t >= spans[i].startSec) return i;
  }
  return -1;
}

/**
 * يحوّل حدود الكلمات إلى مدد شرائح التصدير بحيث يغطي مجموعها المدة
 * الصوتية للآية بالضبط: مدة شريحة الكلمة k = بداية الكلمة التالية −
 * بدايتها (فالوقفة بعد الكلمة تبقى على شريحتها)، وآخر شريحة تمتد
 * حتى نهاية الملف (السكوت الختامي يتبع آخر كلمة).
 * يُقصّ حد أدنى (minSlideSec) ثم يُعاد ضبط المجموع للمدة الكاملة بدقة.
 */
export function buildSlideDurationsFromSpans(
  spans: readonly WordTimingSpan[],
  totalAudioSec: number,
  minSlideSec = 0.12
): number[] {
  const n = spans.length;
  if (!n || !(totalAudioSec > 0)) return [];
  const raw: number[] = [];
  for (let k = 0; k < n; k++) {
    // مدة الشريحة = من بداية هذه الكلمة إلى بداية الكلمة التالية؛
    // آخِر شريحة تمتد حتى نهاية الملف (سكوت الختام يتبع آخر كلمة).
    const stop = k + 1 < n ? spans[k + 1].startSec : totalAudioSec;
    raw.push(Math.max(minSlideSec, stop - spans[k].startSec));
  }
  // إعادة الضبط لتطابق المجموع المدةَ الكاملة بالضبط (المتبقي يُضاف
  // للشريحة الأخيرة إن كان موجباً، أو يُقتطع منها تناسبياً إن تجاوز).
  let sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return new Array(n).fill(totalAudioSec / n);
  if (sum !== totalAudioSec) {
    const scale = totalAudioSec / sum;
    for (let k = 0; k < n; k++) raw[k] = raw[k] * scale;
    sum = raw.reduce((a, b) => a + b, 0);
    // الفرق العشري الصغير (≤ 0.01s عادة) يُحمّل على الشريحة الأخيرة.
    const residual = totalAudioSec - sum;
    if (Math.abs(residual) > 1e-9) {
      raw[n - 1] = Math.max(minSlideSec * 0.5, raw[n - 1] + residual);
    }
  }
  return raw.map((d) => Number(d.toFixed(4)));
}
