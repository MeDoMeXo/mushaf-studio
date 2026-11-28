'use client';

/**
 * ProductionPreview — منطقة المعاينة الوسطى في استوديو الإنتاج.
 *
 * كانفيس المشهد الحي (نسبة أبعاد التصدير) + شريط أدوات أسفله (تراجع/
 * إعادة، تكبير، إدارة الطبقات) — كما في التصميم المرجعي.
 */
import { useState } from 'react';
import {
  Eye,
  EyeOff,
  Layers,
  Maximize2,
  Pause,
  Play,
  Redo2,
  Settings2,
  Undo2,
  Volume2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { formatProductionClock } from '@/lib/production/production-types';
import type { ProductionVisuals } from '@/lib/production/production-types';

export interface ProductionPreviewProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasW: number;
  canvasH: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playheadSec: number;
  totalSec: number;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoom: (z: number) => void;
  onZoomFit: () => void;
  trackVisibility: { video: boolean; music: boolean; effects: boolean; text: boolean };
  onToggleTrack: (t: 'video' | 'music' | 'effects' | 'text') => void;
  visuals: ProductionVisuals;
  onVisuals: (patch: Partial<ProductionVisuals>) => void;
  loadingLabel: string | null;
  onFullscreen?: () => void;
}

const TRACK_LABELS: { key: 'video' | 'music' | 'effects' | 'text'; label: string }[] = [
  { key: 'video', label: 'فيديو' },
  { key: 'music', label: 'موسيقى' },
  { key: 'effects', label: 'مؤثرات' },
  { key: 'text', label: 'نصوص' },
];

