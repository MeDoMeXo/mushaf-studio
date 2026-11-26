'use client';

/**
 * YouTubePublishKit — the post-export metadata panel: bilingual titles,
 * structured descriptions (with YouTube chapter timestamps parsed live from
 * the exported Arabic SRT so they never drift), and a ready-to-paste tag box.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Tags, Youtube } from 'lucide-react';
import {
  buildYouTubePublishKit,
  parseSrtCueSpans,
  type YouTubePublishKit as PublishKit,
} from '@/lib/youtube-publish';
import type { QulVerse } from '@/lib/quran-data';

export interface YouTubePublishKitProps {
  surahNameAr: string;
  surahNameEn?: string | null;
  fromAyah: number;
  toAyah: number;
  verseCount: number;
  isFullSurah?: boolean;
  reciterName: string;
  translationName?: string | null;
  selectedVerses: QulVerse[];
  srtUrl: string | null;
  durationSec: string;
}

type CopyKind = 'title' | 'desc' | 'tags';

export function YouTubePublishKit({
  surahNameAr,
  surahNameEn,
  fromAyah,
  toAyah,
  verseCount,
  isFullSurah,
  reciterName,
  translationName,
  selectedVerses,
  srtUrl,
  durationSec,
}: YouTubePublishKitProps) {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [copiedKind, setCopiedKind] = useState<CopyKind | null>(null);
  const [cueSpans, setCueSpans] = useState<{ startSec: number; endSec: number }[] | null>(null);

  // Fetch the exported Arabic SRT once — its cue grid IS the video timeline,
  // so chapter timestamps generated from it stay perfectly synchronized.
  useEffect(() => {
    if (!srtUrl) return;
    let cancelled = false;
    fetch(srtUrl, { cache: 'no-store' })
      .then((res) => (res.ok ? res.text() : ''))
      .then((body) => {
        if (!cancelled && body) setCueSpans(parseSrtCueSpans(body));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [srtUrl]);

  const kit: PublishKit | null = useMemo(() => {
    if (!selectedVerses.length) return null;
    return buildYouTubePublishKit({
      surahNameAr,
      surahNameEn,
      fromAyah,
      toAyah,
      verseCount,
      isFullSurah,
      reciterName,
      translationName,
      verseTexts: selectedVerses.map((v) => v.text_uthmani ?? ''),
      translationTexts: selectedVerses.map((v) => v.translations?.[0]?.text ?? ''),
      cueSpans,
      durationSec: Number(durationSec) || null,
    });
  }, [
    surahNameAr,
    surahNameEn,
    fromAyah,
    toAyah,
    verseCount,
    isFullSurah,
    reciterName,
    translationName,
    selectedVerses,
    cueSpans,
    durationSec,
  ]);

  if (!kit) return null;

  const title = lang === 'ar' ? kit.titleAr : kit.titleEn;
  const description = lang === 'ar' ? kit.descriptionAr : kit.descriptionEn;

  const copyText = (value: string, kind: CopyKind) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(value).catch(() => {});
    }
    setCopiedKind(kind);
    setTimeout(() => setCopiedKind((prev) => (prev === kind ? null : prev)), 2200);
  };

  const copyBtn = (kind: CopyKind, label: string, value: string) => (
    <button
      type="button"
      data-testid={`copy-youtube-${kind}-btn`}
      onClick={() => copyText(value, kind)}
      className="inline-flex items-center gap-1 rounded-md border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-bold text-[var(--ink-primary)] hover:border-[var(--brand-gold)]"
    >
      {copiedKind === kind ? (
        <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
      ) : (
        <Copy className="h-3 w-3" aria-hidden="true" />
      )}
      <span>{copiedKind === kind ? 'تم النسخ' : label}</span>
    </button>
  );

  return (
    <div className="space-y-2.5 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink-primary)]">
          <Youtube className="h-4 w-4 text-red-600" aria-hidden="true" />
          <span>حزمة النشر ليوتيوب (عنوان · وصف · تاغات)</span>
        </div>
        <div
          role="group"
          aria-label="لغة بيانات النشر"
          className="inline-flex rounded-md bg-[var(--surface-subtle)] p-0.5"
        >
          {(
            [
              { id: 'ar', label: 'عربي' },
              { id: 'en', label: 'English' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={lang === opt.id}
              onClick={() => setLang(opt.id)}
              className={`rounded px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
                lang === opt.id
                  ? 'bg-[var(--surface-card)] text-[var(--ink-primary)] shadow-sm ring-1 ring-[var(--brand-gold)]/50'
                  : 'text-[var(--ink-muted)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-[var(--ink-muted)]">
            العنوان (يُقرأ تلقائياً من اسم الملف أو انسخه)
          </span>
          {copyBtn('title', 'نسخ العنوان', title)}
        </div>
        <p
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          className="rounded-md border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-primary)]"
        >
          {title}
        </p>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-[var(--ink-muted)]">
            الوصف (يشمل فصول الفيديو والأهاشتاغات)
          </span>
          {copyBtn('desc', 'نسخ الوصف', description)}
        </div>
        <textarea
          readOnly
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          value={description}
          aria-label="وصف الفيديو ليوتيوب"
          onFocus={(e) => e.currentTarget.select()}
          className="studio-scroll h-32 w-full resize-none rounded-md border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
        />
      </div>

      {/* Tags */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--ink-muted)]">
            <Tags className="h-3 w-3" aria-hidden="true" />
            التاغات (الصقها في خانة Tags)
          </span>
          {copyBtn('tags', 'نسخ التاغات', kit.tagsValue)}
        </div>
        <p
          dir="ltr"
          className="rounded-md border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--ink-muted)]"
        >
          {kit.tagsValue}
        </p>
      </div>

      <p className="text-[10px] leading-relaxed text-[var(--ink-muted)]">
        {cueSpans
          ? 'الفصول الزمنية مشتقة من ملف الترجمة المتزامن نفسه — تعمل أزرار الفصول في يوتيوب مباشرة بعد اللصق.'
          : 'ستُولَّد الفصول الزمنية تلقائياً عند توفر ملف الترجمة (SRT) لهذا التصدير.'}
      </p>
    </div>
  );
}
