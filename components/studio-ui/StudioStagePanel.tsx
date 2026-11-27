'use client';

import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { motion } from 'motion/react';
import {
  BookmarkPlus,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Maximize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Video,
} from 'lucide-react';
import type { AudioCacheProgress } from '@/lib/audio-cache';
import {
  ASPECT_PRESETS,
  type AspectPresetId,
  type QulVerse,
  type StudioState,
} from '@/lib/quran-data';
import { formatAudioTime, toArabicDigits } from '@/lib/quran-utils';
import {
  AMBIENT_SOUND_PRESETS,
  AUDIO_EFFECT_PRESETS,
  type VideoExportSettings,
} from '@/lib/video-export';
import { StudioTooltip } from './StudioControls';

interface StudioStagePanelProps {
  state: StudioState;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  activeVerse: QulVerse | null;
  selectedVerses: QulVerse[];
  activeIdxInRange: number;
  loadingVerses: boolean;
  bgVideoReady: boolean;
  customAudioUrl: string | null;
  audioCache: AudioCacheProgress;
  isPlaying: boolean;
  audioCurrentTime: number;
  audioDuration: number;
  activeReciterName: string;
  exportSettings: VideoExportSettings;
  previewEstimatedSizeMb: number;
  onAspectSelect: (presetId: AspectPresetId) => void;
  onCustomDimensionsChange: (dims: { width?: number; height?: number }) => void;
  onOpenFullscreen: () => void;
  onRetryCache: () => void;
  onSelectCoverSlide: () => void;
  onSelectVerseIndex: (idx: number) => void;
  onTogglePlay: () => void;
  onPrevVerse: () => void;
  onNextVerse: () => void;
  onSeekAudio: (timeSec: number) => void;
  onOpenExportModal: () => void;
  onExportImage: (format: 'png' | 'jpeg') => void;
  onQuickSaveDesign: () => void;
  onCopyImage: () => void;
}

