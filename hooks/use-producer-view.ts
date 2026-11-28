'use client';

/**
 * useProducerView — إطار عرض الخط الزمني في «منتج الصوت»: النافذة الزمنية
 * المرئية (startSec + durSec) مع التقريب/التمرير المستخرجان من
 * use-audio-producer وفق حد الـ 600 سطر — كل شيء هنا قراءة/كتابة حالة
 * العرض فقط، بلا أي علاقة بالتحرير أو التشغيل.
 */
import { useCallback, useState, type RefObject } from 'react';
import type { ProducerSource } from '@/lib/audio-producer/audio-producer-engine';

const ZOOM_FACTOR = 0.6;

export interface ProducerView {
  startSec: number;
  durSec: number;
}

export function useProducerView(sourceRef: RefObject<ProducerSource | null>) {
  const [view, setView] = useState<ProducerView>({ startSec: 0, durSec: 1 });

  const zoomBy = useCallback(
    (factor: number, anchorRatio = 0.5) => {
      const src = sourceRef.current;
      if (!src) return;
      setView((prev) => {
        const nextDur = Math.max(1, Math.min(src.durationSec, prev.durSec * factor));
        const anchor = prev.startSec + prev.durSec * anchorRatio;
        const start = Math.max(0, Math.min(Math.max(0, src.durationSec - nextDur), anchor - nextDur * anchorRatio));
        return { startSec: start, durSec: nextDur };
      });
    },
    [sourceRef]
  );

  const zoomIn = useCallback(() => zoomBy(ZOOM_FACTOR), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / ZOOM_FACTOR), [zoomBy]);

  const zoomFit = useCallback(() => {
    const src = sourceRef.current;
    if (!src) return;
    setView({ startSec: 0, durSec: Math.max(1, src.durationSec) });
  }, [sourceRef]);

  const scrollBySec = useCallback((deltaSec: number) => {
    setView((prev) => ({
      startSec: Math.max(0, prev.startSec + deltaSec),
      durSec: prev.durSec,
    }));
  }, []);

  /** تقريب على نقطة مرساة (نسبة أفقية من العرض الحالي) — لعجلة ctrl+wheel. */
  const zoomAt = useCallback(
    (anchorRatio: number, factor: number) => zoomBy(factor, anchorRatio),
    [zoomBy]
  );

  /** إطار أولي عند تحميل مصدر جديد: كامل المدة. */
  const fitToSource = useCallback(() => {
    const src = sourceRef.current;
    if (!src) return;
    setView({ startSec: 0, durSec: Math.max(1, src.durationSec) });
  }, [sourceRef]);

  return { view, setView, zoomBy, zoomIn, zoomOut, zoomFit, zoomAt, scrollBySec, fitToSource };
}

export type ProducerViewController = ReturnType<typeof useProducerView>;
