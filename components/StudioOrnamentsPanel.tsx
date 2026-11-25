'use client';

import React from 'react';
import {
  Check,
  Compass,
  Frame,
  Grid2x2,
  Palette,
  RotateCcw,
  Sparkles,
  Tag,
} from 'lucide-react';
import type { StudioState } from '@/lib/quran-data';
import {
  AYAH_MEDALLION_OPTIONS,
  DEFAULT_ORNAMENT_COLOR,
  ISLAMIC_CORNER_OPTIONS,
  ISLAMIC_FRAME_OPTIONS,
  ISLAMIC_PATTERN_OPTIONS,
  ORNAMENT_COLOR_PRESETS,
  SURAH_BANNER_OPTIONS,
  resolveOrnamentConfig,
  type IslamicAyahMedallionStyle,
  type IslamicCornerStyle,
  type IslamicFrameStyle,
  type IslamicPatternStyle,
  type SurahBannerStyle,
} from '@/lib/islamic-ornaments';
import { StudioSlider, StudioSwitch } from './studio-ui/StudioControls';

interface StudioOrnamentsPanelProps {
  state: StudioState;
  onPatch: (patch: Partial<StudioState>) => void;
}

const HARMONIZED_PRESETS: {
  name: string;
  patch: Partial<StudioState>;
}[] = [
  {
    name: 'مصحف المدينة',
    patch: {
      frameStyle: 'mushaf',
      goldFrame: true,
      cornerStyle: 'rub_el_hizb',
      corners: true,
      patternStyle: 'khatam8',
      patternOpacity: 0.13,
      surahBannerStyle: 'cartouche',
      ayahNumberStyle: 'rosette',
      ornamentColor: '#D4AF37',
    },
  },
  {
    name: 'محراب نبوي',
    patch: {
      frameStyle: 'mihrab',
      goldFrame: true,
      cornerStyle: 'shamsa',
      corners: true,
      patternStyle: 'girih12',
      patternOpacity: 0.12,
      surahBannerStyle: 'mihrab_crest',
      ayahNumberStyle: 'shamsa',
      ornamentColor: '#E6C75A',
    },
  },
  {
    name: 'حمراء الأندلس',
    patch: {
      frameStyle: 'andalus',
      goldFrame: true,
      cornerStyle: 'crescent_star',
      corners: true,
      patternStyle: 'khatam8',
      patternOpacity: 0.16,
      surahBannerStyle: 'cartouche',
      ayahNumberStyle: 'rub_el_hizb',
      ornamentColor: '#F2D675',
    },
  },
  {
    name: 'تذهيب عثماني',
    patch: {
      frameStyle: 'ottoman',
      goldFrame: true,
      cornerStyle: 'floral_corner',
      corners: true,
      patternStyle: 'arabesque',
      patternOpacity: 0.13,
      surahBannerStyle: 'mihrab_crest',
      ayahNumberStyle: 'ornate',
      ornamentColor: '#C98552',
    },
  },
];

