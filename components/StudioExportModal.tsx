'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  CheckCircle2,
  Film,
  Loader2,
  Maximize2,
  Minimize2,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { type AudioCacheProgress } from '@/lib/audio-cache';
import { runExportPipeline } from '@/lib/export-pipeline';
import { buildKaraokeExportPlan } from '@/lib/export-karaoke-plan';
import type { AspectPresetId, QulVerse, StudioState } from '@/lib/quran-data';
import { resolveTranslationOption, toArabicDigits } from '@/lib/quran-utils';
import { ExportCompletedCard, type ExportCompletedMeta } from './studio-ui/ExportCompletedCard';
import { ExportSettingsSections } from './studio-ui/ExportSettingsSections';
import { estimateVideoExportDurationSec } from '@/lib/surah-cover';
import {
  estimateExportSizeMb,
  EXPORT_DHIKR_LIST,
  resolveExportDimensions,
  XFADE_MAX_SLIDES,
  type VideoExportSettings,
} from '@/lib/video-export';

interface StudioExportModalProps {
  open: boolean;
  onClose: () => void;
  studioState: StudioState;
  exportSettings: VideoExportSettings;
  onUpdateExportSettings: (patch: Partial<VideoExportSettings>) => void;
  selectedVerses: QulVerse[];
  surahName: string;
  /** English chapter name (QUL name_simple) for the YouTube publish kit. */
  surahNameEn?: string | null;
  /** True when the selected range covers the whole surah. */
  isFullSurah?: boolean;
  reciterName: string;
  getBgImageEl: () => HTMLImageElement | null;
  bgVideoFile: File | null;
  bgVideoName: string;
  customAudioFile: File | null;
  customAudioName: string;
  audioCache: AudioCacheProgress;
  onOpenFullscreen?: () => void;
  onAspectSelect?: (aspect: AspectPresetId) => void;
  onExportSuccess: (filename: string) => void;
  onErrorToast: (msg: string) => void;
}

type RenderStage = 'idle' | 'rendering_slides' | 'encoding_video' | 'done' | 'error';

