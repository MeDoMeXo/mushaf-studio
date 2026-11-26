'use client';

import React, { useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion } from 'motion/react';
import {
  Check,
  Headphones,
  Play,
  Search,
  Star,
  X,
} from 'lucide-react';
import { RECITERS, type ReciterOption } from '@/lib/quran-data';
import { toArabicDigits } from '@/lib/quran-utils';
import {
  filterAndSortReciters,
  RECITER_FILTER_TABS,
  resolveReciterOption,
  type ReciterFilterTab,
} from '@/lib/reciter-filter';
import { StudioTooltip } from './studio-ui/StudioControls';
import {
  StudioTabsList,
  StudioTabsRoot,
  StudioTabTrigger,
} from './studio-ui/StudioTabs';

const RECITER_PICKER_TAB_VALUES = RECITER_FILTER_TABS.map((t) => t.id);

interface ReciterPickerModalProps {
  open: boolean;
  onClose: () => void;
  selectedReciterSlug: string;
  favoriteReciters: string[];
  /** Active verse-by-verse reciters (built-ins + customs, minus disabled). */
  reciters: ReciterOption[];
  onSelectReciter: (slug: string) => void;
  onToggleFavorite: (slug: string) => void;
  onPlayWithReciter?: (slug: string) => void;
  activeSurahName?: string;
}

