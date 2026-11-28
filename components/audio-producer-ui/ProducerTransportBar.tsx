'use client';

/**
 * ProducerTransportBar — شريط التحكم في التشغيل أسفل محرر الموجة:
 * تنقّل الآيات + تشغيل/إيقاف + الوقت/المدة + السرعة + الصوت + التقريب.
 */
import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { formatAudioTime, toArabicDigits } from '@/lib/quran-utils';

const RATES = [0.75, 1, 1.25, 1.5, 2];

interface ProducerTransportBarProps {
  isPlaying: boolean;
  playheadEditedSec: number;
  editedTotalSec: number;
  sourceDurationSec: number;
  keptPct: number;
  verseCount: number;
  activeVerseIdx: number;
  volume: number;
  rate: number;
  onTogglePlay: () => void;
  onSeekToEdge: (edge: 'start' | 'end') => void;
  onPrevVerse: () => void;
  onNextVerse: () => void;
  onVolumeChange: (v: number) => void;
  onRateChange: (r: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
}

export function ProducerTransportBar({
  isPlaying,
  playheadEditedSec,
  editedTotalSec,
  sourceDurationSec,
  keptPct,
  verseCount,
  activeVerseIdx,
  volume,
  rate,
  onTogglePlay,
  onSeekToEdge,
  onPrevVerse,
  onNextVerse,
  onVolumeChange,
  onRateChange,
  onZoomIn,
  onZoomOut,
  onZoomFit,
}: ProducerTransportBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2.5 py-2">
      {/* تنقّل وتشغيل */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onSeekToEdge('start')}
          aria-label="الانتقال إلى البداية"
          title="البداية"
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)]"
        >
          <SkipBack className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onPrevVerse}
          disabled={verseCount === 0 || activeVerseIdx <= 0}
          aria-label="الآية السابقة"
          title="الآية السابقة"
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)] disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'إيقاف التشغيل' : 'تشغيل'}
          title={isPlaying ? 'إيقاف (مسافة)' : 'تشغيل (مسافة)'}
          disabled={editedTotalSec <= 0}
          className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--brand-emerald)] text-[#FAF7F0] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-[var(--brand-gold)] dark:text-[#1F1705]"
        >
          {isPlaying ? (
            <Pause className="h-4.5 w-4.5" aria-hidden="true" />
          ) : (
            <Play className="h-4.5 w-4.5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={onNextVerse}
          disabled={verseCount === 0 || activeVerseIdx >= verseCount - 1}
          aria-label="الآية التالية"
          title="الآية التالية"
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)] disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onSeekToEdge('end')}
          aria-label="الانتقال إلى النهاية"
          title="النهاية"
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)]"
        >
          <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* الوقت والمدة */}
      <div className="order-last w-full text-center font-mono text-xs font-bold text-[var(--ink-primary)] tabular-nums sm:order-none sm:w-auto">
        {formatAudioTime(playheadEditedSec)} / {formatAudioTime(editedTotalSec)}
        <span className="mx-1 text-[var(--border-hairline)]">·</span>
        <span className="text-[var(--ink-muted)]" title="مدة المصدر الأصلي">
          الأصل {formatAudioTime(sourceDurationSec)}
        </span>
        <span className="mx-1 text-[var(--border-hairline)]">·</span>
        <span className="text-[var(--brand-gold)]" title="نسبة المحفوظ بعد القصّ">
          {toArabicDigits(keptPct)}٪
        </span>
      </div>

      {/* السرعة والصوت والتقريب */}
      <div className="flex items-center gap-2">
        <div role="group" aria-label="سرعة التشغيل" className="flex items-center gap-0.5 rounded-lg bg-[var(--surface-subtle)] p-0.5">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRateChange(r)}
              aria-pressed={rate === r}
              className={`rounded-md px-1.5 py-1 text-[10px] font-bold tabular-nums transition-colors ${
                rate === r
                  ? 'bg-[var(--brand-gold)] text-[#1F1705]'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
              }`}
            >
              ×{toArabicDigits(String(r).replace('.', '.'))}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Volume2 className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label="مستوى الصوت"
            className="h-1.5 w-16 accent-[var(--brand-gold)] sm:w-20"
          />
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onZoomOut}
            aria-label="تصغير"
            title="تصغير (+ ctrl عجلة)"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            aria-label="تكبير"
            title="تكبير (ctrl− عجلة)"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onZoomFit}
            aria-label="ملاءمة كاملة"
            title="ملاءمة المقطع كاملاً"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <span className="text-[10px] font-bold">Fit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
