/**
 * Custom-audio verse boundaries — محرّك حدود الآيات للملف الصوتي المرفوع.
 *
 * الملف المرفوع قطعة واحدة بلا فواصل معروفة؛ هذه الوحدة تحوّله إلى خط
 * زمني للآيات عبر:
 *   1) كشف تلقائي للسكوت بين الآيات (Web Audio API — يعمل في المتصفح
 *      دون أي رفع للخادم) عبر detectVerseSilenceBoundaries()، أو
 *   2) توزيع تقديري بأوزان النطق (buildEvenFallbackBounds) عندما يفشل
 *      الكشف أو يُلغيه المستخدم، أو
 *   3) حدود يدوية يضبطها المستخدم (setBoundariesManual) أثناء الاستماع.
 *
 * الناتج دائماً مصفوفة تصاعدية صارمة من ثوانٍ البداية: [0, 4.2, 9.8, …]
 * (طولها = عدد الآيات) — كلّها نقطية (end = بداية التالية / نهاية الملف).
 *
 * وحدة نقية قابلة للاختبار: لا DOM داخل الدوال الحسابية.
 */

/** أقصى عدد آيات مدعوم للحدود (يطابق MAX_EXPORT_VERSES). */
export const MAX_BOUNDARY_VERSES = 286;

/** حد أدنى لطول آية (ثانية) — يمنع حدوداً متلاصقة بلا معنى. */
export const MIN_VERSE_SEC = 0.25;

export interface VerseBoundary {
  /** بداية الآية داخل الملف الصوتي (ثانية). */
  start: number;
  /** نهاية الآية (بداية التالية أو مدة الملف). */
  end: number;
}

export interface SilenceDetectionOptions {
  /** عتبة السكوت نسبةً إلى أعلى مستوى في الملف (0..1، افتراضي 0.06). */
  amplitudeThresholdRatio?: number;
  /** أقصر سكوت يُعتبر فاصلاً بين آيتين (ثوانٍ، افتراضي 0.45). */
  minSilenceSec?: number;
  /** هامش يُقتطع من طرفي الفاصل ليبدأ الالتقاط عند انطلاق الصوت فعلياً. */
  silencePaddingSec?: number;
}

export interface SilenceDetectionResult {
  /** ثوانٍ بداية كل آية (طولها = verseCount). */
  starts: number[];
  /** مدة الملف الصوتي كما قِيست. */
  durationSec: number;
  /** true عندما خرج الكشف بفواصل صالحة كاملة. */
  ok: boolean;
  /** رسالة عربية موجزة عند الفشل. */
  message?: string;
}

/** يبني نهايات الآيات من بداياتها + مدة الملف (نقية). */
export function buildVerseBoundsFromStarts(
  starts: number[],
  durationSec: number
): VerseBoundary[] {
  const n = starts.length;
  if (!n || !Number.isFinite(durationSec) || durationSec <= 0) return [];
  const bounds: VerseBoundary[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, starts[i]);
    const end = i + 1 < n ? Math.max(start + MIN_VERSE_SEC, starts[i + 1]) : durationSec;
    bounds.push({ start, end: Math.min(end, Math.max(durationSec, start + MIN_VERSE_SEC)) });
  }
  return bounds;
}

/** يوزّع المدة تقديرياً على الآيات بالتساوي (احتياطي الكشف). */
export function buildEvenFallbackBounds(
  verseCount: number,
  durationSec: number
): number[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0 || verseCount <= 0) return [];
  const per = durationSec / verseCount;
  return Array.from({ length: verseCount }, (_, i) => Number((i * per).toFixed(3)));
}

