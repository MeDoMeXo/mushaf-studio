'use client';

/**
 * use-production-verses — جلب فصول QUL وآيات السورة المحددة لاستوديو
 * الإنتاج، مع تقييد النطاق المختار (from/to) — نفس مسار جلب الاستوديو.
 */
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_TRANSLATION_ID, type QulChapter, type QulVerse } from '@/lib/quran-data';
import { fetchChapters, fetchChapterVerses } from '@/lib/qul-client';

export interface UseProductionVersesResult {
  chapters: QulChapter[];
  chapterVerses: QulVerse[];
  loadingVerses: boolean;
  currentChapter: QulChapter | null;
  /** الآيات داخل النطاق المختار (from..to). */
  selectedVerses: QulVerse[];
  /** الترجمة الفعلية للآية المحددة (أول آية في النطاق كمرجع للعرض). */
  translationOf: (verse: QulVerse | undefined) => string | null;
}

export function useProductionVerses(
  surahId: number,
  fromAyah: number,
  toAyah: number,
  translationId: number
): UseProductionVersesResult {
  const [chapters, setChapters] = useState<QulChapter[]>([]);
  const [chapterVerses, setChapterVerses] = useState<QulVerse[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(true);

  useEffect(() => {
    let active = true;
    fetchChapters().then((list) => {
      if (active) setChapters(list);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    // الإعداد داخل مهمة دقيقة — بلا setState متزامن داخل جسم التأثير.
    Promise.resolve().then(() => {
      if (active) setLoadingVerses(true);
    });
    fetchChapterVerses(surahId, translationId || DEFAULT_TRANSLATION_ID)
      .then((vs) => {
        if (!active) return;
        setChapterVerses(vs);
      })
      .finally(() => {
        if (active) setLoadingVerses(false);
      });
    return () => {
      active = false;
    };
  }, [surahId, translationId]);

  const currentChapter = useMemo(
    () => chapters.find((c) => c.id === surahId) ?? null,
    [chapters, surahId]
  );

  const selectedVerses = useMemo(() => {
    if (!chapterVerses.length) return [];
    const start = Math.max(0, fromAyah - 1);
    const end = Math.min(chapterVerses.length, toAyah);
    const slice = chapterVerses.slice(start, Math.max(start + 1, end));
    return slice.length ? slice : [chapterVerses[0]];
  }, [chapterVerses, fromAyah, toAyah]);

  const translationOf = (verse: QulVerse | undefined): string | null => {
    if (!verse || !verse.translations?.length) return null;
    const hit = verse.translations.find((t) => t.id === translationId) ?? verse.translations[0];
    return hit?.text ?? null;
  };

  return {
    chapters,
    chapterVerses,
    loadingVerses,
    currentChapter,
    selectedVerses,
    translationOf,
  };
}
