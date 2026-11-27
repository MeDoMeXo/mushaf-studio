'use client';

import React from 'react';
import { Check, Play, Search, Square, X } from 'lucide-react';
import type { ReciterOption } from '@/lib/quran-data';
import { toArabicDigits } from '@/lib/quran-utils';
import type { ReciterFilter } from './StudioRecitationPanel';

const STUDIO_RECITER_FILTER_TABS: { id: ReciterFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'popular', label: 'الأشهر' },
  { id: 'murattal', label: 'مرتل' },
  { id: 'mujawwad', label: 'مجود' },
  { id: 'warsh', label: 'ورش' },
  { id: 'muallim', label: 'معلم' },
];

interface StudioReciterDirectoryProps {
  selectedSlug: string;
  reciterQuery: string;
  reciterFilter: ReciterFilter;
  filteredReciters: ReciterOption[];
  previewingReciter: string | null;
  onReciterQueryChange: (q: string) => void;
  onReciterFilterChange: (filter: ReciterFilter) => void;
  onSelectReciter: (slug: string) => void;
  onPreviewReciter: (slug: string) => void;
}

export function StudioReciterDirectory({
  selectedSlug,
  reciterQuery,
  reciterFilter,
  filteredReciters,
  previewingReciter,
  onReciterQueryChange,
  onReciterFilterChange,
  onSelectReciter,
  onPreviewReciter,
}: StudioReciterDirectoryProps) {
  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search
          className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-muted)]"
          aria-hidden="true"
        />
        <input
          type="text"
          value={reciterQuery}
          onChange={(e) => onReciterQueryChange(e.target.value)}
          placeholder="ابحث باسم القارئ..."
          aria-label="بحث عن قارئ"
          className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] pl-7 pr-8 text-xs text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--brand-gold)] focus:outline-none"
        />
        {reciterQuery && (
          <button
            type="button"
            onClick={() => onReciterQueryChange('')}
            aria-label="مسح البحث"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Filter Tabs — responsive across mobile, tablet & desktop rails */}
      <div
        role="group"
        aria-label="تصفية القرّاء حسب الأسلوب"
        className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--border-hairline)]/60 bg-[var(--surface-subtle)] p-1 sm:grid-cols-6 xl:grid-cols-3"
      >
        {STUDIO_RECITER_FILTER_TABS.map((rf) => (
          <button
            key={rf.id}
            type="button"
            aria-pressed={reciterFilter === rf.id}
            onClick={() => onReciterFilterChange(rf.id)}
            className={`min-h-[30px] whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
              reciterFilter === rf.id
                ? 'bg-[var(--brand-gold)] text-[#1F1705] shadow-xs'
                : 'text-[var(--ink-muted)] hover:bg-[var(--surface-card)]/60 hover:text-[var(--ink-primary)]'
            }`}
          >
            {rf.label}
          </button>
        ))}
      </div>

      {/* Reciters List */}
      <div className="studio-scroll max-h-[260px] divide-y divide-[var(--border-hairline)]/60 overflow-y-auto rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/35 sm:max-h-[300px]">
        {filteredReciters.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--ink-muted)]">
            لا يوجد قارئ مطابق للبحث
          </div>
        ) : (
          filteredReciters.map((r) => {
            const selected = selectedSlug === r.slug;
            const isPrev = previewingReciter === r.slug;
            return (
              <div
                key={r.slug}
                className={`flex items-center justify-between gap-2 px-3 py-2 transition-colors ${
                  selected
                    ? 'bg-[var(--brand-gold)]/12'
                    : 'hover:bg-[var(--surface-subtle)]/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectReciter(r.slug)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-right"
                >
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors ${
                      selected
                        ? 'border-[var(--brand-emerald)] bg-[var(--brand-emerald)] text-[#FAF7F0] dark:border-[var(--brand-gold)] dark:bg-[var(--brand-gold)] dark:text-[#1F1705]'
                        : 'border-[var(--border-hairline)]'
                    }`}
                  >
                    {selected && <Check className="h-2.5 w-2.5" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-[var(--ink-primary)]">
                      {r.name}
                    </span>
                    <span className="block text-[10px] text-[var(--ink-muted)]">
                      {r.styleLabel} · {toArabicDigits(r.bitrate)}kbps ·{' '}
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        متزامن ⚡
                      </span>
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onPreviewReciter(r.slug)}
                  aria-label={isPrev ? `إيقاف عينة ${r.name}` : `سماع عينة ${r.name}`}
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors ${
                    isPrev
                      ? 'bg-[var(--brand-gold)] text-[#1F1705]'
                      : 'bg-[var(--surface-card)] text-[var(--ink-muted)] hover:bg-[var(--brand-emerald)] hover:text-[#FAF7F0]'
                  }`}
                >
                  {isPrev ? (
                    <Square className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Play className="h-3 w-3" aria-hidden="true" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