export function ProductionPreview(props: ProductionPreviewProps) {
  const {
    canvasRef,
    canvasW,
    canvasH,
    isPlaying,
    onTogglePlay,
    playheadSec,
    totalSec,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    zoom,
    onZoom,
    onZoomFit,
    trackVisibility,
    onToggleTrack,
    visuals,
    onVisuals,
    loadingLabel,
  } = props;
  const [layersOpen, setLayersOpen] = useState(false);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2" aria-label="معاينة الفيديو">
      {/* شاشة المعاينة — إطار ذهبي رقيق حول الكانفيس */}
      <div className="studio-stage-grid relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-[#d4af37]/40 p-2">
        {loadingLabel && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#062318]/70 text-sm font-bold text-[#e6c75a]">
            {loadingLabel}
          </div>
        )}
        <div className="relative h-full max-h-full" style={{ aspectRatio: `${canvasW} / ${canvasH}` }}>
          <canvas
            ref={canvasRef}
            className="h-full w-full rounded-xl border border-[#d4af37]/30 shadow-lg"
            onClick={onTogglePlay}
            aria-label="شاشة المعاينة — انقر للتشغيل أو الإيقاف"
          />
          {/* طبقة التحكم السفلية (كما في التصميم): زمن + أزرار */}
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between rounded-lg bg-[#062318]/55 px-3 py-1.5 text-xs text-white/95 backdrop-blur-sm">
            <span className="tabular-nums font-bold">
              {formatProductionClock(playheadSec)} / {formatProductionClock(totalSec)}
            </span>
            <span className="flex items-center gap-2">
              <Volume2 className="h-3.5 w-3.5 opacity-80" aria-hidden />
              <Settings2 className="h-3.5 w-3.5 opacity-80" aria-hidden />
            </span>
          </div>
          {/* زر التشغيل الكبير يظهر عند الوقوف */}
          {!isPlaying && !loadingLabel && (
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label="تشغيل المعاينة"
              className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0b3d2e]/85 text-white shadow-xl ring-2 ring-[#d4af37]/60 transition hover:scale-105"
            >
              <Play className="h-6 w-6 -scale-x-100 rtl:scale-x-[-1]" fill="currentColor" aria-hidden />
            </button>
          )}
          {isPlaying && (
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label="إيقاف مؤقت"
              className="absolute inset-0 m-auto hidden h-14 w-14 items-center justify-center rounded-full bg-[#0b3d2e]/85 text-white shadow-xl ring-2 ring-[#d4af37]/60"
            >
              <Pause className="h-6 w-6" fill="currentColor" aria-hidden />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={props.onFullscreen}
          aria-label="ملء الشاشة"
          className="absolute top-2 left-2 rounded-md bg-white/10 p-1.5 text-white/80 hover:bg-white/20"
        >
          <Maximize2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* شريط الأدوات أسفل المعاينة: تراجع/إعادة + تكبير + إدارة الطبقات */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="تراجع"
            title="تراجع (تحرير الصوت)"
            className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--ink-primary)] enabled:hover:bg-[#f5f2e8] disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">تراجع</span>
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="إعادة"
            title="إعادة (تحرير الصوت)"
            className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--ink-primary)] enabled:hover:bg-[#f5f2e8] disabled:opacity-40"
          >
            <Redo2 className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">إعادة</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onZoom(Math.max(0.25, zoom - 0.25))}
            aria-label="تصغير الخط الزمني"
            className="rounded-md p-1.5 text-[var(--ink-muted)] hover:bg-[#f5f2e8]"
          >
            <ZoomOut className="h-4 w-4" aria-hidden />
          </button>
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.25}
            value={zoom}
            onChange={(e) => onZoom(Number(e.target.value))}
            aria-label="تكبير/تصغير الخط الزمني"
            className="w-24 accent-[var(--brand-gold)]"
          />
          <button
            type="button"
            onClick={() => onZoom(Math.min(4, zoom + 0.25))}
            aria-label="تكبير الخط الزمني"
            className="rounded-md p-1.5 text-[var(--ink-muted)] hover:bg-[#f5f2e8]"
          >
            <ZoomIn className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onZoomFit}
            className="rounded-lg border border-[#d4af37]/50 px-2 py-1 text-[11px] font-semibold text-[#123c22] hover:bg-[#fdf8ea]"
          >
            ملاءمة
          </button>
        </div>

        {/* إدارة الطبقات — بوب فوق بالمرئيات + المسارات */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLayersOpen((v) => !v)}
            aria-label="إدارة الطبقات"
            className="flex h-8 items-center gap-1 rounded-lg border border-[#d4af37]/50 px-3 text-xs font-semibold text-[#123c22] hover:bg-[#fdf8ea]"
          >
            <Layers className="h-4 w-4" aria-hidden />
            إدارة الطبقات
          </button>
          {layersOpen && (
            <div className="absolute bottom-10 left-0 z-30 w-56 rounded-xl border border-[var(--border-hairline)] bg-white p-2 shadow-xl">
              <p className="mb-1 px-2 text-[11px] font-bold text-[var(--ink-muted)]">مسارات العرض</p>
              {TRACK_LABELS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onToggleTrack(key)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[#f5f2e8]"
                >
                  {label}
                  {trackVisibility[key] ? (
                    <Eye className="h-3.5 w-3.5 text-[#0b3d2e]" aria-hidden />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden />
                  )}
                </button>
              ))}
              <p className="mt-1 mb-1 px-2 text-[11px] font-bold text-[var(--ink-muted)]">طبقات المشهد</p>
              {(
                [
                  ['showSurahTitle', 'عنوان السورة'],
                  ['showReciterName', 'اسم القارئ'],
                  ['showTranslation', 'الترجمة'],
                  ['karaoke', 'تلوين الكلمة الجارية'],
                  ['goldFrame', 'الإطار الذهبي'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onVisuals({ [key]: !visuals[key] } as Partial<ProductionVisuals>)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[#f5f2e8]"
                >
                  {label}
                  {visuals[key] ? (
                    <Eye className="h-3.5 w-3.5 text-[#0b3d2e]" aria-hidden />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
