'use client';

/**
 * StudioAudioPanel — audio engineering, ambience, transitions + the two
 * cinematic/export accordions that live below the tab strip.
 * Extracted from StudioDesignInspector (600-line rule).
 */
import React from 'react';
import {
  Clapperboard,
  Film,
  Video,
} from 'lucide-react';
import {
  ASPECT_PRESETS,
  COLOR_LUT_PRESETS,
  type AspectPresetId,
  type StudioState,
} from '@/lib/quran-data';
import {
  AMBIENT_SOUND_PRESETS,
  AUDIO_EFFECT_PRESETS,
  EXPORT_QUALITY_PRESETS,
  SLIDE_TRANSITION_OPTIONS,
  type VideoExportSettings,
  type VideoFpsOption,
  type VideoQualityTier,
  type VideoResolutionTier,
} from '@/lib/video-export';
import { StudioSlider } from './StudioControls';
import { StudioTabPanel } from './StudioTabs';
import { StudioInspectorSection } from './StudioInspectorSection';

export interface StudioAudioPanelProps {
  state: StudioState;
  exportSettings: VideoExportSettings;
  activeQualityPresetId: string;
  previewTargetDims: { width: number; height: number };
  previewEstimatedSizeMb: number;
  onPatchState: (patch: Partial<StudioState>) => void;
  onUpdateExportSettings: (patch: Partial<VideoExportSettings>) => void;
  onSelectQualityPreset: (presetId: string) => void;
  onAspectSelect: (presetId: AspectPresetId) => void;
  onOpenExportModal: () => void;
}

