'use client';

/**
 * AdminReadingSection — reading/recitation defaults + active reciters table.
 * Extracted from AdminView (600-line rule): fully derived from draft.
 */
import React from 'react';
import { RECITERS, TRANSLATIONS, type SiteConfig } from '@/lib/quran-data';
import { getActiveReciters } from '@/lib/reciter-filter';
import { toArabicDigits } from '@/lib/quran-utils';
import { StudioSlider, StudioSwitch } from '../studio-ui/StudioControls';

export interface AdminReadingSectionProps {
  draft: SiteConfig;
  onDraftChange: (draft: SiteConfig) => void;
  persistDraft: (next: SiteConfig, msg: string) => void;
}

export function AdminReadingSection({
  draft,
  onDraftChange,
  persistDraft,
}: AdminReadingSectionProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
        <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
          افتراضيات القراءة والتلاوة
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="cfg-trans"
              className="block text-xs font-bold text-[var(--ink-muted)]"
            >
              الترجمة الافتراضية
            </label>
            <select
              id="cfg-trans"
              value={draft.defaultTranslation}
              onChange={(e) =>
                onDraftChange({
                  ...draft,
                  defaultTranslation: Number(e.target.value),
                })
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)]"
            >
              {TRANSLATIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="cfg-reciter"
              className="block text-xs font-bold text-[var(--ink-muted)]"
            >
              القارئ الافتراضي
            </label>
            <select
              id="cfg-reciter"
              value={draft.defaultReciter}
              onChange={(e) =>
                onDraftChange({ ...draft, defaultReciter: e.target.value })
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)]"
            >
              {getActiveReciters(draft.customReciters, draft.disabledReciters).map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name} ({r.styleLabel})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-center">
            <StudioSlider
              id="cfg-vsize"
              label="حجم خط الآيات الافتراضي"
              valueDisplay={`${draft.defaultVsize.toFixed(2)} rem`}
              min={1.25}
              max={2.8}
              step={0.05}
              value={draft.defaultVsize}
              onChange={(val) =>
                onDraftChange({
                  ...draft,
                  defaultVsize: val,
                })
              }
            />
          </div>

          <div className="self-end">
            <StudioSwitch
              id="cfg-show-trans"
              label="إظهار الترجمة افتراضياً في القارئ"
              checked={draft.defaultShowTrans}
              onCheckedChange={(checked) =>
                onDraftChange({
                  ...draft,
                  defaultShowTrans: checked,
                })
              }
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            persistDraft(draft, 'تم حفظ افتراضيات القراءة والاستماع')
          }
          className="mt-5 rounded-lg bg-[var(--brand-emerald)] px-5 py-2.5 text-sm font-bold text-[#FAF7F0] hover:opacity-90"
        >
          حفظ الافتراضيات
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
        <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
          القراء النشطون ومصادر البيانات ({toArabicDigits(RECITERS.length)} قارئاً)
        </h2>
        <div className="studio-scroll mt-3 max-h-[380px] overflow-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--ink-muted)]">
                <th className="py-2 font-semibold">القارئ</th>
                <th className="py-2 font-semibold">الأسلوب</th>
                <th className="py-2 font-semibold">الجودة</th>
                <th className="py-2 font-semibold">المعرّف</th>
              </tr>
            </thead>
            <tbody>
              {RECITERS.map((r) => (
                <tr
                  key={r.slug}
                  className="border-b border-[var(--border-hairline)] last:border-none"
                >
                  <td className="py-2 font-semibold text-[var(--ink-primary)]">
                    {r.name}
                  </td>
                  <td className="py-2 text-xs text-[var(--ink-muted)]">
                    {r.styleLabel}
                  </td>
                  <td className="py-2 text-xs tabular-nums text-[var(--brand-emerald)] dark:text-[#E6C75A]">
                    {r.bitrate}kbps
                  </td>
                  <td className="py-2 font-mono text-xs text-[var(--ink-muted)]">
                    {r.slug}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
