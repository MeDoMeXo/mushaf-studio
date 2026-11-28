'use client';

/**
 * ProducerPreviewPanel — معاينة الآية الجارية (نمط معاينة محرر الفيديو):
 * لوحة داكنة تعرض الآية بالرسم العثماني بخط «أميري قرآن» + شارة السورة
 * والقارئ + نقاط الآيات، وأسفلها شريط النقل الكامل (تنقّل آيات، تشغيل،
 * سرعة، صوت، الوقت).
 *
 * وضع «الآية في سطر واحد»: نص الآية سطر واحد أفقي يتحرك أفقياً مع تقدّم
 * التلاوة (verseProgress) فيتابع النص المكتوب الصوتَ كلمةً كلمة — كنمط
 * كاريوكي المتاجر.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MoveHorizontal,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';
import { formatAudioTime, toArabicDigits } from '@/lib/quran-utils';

const RATES = [0.75, 1, 1.25, 1.5, 2];

interface ProducerPreviewPanelProps {
  /** نصوص الآيات بالرسم العثماني (وضع القارئ) — null في وضع الملف */
  verseTexts: string[] | null;
  surahName: string | null;
  reciterName: string | null;
  sourceLabel: string | null;
  activeVerseIdx: number;
  verseCount: number;
  activeVerseNumber: number | null;
  // النقل
  isPlaying: boolean;
  playheadEditedSec: number;
  editedTotalSec: number;
  keptPct: number;
  volume: number;
  rate: number;
  onTogglePlay: () => void;
  onSeekToEdge: (edge: 'start' | 'end') => void;
  onPrevVerse: () => void;
  onNextVerse: () => void;
  onVolumeChange: (v: number) => void;
  onRateChange: (r: number) => void;
  onSelectVerse: (idx: number) => void;
  // وضع «الآية في سطر واحد»
  oneLine: boolean;
  onToggleOneLine: (v: boolean) => void;
  /** تقدّم التلاوة داخل الآية الجارية 0..1 — يحرّك النص في الواحد. */
  verseProgress: number;
}

