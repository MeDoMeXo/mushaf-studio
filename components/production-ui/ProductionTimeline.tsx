'use client';

/**
 * ProductionTimeline — المسارات الزمنية (أساس المحرر): عمود تسميات يمين
 * (w-28) + منطقة مسارات تتمرر أفقياً وتُقرَّب. خمسة مسارات: فيديو (لقطات)،
 * تلاوة (كانفاس موجة خضراء + علامات آيات ذهبية + فجوات محذوفة مخططة)،
 * موسيقى (كانفاس بنفسجي أو بلا موسيقى)، مؤثرات (مقاطع برتقالية)، نصوص
 * (مقاطع زرقاء قابلة للسحب). المؤشر الأحمر يُسحب من المسطرة، وكل
 * المواضع بالبكسل من «بداية السطر» (insetInlineStart = اليمين في RTL)
 * حيث أصل الزمن — لذا تُرسم الكانفاسات معكوسة المرآة.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  Clapperboard,
  Eye,
  EyeOff,
  Film,
  Lock,
  Music,
  Sparkles,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { formatProductionClock, type ProductionEffectClip, type ProductionTextClip } from '@/lib/production/production-types';
import { formatRulerLabel, niceRulerStep } from '@/lib/timeline-peaks';
import { toArabicDigits } from '@/lib/quran-utils';

type IconType = typeof Music;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface ProductionTimelineProps {
  totalSec: number;
  playheadSec: number;
  onSeek: (sec: number) => void;
  peaks: Float32Array | null;
  musicPeaks: Float32Array | null;
  verseSpans: { startSec: number; endSec: number; number: number }[];
  gaps: { startSec: number; endSec: number }[];
  textClips: ProductionTextClip[];
  onTextClipUpdate: (id: string, startSec: number, endSec: number) => void;
  effectClips: ProductionEffectClip[];
  onRemoveEffect: (id: string) => void;
  zoom: number;
  onZoom: (z: number) => void;
  onZoomFit: () => void;
  trackVisibility: { video: boolean; music: boolean; effects: boolean; text: boolean };
  onToggleTrack: (t: 'video' | 'music' | 'effects' | 'text') => void;
  filmstrip: string[];
  videoLabel: string;
}

const RECITATION_BG = '#e8f5ee';
const RECITATION_WAVE = '#1e9e5a';
const MUSIC_BG = '#f1eafb';
const MUSIC_WAVE = '#7c4dc4';
const GAP_OVERLAY = 'rgba(60,60,60,0.35)';
const MIN_TEXT_CLIP_SEC = 0.5;
const WAVE_FONT = '11px Cairo, system-ui, sans-serif';

const EFFECT_LABELS: Record<string, string> = {
  rain: 'مطر', night: 'ليل', ocean: 'بحر', breeze: 'نسيم', echo: 'صدى',
};

function effectKindLabel(clip: ProductionEffectClip): string {
  return clip.kind === 'echo' ? EFFECT_LABELS.echo : EFFECT_LABELS[clip.ambient] ?? 'محيط';
}

function textClipLabel(clip: ProductionTextClip): string {
  if (clip.text.trim()) return clip.text;
  const fallbacks: Record<ProductionTextClip['kind'], string> = {
    basmala: 'البسملة', 'surah-title': 'عنوان السورة', reciter: 'اسم القارئ', custom: 'نص مخصص', verse: 'الآية',
  };
  return fallbacks[clip.kind];
}

/** أعمدة الموجة (معكوسة المرآة لـ RTL) + انعكاس خافت اختياري أسفلها. */
function drawWaveBars(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  peaks: Float32Array,
  color: string,
  reflect: boolean
) {
  const mid = h / 2;
  const rMid = h * 0.82;
  ctx.fillStyle = color;
  for (let i = 0; i < w; i++) {
    const amp = peaks[Math.floor((i / w) * peaks.length)] ?? 0;
    if (amp <= 0.004) continue;
    const x = w - 1 - i;
    ctx.fillRect(x, mid - amp * mid * 0.9, 1, amp * mid * 1.8);
    if (reflect && i % 2 === 0) {
      ctx.globalAlpha = 0.2;
      ctx.fillRect(x, rMid - amp * h * 0.1, 1, amp * h * 0.2);
      ctx.globalAlpha = 1;
    }
  }
}

