'use client';

/**
 * ProducerVerseLibrary — مكتبة الآيات (نمط «ملفات المشروع» في محررات
 * الفيديو): بطاقة لكل آية جُلبت من الموقع — رقمها، مطلعها بالرسم
 * العثماني، مدتها بعد التحرير وحالتها — نقرة = قفز وتحديد. أسفلها
 * أدوات قصّ السكوت (العتبة/المدة الدنيا + كشف/قصّ).
 */
import React, { useMemo, useState } from 'react';
import { AudioLines, BookOpenText, Radar, Scissors, Search, Trash2 } from 'lucide-react';
import { toArabicDigits, formatAudioTime } from '@/lib/quran-utils';
import type { VerseView } from '@/lib/audio-producer/verse-views';

type VerseFilter = 'all' | 'kept' | 'removed';

const FILTERS: { id: VerseFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'kept', label: 'المحفوظة' },
  { id: 'removed', label: 'المحذوفة' },
];

interface ProducerVerseLibraryProps {
  verseViews: VerseView[];
  /** نصوص الآيات بالرسم العثماني (وضع القارئ المدمج) — null في وضع الملف */
  verseTexts: string[] | null;
  activeVerseIdx: number;
  selectedVerseIdx: number | null;
  isPlaying: boolean;
  // أدوات السكوت
  thresholdRatio: number;
  minSilenceSec: number;
  silencesCount: number;
  hasSilences: boolean;
  onThresholdChange: (v: number) => void;
  onMinSilenceChange: (v: number) => void;
  onDetectSilences: () => void;
  onRemoveSilences: () => void;
  onSelectVerse: (idx: number) => void;
  onRemoveVerse: (idx: number) => void;
}

