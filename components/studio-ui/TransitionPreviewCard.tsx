'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Eye, Maximize2, Play, RotateCcw, Sparkles } from 'lucide-react';
import type { QulVerse, StudioState } from '@/lib/quran-data';
import { toArabicDigits } from '@/lib/quran-utils';
import {
  SLIDE_TRANSITION_OPTIONS,
  type SlideTransitionType,
} from '@/lib/video-export';

interface TransitionPreviewCardProps {
  studioState: StudioState;
  transition: SlideTransitionType;
  transitionDurationMs: number;
  sampleVerses?: QulVerse[];
  surahName?: string;
  reciterName?: string;
  getBgImageEl?: () => HTMLImageElement | null;
  onOpenFullscreen?: () => void;
}

const DEFAULT_SAMPLE_A = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
const DEFAULT_SAMPLE_B = 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ';

export function TransitionPreviewCard({
  studioState,
  transition,
  transitionDurationMs,
  sampleVerses = [],
  surahName = 'الفاتحة',
  reciterName = 'مشاري العفاسي',
  onOpenFullscreen,
}: TransitionPreviewCardProps) {
  const [currentSlideIdx, setCurrentSlideIdx] = useState<0 | 1>(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const verseA = sampleVerses[0]?.text_uthmani || DEFAULT_SAMPLE_A;
  const verseB = sampleVerses[1]?.text_uthmani || DEFAULT_SAMPLE_B;
  const ayahNumA = sampleVerses[0]?.verse_key?.split(':')[1] || '١';
  const ayahNumB = sampleVerses[1]?.verse_key?.split(':')[1] || '٢';

  const transOption = SLIDE_TRANSITION_OPTIONS.find((o) => o.id === transition);
  const transLabel = transOption?.label || transition;

  const currentVerse = currentSlideIdx === 0 ? verseA : verseB;
  const currentAyahNum = currentSlideIdx === 0 ? ayahNumA : ayahNumB;

  const playTransition = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsTransitioning(true);

    const dur = Math.max(200, Number(transitionDurationMs) || 750);
    const halfDur = Math.max(100, Math.round(dur / 2));

    // Transition to the other slide
    timerRef.current = setTimeout(() => {
      setCurrentSlideIdx((prev) => (prev === 0 ? 1 : 0));
      // Settle animation
      timerRef.current = setTimeout(() => {
        setIsTransitioning(false);
      }, halfDur);
    }, halfDur);
  }, [transitionDurationMs]);

  // Trigger preview automatically on transition settings change
  useEffect(() => {
    // Defer to a macrotask so setState lands in a timer callback instead of
    // running synchronously inside the effect body (react-hooks/set-state-in-effect).
    const kickoff = setTimeout(() => playTransition(), 0);
    return () => {
      clearTimeout(kickoff);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transition, transitionDurationMs]);

  // Derive animation styles according to transition type
  const getTransitionStyle = (): React.CSSProperties => {
    const durSec = (Math.max(200, Number(transitionDurationMs) || 750) / 1000).toFixed(2);
    const ease = 'cubic-bezier(0.16, 1, 0.3, 1)';

    if (transition === 'zoomin' || transition === 'zoom') {
      return {
        transition: `transform ${durSec}s ${ease}, opacity ${durSec}s ease`,
        transform: isTransitioning ? 'scale(0.92)' : 'scale(1)',
        opacity: isTransitioning ? 0.3 : 1,
      };
    }
    if (transition === 'slideup') {
      return {
        transition: `transform ${durSec}s ${ease}, opacity ${durSec}s ease`,
        transform: isTransitioning ? 'translateY(16px)' : 'translateY(0)',
        opacity: isTransitioning ? 0.25 : 1,
      };
    }
    if (transition === 'fadeblack') {
      return {
        transition: `opacity ${durSec}s ease, filter ${durSec}s ease`,
        opacity: isTransitioning ? 0.1 : 1,
        filter: isTransitioning ? 'brightness(0.2)' : 'brightness(1)',
      };
    }
    if (transition === 'fadewhite') {
      return {
        transition: `opacity ${durSec}s ease, filter ${durSec}s ease`,
        opacity: isTransitioning ? 0.1 : 1,
        filter: isTransitioning ? 'brightness(1.8)' : 'brightness(1)',
      };
    }
    if (transition === 'dissolve') {
      return {
        transition: `opacity ${durSec}s ease, filter ${durSec}s ease`,
        opacity: isTransitioning ? 0.2 : 1,
        filter: isTransitioning ? 'blur(6px)' : 'blur(0)',
      };
    }
    if (transition === 'none') {
      return { transition: 'none' };
    }
    // Default 'fade'
    return {
      transition: `opacity ${durSec}s ease`,
      opacity: isTransitioning ? 0.2 : 1,
    };
  };

  return (
    <div
      data-testid="transition-preview-card"
      className="mt-3 overflow-hidden rounded-xl border border-[var(--brand-gold)]/35 bg-gradient-to-b from-[var(--surface-subtle)] to-[var(--surface-primary)] p-4 shadow-sm"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
        <div className="flex items-center gap-2 font-bold text-xs text-[var(--ink-primary)]">
          <Sparkles className="h-4 w-4 text-[var(--brand-gold)]" />
          <span>محاكاة حركة الانتقال بين الشرائح</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--brand-gold)]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--brand-gold)] tabular-nums">
            {toArabicDigits(transitionDurationMs)} مللي ثانية
          </span>
          {isTransitioning && (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              جاري الانتقال
            </span>
          )}
        </div>
      </div>

      {/* High-Fidelity Preview Stage */}
      <div className="mt-3.5 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
        {/* Visual Card Stage */}
        <div
          dir="rtl"
          className="relative flex min-h-[120px] flex-1 flex-col justify-between overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[#0C1210] p-3.5 shadow-inner"
        >
          {/* Subtle Ambient Gold Hue */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#D4AF37]/8 via-transparent to-[#0B3D2E]/20" />

          {/* Top metadata pill */}
          <div className="relative z-10 flex items-center justify-between text-[11px] font-semibold text-[#D4AF37]/90">
            <span>سورة {surahName}</span>
            <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 text-[10px]">
              آية {toArabicDigits(currentAyahNum)}
            </span>
          </div>

          {/* Animated Quranic Text */}
          <div
            style={getTransitionStyle()}
            className="relative z-10 my-auto py-2 text-center"
          >
            <p
              className="text-base font-bold leading-relaxed text-[#FAF7F0] drop-shadow-sm sm:text-lg"
              style={{ fontFamily: studioState.fontFamily || 'Amiri Quran' }}
            >
              {currentVerse}
            </p>
          </div>

          {/* Bottom Reciter tag */}
          <div className="relative z-10 text-center text-[10px] text-white/50">
            بصوت القارئ {reciterName}
          </div>
        </div>

        {/* Side Actions & Fullscreen Launcher */}
        <div className="flex flex-col justify-between gap-2 sm:w-56 shrink-0">
          <div>
            <div className="text-[11px] font-semibold text-[var(--ink-muted)]">
              نوع الانتقال:
            </div>
            <div className="mt-0.5 text-xs font-bold text-[var(--ink-primary)]">
              {transLabel}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-muted)]">
              تعمل الحركة بين كل شريحة وأخرى أثناء التصدير بنفس هذه السرعة والنعومة.
            </p>
          </div>

          <div className="space-y-1.5 pt-1">
            {/* Prominent Fullscreen Viewer Button */}
            {onOpenFullscreen && (
              <button
                type="button"
                onClick={onOpenFullscreen}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--brand-gold)] bg-[var(--brand-gold)] px-3 py-2 text-xs font-bold text-[#1F1705] shadow-sm transition-all hover:brightness-110 active:scale-95"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>معاينة حية في شاشة التكبير ⛶</span>
              </button>
            )}

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={playTransition}
                disabled={isTransitioning}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-primary)] px-2.5 py-1.5 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)] disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3 text-[var(--brand-gold)]" />
                <span>إعادة ↺</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentSlideIdx((prev) => (prev === 0 ? 1 : 0))}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-primary)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink-primary)]"
                title="التبديل إلى الشريحة الأخرى"
              >
                <Eye className="h-3 w-3" />
                <span>شريحة {toArabicDigits(currentSlideIdx === 0 ? 2 : 1)}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
