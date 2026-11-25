'use client';

/**
 * AdminContentSection — site identity + verse-of-day configuration.
 * Extracted from AdminView (600-line rule): owns its VOD input state and
 * calls persistDraft for saving.
 */
import React, { useState } from 'react';
import {
  VERSE_OF_DAY_CURATED,
  type SiteConfig,
} from '@/lib/quran-data';

export interface AdminContentSectionProps {
  draft: SiteConfig;
  onDraftChange: (draft: SiteConfig) => void;
  persistDraft: (next: SiteConfig, msg: string) => void;
}

export function AdminContentSection({
  draft,
  onDraftChange,
  persistDraft,
}: AdminContentSectionProps) {
  const [vodSurah, setVodSurah] = useState('2');
  const [vodAyah, setVodAyah] = useState('255');

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
        <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
          هوية الموقع
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="cfg-siteName"
              className="block text-xs font-bold text-[var(--ink-muted)]"
            >
              اسم الموقع
            </label>
            <input
              id="cfg-siteName"
              type="text"
              value={draft.siteName}
              onChange={(e) =>
                onDraftChange({ ...draft, siteName: e.target.value })
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="cfg-badge"
              className="block text-xs font-bold text-[var(--ink-muted)]"
            >
              نص شارة الواجهة
            </label>
            <input
              id="cfg-badge"
              type="text"
              value={draft.badge}
              onChange={(e) =>
                onDraftChange({ ...draft, badge: e.target.value })
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="cfg-heroTitle"
              className="block text-xs font-bold text-[var(--ink-muted)]"
            >
              عنوان الواجهة الرئيسي
            </label>
            <input
              id="cfg-heroTitle"
              type="text"
              value={draft.heroTitle}
              onChange={(e) =>
                onDraftChange({ ...draft, heroTitle: e.target.value })
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => persistDraft(draft, 'تم حفظ هوية الموقع')}
          className="mt-5 rounded-lg bg-[var(--brand-emerald)] px-5 py-2.5 text-sm font-bold text-[#FAF7F0] hover:opacity-90"
        >
          حفظ الهوية
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
        <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
          آية اليوم
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          اختر آية ثابتة للواجهة الرئيسية أو اتركها على التدوير اليومي التلقائي.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="cfg-vod-preset"
              className="block text-xs font-bold text-[var(--ink-muted)]"
            >
              اختيار سريع
            </label>
            <select
              id="cfg-vod-preset"
              value={
                draft.verseOfDay
                  ? `${draft.verseOfDay.surah}-${draft.verseOfDay.ayah}`
                  : ''
              }
              onChange={(e) => {
                if (!e.target.value) {
                  onDraftChange({ ...draft, verseOfDay: null });
                  return;
                }
                const [s, a] = e.target.value.split('-').map(Number);
                setVodSurah(String(s));
                setVodAyah(String(a));
                onDraftChange({ ...draft, verseOfDay: { surah: s, ayah: a } });
              }}
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)] focus:border-[var(--brand-gold)]"
            >
              <option value="">تدوير يومي تلقائي (١٨ آية مختارة)</option>
              {VERSE_OF_DAY_CURATED.map((v) => (
                <option key={`${v.surah}-${v.ayah}`} value={`${v.surah}-${v.ayah}`}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="cfg-vod-surah"
                className="block text-xs font-bold text-[var(--ink-muted)]"
              >
                رقم السورة
              </label>
              <input
                id="cfg-vod-surah"
                type="number"
                min={1}
                max={114}
                value={vodSurah}
                onChange={(e) => setVodSurah(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)] tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="cfg-vod-ayah"
                className="block text-xs font-bold text-[var(--ink-muted)]"
              >
                رقم الآية
              </label>
              <input
                id="cfg-vod-ayah"
                type="number"
                min={1}
                value={vodAyah}
                onChange={(e) => setVodAyah(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)] tabular-nums"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const s = Number(vodSurah);
              const a = Number(vodAyah);
              const nextVod =
                s >= 1 && s <= 114 && a >= 1 ? { surah: s, ayah: a } : null;
              persistDraft(
                { ...draft, verseOfDay: nextVod },
                'تم تحديث آية اليوم'
              );
            }}
            className="rounded-lg bg-[var(--brand-emerald)] px-4 py-2 text-sm font-bold text-[#FAF7F0] hover:opacity-90"
          >
            تثبيت الآية
          </button>
          <button
            type="button"
            onClick={() =>
              persistDraft(
                { ...draft, verseOfDay: null },
                'تم تفعيل التدوير اليومي التلقائي'
              )
            }
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-semibold text-[var(--ink-primary)] hover:border-[var(--brand-gold)]"
          >
            عودة للتدوير التلقائي
          </button>
        </div>
      </div>
    </div>
  );
}
