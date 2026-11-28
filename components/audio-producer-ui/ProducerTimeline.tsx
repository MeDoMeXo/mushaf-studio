'use client';

/**
 * ProducerTimeline — الخط الزمني الاحترافي (نمط محررات الفيديو):
 * شريط أدوات (فصل عند المؤشر، حذف الآية، قصّ التحديد، تراجع/إعادة،
 * المستوى والتطبيع، التقريب، وأزرار موضع الآية) فوق مسار مقاطع الآيات —
 * كل آية مقطع مستقل بموضعه الزمني الحقيقي، وحدوده تُسحب بالماوس
 * (مقبض ذهبي على الحد بين آيتين يضبط بداية الآية التالية) — ثم مسار
 * الموجة الكامل ومفتش المقاطع العائم.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  Gauge,
  Maximize2,
  PanelBottomOpen,
  RotateCcw,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { toArabicDigits, formatAudioTime } from '@/lib/quran-utils';
import type { ProducerSource } from '@/lib/audio-producer/audio-producer-engine';
import type { ProducerEditState, TimeSpan } from '@/lib/audio-producer/audio-producer-edit';
import type { VerseView } from '@/lib/audio-producer/verse-views';
import { ProducerWaveform } from './ProducerWaveform';
import { ProducerClipInspector } from './ProducerClipInspector';

interface ProducerTimelineProps {
  source: ProducerSource;
  edit: ProducerEditState;
  verseViews: VerseView[];
  /** نصوص الآيات للعرض داخل المقاطع (وضع القارئ) — null في وضع الملف */
  verseTexts: string[] | null;
  view: { startSec: number; durSec: number };
  selection: TimeSpan | null;
  silences: TimeSpan[];
  playheadSourceSec: number;
  isPlaying: boolean;
  activeVerseIdx: number;
  selectedVerseIdx: number | null;
  activeClipId: number | null;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  masterGainDb: number;
  normalizeOn: boolean;
  // عمليات
  onSplitAtPlayhead: () => boolean;
  onRemoveVerse: (idx: number) => boolean;
  onCutSelection: () => boolean;
  onRestore: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onMasterGainChange: (db: number) => void;
  onNormalizeChange: (on: boolean) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onSelectVerse: (idx: number) => void;
  onSeekSource: (sec: number) => void;
  onSelectionChange: (span: TimeSpan | null) => void;
  onZoomAt: (anchorRatio: number, factor: number) => void;
  onScrollBy: (deltaSec: number) => void;
  onClipGainChange: (id: number, db: number) => void;
  onClipFadesChange: (id: number, fadeIn: number, fadeOut: number) => void;
  onSeekEdited: (sec: number) => void;
  showToast: (msg: string) => void;
  // موضع الآيات (حدودها الزمنية)
  /** ضبط بداية آية بالفهرس إلى زمن مطلق — بتراجع كامل. */
  onVerseMarkerChange: (idx: number, sec: number) => void;
  /** لقطة تراجع واحدة قبل بدء سحب حدّ آية. */
  onBeginVerseDrag: () => void;
  /** معاينة حية لسحب حدّ آية (بلا لقطات — أُخذت واحدة عند البدء). */
  onPreviewVerseMarker: (idx: number, sec: number) => void;
  /** إزاحة بداية آية بمقدار ± (أزرار الموضع في شريط الأدوات). */
  onNudgeVerse: (idx: number, deltaSec: number) => void;
}

