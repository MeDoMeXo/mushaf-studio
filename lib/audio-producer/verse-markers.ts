/**
 * verse-markers — تحرير موضع الآيات (حدودها الزمنية) على خط المصدر.
 *
 * علامات الآيات تسكن المصدر (source.verseMarkersSec) لا حالة التحرير، لكن
 * التحرير بنفس النمط: عمليات نقية تُعيد مصفوفة جديدة بلا تعديل المدخلات.
 * القيد المركزي: فجوة دنيا بين بدايتي آيتين متجاورتين حتى يبقى المقطع
 * قابلاً للتشغيل والفصل والقفز دون تصفّر آية.
 */

/** أقل مسافة بين بدايتي آيتين متجاورتين (ثوانٍ) — يمنع الآيات المتلاصقة. */
export const MIN_VERSE_GAP_SEC = 0.4;

/**
 * أقصر قيمة صالحة لبداية الآية idx: بعد نهاية الحد الأدنى للفجوة مع سابقتها
 * (أو 0 لأول آية)، وقبل بداية تاليها بفجوة (أو نهاية المصدر لآخر آية).
 */
export function clampVerseMarkerSec(
  markers: readonly number[],
  durationSec: number,
  idx: number,
  proposedSec: number
): number {
  if (idx < 0 || idx >= markers.length) return proposedSec;
  const lo = idx > 0 ? markers[idx - 1] + MIN_VERSE_GAP_SEC : 0;
  const hi =
    idx + 1 < markers.length
      ? markers[idx + 1] - MIN_VERSE_GAP_SEC
      : Math.max(0, durationSec);
  return Math.max(lo, Math.min(hi, proposedSec));
}

/**
 * نقل بداية آية إلى زمن جديد (بعد التقييد) — تُعيد المصفوفة الجديدة أو
 * null إن لم يتغير شيء (الفهرس أو القيمة غير صالحة).
 */
export function moveVerseMarker(
  markers: readonly number[],
  durationSec: number,
  idx: number,
  proposedSec: number
): number[] | null {
  if (idx < 0 || idx >= markers.length) return null;
  const value = clampVerseMarkerSec(markers, durationSec, idx, proposedSec);
  const current = markers[idx];
  if (!Number.isFinite(value) || Math.abs(value - current) < 1e-4) return null;
  const next = [...markers];
  next[idx] = Number(value.toFixed(3));
  return next;
}

/** إزاحة بداية آية بمقدار موجب/سالب (ثوانٍ) — null إن لم يتغير شيء. */
export function nudgeVerseMarker(
  markers: readonly number[],
  durationSec: number,
  idx: number,
  deltaSec: number
): number[] | null {
  if (idx < 0 || idx >= markers.length) return null;
  return moveVerseMarker(markers, durationSec, idx, markers[idx] + deltaSec);
}
