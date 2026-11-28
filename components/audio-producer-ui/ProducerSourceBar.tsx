'use client';

/**
 * ProducerSourceBar — شريط المصدر أعلى صفحة «منتج الصوت»:
 * اختيار السورة ونطاق الآيات والقارئ ثم التحميل، أو رفع ملف صوتي —
 * مع حالة التحميل وأزرار التصدير والإرسال إلى الاستوديو.
 */
import React, { useMemo, useRef } from 'react';
import {
  AudioWaveform,
  Download,
  FileAudio,
  Loader2,
  Send,
  Upload,
} from 'lucide-react';
import { formatAudioTime, toArabicDigits } from '@/lib/quran-utils';
import type { QulChapter, QulVerse, ReciterOption } from '@/lib/quran-data';
import { StudioSelect, type StudioSelectOption } from '@/components/studio-ui/StudioSelect';

interface ProducerSourceBarProps {
  chapters: QulChapter[];
  verses: QulVerse[];
  reciters: ReciterOption[];
  surahId: number;
  fromAyah: number;
  toAyah: number;
  reciterSlug: string;
  sourceLabel: string | null;
  sourceKind: 'verses' | 'file' | null;
  sourceDurationSec: number;
  verseCount: number;
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  loadDone: number;
  loadTotal: number;
  rendering: boolean;
  isFileMode: boolean;
  onSurahChange: (id: number) => void;
  onRangeChange: (from: number, to: number) => void;
  onReciterChange: (slug: string) => void;
  onLoadClick: () => void;
  onFileUpload: (file: File) => void;
  onExportWav: () => void;
  onSendToStudio: () => void;
}

