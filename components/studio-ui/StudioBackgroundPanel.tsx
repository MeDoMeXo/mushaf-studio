'use client';

/**
 * StudioBackgroundPanel — background type/asset pickers, ambience, overlay.
 * Extracted from StudioDesignInspector (600-line rule).
 */
import React from 'react';
import { Film, Library, Pause, Play, Upload } from 'lucide-react';
import { BUILTIN_BG_LIBRARY, type BuiltinBackground } from '@/lib/background-library';
import {
  STUDIO_GRADIENTS,
  STUDIO_SOLIDS,
  type AmbientEffect,
  type StudioState,
} from '@/lib/quran-data';
import { StudioSlider } from './StudioControls';
import { StudioTabPanel } from './StudioTabs';
import { StudioInspectorSection } from './StudioInspectorSection';

export interface StudioBackgroundPanelProps {
  state: StudioState;
  bgVideoUrl: string | null;
  bgVideoFile: File | null;
  bgVideoName: string;
  bgVideoReady: boolean;
  bgVideoPlaying: boolean;
  bgFileInputRef: React.RefObject<HTMLInputElement | null>;
  bgVideoFileInputRef: React.RefObject<HTMLInputElement | null>;
  onPatchState: (patch: Partial<StudioState>) => void;
  onBgFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBgVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleBgVideoPlaying: () => void;
  onRemoveBgVideo: () => void;
  onSelectBgLibrary: (bg: BuiltinBackground) => void;
}

