/**
 * audio-producer-edit — نموذج التحرير غير المدمّر لصفحة «منتج الصوت».
 *
 * الصوت المصدر (AudioBuffer) لا يُعدَّل إطلاقاً؛ التحرير قائمة «مقاطع
 * محفوظة» (EditInterval) على خط المصدر الزمني: كل مقطع محفوظ له مداه
 * ومكسبه وتلاشيه. كل عملية (قصّ/اقتطاع/تقسيم/قصّ السكوت) تُنتج حالة
 * جديدة (خالصة قابلة للتراجع) بلا أي تأثير جانبي — الرندر الفعلي يحدث
 * لاحقاً في OfflineAudioContext داخل المحرّك.
 *
 * وحدة نقية 100% — بلا DOM — لذا قابلة للاختبار مباشرة.
 */

/** مقطع محفوظ على خط المصدر الزمني. */
export interface EditInterval {
  id: number;
  /** بداية المقطع على خط المصدر (ثوانٍ). */
  startSec: number;
  /** نهاية المقطع على خط المصدر (ثوانٍ). */
  endSec: number;
  /** مكسب المقطع (dB) — 0 = بلا تغيير. */
  gainDb: number;
  /** تلاشي دخول (ثوانٍ) من بداية المقطع. */
  fadeInSec: number;
  /** تلاشي خروج (ثوانٍ) إلى نهاية المقطع. */
  fadeOutSec: number;
}

/** حالة تحرير كاملة (غير مدمرة) لمصدر واحد. */
export interface ProducerEditState {
  /** المدة الكلية للمصدر الأصلي (ثوانٍ). */
  durationSec: number;
  /** المقاطع المحفوظة مرتبة تصاعدياً غير متداخلة. */
  intervals: EditInterval[];
  /** مكسب رئيسي عام (dB) على كل المقاطع. */
  masterGainDb: number;
  /** تطبيع الذروة إلى ٩٥٪ عند الرندر. */
  normalize: boolean;
  /** عدّاد معرّفات المقاطع. */
  nextId: number;
}

/** نطاق زمني عام (سكوت/محذوف/تحديد) على خط المصدر. */
export interface TimeSpan {
  startSec: number;
  endSec: number;
}

/** أدنى مدة مقطع محفوظ — يمنع تفتيتاً بلا معنى (20ms). */
const MIN_INTERVAL_SEC = 0.02;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function dur(interval: EditInterval): number {
  return Math.max(0, interval.endSec - interval.startSec);
}

/** حالة أولية: مقطع واحد يحفظ المصدر كاملاً. */
export function createInitialEditState(durationSec: number): ProducerEditState {
  const durTotal = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
  return {
    durationSec: durTotal,
    intervals:
      durTotal > 0
        ? [{ id: 1, startSec: 0, endSec: durTotal, gainDb: 0, fadeInSec: 0, fadeOutSec: 0 }]
        : [],
    masterGainDb: 0,
    normalize: false,
    nextId: 2,
  };
}

/** إجمالي المدة المحفوظة بعد التحرير (ثوانٍ). */
export function totalKeptSec(state: ProducerEditState): number {
  let t = 0;
  for (const it of state.intervals) t += dur(it);
  return t;
}

/** نسبة المحفوظ من المصدر (0..1). */
export function keptRatio(state: ProducerEditState): number {
  if (state.durationSec <= 0) return 0;
  return totalKeptSec(state) / state.durationSec;
}

/** الفجوات المحذوفة (تكامل المقاطع المحفوظة) على خط المصدر. */
export function removedSpans(state: ProducerEditState): TimeSpan[] {
  const out: TimeSpan[] = [];
  let cursor = 0;
  for (const it of state.intervals) {
    if (it.startSec > cursor + 1e-9) {
      out.push({ startSec: cursor, endSec: it.startSec });
    }
    cursor = Math.max(cursor, it.endSec);
  }
  if (state.durationSec > cursor + 1e-9) {
    out.push({ startSec: cursor, endSec: state.durationSec });
  }
  return out;
}

/**
 * قصّ نطاق [fromSec, toSec] من المصدر: كل مقطع متقاطع مع النطاق يُقتطع
 * منه القطعة المتقاطعة (وقد ينشطر إلى يمين ويسار). نطاق غير صالح أو خارج
 * الخط → الحالة كما هي.
 */
