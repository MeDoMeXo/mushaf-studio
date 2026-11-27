'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  Film,
  Headphones,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  RECITERS,
  TRANSLATIONS,
  VERSE_OF_DAY_CURATED,
  type QulChapter,
} from '@/lib/quran-data';
import { fetchChapters, fetchSingleVerse } from '@/lib/qul-client';
import {
  filterChapters,
  pickVerseOfDay,
  toArabicDigits,
} from '@/lib/quran-utils';
import { bumpStat, loadLastRead, type LastReadInfo } from '@/lib/storage';
import { useApp } from './AppProvider';
import {
  StudioTabsList,
  StudioTabsRoot,
  StudioTabTrigger,
} from './studio-ui/StudioTabs';

const PLACE_FILTER_TABS = [
  { id: 'all', label: 'الكل' },
  { id: 'makkah', label: 'مكية' },
  { id: 'madinah', label: 'مدنية' },
] as const;

const PLACE_FILTER_VALUES = PLACE_FILTER_TABS.map((t) => t.id);

export function HomeView() {
  const { config } = useApp();
  const [chapters, setChapters] = useState<QulChapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [todayAutoPick, setTodayAutoPick] = useState<{ surah: number; ayah: number }>(
    () => ({
      surah: VERSE_OF_DAY_CURATED[0].surah,
      ayah: VERSE_OF_DAY_CURATED[0].ayah,
    })
  );

  const vodPick = useMemo(
    () =>
      config.verseOfDay &&
      config.verseOfDay.surah >= 1 &&
      config.verseOfDay.surah <= 114 &&
      config.verseOfDay.ayah >= 1
        ? config.verseOfDay
        : todayAutoPick,
    [config.verseOfDay, todayAutoPick]
  );

  const curatedVod = useMemo(
    () =>
      VERSE_OF_DAY_CURATED.find(
        (v) => v.surah === vodPick.surah && v.ayah === vodPick.ayah
      ) ?? null,
    [vodPick.surah, vodPick.ayah]
  );
  const [liveVod, setLiveVod] = useState<{
    key: string;
    text: string;
    surahName?: string;
  } | null>(null);
  const [lastRead, setLastRead] = useState<LastReadInfo | null>(null);

  const [query, setQuery] = useState('');
  const [placeFilter, setPlaceFilter] = useState<'all' | 'makkah' | 'madinah'>('all');

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setTodayAutoPick(pickVerseOfDay(null));
      setLastRead(loadLastRead());
      bumpStat('visits', 'home');
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const key = `${vodPick.surah}:${vodPick.ayah}`;
    fetchChapters()
      .then((list) => {
        if (!active) return;
        setChapters(list);
        const chap = list.find((c) => c.id === vodPick.surah);
        if (chap) {
          setLiveVod((prev) => ({
            key,
            text: prev?.key === key ? prev.text : curatedVod?.text ?? '',
            surahName: chap.name_arabic,
          }));
        }
      })
      .finally(() => {
        if (active) setLoadingChapters(false);
      });

    fetchSingleVerse(vodPick.surah, vodPick.ayah, config.defaultTranslation).then(
      (v) => {
        if (active && v?.text_uthmani) {
          setLiveVod((prev) => ({
            key,
            text: v.text_uthmani,
            surahName: prev?.key === key ? prev.surahName : curatedVod?.surahName,
          }));
        }
      }
    );

    return () => {
      active = false;
    };
  }, [vodPick.surah, vodPick.ayah, config.defaultTranslation, curatedVod]);

  const currentKey = `${vodPick.surah}:${vodPick.ayah}`;
  const vodText =
    (liveVod?.key === currentKey && liveVod.text) || curatedVod?.text || '';
  const vodSurahName =
    (liveVod?.key === currentKey && liveVod.surahName) ||
    curatedVod?.surahName ||
    '';

  const visibleChapters = useMemo(
    () => filterChapters(chapters, query, placeFilter),
    [chapters, query, placeFilter]
  );

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-24 pt-5 sm:px-6 2xl:max-w-[1680px]">
      {/* Editorial Verse of the Day Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-[#1B4A3A] bg-gradient-to-br from-[#06221A] via-[#0B3D2E] to-[#124D3A] px-5 py-8 text-[#FAF7F0] shadow-md sm:px-12 sm:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 rounded-xl border border-[#E6C75A]/20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #E6C75A 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-wide text-[#E6C75A]">
            {config.badge} · مكتبة QUL مفتوحة المصدر
          </p>
          <h1 className="font-display mt-3 text-balance text-2xl font-bold leading-snug text-[#FAF7F0] sm:text-4xl">
            {config.heroTitle}
          </h1>

          <div className="mt-8 border-y border-[#E6C75A]/25 py-6">
            {vodText ? (
              <p className="font-quran text-2xl leading-[2.3] text-[#FAF7F0] sm:text-4xl sm:leading-[2.35]">
                {vodText}
              </p>
            ) : (
              <div className="mx-auto h-12 w-3/4 animate-pulse rounded-lg bg-white/10" />
            )}
            <p className="mt-3 text-sm font-semibold text-[#E6C75A]">
              ﴿ سورة {vodSurahName || 'البقرة'} · الآية {toArabicDigits(vodPick.ayah)} ﴾
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/studio?surah=${vodPick.surah}&from=${vodPick.ayah}&to=${vodPick.ayah}`}
              className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-[#D4AF37] px-6 text-sm font-bold text-[#1F1705] shadow-sm transition-colors hover:bg-[#E6C75A]"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>افتح استوديو التلاوات والتصميم</span>
            </Link>
            <Link
              href={`/quran/${vodPick.surah}?ayah=${vodPick.ayah}`}
              className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl border border-[#FAF7F0]/25 bg-white/10 px-6 text-sm font-semibold text-[#FAF7F0] transition-colors hover:bg-white/20"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              <span>اقرأ السورة كاملة</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Continue Reading Bar */}
      {lastRead && (
        <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-subtle)] text-[var(--brand-gold)] ring-1 ring-[var(--border-hairline)]">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-[var(--ink-primary)]">
                متابعة القراءة · سورة {lastRead.name}
              </p>
              <p className="text-xs text-[var(--ink-muted)] tabular-nums">
                آخر موضع محفوظ عند الآية {toArabicDigits(lastRead.ayah)}
              </p>
            </div>
          </div>
          <Link
            href={`/quran/${lastRead.surah}?ayah=${lastRead.ayah}`}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <span>استكمال القراءة</span>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </section>
      )}

      {/* Three Core Pillars */}
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Link
          href="/quran"
          className="group rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5 transition-colors hover:border-[var(--brand-gold)]"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-subtle)] text-[var(--brand-gold)]">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="font-display text-base font-bold text-[var(--ink-primary)] group-hover:text-[var(--brand-emerald)] dark:group-hover:text-[#E6C75A]">
              النص العثماني من QUL
            </h2>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-[var(--ink-muted)]">
            قراءة واضحة ومريحة لجميع سور القرآن الـ ١١٤ مع {toArabicDigits(TRANSLATIONS.length)} ترجمات معتمدة والتحكم الكامل بحجم الخط.
          </p>
        </Link>

        <Link
          href="/studio"
          className="group rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5 transition-colors hover:border-[var(--brand-gold)]"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-subtle)] text-[var(--brand-gold)]">
              <Film className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="font-display text-base font-bold text-[var(--ink-primary)] group-hover:text-[var(--brand-emerald)] dark:group-hover:text-[#E6C75A]">
              استوديو فيديوهات وصور التلاوة
            </h2>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-[var(--ink-muted)]">
            صمّم مقاطع Reels وبطاقات آيات بزخارف إسلامية وترجمات QUL وخلفيات متحركة وتصدير MP4 وWebM وPNG.
          </p>
        </Link>

        <Link
          href="/quran"
          className="group rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5 transition-colors hover:border-[var(--brand-gold)]"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-subtle)] text-[var(--brand-gold)]">
              <Headphones className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="font-display text-base font-bold text-[var(--ink-primary)] group-hover:text-[var(--brand-emerald)] dark:group-hover:text-[#E6C75A]">
              {toArabicDigits(RECITERS.length)} قارئاً عالمياً بمزامنة آية بآية
            </h2>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-[var(--ink-muted)]">
            استمع لتلاوات متتابعة لنخبة القراء المرتلين والمجودين ورواية ورش والمصحف المعلم مع تظليل الآية المتلوة.
          </p>
        </Link>
      </section>

      {/* 114 Surah Catalog */}
      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-hairline)] pb-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[var(--brand-emerald)] dark:text-[#E6C75A]">
              فهرس سور القرآن الكريم
            </h2>
            <p className="mt-1 text-xs font-medium text-[var(--ink-muted)] tabular-nums">
              {toArabicDigits(visibleChapters.length)} سورة من أصل ١١٤
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
            {/* Search Box */}
            <div className="relative min-w-0 flex-1 sm:flex-initial">
              <Search
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث باسم السورة أو رقمها..."
                aria-label="تصفية السور بالاسم أو الرقم"
                className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] pl-8 pr-9 text-xs font-medium text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--brand-gold)] focus:outline-none sm:w-64"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="مسح تصفية السور"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Hydration-Safe Segmented Filter with Motion Spring */}
            <StudioTabsRoot
              idPrefix="home-place-filter"
              dir="rtl"
              value={placeFilter}
              tabValues={PLACE_FILTER_VALUES}
              onValueChange={setPlaceFilter}
            >
              <StudioTabsList
                aria-label="تصفية حسب مكان النزول"
                className="flex items-center gap-0.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-1"
              >
                {PLACE_FILTER_TABS.map((tab) => {
                  const active = placeFilter === tab.id;
                  return (
                    <StudioTabTrigger
                      key={tab.id}
                      value={tab.id}
                      className={`relative whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                        active
                          ? 'text-[var(--ink-primary)]'
                          : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="home-place-filter-indicator"
                          transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                          className="absolute inset-0 rounded-md bg-[var(--surface-card)] shadow-sm ring-1 ring-[var(--brand-gold)]/55"
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                    </StudioTabTrigger>
                  );
                })}
              </StudioTabsList>
            </StudioTabsRoot>
          </div>
        </div>

        {loadingChapters ? (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)]"
              />
            ))}
          </div>
        ) : visibleChapters.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] py-14 text-center">
            <p className="text-base font-semibold text-[var(--ink-primary)]">
              لا توجد سورة مطابقة للبحث «{query}»
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setPlaceFilter('all');
              }}
              className="mt-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
            >
              إعادة ضبط التصفية
            </button>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {visibleChapters.map((ch) => (
              <Link
                key={ch.id}
                href={`/quran/${ch.id}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-4 py-3.5 transition-colors hover:border-[var(--brand-gold)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--surface-subtle)] text-sm font-bold text-[var(--brand-emerald)] tabular-nums ring-1 ring-[var(--border-hairline)] dark:text-[#E6C75A]">
                    {toArabicDigits(ch.id)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display truncate text-lg font-semibold text-[var(--ink-primary)] group-hover:text-[var(--brand-emerald)] dark:group-hover:text-[#E6C75A]">
                      {ch.name_arabic}
                    </h3>
                    <p className="truncate text-xs text-[var(--ink-muted)] tabular-nums">
                      {ch.revelation_place === 'makkah' ? 'مكية' : 'مدنية'} ·{' '}
                      {toArabicDigits(ch.verses_count)} آية · ص{' '}
                      {ch.pages ? toArabicDigits(ch.pages[0]) : '—'}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-medium text-[var(--ink-muted)]">
                  {ch.name_simple}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
