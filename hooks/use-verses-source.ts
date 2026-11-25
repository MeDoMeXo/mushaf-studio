'use client';

/**
 * useVersesSource — chapter list + per-surah verse loading from QUL.
 * Extracted from StudioView per the 600-line file rule: owns chapters,
 * chapterVerses, loading flags, and the clamped selectedVerses derivation.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_TRANSLATION_ID,
  type QulChapter,
  type QulVerse,
  type StudioState,
} from '@/lib/quran-data';
import { fetchChapters, fetchChapterVerses } from '@/lib/qul-client';
import { clampVerseRange } from '@/lib/quran-utils';

export interface UseVersesSourceInput {
  state: StudioState;
  replaceStateSilent: (
    updater: (prev: StudioState) => StudioState
  ) => void;
  onSurahSwitch: () => void;
}

export interface UseVersesSourceResult {
  chapters: QulChapter[];
  chapterVerses: QulVerse[];
  loadingVerses: boolean;
  loadingTranslation: boolean;
  currentChapter: QulChapter | null;
  selectedVerses: QulVerse[];
}

export function useVersesSource({
  state,
  replaceStateSilent,
  onSurahSwitch,
}: UseVersesSourceInput): UseVersesSourceResult {
  const [chapters, setChapters] = useState<QulChapter[]>([]);
  const [chapterVerses, setChapterVerses] = useState<QulVerse[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(true);
  const [loadingTranslation, setLoadingTranslation] = useState(false);
  const loadedSurahRef = useRef<number>(state.surah);
  const onSurahSwitchRef = useRef(onSurahSwitch);
  useEffect(() => {
    onSurahSwitchRef.current = onSurahSwitch;
  }, [onSurahSwitch]);

  useEffect(() => {
    let active = true;
    fetchChapters().then((list) => {
      if (active) setChapters(list);
    });
    return () => {
      active = false;
    };
  }, []);

  // Load chapter verses from QUL whenever surah or selected QUL translation changes
  useEffect(() => {
    let active = true;
    const isSurahSwitch = loadedSurahRef.current !== state.surah;
    Promise.resolve().then(() => {
      if (!active) return;
      if (isSurahSwitch) {
        setLoadingVerses(true);
      } else {
        setLoadingTranslation(true);
      }
    });
    fetchChapterVerses(state.surah, state.translationId || DEFAULT_TRANSLATION_ID)
      .then((vs) => {
        if (!active) return;
        loadedSurahRef.current = state.surah;
        setChapterVerses(vs);
        replaceStateSilent((prev) => {
          const clamped = clampVerseRange(prev.fromAyah, prev.toAyah, vs.length);
          return prev.fromAyah === clamped.fromAyah && prev.toAyah === clamped.toAyah
            ? prev
            : { ...prev, fromAyah: clamped.fromAyah, toAyah: clamped.toAyah };
        });
        if (isSurahSwitch) {
          onSurahSwitchRef.current();
        }
      })
      .finally(() => {
        if (active) {
          setLoadingVerses(false);
          setLoadingTranslation(false);
        }
      });
    return () => {
      active = false;
    };
  }, [state.surah, state.translationId, replaceStateSilent]);

  const currentChapter = useMemo(
    () => chapters.find((c) => c.id === state.surah) ?? null,
    [chapters, state.surah]
  );

  const selectedVerses = useMemo(() => {
    if (!chapterVerses.length) return [];
    const startIdx = Math.max(0, state.fromAyah - 1);
    const endIdx = Math.min(chapterVerses.length, state.toAyah);
    const slice = chapterVerses.slice(startIdx, Math.max(startIdx + 1, endIdx));
    return slice.length ? slice : [chapterVerses[0]];
  }, [chapterVerses, state.fromAyah, state.toAyah]);

  return {
    chapters,
    chapterVerses,
    loadingVerses,
    loadingTranslation,
    currentChapter,
    selectedVerses,
  };
}
