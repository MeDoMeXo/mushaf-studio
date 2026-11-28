'use client';

/**
 * ProducerWaveform — محرر الموجة الرئيسي في صفحة «منتج الصوت».
 *
 * - كانفاس يرسم الموجة مباشرة من عينات المصدر (دقة كاملة عند أي تقريب —
 *   max-abs لكل عمود بكسل) ويُعاد رسمه فقط عند تغيّر المصدر/العرض/الزوم
 *   (لا كل إطار).
 * - مؤشر التشغيل والتحديد والفجوات المحذوفة وفترات السكوت وعلامات الآيات
 *   كلها طبقات DOM فوق الكانفاس — حركة 60fps بلا أي رسم.
 * - التفاعل: نقرة = تقديم؛ سحب = تحديد؛ العجلة = تمرير؛ ctrl+عجلة = تقريب
 *   حول مؤشر الفأرة.
 * - الخط الزمني نفسه LTR (الزمن يجري يميناً كما في أدوات المونتاج).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { toArabicDigits } from '@/lib/quran-utils';
import { formatRulerLabel, niceRulerStep } from '@/lib/timeline-peaks';
import type { ProducerSource } from '@/lib/audio-producer/audio-producer-engine';
import { removedSpans, type ProducerEditState, type TimeSpan } from '@/lib/audio-producer/audio-producer-edit';

interface ProducerWaveformProps {
  source: ProducerSource;
  edit: ProducerEditState;
  view: { startSec: number; durSec: number };
  selection: TimeSpan | null;
  silences: TimeSpan[];
  playheadSourceSec: number;
  isPlaying: boolean;
  activeVerseIdx: number;
  onSeekSource: (sec: number) => void;
  onSelectionChange: (span: TimeSpan | null) => void;
  onZoomAt: (anchorRatio: number, factor: number) => void;
  onScrollBy: (deltaSec: number) => void;
  onSelectVerse: (idx: number) => void;
}

interface RulerTick {
  t: number;
  ratio: number;
  major: boolean;
}

export function ProducerWaveform({
  source,
  edit,
  view,
  selection,
  silences,
  playheadSourceSec,
  isPlaying,
  activeVerseIdx,
  onSeekSource,
  onSelectionChange,
  onZoomAt,
  onScrollBy,
  onSelectVerse,
}: ProducerWaveformProps) {
  const { theme } = useApp();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(0);
  const [dragState, setDragState] = useState<{ anchorSec: number; currentSec: number } | null>(null);

  // ── قياس العرض ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // ── علامات المسطرة ─────────────────────────────────────────────────
  const ticks = useMemo<RulerTick[]>(() => {
    if (view.durSec <= 0) return [];
    const step = niceRulerStep(view.durSec, 8);
    const out: RulerTick[] = [];
    const first = Math.ceil(view.startSec / step) * step;
    for (let t = first; t <= view.startSec + view.durSec + 1e-9; t += step) {
      out.push({ t, ratio: (t - view.startSec) / view.durSec, major: true });
      const half = t + step / 2;
      if (half < view.startSec + view.durSec) {
        out.push({ t: half, ratio: (half - view.startSec) / view.durSec, major: false });
      }
    }
    return out;
  }, [view.startSec, view.durSec]);

  // ── رسم الموجة (أعمدة max-abs من عينات المصدر) ──────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const cssH = parent.clientHeight;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, cssH);

    const css = getComputedStyle(parent);
    const varOr = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
    const emerald = varOr('--brand-emerald', '#14532D');
    const gold = varOr('--brand-gold', '#D4AF37');
    const subtle = varOr('--surface-subtle', '#F5F1E8');
    const hairline = varOr('--border-hairline', '#E5E0D5');

    // خلفية
    ctx.fillStyle = subtle;
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, width - 1, cssH - 1, 10);
    ctx.fill();

    const mid = cssH / 2;
    const data = source.buffer.getChannelData(0);
    const sr = source.sampleRate;
    const cols = Math.max(1, Math.floor(width));

    // خط منتصف هادئ
    ctx.strokeStyle = hairline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, Math.round(mid) + 0.5);
    ctx.lineTo(width - 4, Math.round(mid) + 0.5);
    ctx.stroke();

    // الفجوات المحذوفة تُرسم باهتة؛ المحفوظ زمردي.
    const removed = removedSpans(edit);
    const isRemoved = (t: number): boolean => {
      for (const r of removed) {
        if (t >= r.startSec && t < r.endSec) return true;
      }
      return false;
    };

    const half = cssH / 2 - 4;
    for (let x = 0; x < cols; x++) {
      const t0 = view.startSec + (x / cols) * view.durSec;
      const t1 = view.startSec + ((x + 1) / cols) * view.durSec;
      let i0 = Math.floor(t0 * sr);
      let i1 = Math.ceil(t1 * sr);
      if (i1 <= i0) i1 = i0 + 1;
      if (i0 < 0) i0 = 0;
      if (i1 > data.length) i1 = data.length;
      if (i1 <= i0) continue;
      const stride = Math.max(1, Math.floor((i1 - i0) / 512));
      let peak = 0;
      for (let i = i0; i < i1; i += stride) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
      }
      const tm = (t0 + t1) / 2;
      const cut = isRemoved(tm);
      const h = Math.max(1, Math.min(1, peak) * half);
      ctx.fillStyle = cut ? hairline : emerald;
      ctx.globalAlpha = cut ? 0.5 : 0.88;
      ctx.fillRect(x, mid - h, 1, h * 2);
    }
    ctx.globalAlpha = 1;

    // حدود المقاطع المحفوظة (درزات القصّ) — خطوط ذهبية رفيعة.
    ctx.strokeStyle = gold;
    ctx.globalAlpha = 0.35;
    for (const it of edit.intervals) {
      for (const t of [it.startSec, it.endSec]) {
        if (t < view.startSec || t > view.startSec + view.durSec) continue;
        const x = Math.round(((t - view.startSec) / view.durSec) * width) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 2);
        ctx.lineTo(x, cssH - 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    void gold;
  }, [width, source, view, edit]);

  useEffect(() => {
    draw();
  }, [draw, theme]);

  // ── تحويلات الإحداثيات ─────────────────────────────────────────────
  const secFromClientX = useCallback(
    (clientX: number): number | null => {
      const el = wrapRef.current;
      if (!el || view.durSec <= 0) return null;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return view.startSec + ratio * view.durSec;
    },
    [view.startSec, view.durSec]
  );

  const ratioOfSec = useCallback(
    (sec: number): number =>
      view.durSec > 0 ? Math.max(0, Math.min(1, (sec - view.startSec) / view.durSec)) : 0,
    [view.startSec, view.durSec]
  );

  // ── تفاعل النقر/السحب: نقرة = تقديم، سحب = تحديد ───────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const sec = secFromClientX(e.clientX);
    if (sec === null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragState({ anchorSec: sec, currentSec: sec });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    const sec = secFromClientX(e.clientX);
    if (sec === null) return;
    setDragState((prev) => (prev ? { ...prev, currentSec: sec } : prev));
  };

  const handlePointerUp = () => {
    if (!dragState) return;
    const delta = Math.abs(dragState.currentSec - dragState.anchorSec);
    if (delta < 0.2) {
      // نقرة: تقديم + مسح التحديد
      onSeekSource(dragState.currentSec);
      onSelectionChange(null);
    } else {
      const start = Math.min(dragState.anchorSec, dragState.currentSec);
      const end = Math.max(dragState.anchorSec, dragState.currentSec);
      onSelectionChange({ startSec: start, endSec: end });
    }
    setDragState(null);
  };

  // ── العجلة: تمرير أفقي، ctrl = تقريب حول المؤشر ────────────────────
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (view.durSec <= 0) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onZoomAt(ratio, e.deltaY > 0 ? 1.25 : 0.8);
      return;
    }
    e.preventDefault();
    const stepSec = (e.deltaY / 100) * view.durSec * 0.12;
    if (Math.abs(stepSec) > 0.001) onScrollBy(stepSec);
  };

  // ── تحديد حي أثناء السحب ────────────────────────────────────────────
  const liveSelection: TimeSpan | null = useMemo(() => {
    if (!dragState) return null;
    const start = Math.min(dragState.anchorSec, dragState.currentSec);
    const end = Math.max(dragState.anchorSec, dragState.currentSec);
    return end - start > 0.2 ? { startSec: start, endSec: end } : null;
  }, [dragState]);

  const effectiveSelection = liveSelection ?? selection;

  // ── طبقات العرض ─────────────────────────────────────────────────────
  const removedList = useMemo(() => removedSpans(edit), [edit]);
  const playheadRatio = ratioOfSec(playheadSourceSec);

  const markersInView = useMemo(() => {
    const out: { idx: number; sec: number; ratio: number }[] = [];
    source.verseMarkersSec.forEach((sec, idx) => {
      if (sec >= view.startSec - 0.5 && sec <= view.startSec + view.durSec + 0.5) {
        out.push({ idx, sec, ratio: (sec - view.startSec) / view.durSec });
      }
    });
    return out;
  }, [source.verseMarkersSec, view.startSec, view.durSec]);

  const silencesInView = useMemo(
    () =>
      silences.filter(
        (s) => s.endSec >= view.startSec && s.startSec <= view.startSec + view.durSec
      ),
    [silences, view.startSec, view.durSec]
  );

  const chipsRowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const row = chipsRowRef.current;
    if (!row) return;
    const active = row.querySelector<HTMLElement>(`[data-chip-idx="${activeVerseIdx}"]`);
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeVerseIdx]);

  const pct = (ratio: number) => `${(ratio * 100).toFixed(2)}%`;

  return (
    <div dir="ltr" className="flex min-h-0 flex-1 flex-col gap-1.5" data-testid="producer-waveform">
      {/* المسطرة الزمنية */}
      <div className="relative h-5 select-none" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={`r${tick.t.toFixed(3)}`} className="absolute inset-y-0" style={{ left: pct(tick.ratio) }}>
            <span
              className={`absolute top-0 -translate-x-1/2 ${
                tick.major ? 'h-2 w-px bg-[var(--ink-muted)]/70' : 'h-1 w-px bg-[var(--ink-muted)]/30'
              }`}
            />
            {tick.major && (
              <span className="absolute top-2.5 -translate-x-1/2 font-mono text-[9px] font-semibold text-[var(--ink-muted)] tabular-nums">
                {formatRulerLabel(tick.t)}
              </span>
            )}
          </span>
        ))}
      </div>

      {/* منطقة الموجة + الطبقات */}
      <div
        ref={wrapRef}
        role="application"
        aria-label="محرر موجة الصوت — انقر للتقديم، اسحب للتحديد، ctrl+عجلة للتقريب"
        title="انقر للتقديم · اسحب للتحديد · ctrl+عجلة للتقريب"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="relative h-44 shrink-0 cursor-crosshair touch-none select-none sm:h-52"
      >
        <canvas ref={canvasRef} className="absolute inset-0" aria-hidden="true" />

        {/* فترات السكوت المكتشفة */}
        {silencesInView.map((s, i) => (
          <div
            key={`sil${i}`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-1 border-x border-dashed border-sky-500/50 bg-sky-400/10"
            style={{
              left: pct(ratioOfSec(s.startSec)),
              width: pct(Math.max(0, ratioOfSec(s.endSec) - ratioOfSec(s.startSec))),
            }}
          />
        ))}

        {/* الفجوات المحذوفة بالقصّ */}
        {removedList.map((s, i) => (
          <div
            key={`rm${i}`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 rounded-md border-x border-[var(--border-hairline)]"
            style={{
              left: pct(ratioOfSec(s.startSec)),
              width: pct(Math.max(0.001, ratioOfSec(s.endSec) - ratioOfSec(s.startSec))),
              background:
                'repeating-linear-gradient(45deg, rgba(120,113,108,0.16) 0 6px, rgba(120,113,108,0.05) 6px 12px)',
            }}
          />
        ))}

        {/* علامات بدايات الآيات */}
        {markersInView.map((m) => (
          <button
            key={`vm${m.idx}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectVerse(m.idx);
            }}
            title={`الآية ${m.idx + 1}`}
            className="absolute top-0 z-10 h-full w-px cursor-pointer bg-[var(--brand-gold)]/40 hover:bg-[var(--brand-gold)]"
            style={{ left: pct(m.ratio) }}
            aria-label={`علامة بداية الآية ${m.idx + 1}`}
          >
            <span
              dir="rtl"
              className={`absolute -top-0.5 right-0 translate-x-1/2 rounded-sm px-1 text-[9px] font-bold tabular-nums ${
                m.idx === activeVerseIdx
                  ? 'bg-[var(--brand-gold)] text-[#1F1705]'
                  : 'bg-[var(--surface-card)] text-[var(--brand-gold)]'
              }`}
            >
              {toArabicDigits(m.idx + 1)}
            </span>
          </button>
        ))}

        {/* التحديد */}
        {effectiveSelection && (
          <div
            className="pointer-events-none absolute inset-y-0 z-20 rounded-sm border-x-2 border-[var(--brand-gold)] bg-[var(--brand-gold)]/15"
            style={{
              left: pct(ratioOfSec(effectiveSelection.startSec)),
              width: pct(Math.max(0.001, ratioOfSec(effectiveSelection.endSec) - ratioOfSec(effectiveSelection.startSec))),
            }}
            aria-hidden="true"
          />
        )}

        {/* مؤشر التشغيل */}
        {view.durSec > 0 && (
          <div
            className="pointer-events-none absolute inset-y-0 z-30 w-px bg-[var(--brand-gold)] shadow-[0_0_8px_rgba(212,175,55,0.7)]"
            style={{ left: pct(playheadRatio) }}
            aria-hidden="true"
          >
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 border-b-[8px] border-l-[6px] border-r-[6px] border-b-[var(--brand-gold)] border-l-transparent border-r-transparent" />
          </div>
        )}

        {isPlaying && (
          <span className="pointer-events-none absolute bottom-1 left-2 z-30 font-mono text-[9px] font-bold lowercase tracking-wide text-[var(--brand-gold)]">
            playing
          </span>
        )}
      </div>

      {/* صف شرائح الآيات */}
      <div ref={chipsRowRef} className="studio-scroll flex gap-1 overflow-x-auto pb-0.5">
        {source.verseMarkersSec.map((sec, idx) => {
          const active = idx === activeVerseIdx;
          return (
            <button
              key={`vc${idx}`}
              type="button"
              data-chip-idx={idx}
              onClick={() => onSelectVerse(idx)}
              aria-current={active ? 'true' : undefined}
              aria-label={`الانتقال إلى الآية ${idx + 1}`}
              className={`h-7 shrink-0 rounded-lg border px-2 text-[10px] font-bold tabular-nums transition-colors ${
                active
                  ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)] text-[#1F1705]'
                  : 'border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
              }`}
            >
              {toArabicDigits(source.verseNumbers[idx] ?? idx + 1)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
