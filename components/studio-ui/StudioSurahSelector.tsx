'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { QulChapter } from '@/lib/quran-data';
import { filterChapters, toArabicDigits } from '@/lib/quran-utils';

interface StudioSurahSelectorProps {
  currentSurahId: number;
  chapters: QulChapter[];
  onSelectSurah: (surahId: number) => void;
}

const formatChapterOption = (ch: QulChapter) =>
  `${toArabicDigits(ch.id)}. سورة ${ch.name_arabic} (${toArabicDigits(ch.verses_count)} آية)`;

export function StudioSurahSelector({
  currentSurahId,
  chapters,
  onSelectSurah,
}: StudioSurahSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChapters = useMemo(() => {
    return filterChapters(chapters, searchQuery, 'all');
  }, [chapters, searchQuery]);

  const trimmedQuery = searchQuery.trim();

  // ── التنشيط التلقائي للبحث ──
  // When the query narrows the list to exactly ONE surah, the user's target
  // is determined (any continuation of the query keeps it as the only
  // match), so the surah loads immediately — no Enter or manual pick
  // needed. Typing «الكهف» أو «18» يُحمّل السورة فوراً.
  const uniqueMatch =
    trimmedQuery && filteredChapters.length === 1 ? filteredChapters[0] : null;
  useEffect(() => {
    if (!uniqueMatch || uniqueMatch.id === currentSurahId) return;
    onSelectSurah(uniqueMatch.id);
  }, [uniqueMatch, currentSurahId, onSelectSurah]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredChapters.length > 0) {
      e.preventDefault();
      onSelectSurah(filteredChapters[0].id);
    }
  };

  const hasSearch = trimmedQuery.length > 0;

  // Keep the controlled <select> honest: when the current surah is filtered
  // out, it is still rendered (selected) so the widget never *displays* a
  // surah the studio hasn't actually loaded.
  const currentChapter = useMemo(
    () => chapters.find((c) => c.id === currentSurahId),
    [chapters, currentSurahId]
  );
  const currentInFiltered = filteredChapters.some((c) => c.id === currentSurahId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="studio-surah-search"
          className="text-xs font-semibold text-[var(--ink-muted)]"
        >
          السورة الكريمة
        </label>
        {hasSearch && (
          <span className="text-[10px] font-medium text-[var(--brand-gold)]">
            {toArabicDigits(filteredChapters.length)} سورة مطابقة
          </span>
        )}
      </div>

      {/* Surah Search Field */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-muted)]"
          aria-hidden="true"
        />
        <input
          id="studio-surah-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ابحث باسم السورة (مثال: الكهف، 18)..."
          className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] pe-3 ps-8 text-xs font-medium text-[var(--ink-primary)] placeholder-[var(--ink-muted)] transition-colors focus:border-[var(--brand-gold)] focus:outline-none"
        />
        {hasSearch && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="مسح البحث"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {hasSearch && filteredChapters.length > 1 && (
        <p className="text-[10px] leading-relaxed text-[var(--ink-muted)]">
          أكمل البحث لتحديد السورة، أو اضغط Enter للانتقال إلى أول نتيجة.
        </p>
      )}

      {/* Surah Dropdown Selector */}
      <div>
        <select
          id="studio-surah-select"
          aria-label="اختيار السورة الكريمة"
          value={currentSurahId}
          onChange={(e) => onSelectSurah(Number(e.target.value))}
          className="h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm font-semibold text-[var(--ink-primary)] transition-colors focus:border-[var(--brand-gold)] focus:outline-none"
        >
          {currentChapter && !currentInFiltered && (
            <option value={currentChapter.id}>
              {formatChapterOption(currentChapter)}
            </option>
          )}
          {filteredChapters.length > 0 ? (
            filteredChapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {formatChapterOption(ch)}
              </option>
            ))
          ) : (
            !currentChapter && (
              <option disabled value="">
                لا توجد سورة مطابقة لـ &quot;{searchQuery}&quot;
              </option>
            )
          )}
        </select>
      </div>
    </div>
  );
}
