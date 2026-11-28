'use client';

/**
 * StudioWordTrackSection — قسم تتبّع الكلمة المتلوة (كاريوكي) مع معايرة
 * المزامنة اليدوية (wordSyncOffsetMs). مستخرج من StudioTextPanel التزاماً
 * بقاعدة ٦٠٠ سطر: يضم مفتاح التشغيل وأشكال التظليل ولونه وعتابته
 * ومنزلق المعايرة مع زر التصفير.
 */
import React from 'react';
import { RotateCcw } from 'lucide-react';
import { type StudioState, type WordHighlightStyle } from '@/lib/quran-data';
import { VERSE_HIGHLIGHT_COLORS } from '@/lib/verse-highlight';
import { toArabicDigits } from '@/lib/quran-utils';
import { StudioSlider, StudioSwitch } from './StudioControls';

interface StudioWordTrackSectionProps {
  state: StudioState;
  onPatchState: (patch: Partial<StudioState>) => void;
}

export function StudioWordTrackSection({ state, onPatchState }: StudioWordTrackSectionProps) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-[var(--ink-muted)]">
        يتلوّن/يتظلّل لفظ الآية أثناء نطقه بالتزامن مع الصوت — دون تغيير لون
        النص الأساسي للآيات.
      </p>
      <StudioSwitch
        id="switch-word-highlight"
        label="تشغيل التتبّع مع التلاوة"
        checked={state.wordHighlight === true}
        onCheckedChange={(nextVal) => onPatchState({ wordHighlight: nextVal })}
      />
      {state.wordHighlight === true && (
        <>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--ink-muted)]">شكل التظليل</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { value: 'block', label: 'تظليل خلف الكلمة' },
                  { value: 'underline', label: 'خط أسفل الكلمة' },
                  { value: 'tint', label: 'تلوين الكلمة' },
                ] as const
              ).map((st) => {
                const active = (state.wordHighlightStyle || 'block') === st.value;
                return (
                  <button
                    key={st.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onPatchState({ wordHighlightStyle: st.value as WordHighlightStyle })}
                    className={`rounded-lg border py-2 text-[11px] font-semibold transition-colors ${
                      active
                        ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/18 text-[var(--ink-primary)]'
                        : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--ink-muted)]">لون التظليل</p>
            <div className="grid grid-cols-7 gap-1.5">
              {VERSE_HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={`لون التظليل ${c.label}`}
                  onClick={() => onPatchState({ wordHighlightColor: c.hex })}
                  style={{ backgroundColor: c.hex }}
                  className={`aspect-square rounded-md border transition-transform hover:scale-105 ${
                    (state.wordHighlightColor || '#C9A227') === c.hex
                      ? 'border-[var(--brand-gold)] ring-2 ring-[var(--brand-gold)]/50'
                      : 'border-[var(--border-hairline)]'
                  }`}
                />
              ))}
            </div>
          </div>

          {(state.wordHighlightStyle || 'block') !== 'tint' && (
            <StudioSlider
              id="st-word-highlight-opacity"
              label="قوة التظليل"
              valueDisplay={`${Math.round((state.wordHighlightOpacity ?? 0.35) * 100)}%`}
              value={Math.round((state.wordHighlightOpacity ?? 0.35) * 100)}
              min={15}
              max={85}
              step={5}
              onChange={(val) => onPatchState({ wordHighlightOpacity: val / 100 })}
            />
          )}

          {/* معايرة مزامنة التتبع: إن تقدّم التظليل أو تأخّر عن الصوت أزحه يدوياً */}
          <div>
            <StudioSlider
              id="st-word-sync-offset"
              label="معايرة مزامنة التتبع (مل-ث)"
              valueDisplay={`${toArabicDigits(state.wordSyncOffsetMs ?? 0)} مل-ث`}
              value={state.wordSyncOffsetMs ?? 0}
              min={-1000}
              max={1000}
              step={10}
              onChange={(val) => onPatchState({ wordSyncOffsetMs: val })}
            />
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="text-[10px] leading-relaxed text-[var(--ink-muted)]">
                {state.wordSyncOffsetMs && state.wordSyncOffsetMs > 0
                  ? 'يتقدّم التظليل على الصوت — القيمة الموجبة تعجّله.'
                  : state.wordSyncOffsetMs && state.wordSyncOffsetMs < 0
                    ? 'يتأخّر التظليل عن الصوت — القيمة السالبة تؤخّره.'
                    : 'إن سبق التظليل الصوت أو تأخّر عنه، أزح المعايرة حتى يطابق النطق.'}
              </p>
              <button
                type="button"
                onClick={() => onPatchState({ wordSyncOffsetMs: 0 })}
                disabled={(state.wordSyncOffsetMs ?? 0) === 0}
                aria-label="تصفير معايرة مزامنة التتبع"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 py-1 text-[10px] font-bold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink-primary)] disabled:opacity-40"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>تصفير</span>
              </button>
            </div>
          </div>

          <p className="rounded-lg border border-[var(--brand-gold)]/45 bg-[var(--brand-gold)]/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-[var(--ink-muted)]">
            التتبّع يعمل أثناء تشغيل المعاينة، وفي الفيديو المُصدّر تُولّد شرائح
            كلمة-بكلمة متزامنة مع مدة كل لظة — والباقي يبقى بلون النص الأصلي.
            المدد الطويلة جداً تُخفَّض تلقائياً إلى تتبّع عبارة-بعبارة كي لا
            يختفي التظليل من التصدير.
          </p>
        </>
      )}
    </div>
  );
}
