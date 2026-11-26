'use client';

/**
 * useInspectorSectionVisibility — حالة ظهور أقسام لوحة التنسيق محفوظة في
 * localStorage. الترطيب يجري بعد التحميل فقط (useEffect): أول رسم يطابق
 * الخادم (كل الأقسام ظاهرة) ثم تُقرأ التفضيلات المحفوظة — فلا يكسر SSR
 * ولا يحدث تعارض ترطيب (hydration mismatch).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  INSPECTOR_SECTION_STORAGE_KEY,
  INSPECTOR_SECTIONS,
  isInspectorSectionId,
} from '@/lib/inspector-sections';

export interface InspectorSectionVisibilityApi {
  /** هل القسم مخفي؟ (false قبل الترطيب = الافتراضي الآمن «ظاهر») */
  isHidden: (id: string) => boolean;
  /** إظهار قسم واحد (زر «إظهار» على القسم المخفي). */
  showSection: (id: string) => void;
  /** تبديل ظهور قسم من شريط الأدوات. */
  toggleSection: (id: string) => void;
  /** إظهار/إخفاء كل الأقسام دفعة واحدة. */
  setAllSections: (visible: boolean) => void;
  /** عدد الأقسام المخفية حالياً (لعرضه في شريط الأدوات). */
  hiddenCount: number;
}

function readHiddenIdsFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(INSPECTOR_SECTION_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    // لا نثق بالمخزن: قبول المعرفات المسجلة فقط
    const valid = new Set<string>();
    for (const item of parsed) {
      if (isInspectorSectionId(item)) valid.add(item);
    }
    // إن أُخفيت كل الأقسام بطريق الخطأ نتجاهل التفضيل كله (شريط الأدوات
    // يبقى دائماً بديلاً للإنقاذ لكن تجربة «لوحة فارغة» غير مقصودة).
    if (valid.size >= INSPECTOR_SECTIONS.length) return new Set();
    return valid;
  } catch {
    return new Set();
  }
}

export function useInspectorSectionVisibility(): InspectorSectionVisibilityApi {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [hydrated, setHydrated] = useState(false);

  // ترطيب آمن بعد التحميل فقط (microtask) — لا يكسر SSR ولا يسبب
  // تعارض ترطيب: أول رسم يطابق الخادم ثم تُقرأ التفضيلات المحفوظة.
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setHidden(readHiddenIdsFromStorage());
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // حفظ التفضيل عند أي تغيير (بعد الترطيب فقط كي لا نكتب القيمة الافتراضية)
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (hidden.size === 0) {
        window.localStorage.removeItem(INSPECTOR_SECTION_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          INSPECTOR_SECTION_STORAGE_KEY,
          JSON.stringify([...hidden])
        );
      }
    } catch {
      // التخزين معطّل/ممتلئ — التفضيل يعمل للجلسة الحالية فقط
    }
  }, [hidden, hydrated]);

  const isHidden = useCallback(
    (id: string) => hydrated && hidden.has(id),
    [hidden, hydrated]
  );

  const showSection = useCallback((id: string) => {
    setHidden((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleSection = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAllSections = useCallback((visible: boolean) => {
    setHidden(visible ? new Set<string>() : new Set(INSPECTOR_SECTIONS.map((s) => s.id)));
  }, []);

  const hiddenCount = useMemo(() => (hydrated ? hidden.size : 0), [hidden, hydrated]);

  return { isHidden, showSection, toggleSection, setAllSections, hiddenCount };
}