export function ProducerTimeline(props: ProducerTimelineProps) {
  const {
    source,
    edit,
    verseViews,
    verseTexts,
    view,
    selection,
    silences,
    playheadSourceSec,
    isPlaying,
    activeVerseIdx,
    selectedVerseIdx,
    activeClipId,
    canUndo,
    canRedo,
    hasSelection,
    masterGainDb,
    normalizeOn,
    onSplitAtPlayhead,
    onRemoveVerse,
    onCutSelection,
    onRestore,
    onUndo,
    onRedo,
    onMasterGainChange,
    onNormalizeChange,
    onZoomIn,
    onZoomOut,
    onZoomFit,
    onSelectVerse,
    onSeekSource,
    onSelectionChange,
    onZoomAt,
    onScrollBy,
    onClipGainChange,
    onClipFadesChange,
    onSeekEdited,
    showToast,
    onVerseMarkerChange,
    onBeginVerseDrag,
    onPreviewVerseMarker,
    onNudgeVerse,
  } = props;

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const clipsTrackRef = useRef<HTMLDivElement | null>(null);
  const dragEdgeRef = useRef<{ markerIdx: number } | null>(null);

  // سحب المؤشر على مسار المقاطع = تقديم مستمر
  const seekFromPointer = useCallback(
    (clientX: number) => {
      const el = clipsTrackRef.current;
      if (!el || view.durSec <= 0) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeekSource(view.startSec + ratio * view.durSec);
    },
    [onSeekSource, view.durSec, view.startSec]
  );

  /** زمن مصدر من إحداثية أفقية على مسار المقاطع (للحدود المسحوبة). */
  const secFromClientX = useCallback(
    (clientX: number): number | null => {
      const el = clipsTrackRef.current;
      if (!el || view.durSec <= 0) return null;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return view.startSec + ratio * view.durSec;
    },
    [view.durSec, view.startSec]
  );

  /** سحب مقبض حدّ آية: لقطة واحدة عند البدء ثم معاينة حية. */
  const edgeHandleHandlers = useCallback(
    (markerIdx: number) => ({
      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragEdgeRef.current = { markerIdx };
        onBeginVerseDrag();
      },
      onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragEdgeRef.current;
        if (!drag || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const sec = secFromClientX(e.clientX);
        if (sec !== null) onPreviewVerseMarker(drag.markerIdx, sec);
      },
      onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragEdgeRef.current;
        if (!drag) return;
        dragEdgeRef.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // تجاهل
        }
      },
      onLostPointerCapture: () => {
        dragEdgeRef.current = null;
      },
    }),
    [onBeginVerseDrag, onPreviewVerseMarker, secFromClientX]
  );

  const pct = (r: number) => `${(Math.max(0, Math.min(1, r)) * 100).toFixed(2)}%`;
  const ratioOf = (sec: number) => (view.durSec > 0 ? (sec - view.startSec) / view.durSec : 0);
  const playheadRatio = ratioOf(playheadSourceSec);

  const activeVerseView =
    activeVerseIdx >= 0 && activeVerseIdx < verseViews.length ? verseViews[activeVerseIdx] : null;

  const toolBtn =
    'inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 text-[10px] font-bold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)] hover:bg-[var(--brand-gold)]/10 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <section
      aria-label="الخط الزمني"
      className="relative flex min-h-[260px] flex-col gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3 xl:h-[44vh] xl:min-h-[300px] xl:max-h-[520px]"
    >
      {/* ── شريط أدوات الخط الزمني ────────────────────────────────── */}
      <div className="studio-scroll flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => {
            const ok = onSplitAtPlayhead();
            if (ok) showToast('فُصل المقطع عند المؤشر — مقطعان قابلان للقصّ');
          }}
          disabled={!activeVerseView || activeVerseView.status === 'removed'}
          title="فصل الآية عند المؤشر إلى مقطعين (تُقصّ منها)"
          className={`${toolBtn} border-[var(--brand-gold)]/60`}
        >
          <Scissors className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
          فصل عند المؤشر
        </button>
        <button
          type="button"
          onClick={() => onRemoveVerse(activeVerseIdx)}
          disabled={!activeVerseView || activeVerseView.status === 'removed'}
          title="حذف الآية الجارية كاملة من التلاوة"
          className={toolBtn}
        >
          <Trash2 className="h-3.5 w-3.5 text-red-500/80" aria-hidden="true" />
          حذف الآية
        </button>
        <button
          type="button"
          onClick={() => onCutSelection()}
          disabled={!hasSelection}
          title="قصّ التحديد من المقطع"
          className={toolBtn}
        >
          <Scissors className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" />
          قصّ التحديد
        </button>
        <span className="mx-0.5 h-6 w-px shrink-0 bg-[var(--border-hairline)]" aria-hidden="true" />
        <button type="button" onClick={onUndo} disabled={!canUndo} title="تراجع (Ctrl+Z)" className={toolBtn}>
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} title="إعادة (Ctrl+Shift+Z)" className={toolBtn}>
          <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onRestore}
          title="استعادة المقطع كاملاً (تراجع كل القصّ)"
          className={toolBtn}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          استعادة
        </button>
        <span className="mx-0.5 h-6 w-px shrink-0 bg-[var(--border-hairline)]" aria-hidden="true" />
        {/* المستوى الرئيسي */}
        <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2" title="المكسب الرئيسي للمقطع كاملاً">
          <Gauge className="h-3.5 w-3.5 text-[var(--brand-emerald)]" aria-hidden="true" />
          <input
            type="range"
            min={-12}
            max={12}
            step={0.5}
            value={masterGainDb}
            onChange={(e) => onMasterGainChange(Number(e.target.value))}
            aria-label="المكسب الرئيسي (ديسيبل)"
            className="h-1 w-16 accent-[var(--brand-emerald)] xl:w-20"
          />
          <span className="font-mono text-[9px] font-bold tabular-nums text-[var(--ink-muted)]">
            {masterGainDb >= 0 ? '+' : ''}
            {toArabicDigits(masterGainDb.toFixed(1))}dB
          </span>
        </div>
        <button
          type="button"
          onClick={() => onNormalizeChange(!normalizeOn)}
          aria-pressed={normalizeOn}
          title="تطبيع الذروة إلى ٩٥٪ — يوحّد مستوى التلاوة قبل التصدير"
          className={`${toolBtn} ${normalizeOn ? 'border-[var(--brand-emerald)] bg-[var(--brand-emerald)]/15' : ''}`}
        >
          <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
          تطبيع
        </button>
        <span className="mx-0.5 h-6 w-px shrink-0 bg-[var(--border-hairline)]" aria-hidden="true" />
        <button type="button" onClick={onZoomOut} aria-label="تصغير" title="تصغير (ctrl+عجلة)" className={toolBtn}>
          <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button type="button" onClick={onZoomIn} aria-label="تكبير" title="تكبير (ctrl− عجلة)" className={toolBtn}>
          <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onZoomFit}
          aria-label="ملاءمة كاملة"
          title="ملاءمة المقطع كاملاً في العرض"
          className={toolBtn}
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <span className="ms-auto shrink-0" />
        {/* موضع الآية الجارية: إزاحة دقيقة بداية بدايتها */}
        <div
          className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2"
          title="موضع بداية الآية الجارية على الخط الزمني — أو اسحب المقبض الذهبي على حدّ المقطع"
        >
          <span className="text-[10px] font-bold text-[var(--ink-muted)]">موضع الآية</span>
          <button
            type="button"
            onClick={() => onNudgeVerse(activeVerseIdx, -0.25)}
            disabled={activeVerseIdx <= 0}
            aria-label="تقديم بداية الآية ربع ثانية"
            className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-gold)]/15 disabled:opacity-40"
          >
            −٠٫٢٥
          </button>
          <label className="flex items-center gap-0.5" dir="ltr">
            <input
              type="number"
              min={0}
              max={Math.max(0, source.durationSec)}
              step={0.05}
              value={Number((source.verseMarkersSec[activeVerseIdx] ?? 0).toFixed(2))}
              onChange={(e) => onVerseMarkerChange(activeVerseIdx, Number(e.target.value) || 0)}
              disabled={activeVerseIdx <= 0}
              aria-label="بداية الآية الجارية بالثواني"
              title="بداية الآية بالثواني — اضبط بدقة أو اسحب المقبض الذهبي"
              className="w-14 rounded border border-[var(--border-hairline)] bg-[var(--surface-card)] px-1 py-0.5 text-center font-mono text-[9px] font-bold tabular-nums outline-none transition-colors focus:border-[var(--brand-gold)] disabled:opacity-40"
            />
            <span className="font-mono text-[9px] font-bold text-[var(--ink-muted)]">s</span>
          </label>
          <button
            type="button"
            onClick={() => onNudgeVerse(activeVerseIdx, 0.25)}
            disabled={activeVerseIdx <= 0}
            aria-label="تأخير بداية الآية ربع ثانية"
            className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-gold)]/15 disabled:opacity-40"
          >
            +٠٫٢٥
          </button>
        </div>
        <button
          type="button"
          onClick={() => setInspectorOpen((v) => !v)}
          aria-pressed={inspectorOpen}
          title="مفتش المقاطع — مكاسب وتلاشي كل مقطع محفوظ"
          className={`${toolBtn} ${inspectorOpen ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15' : ''}`}
        >
          <PanelBottomOpen className="h-3.5 w-3.5" aria-hidden="true" />
          المفتش
        </button>
      </div>

      {/* ── مسار مقاطع الآيات ─────────────────────────────────────── */}
      <div
        ref={clipsTrackRef}
        dir="ltr"
        role="application"
        aria-label="مسار مقاطع الآيات — انقر مقطعاً للانتقال، أو اسحب المؤشر للتقديم، أو اسحب المقبض الذهبي على حدّ آية لضبط موضعها"
        title="اسحب للتقديم · انقر مقطع آية للانتقال إليها · المقبض الذهبي على حدّ المقطع يضبط موضع الآية"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromPointer(e.clientX);
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        className="relative h-16 shrink-0 cursor-ew-resize touch-none select-none overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)]"
      >
        {/* شبكة خلفية خفيفة */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'repeating-linear-gradient(90deg, transparent 0 59px, rgba(120,113,108,0.08) 59px 60px)',
          }}
          aria-hidden="true"
        />

        {/* مقاطع الآيات */}
        {verseViews.map((v) => {
          const startRatio = ratioOf(v.startSec);
          const endRatio = ratioOf(v.endSec);
          const w = endRatio - startRatio;
          if (w <= 0) return null;
          const isActive = v.idx === activeVerseIdx;
          const isSelected = selectedVerseIdx === v.idx;
          const removed = v.status === 'removed';
          const text = verseTexts?.[v.idx] ?? null;
          const keptBarPct = v.totalSec > 0 ? Math.min(100, (v.keptSec / v.totalSec) * 100) : 0;
          // مقبض الحد الأيسر: يضبط بداية هذه الآية (= نهاية سابقتها) —
          // أول آية تبدأ عند ٠ دائماً فلا مقبض لها.
          const showStartHandle = v.idx > 0 && verseViews.length > 1;
          return (
            <div
              key={v.idx}
              dir="ltr"
              className={`absolute inset-y-1.5 z-10 min-w-0 ${
                removed ? 'opacity-60' : ''
              }`}
              style={{ left: pct(startRatio), width: pct(w) }}
            >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectVerse(v.idx);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`مقطع الآية ${v.number} — ${formatAudioTime(v.totalSec)}${
                removed ? ' — محذوفة' : ''
              }`}
              title={`الآية ${v.number}${removed ? ' (محذوفة)' : v.status === 'partial' ? ' (مقصوصة جزئياً)' : ''} · ${formatAudioTime(v.keptSec)}/${formatAudioTime(v.totalSec)}`}
              className={`relative flex h-full min-w-0 cursor-pointer flex-col justify-between overflow-hidden rounded-md border px-1.5 py-1 text-start transition-colors ${
                removed
                  ? 'border-dashed border-[var(--border-hairline)] bg-transparent'
                  : isActive
                    ? 'border-[#B8962B] bg-[#D4AF37]/25 shadow-[0_0_10px_rgba(212,175,55,0.35)]'
                    : isSelected
                      ? 'border-[var(--brand-emerald)] bg-[var(--brand-emerald)]/15'
                      : 'border-[#B8962B]/70 bg-[#0F2A1E]/85 hover:bg-[#153324]/90'
              }`}
            >
              {/* صف الرقم + المدة */}
              <span className="flex w-full items-center gap-1 text-[9px] font-bold leading-none">
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded text-[9px] tabular-nums ${
                    isActive && !removed
                      ? 'bg-[var(--brand-gold)] text-[#1F1705]'
                      : 'bg-[var(--brand-gold)]/20 text-[#E6C75A]'
                  }`}
                >
                  {toArabicDigits(v.number)}
                </span>
                {w > 0.16 && (
                  <span className="truncate font-mono text-[8px] font-semibold tabular-nums text-white/60">
                    {formatAudioTime(v.keptSec)}
                  </span>
                )}
                {v.status === 'partial' && w > 0.16 && (
                  <span className="rounded-sm bg-[#B8962B]/25 px-1 text-[7px] font-bold text-[#E6C75A]">
                    مقصوصة
                  </span>
                )}
              </span>
              {/* مطلع الآية داخل المقطع */}
              {w > 0.22 && (
                <span dir="rtl" className="font-quran w-full truncate text-[10px] leading-snug text-[#D9E5DC]">
                  {removed
                    ? '— محذوفة —'
                    : text
                      ? `${text.slice(0, 26)}…`
                      : `الآية ${toArabicDigits(v.number)}`}
                </span>
              )}
              {/* شريط المحفوظ داخل المقطع */}
              {!removed && (
                <span className="absolute inset-x-1 bottom-0.5 h-0.5 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="absolute inset-y-0 start-0 rounded-full bg-[#E6C75A]/80"
                    style={{ width: `${keptBarPct.toFixed(1)}%` }}
                  />
                </span>
              )}
            </button>
              {/* مقبض حدّ الآية (يسار المقطع): اسحبه لضبط بداية هذه الآية */}
              {showStartHandle && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`حدّ بداية الآية ${v.number} — اسحب أو استخدم الأسهم لضبط الموضع`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      onNudgeVerse(v.idx, -0.25);
                    } else if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      onNudgeVerse(v.idx, 0.25);
                    }
                  }}
                  title={`اسحب لضبط موضع بداية الآية ${v.number} (أو أسهم لوحة المفاتيح)`}
                  {...edgeHandleHandlers(v.idx)}
                  className="group/handle absolute inset-y-0 left-0 z-20 flex w-2.5 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center"
                >
                  <span
                    className="h-full w-[3px] rounded-full bg-[var(--brand-gold)]/60 transition-colors group-focus/handle:bg-[var(--brand-gold)] group-hover/handle:bg-[var(--brand-gold)] group-hover/handle:shadow-[0_0_8px_rgba(212,175,55,0.9)]"
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* مؤشر التشغيل على مسار المقاطع */}
        {view.durSec > 0 && (
          <div
            className="pointer-events-none absolute inset-y-0 z-30 w-px bg-[var(--brand-gold)] shadow-[0_0_8px_rgba(212,175,55,0.7)]"
            style={{ left: pct(playheadRatio) }}
            aria-hidden="true"
          >
            <span className="absolute -top-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-b-sm bg-[var(--brand-gold)]" />
          </div>
        )}
      </div>

      {/* ── مسار الموجة الكامل (مسطرة + تحديد + مؤشر + تفاعل) ─────── */}
      <ProducerWaveform
        source={source}
        edit={edit}
        view={view}
        selection={selection}
        silences={silences}
        playheadSourceSec={playheadSourceSec}
        isPlaying={isPlaying}
        activeVerseIdx={activeVerseIdx}
        onSeekSource={onSeekSource}
        onSelectionChange={onSelectionChange}
        onZoomAt={onZoomAt}
        onScrollBy={onScrollBy}
        onSelectVerse={onSelectVerse}
      />

      {/* ── مفتش المقاطع (لوحة عائمة) ─────────────────────────────── */}
      {inspectorOpen && (
        <div
          role="dialog"
          aria-label="مفتش المقاطع"
          className="absolute end-2 top-12 z-40 w-[min(420px,92%)] rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-2 shadow-2xl"
        >
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-[var(--ink-primary)]">
              مفتش المقاطع المحفوظة
            </h3>
            <button
              type="button"
              onClick={() => setInspectorOpen(false)}
              aria-label="إغلاق المفتش"
              className="rounded-md px-1.5 text-[10px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            >
              إغلاق ✕
            </button>
          </div>
          <div className="studio-scroll max-h-56 overflow-y-auto">
            <ProducerClipInspector
              source={source}
              edit={edit}
              activeClipId={activeClipId}
              onSeekEditedSec={onSeekEdited}
              onClipGainChange={onClipGainChange}
              onClipFadesChange={onClipFadesChange}
            />
          </div>
        </div>
      )}
    </section>
  );
}
