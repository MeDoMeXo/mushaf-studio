'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Loader2, Search, Sparkles, Square, X } from 'lucide-react';
import { type QulChapter } from '@/lib/quran-data';
import { fetchChapters, fetchChapterVerses } from '@/lib/qul-client';
import { buildArabicSearchRegex, toArabicDigits } from '@/lib/quran-utils';
import { bumpStat } from '@/lib/storage';
import { useApp } from './AppProvider';
import { StudioTooltip } from './studio-ui/StudioControls';

interface SearchHit {
  surahId: number;
  surahName: string;
  ayahNumber: number;
  verseKey: string;
  textUthmani: string;
}

const MAX_RESULTS = 60;
const QUICK_TERMS = ['الحمد', 'الرحمن', 'الصبر', 'آمنوا', 'بذكر الله'];

export function SearchView() {
  const { config } = useApp();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressText, setProgressText] = useState(
    'ابحث بكلمة أو عبارة عربية في النص العثماني (يتجاهل التشكيل وأشكال الهمزات تلقائياً).'
  );
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const abortRef = useRef(false);
  const chaptersRef = useRef<QulChapter[]>([]);

  useEffect(() => {
    fetchChapters().then((c) => {
      chaptersRef.current = c;
    });
    return () => {
      abortRef.current = true;
    };
  }, []);

  const runSearch = async (rawTerm: string) => {
    const trimmed = rawTerm.trim();
    if (trimmed.length < 2) {
      setProgressText('يرجى كتابة حرفين على الأقل للبحث.');
      return;
    }

    const regex = buildArabicSearchRegex(trimmed);
    if (!regex) return;

    abortRef.current = false;
    setSearching(true);
    setProgressPct(0);
    setSearchedOnce(true);
    setHits([]);
    bumpStat('searches', trimmed.slice(0, 25));

    const chapters =
      chaptersRef.current.length > 0
        ? chaptersRef.current
        : await fetchChapters();
    chaptersRef.current = chapters;

    const collected: SearchHit[] = [];

    for (let i = 0; i < chapters.length; i++) {
      if (abortRef.current) break;
      const chap = chapters[i];
      setProgressPct(Math.round(((i + 1) / chapters.length) * 100));
      setProgressText(
        `جارٍ البحث في سورة ${chap.name_arabic} (${toArabicDigits(i + 1)} / ${toArabicDigits(chapters.length)}) · النتائج: ${toArabicDigits(collected.length)}`
      );

      try {
        const verses = await fetchChapterVerses(
          chap.id,
          config.defaultTranslation
        );
        for (const v of verses) {
          if (abortRef.current) break;
          regex.lastIndex = 0;
          if (!regex.test(v.text_uthmani)) continue;
          const ayahNum = Number(v.verse_key.split(':')[1] || 1);
          collected.push({
            surahId: chap.id,
            surahName: chap.name_arabic,
            ayahNumber: ayahNum,
            verseKey: v.verse_key,
            textUthmani: v.text_uthmani,
          });
          setHits([...collected]);
          if (collected.length >= MAX_RESULTS) {
            setProgressPct(100);
            setProgressText(
              `تم العثور على ${toArabicDigits(MAX_RESULTS)} نتيجة (الحد الأقصى للعرض).`
            );
            setSearching(false);
            return;
          }
        }
      } catch {
        // continue to next chapter
      }
    }

    setSearching(false);
    setProgressText(
      abortRef.current
        ? `تم إيقاف البحث عند ${toArabicDigits(collected.length)} نتيجة.`
        : `اكتمل البحث · إجمالي النتائج: ${toArabicDigits(collected.length)}.`
    );
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await runSearch(query);
  };

  const renderHighlighted = (text: string) => {
    const rx = buildArabicSearchRegex(query.trim());
    if (!rx) return text;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    rx.lastIndex = 0;
    let key = 0;
    while ((match = rx.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.slice(lastIdx, match.index));
      }
      parts.push(
        <mark
          key={key++}
          className="rounded bg-[#E6C75A]/45 px-0.5 text-inherit dark:bg-[#C9A227]/40"
        >
          {match[0]}
        </mark>
      );
      lastIdx = match.index + match[0].length;
      if (match[0].length === 0) break;
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx));
    return parts;
  };

  return (
    <main className="mx-auto w-full max-w-[1040px] flex-1 px-4 pb-28 pt-6 sm:px-6">
      <div className="border-b border-[var(--border-hairline)] pb-5">
        <h1 className="font-display text-2xl font-bold text-[var(--brand-emerald)] sm:text-3xl dark:text-[#E6C75A]">
          البحث في آيات القرآن الكريم
        </h1>
        <p className="mt-1 text-xs font-medium text-[var(--ink-muted)] sm:text-sm">
          بحث نصي ذكي يتجاهل الحركات والتشكيل في الرسم العثماني عبر مكتبة QUL
        </p>
      </div>

      {/* Unified Studio Command Search Surface */}
      <form
        onSubmit={handleSearch}
        className="mt-5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5"
      >
        <div className="flex flex-wrap gap-2.5">
          <div className="relative min-w-[240px] flex-1">
            <Search
              className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--brand-gold)]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="مثال: الحمد، الرحمن، الصبر، آمنوا..."
              aria-label="كلمة البحث في القرآن"
              className="h-11 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] pl-9 pr-10 text-sm font-medium text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--brand-gold)] focus:outline-none"
            />
            {query && !searching && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="مسح عبارة البحث"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={searching}
            className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-[var(--brand-emerald)] px-6 text-sm font-bold text-[#FAF7F0] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
            <span>ابحث</span>
          </button>

          {searching && (
            <button
              type="button"
              onClick={() => {
                abortRef.current = true;
              }}
              className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 text-sm font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
            >
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              <span>إيقاف</span>
            </button>
          )}
        </div>

        {/* Quick Sample Terms */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-[var(--ink-muted)]">
            أمثلة سريعة:
          </span>
          {QUICK_TERMS.map((term) => (
            <button
              key={term}
              type="button"
              disabled={searching}
              onClick={() => {
                setQuery(term);
                void runSearch(term);
              }}
              className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)] disabled:opacity-50"
            >
              {term}
            </button>
          ))}
        </div>

        {/* Progress Bar while scanning */}
        {searching && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]">
            <div
              className="h-full rounded-full bg-[var(--brand-gold)] transition-[width] duration-150"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        <p className="mt-3 text-xs text-[var(--ink-muted)] tabular-nums">
          {progressText}
        </p>
      </form>

      {/* Search Results */}
      <section className="mt-5 space-y-3" aria-label="نتائج البحث">
        {hits.map((hit) => (
          <article
            key={hit.verseKey}
            className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5 transition-colors hover:border-[var(--brand-gold)]/75"
          >
            <p className="font-quran text-2xl leading-[2.2] text-[var(--ink-primary)]">
              {renderHighlighted(hit.textUthmani)}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-3">
              <span className="text-xs font-bold text-[var(--brand-gold)] tabular-nums">
                سورة {hit.surahName} · الآية {toArabicDigits(hit.ayahNumber)} ·{' '}
                {hit.verseKey}
              </span>
              <div className="flex items-center gap-2">
                <StudioTooltip content="فتح السورة والانتقال إلى هذه الآية">
                  <Link
                    href={`/quran/${hit.surahId}?ayah=${hit.ayahNumber}`}
                    className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-emerald)] hover:text-[#FAF7F0]"
                  >
                    <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>اقرأ في المصحف</span>
                  </Link>
                </StudioTooltip>
                <StudioTooltip content="فتح الآية مباشرة في استوديو التصميم">
                  <Link
                    href={`/studio?surah=${hit.surahId}&from=${hit.ayahNumber}&to=${hit.ayahNumber}`}
                    className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-gold)] hover:text-[#1F1705]"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>صمّم الآية</span>
                  </Link>
                </StudioTooltip>
              </div>
            </div>
          </article>
        ))}

        {searchedOnce && !searching && hits.length === 0 && (
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] py-14 text-center">
            <p className="text-base font-semibold text-[var(--ink-primary)]">
              لم يتم العثور على آيات مطابقة لـ «{query}»
            </p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              جرّب البحث بجذر الكلمة أو عبارة أقصر.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
