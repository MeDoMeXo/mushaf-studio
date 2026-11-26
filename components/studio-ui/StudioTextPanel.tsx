'use client';

/**
 * StudioTextPanel — typography, colors, labels, layers, watermark.
 * Extracted from StudioDesignInspector (600-line rule): pure props-in panel.
 */
import React from 'react';
import {
  STUDIO_FONTS,
  STUDIO_TEXT_COLORS,
  type AyahNumberStyle,
  type LabelPosition,
  type StudioState,
} from '@/lib/quran-data';
import { AYAH_MEDALLION_OPTIONS } from '@/lib/islamic-ornaments';
import { StudioSlider, StudioSwitch } from './StudioControls';
import { StudioTabPanel } from './StudioTabs';

const VERSE_WEIGHT_OPTIONS = [
  { value: 400, label: 'عادي' },
  { value: 700, label: 'عريض' },
] as const;

const META_WEIGHT_OPTIONS = [
  { value: 400, label: 'خفيف' },
  { value: 600, label: 'متوسط' },
  { value: 700, label: 'عريض' },
] as const;

const LABEL_POSITION_OPTIONS = [
  { value: 'top', label: 'أعلى' },
  { value: 'bottom', label: 'أسفل' },
  { value: 'hidden', label: 'مخفي' },
] as const;

export interface StudioTextPanelProps {
  state: StudioState;
  onPatchState: (patch: Partial<StudioState>) => void;
}