export function ProducerVerseLibrary({
  verseViews,
  verseTexts,
  activeVerseIdx,
  selectedVerseIdx,
  isPlaying,
  thresholdRatio,
  minSilenceSec,
  silencesCount,
  hasSilences,
  onThresholdChange,
  onMinSilenceChange,
  onDetectSilences,
  onRemoveSilences,
  onSelectVerse,
  onRemoveVerse,
}: ProducerVerseLibraryProps) {
  const [filter, setFilter] = useState<VerseFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'kept') return verseViews.filter((v) => v.status !== 'removed');
    if (filter === 'removed') return verseViews.filter((v) => v.status === 'removed');
    return verseViews;
  }, [verseViews, filter]);

  const keptCount = useMemo(
    () => verseViews.filter((v) => v.status !== 'removed').length,
    [verseViews]
  );

  if (verseViews.length === 0) {
    return (
      <aside
        aria-label="مكتبة الآيات"
        className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-4 text-center"
      >
        <BookOpenText className="h-7 w-7 text-[var(--brand-gold)]" aria-hidden="true" />
        <p className="text-xs font-bold text-[var(--ink-primary)]">مكتبة الآيات فارغة</p>
        <p className="max-w-[220px] text-[10px] leading-relaxed text-[var(--ink-muted)]">
          بعد «تحميل للمحرر» تُجلب الآيات من الموقع وتظهر هنا كبطاقات قابلة للتحديد والحذف
          من الخط الزمني.
        </p>
      </aside>
    );
  }

  return (
    <aside
      aria-label="مكتبة الآيات"
      className="studio-scroll flex min-h-[220px] flex-col gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3 xl:min-h-0 xl:overflow-y-auto"
    >
      {/* ترويسة المكتبة */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink-primary)]">
          <AudioLines className="h-3.5 w-3.5 text-[var(--brand-emerald)]" aria-hidden="true" />
          مكتبة الآيات
        </h2>
        <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-muted)]">
          {toArabicDigits(keptCount)}/{toArabicDigits(verseViews.length)}
        </span>
      </div>

      {/* مرشحات المكتبة */}
      <div role="tablist" aria-label="مرشح الآيات" className="flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            type="button"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${
              filter === f.id
                ? 'bg-[var(--brand-emerald)] text-[#FAF7F0] dark:bg-[var(--brand-gold)] dark:text-[#1F1705]'
                : 'bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* بطاقات الآيات */}
      <ul className="studio-scroll -mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1">
        {filtered.map((v) => {
          const isSelected = selectedVerseIdx === v.idx;
          const isActive = activeVerseIdx === v.idx;
          const text = verseTexts?.[v.idx] ?? null;
          return (
            <li key={v.idx}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectVerse(v.idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectVerse(v.idx);
                  }
                }}
                aria-pressed={isSelected}
                aria-label={`الآية ${v.number}`}
                className={`group relative cursor-pointer rounded-xl border p-2 transition-colors ${
                  v.status === 'removed'
                    ? 'border-dashed border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 opacity-60'
                    : isActive
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15'
                      : isSelected
                        ? 'border-[var(--brand-emerald)] bg-[var(--brand-emerald)]/10'
                        : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/60 hover:border-[var(--brand-gold)]/60'
                }`}
              >
                <div className="flex items-start gap-2">
                  {/* رقم الآية */}
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold tabular-nums ${
                      v.status === 'removed'
                        ? 'bg-[var(--surface-card)] text-[var(--ink-muted)]'
                        : isActive
                          ? 'bg-[var(--brand-gold)] text-[#1F1705]'
                          : 'bg-[var(--brand-emerald)]/15 text-[var(--brand-emerald)] dark:text-[var(--brand-gold)]'
                    }`}
                  >
                    {toArabicDigits(v.number)}
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* مطلع الآية */}
                    <p
                      dir="rtl"
                      className={`font-quran truncate text-right text-[13px] leading-relaxed ${
                        v.status === 'removed' ? 'text-[var(--ink-muted)]' : 'text-[var(--ink-primary)]'
                      }`}
                      title={text ?? `الآية ${v.number}`}
                    >
                      {text ? `${text.slice(0, 42)}…` : `الآية رقم ${toArabicDigits(v.number)}`}
                    </p>
                    {/* المدة والحالة */}
                    <div className="mt-0.5 flex items-center gap-1.5 text-[9px] font-bold">
                      <span className="font-mono tabular-nums text-[var(--ink-muted)]">
                        {formatAudioTime(v.keptSec)}
                        {v.status === 'partial' && (
                          <span title="المدة الأصلية">/{formatAudioTime(v.totalSec)}</span>
                        )}
                      </span>
                      {v.status === 'kept' && (
                        <span className="rounded-full bg-[var(--brand-emerald)]/15 px-1.5 py-px text-[var(--brand-emerald)] dark:text-[#8FD6A8]">
                          محفوظة
                        </span>
                      )}
                      {v.status === 'partial' && (
                        <span className="rounded-full bg-[var(--brand-gold)]/20 px-1.5 py-px text-[var(--brand-gold)] dark:text-[#E6C75A]">
                          مقصوصة جزئياً
                        </span>
                      )}
                      {v.status === 'removed' && (
                        <span className="rounded-full bg-[var(--surface-card)] px-1.5 py-px text-[var(--ink-muted)]">
                          محذوفة
                        </span>
                      )}
                      {isActive && isPlaying && (
                        <span className="rounded-full bg-[var(--brand-gold)] px-1.5 py-px text-[#1F1705]">
                          تُتلى الآن
                        </span>
                      )}
                    </div>
                  </div>
                  {/* حذف الآية */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveVerse(v.idx);
                    }}
                    aria-label={`حذف الآية ${v.number} من التلاوة`}
                    title={v.status === 'removed' ? 'محذوفة — استعِد بالمتراجع' : 'حذف الآية'}
                    disabled={v.status === 'removed'}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-muted)] opacity-0 transition-opacity hover:border-red-400 hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-0"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="rounded-xl border border-dashed border-[var(--border-hairline)] p-3 text-center text-[10px] font-bold text-[var(--ink-muted)]">
            لا آيات تطابق هذا المرشح
          </li>
        )}
      </ul>

      {/* أدوات قصّ السكوت */}
      <section
        aria-label="أدوات قصّ السكوت"
        className="mt-auto rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/60 p-2"
      >
        <h3 className="flex items-center gap-1 text-[10px] font-bold text-[var(--ink-primary)]">
          <Radar className="h-3 w-3 text-[var(--brand-gold)]" aria-hidden="true" />
          قصّ السكوت
          {hasSilences && (
            <span className="ms-auto rounded-full bg-[var(--brand-gold)]/20 px-1.5 py-px text-[9px] font-bold text-[var(--brand-gold)] dark:text-[#E6C75A]">
              {toArabicDigits(silencesCount)} فترة
            </span>
          )}
        </h3>
        <label className="mt-1.5 flex items-center justify-between gap-2 text-[9px] font-bold text-[var(--ink-muted)]">
          <span>عتبة السكوت</span>
          <span className="font-mono tabular-nums text-[var(--ink-primary)]">
            {toArabicDigits(Math.round(thresholdRatio * 100))}٪
          </span>
        </label>
        <input
          type="range"
          min={0.02}
          max={0.2}
          step={0.005}
          value={thresholdRatio}
          onChange={(e) => onThresholdChange(Number(e.target.value))}
          aria-label="عتبة السكوت"
          className="h-1 w-full accent-[var(--brand-gold)]"
        />
        <label className="mt-1 flex items-center justify-between gap-2 text-[9px] font-bold text-[var(--ink-muted)]">
          <span>أقصر سكوت</span>
          <span className="font-mono tabular-nums text-[var(--ink-primary)]">
            {toArabicDigits(minSilenceSec.toFixed(1))} ث
          </span>
        </label>
        <input
          type="range"
          min={0.15}
          max={1.5}
          step={0.05}
          value={minSilenceSec}
          onChange={(e) => onMinSilenceChange(Number(e.target.value))}
          aria-label="أقصر سكوت قابل للقصّ"
          className="h-1 w-full accent-[var(--brand-gold)]"
        />
        <div className="mt-2 flex gap-1">
          <button
            type="button"
            onClick={onDetectSilences}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--brand-gold)]/60 bg-[var(--surface-card)] px-2 py-1 text-[10px] font-bold text-[var(--ink-primary)] hover:bg-[var(--brand-gold)]/15"
          >
            <Search className="h-3 w-3 text-[var(--brand-gold)]" aria-hidden="true" />
            كشف
          </button>
          <button
            type="button"
            onClick={onRemoveSilences}
            disabled={!hasSilences}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--brand-emerald)]/60 bg-[var(--surface-card)] px-2 py-1 text-[10px] font-bold text-[var(--ink-primary)] hover:bg-[var(--brand-emerald)]/15 disabled:opacity-40"
          >
            <Scissors className="h-3 w-3 text-[var(--brand-emerald)]" aria-hidden="true" />
            قصّ الكل
          </button>
        </div>
      </section>
    </aside>
  );
}
