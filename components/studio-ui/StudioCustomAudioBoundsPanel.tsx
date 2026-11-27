'use client';

/**
 * StudioCustomAudioBoundsPanel — لوحة ضبط حدود الآيات للملف الصوتي المرفوع.
 *
 * يحوّل الملف المرفوع (قطعة واحدة) إلى خط زمني للآيات:
 *  - «كشف تلقائي»: تحليل السكوت في المتصفح (Web Audio) واستخراج بداية كل آية.
 *  - «توزيع متساوٍ»: احتياطي فوري يقسّم المدة بالتساوي عند فشل الكشف.
 *  - تعديل يدوي دقيق: لكل آية حقل بداية (ثوانٍ) + زر «هنا» يلتقط موضع
 *    التشغيل الحالي أثناء الاستماع — تُطبَّع القيم تصاعدياً تلقائياً.
 * تُخزَّن الحدود في StudioState (customVerseBounds) فتنتقل للمعاينة
 * (تقدّم الآيات + الكاريوكي) وللتصدير (مدد الشرائح الحقيقية).
 */
import React from 'react';
import { Loader2, Radio, Sparkles, Trash2, Wand2 } from 'lucide-react';
import type { StudioState } from '@/lib/quran-data';
import { toArabicDigits } from '@/lib/quran-utils';
import {
  analyzeCustomAudioFile,
  buildEvenFallbackBounds,
  normalizeManualBounds,
  formatBoundarySec,
} from '@/lib/custom-audio-boundaries';
import { StudioSlider } from './StudioControls';

interface StudioCustomAudioBoundsPanelProps {
  state: StudioState;
  /** الملف المرفوع (File) — يُحلَّل محلياً في المتصفح دون أي رفع. */
  customAudioFile: File | null;
  /** موضع التشغيل الحالي بالثواني (لزر «اجعل البداية هنا»). */
  audioCurrentTime: number;
  /** مدة الملف كما يعرفها المشغّل. */
  audioDuration: number;
  /** هل التشغيل جارٍ الآن؟ (لتمكين الالتقاط الحي). */
  isPlaying: boolean;
  onPatchState: (patch: Partial<StudioState>) => void;
  showToast: (msg: string) => void;
}

