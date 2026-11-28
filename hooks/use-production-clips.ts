'use client';

/**
 * use-production-clips — مقاطع استوديو الإنتاج (نصوص/مؤثرات).
 *
 * حالة مسار النصوص (البسملة/عنوان/نصوص مخصصة/مقاطع الآيات) ومسار
 * المؤثرات (محيطات) + تمثيل الصدى كمقطع برتقالي على المسار — مقصوصة
 * من الجذر (حد ٦٠٠ سطر/ملف).
 */
import { useCallback, useMemo, useState } from 'react';
import type {
  ProductionAmbientKind,
  ProductionEffectClip,
  ProductionTextClip,
} from '@/lib/production/production-types';

export interface ProductionClips {
  textClips: ProductionTextClip[];
  setTextClips: React.Dispatch<React.SetStateAction<ProductionTextClip[]>>;
  effectClips: ProductionEffectClip[];
  setEffectClips: React.Dispatch<React.SetStateAction<ProductionEffectClip[]>>;
  addTextClip: (clip: Omit<ProductionTextClip, 'id'>) => void;
  updateTextClip: (id: string, startSec: number, endSec: number) => void;
  removeTextClip: (id: string) => void;
  addAmbientClip: (kind: ProductionAmbientKind) => void;
  removeEffectClip: (id: string) => void;
  timelineEffectClips: ProductionEffectClip[];
  ensureDefaultTextClips: (total: number) => void;
}

export function useProductionClips(options: {
  showToast: (msg: string) => void;
  echoEnabled: boolean;
  echoWet: number;
  totalSec: number;
  surahName: string;
}): ProductionClips {
  const { showToast, echoEnabled, echoWet, totalSec, surahName } = options;
  const [textClips, setTextClips] = useState<ProductionTextClip[]>([]);
  const [effectClips, setEffectClips] = useState<ProductionEffectClip[]>([]);

  const ensureDefaultTextClips = useCallback((total: number) => {
    setTextClips((prev) => {
      if (prev.some((c) => c.kind === 'basmala')) return prev;
      const id = () => `clip-${Math.random().toString(36).slice(2, 8)}`;
      return [
        {
          id: id(),
          text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
          kind: 'basmala' as const,
          startSec: 0,
          endSec: Math.min(4, total * 0.25),
          color: '#e6c75a',
          scale: 1,
        },
        {
          id: id(),
          text: `سُورَةُ ${surahName}`,
          kind: 'surah-title' as const,
          startSec: 0,
          endSec: Math.min(6, total * 0.3),
          color: '#e6c75a',
          scale: 0.9,
        },
      ];
    });
  }, [surahName]);

  // ── عمليات المقاطع ────────────────────────────────────────────────────
  const addTextClip = useCallback((clip: Omit<ProductionTextClip, 'id'>) => {
    setTextClips((prev) => [...prev, { ...clip, id: `clip-${Math.random().toString(36).slice(2, 8)}` }]);
  }, []);
  const updateTextClip = useCallback((id: string, startSec: number, endSec: number) => {
    setTextClips((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, startSec: Math.max(0, startSec), endSec: Math.max(startSec + 0.5, endSec) } : c
      )
    );
  }, []);
  const removeTextClip = useCallback((id: string) => {
    setTextClips((prev) => prev.filter((c) => c.id !== id));
  }, []);
  const addAmbientClip = useCallback((kind: ProductionAmbientKind) => {
    const total = totalSec || 30;
    setEffectClips((prev) => [
      ...prev,
      {
        id: `fx-${Math.random().toString(36).slice(2, 8)}`,
        kind: 'ambient' as const,
        ambient: kind,
        startSec: 0,
        endSec: total,
        gain: 0.3,
      },
    ]);
    showToast('أُضيف مؤثر محيط على كامل المدة');
  }, [totalSec]);
  const removeEffectClip = useCallback((id: string) => {
    setEffectClips((prev) => prev.filter((c) => c.id !== id));
  }, []);

  /** مقاطع المؤثرات + تمثيل الصدى إن كان مفعّلاً (شريحة برتقالية). */
  const timelineEffectClips = useMemo(() => {
    const list = effectClips.map((c) => c);
    if (echoEnabled) {
      list.push({
        id: 'echo-visual',
        kind: 'echo' as const,
        ambient: 'rain' as ProductionAmbientKind,
        startSec: 0,
        endSec: totalSec,
        gain: echoWet,
      });
    }
    return list;
  }, [effectClips, echoEnabled, echoWet, totalSec]);

  return {
    textClips,
    setTextClips,
    effectClips,
    setEffectClips,
    addTextClip,
    updateTextClip,
    removeTextClip,
    addAmbientClip,
    removeEffectClip,
    timelineEffectClips,
    ensureDefaultTextClips,
  };
}