export function removeRange(
  state: ProducerEditState,
  fromSec: number,
  toSec: number
): ProducerEditState {
  const from = clamp(Number(fromSec) || 0, 0, state.durationSec);
  const to = clamp(Number(toSec) || 0, 0, state.durationSec);
  if (!(to - from > 1e-6) || state.intervals.length === 0) {
    return state;
  }
  let nextId = state.nextId;
  const next: EditInterval[] = [];
  for (const it of state.intervals) {
    // مقطع قبل النطاق أو بعده بلا تقاطع — يبقى كما هو.
    if (it.endSec <= from || it.startSec >= to) {
      next.push(it);
      continue;
    }
    // الشقّ الأيسر الباقي.
    if (it.startSec < from - 1e-9) {
      const leftLen = from - it.startSec;
      next.push({
        ...it,
        endSec: from,
        // تلاشي الخروج كان محسوباً على المدة الكاملة؛ يُعاد ضبطه لئلا
        // يتجاوز مدة الشقّ الأيسر بعد الاقتطاع.
        fadeOutSec: Math.min(it.fadeOutSec, Math.max(0, leftLen - it.fadeInSec)),
      });
    }
    // الشقّ الأيمن الباقي.
    if (it.endSec > to + 1e-9) {
      const rightLen = it.endSec - to;
      next.push({
        ...it,
        id: nextId++,
        startSec: to,
        fadeInSec: Math.min(it.fadeInSec, Math.max(0, rightLen - it.fadeOutSec)),
        fadeOutSec: it.fadeOutSec,
      });
    }
  }

  // إسقاط المقاطع الميكروسكوبية الناتجة.
  const kept = next.filter((it) => dur(it) >= MIN_INTERVAL_SEC);
  return { ...state, intervals: kept, nextId };
}

/** قصّ كل ما قبل لحظة معينة (اقتطاع البداية). */
export function trimBefore(state: ProducerEditState, tSec: number): ProducerEditState {
  return removeRange(state, 0, tSec);
}

/** قصّ كل ما بعد لحظة معينة (اقتطاع النهاية). */
export function trimAfter(state: ProducerEditState, tSec: number): ProducerEditState {
  return removeRange(state, tSec, state.durationSec);
}

/** تقسيم المقطع الذي يحوي t إلى مقطعين عند t (بلا تغيير مسموع). */
export function splitAt(state: ProducerEditState, tSec: number): ProducerEditState {
  const t = clamp(Number(tSec) || 0, 0, state.durationSec);
  const idx = state.intervals.findIndex(
    (it) => t > it.startSec + MIN_INTERVAL_SEC && t < it.endSec - MIN_INTERVAL_SEC
  );
  if (idx < 0) return state;
  const it = state.intervals[idx];
  const left: EditInterval = {
    ...it,
    endSec: t,
    fadeOutSec: 0,
  };
  const right: EditInterval = {
    ...it,
    id: state.nextId + 1,
    startSec: t,
    fadeInSec: 0,
  };
  const intervals = [...state.intervals];
  intervals.splice(idx, 1, left, right);
  return { ...state, intervals, nextId: state.nextId + 1 };
}

/** ضبط مكسب مقطع بالمعرّف. */
export function setIntervalGainDb(
  state: ProducerEditState,
  id: number,
  gainDb: number
): ProducerEditState {
  const value = clamp(Number(gainDb) || 0, -24, 24);
  return {
    ...state,
    intervals: state.intervals.map((it) =>
      it.id === id ? { ...it, gainDb: value } : it
    ),
  };
}

/** ضبط تلاشيات مقطع بالمعرّف. */
export function setIntervalFades(
  state: ProducerEditState,
  id: number,
  fadeInSec: number,
  fadeOutSec: number
): ProducerEditState {
  return {
    ...state,
    intervals: state.intervals.map((it) => {
      if (it.id !== id) return it;
      const len = dur(it);
      const fi = clamp(Number(fadeInSec) || 0, 0, len / 2);
      const fo = clamp(Number(fadeOutSec) || 0, 0, len / 2);
      return { ...it, fadeInSec: fi, fadeOutSec: fo };
    }),
  };
}

/** ضبط المكسب الرئيسي العام. */
export function setMasterGainDb(state: ProducerEditState, gainDb: number): ProducerEditState {
  const value = clamp(Number(gainDb) || 0, -24, 24);
  return { ...state, masterGainDb: value };
}

/** تشغيل/إيقاف التطبيع. */
export function setNormalize(state: ProducerEditState, on: boolean): ProducerEditState {
  return { ...state, normalize: Boolean(on) };
}