export function StudioBackgroundPanel({
  state,
  bgVideoUrl,
  bgVideoFile,
  bgVideoName,
  bgVideoReady,
  bgVideoPlaying,
  bgFileInputRef,
  bgVideoFileInputRef,
  onPatchState,
  onBgFileUpload,
  onBgVideoUpload,
  onToggleBgVideoPlaying,
  onRemoveBgVideo,
  onSelectBgLibrary,
}: StudioBackgroundPanelProps) {
  return (
    <StudioTabPanel value="background" className="space-y-2.5 focus:outline-none">
      <StudioInspectorSection id="bg-source" title="نوع الخلفية ومصدرها">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--surface-subtle)] p-1 sm:grid-cols-4">
        {(
          [
            { id: 'gradient', label: 'تدرّج' },
            { id: 'solid', label: 'لون ثابت' },
            { id: 'image', label: 'صورة' },
            { id: 'video', label: 'فيديو متحرك' },
          ] as const
        ).map((bt) => (
          <button
            key={bt.id}
            type="button"
            aria-pressed={state.bgType === bt.id}
            onClick={() => onPatchState({ bgType: bt.id })}
            className={`whitespace-nowrap rounded-md py-1.5 text-xs font-semibold transition-colors ${
              state.bgType === bt.id
                ? 'bg-[var(--brand-emerald)] text-[#FAF7F0] dark:bg-[var(--brand-gold)] dark:text-[#1F1705]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
            }`}
          >
            {bt.label}
          </button>
        ))}
      </div>

      {state.bgType === 'gradient' && (
        <div className="grid grid-cols-4 gap-2">
          {STUDIO_GRADIENTS.map((g) => (
            <button
              key={g.id}
              type="button"
              title={g.name}
              aria-label={`خلفية ${g.name}`}
              onClick={() => onPatchState({ bgIdx: g.id })}
              style={{
                background: `linear-gradient(${g.angle}deg, ${g.stops.map((s) => s[1]).join(', ')})`,
              }}
              className={`aspect-[4/3] rounded-lg border-2 transition-transform hover:scale-105 ${
                state.bgIdx === g.id
                  ? 'border-[var(--brand-gold)] ring-2 ring-[var(--brand-gold)]/40'
                  : 'border-transparent'
              }`}
            />
          ))}
        </div>
      )}

      {state.bgType === 'solid' && (
        <div className="grid grid-cols-6 gap-2">
          {STUDIO_SOLIDS.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={`لون خلفية ${hex}`}
              onClick={() => onPatchState({ bgColor: hex })}
              style={{ backgroundColor: hex }}
              className={`aspect-square rounded-lg border-2 transition-transform hover:scale-105 ${
                state.bgColor === hex
                  ? 'border-[var(--brand-gold)] ring-2 ring-[var(--brand-gold)]/40'
                  : 'border-[var(--border-hairline)]'
              }`}
            />
          ))}
        </div>
      )}

      {state.bgType === 'image' && (
        <div>
          <button
            type="button"
            onClick={() => bgFileInputRef.current?.click()}
            className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border-hairline)] bg-[var(--surface-subtle)]/70 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)]"
          >
            <Upload className="h-4 w-4 text-[var(--brand-gold)]" aria-hidden="true" />
            <span>اختر صورة من جهازك</span>
          </button>
          <input
            ref={bgFileInputRef}
            type="file"
            accept="image/*"
            onChange={onBgFileUpload}
            className="hidden"
          />
          {state.bgImage && (
            <button
              type="button"
              onClick={() => onPatchState({ bgImage: null })}
              className="mt-2 text-xs font-semibold text-red-600 underline dark:text-red-400"
            >
              إزالة الصورة
            </button>
          )}
        </div>
      )}

      {state.bgType === 'video' && (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--ink-muted)]">
              <Library className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
              مكتبة الخلفيات الجاهزة
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {BUILTIN_BG_LIBRARY.map((bg) => {
                const active = state.bgLibraryId === bg.id && !bgVideoFile;
                return (
                  <button
                    key={bg.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectBgLibrary(bg)}
                    className={`group relative overflow-hidden rounded-lg border text-right transition-transform hover:scale-[1.03] ${
                      active
                        ? 'border-[var(--brand-gold)] ring-2 ring-[var(--brand-gold)]/40'
                        : 'border-[var(--border-hairline)]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="block aspect-[9/14] w-full"
                      style={{
                        background: `linear-gradient(160deg, ${bg.posterColors[0]}, ${bg.posterColors[1]})`,
                      }}
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5 text-[9px] font-bold leading-tight text-white">
                      {bg.name}
                    </span>
                    {bg.category === 'islamic' && (
                      <span className="absolute right-1 top-1 rounded-full bg-[var(--brand-gold)]/90 px-1.5 py-px text-[8px] font-bold text-[#1F1705]">
                        إسلامي
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => bgVideoFileInputRef.current?.click()}
            className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border-hairline)] bg-[var(--surface-subtle)]/70 px-3 text-center text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)]"
          >
            <Film className="h-5 w-5 text-[var(--brand-gold)]" aria-hidden="true" />
            <span>
              {bgVideoFile
                ? 'تغيير الفيديو المتحرك للخلفية'
                : state.bgLibraryId
                  ? 'تم اختيار خلفية من المكتبة — أو ارفع فيديو خاصاً'
                  : 'اختر فيديو متحرك (MP4 / WebM / MOV)'}
            </span>
            <span className="text-[10px] font-normal opacity-80">
              يُكرّر تلقائياً بدون صوت خلف الآيات عند المعاينة والتصدير
            </span>
          </button>
          <input
            ref={bgVideoFileInputRef}
            type="file"
            accept="video/*"
            data-testid="bg-video-input"
            onChange={onBgVideoUpload}
            className="hidden"
          />

          {bgVideoUrl && (
            <div className="space-y-2.5 rounded-xl border border-[var(--brand-gold)]/35 bg-[var(--surface-subtle)]/65 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[var(--ink-primary)]">
                    {bgVideoName}
                  </p>
                  <p className="text-[10px] text-[var(--ink-muted)]">
                    {bgVideoReady
                      ? 'جاهز للعرض والتصدير بحركة متواصلة'
                      : 'جارٍ تجهيز معاينة الفيديو...'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggleBgVideoPlaying}
                  aria-label={
                    bgVideoPlaying ? 'إيقاف حركة الخلفية مؤقتاً' : 'تشغيل حركة الخلفية'
                  }
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--ink-primary)] hover:border-[var(--brand-gold)]"
                >
                  {bgVideoPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>إيقاف</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>تشغيل</span>
                    </>
                  )}
                </button>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                  سرعة حركة الفيديو الخلفي
                </p>
                <div className="mt-1 grid grid-cols-4 gap-1">
                  {([0.5, 0.75, 1, 1.5] as const).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => onPatchState({ bgVideoSpeed: spd })}
                      className={`rounded-md border py-1 text-[11px] font-bold tabular-nums transition-colors ${
                        state.bgVideoSpeed === spd
                          ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/20 text-[var(--ink-primary)]'
                          : 'border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-muted)]'
                      }`}
                    >
                      {spd}×
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={onRemoveBgVideo}
                className="text-xs font-semibold text-red-600 underline dark:text-red-400"
              >
                إزالة الفيديو المتحرك
              </button>
            </div>
          )}
        </div>
      )}
      </StudioInspectorSection>

      <StudioInspectorSection id="bg-ambient" title="حركة الخلفية والمؤثرات">
      <div>
        <p className="text-[11px] font-medium text-[var(--ink-muted)]">
          تظهر الحركة أثناء التشغيل وفي الفيديو المُصدَّر
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {(
            [
              { id: 'none', label: 'ساكن' },
              { id: 'stars', label: 'نجوم متلألئة' },
              { id: 'gold-dust', label: 'غبار ذهبي' },
              { id: 'aurora', label: 'شفق ناعم' },
              { id: 'fireflies', label: 'يراعات' },
              { id: 'petals', label: 'بتلات' },
              { id: 'bokeh', label: 'بوكيه' },
              { id: 'rain', label: 'مطر' },
              { id: 'snow', label: 'ثلج' },
            ] as { id: AmbientEffect; label: string }[]
          ).map((amb) => (
            <button
              key={amb.id}
              type="button"
              aria-pressed={state.ambient === amb.id}
              onClick={() => onPatchState({ ambient: amb.id })}
              className={`rounded-lg border py-1.5 text-xs font-semibold transition-colors ${
                state.ambient === amb.id
                  ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--ink-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
              }`}
            >
              {amb.label}
            </button>
          ))}
        </div>
      </div>
      </StudioInspectorSection>

      <StudioInspectorSection id="bg-adjust" title="تعتيم وتظليل وضبابية الخلفية">
      <div className="space-y-3.5">
        <StudioSlider
          id="st-overlay"
          label="تعتيم الخلفية"
          valueDisplay={`${Math.round(state.overlay * 100)}%`}
          value={state.overlay}
          min={0}
          max={0.75}
          step={0.05}
          onChange={(val) => onPatchState({ overlay: val })}
        />

        <StudioSlider
          id="st-vignette"
          label="تظليل الحواف (Vignette)"
          valueDisplay={`${Math.round(state.vignette * 100)}%`}
          value={state.vignette}
          min={0}
          max={0.7}
          step={0.05}
          onChange={(val) => onPatchState({ vignette: val })}
        />

        <StudioSlider
          id="st-bg-blur"
          label="ضبابية الخلفية (Blur)"
          valueDisplay={`${state.bgBlur}px`}
          value={state.bgBlur}
          min={0}
          max={18}
          step={1}
          onChange={(val) => onPatchState({ bgBlur: val })}
        />
      </div>
      </StudioInspectorSection>
    </StudioTabPanel>
  );
}