/** يفرض تصاعداً صارماً وفواصل دنيا على حدود يدوية (نقية). */
export function normalizeManualBounds(
  starts: number[],
  durationSec: number
): number[] {
  const n = Math.min(starts.length, MAX_BOUNDARY_VERSES);
  const out: number[] = [];
  let prev = 0;
  for (let i = 0; i < n; i++) {
    let v = Number(starts[i]);
    if (!Number.isFinite(v)) v = prev;
    v = Math.max(prev, Math.min(Math.max(0, v), Math.max(0, durationSec - 0.05)));
    if (i === 0) v = Math.max(0, Math.min(v, Math.max(0, durationSec - 0.05)));
    // الآية 0 يجب أن تبقى 0 (الملف يبدأ بأول آية) — بلا قفز لأول صوت.
    if (i === 0 && v > 0) v = 0;
    out.push(Number(v.toFixed(3)));
    prev = v;
  }
  return out;
}

/**
 * كاشف فواصل السكوت — ينفَّذ في المتصفح على PCM مفكوك الترميز.
 * peakLevels: مستوى الصوت اللحظي (0..1) لكل نافذة windowSec.
 */
export function detectBoundariesFromPeakLevels(
  peakLevels: number[],
  verseCount: number,
  windowSec: number,
  durationSec: number,
  opts: SilenceDetectionOptions = {}
): SilenceDetectionResult {
  if (verseCount <= 0 || !Number.isFinite(durationSec) || durationSec <= 0) {
    return { starts: [], durationSec: durationSec || 0, ok: false, message: 'مدة غير صالحة' };
  }
  if (verseCount === 1) {
    return { starts: [0], durationSec, ok: true };
  }
  if (peakLevels.length < 4) {
    return { starts: [], durationSec, ok: false, message: 'الملف قصير جداً للتحليل' };
  }
  const thresholdRatio = Math.max(0.01, Math.min(0.6, opts.amplitudeThresholdRatio ?? 0.06));
  const minSilenceSec = Math.max(0.15, Math.min(3, opts.minSilenceSec ?? 0.45));
  const pad = Math.max(0, Math.min(0.3, opts.silencePaddingSec ?? 0.08));
  const maxLevel = peakLevels.reduce((a, b) => Math.max(a, b), 0);
  if (maxLevel <= 0.0001) {
    return { starts: [], durationSec, ok: false, message: 'الملف صامت تماماً' };
  }
  const threshold = maxLevel * thresholdRatio;

  // 1) اجمع كل النوافذ الهادئة (تحت العتبة) في مقاطع سكوت متجاورة.
  const silences: { start: number; end: number }[] = [];
  let runStart = -1;
  for (let i = 0; i < peakLevels.length; i++) {
    const quiet = peakLevels[i] < threshold;
    const t0 = i * windowSec;
    const t1 = t0 + windowSec;
    if (quiet && runStart < 0) runStart = t0;
    if (!quiet && runStart >= 0) {
      silences.push({ start: runStart, end: t1 - windowSec < runStart ? t1 : t1 });
      runStart = -1;
    }
  }
  if (runStart >= 0) silences.push({ start: runStart, end: peakLevels.length * windowSec });

  // 2) الفواصل المرشحة = سكوت طويل كافٍ (الطويل أقوى دلالة على فاصل آيات).
  const candidates = silences
    .filter((s) => s.end - s.start >= minSilenceSec)
    .map((s) => ({
      boundaryMid: s.start + (s.end - s.start) / 2,
      voiceStart: Math.min(durationSec - 0.05, s.end - pad),
    }))
    .filter((c) => c.voiceStart > 0.1 && c.voiceStart < durationSec - 0.1);

  if (candidates.length < verseCount - 1) {
    return {
      starts: [],
      durationSec,
      ok: false,
      message: `اكتُشفت ${candidates.length} فاصلاً فقط والآيات ${verseCount} — اضبط الحدود يدوياً`,
    };
  }
  void candidates;

  // 3) اختر أفضل (verseCount-1) فاصلاً: مقاطع السكوت الأطول هي المرشحة
  //    الأقوى لكونها فواصل بين آيات (وليس وقفة inside آية)، ثم أعِد
  //    ترتيبها زمنياً وتحقّق من التباعد الأدنى بين آيتين.
  const ranked = silences
    .map((s, i) => ({ i, len: s.end - s.start }))
    .sort((a, b) => b.len - a.len)
    .slice(0, verseCount - 1)
    .map((e) => e.i)
    .sort((a, b) => a - b);

  const starts: number[] = [0];
  for (const si of ranked) {
    const s = silences[si];
    const voiceStart = Math.min(durationSec - 0.05, Math.max(0, s.end - pad));
    const prev = starts[starts.length - 1];
    if (voiceStart - prev < MIN_VERSE_SEC) continue; // متلاصق — تجاهله
    starts.push(Number(voiceStart.toFixed(3)));
    if (starts.length >= verseCount) break;
  }
  if (starts.length < verseCount) {
    return {
      starts: [],
      durationSec,
      ok: false,
      message: `تعذّر تمييز ${verseCount} آيات — اضبط الحدود يدوياً`,
    };
  }
  return { starts, durationSec, ok: true };
}

