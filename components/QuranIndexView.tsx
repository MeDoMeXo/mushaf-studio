'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Headphones, Play, Search, Sparkles, Star, X } from 'lucide-react';
import { type QulChapter } from '@/lib/quran-data';
import { fetchChapters, fetchChapterVerses } from '@/lib/qul-client';
import { filterChapters, toArabicDigits } from '@/lib/quran-utils';
import {
  filterAndSortReciters,
  getStudioActiveReciters,
  RECITER_FILTER_TABS,
  type ReciterFilterTab,
} from '@/lib/reciter-filter';
import { useApp } from './AppProvider';
import { StudioTooltip } from './studio-ui/StudioControls';
import {
  StudioTabsList,
  StudioTabsRoot,
  StudioTabTrigger,
} from './studio-ui/StudioTabs';

const MAIN_SECTION_VALUES = ['surahs', 'reciters'] as const;

const PLACE_TABS = [
  { id: 'all', label: 'جميع السور' },
  { id: 'makkah', label: 'مكية' },
  { id: 'madinah', label: 'مدنية' },
] as const;

const PLACE_TAB_VALUES = PLACE_TABS.map((t) => t.id);
const RECITER_TAB_VALUES = RECITER_FILTER_TABS.map((t) => t.id);

export function QuranIndexView() {
  const {
    config,
    favoriteReciters,
    toggleFavoriteReciter,
    playSurahVerses,
    showToast,
  } = useApp();
  const [chapters, setChapters] = useState<QulChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<'all' | 'makkah' | 'madinah'>('all');
  const [activeTab, setActiveTab] = useState<'surahs' | 'reciters'>('surahs');
  const [reciterQuery, setReciterQuery] = useState('');
  const [reciterFilter, setReciterFilter] = useState<ReciterFilterTab>('all');
  const [loadingSample, setLoadingSample] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchChapters()
      .then((list) => {
        if (mounted) setChapters(list);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(
    () => filterChapters(chapters, query, place),
    [chapters, query, place]
  );

  const favoriteSet = useMemo(() => new Set(favoriteReciters), [favoriteReciters]);

  const activeReciters = useMemo(() => {
    // Verse-synced only: the strip plays Al-Fatihah verse-by-verse, so
    // whole-surah customs (no read id) must not be selectable here.
    return getStudioActiveReciters(config.customReciters, config.disabledReciters);
  }, [config.customReciters, config.disabledReciters]);

  const filteredReciters = useMemo(
    () =>
      filterAndSortReciters(activeReciters, {
        query: reciterQuery,
        tab: reciterFilter,
        favoriteSlugs: favoriteReciters,
      }),
    [activeReciters, reciterQuery, reciterFilter, favoriteReciters]
  );

  const handleListenFatihah = async (slug: string, name: string) => {
    setLoadingSample(slug);
    try {
      const verses = await fetchChapterVerses(1, config.defaultTranslation);
      playSurahVerses(verses, 1, 'الفاتحة', '1:1', slug);
      showToast(`جارٍ تشغيل سورة الفاتحة بصوت ${name}`);
    } finally {
      setLoadingSample(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-28 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--brand-emerald)] sm:text-3xl dark:text-[#E6C75A]">
            القرآن الكريم ومكتبة القراء
          </h1>
          <p className="mt-1 text-xs font-medium text-[var(--ink-muted)] sm:text-sm">
            ١١٤ سورة بالرسم العثماني · {toArabicDigits(activeReciters.length)} قارئاً عالمياً بتلاوات متسلسلة عالية الجودة
          </p>
        </div>

        {/* Main Section Hydration-Safe Tabs with Motion Spring */}
        <StudioTabsRoot
          idPrefix="quran-index-main"
          dir="rtl"
          value={activeTab}
          tabValues={MAIN_SECTION_VALUES}
          onValueChange={setActiveTab}
        >
          <StudioTabsList
            aria-label="أقسام القرآن"
            className="flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-1"
          >
            {(
              [
                {
                  id: 'surahs',
                  label: `فهرس السور (${toArabicDigits(chapters.length || 114)})`,
                },
                {
                  id: 'reciters',
                  label: `مكتبة القراء (${toArabicDigits(activeReciters.length)})`,
                },
              ] as const
            ).map((t) => {
              const active = activeTab === t.id;
              return (
                <StudioTabTrigger
                  key={t.id}
                  value={t.id}
                  className={`relative whitespace-nowrap rounded-lg px-4 py-1.5 text-xs font-bold transition-colors sm:text-sm ${
                    active
                      ? 'text-[var(--ink-primary)]'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="quran-index-main-tab"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="absolute inset-0 rounded-lg bg-[var(--surface-card)] shadow-sm ring-1 ring-[var(--brand-gold)]/55"
                    />
                  )}
                  <span className="relative z-10">{t.label}</span>
                </StudioTabTrigger>
              );
            })}
          </StudioTabsList>
        </StudioTabsRoot>
      </div>

      {activeTab === 'surahs' ? (
        <section className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[240px] max-w-md flex-1">
              <Search
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث باسم السورة، رقمها، أو اسمها بالإنجليزية..."
                aria-label="البحث في فهرس السور"
                className="h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] pl-8 pr-9 text-xs font-medium text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--brand-gold)] focus:outline-none sm:text-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="مسح البحث"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <StudioTabsRoot
              idPrefix="quran-index-place"
              dir="rtl"
              value={place}
              tabValues={PLACE_TAB_VALUES}
              onValueChange={setPlace}
            >
              <StudioTabsList
                aria-label="تصفية السور حسب مكان النزول"
                className="flex items-center gap-0.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-1"
              >
                {PLACE_TABS.map((item) => {
                  const active = place === item.id;
                  return (
                    <StudioTabTrigger
                      key={item.id}
                      value={item.id}
                      className={`relative whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? 'text-[var(--ink-primary)]'
                          : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="quran-index-place-tab"
                          transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                          className="absolute inset-0 rounded-md bg-[var(--surface-card)] shadow-sm ring-1 ring-[var(--brand-gold)]/55"
                        />
                      )}
                      <span className="relative z-10">{item.label}</span>
                    </StudioTabTrigger>
                  );
                })}
              </StudioTabsList>
            </StudioTabsRoot>
          </div>

          {loading ? (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)]"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] py-14 text-center">
              <p className="text-sm font-semibold text-[var(--ink-primary)]">
                لا توجد سورة مطابقة للبحث «{query}»
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setPlace('all');
                }}
                className="mt-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold text-[var(--ink-primary)] hover:border-[var(--brand-gold)]"
              >
                إعادة ضبط التصفية
              </button>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3.5 transition-colors hover:border-[var(--brand-gold)]"
                >
                  <Link
                    href={`/quran/${ch.id}`}
                    className="group flex min-w-0 flex-1 items-center gap-3"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--surface-subtle)] text-sm font-bold text-[var(--brand-emerald)] tabular-nums ring-1 ring-[var(--border-hairline)] dark:text-[#E6C75A]">
                      {toArabicDigits(ch.id)}
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display truncate text-base font-semibold text-[var(--ink-primary)] group-hover:text-[var(--brand-emerald)] sm:text-lg dark:group-hover:text-[#E6C75A]">
                        سورة {ch.name_arabic}
                      </h2>
                      <p className="truncate text-xs text-[var(--ink-muted)] tabular-nums">
                        {ch.name_simple} ·{' '}
                        {ch.revelation_place === 'makkah' ? 'مكية' : 'مدنية'} ·{' '}
                        {toArabicDigits(ch.verses_count)} آية
                      </p>
                    </div>
                  </Link>

                  <StudioTooltip content={`تصميم آيات من سورة ${ch.name_arabic}`}>
                    <Link
                      href={`/studio?surah=${ch.id}&from=1&to=${Math.min(3, ch.verses_count)}`}
                      aria-label={`صمّم من سورة ${ch.name_arabic}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--brand-gold)] transition-colors hover:border-[var(--brand-emerald)] hover:bg-[var(--brand-emerald)] hover:text-[#FAF7F0]"
                    >
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </StudioTooltip>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="mt-5">
          {/* Reciter Search & Style Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[240px] max-w-md flex-1">
              <Search
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={reciterQuery}
                onChange={(e) => setReciterQuery(e.target.value)}
                placeholder="ابحث باسم القارئ أو البلد أو الرواية..."
                aria-label="البحث في مكتبة القراء"
                className="h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] pl-8 pr-9 text-xs font-medium text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--brand-gold)] focus:outline-none sm:text-sm"
              />
              {reciterQuery && (
                <button
                  type="button"
                  onClick={() => setReciterQuery('')}
                  aria-label="مسح البحث عن قارئ"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <StudioTabsRoot
              idPrefix="quran-reciter-filter"
              dir="rtl"
              value={reciterFilter}
              tabValues={RECITER_TAB_VALUES}
              onValueChange={setReciterFilter}
            >
              <StudioTabsList
                aria-label="تصفية القراء"
                className="flex flex-wrap items-center gap-0.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-1"
              >
                {RECITER_FILTER_TABS.map((rf) => {
                  const active = reciterFilter === rf.id;
                  const label =
                    rf.id === 'favorites' && favoriteReciters.length > 0
                      ? `${rf.label} (${toArabicDigits(favoriteReciters.length)})`
                      : rf.label;
                  return (
                    <StudioTabTrigger
                      key={rf.id}
                      value={rf.id}
                      className={`relative whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? 'text-[var(--ink-primary)]'
                          : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="quran-reciter-filter-tab"
                          transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                          className="absolute inset-0 rounded-md bg-[var(--surface-card)] shadow-sm ring-1 ring-[var(--brand-gold)]/55"
                        />
                      )}
                      <span className="relative z-10">{label}</span>
                    </StudioTabTrigger>
                  );
                })}
              </StudioTabsList>
            </StudioTabsRoot>
          </div>

          {filteredReciters.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] py-14 text-center">
              <p className="text-sm font-semibold text-[var(--ink-primary)]">
                لا يوجد قارئ مطابق للتصفية الحالية
              </p>
              <button
                type="button"
                onClick={() => {
                  setReciterQuery('');
                  setReciterFilter('all');
                }}
                className="mt-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold text-[var(--ink-primary)] hover:border-[var(--brand-gold)]"
              >
                عرض جميع القراء
              </button>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredReciters.map((r) => {
                const isFav = favoriteSet.has(r.slug);
                return (
                  <div
                    key={r.slug}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-4 transition-colors hover:border-[var(--brand-gold)]/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-emerald)] text-[#E6C75A] ring-1 ring-[#D4AF37]/30">
                          <Headphones className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="font-display truncate text-base font-bold text-[var(--ink-primary)]">
                            {r.name}
                          </h2>
                          <p className="mt-0.5 text-xs text-[var(--ink-muted)] tabular-nums">
                            {r.styleLabel}
                            {r.country ? ` · ${r.country}` : ''} · {r.bitrate}kbps
                          </p>
                        </div>
                      </div>

                      <StudioTooltip content={isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}>
                        <button
                          type="button"
                          onClick={() => toggleFavoriteReciter(r.slug)}
                          aria-pressed={isFav}
                          aria-label={
                            isFav
                              ? `إزالة ${r.name} من المفضلة`
                              : `إضافة ${r.name} إلى المفضلة`
                          }
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors ${
                            isFav
                              ? 'border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]'
                              : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:border-[var(--brand-gold)] hover:text-[var(--brand-gold)]'
                          }`}
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${isFav ? 'fill-current' : ''}`}
                            aria-hidden="true"
                          />
                        </button>
                      </StudioTooltip>
                    </div>

                    <div className="flex items-center gap-2 border-t border-[var(--border-hairline)] pt-3">
                      <button
                        type="button"
                        disabled={loadingSample === r.slug}
                        onClick={() => handleListenFatihah(r.slug, r.name)}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--brand-emerald)] px-3.5 text-xs font-bold text-[#FAF7F0] transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {loadingSample === r.slug ? 'جارٍ التشغيل...' : 'استمع للفاتحة'}
                        </span>
                      </button>
                      <Link
                        href={`/studio?reciter=${r.slug}`}
                        className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
                      >
                        <Sparkles
                          className="h-3.5 w-3.5 text-[var(--brand-gold)]"
                          aria-hidden="true"
                        />
                        <span>صمّم بصوته</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
