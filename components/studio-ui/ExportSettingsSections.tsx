'use client';

/**
 * ExportSettingsSections — video + audio export settings blocks.
 * Extracted from StudioExportModal (600-line rule): pure props-in sections.
 */
import React from 'react';
import { Sliders, Volume2 } from 'lucide-react';
import {
  AUDIO_EFFECT_PRESETS,
  AMBIENT_SOUND_PRESETS,
  SLIDE_TRANSITION_OPTIONS,
  type VideoExportSettings,
  type VideoFpsOption,
  type VideoQualityTier,
  type VideoResolutionTier,
} from '@/lib/video-export';
import type { QulVerse, StudioState } from '@/lib/quran-data';
import { StudioSlider, StudioSwitch } from './StudioControls';
import { TransitionPreviewCard } from './TransitionPreviewCard';

export interface ExportSettingsSectionsProps {
  exportSettings: VideoExportSettings;
  onUpdateExportSettings: (patch: Partial<VideoExportSettings>) => void;
  studioState?: StudioState;
  sampleVerses?: QulVerse[];
  surahName?: string;
  reciterName?: string;
  getBgImageEl?: () => HTMLImageElement | null;
  onOpenFullscreen?: () => void;
}

export function ExportSettingsSections({
  exportSettings,
  onUpdateExportSettings,
  studioState,
  sampleVerses,
  surahName,
  reciterName,
  getBgImageEl,
  onOpenFullscreen,
}: ExportSettingsSectionsProps) {
  return (
    <>
      {/* Section 1: Video Encoding Settings */}
      <div className="space-y-3 rounded-xl border border-[var(--border-hairline)] p-4">
        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-2.5">
          <Sliders className="h-4 w-4 text-[var(--brand-gold)]" aria-hidden="true" />
          <h3 className="text-sm font-bold text-[var(--ink-primary)]">
            إعدادات الفيديو والدقة
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {/* Format */}
          <div>
            <p className="text-xs font-bold text-[var(--ink-muted)]">صيغة الملف</p>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'mp4', label: 'MP4 (H.264)', note: 'متوافق مع جميع الأجهزة' },
                  { id: 'webm', label: 'WebM (VP8)', note: 'خفيف للويب' },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => onUpdateExportSettings({ format: fmt.id })}
                  className={`rounded-lg border px-3 py-2 text-right transition-colors ${
                    exportSettings.format === fmt.id
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--ink-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  <span className="block text-xs font-bold">{fmt.label}</span>
                  <span className="block text-[10px] opacity-80">{fmt.note}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div>
            <p className="text-xs font-bold text-[var(--ink-muted)]">دقة الفيديو</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: '480p', label: '480p', sub: 'سريع' },
                  { id: '720p', label: '720p', sub: 'HD' },
                  { id: '1080p', label: '1080p', sub: 'Full HD' },
                ] as { id: VideoResolutionTier; label: string; sub: string }[]
              ).map((res) => (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => onUpdateExportSettings({ resolution: res.id })}
                  className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                    exportSettings.resolution === res.id
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--ink-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  <span className="block text-xs font-bold">{res.label}</span>
                  <span className="block text-[10px] opacity-80">{res.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Frame Rate */}
          <div>
            <p className="text-xs font-bold text-[var(--ink-muted)]">معدل الإطارات (FPS)</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {([24, 30, 60] as VideoFpsOption[]).map((fps) => (
                <button
                  key={fps}
                  type="button"
                  onClick={() => onUpdateExportSettings({ fps })}
                  className={`rounded-lg border py-2 text-xs font-bold transition-colors tabular-nums ${
                    exportSettings.fps === fps
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--ink-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)]'
                  }`}
                >
                  {fps} FPS
                </button>
              ))}
            </div>
          </div>

          {/* Encoding Quality */}
          <div>
            <p className="text-xs font-bold text-[var(--ink-muted)]">جودة التشفير (CRF)</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'compact', label: 'مضغوطة' },
                  { id: 'balanced', label: 'متوازنة' },
                  { id: 'high', label: 'عالية' },
                ] as { id: VideoQualityTier; label: string }[]
              ).map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onUpdateExportSettings({ quality: q.id })}
                  className={`rounded-lg border py-2 text-xs font-bold transition-colors ${
                    exportSettings.quality === q.id
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--ink-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)]'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Slide Transition + Duration */}
          <div>
            <label
              htmlFor="export-transition-select"
              className="block text-xs font-bold text-[var(--ink-muted)]"
            >
              الانتقال بين شرائح الآيات
            </label>
            <select
              id="export-transition-select"
              value={exportSettings.transition}
              onChange={(e) =>
                onUpdateExportSettings({
                  transition: e.target.value as VideoExportSettings['transition'],
                })
              }
              className="mt-1.5 h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
            >
              {SLIDE_TRANSITION_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-center">
            <StudioSlider
              id="export-transition-ms"
              label="مدة الانتقال بين الشرائح"
              valueDisplay={`${exportSettings.transitionDurationMs} مللي ثانية`}
              min={200}
              max={1200}
              step={50}
              value={exportSettings.transitionDurationMs}
              disabled={exportSettings.transition === 'none'}
              onChange={(val) =>
                onUpdateExportSettings({ transitionDurationMs: val })
              }
            />
          </div>

          {/* Interactive Slide Transition Live Preview */}
          {studioState && (
            <div className="sm:col-span-2">
              <TransitionPreviewCard
                studioState={studioState}
                transition={exportSettings.transition}
                transitionDurationMs={exportSettings.transitionDurationMs}
                sampleVerses={sampleVerses}
                surahName={surahName}
                reciterName={reciterName}
                getBgImageEl={getBgImageEl}
                onOpenFullscreen={onOpenFullscreen}
              />
            </div>
          )}

          <div className="sm:col-span-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/60 px-3 py-2.5">
            <StudioSwitch
              id="export-include-intro-cover"
              data-testid="export-include-intro-cover-switch"
              label="إدراج غلاف البداية (بطاقة صامتة ٢.٥ ثانية قبل الآية الأولى)"
              checked={exportSettings.includeIntroCover !== false}
              onCheckedChange={(checked) =>
                onUpdateExportSettings({ includeIntroCover: checked })
              }
            />
          </div>
        </div>
      </div>

      {/* Section 2: Audio Engineering & Ambience Settings */}
      <div className="space-y-3 rounded-xl border border-[var(--border-hairline)] p-4">
        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-2.5">
          <Volume2 className="h-4 w-4 text-[var(--brand-gold)]" aria-hidden="true" />
          <h3 className="text-sm font-bold text-[var(--ink-primary)]">
            إعدادات الصوت والهندسة الصوتية
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="export-audio-preset"
              className="block text-xs font-bold text-[var(--ink-muted)]"
            >
              الهندسة الصوتية والمؤثر المحيطي
            </label>
            <select
              id="export-audio-preset"
              value={exportSettings.audioPreset}
              onChange={(e) =>
                onUpdateExportSettings({
                  audioPreset: e.target.value as VideoExportSettings['audioPreset'],
                })
              }
              className="mt-1.5 h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
            >
              {AUDIO_EFFECT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {p.subtitle}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="export-ambient-sound"
              className="block text-xs font-bold text-[var(--ink-muted)]"
            >
              مؤثر طبيعي هادئ (بدون موسيقى)
            </label>
            <select
              id="export-ambient-sound"
              value={exportSettings.ambientSound}
              onChange={(e) =>
                onUpdateExportSettings({
                  ambientSound: e.target.value as VideoExportSettings['ambientSound'],
                })
              }
              className="mt-1.5 h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
            >
              {AMBIENT_SOUND_PRESETS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {exportSettings.ambientSound !== 'none' && (
            <div className="sm:col-span-2">
              <StudioSlider
                id="export-ambient-vol"
                label="مستوى المؤثر الطبيعي في الخلفية"
                valueDisplay={`${Math.round(exportSettings.ambientVolume * 100)}%`}
                min={0.05}
                max={0.45}
                step={0.01}
                value={exportSettings.ambientVolume}
                onChange={(val) =>
                  onUpdateExportSettings({ ambientVolume: val })
                }
              />
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-[var(--ink-muted)]">جودة الصوت (Bitrate)</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {([128, 192, 320] as const).map((br) => (
                <button
                  key={br}
                  type="button"
                  onClick={() => onUpdateExportSettings({ audioBitrate: br })}
                  className={`rounded-lg border py-1.5 text-xs font-bold tabular-nums transition-colors ${
                    exportSettings.audioBitrate === br
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--ink-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  {br}k
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <StudioSlider
              id="export-verse-gap"
              label="وقفة صمت بين الآيات"
              valueDisplay={`${exportSettings.verseGapSec.toFixed(2)} ث`}
              min={0}
              max={1.5}
              step={0.05}
              value={exportSettings.verseGapSec}
              onChange={(val) =>
                onUpdateExportSettings({ verseGapSec: val })
              }
            />
          </div>

          <div className="sm:col-span-2">
            <StudioSwitch
              id="export-audio-fade"
              label="تلاشي ناعم لبداية ونهاية الصوت (Fade In / Out)"
              checked={exportSettings.audioFade}
              onCheckedChange={(checked) =>
                onUpdateExportSettings({ audioFade: checked })
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}