export function StudioAudioPanel({
  state,
  exportSettings,
  activeQualityPresetId,
  previewTargetDims,
  previewEstimatedSizeMb,
  onPatchState,
  onUpdateExportSettings,
  onSelectQualityPreset,
  onAspectSelect,
  onOpenExportModal,
}: StudioAudioPanelProps) {
  return (
    <StudioTabPanel value="audio" className="space-y-2.5 focus:outline-none">
      <StudioInspectorSection
        id="aud-dsp"
        title="الهندسة الصوتية والمؤثرات المحيطية"
        badge={
          exportSettings.audioPreset !== 'natural' ? (
            <span className="rounded-md bg-[var(--brand-gold)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-gold)]">
              {AUDIO_EFFECT_PRESETS.find((p) => p.id === exportSettings.audioPreset)?.label}
            </span>
          ) : undefined
        }
      >
      <div>
        {exportSettings.audioPreset !== 'natural' && (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => onUpdateExportSettings({ audioPreset: 'natural' })}
              className="text-[11px] font-semibold text-[var(--brand-emerald)] underline dark:text-[#E6C75A]"
            >
              إعادة تعيين إلى طبيعي
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          {AUDIO_EFFECT_PRESETS.map((preset) => {
            const active = exportSettings.audioPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => onUpdateExportSettings({ audioPreset: preset.id })}
                className={`rounded-lg border px-2.5 py-2 text-right transition-colors ${
                  active
                    ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--ink-primary)]'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                }`}
              >
                <span className="block text-xs font-bold">{preset.label}</span>
                <span className="block text-[10px] opacity-80">{preset.subtitle}</span>
              </button>
            );
          })}
        </div>
      </div>
      </StudioInspectorSection>

      <StudioInspectorSection id="aud-ambient" title="مؤثرات طبيعية هادئة">
      <div>
        <p className="text-[11px] font-medium text-[var(--ink-muted)]">
          خلفيات صوتية طبيعية هادئة (بدون موسيقى)
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {AMBIENT_SOUND_PRESETS.map((amb) => {
            const active = exportSettings.ambientSound === amb.id;
            return (
              <button
                key={amb.id}
                type="button"
                aria-pressed={active}
                onClick={() => onUpdateExportSettings({ ambientSound: amb.id })}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)] text-[#1F1705]'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                }`}
              >
                {amb.label}
              </button>
            );
          })}
        </div>

        {exportSettings.ambientSound !== 'none' && (
          <div className="mt-3.5">
            <StudioSlider
              id="st-ambient-vol"
              label="مستوى المؤثر الطبيعي"
              valueDisplay={`${Math.round(exportSettings.ambientVolume * 100)}%`}
              value={exportSettings.ambientVolume}
              min={0.05}
              max={0.45}
              step={0.01}
              onChange={(val) => onUpdateExportSettings({ ambientVolume: val })}
            />
          </div>
        )}
      </div>
      </StudioInspectorSection>

      <StudioInspectorSection id="aud-transitions" title="الانتقالات وفاصل الآيات">
      <div className="space-y-3.5">
        <div>
          <label
            htmlFor="st-transition-select"
            className="mb-1.5 block text-xs font-semibold text-[var(--ink-muted)]"
          >
            الانتقال بين الشرائح
          </label>
          <select
            id="st-transition-select"
            value={exportSettings.transition}
            onChange={(e) =>
              onUpdateExportSettings({
                transition: e.target.value as VideoExportSettings['transition'],
              })
            }
            className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)]"
          >
            {SLIDE_TRANSITION_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <StudioSlider
          id="st-verse-gap"
          label="وقفة صمت بين الآيات (الفيديو المُصدَّر)"
          valueDisplay={`${exportSettings.verseGapSec.toFixed(2)} ث`}
          value={exportSettings.verseGapSec}
          min={0}
          max={1.5}
          step={0.05}
          onChange={(val) => onUpdateExportSettings({ verseGapSec: val })}
        />

        {/* فاصل معاينة الاستوديو: مؤقّت صمت بين الآيات أثناء التشغيل داخل
            الاستوديو — مستقل عن فاصل الفيديو المُصدَّر وقابل للإلغاء فوراً */}
        <div>
          <StudioSlider
            id="st-playback-gap"
            label="فاصل بين الآيات (ث)"
            valueDisplay={`${(state.playbackGapSec ?? 0).toFixed(1)} ث`}
            value={state.playbackGapSec ?? 0}
            min={0}
            max={5}
            step={0.1}
            onChange={(val) => onPatchState({ playbackGapSec: val })}
          />
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--ink-muted)]">
            وقفة صمت اختيارية بين الآيات أثناء تشغيل المعاينة في الاستوديو — تُلغى
            فور أي إيقاف أو تنقّل يدوي، ولا تؤثر على الفيديو المُصدَّر.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenExportModal}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 px-3 py-2 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-gold)]/25"
        >
          <Video
            className="h-3.5 w-3.5 text-[var(--brand-emerald)] dark:text-[#E6C75A]"
            aria-hidden="true"
          />
          <span>فتح إعدادات الدقة وتصدير الفيديو</span>
        </button>
      </div>
      </StudioInspectorSection>

      {/* Curtain 4: Cinematic LUTs & Transitions */}
      <StudioInspectorSection
        id="aud-cinematic"
        title="فلاتر الألوان السينمائية"
        icon={<Clapperboard className="h-3.5 w-3.5" />}
      >
        <div className="space-y-3.5">
            <div>
              <label
                htmlFor="acc-aspect-select"
                className="mb-1 block text-[11px] font-semibold text-[var(--ink-muted)]"
              >
                أبعاد الفيديو
              </label>
              <select
                id="acc-aspect-select"
                value={state.aspect}
                onChange={(e) => onAspectSelect(e.target.value as AspectPresetId)}
                className="h-8 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 text-[11px] font-semibold text-[var(--ink-primary)]"
              >
                {ASPECT_PRESETS.map((ap) => (
                  <option key={ap.id} value={ap.id}>
                    {ap.ratio} ({ap.label})
                  </option>
                ))}
                <option value="custom">مخصص</option>
              </select>
            </div>

            <StudioSlider
              id="acc-transition-ms"
              label="مدة الانتقال"
              valueDisplay={`${exportSettings.transitionDurationMs}ms`}
              value={exportSettings.transitionDurationMs}
              min={200}
              max={1200}
              step={50}
              disabled={exportSettings.transition === 'none'}
              onChange={(val) =>
                onUpdateExportSettings({ transitionDurationMs: val })
              }
            />

            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-[var(--ink-muted)]">
                فلاتر الألوان (Color Grading LUTs)
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {COLOR_LUT_PRESETS.map((lut) => {
                  const active = state.colorLut === lut.id;
                  return (
                    <button
                      key={lut.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onPatchState({ colorLut: lut.id })}
                      className={`overflow-hidden rounded-lg border text-right transition-colors ${
                        active
                          ? 'border-[var(--brand-gold)] ring-1 ring-[var(--brand-gold)]'
                          : 'border-[var(--border-hairline)] hover:border-[var(--brand-gold)]/60'
                      }`}
                    >
                      <div style={{ background: lut.preview }} className="h-6 w-full" />
                      <span className="block truncate bg-[var(--surface-subtle)] px-2 py-1 text-[10px] font-bold text-[var(--ink-primary)]">
                        {lut.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
        </div>
      </StudioInspectorSection>

      {/* Curtain 5: Video Quality & Export Preset */}
      <StudioInspectorSection
        id="aud-quality"
        title="جودة الفيديو وإعدادات التصدير"
        icon={<Film className="h-3.5 w-3.5" />}
      >
        <div className="space-y-3">
            <div>
              <label
                htmlFor="acc-quality-preset"
                className="mb-1 block text-[11px] font-semibold text-[var(--ink-muted)]"
              >
                ملف الجودة الجاهز
              </label>
              <select
                id="acc-quality-preset"
                value={activeQualityPresetId}
                onChange={(e) => onSelectQualityPreset(e.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 text-[11px] font-semibold text-[var(--ink-primary)]"
              >
                {EXPORT_QUALITY_PRESETS.map((qp) => (
                  <option key={qp.id} value={qp.id}>
                    {qp.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                {EXPORT_QUALITY_PRESETS.find((p) => p.id === activeQualityPresetId)?.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[11px] font-semibold text-[var(--ink-muted)]">الدقة</p>
                <div className="grid grid-cols-3 gap-1">
                  {(['480p', '720p', '1080p'] as VideoResolutionTier[]).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => onUpdateExportSettings({ resolution: res })}
                      className={`rounded-md border py-1 text-[10px] font-bold ${
                        exportSettings.resolution === res
                          ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/18 text-[var(--ink-primary)]'
                          : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)]'
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold text-[var(--ink-muted)]">
                  الإطارات (FPS)
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {([24, 30, 60] as VideoFpsOption[]).map((fps) => (
                    <button
                      key={fps}
                      type="button"
                      onClick={() => onUpdateExportSettings({ fps })}
                      className={`rounded-md border py-1 text-[10px] font-bold tabular-nums ${
                        exportSettings.fps === fps
                          ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/18 text-[var(--ink-primary)]'
                          : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)]'
                      }`}
                    >
                      {fps}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[11px] font-semibold text-[var(--ink-muted)]">الصيغة</p>
                <div className="grid grid-cols-2 gap-1">
                  {(['mp4', 'webm'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => onUpdateExportSettings({ format: fmt })}
                      className={`rounded-md border py-1 text-[10px] font-bold uppercase ${
                        exportSettings.format === fmt
                          ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/18 text-[var(--ink-primary)]'
                          : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)]'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold text-[var(--ink-muted)]">الجودة</p>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: 'compact', label: 'خفيف' },
                      { id: 'balanced', label: 'متوازن' },
                      { id: 'high', label: 'عالي' },
                    ] as { id: VideoQualityTier; label: string }[]
                  ).map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => onUpdateExportSettings({ quality: q.id })}
                      className={`rounded-md border py-1 text-[10px] font-bold ${
                        exportSettings.quality === q.id
                          ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/18 text-[var(--ink-primary)]'
                          : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)]'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-[var(--surface-subtle)]/80 px-3 py-2 text-[11px] tabular-nums text-[var(--ink-muted)]">
              <span className="font-bold text-[var(--ink-primary)]">
                {previewTargetDims.width}×{previewTargetDims.height}
              </span>{' '}
              · {exportSettings.fps} FPS · الحجم التقريبي{' '}
              <span className="font-bold text-[var(--brand-emerald)] dark:text-[#E6C75A]">
                ~{previewEstimatedSizeMb} MB
              </span>
            </div>

            <button
              type="button"
              onClick={onOpenExportModal}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-gold)] px-3 py-2 text-xs font-bold text-[#1F1705] transition-opacity hover:opacity-95"
            >
              <Video className="h-3.5 w-3.5" aria-hidden="true" />
              <span>تصدير الفيديو ({exportSettings.format.toUpperCase()})</span>
            </button>
        </div>
      </StudioInspectorSection>
    </StudioTabPanel>
  );
}