export function ProducerSourceBar({
  chapters,
  verses,
  reciters,
  surahId,
  fromAyah,
  toAyah,
  reciterSlug,
  sourceLabel,
  sourceKind,
  sourceDurationSec,
  verseCount,
  loadStatus,
  loadDone,
  loadTotal,
  rendering,
  isFileMode,
  onSurahChange,
  onRangeChange,
  onReciterChange,
  onLoadClick,
  onFileUpload,
  onExportWav,
  onSendToStudio,
}: ProducerSourceBarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chapter = chapters.find((c) => c.id === surahId);
  const versesCount = verses.length || chapter?.verses_count || 7;

  const surahOptions = useMemo<StudioSelectOption[]>(
    () =>
      chapters.map((c) => ({
        value: String(c.id),
        label: `${c.name_arabic} · ${toArabicDigits(c.verses_count)} آية`,
      })),
    [chapters]
  );

  const reciterOptions = useMemo<StudioSelectOption[]>(() => {
    const groups = new Map<string, ReciterOption[]>();
    for (const r of reciters) {
      const g = r.styleLabel ?? 'أخرى';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(r);
    }
    return reciters.map((r) => ({
      value: r.slug,
      label: r.name,
      group: r.styleLabel ?? 'أخرى',
    }));
  }, [reciters]);

  const busy = loadStatus === 'loading';
  const hasRenderable = verseCount >= 0 && sourceDurationSec > 0 && loadStatus === 'ready';

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileUpload(file);
    e.target.value = '';
  };

  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-2.5 sm:gap-3 sm:px-4">
      {/* يمين (بداية RTL): الهوية + المصدر الحالي */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-base font-bold leading-tight text-[var(--brand-emerald)] dark:text-[#E6C75A] sm:text-xl">
            منتج الصوت
          </h1>
          <span className="text-[var(--border-hairline)]" aria-hidden="true">/</span>
          <span className="truncate text-xs font-bold text-[var(--ink-primary)] sm:text-sm">
            {sourceLabel ?? 'محرر تلاوة مستقل'}
          </span>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ink-muted)] tabular-nums sm:text-xs">
          {hasRenderable ? (
            <>
              <span>
                {toArabicDigits(verseCount)} آية · {formatAudioTime(sourceDurationSec)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="max-w-[160px] truncate sm:max-w-[240px]">{sourceLabel}</span>
            </>
          ) : (
            <span>حرّر التلاوة قصّاً وقصّ سكوت ومستوى — ثم صدّرها أو أرسلها للاستوديو</span>
          )}
        </p>
      </div>

      {/* الوسط: مصدر التلاوة */}
      <div className="flex flex-1 flex-wrap items-center justify-center gap-1.5">
        <StudioSelect
          value={String(surahId)}
          options={surahOptions}
          onChange={(v) => onSurahChange(Number(v))}
          aria-label="اختيار السورة"
          compact
          className="min-w-[130px] max-w-[210px] flex-1"
        />
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 py-1">
          <label className="flex items-center gap-1 text-[10px] font-bold text-[var(--ink-muted)]">
            <span>من</span>
            <input
              type="number"
              min={1}
              max={versesCount}
              value={fromAyah}
              onChange={(e) => {
                const from = Math.max(1, Math.min(versesCount, Number(e.target.value) || 1));
                onRangeChange(from, Math.max(from, toAyah));
              }}
              aria-label="من آية"
              className="w-12 rounded bg-transparent text-center text-xs font-bold text-[var(--ink-primary)] tabular-nums outline-none focus:bg-[var(--surface-card)]"
            />
          </label>
          <span className="text-[var(--border-hairline)]" aria-hidden="true">—</span>
          <label className="flex items-center gap-1 text-[10px] font-bold text-[var(--ink-muted)]">
            <span>إلى</span>
            <input
              type="number"
              min={fromAyah}
              max={versesCount}
              value={toAyah}
              onChange={(e) => {
                const to = Math.max(fromAyah, Math.min(versesCount, Number(e.target.value) || fromAyah));
                onRangeChange(fromAyah, to);
              }}
              aria-label="إلى آية"
              className="w-12 rounded bg-transparent text-center text-xs font-bold text-[var(--ink-primary)] tabular-nums outline-none focus:bg-[var(--surface-card)]"
            />
          </label>
          <button
            type="button"
            onClick={() => onRangeChange(1, versesCount)}
            className="rounded px-1 py-0.5 text-[10px] font-bold text-[var(--brand-gold)] hover:underline"
          >
            الكل
          </button>
        </div>
        <StudioSelect
          value={reciterSlug}
          options={reciterOptions}
          onChange={onReciterChange}
          aria-label="اختيار القارئ"
          compact
          className="min-w-[130px] max-w-[210px] flex-1"
        />
        <button
          type="button"
          onClick={onLoadClick}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--brand-emerald)] px-3 text-xs font-bold text-[#FAF7F0] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-[var(--brand-gold)] dark:text-[#1F1705]"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <AudioWaveform className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{busy ? `${toArabicDigits(loadDone)}/${toArabicDigits(loadTotal)}` : 'تحميل للمحرر'}</span>
        </button>
      </div>

      {/* يسار (نهاية RTL): ملف + تصدير + إرسال */}
      <div className="flex shrink-0 items-center gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav,.ogg,.opus,.flac,.aac,.wma,.amr,.webm"
          onChange={handleFileInput}
          className="hidden"
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          title={isFileMode ? 'استبدال الملف المرفوع' : 'أو ارفع ملفاً صوتياً جاهزاً'}
          className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 text-xs font-bold text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)]"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">رفع ملف</span>
        </button>
        <button
          type="button"
          onClick={onExportWav}
          disabled={!hasRenderable || rendering}
          title="رندر المقطع المحرَّر وتنزيله WAV"
          className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/10 px-2.5 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-gold)]/20 disabled:opacity-40"
        >
          {rendering ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{rendering ? 'جارٍ الرندر…' : 'تصدير WAV'}</span>
        </button>
        <button
          type="button"
          onClick={onSendToStudio}
          disabled={!hasRenderable || rendering}
          title="أرسل المقطع المحرَّر إلى الاستوديو كتلاوة مخصصة"
          className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--brand-emerald)] px-3 text-xs font-bold text-[#FAF7F0] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-[var(--brand-gold)] dark:text-[#1F1705]"
        >
          {rendering ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-3.5 w-3.5 text-[#E6C75A] dark:text-[#1F1705]" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">إرسال للاستوديو</span>
        </button>
      </div>
    </div>
  );
}

export function ProducerEmptyState({
  loadStatus,
  message,
  onPickExample,
}: {
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
  onPickExample: () => void;
}) {
  if (loadStatus === 'loading') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border-hairline)] bg-[var(--surface-subtle)]/40 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-gold)]" aria-hidden="true" />
        <p className="text-sm font-bold text-[var(--ink-primary)]">جارٍ تحميل التلاوة إلى المحرر…</p>
        <p className="text-xs text-[var(--ink-muted)]">تُجلب الآيات من كاش المتصفح وتُفكّ وتُدمج محلياً</p>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border-hairline)] bg-[var(--surface-subtle)]/40 p-8 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--brand-emerald)]/10">
        <FileAudio className="h-7 w-7 text-[var(--brand-emerald)] dark:text-[#E6C75A]" aria-hidden="true" />
      </span>
      <h2 className="text-base font-bold text-[var(--ink-primary)]">
        {loadStatus === 'error' ? 'تعذّر التحميل' : 'ابدأ بتحميل تلاوة'}
      </h2>
      <p className="max-w-md text-xs leading-relaxed text-[var(--ink-muted)]">
        {message ??
          'اختر السورة ونطاق الآيات والقارئ أعلاه ثم «تحميل للمحرر» — أو ارفع ملفاً صوتياً جاهزاً. كل التحرير يجري في المتصفح محلياً.'}
      </p>
      {loadStatus !== 'error' && (
        <button
          type="button"
          onClick={onPickExample}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/10 px-3 py-2 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-gold)]/20"
        >
          <AudioWaveform className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
          <span>تجربة سريعة: الفاتحة — العفاسي</span>
        </button>
      )}
    </div>
  );
}