export function StudioExportModal({
  open,
  onClose,
  studioState,
  exportSettings,
  onUpdateExportSettings,
  selectedVerses,
  surahName,
  surahNameEn,
  isFullSurah,
  reciterName,
  getBgImageEl,
  bgVideoFile,
  bgVideoName,
  customAudioFile,
  customAudioName,
  audioCache,
  onOpenFullscreen,
  onAspectSelect,
  onExportSuccess,
  onErrorToast,
}: StudioExportModalProps) {
  const [stage, setStage] = useState<RenderStage>('idle');
  const [progressPct, setProgressPct] = useState(0);
  const [stageLabel, setStageLabel] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [dhikrIdx, setDhikrIdx] = useState(0);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedMeta, setExportedMeta] = useState<ExportCompletedMeta | null>(null);

  const abortCtrlRef = useRef<AbortController | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  // Clean up any local blob URL on unmount
  useEffect(() => {
    return () => {
      if (exportedUrl && exportedUrl.startsWith('blob:')) {
        URL.revokeObjectURL(exportedUrl);
      }
    };
  }, [exportedUrl]);

  const isBusy = stage === 'rendering_slides' || stage === 'encoding_video';
  const hasBgVideo = studioState.bgType === 'video' && Boolean(bgVideoFile);

  // Rotate Arabic Dhikr gently while exporting
  useEffect(() => {
    if (!isBusy) return;
    const timer = setInterval(() => {
      setDhikrIdx((prev) => (prev + 1) % EXPORT_DHIKR_LIST.length);
    }, 2800);
    return () => clearInterval(timer);
  }, [isBusy]);

  // Derived export estimates: target dimensions, intro cover + ~5.5s/verse duration, size.
  const { targetDims, estimatedSizeMb, karaokeSlideCount } = useMemo(() => {
    const dims = resolveExportDimensions(
      studioState.width,
      studioState.height,
      exportSettings.resolution
    );
    const durationSec = estimateVideoExportDurationSec({
      verseCount: selectedVerses.length,
      verseGapSec: exportSettings.verseGapSec,
      includeIntroCover: exportSettings.includeIntroCover !== false,
    });
    const sizeMb = estimateExportSizeMb({
      durationSec,
      width: dims.width,
      height: dims.height,
      fps: exportSettings.fps,
      quality: exportSettings.quality,
      audioBitrateKbps: exportSettings.audioBitrate,
    });
    const plan = buildKaraokeExportPlan(
      studioState,
      selectedVerses,
      dims,
      exportSettings.includeIntroCover !== false
    );
    return {
      targetDims: dims,
      estimatedSizeMb: sizeMb,
      karaokeSlideCount: plan ? plan.totalSlides : 0,
    };
  }, [
    studioState,
    selectedVerses,
    exportSettings.resolution,
    exportSettings.fps,
    exportSettings.quality,
    exportSettings.audioBitrate,
    exportSettings.verseGapSec,
    exportSettings.includeIntroCover,
  ]);

  // Network helpers (rate-limit retries, verified blob download, trigger
  // download) live in lib/export-network.ts per the 600-line file rule.

  const handleCancelExport = () => {
    abortCtrlRef.current?.abort();
    abortCtrlRef.current = null;
    const jobId = activeJobIdRef.current;
    activeJobIdRef.current = null;
    if (jobId) {
      fetch(`/api/studio/export/session?id=${encodeURIComponent(jobId)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
    setStage('idle');
    setProgressPct(0);
    setMinimized(false);
    setStageLabel('');
    onErrorToast('تم إيقاف عملية تصدير الفيديو');
  };

  const handleStartExport = async () => {
    if (exportedUrl && exportedUrl.startsWith('blob:')) {
      URL.revokeObjectURL(exportedUrl);
    }
    setExportedUrl(null);
    setExportedBlob(null);
    setExportedMeta(null);

    const controller = new AbortController();
    abortCtrlRef.current = controller;
    activeJobIdRef.current = null;

    setErrorMessage(null);
    setMinimized(false);
    setDhikrIdx(0);
    setStage('rendering_slides');
    setProgressPct(3);
    setStageLabel('تهيئة جلسة التصدير وتجهيز الخطوط...');

    try {
      await runExportPipeline(
        {
          studioState,
          exportSettings,
          selectedVerses,
          surahName,
          reciterName,
          customAudioFile,
          bgVideoFile,
          getBgImageEl,
          targetDims,
          signal: controller.signal,
        },
        {
          onJobCreated: (id) => { activeJobIdRef.current = id; },
          onStage: setStage,
          onProgress: setProgressPct,
          onStageLabel: setStageLabel,
          onErrorToast,
          onExportSuccess: ({ localBlobUrl, localBlob, ...meta }) => {
            setExportedUrl(localBlobUrl ?? meta.streamUrl);
            setExportedBlob(localBlob ?? null);
            setExportedMeta(meta);
            setProgressPct(100);
            setStage('done');
            setStageLabel('اكتمل تصدير الفيديو بنجاح');
            abortCtrlRef.current = null;
            activeJobIdRef.current = null;
            onExportSuccess(meta.filename);
          },
        }
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      activeJobIdRef.current = null;
      abortCtrlRef.current = null;
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء تصدير الفيديو';
      setStage('error');
      setMinimized(false);
      setErrorMessage(msg);
      onErrorToast(msg);
    }
  };

  if (!open) return null;

  // Floating background export chip when minimized
  if (minimized) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-5 left-5 z-50 flex items-center gap-3 rounded-2xl border border-[var(--brand-gold)]/60 bg-[var(--surface-card)] px-4 py-3 shadow-2xl"
      >
        {isBusy ? (
          <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-gold)]" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-[var(--brand-emerald)] dark:text-[#E6C75A]" aria-hidden="true" />
        )}
        <div className="min-w-[150px]">
          <p className="text-xs font-bold text-[var(--ink-primary)]">
            {isBusy ? `جاري التصدير (${progressPct}%)` : 'اكتمل تصدير الفيديو'}
          </p>
          <p className="truncate text-[11px] text-[var(--ink-muted)]">
            {isBusy ? EXPORT_DHIKR_LIST[dhikrIdx] : exportedMeta?.filename}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="إظهار نافذة التصدير"
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-gold)] px-2.5 py-1.5 text-xs font-bold text-[#1F1705]"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>عرض</span>
        </button>
      </div>
    );
  }

  const ringRadius = 56;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - progressPct / 100);
  const activeTranslation = resolveTranslationOption(studioState.translationId);

  return (
    <DialogPrimitive.Root
      open={open && !minimized}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isBusy) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/75" />
        <DialogPrimitive.Content
          dir="rtl"
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => {
            if (isBusy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (isBusy) e.preventDefault();
          }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[94vw] max-w-[740px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] shadow-2xl focus:outline-none"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-gold)]/18 text-[var(--brand-emerald)] dark:text-[#E6C75A]">
                <Film className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <DialogPrimitive.Title className="font-display text-lg font-bold text-[var(--ink-primary)]">
                  إعدادات وتصدير الفيديو
                </DialogPrimitive.Title>
                <p className="text-xs text-[var(--ink-muted)]">
                  تصدير مباشر عالي الدقة · سورة {surahName} (
                  {toArabicDigits(studioState.fromAyah)}–{toArabicDigits(studioState.toAyah)})
                  {studioState.textSource !== 'uthmani' ? ` · ${activeTranslation.name}` : ''}
                </p>
              </div>
            </div>

            <DialogPrimitive.Close
              disabled={isBusy}
              aria-label="إغلاق نافذة التصدير"
              className="grid h-9 w-9 place-items-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink-primary)] disabled:opacity-40"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          {/* Scrollable Body */}
          <div className="studio-scroll flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {isBusy ? (
            /* Spiritual Dhikr Circular Progress View */
            <div
              role="status"
              aria-live="polite"
              data-testid="export-dhikr-progress"
              className="flex flex-col items-center justify-center rounded-2xl border border-[var(--brand-gold)]/30 bg-[var(--surface-subtle)]/70 px-6 py-8 text-center"
            >
              <p className="text-xs font-semibold text-[var(--ink-muted)]">
                اذكر الله أثناء تجهيز المقطع
              </p>
              <p className="font-quran mt-2 text-3xl text-[var(--brand-emerald)] dark:text-[#E6C75A]">
                {EXPORT_DHIKR_LIST[dhikrIdx]}
              </p>

              {/* Golden Circular SVG Progress Ring */}
              <div className="relative my-6 grid h-36 w-36 place-items-center">
                <svg className="-rotate-90 h-36 w-36" viewBox="0 0 132 132" aria-hidden="true">
                  <circle cx="66" cy="66" r={ringRadius} fill="none" stroke="currentColor" strokeWidth="7" className="text-[var(--border-hairline)]" />
                  <circle cx="66" cy="66" r={ringRadius} fill="none" stroke="#C9A227" strokeWidth="7" strokeLinecap="round" strokeDasharray={ringCircumference} strokeDashoffset={ringDashOffset} className="transition-[stroke-dashoffset] duration-300" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-[var(--ink-primary)] tabular-nums">
                    {progressPct}%
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--ink-muted)]">
                    {exportSettings.format.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/12 px-4 py-1.5 text-xs font-bold text-[var(--ink-primary)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--brand-gold)]" aria-hidden="true" />
                <span>{stageLabel}</span>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setMinimized(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold text-[var(--ink-primary)] hover:border-[var(--brand-gold)]"
                >
                  <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>التصدير في الخلفية (تصغير)</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelExport}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-500/20 dark:text-red-300"
                >
                  <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>إيقاف التصدير</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Strip */}
              <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/75 p-3 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] text-[var(--ink-muted)]">عدد الشرائح</p>
                  <p className="text-sm font-bold text-[var(--ink-primary)] tabular-nums">
                    {karaokeSlideCount > 0
                      ? `${toArabicDigits(karaokeSlideCount)} شريحة تتبّع`
                      : `${toArabicDigits(selectedVerses.length)} آيات`}
                    {karaokeSlideCount === 0 && exportSettings.includeIntroCover !== false ? ' + غلاف' : ''}
                  </p>
                  {karaokeSlideCount > 0 && (
                    <p className="mt-0.5 text-[10px] text-[var(--brand-emerald)] dark:text-[#E6C75A]">
                      تتبّع كلمة-بكلمة متزامن مع التلاوة
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-[var(--ink-muted)]">الأبعاد النهائية</p>
                  <p className="text-sm font-bold text-[var(--ink-primary)] tabular-nums">
                    {targetDims.width}×{targetDims.height}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--ink-muted)]">الصوت المستخدم</p>
                  <p className="truncate text-sm font-bold text-[var(--brand-emerald)] dark:text-[#E6C75A]">
                    {customAudioFile ? customAudioName : reciterName.split(' ').slice(0, 2).join(' ')}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--ink-muted)]">الحجم التقريبي</p>
                  <p dir="ltr" className="text-right text-sm font-bold text-[var(--ink-primary)] tabular-nums">
                    ~{estimatedSizeMb} MB
                  </p>
                </div>
              </div>

              {!customAudioFile && audioCache.total > 0 && (
                <div
                  data-testid="export-audio-cache-banner"
                  data-cache-status={audioCache.status}
                  className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                    audioCache.status === 'ready'
                      ? 'border-emerald-600/40 bg-emerald-600/10 text-[var(--ink-primary)]'
                      : 'border-[var(--brand-gold)]/45 bg-[var(--brand-gold)]/10 text-[var(--ink-primary)]'
                  }`}
                >
                  {audioCache.status === 'ready' ? (
                    <CheckCircle2
                      className="h-4 w-4 shrink-0 text-[var(--brand-emerald)] dark:text-[#E6C75A]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Loader2
                      className="h-4 w-4 shrink-0 animate-spin text-[var(--brand-gold)]"
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    {audioCache.status === 'ready'
                      ? `الصوت جاهز بالكامل في كاش المتصفح (${toArabicDigits(audioCache.cached)} / ${toArabicDigits(audioCache.total)} آية) — سيتم التصدير مباشرة من الكاش دون إعادة تحميل التلاوات.`
                      : `جاري تجهيز الصوت في كاش المتصفح (${toArabicDigits(audioCache.cached)} / ${toArabicDigits(audioCache.total)} آية)... يمكنك التصدير الآن وسيتم استخدام المتاح في الكاش تلقائياً.`}
                  </span>
                </div>
              )}

              {hasBgVideo && (
                <div
                  data-testid="bg-video-export-badge"
                  className="flex items-center gap-2 rounded-xl border border-emerald-600/40 bg-emerald-600/10 px-3.5 py-2.5 text-xs font-semibold text-[var(--ink-primary)]"
                >
                  <Film className="h-4 w-4 shrink-0 text-[var(--brand-emerald)] dark:text-[#E6C75A]" aria-hidden="true" />
                  <span>
                    خلفية فيديو متحرك: <strong className="text-[var(--brand-emerald)] dark:text-[#E6C75A]">{bgVideoName}</strong> — سيُدمج تلقائياً بحركة متواصلة مع شفافية النصوص والزخرفة.
                  </span>
                </div>
              )}

              {selectedVerses.length > XFADE_MAX_SLIDES && (
                <div
                  data-testid="long-surah-fast-engine-note"
                  className="rounded-xl border border-[var(--brand-gold)]/45 bg-[var(--brand-gold)]/10 px-3.5 py-2.5 text-xs font-semibold text-[var(--ink-primary)]"
                >
                  تصدير السور الطويلة ({toArabicDigits(selectedVerses.length)} آية) يستخدم محرك
                  الدمج السريع مع تلاشٍ ناعم عند بداية كل شريحة — والانتقال المتقاطع الكامل
                  (xFade) يعمل حتى {toArabicDigits(XFADE_MAX_SLIDES)} آية.
                </div>
              )}

              {stage === 'error' && errorMessage && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs font-semibold text-red-700 dark:text-red-300">
                  {errorMessage}
                </div>
              )}

              {stage === 'done' && exportedUrl && exportedMeta && (
                <ExportCompletedCard
                  exportedUrl={exportedUrl}
                  exportedMeta={exportedMeta}
                  exportedBlob={exportedBlob}
                  surahName={surahName}
                  surahNameEn={surahNameEn}
                  isFullSurah={isFullSurah}
                  translationName={
                    studioState.textSource !== 'uthmani' ? activeTranslation.name : null
                  }
                  selectedVerses={selectedVerses}
                  studioState={studioState}
                  targetDims={targetDims}
                  getBgImageEl={getBgImageEl}
                  fromAyah={studioState.fromAyah}
                  toAyah={studioState.toAyah}
                  reciterName={reciterName}
                  onErrorToast={onErrorToast}
                />
              )}

              <ExportSettingsSections
                exportSettings={exportSettings}
                onUpdateExportSettings={onUpdateExportSettings}
                studioState={studioState}
                sampleVerses={selectedVerses}
                surahName={surahName}
                reciterName={reciterName}
                getBgImageEl={getBgImageEl}
                onAspectSelect={onAspectSelect}
                onOpenFullscreen={() => {
                  onClose();
                  onOpenFullscreen?.();
                }}
              />
            </>
          )}
        </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 px-5 py-3.5">
            <button
              type="button"
              disabled={isBusy}
              onClick={onClose}
              className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)] disabled:opacity-40"
            >
              إغلاق
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={handleStartExport}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-gold)] px-5 py-2.5 text-sm font-bold text-[#1F1705] shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {isBusy
                  ? 'جارٍ المعالجة والتصدير...'
                  : stage === 'done'
                    ? 'إعادة التصدير بالإعدادات الحالية'
                    : `بدء تصدير الفيديو (${exportSettings.format.toUpperCase()})`}
              </span>
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
