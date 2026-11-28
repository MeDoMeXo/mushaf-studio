'use client';

/**
 * StudioProductionPanel — تبويب «منتج الصوت» في لوحة التنسيق:
 * خط زمني حقيقي للتلاوة (مسطرة + موجات مستخرجة من الصوت الفعلي +
 * مؤشر تشغيل + شرائح الآيات) ومسار الترجمة النصية أسفله، مع أدوات
 * إنتاج مختصرة (إحصاءات + إعادة تحليل + دمج الملف المخصص).
 *
 * وضعان:
 * - مدمج (قارئ لكل آية): مقاطع متراكمة بمدد حقيقية من فك ترميز كل آية.
 * - ملف مرفوع واحد: مسار واحد بعلامات حدود الآيات المضبوطة.
 */
import React, { useCallback, useMemo } from 'react';
import { AudioWaveform, RefreshCw } from 'lucide-react';
import type { QulVerse, StudioState } from '@/lib/quran-data';
import { stripHtmlTags, toArabicDigits } from '@/lib/quran-utils';
import { useVerseWaveforms } from '@/hooks/use-verse-waveforms';
import {
  buildTimelineSegments,
  estimateVerseDurationSec,
  extremeSegments,
  findSegmentAtSec,
  playheadAbsoluteSec,
  timelineTotalSec,
  type TimelineSegment,
} from '@/lib/timeline-peaks';
import { StudioInspectorSection } from './StudioInspectorSection';
import { StudioTabPanel } from './StudioTabs';
import { StudioTimelineTrack } from './StudioTimelineTrack';

export interface StudioProductionPanelProps {
  state: StudioState;
  selectedVerses: QulVerse[];
  isPlaying: boolean;
  audioCurrentTime: number;
  audioDuration: number;
  activeIdxInRange: number;
  customAudioFile: File | null;
  customAudioUrl: string | null;
  onTogglePlay: () => void;
  onSeekAudio: (timeSec: number) => void;
  onSelectVerseIndex: (idx: number) => void;
  showToast: (msg: string) => void;
}

