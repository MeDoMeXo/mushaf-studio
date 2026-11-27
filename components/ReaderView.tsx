'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Languages,
  Pause,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import { type QulChapter, type QulVerse } from '@/lib/quran-data';
import { fetchChapters, fetchChapterVerses } from '@/lib/qul-client';
import {
  getTranslationDirection,
  resolveTranslationOption,
  toArabicDigits,
} from '@/lib/quran-utils';
import { resolveReciterOption, getStudioActiveReciters } from '@/lib/reciter-filter';
import {
  DEFAULT_VERSE_HIGHLIGHT_COLOR_ID,
  resolveVerseHighlightColor,
} from '@/lib/verse-highlight';
import {
  bumpStat,
  loadBookmarks,
  saveBookmarks,
  saveLastRead,
  STORAGE_KEYS,
  type BookmarkItem,
} from '@/lib/storage';
import { ReaderSettingsPanel } from './reader-ui/ReaderSettingsPanel';
import { VerseCard } from './reader-ui/VerseCard';
import { useVerseActions } from '@/hooks/use-verse-actions';
import { useApp } from './AppProvider';
import {
  StudioSlider,
  StudioSwitch,
  StudioTooltip,
} from './studio-ui/StudioControls';

interface ReaderViewProps {
  surahId: number;
}

