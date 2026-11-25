'use client';

/**
 * useVerseActions — bookmark/copy/jump/reading-preference handlers for the
 * reader view. Extracted from components/ReaderView.tsx per the 600-line
 * file rule; all persistence goes through lib/storage + localStorage keys.
 */
import { useCallback } from 'react';
import type { QulVerse } from '@/lib/quran-data';
import { toArabicDigits } from '@/lib/quran-utils';
import { saveBookmarks, STORAGE_KEYS, type BookmarkItem } from '@/lib/storage';

export interface UseVerseActionsInput {
  surahId: number;
  surahName: string;
  bookmarks: BookmarkItem[];
  bookmarkedKeys: Set<string>;
  setBookmarks: React.Dispatch<React.SetStateAction<BookmarkItem[]>>;
  setTranslationId: React.Dispatch<React.SetStateAction<number>>;
  setShowTrans: React.Dispatch<React.SetStateAction<boolean>>;
  setFontSizeRem: React.Dispatch<React.SetStateAction<number>>;
  showToast: (msg: string) => void;
}

export interface UseVerseActionsResult {
  handleToggleBookmark: (verse: QulVerse) => void;
  handleCopyVerse: (verse: QulVerse) => Promise<void>;
  handleJumpAyah: (e: React.FormEvent<HTMLFormElement>) => void;
  handleTranslationChange: (id: number) => void;
  handleShowTransToggle: (checked: boolean) => void;
  handleFontSizeChange: (val: number) => void;
}

export function useVerseActions({
  surahId,
  surahName,
  bookmarks,
  bookmarkedKeys,
  setBookmarks,
  setTranslationId,
  setShowTrans,
  setFontSizeRem,
  showToast,
}: UseVerseActionsInput): UseVerseActionsResult {
  const handleToggleBookmark = useCallback(
    (verse: QulVerse) => {
      const ayahNum = Number(verse.verse_key.split(':')[1] || 1);
      const exists = bookmarkedKeys.has(verse.verse_key);
      let next: BookmarkItem[];
      if (exists) {
        next = bookmarks.filter((b) => b.verseKey !== verse.verse_key);
        showToast('أُزيلت الآية من المحفوظات');
      } else {
        next = [
          {
            verseKey: verse.verse_key,
            surahId,
            ayahNumber: ayahNum,
            surahName,
            snippet: verse.text_uthmani.slice(0, 80),
            savedAt: Date.now(),
          },
          ...bookmarks,
        ];
        showToast('حُفظت الآية في المحفوظات');
      }
      setBookmarks(next);
      saveBookmarks(next);
    },
    [bookmarks, bookmarkedKeys, setBookmarks, surahId, surahName, showToast]
  );

  const handleCopyVerse = useCallback(
    async (verse: QulVerse) => {
      const ayahNum = verse.verse_key.split(':')[1] ?? '';
      const formatted = `${verse.text_uthmani} ﴿${surahName} · ${toArabicDigits(ayahNum)}﴾`;
      try {
        await navigator.clipboard.writeText(formatted);
        showToast('تم نسخ الآية بنجاح');
      } catch {
        showToast('تعذّر النسخ إلى الحافظة');
      }
    },
    [surahName, showToast]
  );

  const handleJumpAyah = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const num = Number(e.currentTarget.elements.namedItem('jump-input'));
      if (!Number.isInteger(num) || num < 1) return;
      const target = document.getElementById(`verse-${surahId}-${num}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        showToast('رقم الآية خارج نطاق هذه السورة');
      }
    },
    [surahId, showToast]
  );

  const handleTranslationChange = useCallback(
    (id: number) => {
      setTranslationId(id);
      window.localStorage.setItem(STORAGE_KEYS.TRANSLATION, String(id));
    },
    [setTranslationId]
  );

  const handleShowTransToggle = useCallback(
    (checked: boolean) => {
      setShowTrans(checked);
      window.localStorage.setItem(STORAGE_KEYS.SHOW_TRANS, checked ? '1' : '0');
    },
    [setShowTrans]
  );

  const handleFontSizeChange = useCallback(
    (val: number) => {
      setFontSizeRem(val);
      window.localStorage.setItem(STORAGE_KEYS.VSIZE, String(val));
    },
    [setFontSizeRem]
  );

  return {
    handleToggleBookmark,
    handleCopyVerse,
    handleJumpAyah,
    handleTranslationChange,
    handleShowTransToggle,
    handleFontSizeChange,
  };
}