export function StudioProductionPanel({
  state,
  selectedVerses,
  isPlaying,
  audioCurrentTime,
  audioDuration,
  activeIdxInRange,
  customAudioFile,
  customAudioUrl,
  onTogglePlay,
  onSeekAudio,
  onSelectVerseIndex,
  showToast,
}: StudioProductionPanelProps) {
  const isCustom = Boolean(customAudioUrl && customAudioFile);

  const {
    verseWaveforms,
    customWaveform,
    progress,
    reanalyze,
  } = useVerseWaveforms({
    selectedVerses,
    reciterSlug: state.reciter,
    customAudioFile: isCustom ? customAudioFile : null,
  });

  // ── بناء المقاطع حسب الوضع ─────────────────────────────────────────
  const segments = useMemo<TimelineSegment[]>(() => {
    if (isCustom) {
      // مسار واحد طويل: مدته من فك الملف، أو المشغّل.
      const dur = customWaveform?.durationSec ?? (audioDuration > 0 ? audioDuration : 0);
      return [
        {
          verseId: 0,
          verseNumber: 0,
          startSec: 0,
          durationSec: dur > 0 ? dur : 1,
          peaks: customWaveform?.peaks ?? null,
        },
      ];
    }
    return buildTimelineSegments(
      selectedVerses.map((v, i) => {
        const wf = verseWaveforms.get(v.id);
        return {
          verseId: v.id,
          verseNumber: state.fromAyah + i,
          durationSec:
            wf?.durationSec ?? estimateVerseDurationSec(v.text_uthmani ?? ''),
          peaks: wf?.peaks ?? null,
        };
      })
    );
  }, [isCustom, customWaveform, audioDuration, selectedVerses, verseWaveforms, state.fromAyah]);

  const totalSec = useMemo(() => timelineTotalSec(segments), [segments]);
  const { longest, shortest } = useMemo(() => extremeSegments(segments), [segments]);

  // ── موضع مؤشر التشغيل المطلق ───────────────────────────────────────
  const playheadSec = isCustom
    ? audioCurrentTime
    : playheadAbsoluteSec(segments, activeIdxInRange, audioCurrentTime);

  // ── تقديم من الخط الزمني ───────────────────────────────────────────
  const handleSeekAbsolute = useCallback(
    (t: number) => {
      if (isCustom) {
        onSeekAudio(t);
        return;
      }
      const idx = findSegmentAtSec(segments, t);
      if (idx === activeIdxInRange) {
        // داخل الآية النشطة: تقديم مباشر داخل ملفها المحمّل.
        onSeekAudio(t - segments[idx].startSec);
      } else {
        // آية أخرى: اختيارها — التشغيل يبدأ من بدايتها.
        onSelectVerseIndex(idx);
      }
    },
    [isCustom, onSeekAudio, onSelectVerseIndex, activeIdxInRange, segments]
  );

  // شريحة آية في وضع الملف المخصص: اختيار + تقديم إلى بداية حدّها.
  const handleChipSelect = useCallback(
    (idx: number) => {
      const bounds = state.customVerseBounds;
      if (isCustom && Array.isArray(bounds) && bounds.length === selectedVerses.length) {
        onSelectVerseIndex(idx);
        onSeekAudio(bounds[idx]);
        return;
      }
      if (!isCustom && idx === activeIdxInRange) {
        // إعادة المؤشر إلى بداية الآية الحالية.
        onSeekAudio(0);
        return;
      }
      onSelectVerseIndex(idx);
    },
    [isCustom, state.customVerseBounds, selectedVerses.length, onSelectVerseIndex, onSeekAudio, activeIdxInRange]
  );

  // ── مسار الترجمة النصية (محاذاة مع ترتيب الآيات) ────────────────────
  const translationTexts = useMemo(() => {
    const texts = selectedVerses.map((v) => {
      // تنقية وسوم HTML (حواشي QUL الفرعية) كنمط قارئ المصحف نفسه.
      const t = stripHtmlTags(v.translations?.[0]?.text ?? '');
      return t.length > 0 ? t : null;
    });
    return texts.some(Boolean) ? texts : null;
  }, [selectedVerses]);

  const handleReanalyze = useCallback(() => {
    reanalyze();
    showToast(isCustom ? 'إعادة تحليل الملف المرفوع…' : 'إعادة استخراج موجات الآيات…');
  }, [reanalyze, showToast, isCustom]);

  const waveReadyLabel =
    progress.total > 0
      ? `${toArabicDigits(progress.ready)}/${toArabicDigits(progress.total)}`
      : '—';

  return (
    <StudioTabPanel value="production" className="space-y-2.5 focus:outline-none">
      <StudioInspectorSection
        id="prd-timeline"
        title="الخط الزمني للتلاوة"
        icon={<AudioWaveform className="h-3.5 w-3.5" />}
        badge={
          progress.status === 'loading' ? (
            <span className="rounded-md bg-[var(--brand-gold)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-gold)] tabular-nums">
              تحليل {waveReadyLabel}
            </span>
          ) : progress.status === 'partial' ? (
            <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 tabular-nums dark:text-amber-300">
              جزئي {waveReadyLabel}
            </span>
          ) : undefined
        }
      >
        <div className="space-y-2">
          <StudioTimelineTrack
            segments={segments}
            totalSec={totalSec}
            activeIdx={Math.min(activeIdxInRange, Math.max(0, segments.length - 1))}
            playheadSec={playheadSec}
            isPlaying={isPlaying}
            customVerseBounds={isCustom ? state.customVerseBounds ?? null : null}
            translationTexts={translationTexts ?? undefined}
            analyzing={progress.status === 'loading'}
            onSelectVerseIndex={handleChipSelect}
            onSeekAbsolute={handleSeekAbsolute}
            onTogglePlay={onTogglePlay}
          />

          {isCustom && (
            <p className="rounded-lg bg-[var(--surface-subtle)]/70 px-2.5 py-1.5 text-[10px] leading-relaxed text-[var(--ink-muted)]">
              الخطوط الذهبية المتقطّعة = حدود الآيات داخل الملف المرفوع. اضبطها
              من قسم «الملف الصوتي المخصص» في لوحة التلاوة (كشف تلقائي أو
              «هنا») فتنعكس فوراً هنا.
            </p>
          )}
          {progress.status === 'partial' && !isCustom && (
            <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
              تعذّر تحليل موجات {toArabicDigits(progress.failed)} آية — تُقدَّر
              مددها مؤقتاً (خطوط هادئة). جرّب «إعادة الاستخراج» أو قارئاً آخر.
            </p>
          )}
        </div>
      </StudioInspectorSection>

      <StudioInspectorSection id="prd-tools" title="أدوات المنتج">
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg bg-[var(--surface-subtle)]/70 px-2.5 py-2">
              <p className="text-[10px] font-semibold text-[var(--ink-muted)]">مدة المقطع</p>
              <p className="mt-0.5 text-xs font-bold text-[var(--ink-primary)] tabular-nums">
                {formatDur(totalSec)}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--surface-subtle)]/70 px-2.5 py-2">
              <p className="text-[10px] font-semibold text-[var(--ink-muted)]">عدد الآيات</p>
              <p className="mt-0.5 text-xs font-bold text-[var(--ink-primary)] tabular-nums">
                {toArabicDigits(selectedVerses.length)}
              </p>
            </div>
            {longest && (
              <div className="rounded-lg bg-[var(--surface-subtle)]/70 px-2.5 py-2">
                <p className="text-[10px] font-semibold text-[var(--ink-muted)]">أطول آية</p>
                <p className="mt-0.5 text-xs font-bold text-[var(--ink-primary)] tabular-nums">
                  {toArabicDigits(longest.verseNumber)} · {formatDur(longest.durationSec)}
                </p>
              </div>
            )}
            {shortest && (
              <div className="rounded-lg bg-[var(--surface-subtle)]/70 px-2.5 py-2">
                <p className="text-[10px] font-semibold text-[var(--ink-muted)]">أقصر آية</p>
                <p className="mt-0.5 text-xs font-bold text-[var(--ink-primary)] tabular-nums">
                  {toArabicDigits(shortest.verseNumber)} · {formatDur(shortest.durationSec)}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleReanalyze}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/10 px-3 py-2 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-gold)]/20"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
            <span>إعادة استخراج الموجات من الصوت</span>
          </button>
          <p className="text-[10px] leading-relaxed text-[var(--ink-muted)]">
            الموجات تُحسب من الصوت الفعلي في المتصفح (بلا رفع) وتُخزَّن لكل
            قارئ — انقر المسار للتقديم، والشرائح للانتقال بين الآيات.
          </p>
        </div>
      </StudioInspectorSection>
    </StudioTabPanel>
  );
}

function formatDur(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m > 0) return `${m}:${String(r).padStart(2, '0')} د`;
  return `${r} ث`;
}
