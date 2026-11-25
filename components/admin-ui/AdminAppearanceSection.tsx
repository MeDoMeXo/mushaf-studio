'use client';

/**
 * AdminAppearanceSection — brand colors + default theme mode.
 * Extracted from AdminView (600-line rule).
 */
import React from 'react';
import { motion } from 'motion/react';
import type { SiteConfig } from '@/lib/quran-data';

export interface AdminAppearanceSectionProps {
  draft: SiteConfig;
  onDraftChange: (draft: SiteConfig) => void;
  persistDraft: (next: SiteConfig, msg: string) => void;
}

export function AdminAppearanceSection({
  draft,
  onDraftChange,
  persistDraft,
}: AdminAppearanceSectionProps) {
  return (
    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5 space-y-5">
      <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
        ألوان الهوية والوضع الافتراضي
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="cfg-primary"
            className="block text-xs font-bold text-[var(--ink-muted)]"
          >
            اللون الأساسي (الزمردي)
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="cfg-primary"
              type="color"
              value={draft.primaryColor || '#0B3D2E'}
              onChange={(e) =>
                onDraftChange({ ...draft, primaryColor: e.target.value })
              }
              className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--border-hairline)] p-1"
            />
            <button
              type="button"
              onClick={() => onDraftChange({ ...draft, primaryColor: '' })}
              className="text-xs font-semibold text-[var(--ink-muted)] underline"
            >
              استعادة الافتراضي
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="cfg-accent"
            className="block text-xs font-bold text-[var(--ink-muted)]"
          >
            لون التأكيد (الذهبي)
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="cfg-accent"
              type="color"
              value={draft.accentColor || '#B88A1E'}
              onChange={(e) =>
                onDraftChange({ ...draft, accentColor: e.target.value })
              }
              className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--border-hairline)] p-1"
            />
            <button
              type="button"
              onClick={() => onDraftChange({ ...draft, accentColor: '' })}
              className="text-xs font-semibold text-[var(--ink-muted)] underline"
            >
              استعادة الافتراضي
            </button>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-[var(--ink-muted)]">
          الوضع اللوني الافتراضي
        </p>
        <div className="mt-2 inline-flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-1">
          {(
            [
              { id: 'light', label: 'الوضع النهاري (عاجي)' },
              { id: 'dark', label: 'الوضع الليلي (زمردي داكن)' },
            ] as const
          ).map((mode) => {
            const active = draft.defaultTheme === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onDraftChange({ ...draft, defaultTheme: mode.id })
                }
                className={`relative whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                  active
                    ? 'text-[var(--ink-primary)]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="admin-theme-mode"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="absolute inset-0 rounded-lg bg-[var(--surface-card)] shadow-sm ring-1 ring-[var(--brand-gold)]/55"
                  />
                )}
                <span className="relative z-10">{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => persistDraft(draft, 'تم حفظ وتطبيق المظهر')}
        className="rounded-lg bg-[var(--brand-emerald)] px-5 py-2.5 text-sm font-bold text-[#FAF7F0] hover:opacity-90"
      >
        حفظ المظهر
      </button>
    </div>
  );
}
