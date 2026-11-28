'use client';

/**
 * StudioTimelineTrack — الخط الزمني البصري لتبويب «منتج الصوت»
 * (مطابق للتصميم المرجعي): مسطرة زمنية بعلامات (0:00 / 0:05 / ...)،
 * مسار موجة مرسوم على كانفاس مقسّم إلى مقاطع الآيات، مؤشر تشغيل
 * ذهبي بعُمود رأسي، صف شرائح الآيات، ومسار الترجمة النصية أسفلها.
 *
 * الخط الزمني نفسه LTR (الزمن يجري يميناً كما في أدوات المونتاج) مهما
 * كان اتجاه الواجهة — النصوص العربية داخل العناصر تُعرض RTL.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { formatAudioTime, toArabicDigits } from '@/lib/quran-utils';
import {
  formatRulerLabel,
  niceRulerStep,
  type TimelineSegment,
} from '@/lib/timeline-peaks';

interface StudioTimelineTrackProps {
  segments: TimelineSegment[];
  totalSec: number;
  /** فهرس الآية النشطة (تمييز مقطعها وربط الشرائح). */
  activeIdx: number;
  /** موضع مؤشر التشغيل المطلق على الخط (ثوانٍ). */
  playheadSec: number;
  isPlaying: boolean;
  /** علامات حدود الآيات (ثوانٍ مطلقة) — وضع الملف المخصص. */
  customVerseBounds?: number[] | null;
  /** نص الترجمة لكل آية (محاذاة مع segments) — null = لا ترجمة. */
  translationTexts?: (string | null)[];
  /** جارٍ استخراج الموجات — يظهر مؤقّت تحميل صغير. */
  analyzing?: boolean;
  onSelectVerseIndex: (idx: number) => void;
  /** نقر/سحب على المسار أو المسطرة → طلب تقديم إلى زمن مطلق. */
  onSeekAbsolute: (sec: number) => void;
  onTogglePlay: () => void;
}

interface RulerTick {
  t: number;
  pct: number;
  major: boolean;
}