export function ReaderView({ surahId }: ReaderViewProps) {
  const searchParams = useSearchParams();
  const focusAyahParam = Number(searchParams.get('ayah') || 0);

  const {
    config,
    audioState,
    registerSurahContext,
    playSurahVerses,
    togglePlayPause,
    setReciterPickerOpen,
    showToast,
  } = useApp();

  const [chapters, setChapters] = useState<QulChapter[]>([]);
  const [verses, setVerses] = useState<QulVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [translationId, setTranslationId] = useState<number>(
    config.defaultTranslation
  );
  const [showTrans, setShowTrans] = useState<boolean>(config.defaultShowTrans);
  const [fontSizeRem, setFontSizeRem] = useState<number>(config.defaultVsize);
  const [autoFollowVerse, setAutoFollowVerse] = useState<boolean>(true);
  const [highlightColorId, setHighlightColorId] = useState<string>(
    DEFAULT_VERSE_HIGHLIGHT_COLOR_ID
  );
  const [jumpInput, setJumpInput] = useState('');
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeReciter = useMemo(
    () => resolveReciterOption(audioState.reciter),
    [audioState.reciter]
  );

  // Recited-verse highlight (تظليل الآية المتلوة) — user-controllable color.
  const highlightColor = useMemo(
    () => resolveVerseHighlightColor(highlightColorId),
    [highlightColorId]
  );
  const verseCountLabel = useMemo(
    () =>
      toArabicDigits(
        getStudioActiveReciters(config.customReciters, config.disabledReciters).length
      ),
    [config.customReciters, config.disabledReciters]
  );

  const activeTranslation = useMemo(
    () => resolveTranslationOption(translationId),
    [translationId]
  );
  const translationDir = getTranslationDirection(activeTranslation.lang);

  // Sync saved reading preferences once on client
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      const savedTrans = Number(window.localStorage.getItem(STORAGE_KEYS.TRANSLATION));
      if (Number.isInteger(savedTrans) && savedTrans > 0) {
        setTranslationId(savedTrans);
      }
      const savedShow = window.localStorage.getItem(STORAGE_KEYS.SHOW_TRANS);
      if (savedShow !== null) {
        setShowTrans(savedShow !== '0');
      }
      const savedSize = Number(window.localStorage.getItem(STORAGE_KEYS.VSIZE));
      if (Number.isFinite(savedSize) && savedSize >= 1.2 && savedSize <= 3) {
        setFontSizeRem(savedSize);
      }
      const savedHighlight = window.localStorage.getItem(STORAGE_KEYS.VERSE_HIGHLIGHT);
      if (savedHighlight) {
        setHighlightColorId(savedHighlight);
      }
      setBookmarks(loadBookmarks());
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchChapters(),
      fetchChapterVerses(surahId, translationId),
    ])
      .then(([chaps, vs]) => {
        if (!active) return;
        setChapters(chaps);
        setVerses(vs);
        const cur = chaps.find((c) => c.id === surahId);
        if (cur) {
          saveLastRead({
            surah: surahId,
            ayah: focusAyahParam > 0 ? focusAyahParam : 1,
            name: cur.name_arabic,
          });
        }
        bumpStat('reads', `${surahId}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [surahId, translationId, focusAyahParam]);

  // Scroll to focused ayah when loaded
  useEffect(() => {
    if (!loading && focusAyahParam > 0) {
      const el = document.getElementById(`verse-${surahId}-${focusAyahParam}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [loading, surahId, focusAyahParam]);

  // Auto-follow the currently recited verse smoothly as recitation advances across the surah
  useEffect(() => {
    if (
      !autoFollowVerse ||
      !audioState.visible ||
      audioState.surahId !== surahId ||
      !audioState.currentVerseKey
    ) {
      return;
    }
    const ayahPart = Number(audioState.currentVerseKey.split(':')[1] || 0);
    if (!ayahPart) return;
    const el = document.getElementById(`verse-${surahId}-${ayahPart}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [autoFollowVerse, audioState.visible, audioState.surahId, audioState.currentVerseKey, surahId]);

  const chapter = useMemo(
    () => chapters.find((c) => c.id === surahId) ?? null,
    [chapters, surahId]
  );

  // Register open surah so choosing "استماع" inside the reciter picker starts reciting it directly
  useEffect(() => {
    if (!verses.length) return;
    registerSurahContext({
      surahId,
      surahName: chapter?.name_arabic ?? `سورة ${surahId}`,
      verses,
    });
    return () => {
      registerSurahContext(null);
    };
  }, [verses, surahId, chapter?.name_arabic, registerSurahContext]);

  const prevChapter = useMemo(
    () => chapters.find((c) => c.id === surahId - 1) ?? null,
    [chapters, surahId]
  );
  const nextChapter = useMemo(
    () => chapters.find((c) => c.id === surahId + 1) ?? null,
    [chapters, surahId]
  );

  const bookmarkedKeys = useMemo(
    () => new Set(bookmarks.map((b) => b.verseKey)),
    [bookmarks]
  );

  // Verse action handlers live in hooks/use-verse-actions.ts (600-line rule)
  const {
    handleToggleBookmark,
    handleCopyVerse,
    handleJumpAyah,
    handleTranslationChange,
    handleShowTransToggle,
    handleFontSizeChange,
    handleHighlightColorChange,
  } = useVerseActions({
    surahId,
    surahName: chapter?.name_arabic ?? `سورة ${surahId}`,
    bookmarks,
    bookmarkedKeys,
    setBookmarks,
    setTranslationId,
    setShowTrans,
    setFontSizeRem,
    setHighlightColorId,
    showToast,
  });


  return (
    <main className="mx-auto w-full max-w-[1060px] flex-1 px-3 pb-32 pt-4 sm:px-6 2xl:max-w-[1220px]">
      {/* Studio-Consistent Command Ribbon */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)]/96 px-3.5 py-2.5 shadow-sm backdrop-blur-md sm:sticky sm:top-3 sm:gap-3 sm:px-4">
        <div className="flex items-center gap-2">
          <Link
            href="/quran"
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-bold text-[var(--brand-emerald)] transition-colors hover:bg-[var(--surface-subtle)] dark:text-[#E6C75A]"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            <span>فهرس السور</span>
          </Link>
          <span className="h-4 w-px bg-[var(--border-hairline)]" aria-hidden="true" />
          <span className="font-display text-sm font-bold text-[var(--ink-primary)]">
            {chapter ? `سورة ${chapter.name_arabic}` : `سورة ${toArabicDigits(surahId)}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleJumpAyah} className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={chapter?.verses_count ?? 286}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder="رقم الآية"
              aria-label="الانتقال إلى رقم آية"
              className="h-8 w-20 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 text-center text-xs font-semibold text-[var(--ink-primary)] tabular-nums focus:border-[var(--brand-gold)] focus:outline-none"
            />
            <button
              type="submit"
              className="h-8 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
            >
              انتقال
            </button>
          </form>

          <StudioTooltip content={`اختيار القارئ من قائمة ${verseCountLabel} مصحفاً مرتلاً ومتزامناً آية بآية`}>
            <button
              type="button"
              data-testid="reader-reciter-btn"
              onClick={() => setReciterPickerOpen(true)}
              aria-label={`اختيار القارئ (القارئ الحالي: ${activeReciter.name})`}
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--brand-gold)]/55 bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)] hover:bg-[var(--brand-gold)]/12"
            >
              <Headphones
                className="h-3.5 w-3.5 shrink-0 text-[var(--brand-emerald)] dark:text-[#E6C75A]"
                aria-hidden="true"
              />
              <span className="max-w-[130px] truncate sm:max-w-[170px]">
                {activeReciter.name}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
            </button>
          </StudioTooltip>

          <StudioTooltip content="تخصيص الترجمة وحجم الخط وتتبع التلاوة">
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-expanded={settingsOpen}
              className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition-colors ${
                settingsOpen
                  ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--ink-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)] hover:border-[var(--brand-gold)]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>إعدادات القراءة</span>
            </button>
          </StudioTooltip>

          <button
            type="button"
            disabled={verses.length === 0}
            onClick={() => {
              const isCurrentSurahPlaying =
                audioState.visible && audioState.surahId === surahId;
              if (isCurrentSurahPlaying) {
                togglePlayPause();
              } else {
                playSurahVerses(
                  verses,
                  surahId,
                  chapter?.name_arabic ?? `سورة ${surahId}`,
                  verses[0]?.verse_key
                );
              }
            }}
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--brand-emerald)] px-3.5 text-xs font-bold text-[#FAF7F0] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {audioState.visible && audioState.surahId === surahId && audioState.playing ? (
              <>
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                <span>إيقاف التلاوة</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                <span>تلاوة السورة</span>
              </>
            )}
          </button>
        </div>
      </div>

      <ReaderSettingsPanel
        open={settingsOpen}
        translationId={translationId}
        showTrans={showTrans}
        fontSizeRem={fontSizeRem}
        autoFollowVerse={autoFollowVerse}
        activeReciter={activeReciter}
        highlightColorId={highlightColorId}
        onHighlightColorChange={handleHighlightColorChange}
        reciterCount={verseCountLabel}
        onTranslationChange={handleTranslationChange}
        onShowTransToggle={handleShowTransToggle}
        onFontSizeChange={handleFontSizeChange}
        onAutoFollowToggle={setAutoFollowVerse}
        onOpenReciterPicker={() => setReciterPickerOpen(true)}
      />

      {/* Ornate Surah Banner */}
      <section className="relative mt-4 overflow-hidden rounded-2xl border border-[#1B4A3A] bg-gradient-to-b from-[#0B3D2E] to-[#06221A] px-6 py-9 text-center text-[#FAF7F0] shadow-md">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 rounded-xl border border-[#E6C75A]/30"
        />
        <p className="text-xs font-semibold tracking-wider text-[#E6C75A]">
          {chapter?.name_simple} · {chapter?.translated_name?.name}
        </p>
        <h1 className="font-display mt-2 text-4xl font-bold text-[#FAF7F0] sm:text-5xl">
          سورة {chapter?.name_arabic ?? toArabicDigits(surahId)}
        </h1>
        {chapter && (
          <p className="mt-3 text-xs text-[#DFD8C8] tabular-nums">
            {chapter.revelation_place === 'makkah' ? 'مكية' : 'مدنية'} ·{' '}
            {toArabicDigits(chapter.verses_count)} آية · ترتيب النزول{' '}
            {toArabicDigits(chapter.revelation_order)} · الصفحات{' '}
            {chapter.pages
              ? `${toArabicDigits(chapter.pages[0])}–${toArabicDigits(chapter.pages[1])}`
              : '—'}{' '}
            · التلاوة بصوت{' '}
            <button
              type="button"
              onClick={() => setReciterPickerOpen(true)}
              className="font-semibold text-[#E6C75A] underline decoration-[#E6C75A]/50 underline-offset-4 hover:decoration-[#E6C75A]"
            >
              {activeReciter.name}
            </button>
          </p>
        )}
        {chapter?.bismillah_pre && (
          <p className="font-quran mt-6 text-2xl text-[#E6C75A] sm:text-3xl">
            بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
          </p>
        )}
      </section>

      {/* Verses List */}
      <section className="mt-5 space-y-3" aria-label="آيات السورة">
        {loading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-36 animate-pulse rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)]"
            />
          ))
        ) : (
          verses.map((verse) => {
            const isPlayingThis =
              audioState.visible &&
              audioState.currentVerseKey === verse.verse_key;

            return (
              <VerseCard
                key={verse.verse_key}
                verse={verse}
                surahId={surahId}
                surahName={chapter?.name_arabic ?? `سورة ${surahId}`}
                translationId={translationId}
                fontSizeRem={fontSizeRem}
                showTrans={showTrans}
                translationDir={translationDir}
                translationFallbackName={activeTranslation.name}
                isPlayingThis={isPlayingThis}
                isPlayingAudio={audioState.playing}
                isBuffering={audioState.buffering}
                isBookmarked={bookmarkedKeys.has(verse.verse_key)}
                activeReciter={activeReciter}
                highlightColor={highlightColor}
                onPlayVerse={(v) =>
                  playSurahVerses(
                    verses,
                    surahId,
                    chapter?.name_arabic ?? `سورة ${surahId}`,
                    v.verse_key
                  )
                }
                onTogglePause={togglePlayPause}
                onCopyVerse={handleCopyVerse}
                onToggleBookmark={handleToggleBookmark}
              />
            );
          })
        )}
      </section>

      {/* Next / Prev Surah Footer Navigation */}
      <nav
        aria-label="التنقل بين السور"
        className="mt-8 flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--border-hairline)] pt-6"
      >
        {prevChapter ? (
          <Link
            href={`/quran/${prevChapter.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-4 py-2.5 text-sm font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <span>السابقة: سورة {prevChapter.name_arabic}</span>
          </Link>
        ) : (
          <span />
        )}

        {nextChapter ? (
          <Link
            href={`/quran/${nextChapter.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-4 py-2.5 text-sm font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <span>التالية: سورة {nextChapter.name_arabic}</span>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
