'use client';

import React from 'react';
import {
  Check,
  Info,
  Languages,
  Loader2,
  Mic,
  Minus,
  Play,
  Plus,
  Search,
  Square,
  Upload,
  X,
} from 'lucide-react';
import {
  RECITERS,
  TRANSLATIONS,
  type QulChapter,
  type StudioState,
  type TextSourceMode,
} from '@/lib/quran-data';
import { clampVerseRange, toArabicDigits } from '@/lib/quran-utils';
import { getStudioActiveReciters } from '@/lib/reciter-filter';
import { useApp } from '../AppProvider';
import { StudioSelect } from './StudioSelect';
import { StudioSurahSelector } from './StudioSurahSelector';

export type ReciterFilter =
  | 'all'
  | 'popular'
  | 'murattal'
  | 'mujawwad'
  | 'warsh'
  | 'muallim';

interface StudioRecitationPanelProps {
  state: StudioState;
  chapters: QulChapter[];
  totalChapterVerses: number;
  selectedVersesCount: number;
  customAudioUrl: string | null;
  customAudioName: string;
  reciterQuery: string;
  reciterFilter: ReciterFilter;
  previewingReciter: string | null;
  audioFileInputRef: React.RefObject<HTMLInputElement | null>;
  onSelectSurah: (surahId: number) => void;
  onChangeRange: (fromAyah: number, toAyah: number) => void;
  onChangeTextSource: (mode: TextSourceMode) => void;
  onChangeTranslation: (translationId: number) => void;
  loadingTranslation?: boolean;
  onAudioFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveCustomAudio: () => void;
  onReciterQueryChange: (q: string) => void;
  onReciterFilterChange: (filter: ReciterFilter) => void;
  onSelectReciter: (slug: string) => void;
  onPreviewReciter: (slug: string) => void;
}

const RECITER_FILTER_TABS: { id: ReciterFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'popular', label: 'الأشهر' },
  { id: 'murattal', label: 'مرتل' },
  { id: 'mujawwad', label: 'مجود' },
  { id: 'warsh', label: 'ورش' },
  { id: 'muallim', label: 'معلم' },
];

const TEXT_SOURCE_OPTIONS: { id: TextSourceMode; label: string }[] = [
  { id: 'uthmani', label: 'عثماني' },
  { id: 'both', label: 'مع الترجمة' },
  { id: 'translation', label: 'ترجمة فقط' },
];