export function StudioTextPanel({ state, onPatchState }: StudioTextPanelProps) {
  return (
    <StudioTabPanel value="text" className="space-y-4 focus:outline-none">
      <div>
        <label
          htmlFor="st-font-select"
          className="mb-1.5 block text-xs font-semibold text-[var(--ink-muted)]"
        >
          نوع الخط القرآني
        </label>
        <select
          id="st-font-select"
          value={state.fontFamily}
          onChange={(e) => onPatchState({ fontFamily: e.target.value })}
          className="h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
        >
          {STUDIO_FONTS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-[var(--ink-muted)]">
          سماكة خط الآية
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {VERSE_WEIGHT_OPTIONS.map((wOpt) => (
            <button
              key={wOpt.value}
              type="button"
              aria-pressed={state.fontWeight === wOpt.value}
              onClick={() => onPatchState({ fontWeight: wOpt.value })}
              className={`rounded-lg border py-1.5 text-[11px] font-semibold transition-colors ${
                state.fontWeight === wOpt.value
                  ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/18 text-[var(--ink-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
              }`}
            >
              {wOpt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 border-t border-[var(--border-hairline)] pt-4">
        <StudioSlider
          id="st-font-size"
          label="حجم الخط"
          valueDisplay={`${state.fontSize}px`}
          value={state.fontSize}
          min={42}
          max={150}
          step={2}
          onChange={(val) => onPatchState({ fontSize: val })}
        />

        <StudioSlider
          id="st-line-height"
          label="تباعد الأسطر"
          valueDisplay={state.lineHeight.toFixed(2)}
          value={state.lineHeight}
          min={1.3}
          max={2.4}
          step={0.05}
          onChange={(val) => onPatchState({ lineHeight: val })}
        />

        <StudioSlider
          id="st-vertical-offset"
          label="الموضع الرأسي للنص"
          valueDisplay={`${state.verticalOffset}%`}
          value={state.verticalOffset}
          min={-20}
          max={20}
          step={1}
          onChange={(val) => onPatchState({ verticalOffset: val })}
        />

        <div>
          <p className="mb-1.5 text-xs font-semibold text-[var(--ink-muted)]">
            توزيع نص الآية
          </p>
          <div
            role="radiogroup"
            aria-label="توزيع نص الآية"
            className="grid grid-cols-2 gap-1.5"
          >
            {(
              [
                { value: 'wrap', label: 'متعدد الأسطر (تلقائي)' },
                { value: 'single', label: 'سطر واحد' },
              ] as const
            ).map((mode) => {
              const active = (state.verseLineMode || 'wrap') === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onPatchState({ verseLineMode: mode.value })}
                  className={`rounded-lg border py-2 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand-gold)] ${
                    active
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/18 text-[var(--ink-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--ink-muted)]">
            في وضع «سطر واحد» تُعرض الآية كاملة على سطر واحد مع تصغير تلقائي للخط
            حتى تتسع في العرض.
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-[var(--border-hairline)] pt-4">
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--ink-muted)]">لون النص</p>
          <div className="grid grid-cols-8 gap-1.5">
            {STUDIO_TEXT_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={`لون النص ${hex}`}
                onClick={() => onPatchState({ textColor: hex })}
                style={{ backgroundColor: hex }}
                className={`aspect-square rounded-md border transition-transform hover:scale-105 ${
                  state.textColor === hex
                    ? 'border-[var(--brand-gold)] ring-2 ring-[var(--brand-gold)]/50'
                    : 'border-[var(--border-hairline)]'
                }`}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-[var(--ink-muted)]">المحاذاة</p>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--surface-subtle)] p-1">
            {(
              [
                { id: 'right', label: 'يمين' },
                { id: 'center', label: 'وسط' },
                { id: 'left', label: 'يسار' },
              ] as const
            ).map((al) => (
              <button
                key={al.id}
                type="button"
                aria-pressed={state.align === al.id}
                onClick={() => onPatchState({ align: al.id })}
                className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  state.align === al.id
                    ? 'bg-[var(--surface-card)] text-[var(--ink-primary)] shadow-sm'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                }`}
              >
                {al.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Islamic Ayah Medallion Section */}
      <div className="space-y-2.5 border-t border-[var(--border-hairline)] pt-4">
        <StudioSwitch
          id="text-show-ayah-switch"
          label="رقم الآية بزخرفة إسلامية"
          checked={state.showAyahNumber}
          onCheckedChange={(checked) => onPatchState({ showAyahNumber: checked })}
          compact
        />
        {state.showAyahNumber && (
          <div className="grid grid-cols-2 gap-1.5">
            {AYAH_MEDALLION_OPTIONS.map((st) => (
              <button
                key={st.id}
                type="button"
                aria-pressed={state.ayahNumberStyle === st.id}
                onClick={() =>
                  onPatchState({ ayahNumberStyle: st.id as AyahNumberStyle })
                }
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                  state.ayahNumberStyle === st.id
                    ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/18 text-[var(--ink-primary)]'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                }`}
              >
                {st.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Surah & Reciter Labels Positioning */}
      <div className="space-y-3 border-t border-[var(--border-hairline)] pt-4">
        <p className="text-xs font-bold text-[var(--ink-primary)]">
          موقع وسماكة اسم السورة والقارئ
        </p>

        <div className="grid grid-cols-3 gap-1">
          {META_WEIGHT_OPTIONS.map((mw) => (
            <button
              key={mw.value}
              type="button"
              aria-pressed={state.metaFontWeight === mw.value}
              onClick={() => onPatchState({ metaFontWeight: mw.value })}
              className={`rounded-md border py-1 text-[11px] font-semibold transition-colors ${
                state.metaFontWeight === mw.value
                  ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/18 text-[var(--ink-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 text-[var(--ink-muted)]'
              }`}
            >
              {mw.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="st-surah-pos"
              className="mb-1 block text-[11px] font-semibold text-[var(--ink-muted)]"
            >
              موقع اسم السورة
            </label>
            <select
              id="st-surah-pos"
              value={state.surahPosition}
              onChange={(e) => {
                const pos = e.target.value as LabelPosition;
                onPatchState({
                  surahPosition: pos,
                  showFooter: pos !== 'hidden',
                });
              }}
              className="h-8 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 text-[11px] font-semibold text-[var(--ink-primary)]"
            >
              {LABEL_POSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="st-reciter-pos"
              className="mb-1 block text-[11px] font-semibold text-[var(--ink-muted)]"
            >
              موقع اسم القارئ
            </label>
            <select
              id="st-reciter-pos"
              value={state.reciterPosition}
              onChange={(e) => {
                const pos = e.target.value as LabelPosition;
                onPatchState({
                  reciterPosition: pos,
                  showReciterFooter: pos !== 'hidden',
                });
              }}
              className="h-8 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 text-[11px] font-semibold text-[var(--ink-primary)]"
            >
              {LABEL_POSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {state.showFooter && state.surahPosition !== 'hidden' && (
          <StudioSlider
            id="st-surah-offset-y"
            label="إزاحة رأسية لاسم السورة"
            valueDisplay={`${state.surahOffsetY}%`}
            value={state.surahOffsetY}
            min={-12}
            max={12}
            step={1}
            onChange={(val) => onPatchState({ surahOffsetY: val })}
          />
        )}

        {state.showReciterFooter && state.reciterPosition !== 'hidden' && (
          <StudioSlider
            id="st-reciter-offset-y"
            label="إزاحة رأسية لاسم القارئ"
            valueDisplay={`${state.reciterOffsetY}%`}
            value={state.reciterOffsetY}
            min={-12}
            max={12}
            step={1}
            onChange={(val) => onPatchState({ reciterOffsetY: val })}
          />
        )}
      </div>

      {/* Layer Switches (Radix Switch) */}
      <div className="space-y-0.5 border-t border-[var(--border-hairline)] pt-4">
        <p className="mb-1.5 text-xs font-bold text-[var(--ink-primary)]">
          المؤثرات وعناصر الشريحة
        </p>
        <StudioSwitch
          id="switch-hide-verses"
          label="إخفاء نص الآيات (فيديو صوتي فقط)"
          checked={state.hideVerses === true}
          onCheckedChange={(nextVal) => onPatchState({ hideVerses: nextVal })}
        />
        {state.hideVerses && (
          <p className="mb-2 rounded-lg border border-[var(--brand-gold)]/45 bg-[var(--brand-gold)]/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-[var(--ink-muted)]">
            سيظهر الفيديو النهائي بالخلفية والزخارف والتلاوة الصوتية فقط — دون نص
            الآيات (مناسب للتلاوات الخلفية والأناشيد).
          </p>
        )}
        {(
          [
            { key: 'shadow', label: 'ظل ناعم للنص' },
            { key: 'glow', label: 'توهج مضيء (Glow)' },
            { key: 'goldFrame', label: 'إطار ذهبي مزدوج' },
            { key: 'corners', label: 'زخارف إسلامية للزوايا' },
            { key: 'showFooter', label: 'إظهار اسم السورة ورقم الآية' },
            { key: 'showReciterFooter', label: 'إظهار اسم القارئ' },
            { key: 'showProgressDots', label: 'نقاط التقدّم بين الآيات' },
          ] as const
        ).map((item) => (
          <StudioSwitch
            key={item.key}
            id={`switch-${item.key}`}
            label={item.label}
            checked={state[item.key]}
            onCheckedChange={(nextVal) => {
              if (item.key === 'goldFrame') {
                onPatchState({
                  goldFrame: nextVal,
                  frameStyle: nextVal
                    ? state.frameStyle === 'none'
                      ? 'mushaf'
                      : state.frameStyle
                    : 'none',
                });
              } else if (item.key === 'corners') {
                onPatchState({
                  corners: nextVal,
                  cornerStyle: nextVal
                    ? state.cornerStyle === 'none'
                      ? 'rub_el_hizb'
                      : state.cornerStyle
                    : 'none',
                });
              } else {
                onPatchState({ [item.key]: nextVal });
              }
            }}
          />
        ))}
      </div>

      <div className="border-t border-[var(--border-hairline)] pt-4">
        <label
          htmlFor="st-watermark"
          className="mb-1.5 block text-xs font-semibold text-[var(--ink-muted)]"
        >
          العلامة المائية (اختياري)
        </label>
        <input
          id="st-watermark"
          type="text"
          value={state.watermark}
          onChange={(e) => onPatchState({ watermark: e.target.value })}
          placeholder="اسم قناتك أو موقعك..."
          className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
        />
      </div>
    </StudioTabPanel>
  );
}