/** إرجاع الحالة إلى المصدر الكامل (بلا تحرير). */
export function resetEdits(state: ProducerEditState): ProducerEditState {
  return createInitialEditState(state.durationSec);
}

/**
 * تحويل زمن مصدر → زمن على الخط «المحرَّر» (بعد القصّ): مجموع مدد المقاطع
 * المحفوظة قبله (+ موقعته داخل مقطعه إن كان داخل مقطع محفوظ). زمن داخل
 * فجوة محذوفة → موضع الدرزة (نهاية المحفوظ قبله).
 */
export function mapSourceToEditedSec(state: ProducerEditState, srcSec: number): number {
  let acc = 0;
  const t = clamp(Number(srcSec) || 0, 0, state.durationSec);
  for (const it of state.intervals) {
    if (t <= it.startSec) return acc;
    if (t < it.endSec) return acc + (t - it.startSec);
    acc += dur(it);
  }
  return acc;
}

/**
 * تحويل زمن خط محرَّر → زمن مصدر (عكس السابق). زمن بعد النهاية → نهاية
 * آخر مقطع محفوظ.
 */
export function mapEditedToSourceSec(state: ProducerEditState, editedSec: number): number {
  let acc = 0;
  const t = Math.max(0, Number(editedSec) || 0);
  for (const it of state.intervals) {
    const d = dur(it);
    if (t < acc + d - 1e-9) return it.startSec + (t - acc);
    acc += d;
  }
  const last = state.intervals[state.intervals.length - 1];
  return last ? last.endSec : 0;
}

/**
 * تحويل علامات (بدايات آيات) من إحداثيات المصدر إلى إحداثيات الخط المحرَّر
 * مع الحفاظ على العدد: علامة داخل جزء محذوف تُسقط على الدرزة (آية صارت
 * مدتها صفراً بعد القصّ) — يبقى طول المصفوفة كما هو ليتوافق مع عدد الآيات
 * الذي يتوقعه الاستوديو عند «الإرسال إلى الاستوديو».
 */
export function mapSourceMarkersToEdited(
  state: ProducerEditState,
  markersSec: readonly number[]
): number[] {
  if (state.intervals.length === 0) return [];
  const out: number[] = [];
  let prev = -1;
  for (const m of markersSec) {
    const mapped = mapSourceToEditedSec(state, m);
    // منع الانكسار للخلف بعد الدرزات (علامتان داخل نفس الفجوة).
    const safe = Math.max(mapped, prev);
    out.push(Number(safe.toFixed(3)));
    prev = safe;
  }
  return out;
}

/** dB → معامل خطي. */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * كشف فترات السكوت من مستويات ذروة نافذية (نمط كاشف حدود الآيات نفسه لكن
 * ناتجه فترات سكوت عامة لا حدود آيات).
 */
export interface SilenceFinderOptions {
  /** عتبة السكوت نسبةً إلى أعلى ذروة (0..1). */
  thresholdRatio?: number;
  /** أقصر سكوت يُعتبر فاصلاً (ثوانٍ). */
  minSilenceSec?: number;
}

export function findSilenceSpans(
  peakLevels: readonly number[],
  windowSec: number,
  opts: SilenceFinderOptions = {}
): TimeSpan[] {
  if (peakLevels.length < 2 || !(windowSec > 0)) return [];
  const thresholdRatio = clamp(opts.thresholdRatio ?? 0.06, 0.005, 0.6);
  const minSilenceSec = Math.max(0.05, opts.minSilenceSec ?? 0.4);
  const maxLevel = peakLevels.reduce((a, b) => Math.max(a, b), 0);
  if (maxLevel <= 0.0001) return [];
  const threshold = maxLevel * thresholdRatio;

  const spans: TimeSpan[] = [];
  let runStart = -1;
  for (let i = 0; i < peakLevels.length; i++) {
    const quiet = peakLevels[i] < threshold;
    if (quiet && runStart < 0) runStart = i * windowSec;
    if (!quiet && runStart >= 0) {
      const end = i * windowSec;
      if (end - runStart >= minSilenceSec) spans.push({ startSec: runStart, endSec: end });
      runStart = -1;
    }
  }
  if (runStart >= 0) {
    const end = peakLevels.length * windowSec;
    if (end - runStart >= minSilenceSec) spans.push({ startSec: runStart, endSec: end });
  }
  return spans;
}

/** إجمالي مدة مجموعة نطاقات. */
export function spansTotalSec(spans: readonly TimeSpan[]): number {
  let t = 0;
  for (const s of spans) t += Math.max(0, s.endSec - s.startSec);
  return t;
}
