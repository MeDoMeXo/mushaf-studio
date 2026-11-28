/**
 * timeline-peaks — حسابات نقية لخط «منتج الصوت» الزمني في الاستوديو.
 *
 * تحوّل بافر صوت مفكوك الترميز (AudioBuffer) إلى قمم موجية (peaks) خفيفة
 * قابلة للرسم على كانفاس، وتحسب خطوة المسطرة الزمنية اللطيفة، وتبني
 * مقاطع الآيات التراكمية على الخط الزمني المطلق.
 *
 * نقية 100% — بلا DOM — لذا قابلة للاختبار مباشرة.
 */

/** قمم موجة مقطع آية واحدة (نتيجة decode + اختزال). */
export interface WaveformPeaks {
  /** المدة الفعلية بالثواني من بافر الصوت. */
  durationSec: number;
  /** قمم مطلقة (0..1) بعد التطبيع — طولها = buckets. */
  peaks: Float32Array;
}

/** مقطع آية على الخط الزمني المطلق للمنتج. */
export interface TimelineSegment {
  verseId: number;
  verseNumber: number;
  /** البداية المطلقة (ثوانٍ) على الخط المتراكم. */
  startSec: number;
  /** المدة الفعلية (ثوانٍ). */
  durationSec: number;
  /** قمم الموجة — null = لم تُحلَّل بعد أو فشلت (يُرسم نمط هادئ). */
  peaks: Float32Array | null;
}

/** خطوة مسطرة لطيفة (0.5/1/2/5/10/15/30/60…) تعطي ~targetTicks علامات. */
const RULER_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];

export function niceRulerStep(totalSec: number, targetTicks = 5): number {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return 1;
  const raw = totalSec / Math.max(1, targetTicks);
  for (const step of RULER_STEPS) {
    if (raw <= step) return step;
  }
  return RULER_STEPS[RULER_STEPS.length - 1];
}

/** تسمية زمن المسطرة: m:ss (مثل 00:05 / 1:03) — النمط نفسه في الصورة المرجعية. */
export function formatRulerLabel(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** مزج القنوات إلى قناة أحادية (متوسط القنوات) — length = عدد العينات. */
export function mixToMono(channels: Float32Array[], length: number): Float32Array {
  if (channels.length === 0) return new Float32Array(length);
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(length);
  const n = channels.length;
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let c = 0; c < n; c++) sum += channels[c][i];
    out[i] = sum / n;
  }
  return out;
}

/**
 * اختزال قناة أحادية إلى قمم موجية (max-abs لكل دلو) مع تطبيع إلى 0..1
 * ضد أقصى قمة — فيصبح الشكل مستقلاً عن مستوى التسجيل الصوتي.
 */
export function computePeaks(mono: Float32Array, buckets: number): Float32Array {
  const count = Math.max(1, Math.floor(buckets));
  const out = new Float32Array(count);
  const len = mono.length;
  if (len === 0) return out;
  const per = len / count;
  let max = 0;
  for (let b = 0; b < count; b++) {
    const start = Math.floor(b * per);
    const end = Math.min(len, Math.floor((b + 1) * per));
    let peak = 0;
    for (let i = start; i < end; i++) {
      const v = Math.abs(mono[i]);
      if (v > peak) peak = v;
    }
    out[b] = peak;
    if (peak > max) max = peak;
  }
  if (max > 0) {
    for (let b = 0; b < count; b++) out[b] = out[b] / max;
  }
  return out;
}

/**
 * تقدير احتياطي لمدة آية حين يتعذّر فك ترميز صوتها: متوسط 0.45 ث/كلمة
 * مع حد أدنى 1.5 ث — يكفي لتقريب عرض المقطع على الخط الزمني.
 */
export function estimateVerseDurationSec(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.5, words * 0.45);
}

/**
 * بناء المقاطع التراكمية للخط الزمني من مدد الآيات (بترتيبها المُمرَّر).
 * start لكل آية = مجموع مدد سابقاتها — الآيات متلاصقة بلا فجوات
 * (الفواصل الاختيارية تُدار منفصلة في التشغيل، لا في الخط المطلق).
 */
export function buildTimelineSegments(
  items: readonly {
    verseId: number;
    verseNumber: number;
    durationSec: number;
    peaks: Float32Array | null;
  }[]
): TimelineSegment[] {
  let cursor = 0;
  return items.map((it) => {
    const seg: TimelineSegment = {
      verseId: it.verseId,
      verseNumber: it.verseNumber,
      startSec: cursor,
      durationSec: it.durationSec,
      peaks: it.peaks,
    };
    cursor += it.durationSec;
    return seg;
  });
}

/** إجمالي مدة الخط الزمني (مجموع المدد). */
export function timelineTotalSec(segments: readonly TimelineSegment[]): number {
  let t = 0;
  for (const s of segments) t += s.durationSec;
  return t;
}

/** أطول/أقصر آية (رقمها ومدتها) — null حين لا مقاطع. */
export function extremeSegments(
  segments: readonly TimelineSegment[]
): { longest: TimelineSegment | null; shortest: TimelineSegment | null } {
  if (!segments.length) return { longest: null, shortest: null };
  let longest = segments[0];
  let shortest = segments[0];
  for (const s of segments) {
    if (s.durationSec > longest.durationSec) longest = s;
    if (s.durationSec < shortest.durationSec) shortest = s;
  }
  return { longest, shortest };
}

/**
 * موضع مؤشر التشغيل المطلق (ثوانٍ) على الخط الزمني:
 * - الوضع المدمج (ملف لكل آية): بداية الآية النشطة + موضع التشغيل داخلها.
 * - الوضع المخصص: الموضع نفسه على المسار الواحد (start = 0).
 */
export function playheadAbsoluteSec(
  segments: readonly TimelineSegment[],
  activeIdx: number,
  currentTimeSec: number
): number {
  const seg = segments[activeIdx];
  if (!seg) return 0;
  return seg.startSec + Math.max(0, Number.isFinite(currentTimeSec) ? currentTimeSec : 0);
}

/** إيجاد المقطع الذي يقع فيه زمن مطلق معطى (بحث خطي بسيط — العدد صغير). */
export function findSegmentAtSec(
  segments: readonly TimelineSegment[],
  timeSec: number
): number {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (timeSec >= segments[i].startSec) return i;
  }
  return 0;
}