export function StudioOrnamentsPanel({ state, onPatch }: StudioOrnamentsPanelProps) {
  const ornaments = resolveOrnamentConfig(state);
  const [harmonyIdx, setHarmonyIdx] = React.useState(0);

  const handleCycleHarmony = () => {
    const next = HARMONIZED_PRESETS[harmonyIdx % HARMONIZED_PRESETS.length];
    setHarmonyIdx((v) => v + 1);
    onPatch({ ...next.patch, activeTemplateId: undefined });
  };

  const handleClearOrnaments = () => {
    onPatch({
      frameStyle: 'none',
      goldFrame: false,
      cornerStyle: 'none',
      corners: false,
      patternStyle: 'none',
      patternOpacity: 0,
      surahBannerStyle: 'minimal',
      ornamentColor: DEFAULT_ORNAMENT_COLOR,
      activeTemplateId: undefined,
    });
  };

  const selectFrame = (frameStyle: IslamicFrameStyle) => {
    onPatch({
      frameStyle,
      goldFrame: frameStyle !== 'none',
      activeTemplateId: undefined,
    });
  };

  const selectCorner = (cornerStyle: IslamicCornerStyle) => {
    onPatch({
      cornerStyle,
      corners: cornerStyle !== 'none',
      activeTemplateId: undefined,
    });
  };

  const selectPattern = (patternStyle: IslamicPatternStyle) => {
    onPatch({
      patternStyle,
      patternOpacity:
        patternStyle === 'none'
          ? 0
          : ornaments.patternOpacity <= 0.01
            ? 0.14
            : ornaments.patternOpacity,
      activeTemplateId: undefined,
    });
  };

  const selectBanner = (surahBannerStyle: SurahBannerStyle) => {
    onPatch({ surahBannerStyle, activeTemplateId: undefined });
  };

  const selectAyahStyle = (ayahNumberStyle: IslamicAyahMedallionStyle) => {
    onPatch({ ayahNumberStyle, showAyahNumber: true });
  };

  return (
    <div className="space-y-5">
      {/* Quick Harmonizer Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
        <button
          type="button"
          onClick={handleCycleHarmony}
          className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--brand-emerald)] px-3 py-2 text-xs font-bold text-[#FAF7F0] transition-opacity hover:opacity-90"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#E6C75A]" aria-hidden="true" />
          <span>تنسيق زخرفي متناسق</span>
        </button>
        <button
          type="button"
          onClick={handleClearOrnaments}
          title="إزالة جميع الزخارف"
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 py-2 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)]"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>صافي</span>
        </button>
      </div>

      {/* 1. Islamic Frame Style */}
      <section aria-labelledby="ornament-frame-heading">
        <div className="mb-2 flex items-center justify-between">
          <h4
            id="ornament-frame-heading"
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink-primary)]"
          >
            <Frame className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
            <span>الإطار الإسلامي</span>
          </h4>
          <span className="text-[11px] font-medium text-[var(--ink-muted)]">
            {ISLAMIC_FRAME_OPTIONS.find((f) => f.id === ornaments.frameStyle)?.name}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ISLAMIC_FRAME_OPTIONS.map((opt) => {
            const active = ornaments.frameStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => selectFrame(opt.id)}
                className={`group flex flex-col items-start rounded-lg border p-2.5 text-right transition-colors ${
                  active
                    ? 'border-[var(--brand-gold)] bg-[var(--brand-emerald)]/10 dark:bg-[#E6C75A]/10'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 hover:border-[var(--brand-gold)]/60'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="text-xs font-bold text-[var(--ink-primary)]">
                    {opt.name}
                  </span>
                  {active && (
                    <Check
                      className="h-3.5 w-3.5 shrink-0 text-[var(--brand-gold)]"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <span className="mt-0.5 line-clamp-1 text-[10px] text-[var(--ink-muted)]">
                  {opt.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Islamic Geometric Background Pattern */}
      <section
        aria-labelledby="ornament-pattern-heading"
        className="border-t border-[var(--border-hairline)] pt-4"
      >
        <div className="mb-2 flex items-center justify-between">
          <h4
            id="ornament-pattern-heading"
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink-primary)]"
          >
            <Grid2x2 className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
            <span>النقش الهندسي الخلفي</span>
          </h4>
          <span className="text-[11px] font-medium text-[var(--ink-muted)]">
            {ISLAMIC_PATTERN_OPTIONS.find((p) => p.id === ornaments.patternStyle)?.name}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ISLAMIC_PATTERN_OPTIONS.map((opt) => {
            const active = ornaments.patternStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => selectPattern(opt.id)}
                className={`flex flex-col items-start rounded-lg border p-2 text-right transition-colors ${
                  active
                    ? 'border-[var(--brand-gold)] bg-[var(--brand-emerald)]/10 dark:bg-[#E6C75A]/10'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 hover:border-[var(--brand-gold)]/60'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="text-xs font-bold text-[var(--ink-primary)]">
                    {opt.name}
                  </span>
                  {active && (
                    <Check
                      className="h-3.5 w-3.5 shrink-0 text-[var(--brand-gold)]"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <span className="mt-0.5 line-clamp-1 text-[10px] text-[var(--ink-muted)]">
                  {opt.subtitle}
                </span>
              </button>
            );
          })}
        </div>

        {ornaments.patternStyle !== 'none' && (
          <div className="mt-3.5">
            <StudioSlider
              id="ornament-pattern-opacity"
              label="وضوح النقش الهندسي"
              valueDisplay={`${Math.round(ornaments.patternOpacity * 100)}%`}
              value={ornaments.patternOpacity}
              min={0.04}
              max={0.38}
              step={0.01}
              onChange={(val) => onPatch({ patternOpacity: val })}
              accent="gold"
            />
          </div>
        )}
      </section>

      {/* 3. Corner Illumination Style */}
      <section
        aria-labelledby="ornament-corner-heading"
        className="border-t border-[var(--border-hairline)] pt-4"
      >
        <div className="mb-2 flex items-center justify-between">
          <h4
            id="ornament-corner-heading"
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink-primary)]"
          >
            <Compass className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
            <span>زخارف الزوايا</span>
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {ISLAMIC_CORNER_OPTIONS.map((opt) => {
            const active = ornaments.cornerStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => selectCorner(opt.id)}
                className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-right text-xs font-semibold transition-colors ${
                  active
                    ? 'border-[var(--brand-gold)] bg-[var(--brand-emerald)] text-[#FAF7F0]'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 text-[var(--ink-primary)] hover:border-[var(--brand-gold)]/60'
                }`}
              >
                <span className="truncate">{opt.name}</span>
                {active && <Check className="h-3 w-3 shrink-0 text-[#E6C75A]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Surah Title Banner Style */}
      <section
        aria-labelledby="ornament-banner-heading"
        className="border-t border-[var(--border-hairline)] pt-4"
      >
        <div className="mb-2 flex items-center justify-between">
          <h4
            id="ornament-banner-heading"
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink-primary)]"
          >
            <Tag className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
            <span>خرطوشة اسم السورة</span>
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {SURAH_BANNER_OPTIONS.map((opt) => {
            const active = ornaments.surahBannerStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => selectBanner(opt.id)}
                className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-right text-xs font-semibold transition-colors ${
                  active
                    ? 'border-[var(--brand-gold)] bg-[var(--brand-emerald)] text-[#FAF7F0]'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 text-[var(--ink-primary)] hover:border-[var(--brand-gold)]/60'
                }`}
              >
                <span className="truncate">{opt.name}</span>
                {active && <Check className="h-3 w-3 shrink-0 text-[#E6C75A]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. Ayah Medallion Style */}
      <section
        aria-labelledby="ornament-ayah-heading"
        className="border-t border-[var(--border-hairline)] pt-4"
      >
        <div id="ornament-ayah-heading" className="mb-2">
          <StudioSwitch
            id="ornament-show-ayah-switch"
            label="فاصلة رقم الآية الإسلامية"
            checked={state.showAyahNumber}
            onCheckedChange={(checked) => onPatch({ showAyahNumber: checked })}
            compact
          />
        </div>
        {state.showAyahNumber && (
          <div className="grid grid-cols-2 gap-1.5">
            {AYAH_MEDALLION_OPTIONS.map((opt) => {
              const active = ornaments.ayahNumberStyle === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectAyahStyle(opt.id)}
                  className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-right text-xs font-semibold transition-colors ${
                    active
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-emerald)] text-[#FAF7F0]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 text-[var(--ink-primary)] hover:border-[var(--brand-gold)]/60'
                  }`}
                >
                  <span className="truncate">{opt.name}</span>
                  {active && <Check className="h-3 w-3 shrink-0 text-[#E6C75A]" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 6. Ornament Metallic Color */}
      <section
        aria-labelledby="ornament-color-heading"
        className="border-t border-[var(--border-hairline)] pt-4"
      >
        <div className="mb-2 flex items-center justify-between">
          <h4
            id="ornament-color-heading"
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink-primary)]"
          >
            <Palette className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
            <span>لون التذهيب والزخارف</span>
          </h4>
          <span className="font-mono text-[11px] text-[var(--ink-muted)]">
            {ornaments.ornamentColor.toUpperCase()}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ORNAMENT_COLOR_PRESETS.map((preset) => {
            const active =
              ornaments.ornamentColor.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.name}
                aria-label={preset.name}
                aria-pressed={active}
                onClick={() => onPatch({ ornamentColor: preset.hex })}
                className={`h-8 w-8 rounded-lg border-2 transition-transform hover:scale-105 ${
                  active
                    ? 'scale-105 border-[var(--ink-primary)] ring-2 ring-[var(--brand-gold)]/50'
                    : 'border-[var(--border-hairline)]'
                }`}
                style={{
                  background: `linear-gradient(135deg, ${preset.hex}, ${preset.secondaryHex})`,
                }}
              />
            );
          })}
          <label
            title="اختيار لون مخصص"
            className="grid h-8 w-8 cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed border-[var(--border-hairline)] bg-[var(--surface-subtle)]"
          >
            <span className="sr-only">لون مخصص للزخارف</span>
            <input
              type="color"
              value={ornaments.ornamentColor}
              onChange={(e) => onPatch({ ornamentColor: e.target.value })}
              className="h-10 w-10 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
