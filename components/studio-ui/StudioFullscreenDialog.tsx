'use client';

/**
 * StudioFullscreenDialog — Live fullscreen recitation & video monitor modal.
 * Continuously mirrors the live Studio canvas while offering playback transport,
 * audio seekbar, and cover/ayah quick navigation without leaving fullscreen.
 */
import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import type { QulVerse } from '@/lib/quran-data';
import { formatAudioTime, toArabicDigits } from '@/lib/quran-utils';
import {
  SLIDE_TRANSITION_OPTIONS,
  type VideoExportSettings,
} from '@/lib/video-export';

export interface StudioFullscreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachCanvasRef: (node: HTMLCanvasElement | null) => void;
  surahName: string;
  reciterName: string;
  coverMode: boolean;
  selectedVerses: QulVerse[];
  activeIdxInRange: number;
  isPlaying: boolean;
  audioCurrentTime: number;
  audioDuration: number;
  exportSettings?: VideoExportSettings;
  onUpdateExportSettings?: (patch: Partial<VideoExportSettings>) => void;
  onTriggerTransitionPreview?: () => void;
  onSelectCoverSlide: () => void;
  onSelectVerseIndex: (idx: number) => void;
  onTogglePlay: () => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onSeekAudio: (timeSec: number) => void;
}

