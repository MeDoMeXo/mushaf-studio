'use client';

import React, { useMemo } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronUp,
  GraduationCap,
  Headphones,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react';
import { formatAudioTime, toArabicDigits } from '@/lib/quran-utils';
import { getStudioActiveReciters, resolveReciterOption } from '@/lib/reciter-filter';
import { useApp } from './AppProvider';
import { ReciterPickerModal } from './ReciterPickerModal';
import { StudioTooltip } from './studio-ui/StudioControls';

export function AudioPlayerBar() {
  const {
    audioState,
    config,
    activeSurahContext,
    favoriteReciters,
    toggleFavoriteReciter,
    reciterPickerOpen,
    setReciterPickerOpen,
    playSurahVerses,
    togglePlayPause,
    nextVerse,
    prevVerse,
    setTeacherMode,
    seekAudio,
    setReciter,
    closePlayer,
  } = useApp();

  const activeReciter = resolveReciterOption(audioState.reciter);
  // Verse-by-verse list for the global picker: built-ins + validated customs,
  // minus admin-disabled slugs (whole-surah customs excluded by design).
  const pickerReciters = useMemo(
    () => getStudioActiveReciters(config?.customReciters, config?.disabledReciters),
    [config?.customReciters, config?.disabledReciters]
  );
  const currentAyah = audioState.currentVerseKey
    ? audioState.currentVerseKey.split(':')[1]
    : '1';
  const safeDuration = audioState.duration > 0 ? audioState.duration : 100;
  const safeCurrent = Math.min(safeDuration, Math.max(0, audioState.currentTime));

  return (
    <>
      <AnimatePresence>
        {audioState.visible && (
          <motion.div
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            aria-label="مشغل التلاوة الصوتية"
            data-testid="audio-player-bar"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-hairline)] bg-[var(--surface-card)]/96 shadow-2xl backdrop-blur-md"
          >
            <div className="mx-auto flex max-w-[1440px] items-center gap-2.5 px-3 py-2.5 sm:gap-5 sm:px-6">
              {/* Active Surah & Verse Info */}
              <div className="min-w-0 flex-1 sm:flex-initial sm:min-w-[180px]">
                <p className="truncate text-sm font-bold text-[var(--ink-primary)]">
                  سورة {audioState.surahName} · آية {toArabicDigits(currentAyah)}
                </p>
                <p className="truncate text-xs text-[var(--ink-muted)]">
                  {activeReciter.name} · {activeReciter.styleLabel}
                </p>
              </div>

              {/* Playback Transport Controls */}
              <div className="flex shrink-0 items-center gap-1.5">
                <StudioTooltip content="الآية السابقة">
                  <button
                    type="button"
                    onClick={prevVerse}
                    disabled={audioState.currentIndex <= 0}
                    aria-label="الآية السابقة"
                    className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)] disabled:opacity-40"
                  >
                    <SkipForward className="h-4 w-4" aria-hidden="true" />
                  </button>
                </StudioTooltip>

                <StudioTooltip content={audioState.playing ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}>
                  <button
                    type="button"
                    onClick={togglePlayPause}
                    aria-label={audioState.playing ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
                    className="grid h-10 w-10 place-items-center rounded-full bg-[var(--brand-emerald)] text-[#FAF7F0] shadow-sm transition-transform hover:scale-105 active:scale-95"
                  >
                    {audioState.buffering ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : audioState.playing ? (
                      <Pause className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Play className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </StudioTooltip>

                <StudioTooltip content="الآية التالية">
                  <button
                    type="button"
                    onClick={nextVerse}
                    disabled={audioState.currentIndex >= audioState.verses.length - 1}
                    aria-label="الآية التالية"
                    className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)] disabled:opacity-40"
                  >
                    <SkipBack className="h-4 w-4" aria-hidden="true" />
                  </button>
                </StudioTooltip>

                {/* Teacher Mode (roadmap item 6): toggle + repetition badge */}
                <StudioTooltip
                  content={
                    audioState.teacher.enabled
                      ? 'إيقاف وضع المعلم (التكرار بعد كل آية)'
                      : 'وضع المعلم: تكرار كل آية مع توقف لتردّد التلميذ'
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      setTeacherMode({ enabled: !audioState.teacher.enabled })
                    }
                    aria-pressed={audioState.teacher.enabled}
                    aria-label="وضع المعلم"
                    className={`grid h-9 w-9 place-items-center rounded-lg border transition-colors ${
                      audioState.teacher.enabled
                        ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]'
                        : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:border-[var(--brand-gold)]'
                    }`}
                  >
                    <GraduationCap className="h-4 w-4" aria-hidden="true" />
                  </button>
                </StudioTooltip>
              </div>

              {/* Teacher-mode status badges */}
              {audioState.teacher.enabled && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="hidden rounded-md border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/10 px-2 py-1 text-[10px] font-bold text-[var(--brand-gold)] sm:inline">
                    {toArabicDigits(audioState.teacher.repeatCount)}× تكرار
                  </span>
                  {audioState.waitingForStudent && (
                    <span
                      data-testid="teacher-wait-badge"
                      className="animate-pulse rounded-md border border-[var(--brand-emerald)]/50 bg-[var(--brand-emerald)]/12 px-2 py-1 text-[10px] font-bold text-[var(--brand-emerald)] dark:text-[#E6C75A]"
                    >
                      دور التلميذ — ثم اضغط «التالية»
                    </span>
                  )}
                </div>
              )}

              {/* Radix UI Interactive Scrubber */}
              <div className="hidden flex-1 items-center gap-3 md:flex">
                <span className="w-10 text-center font-mono text-[11px] text-[var(--ink-muted)] tabular-nums">
                  {formatAudioTime(audioState.currentTime)}
                </span>
                <SliderPrimitive.Root
                  dir="rtl"
                  min={0}
                  max={safeDuration}
                  step={0.1}
                  value={[safeCurrent]}
                  disabled={audioState.duration <= 0}
                  onValueChange={(vals) => {
                    if (typeof vals[0] === 'number' && audioState.duration > 0) {
                      seekAudio(vals[0]);
                    }
                  }}
                  aria-label="موضع التلاوة"
                  className="relative flex h-5 flex-1 cursor-pointer touch-none select-none items-center data-[disabled]:opacity-40"
                >
                  <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[var(--surface-subtle)] ring-1 ring-[var(--border-hairline)]">
                    <SliderPrimitive.Range className="absolute h-full rounded-full bg-[var(--brand-gold)]" />
                  </SliderPrimitive.Track>
                  <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border-2 border-[var(--brand-gold)] bg-[var(--surface-card)] shadow-sm transition-transform hover:scale-115 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]" />
                </SliderPrimitive.Root>
                <span className="w-10 text-center font-mono text-[11px] text-[var(--ink-muted)] tabular-nums">
                  {formatAudioTime(audioState.duration)}
                </span>
              </div>

              {/* Reciter Switcher Trigger */}
              <StudioTooltip content="اختيار القارئ من قائمة المصاحف المرتلة">
                <button
                  type="button"
                  data-testid="player-reciter-btn"
                  onClick={() => setReciterPickerOpen(true)}
                  aria-label={`تغيير القارئ (الحالي: ${activeReciter.name})`}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
                >
                  <Headphones
                    className="h-3.5 w-3.5 text-[var(--brand-emerald)] dark:text-[#E6C75A]"
                    aria-hidden="true"
                  />
                  <span className="hidden max-w-[160px] truncate lg:inline">
                    {activeReciter.name}
                  </span>
                  <span className="lg:hidden">القارئ</span>
                  <ChevronUp className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" />
                </button>
              </StudioTooltip>

              {/* Close Player */}
              <StudioTooltip content="إغلاق المشغل الصوتي">
                <button
                  type="button"
                  onClick={closePlayer}
                  aria-label="إغلاق المشغل الصوتي"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink-primary)]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </StudioTooltip>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global International Reciter Picker Dialog */}
      <ReciterPickerModal
        open={reciterPickerOpen}
        onClose={() => setReciterPickerOpen(false)}
        selectedReciterSlug={audioState.reciter}
        favoriteReciters={favoriteReciters}
        reciters={pickerReciters}
        onSelectReciter={setReciter}
        onToggleFavorite={toggleFavoriteReciter}
        activeSurahName={
          activeSurahContext?.surahName || audioState.surahName || undefined
        }
        onPlayWithReciter={
          activeSurahContext && activeSurahContext.verses.length > 0
            ? (slug) => {
                const startKey =
                  audioState.visible &&
                  audioState.surahId === activeSurahContext.surahId &&
                  audioState.currentVerseKey
                    ? audioState.currentVerseKey
                    : activeSurahContext.verses[0]?.verse_key;
                playSurahVerses(
                  activeSurahContext.verses,
                  activeSurahContext.surahId,
                  activeSurahContext.surahName,
                  startKey,
                  slug
                );
              }
            : audioState.verses.length > 0
              ? (slug) =>
                  playSurahVerses(
                    audioState.verses,
                    audioState.surahId,
                    audioState.surahName,
                    audioState.currentVerseKey ?? audioState.verses[0]?.verse_key,
                    slug
                  )
              : undefined
        }
      />
    </>
  );
}