export function StudioCustomAudioBoundsPanel({
  state,
  customAudioFile,
  audioCurrentTime,
  audioDuration,
  isPlaying,
  onPatchState,
  showToast,
}: StudioCustomAudioBoundsPanelProps) {
  const [detecting, setDetecting] = React.useState(false);
  const [detectMsg, setDetectMsg] = React.useState<string | null>(null);
  const [expandedVerse, setExpandedVerse] = React.useState<number | null>(null);

  const bounds = Array.isArray(state.customVerseBounds)
    ? state.customVerseBounds
    : null;
  const source = state.customVerseBoundsSource ?? null;
  const verseCount = state.toAyah - state.fromAyah + 1;
  const aligned = bounds !== null && bounds.length === verseCount;

  // ── كشف تلقائي للفواصل (سكوت بين الآيات) ─────────────────────────────
  const handleAutoDetect = React.useCallback(async () => {
    if (!customAudioFile || detecting) return;
    setDetecting(true);
    setDetectMsg(null);
    try {
      const result = await analyzeCustomAudioFile(customAudioFile, verseCount);
      if (result.ok && result.starts.length === verseCount) {
        onPatchState({
          customVerseBounds: result.starts,
          customVerseBoundsSource: 'auto',
        });
        // رسالة توجيهية عند النجاح عبر الاحتياطي (فشل التحليل الدقيق لكن
        // المدة حُدِّدت بـ<audio> أو بالتقدير) — الكشف الدقيق يصمت تماماً.
        if (result.message) {
          setDetectMsg(result.message);
          showToast('طُبّق توزيع متساوٍ — اضبط الحدود أثناء الاستماع');
        } else {
          setDetectMsg(null);
          showToast(`تم كشف حدود ${toArabicDigits(verseCount)} آيات تلقائياً`);
        }
      } else {
        // احتياطي: توزيع متساوٍ حتى يعدّله المستخدم يدوياً.
        const fallback = buildEvenFallbackBounds(verseCount, result.durationSec);
        if (fallback.length === verseCount && result.durationSec > 0) {
          onPatchState({
            customVerseBounds: fallback,
            customVerseBoundsSource: 'auto',
          });
        }
        setDetectMsg(result.message ?? 'تعذّر الكشف التلقائي — اضبط الحدود يدوياً');
        showToast(result.message ?? 'تعذّر الكشف التلقائي — اضبط الحدود يدوياً');
      }
    } finally {
      setDetecting(false);
    }
  }, [customAudioFile, detecting, onPatchState, showToast, verseCount]);

  // ── تعديل يدوي لبداية آية ───────────────────────────────────────────
  const setVerseStart = React.useCallback(
    (verseIdx: number, sec: number) => {
      if (!bounds || !bounds.length) return;
      const next = [...bounds];
      next[verseIdx] = Number.isFinite(sec) ? Math.max(0, sec) : next[verseIdx];
      const normalized = normalizeManualBounds(next, audioDuration || next[next.length - 1] + 10);
      onPatchState({
        customVerseBounds: normalized,
        customVerseBoundsSource: 'manual',
      });
    },
    [bounds, audioDuration, onPatchState]
  );

  // ── التقاط موضع التشغيل الحالي كبداية للآية ────────────────────────
  const captureCurrentTime = React.useCallback(
    (verseIdx: number) => {
      if (!Number.isFinite(audioCurrentTime)) return;
      setVerseStart(verseIdx, audioCurrentTime);
      showToast(
        `تم تعيين بداية الآية ${toArabicDigits(verseIdx + 1)} عند ${formatBoundarySec(
          audioCurrentTime,
          toArabicDigits
        )}`
      );
    },
    [audioCurrentTime, setVerseStart, showToast]
  );

  const clearBounds = React.useCallback(() => {
    onPatchState({
      customVerseBounds: undefined,
      customVerseBoundsSource: undefined,
    });
    setDetectMsg(null);
    setExpandedVerse(null);
  }, [onPatchState]);

  if (!customAudioFile) return null;

  return (
    <div
      data-testid="custom-audio-bounds-panel"
      className="mt-3 space-y-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/60 p-2.5"
    >
      {/* الرأس: الحالة + الكشف التلقائي */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Radio
            className="h-3.5 w-3.5 shrink-0 text-[var(--brand-gold)]"
            aria-hidden="true"
          />
          <span className="truncate text-[11px] font-bold text-[var(--ink-primary)]">
            حدود الآيات داخل المقطع
          </span>
          {aligned && (
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                source === 'manual'
                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {source === 'manual' ? 'ضبط يدوي' : 'كشف تلقائي'}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleAutoDetect}
            disabled={detecting}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/15 px-2.5 py-1 text-[11px] font-bold text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-gold)] hover:text-[#1F1705] disabled:opacity-50"
          >
            {detecting ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <Wand2 className="h-3 w-3" aria-hidden="true" />
            )}
            <span>{detecting ? 'جارٍ التحليل...' : 'كشف تلقائي'}</span>
          </button>
          {bounds && (
            <button
              type="button"
              onClick={clearBounds}
              aria-label="إزالة حدود الآيات"
              title="إزالة حدود الآيات"
              className="rounded-lg border border-[var(--border-hairline)] p-1.5 text-[var(--ink-muted)] transition-colors hover:border-red-400/60 hover:text-red-500"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* رسالة الكشف */}
      {detectMsg && (
        <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
          {detectMsg}
        </p>
      )}

      {!bounds && (
        <div className="space-y-1.5">
          <p className="text-[11px] leading-relaxed text-[var(--ink-muted)]">
            اضغط «كشف تلقائي» لتحليل فواصل السكوت بين الآيات، أو اضبط بداية كل
            آية يدوياً أثناء الاستماع. بدون حدود تُقسَّم مدة المقطع على الآيات
            بالتساوي تقريبياً.
          </p>
          {/* إرشاد الصيغة المثلى — أفضل توافق مع كل المتصفحات لفك الترميز */}
          <p className="text-[10px] leading-relaxed text-[var(--ink-muted)]/80">
            💡 أفضل صيغة: <span className="font-bold">MP3</span> أو{' '}
            <span className="font-bold">M4A/AAC</span> (‎128-320kbps‎). تُدعَم
            أيضاً WAV/OGG/FLAC بحسب المتصفح، وملفات AMR أو المقطّعة قد تفشل.
          </p>
        </div>
      )}

      {bounds && !aligned && (
        <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
          عدد الحدود ({toArabicDigits(bounds.length)}) لا يطابق عدد الآيات
          المحددة ({toArabicDigits(verseCount)}) — أعِد الكشف بعد ضبط النطاق.
        </p>
      )}

      {/* قائمة الآيات مع الحقول */}
      {bounds && aligned && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-[var(--ink-muted)]">
            <span>
              {toArabicDigits(bounds.length)} آية — بداية كل آية داخل المقطع
            </span>
            <span className="tabular-nums">
              {formatBoundarySec(audioDuration || 0, toArabicDigits)} إجمالي
            </span>
          </div>
          <div className="studio-scroll max-h-56 space-y-1 overflow-y-auto pr-0.5">
            {bounds.map((start, i) => {
              const end = i + 1 < bounds.length ? bounds[i + 1] : audioDuration || start;
              const dur = Math.max(0, end - start);
              const expanded = expandedVerse === i;
              return (
                <div
                  key={i}
                  className={`rounded-lg border px-2 py-1.5 transition-colors ${
                    expanded
                      ? 'border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/10'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-card)]/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedVerse(expanded ? null : i)}
                      aria-label={`تفاصيل الآية ${i + 1}`}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[var(--surface-subtle)] text-[11px] font-bold text-[var(--ink-primary)] tabular-nums transition-colors hover:bg-[var(--brand-gold)]/20"
                    >
                      {toArabicDigits(state.fromAyah + i)}
                    </button>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[var(--ink-primary)] tabular-nums">
                      {formatBoundarySec(start, toArabicDigits)}
                      <span className="ml-1.5 text-[10px] font-medium text-[var(--ink-muted)]">
                        (مدة {formatBoundarySec(dur, toArabicDigits)})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => captureCurrentTime(i)}
                      disabled={!isPlaying}
                      title={
                        isPlaying
                          ? 'تعيين بداية هذه الآية عند موضع التشغيل الحالي'
                          : 'شغّل المقطع أولاً ثم اضغط عند سماع بداية الآية'
                      }
                      className="shrink-0 rounded-md border border-[var(--border-hairline)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)]/60 hover:text-[var(--ink-primary)] disabled:opacity-40"
                    >
                      هنا
                    </button>
                  </div>
                  {expanded && (
                    <div className="mt-1.5 space-y-1.5 border-t border-[var(--border-hairline)] pt-1.5">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-[10px] font-semibold text-[var(--ink-muted)]">
                          البداية (ث)
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={Math.max(1, audioDuration || 7200)}
                          step={0.1}
                          value={start}
                          onChange={(e) => setVerseStart(i, Number(e.target.value))}
                          className="h-7 w-20 rounded-md border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-1.5 text-center text-[11px] font-bold text-[var(--ink-primary)] tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--brand-gold)]/60"
                        />
                        <StudioSlider
                          label="بداية الآية"
                          valueDisplay={formatBoundarySec(start, toArabicDigits)}
                          value={start}
                          min={0}
                          max={Math.max(1, audioDuration || 600)}
                          step={0.1}
                          onChange={(v) => setVerseStart(i, v)}
                          aria-label={`منزلق بداية الآية ${i + 1}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="flex items-start gap-1 text-[10px] leading-relaxed text-[var(--ink-muted)]">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[var(--brand-gold)]" aria-hidden="true" />
            <span>
              شغّل المقطع واسمع بداية كل آية ثم اضغط «هنا» — أو اضبط الرقم
              مباشرة. الحدود تُطبَّق فوراً على المعاينة والتصدير.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