export function StudioFullscreenDialog({
  open,
  onOpenChange,
  attachCanvasRef,
  surahName,
  reciterName,
  coverMode,
  selectedVerses,
  activeIdxInRange,
  isPlaying,
  audioCurrentTime,
  audioDuration,
  exportSettings,
  onUpdateExportSettings,
  onTriggerTransitionPreview,
  onSelectCoverSlide,
  onSelectVerseIndex,
  onTogglePlay,
  onPrevSlide,
  onNextSlide,
  onSeekAudio,
}: StudioFullscreenDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/95" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
          className="fixed inset-0 z-50 flex flex-col justify-between gap-3 p-4 sm:p-5 focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">
            معاينة التلاوة والفيديو بملء الشاشة
          </DialogPrimitive.Title>

          {/* Top Live Header HUD */}
          <div className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0B0F0E]/88 px-4 py-2 text-white">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  isPlaying ? 'animate-pulse bg-emerald-400' : 'bg-[#D4AF37]'
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#FAF7F0]">
                  سورة {surahName}
                  <span className="mx-2 text-white/35">·</span>
                  <span className="text-xs font-semibold text-[#E6C75A]">
                    {coverMode
                      ? 'غلاف البداية (٢.٥ ث صامتة)'
                      : `الآية ${toArabicDigits(activeIdxInRange + 1)} من ${toArabicDigits(
                          Math.max(1, selectedVerses.length)
                        )}`}
                  </span>
                </p>
                <p className="truncate text-[11px] text-white/65">
                  {reciterName}
                  {isPlaying ? ' · جاري التلاوة المباشرة' : ' · اضغط تشغيل أو مسافة للمتابعة'}
                </p>
              </div>
            </div>

            {/* Transition Controls in Fullscreen */}
            {exportSettings && onUpdateExportSettings && (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1">
                <span className="text-[11px] font-semibold text-white/70">الانتقال:</span>
                <select
                  value={exportSettings.transition}
                  aria-label="نوع الانتقال في المعاينة المكبرة"
                  onChange={(e) =>
                    onUpdateExportSettings({
                      transition: e.target.value as VideoExportSettings['transition'],
                    })
                  }
                  className="rounded-lg border border-white/15 bg-black/50 px-2 py-0.5 text-xs font-bold text-[#E6C75A] focus:outline-none"
                >
                  {SLIDE_TRANSITION_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-[#121212] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>

                {onTriggerTransitionPreview && (
                  <button
                    type="button"
                    onClick={onTriggerTransitionPreview}
                    title="تجربة حركة الانتقال على الكانفس المكبر الحالي"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#D4AF37]/50 bg-[#D4AF37]/20 px-2.5 py-1 text-xs font-bold text-[#FAF7F0] transition-colors hover:bg-[#D4AF37]/35 active:scale-95"
                  >
                    <span>تجربة الانتقال 🎬</span>
                  </button>
                )}
              </div>
            )}

            <DialogPrimitive.Close
              aria-label="إغلاق المعاينة المكبرة"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/12 text-white transition-colors hover:bg-white/25"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          {/* Center Live Animated Video Canvas */}
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) onOpenChange(false);
            }}
            className="flex min-h-0 flex-1 items-center justify-center"
          >
            <canvas
              ref={attachCanvasRef}
              data-testid="fullscreen-preview-canvas"
              data-cover-mode={coverMode ? 'true' : 'false'}
              data-playing={isPlaying ? 'true' : 'false'}
              aria-label="معاينة التلاوة المكبرة الحية"
              className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
            />
          </div>

          {/* Bottom Interactive Playback & Slide Scrubber HUD */}
          <div className="mx-auto w-full max-w-3xl shrink-0 rounded-2xl border border-white/12 bg-[#0B0F0E]/92 px-4 py-3 text-white">
            {selectedVerses.length >= 1 && (
              <div
                data-testid="fullscreen-slide-filmstrip"
                className="mb-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5"
              >
                <button
                  type="button"
                  data-testid="fullscreen-cover-slide-btn"
                  onClick={onSelectCoverSlide}
                  aria-current={coverMode ? 'step' : undefined}
                  className={`h-7 shrink-0 rounded-md px-2.5 text-[11px] font-bold transition-colors ${
                    coverMode
                      ? 'bg-[#D4AF37] text-[#1F1705]'
                      : 'bg-white/10 text-white/75 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  غلاف
                </button>
                {selectedVerses.length <= 16 ? (
                  selectedVerses.map((v, idx) => {
                    const ayahNum = v.verse_key.split(':')[1] ?? String(idx + 1);
                    const active = !coverMode && idx === activeIdxInRange;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => onSelectVerseIndex(idx)}
                        aria-current={active ? 'step' : undefined}
                        className={`h-7 min-w-[30px] shrink-0 rounded-md px-2 text-[11px] font-bold tabular-nums transition-colors ${
                          active
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/10 text-white/75 hover:bg-white/20 hover:text-white'
                        }`}
                      >
                        {toArabicDigits(ayahNum)}
                      </button>
                    );
                  })
                ) : (
                  <SliderPrimitive.Root
                    dir="rtl"
                    min={0}
                    max={selectedVerses.length - 1}
                    step={1}
                    value={[activeIdxInRange]}
                    onValueChange={(vals) => {
                      if (typeof vals[0] === 'number') onSelectVerseIndex(vals[0]);
                    }}
                    aria-label="الانتقال إلى آية في المعاينة المكبرة"
                    className="relative flex h-5 flex-1 touch-none select-none items-center"
                  >
                    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/15">
                      <SliderPrimitive.Range className="absolute h-full rounded-full bg-[#D4AF37]" />
                    </SliderPrimitive.Track>
                    <SliderPrimitive.Thumb className="block h-3.5 w-3.5 cursor-grab rounded-full border-2 border-black bg-[#D4AF37]" />
                  </SliderPrimitive.Root>
                )}
              </div>
            )}

            {/* Audio Progress + Transport Buttons */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={coverMode}
                  onClick={onPrevSlide}
                  aria-label="الشريحة السابقة في المعاينة المكبرة"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 bg-white/10 text-white transition-colors hover:border-[#D4AF37] disabled:opacity-35"
                >
                  <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-testid="fullscreen-toggle-play-btn"
                  onClick={onTogglePlay}
                  aria-label={isPlaying ? 'إيقاف معاينة التلاوة' : 'تشغيل معاينة التلاوة'}
                  className="grid h-9 w-9 place-items-center rounded-full bg-[#D4AF37] text-[#1F1705] shadow transition-transform hover:scale-105"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Play className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  disabled={!coverMode && activeIdxInRange >= selectedVerses.length - 1}
                  onClick={onNextSlide}
                  aria-label="الشريحة التالية في المعاينة المكبرة"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 bg-white/10 text-white transition-colors hover:border-[#D4AF37] disabled:opacity-35"
                >
                  <SkipBack className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-1 items-center gap-2.5 text-[11px] font-mono text-white/75 tabular-nums">
                <span className="w-10 text-right">{formatAudioTime(audioCurrentTime)}</span>
                <SliderPrimitive.Root
                  dir="ltr"
                  min={0}
                  max={audioDuration > 0 ? audioDuration : 1}
                  step={0.1}
                  value={[audioDuration > 0 ? Math.min(audioDuration, audioCurrentTime) : 0]}
                  disabled={audioDuration <= 0}
                  onValueChange={(vals) => {
                    if (typeof vals[0] === 'number') onSeekAudio(vals[0]);
                  }}
                  aria-label="شريط تقدم صوت التلاوة في المعاينة المكبرة"
                  className="relative flex h-5 flex-1 touch-none select-none items-center"
                >
                  <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/15">
                    <SliderPrimitive.Range className="absolute h-full rounded-full bg-[#D4AF37]" />
                  </SliderPrimitive.Track>
                  <SliderPrimitive.Thumb className="block h-3.5 w-3.5 cursor-grab rounded-full border-2 border-black bg-[#D4AF37]" />
                </SliderPrimitive.Root>
                <span className="w-10 text-left">{formatAudioTime(audioDuration)}</span>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