/** مستطيل دائري الأركان على الكانفاس (متوافق مع كل المتصفحات). */
function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number, fill: string
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

/** كانفاس واعٍ لدقة الجهاز (devicePixelRatio) يعيد الرسم عند تغيّر الأبعاد أو دالة الرسم. */
function WaveCanvas({ widthPx, heightPx, render, ariaLabel }: {
  widthPx: number;
  heightPx: number;
  render: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  ariaLabel: string;
}) {
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(widthPx));
    const h = Math.max(1, Math.round(heightPx));
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render(ctx, w, h);
  }, [widthPx, heightPx, render]);
  return <canvas ref={cvRef} role="img" aria-label={ariaLabel} className="block h-full w-full" />;
}

/** خلية تسمية مسار في العمود الأيمن: أيقونة + اسم + عين إظهار + قفل. */
function TrackLabel({ icon: Icon, text, dimmed, visible, onToggle, lock }: {
  icon: IconType;
  text: string;
  dimmed?: boolean;
  visible?: boolean;
  onToggle?: () => void;
  lock?: boolean;
}) {
  return (
    <div className={`flex h-11 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-white px-2 ${dimmed ? 'opacity-60' : ''}`}>
      <Icon className="h-3.5 w-3.5 shrink-0 text-[#123c22]" aria-hidden />
      <span className="min-w-0 truncate text-[11px] font-bold text-[#1f1b16]">{text}</span>
      <div className="ms-auto flex shrink-0 items-center gap-0.5">
        {onToggle && (
          <button type="button" onClick={onToggle} aria-pressed={visible !== false} aria-label={visible === false ? `إظهار مسار ${text}` : `إخفاء مسار ${text}`} className="flex h-5 w-5 items-center justify-center rounded text-[#6a6155] transition-colors hover:bg-[#f5f2e8]">
            {visible === false ? <EyeOff className="h-3 w-3" aria-hidden /> : <Eye className="h-3 w-3" aria-hidden />}
          </button>
        )}
        {lock && (
          <span title="قفل المسار" className="flex h-5 w-5 items-center justify-center text-[#c9c0b0]">
            <Lock className="h-3 w-3" aria-hidden />
          </span>
        )}
      </div>
    </div>
  );
}

const LaneHint = ({ children }: { children: React.ReactNode }) => (
  <span className="absolute inset-0 flex items-center justify-center text-[10px] text-[#a08a6f]">{children}</span>
);

/** شريحة اسم المسار على الجوال فقط (عمود التسميات مخفي حينها). */
const MobileChip = ({ label }: { label: string }) => (
  <span className="absolute start-1 top-0.5 z-10 rounded bg-black/25 px-1 text-[8px] leading-4 text-white md:hidden">
    {label}
  </span>
);