export function ProducerPreviewPanel({
  verseTexts,
  surahName,
  reciterName,
  sourceLabel,
  activeVerseIdx,
  verseCount,
  activeVerseNumber,
  isPlaying,
  playheadEditedSec,
  editedTotalSec,
  keptPct,
  volume,
  rate,
  onTogglePlay,
  onSeekToEdge,
  onPrevVerse,
  onNextVerse,
  onVolumeChange,
  onRateChange,
  onSelectVerse,
  oneLine,
  onToggleOneLine,
  verseProgress,
}: ProducerPreviewPanelProps) {
  const text = verseTexts && activeVerseIdx >= 0 ? verseTexts[activeVerseIdx] : null;
  const textSizeClass =
    !text || text.length <= 40
      ? 'text-xl sm:text-3xl lg:text-4xl'
      : text.length <= 90
        ? 'text-lg sm:text-2xl lg:text-3xl'
        : 'text-base sm:text-xl lg:text-2xl';

  // ── قياس فيض السطر الواحد لتحريك النص مع الصوت ────────────────────
  // بلا حالة: القياس في مرجع وكتابة transform مباشرة على العنصر — لا
  // إعادة رندر لكل إطار، ولا setState داخل الآثار (react-hooks).
  const lineViewportRef = useRef<HTMLDivElement | null>(null);
  const lineTextRef = useRef<HTMLDivElement | null>(null);
  const overflowPxRef = useRef(0);
  const progressRef = useRef(0);

  const applyPan = useCallback(() => {
    const el = lineTextRef.current;
    if (!el) return;
    const x = progressRef.current * overflowPxRef.current;
    el.style.transform = `translate(${x.toFixed(1)}px, -50%)`;
  }, []);

  useLayoutEffect(() => {
    if (!oneLine || !text) {
      overflowPxRef.current = 0;
      return;
    }
    const measure = () => {
      const vp = lineViewportRef.current;
      const el = lineTextRef.current;
      if (!vp || !el) return;
      overflowPxRef.current = Math.max(0, el.scrollWidth - vp.clientWidth);
      applyPan();
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (lineViewportRef.current) ro.observe(lineViewportRef.current);
    return () => ro.disconnect();
  }, [applyPan, oneLine, text]);

  // الحركة مع تقدّم التلاوة — تحديث المرجع ثم كتابة الموضع مباشرة.
  useEffect(() => {
    progressRef.current = verseProgress;
    applyPan();
  }, [applyPan, verseProgress, text]);

  return (
    <section
      aria-label="معاينة الآية"
      className="flex min-h-0 flex-1 flex-col gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3"
    >
      {/* لوحة المعاينة الداكنة */}
      <div
        dir="rtl"
        role="img"
        aria-label={
          text
            ? `معاينة الآية ${activeVerseNumber ?? activeVerseIdx + 1} من ${surahName ?? 'السورة'}`
            : 'معاينة التلاوة'
        }
        className="relative flex min-h-[200px] flex-1 select-none flex-col items-center justify-center overflow-hidden rounded-xl border border-[#2E3B33] bg-[radial-gradient(ellipse_at_50%_20%,#123527_0%,#081510_55%,#050D0A_100%)] p-6 text-center"
      >
        {/* هالة ذهبية خفيفة */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.08),transparent_65%)]" aria-hidden="true" />
        {/* زخرفة إطار */}
        <div className="pointer-events-none absolute inset-3 rounded-lg border border-[#D4AF37]/25" aria-hidden="true">
          <span className="absolute -top-px right-6 h-px w-10 bg-[#D4AF37]/50" aria-hidden="true" />
          <span className="absolute -bottom-px left-6 h-px w-10 bg-[#D4AF37]/50" aria-hidden="true" />
        </div>

        {/* شارة السورة */}
        <div className="z-10 mb-4 flex flex-wrap items-center justify-center gap-1.5">
          {surahName && (
            <span className="rounded-full border border-[#D4AF37]/40 bg-[#0A1F16]/80 px-3 py-1 text-[11px] font-bold text-[#E6C75A]">
              {surahName}
            </span>
          )}
          {reciterName && (
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-bold text-white/70">
              {reciterName}
            </span>
          )}
          {oneLine && text && (
            <span className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-2 py-0.5 text-[9px] font-bold text-[#E6C75A]">
              سطر واحد متتبِّع
            </span>
          )}
        </div>

        {/* نص الآية الجارية — سطر واحد يتحرك مع الصوت */}
        {oneLine && text ? (
          <div
            ref={lineViewportRef}
            className="relative z-10 w-full max-w-full overflow-hidden px-4"
            aria-hidden={false}
          >
            {/* تلاشي حواف يلمّح باستمرار النص */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#081510] to-transparent"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#081510] to-transparent"
              aria-hidden="true"
            />
            <div
              ref={lineTextRef}
              dir="rtl"
              className="font-quran absolute top-1/2 right-0 w-max min-h-[1.4em] whitespace-nowrap py-4 text-2xl leading-[2] text-[#F5EFDC] [text-shadow:0_2px_18px_rgba(212,175,55,0.35)] will-change-transform sm:text-3xl"
              style={{ transform: 'translate(0px, -50%)' }}
            >
              {text}
            </div>
            {/* موضع الاحتياط لارتفاع السطر */}
            <div className="font-quran invisible min-h-[2.8em] whitespace-nowrap text-2xl leading-[2] sm:text-3xl">
              {text}
            </div>
          </div>
        ) : text ? (
          <p
            className={`font-quran z-10 max-w-[42ch] leading-[2.2] ${textSizeClass} text-[#F5EFDC] [text-shadow:0_2px_18px_rgba(212,175,55,0.35)]`}
          >
            {text}
          </p>
        ) : (
          <div className="z-10 flex flex-col items-center gap-2">
            <p className="font-quran text-2xl text-[#E6C75A]">
              {verseCount > 0 && activeVerseNumber
                ? `الآية ${toArabicDigits(activeVerseNumber)}`
                : 'التلاوة المحرَّرة'}
            </p>
            <p className="text-[10px] font-bold text-white/50">
              {sourceLabel ?? 'ارفع تلاوة لعرض الآيات هنا'}
            </p>
          </div>
        )}

        {/* نقاط الآيات */}
        {verseCount > 1 && (
          <div className="z-10 mt-5 flex flex-wrap items-center justify-center gap-1" aria-hidden="true">
            {Array.from({ length: verseCount }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelectVerse(i)}
                aria-label={`الآية ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeVerseIdx
                    ? 'w-5 bg-[#E6C75A]'
                    : 'w-1.5 bg-white/25 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        )}

        {/* شارة التشغيل */}
        {isPlaying && (
          <span className="absolute bottom-2 left-3 z-10 flex items-center gap-1 rounded-full bg-[#D4AF37]/15 px-2 py-0.5 text-[9px] font-bold text-[#E6C75A]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E6C75A]" aria-hidden="true" />
            تُتلى الآن
          </span>
        )}
      </div>

      {/* شريط النقل */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/60 px-2.5 py-2">
        {/* تنقّل وتشغيل */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSeekToEdge('start')}
            aria-label="الانتقال إلى البداية"
            title="البداية (Home)"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)]"
          >
            <SkipBack className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onPrevVerse}
            disabled={verseCount === 0 || activeVerseIdx <= 0}
            aria-label="الآية السابقة"
            title="الآية السابقة"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)] disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'إيقاف التشغيل' : 'تشغيل'}
            title={isPlaying ? 'إيقاف (مسافة)' : 'تشغيل (مسافة)'}
            disabled={editedTotalSec <= 0}
            className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--brand-emerald)] text-[#FAF7F0] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-[var(--brand-gold)] dark:text-[#1F1705]"
          >
            {isPlaying ? (
              <Pause className="h-4.5 w-4.5" aria-hidden="true" />
            ) : (
              <Play className="h-4.5 w-4.5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={onNextVerse}
            disabled={verseCount === 0 || activeVerseIdx >= verseCount - 1}
            aria-label="الآية التالية"
            title="الآية التالية"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)] disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onSeekToEdge('end')}
            aria-label="الانتقال إلى النهاية"
            title="النهاية (End)"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)]"
          >
            <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* الوقت */}
        <div className="order-last w-full text-center font-mono text-xs font-bold text-[var(--ink-primary)] tabular-nums sm:order-none sm:w-auto">
          {formatAudioTime(playheadEditedSec)} / {formatAudioTime(editedTotalSec)}
          <span className="mx-1 text-[var(--border-hairline)]">·</span>
          <span className="text-[var(--brand-gold)]" title="نسبة المحفوظ بعد التحرير">
            {toArabicDigits(keptPct)}٪
          </span>
        </div>

        {/* السرعة والصوت ووضع السطر الواحد */}
        <div className="flex items-center gap-2">
          {verseTexts && (
            <button
              type="button"
              onClick={() => onToggleOneLine(!oneLine)}
              aria-pressed={oneLine}
              title="الآية في سطر واحد يتحرك مع التلاوة"
              aria-label="وضع الآية في سطر واحد"
              className={`flex h-8 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold transition-colors ${
                oneLine
                  ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--ink-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-muted)] hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)]'
              }`}
            >
              <MoveHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              سطر واحد
            </button>
          )}
          <div role="group" aria-label="سرعة التشغيل" className="flex items-center gap-0.5 rounded-lg bg-[var(--surface-card)] p-0.5">
            {RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRateChange(r)}
                aria-pressed={rate === r}
                title={`سرعة ×${r}`}
                className={`rounded-md px-1.5 py-1 text-[10px] font-bold tabular-nums transition-colors ${
                  rate === r
                    ? 'bg-[var(--brand-gold)] text-[#1F1705]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                }`}
              >
                ×{toArabicDigits(String(r))}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Volume2 className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="مستوى الصوت"
              className="h-1.5 w-16 accent-[var(--brand-gold)] sm:w-20"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