export function StudioStagePanel({
  state,
  canvasRef,
  activeVerse,
  selectedVerses,
  activeIdxInRange,
  loadingVerses,
  bgVideoReady,
  customAudioUrl,
  audioCache,
  isPlaying,
  audioCurrentTime,
  audioDuration,
  activeReciterName,
  exportSettings,
  previewEstimatedSizeMb,
  onAspectSelect,
  onCustomDimensionsChange,
  onOpenFullscreen,
  onRetryCache,
  onSelectCoverSlide,
  onSelectVerseIndex,
  onTogglePlay,
  onPrevVerse,
  onNextVerse,
  onSeekAudio,
  onOpenExportModal,
  onExportImage,
  onQuickSaveDesign,
  onCopyImage,
}: StudioStagePanelProps) {
  const stageAspectStyle = React.useMemo(
    () => ({ aspectRatio: `${state.width} / ${state.height}` }),
    [state.width, state.height]
  );

  const audioPresetLabel =
    AUDIO_EFFECT_PRESETS.find((p) => p.id === exportSettings.audioPreset)?.label ?? 'طبيعي';
  const ambientLabel =
    exportSettings.ambientSound !== 'none'
      ? AMBIENT_SOUND_PRESETS.find((a) => a.id === exportSettings.ambientSound)?.label ?? ''
      : '';

  return (
    <section
      aria-label="المعاينة الحية والتصدير"
      className="order-first flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] md:col-span-2 xl:order-none xl:col-span-1 xl:h-full"
    >
      {/* Top Stage Bar: Aspect Switcher (Motion layoutId) + Dimensions + Fullscreen */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] px-3 py-2 sm:flex-nowrap sm:px-4">
        <div
          role="group"
          aria-label="مقاس التصميم"
          className="flex max-w-full flex-wrap items-center gap-0.5 rounded-lg bg-[var(--surface-subtle)] p-1 sm:flex-nowrap"
        >
          {ASPECT_PRESETS.map((preset) => {
            const active = state.aspect === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => onAspectSelect(preset.id)}
                className={`relative whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? 'text-[var(--ink-primary)]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="studio-aspect-indicator"
                    transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                    className="absolute inset-0 rounded-md bg-[var(--surface-card)] shadow-sm ring-1 ring-[var(--brand-gold)]/55"
                  />
                )}
                <span className="relative z-10">
                  {preset.label} <span className="opacity-70">{preset.ratio}</span>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={state.aspect === 'custom'}
            onClick={() => onAspectSelect('custom')}
            className={`relative whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              state.aspect === 'custom'
                ? 'text-[var(--ink-primary)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
            }`}
          >
            {state.aspect === 'custom' && (
              <motion.span
                layoutId="studio-aspect-indicator"
                transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                className="absolute inset-0 rounded-md bg-[var(--surface-card)] shadow-sm ring-1 ring-[var(--brand-gold)]/55"
              />
            )}
            <span className="relative z-10">مخصص</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-medium text-[var(--ink-muted)] tabular-nums">
            {state.width}×{state.height}
          </span>
          <StudioTooltip content="معاينة التصميم والانتقالات بملء الشاشة">
            <button
              type="button"
              onClick={onOpenFullscreen}
              aria-label="معاينة بملء الشاشة"
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
            >
              <Maximize2 className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
              <span className="hidden sm:inline">تكبير ومعاينة</span>
            </button>
          </StudioTooltip>
        </div>
      </div>

      {/* Optional Custom Dimensions Row */}
      {state.aspect === 'custom' && (
        <div className="flex items-center justify-center gap-2 border-b border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 px-4 py-2">
          <span className="text-xs font-semibold text-[var(--ink-muted)]">الأبعاد:</span>
          <input
            type="number"
            min={320}
            max={2160}
            value={state.width}
            onChange={(e) =>
              onCustomDimensionsChange({
                width: Math.max(320, Math.min(2160, Number(e.target.value) || 1080)),
              })
            }
            aria-label="العرض بالبكسل"
            className="h-7 w-20 rounded-md border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2 text-center font-mono text-xs tabular-nums"
          />
          <span className="text-xs text-[var(--ink-muted)]">×</span>
          <input
            type="number"
            min={320}
            max={2160}
            value={state.height}
            onChange={(e) =>
              onCustomDimensionsChange({
                height: Math.max(320, Math.min(2160, Number(e.target.value) || 1080)),
              })
            }
            aria-label="الارتفاع بالبكسل"
            className="h-7 w-20 rounded-md border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2 text-center font-mono text-xs tabular-nums"
          />
          <span className="font-mono text-[11px] text-[var(--ink-muted)]">px</span>
        </div>
      )}

      {/* Pro Darkroom Canvas Artboard Viewport */}
      <div className="studio-stage-grid relative flex min-h-[300px] w-full flex-1 flex-col items-center justify-center overflow-hidden px-3 py-3 sm:min-h-[360px] sm:px-4 sm:py-4 xl:min-h-0">
        {/* Live Browser Audio Cache Progress Status */}
        {!customAudioUrl && audioCache.total > 0 && (
          <div
            data-testid="audio-cache-badge"
            data-cache-status={audioCache.status}
            data-cached-count={audioCache.cached}
            data-total-count={audioCache.total}
            className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)]/92 px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-primary)] shadow-sm backdrop-blur-md"
          >
            {audioCache.status === 'loading' ? (
              <>
                <Loader2
                  className="h-3.5 w-3.5 animate-spin text-[var(--brand-gold)]"
                  aria-hidden="true"
                />
                <span className="tabular-nums">
                  تجهيز الصوت ({audioCache.cached}/{audioCache.total})
                </span>
              </>
            ) : audioCache.status === 'ready' ? (
              <>
                <CheckCircle2
                  className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <span className="tabular-nums">
                  الصوت جاهز ({audioCache.cached}/{audioCache.total})
                </span>
              </>
            ) : (
              <>
                <span className="tabular-nums text-amber-700 dark:text-amber-300">
                  تم تجهيز ({audioCache.cached}/{audioCache.total})
                </span>
                <button
                  type="button"
                  onClick={onRetryCache}
                  className="mr-1 rounded bg-[var(--brand-gold)] px-1.5 py-0.5 text-[10px] font-bold text-[#1F1705]"
                >
                  إعادة
                </button>
              </>
            )}
          </div>
        )}

        {/* Framed Canvas Artboard */}
        <div
          style={stageAspectStyle}
          className={`relative overflow-hidden rounded-xl ring-1 ring-black/15 shadow-2xl dark:ring-white/10 ${
            state.height > state.width
              ? 'h-[310px] w-auto max-w-full sm:h-[360px] xl:h-full xl:max-h-[480px] 2xl:max-h-[580px]'
              : state.height === state.width
                ? 'h-[290px] w-auto max-w-full sm:h-[340px] xl:h-full xl:max-h-[440px] 2xl:max-h-[540px]'
                : 'max-h-[260px] w-full max-w-[520px] sm:max-h-[340px] xl:max-h-full 2xl:max-w-[640px]'
          }`}
        >
          <canvas
            ref={canvasRef}
            data-testid="studio-canvas"
            data-dims={`${state.width}x${state.height}`}
            data-surah={state.surah}
            data-ayah={activeVerse?.verse_key ?? `${state.surah}:${state.fromAyah}`}
            data-cover-mode={state.coverMode ? 'true' : 'false'}
            data-font-weight={state.fontWeight}
            data-surah-pos={state.surahPosition}
            data-reciter-pos={state.reciterPosition}
            data-lut={state.colorLut}
            data-bg-type={state.bgType}
            data-has-bg-video={bgVideoReady ? 'true' : 'false'}
            data-show-ayah-number={state.showAyahNumber ? 'true' : 'false'}
            data-ayah-style={state.ayahNumberStyle}
            data-frame-style={state.frameStyle}
            data-pattern-style={state.patternStyle}
            data-corner-style={state.cornerStyle}
            data-surah-banner={state.surahBannerStyle}
            data-ornament-color={state.ornamentColor}
            data-text-source={state.textSource}
            data-translation-id={state.translationId}
            className="block h-full w-full"
          />
          {loadingVerses && (
            <div className="absolute inset-0 grid place-items-center bg-black/45 text-xs font-bold text-white backdrop-blur-[1px]">
              جارٍ تحميل الآيات...
            </div>
          )}
        </div>
      </div>

      {/* Verse Timeline Filmstrip + Interactive Audio Transport Deck */}
      <div className="shrink-0 border-t border-[var(--border-hairline)] bg-[var(--surface-card)] px-4 py-3">
        {/* Interactive Slide Filmstrip (Cover + Verses: غلاف · ١ · ٢ · ٣) */}
        {!loadingVerses && selectedVerses.length >= 1 && (
          <div className="mb-3" data-testid="studio-slide-filmstrip">
            {selectedVerses.length <= 20 ? (
              <div
                role="group"
                aria-label="شرائح المقطع (الغلاف والآيات)"
                className="flex items-center gap-1 overflow-x-auto pb-1 studio-scroll"
              >
                <button
                  type="button"
                  data-testid="preview-cover-slide-btn"
                  onClick={onSelectCoverSlide}
                  aria-current={state.coverMode ? 'step' : undefined}
                  className={`h-7 shrink-0 rounded-md px-2.5 text-[11px] font-bold transition-colors ${
                    state.coverMode
                      ? 'bg-[var(--brand-gold)] text-[#1F1705]'
                      : 'bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  غلاف
                </button>
                {selectedVerses.map((v, idx) => {
                  const ayahNum = v.verse_key.split(':')[1] ?? String(idx + 1);
                  const active = !state.coverMode && idx === activeIdxInRange;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onSelectVerseIndex(idx)}
                      aria-current={active ? 'step' : undefined}
                      className={`h-7 min-w-[30px] shrink-0 rounded-md px-2 text-[11px] font-bold tabular-nums transition-colors ${
                        active
                          ? 'bg-[var(--brand-emerald)] text-[#FAF7F0] dark:bg-[var(--brand-gold)] dark:text-[#1F1705]'
                          : 'bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                      }`}
                    >
                      {toArabicDigits(ayahNum)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  data-testid="preview-cover-slide-btn"
                  onClick={onSelectCoverSlide}
                  aria-current={state.coverMode ? 'step' : undefined}
                  className={`h-7 shrink-0 rounded-md px-2.5 text-[11px] font-bold transition-colors ${
                    state.coverMode
                      ? 'bg-[var(--brand-gold)] text-[#1F1705]'
                      : 'bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  غلاف
                </button>
                <SliderPrimitive.Root
                  dir="rtl"
                  min={0}
                  max={selectedVerses.length - 1}
                  step={1}
                  value={[activeIdxInRange]}
                  onValueChange={(vals) => {
                    if (typeof vals[0] === 'number') onSelectVerseIndex(vals[0]);
                  }}
                  aria-label="الانتقال إلى آية في المقطع"
                  className="relative flex h-5 flex-1 touch-none select-none items-center"
                >
                  <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[var(--border-hairline)]">
                    <SliderPrimitive.Range className="absolute h-full rounded-full bg-[var(--brand-emerald)] dark:bg-[var(--brand-gold)]" />
                  </SliderPrimitive.Track>
                  <SliderPrimitive.Thumb className="block h-3.5 w-3.5 cursor-grab rounded-full border-2 border-[var(--surface-card)] bg-[var(--brand-gold)] shadow-sm" />
                </SliderPrimitive.Root>
                <span className="shrink-0 font-mono text-[11px] font-bold text-[var(--ink-primary)] tabular-nums">
                  {state.coverMode
                    ? 'غلاف'
                    : `${toArabicDigits(activeIdxInRange + 1)} / ${toArabicDigits(selectedVerses.length)}`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Interactive Audio Seekbar (Radix Slider) */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--ink-muted)] tabular-nums">
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
            aria-label="شريط تقدم صوت التلاوة"
            className="relative flex h-5 flex-1 touch-none select-none items-center"
          >
            <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[var(--border-hairline)]">
              <SliderPrimitive.Range className="absolute h-full rounded-full bg-[var(--brand-gold)]" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb className="block h-3.5 w-3.5 cursor-grab rounded-full border-2 border-[var(--surface-card)] bg-[var(--brand-gold)] shadow-sm transition-transform hover:scale-110" />
          </SliderPrimitive.Root>
          <span className="w-10 text-left">{formatAudioTime(audioDuration)}</span>
        </div>

        {/* Transport Controls Row */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0 text-xs text-[var(--ink-muted)] tabular-nums">
            {state.coverMode ? (
              <span className="font-bold text-[var(--brand-gold)]">
                غلاف البداية (٢.٥ ث صامتة)
              </span>
            ) : (
              <>
                <span className="font-bold text-[var(--ink-primary)]">
                  آية {toArabicDigits(activeIdxInRange + 1)}
                </span>{' '}
                <span>/ {toArabicDigits(Math.max(1, selectedVerses.length))}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <StudioTooltip content="الشريحة السابقة">
              <button
                type="button"
                disabled={Boolean(state.coverMode)}
                onClick={onPrevVerse}
                aria-label="الشريحة السابقة في المقطع"
                className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)] disabled:opacity-35"
              >
                <SkipForward className="h-4 w-4" aria-hidden="true" />
              </button>
            </StudioTooltip>

            <StudioTooltip
              content={isPlaying ? 'إيقاف معاينة التلاوة' : 'تشغيل معاينة التلاوة'}
              shortcut="Space"
            >
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'إيقاف معاينة التلاوة' : 'تشغيل معاينة التلاوة'}
                className="grid h-10 w-10 place-items-center rounded-full bg-[var(--brand-gold)] text-[#1F1705] shadow-sm transition-transform hover:scale-105"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </StudioTooltip>

            <StudioTooltip content="الشريحة التالية">
              <button
                type="button"
                disabled={!state.coverMode && activeIdxInRange >= selectedVerses.length - 1}
                onClick={onNextVerse}
                aria-label="الشريحة التالية في المقطع"
                className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)] disabled:opacity-35"
              >
                <SkipBack className="h-4 w-4" aria-hidden="true" />
              </button>
            </StudioTooltip>
          </div>

          <span className="max-w-[120px] truncate text-left text-xs font-semibold text-[var(--brand-emerald)] dark:text-[#E6C75A]">
            {activeReciterName.split(' ')[0]}
          </span>
        </div>
      </div>

      {/* Bottom Output Summary & Export Actions Strip */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] bg-[var(--surface-subtle)]/55 px-4 py-2.5">
        <div className="min-w-0 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 font-semibold text-[var(--ink-primary)] tabular-nums">
            <span>{exportSettings.format.toUpperCase()}</span>
            <span className="text-[var(--ink-muted)]" aria-hidden="true">·</span>
            <span>{exportSettings.resolution}</span>
            <span className="text-[var(--ink-muted)]" aria-hidden="true">·</span>
            <span>{exportSettings.fps} FPS</span>
            <span className="text-[var(--ink-muted)]" aria-hidden="true">·</span>
            <span className="text-[var(--brand-emerald)] dark:text-[#E6C75A]">
              ~{previewEstimatedSizeMb} MB
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">
            الصوت: {audioPresetLabel}
            {ambientLabel ? ` + ${ambientLabel}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onExportImage('png')}
            className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2.5 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>PNG</span>
          </button>

          <button
            type="button"
            onClick={() => onExportImage('jpeg')}
            className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2.5 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>JPG</span>
          </button>

          <StudioTooltip content="حفظ التصميم الحالي في قوالبي لاستخدامه لاحقاً">
            <button
              type="button"
              data-testid="quick-save-design-btn"
              aria-label="حفظ التصميم الحالي في قوالبي المحفوظة"
              onClick={onQuickSaveDesign}
              className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-[var(--brand-emerald)]/40 bg-[var(--brand-emerald)]/10 px-2.5 text-xs font-bold text-[var(--brand-emerald)] transition-colors hover:bg-[var(--brand-emerald)]/18 dark:border-[#E6C75A]/45 dark:bg-[#E6C75A]/12 dark:text-[#E6C75A]"
            >
              <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>حفظ</span>
            </button>
          </StudioTooltip>

          <button
            type="button"
            onClick={onCopyImage}
            className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2.5 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            <span>نسخ</span>
          </button>

          <button
            type="button"
            onClick={onOpenExportModal}
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--brand-gold)]/70 bg-[var(--brand-gold)]/12 px-3 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-gold)]/22"
          >
            <Video className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
            <span>إعدادات التصدير</span>
          </button>
        </div>
      </div>
    </section>
  );
}
