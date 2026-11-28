/**
 * production-timeline-mapping — تحويلات بين خط المصدر وخط المحرَّر
 * لعرض «استوديو الإنتاج».
 *
 * المسار الزمني في الاستوديو يعرض ما يُسمَع فعلاً (الخط المحرَّر بعد
 * القصّ) — لذا تُعاد هنا قمم الموجة وفترات الآيات إلى إحداثيات الخط
 * المحرَّر، وتُحسب القمم من بافر المصدر مرة واحدة.
 *
 * نقية 100% — قابلة للاختبار مباشرة.
 */
import { mixToMono, computePeaks } from '@/lib/timeline-peaks';
import type { EditInterval } from '@/lib/audio-producer/audio-producer-edit';

/** فترة آية على الخط المحرَّر (ما يُعرض في مسار التلاوة). */
export interface EditedVerseSpan {
  startSec: number;
  endSec: number;
  /** رقم الآية داخل السورة. */
  number: number;
}

/** زمن على خط المصدر → زمن على الخط المحرَّر (فترات محفوظة متتالية). */
export function mapSourceToEdited(intervals: EditInterval[], sec: number): number {
  let acc = 0;
  for (const it of intervals) {
    const dur = Math.max(0, it.endSec - it.startSec);
    if (sec <= it.startSec) return acc;
    if (sec <= it.endSec) return acc + (sec - it.startSec);
    acc += dur;
  }
  return acc;
}

/** زمن على الخط المحرَّر → زمن على خط المصدر (بحث في الفترات). */
export function mapEditedToSource(intervals: EditInterval[], sec: number): number {
  let acc = 0;
  for (const it of intervals) {
    const dur = Math.max(0, it.endSec - it.startSec);
    if (sec <= acc + dur) return it.startSec + (sec - acc);
    acc += dur;
  }
  const last = intervals[intervals.length - 1];
  return last ? last.endSec : 0;
}

/** إجمالي مدة الخط المحرَّر. */
export function editedDurationSec(intervals: EditInterval[]): number {
  let t = 0;
  for (const it of intervals) t += Math.max(0, it.endSec - it.startSec);
  return t;
}

/**
 * قمم الموجة على الخط المحرَّر: لكل دلو نأخذ الزمن المصدر المقابل
 * (خريطة المحرَّر→المصدر) ثم نأخذ قمة دلو المصدر عنده.
 */
export function editedPeaksFromSource(
  sourcePeaks: Float32Array,
  sourceDurationSec: number,
  intervals: EditInterval[],
  outBuckets: number
): Float32Array {
  const out = new Float32Array(Math.max(1, outBuckets));
  const total = editedDurationSec(intervals);
  if (!sourcePeaks.length || total <= 0 || !intervals.length) return out;
  for (let i = 0; i < out.length; i++) {
    const te = ((i + 0.5) / out.length) * total;
    const ts = mapEditedToSource(intervals, te);
    const j = Math.floor((ts / sourceDurationSec) * sourcePeaks.length);
    out[i] = sourcePeaks[Math.max(0, Math.min(sourcePeaks.length - 1, j))];
  }
  return out;
}

/**
 * فترات الآيات على الخط المحرَّر. الآية التي سقطت كلها داخل منطقة
 * محذوفة تظهر بمدة صفر (تُعرض شريحة رقيقة تشير إلى حذفها).
 */
export function editedVerseSpans(
  verseMarkersSec: number[],
  sourceDurationSec: number,
  intervals: EditInterval[]
): EditedVerseSpan[] {
  const out: EditedVerseSpan[] = [];
  for (let i = 0; i < verseMarkersSec.length; i++) {
    const srcStart = verseMarkersSec[i];
    const srcEnd =
      i + 1 < verseMarkersSec.length ? verseMarkersSec[i + 1] : sourceDurationSec;
    let eStart = mapSourceToEdited(intervals, srcStart);
    let eEnd = mapSourceToEdited(intervals, Math.max(srcStart, srcEnd));
    if (eEnd < eStart) [eStart, eEnd] = [eEnd, eStart];
    out.push({ startSec: eStart, endSec: eEnd, number: i + 1 });
  }
  return out;
}

/** قمم الموجة الأساسية من بافر المصدر (أحادي القنوات). */
export function computeSourcePeaks(buffer: AudioBuffer, buckets = 2048): Float32Array {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }
  const mono = mixToMono(channels, buffer.length);
  return computePeaks(mono, buckets);
}

/** قمم موجة لملف موسيقى مرفوع (أرجوانية في مسار الموسيقى). */
export function computeMusicPeaks(buffer: AudioBuffer, buckets = 2048): Float32Array {
  return computeSourcePeaks(buffer, buckets);
}