/**
 * فكّ ترميز الملف الصوتي في المتصفح واستخرج مستويات الذروة لكل نافذة.
 * يعمل على الملف المحلي مباشرة (لا رفع للخادم) ويعيد نتيجة الكشف كاملة.
 */
export async function analyzeCustomAudioFile(
  file: File,
  verseCount: number,
  opts: SilenceDetectionOptions = {}
): Promise<SilenceDetectionResult> {
  const AudioCtx: typeof AudioContext | undefined =
    typeof window !== 'undefined'
      ? window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!AudioCtx) {
    return { starts: [], durationSec: 0, ok: false, message: 'المتصفح لا يدعم تحليل الصوت' };
  }
  try {
    const buf = await file.arrayBuffer();
    const ctx = new AudioCtx();
    try {
      const audio = await ctx.decodeAudioData(buf);
      const durationSec = audio.duration;
      const ch = audio.getChannelData(0);
      const windowSec = Math.max(0.02, Math.min(0.1, durationSec / 2000));
      const winSamples = Math.max(1, Math.floor(windowSec * audio.sampleRate));
      const peakLevels: number[] = [];
      for (let pos = 0; pos + winSamples <= ch.length; pos += winSamples) {
        let peak = 0;
        for (let j = 0; j < winSamples; j += 4) {
          const v = Math.abs(ch[pos + j]);
          if (v > peak) peak = v;
        }
        peakLevels.push(peak);
      }
      return detectBoundariesFromPeakLevels(
        peakLevels,
        verseCount,
        windowSec,
        durationSec,
        opts
      );
    } finally {
      void ctx.close().catch(() => {});
    }
  } catch {
    return { starts: [], durationSec: 0, ok: false, message: 'تعذّر فك ترميز الملف الصوتي' };
  }
}

/** أين تقع اللحظة t داخل الحدود؟ (فهرس الآية، نقية). */
export function findVerseIndexAtTime(
  starts: number[],
  t: number,
  durationSec?: number
): number {
  if (!starts.length) return 0;
  if (t <= starts[0]) return 0;
  for (let i = starts.length - 1; i >= 0; i--) {
    if (t >= starts[i]) return i;
  }
  return 0;
}

/** نسبة التقدّم داخل الآية الحالية (0..1) — لكاريوكي الملف المخصص. */
export function verseProgressAtTime(
  starts: number[],
  t: number,
  durationSec: number
): number {
  const idx = findVerseIndexAtTime(starts, t, durationSec);
  const start = starts[idx] ?? 0;
  const end = idx + 1 < starts.length ? starts[idx + 1] : durationSec;
  if (end <= start) return 1;
  return Math.max(0, Math.min(1, (t - start) / (end - start)));
}

/** صياغة ثوانٍ مقروءة: ‎«٤.٣ ث» أو «١:٠٢». */
export function formatBoundarySec(sec: number, toArabic: (n: number | string) => string): string {
  if (!Number.isFinite(sec)) return toArabic('0');
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${toArabic(m)}:${toArabic(String(s).padStart(2, '0'))}`;
  }
  return `${toArabic(sec.toFixed(1))} ث`;
}