/** زر أيقوني صغير لشريط التقريب. */
const ZoomBtn = ({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e3dac6] bg-white text-[#123c22] transition-colors hover:bg-[#f5f2e8]"
  >
    {children}
  </button>
);

export function ProductionTimeline(props: ProductionTimelineProps) {
  const {
    totalSec, playheadSec, onSeek, peaks, musicPeaks, verseSpans, gaps,
    textClips, onTextClipUpdate, effectClips, onRemoveEffect,
    zoom, onZoom, onZoomFit, trackVisibility, onToggleTrack, filmstrip, videoLabel,
  } = props;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [laneWidth, setLaneWidth] = useState(640);
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null);
  const rulerDraggingRef = useRef(false);
  const textDragRef = useRef<{ id: string; durSec: number; grabOffsetSec: number; laneEl: HTMLElement } | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setLaneWidth(el.clientWidth || 640);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoomFactor = Math.max(1, zoom);
  const contentWidthPct = Math.max(100, zoom * 100);
  const contentPx = Math.max(80, laneWidth * zoomFactor);
  const pxPerSec = contentPx / Math.max(1, totalSec);

  /** زمن من إحداثية أفقية على عنصر بعرض كامل الزمن (RTL: البداية من اليمين). */
  const secFromClientX = useCallback(
    (clientX: number, el: HTMLElement): number => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || totalSec <= 0) return 0;
      return clamp((rect.right - clientX) / rect.width, 0, 1) * totalSec;
    },
    [totalSec]
  );

  // ── المسطرة: سحب المؤشر الأحمر ────────────────────────────────────
  const rulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    rulerDraggingRef.current = true;
    onSeek(secFromClientX(e.clientX, e.currentTarget));
  };
  const rulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (rulerDraggingRef.current) onSeek(secFromClientX(e.clientX, e.currentTarget));
  };
  const rulerPointerEnd = () => {
    rulerDraggingRef.current = false;
  };
  const rulerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = playheadSec + 5;
    else if (e.key === 'ArrowRight') next = playheadSec - 5;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = totalSec;
    if (next !== null) {
      e.preventDefault();
      onSeek(clamp(next, 0, totalSec));
    }
  };

  const ticks = useMemo(() => {
    const step = niceRulerStep(Math.max(1, totalSec / zoomFactor));
    const out: number[] = [];
    for (let s = 0; s <= totalSec + 0.001 && out.length < 400; s += step) {
      out.push(Math.round(s * 100) / 100);
    }
    return out;
  }, [totalSec, zoomFactor]);

  // ── رسم موجة التلاوة: خلفية نعناعية + موجات + علامات آيات + فجوات ──
  const drawRecitation = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const mid = h / 2;
      const localPxPerSec = w / Math.max(1, totalSec);
      ctx.fillStyle = RECITATION_BG;
      ctx.fillRect(0, 0, w, h);
      if (peaks && peaks.length > 0) {
        drawWaveBars(ctx, w, h, peaks, RECITATION_WAVE, true);
      } else {
        ctx.strokeStyle = '#9dc9b2';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, mid);
        ctx.lineTo(w, mid);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#7fae97';
        ctx.font = WAVE_FONT;
        ctx.textAlign = 'center';
        ctx.fillText('بلا بيانات موجة', w / 2, mid - 8);
      }
      // فاصل الآيات: خط ذهبي رفيع + شارة رقم صغيرة أعلى الخط.
      ctx.font = 'bold 9px Cairo, system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const vs of verseSpans) {
        const x = w - vs.startSec * localPxPerSec;
        if (x < -16 || x > w + 16) continue;
        ctx.strokeStyle = 'rgba(184, 138, 30, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
        const num = toArabicDigits(vs.number);
        const bw = ctx.measureText(num).width + 8;
        const bx = Math.min(w - bw, Math.max(0, x - bw / 2));
        fillRoundRect(ctx, bx, 0, bw, 12, 3, '#b88a1e');
        ctx.fillStyle = '#fffdf8';
        ctx.textBaseline = 'middle';
        ctx.fillText(num, bx + bw / 2, 6.5);
        ctx.textBaseline = 'alphabetic';
      }
      // الفجوات المحذوفة: تعتيم + خطوط قطرية.
      for (const g of gaps) {
        const gw = (g.endSec - g.startSec) * localPxPerSec;
        if (gw <= 0) continue;
        const gx = w - g.endSec * localPxPerSec;
        if (gx + gw < 0 || gx > w) continue;
        ctx.fillStyle = GAP_OVERLAY;
        ctx.fillRect(gx, 0, gw, h);
        ctx.save();
        ctx.beginPath();
        ctx.rect(gx, 0, gw, h);
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 2;
        for (let d = -h; d < gw + h; d += 8) {
          ctx.beginPath();
          ctx.moveTo(gx + d, h);
          ctx.lineTo(gx + d + h, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
    },
    [peaks, verseSpans, gaps, totalSec]
  );

  // ── رسم موجة الموسيقى: خلفية أرجوانية أو خط متقطع مع تلميح ──────────
  const drawMusic = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const mid = h / 2;
      ctx.fillStyle = MUSIC_BG;
      ctx.fillRect(0, 0, w, h);
      if (musicPeaks && musicPeaks.length > 0) {
        drawWaveBars(ctx, w, h, musicPeaks, MUSIC_WAVE, false);
      } else {
        ctx.strokeStyle = '#b9a8d9';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, mid);
        ctx.lineTo(w, mid);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#8a7fb0';
        ctx.font = WAVE_FONT;
        ctx.textAlign = 'center';
        ctx.fillText('بلا موسيقى', w / 2, mid - 8);
      }
    },
    [musicPeaks]
  );

  // ── سحب مقاطع النصوص أفقياً (التقاط المؤشر + حد أدنى للمدة) ─────────
  const startTextClipDrag = (e: React.PointerEvent<HTMLDivElement>, clip: ProductionTextClip) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const laneEl = e.currentTarget.parentElement;
    if (!laneEl) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    textDragRef.current = {
      id: clip.id,
      durSec: Math.max(MIN_TEXT_CLIP_SEC, clip.endSec - clip.startSec),
      grabOffsetSec: secFromClientX(e.clientX, laneEl) - clip.startSec,
      laneEl,
    };
  };
  const moveTextClipDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = textDragRef.current;
    if (!d) return;
    const pointerSec = secFromClientX(e.clientX, d.laneEl);
    const newStart = clamp(pointerSec - d.grabOffsetSec, 0, Math.max(0, totalSec - d.durSec));
    const newEnd = Math.min(totalSec, newStart + d.durSec);
    if (newEnd - newStart >= 0.4) onTextClipUpdate(d.id, newStart, newEnd);
  };
  const endTextClipDrag = () => {
    textDragRef.current = null;
  };
  const textClipKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, clip: ProductionTextClip) => {
    let delta = 0;
    if (e.key === 'ArrowLeft') delta = 0.5;
    else if (e.key === 'ArrowRight') delta = -0.5;
    else return;
    e.preventDefault();
    const dur = Math.max(MIN_TEXT_CLIP_SEC, clip.endSec - clip.startSec);
    const newStart = clamp(clip.startSec + delta, 0, Math.max(0, totalSec - dur));
    onTextClipUpdate(clip.id, newStart, Math.min(totalSec, newStart + dur));
  };

  const filmstripTiles = filmstrip.slice(0, 48);
  const playheadPx = clamp(playheadSec, 0, totalSec) * pxPerSec;

  return (
    <section
      aria-label="المسارات الزمنية"
      className="w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3 shadow-sm"
    >
      <div className="flex gap-2">
        {/* عمود التسميات (يمين) */}
        <div className="hidden w-28 shrink-0 flex-col gap-1 md:flex">
          <div className="h-6" />
          <TrackLabel icon={Clapperboard} text={videoLabel || 'فيديو'} visible={trackVisibility.video} onToggle={() => onToggleTrack('video')} lock />
          <TrackLabel icon={AudioLines} text="صوت التلاوة" />
          <TrackLabel icon={Music} text="الموسيقى الخلفية" dimmed={!trackVisibility.music} visible={trackVisibility.music} onToggle={() => onToggleTrack('music')} lock />
          <TrackLabel icon={Sparkles} text="المؤثرات الصوتية" dimmed={!trackVisibility.effects} visible={trackVisibility.effects} onToggle={() => onToggleTrack('effects')} />
          <TrackLabel icon={Type} text="النصوص والشرح" dimmed={!trackVisibility.text} visible={trackVisibility.text} onToggle={() => onToggleTrack('text')} />
        </div>

        {/* منطقة المسارات القابلة للتمرير */}
        <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-x-auto studio-scroll">
          <div className="relative flex min-w-full flex-col gap-1" style={{ width: `${contentWidthPct}%` }}>
            {/* المسطرة */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="المسطرة الزمنية — انقر أو اسحب للانتقال إلى زمن"
              aria-valuemin={0}
              aria-valuemax={Math.round(totalSec)}
              aria-valuenow={Math.round(clamp(playheadSec, 0, totalSec))}
              onPointerDown={rulerPointerDown}
              onPointerMove={rulerPointerMove}
              onPointerUp={rulerPointerEnd}
              onPointerCancel={rulerPointerEnd}
              onKeyDown={rulerKeyDown}
              className="relative h-6 touch-none cursor-pointer rounded-md border border-[var(--border-hairline)] bg-white"
            >
              {ticks.map((sec) => (
                <div key={sec} aria-hidden className="absolute top-0 flex h-full items-center" style={{ insetInlineStart: `${sec * pxPerSec}px` }}>
                  <span className="absolute top-0 h-2 w-px bg-[#d8cfb9]" />
                  <span className="ps-1 text-[10px] tabular-nums text-[#6a6155]">{formatRulerLabel(sec)}</span>
                </div>
              ))}
            </div>

            {/* 1 — فيديو: شريط لقطات */}
            <div className="relative h-11 overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[#eef2f7]">
              <MobileChip label="فيديو" />
              {trackVisibility.video ? (
                filmstripTiles.length > 0 ? (
                  <div className="flex h-full items-center gap-1 overflow-hidden px-1">
                    {filmstripTiles.map((src, i) =>
                      src ? (
                        <img key={i} src={src} alt="" draggable={false} loading="lazy" className="h-9 w-[68px] shrink-0 rounded-md border border-[#d8cfb9] object-cover" />
                      ) : (
                        <div key={i} aria-hidden className="flex h-9 w-[68px] shrink-0 items-center justify-center rounded-md border border-[#d8cfb9] bg-gradient-to-br from-[#123c22] to-[#2e6b4f]">
                          <Film className="h-3.5 w-3.5 text-[#d4af37]" />
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <LaneHint>بلا إطارات فيديو</LaneHint>
                )
              ) : (
                <LaneHint>المسار مخفي</LaneHint>
              )}
            </div>

            {/* 2 — صوت التلاوة (كانفاس) */}
            <div className="relative h-11 overflow-hidden rounded-lg border border-[var(--border-hairline)]">
              <MobileChip label="تلاوة" />
              <WaveCanvas widthPx={contentPx} heightPx={44} render={drawRecitation} ariaLabel="موجة صوت التلاوة مع علامات الآيات" />
            </div>

            {/* 3 — الموسيقى الخلفية (كانفاس) */}
            <div className="relative h-11 overflow-hidden rounded-lg border border-[var(--border-hairline)]">
              <MobileChip label="موسيقى" />
              <WaveCanvas widthPx={contentPx} heightPx={44} render={drawMusic} ariaLabel="موجة الموسيقى الخلفية" />
            </div>

            {/* 4 — المؤثرات الصوتية (برتقالي) */}
            <div className="relative h-11 overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[#fdf3e7]">
              <MobileChip label="مؤثرات" />
              {trackVisibility.effects ? (
                effectClips.length > 0 ? (
                  effectClips.map((clip) => {
                    const widthPx = Math.max(16, (clip.endSec - clip.startSec) * pxPerSec);
                    const label = effectKindLabel(clip);
                    const selected = selectedEffectId === clip.id;
                    return (
                      <div
                        key={clip.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`مؤثر ${label}`}
                        onClick={() => setSelectedEffectId(clip.id)}
                        className={`absolute top-1/2 z-10 flex h-7 -translate-y-1/2 items-center gap-1 overflow-hidden rounded-md border border-orange-300 bg-[#f5a13a] px-2 text-[10px] font-bold text-white ${selected ? 'ring-2 ring-[#d4af37]' : ''}`}
                        style={{ insetInlineStart: `${clip.startSec * pxPerSec}px`, width: `${widthPx}px` }}
                      >
                        <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">{label}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveEffect(clip.id);
                          }}
                          aria-label={`إزالة مؤثر ${label}`}
                          className="shrink-0 rounded p-0.5 transition-colors hover:bg-black/20"
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <LaneHint>بلا مؤثرات</LaneHint>
                )
              ) : (
                <LaneHint>المسار مخفي</LaneHint>
              )}
            </div>

            {/* 5 — النصوص والشرح (أزرق، قابلة للسحب) */}
            <div className="relative h-11 overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[#e8f2fb]">
              <MobileChip label="نصوص" />
              {trackVisibility.text ? (
                textClips.length > 0 ? (
                  textClips.map((clip) => {
                    const dur = Math.max(0.2, clip.endSec - clip.startSec);
                    const label = textClipLabel(clip);
                    return (
                      <div
                        key={clip.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`مقطع نص: ${label}`}
                        title={label}
                        onPointerDown={(e) => startTextClipDrag(e, clip)}
                        onPointerMove={moveTextClipDrag}
                        onPointerUp={endTextClipDrag}
                        onPointerCancel={endTextClipDrag}
                        onKeyDown={(e) => textClipKeyDown(e, clip)}
                        className="absolute top-1/2 z-10 flex h-7 -translate-y-1/2 cursor-grab touch-none select-none items-center overflow-hidden rounded-md border border-sky-300 bg-[#5eb8e8] px-2 text-[10px] font-bold text-white active:cursor-grabbing"
                        style={{ insetInlineStart: `${clip.startSec * pxPerSec}px`, width: `${Math.max(18, dur * pxPerSec)}px` }}
                      >
                        <span className="truncate">{label}</span>
                      </div>
                    );
                  })
                ) : (
                  <LaneHint>بلا نصوص</LaneHint>
                )
              ) : (
                <LaneHint>المسار مخفي</LaneHint>
              )}
            </div>

            {/* المؤشر الأحمر — يخترق كل المسارات */}
            <div className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-[#dc2626]" style={{ insetInlineStart: `${playheadPx}px` }} aria-hidden>
              <span className="absolute -top-px start-[-3px] h-2 w-2 rotate-45 rounded-[2px] bg-[#dc2626]" />
            </div>
          </div>
        </div>
      </div>

      {/* شريط التقريب */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ZoomBtn label="تصغير الخط الزمني" onClick={() => onZoom(Math.max(0.25, zoom - 0.25))}>
          <ZoomOut className="h-3.5 w-3.5" aria-hidden />
        </ZoomBtn>
        <input
          type="range"
          min={0.25}
          max={4}
          step={0.25}
          value={zoom}
          onChange={(e) => onZoom(Number(e.target.value))}
          aria-label="مستوى التقريب"
          className="w-28 accent-[#b88a1e]"
        />
        <ZoomBtn label="تكبير الخط الزمني" onClick={() => onZoom(Math.min(4, zoom + 0.25))}>
          <ZoomIn className="h-3.5 w-3.5" aria-hidden />
        </ZoomBtn>
        <button
          type="button"
          onClick={onZoomFit}
          className="flex h-7 items-center rounded-full border border-[#d4af37]/50 bg-white px-3 text-[11px] font-bold text-[#123c22] transition-colors hover:bg-[#fdfbf4]"
        >
          ملاءمة
        </button>
        <span className="ms-auto text-[10px] tabular-nums text-[var(--ink-muted)]">
          المدة: {formatProductionClock(totalSec)}
        </span>
      </div>
    </section>
  );
}
