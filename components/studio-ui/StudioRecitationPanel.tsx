'use client';

import React from 'react';
import {
  Languages,
  Loader2,
  Mic,
  Minus,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import {
  TRANSLATIONS,
  type QulChapter,
  type StudioState,
  type TextSourceMode,
} from '@/lib/quran-data';
import {
  areAllCurtainsCollapsed,
  areAllCurtainsExpanded,
  collapseAllCurtains,
  DEFAULT_OPEN_RECITATION_CURTAINS,
  expandAllCurtains,
  isCurtainOpen,
  RECITATION_CURTAIN_IDS,
  toggleCurtainId,
} from '@/lib/accordion-state';
import { clampVerseRange, toArabicDigits } from '@/lib/quran-utils';
import { getStudioActiveReciters } from '@/lib/reciter-filter';
import { useApp } from '../AppProvider';
import {
  StudioAccordionCurtain,
  StudioCurtainToolbar,
} from './StudioAccordionCurtain';
import { StudioCustomAudioBoundsPanel } from './StudioCustomAudioBoundsPanel';
import { StudioReciterDirectory } from './StudioReciterDirectory';
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
  /** الملف المرفوع نفسه (File) — تُحلَّل حدود آياته محلياً في المتصفح. */
  customAudioFile?: File | null;
  /** موضع التشغيل الحالي (ثوانٍ) — لزر «اجعل بداية الآية هنا». */
  audioCurrentTime?: number;
  /** مدة الملف الصوتي الحالي (ثوانٍ). */
  audioDuration?: number;
  /** هل التشغيل جارٍ الآن؟ */
  isPlaying?: boolean;
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
  /** تعديل جزئي لحالة الاستوديو (حدود الآيات وغيرها). */
  onPatchState: (patch: Partial<StudioState>) => void;
  /** إشعارات عائمة قصيرة (نتائج الكشف/الضبط). */
  showToast: (msg: string) => void;
  onReciterQueryChange: (q: string) => void;
  onReciterFilterChange: (filter: ReciterFilter) => void;
  onSelectReciter: (slug: string) => void;
  onPreviewReciter: (slug: string) => void;
}

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
  customAudioFile = null,
  audioCurrentTime = 0,
  audioDuration = 0,
  isPlaying = false,
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
  onPatchState,
  showToast,
  onReciterQueryChange,
  onReciterFilterChange,
  onSelectReciter,
  onPreviewReciter,
}: StudioRecitationPanelProps) {
  const maxVerse = totalChapterVerses || 286;
  const { config } = useApp();
  const [openCurtains, setOpenCurtains] = React.useState<string[]>(() => [
    ...DEFAULT_OPEN_RECITATION_CURTAINS,
  ]);
  const allCurtainsOpen = areAllCurtainsExpanded(
    openCurtains,
    RECITATION_CURTAIN_IDS
  );
  const allCurtainsClosed = areAllCurtainsCollapsed(
    openCurtains,
    RECITATION_CURTAIN_IDS
  );

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
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display flex items-center gap-2 text-sm font-bold text-[var(--ink-primary)]">
            <Mic className="h-4 w-4 text-[var(--brand-gold)]" aria-hidden="true" />
            <span>التلاوة والآيات</span>
          </h2>
          <span className="rounded-md bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--ink-muted)] tabular-nums">
            {toArabicDigits(selectedVersesCount)} آية
          </span>
        </div>
        <StudioCurtainToolbar
          allOpen={allCurtainsOpen}
          allClosed={allCurtainsClosed}
          onExpandAll={() =>
            setOpenCurtains((prev) =>
              expandAllCurtains(prev, RECITATION_CURTAIN_IDS)
            )
          }
          onCollapseAll={() =>
            setOpenCurtains((prev) =>
              collapseAllCurtains(prev, RECITATION_CURTAIN_IDS)
            )
          }
          testIdPrefix="recitation-curtains"
        />
      </div>

      <div className="studio-scroll min-h-0 min-w-0 flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden p-3 sm:p-3.5">
        {/* Surah Selection Curtain */}
        <StudioAccordionCurtain
          id="rec-surah"
          title="السورة ونطاق الآيات والنص"
          open={isCurtainOpen(openCurtains, 'rec-surah')}
          onToggle={() =>
            setOpenCurtains((prev) => toggleCurtainId(prev, 'rec-surah'))
          }
          badge={
            <span className="rounded-md bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink-muted)] tabular-nums">
              {toArabicDigits(state.fromAyah)}–{toArabicDigits(state.toAyah)}
            </span>
          }
        >
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
        </StudioAccordionCurtain>

        {/* Custom Audio Upload Curtain */}
        <StudioAccordionCurtain
          id="rec-custom-audio"
          title="ملف صوتي مخصص"
          open={isCurtainOpen(openCurtains, 'rec-custom-audio')}
          onToggle={() =>
            setOpenCurtains((prev) => toggleCurtainId(prev, 'rec-custom-audio'))
          }
          badge={
            customAudioUrl ? (
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                نشط
              </span>
            ) : undefined
          }
        >
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="block text-[11px] text-[var(--ink-muted)]">
              لمزامنة تلاوتك الخاصة مع الشرائح
            </span>
            <button
              type="button"
              onClick={() => audioFileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/15 px-3 py-1.5 text-xs font-bold text-[var(--ink-primary)] shadow-sm transition-all hover:bg-[var(--brand-gold)] hover:text-[#1F1705]"
            >
              <Upload className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
              <span>رفع تلاوة</span>
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
            <>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs">
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
              {/* اسم القارئ للتلاوة المرفوعة — يظهر في تذييل المعاينة والتصدير */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="custom-reciter-name"
                  className="shrink-0 text-[11px] font-semibold text-[var(--ink-muted)]"
                >
                  اسم القارئ
                </label>
                <input
                  id="custom-reciter-name"
                  type="text"
                  value={state.customReciterName ?? ''}
                  maxLength={60}
                  placeholder="مثال: الشيخ عبد الرحمن السديس"
                  onChange={(e) =>
                    onPatchState({ customReciterName: e.target.value })
                  }
                  className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 text-xs font-semibold text-[var(--ink-primary)] placeholder:font-normal placeholder:text-[var(--ink-muted)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--brand-gold)]/60"
                />
              </div>
              <StudioCustomAudioBoundsPanel
                state={state}
                customAudioFile={customAudioFile ?? null}
                audioCurrentTime={audioCurrentTime}
                audioDuration={audioDuration}
                isPlaying={isPlaying}
                onPatchState={onPatchState}
                showToast={showToast}
              />
            </>
          ) : (
            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
              إذا كان لديك مقطع مقتطع للآية، ارفعه هنا ليتطابق مع الشريحة فوراً.
            </p>
          )}
        </div>
        </StudioAccordionCurtain>

        {/* Reciter Directory Curtain */}
        <StudioAccordionCurtain
          id="rec-reciters"
          title="القرّاء المتاحون للمزامنة"
          open={isCurtainOpen(openCurtains, 'rec-reciters')}
          onToggle={() =>
            setOpenCurtains((prev) => toggleCurtainId(prev, 'rec-reciters'))
          }
          badge={
            <span className="rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {toArabicDigits(filteredReciters.length)} قارئ
            </span>
          }
        >
          <StudioReciterDirectory
            selectedSlug={state.reciter}
            reciterQuery={reciterQuery}
            reciterFilter={reciterFilter}
            filteredReciters={filteredReciters}
            previewingReciter={previewingReciter}
            onReciterQueryChange={onReciterQueryChange}
            onReciterFilterChange={onReciterFilterChange}
            onSelectReciter={onSelectReciter}
            onPreviewReciter={onPreviewReciter}
          />
        </StudioAccordionCurtain>
      </div>
    </aside>
  );
}
