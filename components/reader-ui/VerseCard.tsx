'use client';

/**
 * VerseCard — one reciteable Quran verse row in the ReaderView (Uthmani text,
 * optional translation, play / design-in-studio / copy / bookmark actions and
 * the user-colored recited-verse highlight). Extracted from
 * components/ReaderView.tsx per the 600-line file rule.
 */
import React from 'react';
import Link from 'next/link';
import { Bookmark, Copy, Loader2, Pause, Play, Sparkles } from 'lucide-react';
import type { QulVerse, ReciterOption } from '@/lib/quran-data';
import { stripHtmlTags, toArabicDigits } from '@/lib/quran-utils';
import type { VerseHighlightColorOption } from '@/lib/verse-highlight';
import { hexToRgbaCss } from '@/lib/verse-highlight';
import { StudioTooltip } from '../studio-ui/StudioControls';

export interface VerseCardProps {
  verse: QulVerse;
  surahId: number;
  surahName: string;
  translationId: number;
  fontSizeRem: number;
  showTrans: boolean;
  translationDir: 'rtl' | 'ltr';
  translationFallbackName: string;
  isPlayingThis: boolean;
  isPlayingAudio: boolean;
  isBuffering: boolean;
  isBookmarked: boolean;
  activeReciter: ReciterOption;
  highlightColor: VerseHighlightColorOption;
  onPlayVerse: (verse: QulVerse) => void;
  onTogglePause: () => void;
  onCopyVerse: (verse: QulVerse) => void;
  onToggleBookmark: (verse: QulVerse) => void;
}

export function VerseCard({
  verse,
  surahId,
  surahName,
  translationId,
  fontSizeRem,
  showTrans,
  translationDir,
  translationFallbackName,
  isPlayingThis,
  isPlayingAudio,
  isBuffering,
  isBookmarked,
  activeReciter,
  highlightColor,
  onPlayVerse,
  onTogglePause,
  onCopyVerse,
  onToggleBookmark,
}: VerseCardProps) {
  const ayahNum = Number(verse.verse_key.split(':')[1] || 1);
  const cleanTranslation = stripHtmlTags(verse.translations?.[0]?.text ?? '');
  const translationLabel = verse.translations?.[0]?.name ?? translationFallbackName;

  return (
    <article
      id={`verse-${surahId}-${ayahNum}`}
      className={`rounded-2xl border bg-[var(--surface-card)] p-5 transition-colors sm:p-6 ${
        isPlayingThis
          ? 'ring-2'
          : 'border-[var(--border-hairline)] hover:border-[var(--brand-gold)]/70'
      }`}
      style={
        isPlayingThis
          ? {
              backgroundColor: hexToRgbaCss(highlightColor.hex, 0.12),
              borderColor: highlightColor.hex,
              // @ts-expect-error CSS custom property consumed by Tailwind's ring
              '--tw-ring-color': hexToRgbaCss(highlightColor.hex, 0.3),
            }
          : undefined
      }
    >
      <div className="flex items-start gap-4">
        <span
          aria-label={`الآية رقم ${ayahNum}`}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--brand-gold)]/45 bg-[var(--surface-subtle)] text-xs font-bold text-[var(--brand-emerald)] tabular-nums dark:text-[#E6C75A]"
        >
          {toArabicDigits(ayahNum)}
        </span>

        <p
          className="font-quran flex-1 leading-[2.35] text-[var(--ink-primary)]"
          style={{ fontSize: `${fontSizeRem}rem` }}
        >
          {verse.text_uthmani}
        </p>
      </div>

      {showTrans && cleanTranslation && (
        <div
          dir={translationDir}
          className={`mt-4 border-t border-dashed border-[var(--border-hairline)] pt-3.5 ${
            translationDir === 'rtl' ? 'text-right' : 'text-left'
          }`}
        >
          <p className="text-[11px] font-semibold text-[var(--brand-gold)]">
            {translationLabel}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
            {cleanTranslation}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (isPlayingThis) {
                onTogglePause();
              } else {
                onPlayVerse(verse);
              }
            }}
            className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors ${
              isPlayingThis
                ? 'bg-[var(--brand-emerald)] text-[#FAF7F0]'
                : 'bg-[var(--surface-subtle)] text-[var(--ink-primary)] hover:bg-[var(--brand-emerald)] hover:text-[#FAF7F0]'
            }`}
          >
            {isPlayingThis && isBuffering ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <span>جاري التحميل...</span>
              </>
            ) : isPlayingThis && isPlayingAudio ? (
              <>
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                <span>إيقاف مؤقت</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isPlayingThis ? 'متابعة التلاوة' : 'تلاوة'}</span>
              </>
            )}
          </button>

          <StudioTooltip content="فتح الآية مباشرة في استوديو التصميم">
            <Link
              href={`/studio?surah=${surahId}&from=${ayahNum}&to=${ayahNum}&translation=${translationId}`}
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-gold)] hover:text-[#1F1705]"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>صمّم في الاستوديو</span>
            </Link>
          </StudioTooltip>

          <StudioTooltip content={`نسخ النص العثماني مع اسم ${surahName}`}>
            <button
              type="button"
              onClick={() => onCopyVerse(verse)}
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:bg-[var(--border-hairline)]"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>نسخ</span>
            </button>
          </StudioTooltip>

          <StudioTooltip content={isBookmarked ? 'إزالة من المحفوظات' : 'حفظ الآية'}>
            <button
              type="button"
              onClick={() => onToggleBookmark(verse)}
              aria-pressed={isBookmarked}
              className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors ${
                isBookmarked
                  ? 'bg-[var(--brand-gold)]/20 text-[var(--brand-emerald)] dark:text-[#E6C75A]'
                  : 'bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
              }`}
            >
              <Bookmark
                className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-current' : ''}`}
                aria-hidden="true"
              />
              <span>{isBookmarked ? 'محفوظة' : 'حفظ'}</span>
            </button>
          </StudioTooltip>
        </div>

        {isPlayingThis && (
          <span
            data-testid="active-verse-reciter-label"
            className="text-xs font-semibold"
            style={{ color: highlightColor.hex }}
          >
            {isPlayingAudio ? 'تتلى الآن بصوت' : 'متوقفة بصوت'} {activeReciter.name}
          </span>
        )}
      </div>
    </article>
  );
}