export function ReciterPickerModal({
  open,
  onClose,
  selectedReciterSlug,
  favoriteReciters,
  reciters,
  onSelectReciter,
  onToggleFavorite,
  onPlayWithReciter,
  activeSurahName,
}: ReciterPickerModalProps) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<ReciterFilterTab>('all');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedReciter = useMemo(
    () => resolveReciterOption(selectedReciterSlug, reciters),
    [selectedReciterSlug, reciters]
  );

  const favoriteSet = useMemo(() => new Set(favoriteReciters), [favoriteReciters]);

  const filteredReciters = useMemo(
    () =>
      filterAndSortReciters(reciters, {
        query,
        tab,
        favoriteSlugs: favoriteReciters,
      }),
    [query, tab, favoriteReciters, reciters]
  );

  const handleChoose = (reciter: ReciterOption) => {
    onSelectReciter(reciter.slug);
    onClose();
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          dir="rtl"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            searchInputRef.current?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[94vw] max-w-[680px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] shadow-2xl focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-hairline)] px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-gold)]/18 text-[var(--brand-emerald)] dark:text-[#E6C75A]">
                <Headphones className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <DialogPrimitive.Title className="font-display text-base font-bold text-[var(--ink-primary)] sm:text-lg">
                  اختيار القارئ والمصحف المرتل
                </DialogPrimitive.Title>
                <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                  {toArabicDigits(reciters.length)} قارئاً متاحاً للمزامنة آية بآية · النشط:{' '}
                  <span className="font-semibold text-[var(--brand-emerald)] dark:text-[#E6C75A]">
                    {selectedReciter.name}
                  </span>
                </p>
              </div>
            </div>

            <DialogPrimitive.Close
              aria-label="إغلاق قائمة القراء"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink-primary)] focus-visible:outline-2 focus-visible:outline-[var(--brand-gold)]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          {/* Search & Radix Style Tabs */}
          <div className="space-y-3 border-b border-[var(--border-hairline)] bg-[var(--surface-subtle)]/55 px-5 py-3.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث باسم القارئ أو البلد أو الرواية (مثل: الحصري، الدوسري، ورش، مصر)..."
                aria-label="البحث عن قارئ"
                className="h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] pr-9 pl-9 text-xs font-medium text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--brand-gold)] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="مسح البحث"
                  className="absolute left-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <StudioTabsRoot
              idPrefix="reciter-picker-filter"
              dir="rtl"
              value={tab}
              tabValues={RECITER_PICKER_TAB_VALUES}
              onValueChange={setTab}
            >
              <StudioTabsList
                aria-label="تصفية القراء حسب الرواية والأسلوب"
                className="flex flex-wrap items-center gap-1 rounded-lg bg-[var(--surface-card)]/70 p-1 ring-1 ring-[var(--border-hairline)]"
              >
                {RECITER_FILTER_TABS.map((t) => {
                  const active = tab === t.id;
                  const label =
                    t.id === 'favorites' && favoriteReciters.length > 0
                      ? `${t.label} (${toArabicDigits(favoriteReciters.length)})`
                      : t.label;
                  return (
                    <StudioTabTrigger
                      key={t.id}
                      value={t.id}
                      className={`relative whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand-gold)] ${
                        active
                          ? 'text-[#FAF7F0]'
                          : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="reciter-picker-tab-indicator"
                          transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                          className="absolute inset-0 rounded-md bg-[var(--brand-emerald)] shadow-sm"
                        />
                      )}
                      <span className="relative z-10">{label}</span>
                    </StudioTabTrigger>
                  );
                })}
              </StudioTabsList>
            </StudioTabsRoot>
          </div>

          {/* Reciters List */}
          <div
            data-testid="reciter-picker-list"
            className="studio-scroll flex-1 divide-y divide-[var(--border-hairline)] overflow-y-auto"
          >
            {filteredReciters.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Headphones
                  className="mx-auto h-8 w-8 text-[var(--ink-muted)]/60"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-semibold text-[var(--ink-primary)]">
                  {tab === 'favorites'
                    ? 'لا يوجد قراء في قائمتك المفضلة بعد'
                    : 'لم يتم العثور على قارئ مطابق للبحث'}
                </p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  {tab === 'favorites'
                    ? 'اضغط على أيقونة النجمة بجانب أي قارئ لتثبيته هنا للوصول السريع.'
                    : 'جرّب البحث بجزء من اسم القارئ أو انتقل إلى تبويب «الكل».'}
                </p>
              </div>
            ) : (
              filteredReciters.map((reciter) => {
                const isSelected = reciter.slug === selectedReciter.slug;
                const isFav = favoriteSet.has(reciter.slug);

                return (
                  <div
                    key={reciter.slug}
                    data-testid={`reciter-row-${reciter.slug}`}
                    data-selected={isSelected ? 'true' : 'false'}
                    className={`flex items-center justify-between gap-3 px-5 py-3 transition-colors ${
                      isSelected
                        ? 'bg-[var(--brand-gold)]/12'
                        : 'hover:bg-[var(--surface-subtle)]/75'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleChoose(reciter)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-right focus-visible:outline-2 focus-visible:outline-[var(--brand-gold)]"
                    >
                      <span
                        aria-hidden="true"
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-[var(--brand-emerald)] bg-[var(--brand-emerald)] text-[#FAF7F0]'
                            : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)]'
                        }`}
                      >
                        {isSelected ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Headphones className="h-4 w-4" />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-[var(--ink-primary)]">
                          {reciter.name}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-muted)] tabular-nums">
                          <span>{reciter.styleLabel}</span>
                          {reciter.country && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{reciter.country}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>{reciter.bitrate}kbps</span>
                          {isSelected && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-[var(--brand-emerald)] dark:text-[#E6C75A]">
                                القارئ النشط
                              </span>
                            </>
                          )}
                        </span>
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {onPlayWithReciter && (
                        <StudioTooltip
                          content={`تشغيل ${activeSurahName ? `سورة ${activeSurahName}` : 'التلاوة'} بصوت ${reciter.name}`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onPlayWithReciter(reciter.slug);
                              onClose();
                            }}
                            aria-label={`تشغيل ${activeSurahName ? `سورة ${activeSurahName}` : 'التلاوة'} بصوت ${reciter.name}`}
                            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-emerald)] hover:bg-[var(--brand-emerald)] hover:text-[#FAF7F0] focus-visible:outline-2 focus-visible:outline-[var(--brand-gold)]"
                          >
                            <Play className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">استماع</span>
                          </button>
                        </StudioTooltip>
                      )}

                      <StudioTooltip
                        content={isFav ? 'إزالة من المفضلة' : 'تثبيت في المفضلة'}
                      >
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(reciter.slug)}
                          aria-pressed={isFav}
                          aria-label={
                            isFav
                              ? `إزالة ${reciter.name} من المفضلة`
                              : `إضافة ${reciter.name} إلى المفضلة`
                          }
                          className={`grid h-9 w-9 place-items-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand-gold)] ${
                            isFav
                              ? 'border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]'
                              : 'border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-muted)] hover:border-[var(--brand-gold)] hover:text-[var(--brand-gold)]'
                          }`}
                        >
                          <Star
                            className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`}
                            aria-hidden="true"
                          />
                        </button>
                      </StudioTooltip>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Note */}
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 px-5 py-3 text-xs text-[var(--ink-muted)]">
            <span>
              يُحفظ اختيارك تلقائياً ويُربط مباشرة بجميع آيات السورة أثناء التلاوة.
            </span>
            <span className="shrink-0 font-semibold text-[var(--ink-primary)] tabular-nums">
              {toArabicDigits(filteredReciters.length)} / {toArabicDigits(reciters.length)}
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