export function StudioRecitationPanel({
  state,
  chapters,
  totalChapterVerses,
  selectedVersesCount,
  customAudioUrl,
  customAudioName,
  reciterQuery,
  reciterFilter,
  previewingReciter,
  audioFileInputRef,
  onSelectSurah,
  onChangeRange,
  onChangeTextSource,
  onChangeTranslation,
  loadingTranslation = false,
  onAudioFileUpload,
  onRemoveCustomAudio,
  onReciterQueryChange,
  onReciterFilterChange,
  onSelectReciter,
  onPreviewReciter,
}: StudioRecitationPanelProps) {
  const maxVerse = totalChapterVerses || 286;
  const { config } = useApp();

  const activeReciters = React.useMemo(() => {
    return getStudioActiveReciters(config?.customReciters, config?.disabledReciters);
  }, [config?.customReciters, config?.disabledReciters]);

  const filteredReciters = React.useMemo(() => {
    const q = reciterQuery.trim().toLowerCase();
    return activeReciters.filter((r) => {
      if (reciterFilter === 'popular' && !r.popular) return false;
      if (reciterFilter === 'murattal' && r.style !== 'murattal') return false;
      if (reciterFilter === 'mujawwad' && r.style !== 'mujawwad') return false;
      if (reciterFilter === 'warsh' && r.style !== 'warsh') return false;
      if (reciterFilter === 'muallim' && r.style !== 'muallim') return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        r.styleLabel.includes(q)
      );
    });
  }, [activeReciters, reciterQuery, reciterFilter]);

  const stepFrom = (delta: number) => {
    const clamped = clampVerseRange(state.fromAyah + delta, state.toAyah, maxVerse);
    onChangeRange(clamped.fromAyah, clamped.toAyah);
  };

  const stepTo = (delta: number) => {
    const clamped = clampVerseRange(state.fromAyah, state.toAyah + delta, maxVerse);
    onChangeRange(clamped.fromAyah, clamped.toAyah);
  };

  return (
    <aside
      aria-label="إعدادات التلاوة والآيات"
      className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] xl:h-full"
    >
      {/* Panel Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-hairline)] px-4 py-3">
        <h2 className="font-display flex items-center gap-2 text-sm font-bold text-[var(--ink-primary)]">
          <Mic className="h-4 w-4 text-[var(--brand-gold)]" aria-hidden="true" />
          <span>التلاوة والآيات</span>
        </h2>
        <span className="text-xs font-medium text-[var(--ink-muted)] tabular-nums">
          {toArabicDigits(selectedVersesCount)} آية
        </span>
      </div>

      <div className="studio-scroll min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4">
        {/* Surah Selection */}
        <div className="space-y-3">
          <StudioSurahSelector
            currentSurahId={state.surah}
            chapters={chapters}
            onSelectSurah={onSelectSurah}
          />

          {/* Precision Verse Range Steppers */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="studio-from-ayah"
                className="mb-1 block text-xs font-semibold text-[var(--ink-muted)]"
              >
                من آية
              </label>
              <div className="flex h-9 items-center overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)]">
                <button
                  type="button"
                  onClick={() => stepFrom(-1)}
                  disabled={state.fromAyah <= 1}
                  aria-label="إنقاص بداية الآية"
                  className="grid h-full w-8 shrink-0 place-items-center text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--ink-primary)] disabled:opacity-35"
                >
                  <Minus className="h-3 w-3" aria-hidden="true" />
                </button>
                <input
                  id="studio-from-ayah"
                  type="number"
                  min={1}
                  max={maxVerse}
                  value={state.fromAyah}
                  onChange={(e) => {
                    const clamped = clampVerseRange(
                      Number(e.target.value),
                      state.toAyah,
                      maxVerse
                    );
                    onChangeRange(clamped.fromAyah, clamped.toAyah);
                  }}
                  className="h-full w-full min-w-0 bg-transparent text-center text-sm font-bold text-[var(--ink-primary)] tabular-nums focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => stepFrom(1)}
                  disabled={state.fromAyah >= maxVerse}
                  aria-label="زيادة بداية الآية"
                  className="grid h-full w-8 shrink-0 place-items-center text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--ink-primary)] disabled:opacity-35"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="studio-to-ayah"
                className="mb-1 block text-xs font-semibold text-[var(--ink-muted)]"
              >
                إلى آية
              </label>
              <div className="flex h-9 items-center overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)]">
                <button
                  type="button"
                  onClick={() => stepTo(-1)}
                  disabled={state.toAyah <= state.fromAyah}
                  aria-label="إنقاص نهاية الآية"
                  className="grid h-full w-8 shrink-0 place-items-center text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--ink-primary)] disabled:opacity-35"
                >
                  <Minus className="h-3 w-3" aria-hidden="true" />
                </button>
                <input
                  id="studio-to-ayah"
                  type="number"
                  min={state.fromAyah}
                  max={maxVerse}
                  value={state.toAyah}
                  onChange={(e) => {
                    const clamped = clampVerseRange(
                      state.fromAyah,
                      Number(e.target.value),
                      maxVerse
                    );
                    onChangeRange(clamped.fromAyah, clamped.toAyah);
                  }}
                  className="h-full w-full min-w-0 bg-transparent text-center text-sm font-bold text-[var(--ink-primary)] tabular-nums focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => stepTo(1)}
                  disabled={state.toAyah >= maxVerse}
                  aria-label="زيادة نهاية الآية"
                  className="grid h-full w-8 shrink-0 place-items-center text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--ink-primary)] disabled:opacity-35"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Range Presets */}
          {totalChapterVerses > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onChangeRange(1, totalChapterVerses)}
                className={`flex-1 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  state.fromAyah === 1 && state.toAyah === totalChapterVerses
                    ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--ink-primary)]'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:border-[var(--brand-gold)]/60 hover:text-[var(--ink-primary)]'
                }`}
              >
                السورة كاملة ({toArabicDigits(totalChapterVerses)})
              </button>
              {totalChapterVerses > 5 && (
                <button
                  type="button"
                  onClick={() => onChangeRange(1, 5)}
                  className={`whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                    state.fromAyah === 1 && state.toAyah === 5
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--ink-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:border-[var(--brand-gold)]/60 hover:text-[var(--ink-primary)]'
                  }`}
                >
                  ١–٥
                </button>
              )}
              {totalChapterVerses > 10 && (
                <button
                  type="button"
                  onClick={() => onChangeRange(1, 10)}
                  className={`whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                    state.fromAyah === 1 && state.toAyah === 10
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--ink-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:border-[var(--brand-gold)]/60 hover:text-[var(--ink-primary)]'
                  }`}
                >
                  ١–١٠
                </button>
              )}
            </div>
          )}

          {/* Text Source Segmented Control */}
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-[var(--ink-muted)]">
              محتوى النص على التصميم
            </span>
            <div
              role="group"
              aria-label="محتوى النص على التصميم"
              className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--surface-subtle)] p-1"
            >
              {TEXT_SOURCE_OPTIONS.map((opt) => {
                const active = state.textSource === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChangeTextSource(opt.id)}
                    className={`whitespace-nowrap rounded-md py-1.5 text-[11px] font-semibold transition-all ${
                      active
                        ? 'bg-[var(--surface-card)] text-[var(--ink-primary)] shadow-sm ring-1 ring-[var(--brand-gold)]/55'
                        : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Approved QUL Translation Selector (shown when translation is enabled) */}
            {state.textSource !== 'uthmani' && (
              <div
                data-testid="studio-translation-panel"
                className="mt-2.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/65 p-2.5"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label
                    htmlFor="studio-translation-select"
                    className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ink-primary)]"
                  >
                    <Languages
                      className="h-3.5 w-3.5 text-[var(--brand-gold)]"
                      aria-hidden="true"
                    />
                    <span>الترجمة المعتمدة (من QUL)</span>
                  </label>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--ink-muted)] tabular-nums">
                    {loadingTranslation ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-[var(--brand-gold)]" aria-hidden="true" />
                        <span>تحديث...</span>
                      </>
                    ) : (
                      <span>{toArabicDigits(TRANSLATIONS.length)} ترجمات</span>
                    )}
                  </span>
                </div>
                <StudioSelect
                  aria-label="اختيار الترجمة المعتمدة من QUL"
                  value={String(state.translationId)}
                  options={TRANSLATIONS.map((t) => ({ value: String(t.id), label: t.name }))}
                  onChange={(v) => onChangeTranslation(Number(v))}
                />
              </div>
            )}
          </div>
        </div>

        {/* Custom Audio Upload Section */}
        <div className="border-t border-[var(--border-hairline)] pt-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="block text-xs font-bold text-[var(--ink-primary)]">
                ملف صوتي مخصص
              </span>
              <span className="block text-[10px] text-[var(--ink-muted)]">
                لمزامنة تلاوتك الخاصة
              </span>
            </div>
            <button
              type="button"
              onClick={() => audioFileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/15 px-3 py-1.5 text-xs font-bold text-[var(--ink-primary)] shadow-sm transition-all hover:bg-[var(--brand-gold)] hover:text-[#1F1705]"
            >
              <Upload className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
              <span>رفع تلاوة 🎙️</span>
            </button>
            <input
              ref={audioFileInputRef}
              type="file"
              accept="audio/*"
              onChange={onAudioFileUpload}
              className="hidden"
            />
          </div>
          {customAudioUrl ? (
            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs">
              <span className="truncate font-bold text-emerald-700 dark:text-emerald-300">
                ✓ تلاوة خاصة نشطة: {customAudioName}
              </span>
              <button
                type="button"
                onClick={onRemoveCustomAudio}
                aria-label="إزالة الملف الصوتي المخصص"
                className="shrink-0 rounded p-1 text-[var(--ink-muted)] hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-muted)]">
              إذا كان لديك مقطع مقتطع للآية، ارفعه هنا ليتطابق مع الشريحة فوراً.
            </p>
          )}
        </div>

        {/* Reciter Directory */}
        <div className="border-t border-[var(--border-hairline)] pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--ink-primary)]">
              القرّاء المتاحون للمزامنة
            </h3>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {toArabicDigits(filteredReciters.length)} قارئ مجزأ آية بآية ⚡
            </span>
          </div>

          <div className="relative mt-2">
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

          {/* Filter Tabs */}
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-[var(--surface-subtle)] p-1">
            {RECITER_FILTER_TABS.map((rf) => (
              <button
                key={rf.id}
                type="button"
                aria-pressed={reciterFilter === rf.id}
                onClick={() => onReciterFilterChange(rf.id)}
                className={`whitespace-nowrap rounded-md px-1.5 py-1 text-[11px] font-semibold transition-colors ${
                  reciterFilter === rf.id
                    ? 'bg-[var(--brand-gold)] text-[#1F1705]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                }`}
              >
                {rf.label}
              </button>
            ))}
          </div>

          {/* Reciters List */}
          <div className="studio-scroll mt-2.5 max-h-[300px] divide-y divide-[var(--border-hairline)]/60 overflow-y-auto rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/35">
            {filteredReciters.length === 0 ? (
              <div className="py-6 text-center text-xs text-[var(--ink-muted)]">
                لا يوجد قارئ مطابق للبحث
              </div>
            ) : (
              filteredReciters.map((r) => {
                const selected = state.reciter === r.slug;
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
                          {r.styleLabel} · {toArabicDigits(r.bitrate)}kbps · <span className="font-semibold text-emerald-600 dark:text-emerald-400">متزامن ⚡</span>
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
      </div>
    </aside>
  );
}