export function StudioTimelineTrack({
  segments,
  totalSec,
  activeIdx,
  playheadSec,
  isPlaying,
  customVerseBounds,
  translationTexts,
  analyzing,
  onSelectVerseIndex,
  onSeekAbsolute,
  onTogglePlay,
}: StudioTimelineTrackProps) {
  const { theme } = useApp();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chipsRowRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);

  const safeTotal = totalSec > 0 ? totalSec : 0;

  // ── قياس العرض (ResizeObserver) لرسم الكانفاس بدقة ────────────────
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
    if (safeTotal <= 0) return [];
    const step = niceRulerStep(safeTotal, 5);
    const out: RulerTick[] = [];
    const count = Math.floor(safeTotal / step);
    for (let i = 0; i <= count; i++) {
      const t = i * step;
      out.push({ t, pct: (t / safeTotal) * 100, major: true });
      // علامة فرعية صغيرة في منتصف الخطوة (نمط الصورة المرجعية)
      const halfT = t + step / 2;
      if (halfT < safeTotal) {
        out.push({ t: halfT, pct: (halfT / safeTotal) * 100, major: false });
      }
    }
    return out;
  }, [safeTotal]);

  // ── رسم مسار الموجة على الكانفاس ──────────────────────────────────
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

    // ألوان من متغيّرات الثيم (تتبدّل مع الوضع الداكن/الفاتح).
    const css = getComputedStyle(parent);
    const varOr = (name: string, fb: string) =>
      css.getPropertyValue(name).trim() || fb;
    const gold = varOr('--brand-gold', '#D4AF37');
    const emerald = varOr('--brand-emerald', '#14532D');
    const subtle = varOr('--surface-subtle', '#F5F1E8');
    const hairline = varOr('--border-hairline', '#E5E0D5');

    // خلفية المسار.
    ctx.fillStyle = subtle;
    roundRect(ctx, 0.5, 0.5, width - 1, cssH - 1, 10);
    ctx.fill();

    const mid = cssH / 2;
    const drawSegmentWave = (
      x0: number,
      x1: number,
      peaks: Float32Array | null,
      color: string,
      alpha: number
    ) => {
      const segW = x1 - x0;
      if (segW <= 4) return;
      ctx.save();
      roundRect(ctx, x0 + 1, 1, segW - 2, cssH - 2, 8);
      ctx.clip();
      if (!peaks || peaks.length === 0) {
        // لا قمم (فشل التحليل): نمط هادئ من شرطات منتصفية.
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha * 0.6;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(x0 + 4, mid);
        ctx.lineTo(x1 - 4, mid);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        return;
      }
      const barW = 2;
      const pitch = 3;
      const cols = Math.max(1, Math.floor((segW - 4) / pitch));
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      for (let c = 0; c < cols; c++) {
        const idx = Math.min(peaks.length - 1, Math.floor((c / cols) * peaks.length));
        const h = Math.max(1, peaks[idx] * (cssH / 2 - 5));
        const x = x0 + 3 + c * pitch;
        ctx.fillRect(x, mid - h, barW, h * 2);
      }
      ctx.restore();
    };

    if (safeTotal <= 0 || segments.length === 0) {
      ctx.strokeStyle = hairline;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(8, mid);
      ctx.lineTo(width - 8, mid);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    // مقاطع الآيات — النشط ذهبي والباقي زمردي هادئ.
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const x0 = (seg.startSec / safeTotal) * width;
      const x1 = ((seg.startSec + seg.durationSec) / safeTotal) * width;
      const active = i === activeIdx;
      drawSegmentWave(x0, x1, seg.peaks, active ? gold : emerald, active ? 0.95 : 0.5);
    }

    // فواصل المقاطع.
    ctx.strokeStyle = hairline;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      const x = Math.round((seg.startSec / safeTotal) * width) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 3);
      ctx.lineTo(x, cssH - 3);
      ctx.stroke();
    }

    // علامات حدود الآيات في وضع الملف المخصص.
    if (customVerseBounds && customVerseBounds.length) {
      ctx.strokeStyle = gold;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([4, 3]);
      for (let i = 1; i < customVerseBounds.length; i++) {
        const x = Math.round((customVerseBounds[i] / safeTotal) * width) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 2);
        ctx.lineTo(x, cssH - 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // إطار ذهبي للمقطع النشط (توهّج خفيف كالمرجع).
    if (segments[activeIdx]) {
      const seg = segments[activeIdx];
      const x0 = (seg.startSec / safeTotal) * width;
      const x1 = ((seg.startSec + seg.durationSec) / safeTotal) * width;
      ctx.strokeStyle = gold;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x0 + 1, 1, Math.max(4, x1 - x0 - 2), cssH - 2, 8);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, [width, safeTotal, segments, activeIdx, customVerseBounds]);

  useEffect(() => {
    draw();
  }, [draw, theme]);

  // ── تفاعل النقر/السحب على المسار ──────────────────────────────────
  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = canvasRef.current?.parentElement;
      if (!el || safeTotal <= 0) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeekAbsolute(ratio * safeTotal);
    },
    [onSeekAbsolute, safeTotal]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (safeTotal <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    seekFromClientX(e.clientX);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    seekFromClientX(e.clientX);
  };
  const handlePointerUp = () => setDragging(false);

  // ── موضع مؤشر التشغيل ──────────────────────────────────────────────
  const playheadPct = safeTotal > 0
    ? Math.max(0, Math.min(100, (playheadSec / safeTotal) * 100))
    : 0;

  // ── إبقاء الشريحة النشطة ظاهرة في الصفوف الأفقية ────────────────────
  useEffect(() => {
    const row = chipsRowRef.current;
    if (!row) return;
    const active = row.querySelector<HTMLElement>(`[data-chip-idx="${activeIdx}"]`);
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeIdx]);

  const hasTranslationRow =
    Array.isArray(translationTexts) && translationTexts.length > 0;

  return (
    <div
      dir="ltr"
      data-testid="production-timeline-track"
      className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 p-2.5"
    >
      {/* الرأس: شعار الخط + الوقت + زر التشغيل (كزر الصورة المرجعية) */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-bold lowercase tracking-wide text-[var(--ink-muted)]">
          timeline
        </span>
        <div className="flex items-center gap-2">
          {analyzing && (
            <span className="font-mono text-[10px] font-semibold text-[var(--brand-gold)]">
              analyzing…
            </span>
          )}
          <span className="font-mono text-[10px] font-semibold text-[var(--ink-muted)] tabular-nums">
            {formatAudioTime(Math.max(0, playheadSec))} / {formatAudioTime(safeTotal)}
          </span>
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={safeTotal <= 0}
            aria-label={isPlaying ? 'إيقاف التشغيل' : 'تشغيل المقطع'}
            title={isPlaying ? 'إيقاف' : 'تشغيل'}
            className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand-emerald)] text-[#FAF7F0] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-[var(--brand-gold)] dark:text-[#1F1705]"
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* المسطرة الزمنية */}
      <div className="relative mt-1 h-4 select-none" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={`t${tick.t}`} className="absolute" style={{ left: `${tick.pct}%` }}>
            <span
              className={`absolute top-0 -translate-x-1/2 ${
                tick.major
                  ? 'h-1.5 w-px bg-[var(--ink-muted)]/70'
                  : 'h-0.5 w-px bg-[var(--ink-muted)]/35'
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

      {/* مسار الموجة + مؤشر التشغيل */}
      <div
        ref={wrapRef}
        role="application"
        aria-label="خط زمني تلاوة المقطع — انقر أو اسحب للتقديم"
        title="انقر أو اسحب للتقديم"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative mt-1 h-16 cursor-pointer touch-none select-none"
      >
        <canvas ref={canvasRef} className="absolute inset-0" aria-hidden="true" />
        {safeTotal > 0 && (
          <div
            className={`pointer-events-none absolute inset-y-0 w-px bg-[var(--brand-gold)] shadow-[0_0_6px_rgba(212,175,55,0.65)] ${
              isPlaying ? 'transition-[left] duration-200 ease-linear' : ''
            }`}
            style={{ left: `${playheadPct}%` }}
            aria-hidden="true"
          >
            <span
              className="absolute -top-0 left-1/2 -translate-x-1/2 border-b-[7px] border-l-[5px] border-r-[5px] border-b-[var(--brand-gold)] border-l-transparent border-r-transparent"
            />
          </div>
        )}
      </div>

      {/* صف شرائح الآيات (كصف الأزرار في الصورة المرجعية) */}
      <div
        ref={chipsRowRef}
        className="studio-scroll mt-2 flex gap-1 overflow-x-auto pb-0.5"
      >
        {segments.map((seg, i) => {
          const active = i === activeIdx;
          return (
            <button
              key={`${seg.verseId}-${i}`}
              type="button"
              data-chip-idx={i}
              onClick={() => onSelectVerseIndex(i)}
              aria-current={active ? 'true' : undefined}
              aria-label={`الانتقال إلى الآية ${seg.verseNumber}`}
              className={`h-8 shrink-0 rounded-lg border px-2.5 text-[11px] font-bold transition-colors ${
                active
                  ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)] text-[#1F1705]'
                  : 'border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
              }`}
            >
              <span dir="rtl" className="flex items-center gap-1.5 tabular-nums">
                <span>{toArabicDigits(seg.verseNumber)}</span>
                <span className={active ? 'opacity-70' : 'opacity-60'}>
                  {formatRulerLabel(seg.durationSec)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* مسار الترجمة النصية — أسفل الخط الزمني (محاذاة ترتيبية) */}
      {hasTranslationRow && (
        <div className="studio-scroll mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
          {translationTexts.map((text, i) => {
            const seg = segments[i];
            if (!seg) return null;
            const active = i === activeIdx;
            return (
              <button
                key={`tr-${seg.verseId}-${i}`}
                type="button"
                data-chip-idx={i}
                onClick={() => onSelectVerseIndex(i)}
                title={text ?? 'بدون ترجمة لهذه الآية'}
                className={`w-[168px] shrink-0 rounded-lg border p-1.5 text-right transition-colors ${
                  active
                    ? 'border-[var(--brand-gold)]/70 bg-[var(--brand-gold)]/10'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-card)]/60 hover:border-[var(--brand-gold)]/40'
                }`}
              >
                <span
                  dir="rtl"
                  className="block text-[9px] font-bold text-[var(--brand-gold)] tabular-nums"
                >
                  آية {toArabicDigits(seg.verseNumber)}
                </span>
                <span
                  dir="rtl"
                  className="mt-0.5 block line-clamp-3 text-[10px] leading-snug text-[var(--ink-muted)]"
                >
                  {text ?? '—'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** مسار مستطيل دائري الحواف (متوافق مع المسارات القديمة إن غاب roundRect). */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
