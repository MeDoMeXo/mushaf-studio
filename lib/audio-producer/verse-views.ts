/**
 * verse-views — اشتقاق «مقاطع الآيات» لعرض الخط الزمني والمكتبة:
 * لكل آية: حدودها في إحداثيات المصدر، مدتها المحفوظة بعد التحرير، وحالتها
 * (محفوظة / مقصوصة جزئياً / محذوفة) — حساب نقِي فوق (source, edit).
 */
import type { ProducerSource } from './audio-producer-engine';
import type { ProducerEditState } from './audio-producer-edit';

export type VerseViewStatus = 'kept' | 'partial' | 'removed';

export interface VerseView {
  /** فهرس الآية داخل المصدر (٠-أساس) */
  idx: number;
  /** رقم الآية (1-أساس) كما في المصدر */
  number: number;
  /** بداية الآية بإحداثيات المصدر (ثوانٍ) */
  startSec: number;
  /** نهاية الآية بإحداثيات المصدر (ثوانٍ) */
  endSec: number;
  /** مدة الآية كاملة قبل التحرير */
  totalSec: number;
  /** المدة المحفوظة فعلياً بعد القصّ */
  keptSec: number;
  status: VerseViewStatus;
}

export function verseStatusOf(totalSec: number, keptSec: number): VerseViewStatus {
  if (keptSec <= 0.01) return 'removed';
  if (keptSec < totalSec * 0.995) return 'partial';
  return 'kept';
}

/**
 * يبني مقاطع الآيات من علامات المصدر وفترات التحرير المحفوظة.
 * آخر آية تمتد حتى نهاية المصدر.
 */
export function buildVerseViews(
  source: ProducerSource,
  edit: ProducerEditState | null
): VerseView[] {
  const markers = source.verseMarkersSec;
  if (markers.length === 0) return [];
  const out: VerseView[] = [];
  for (let i = 0; i < markers.length; i++) {
    const startSec = markers[i];
    const endSec = i + 1 < markers.length ? markers[i + 1] : source.durationSec;
    const totalSec = Math.max(0, endSec - startSec);
    let keptSec = 0;
    if (edit) {
      for (const it of edit.intervals) {
        const a = Math.max(it.startSec, startSec);
        const b = Math.min(it.endSec, endSec);
        if (b > a) keptSec += b - a;
      }
    } else {
      keptSec = totalSec;
    }
    out.push({
      idx: i,
      number: source.verseNumbers[i] ?? i + 1,
      startSec,
      endSec,
      totalSec,
      keptSec,
      status: verseStatusOf(totalSec, keptSec),
    });
  }
  return out;
}
