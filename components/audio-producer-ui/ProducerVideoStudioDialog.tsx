'use client';

/**
 * ProducerVideoStudioDialog — حوار «إنتاج الفيديو الكامل» من «منتج الصوت»:
 *  1) صدى الصوت: تفعيل + إعدادات مسبقة (خفيف/قاعة/مسجد/كهف) + منزلقات
 *     دقيقة (التأخير/التغذية الراجعة/النسبة الرطبة) — تُطبَّق فوراً على
 *     رندر المحرر المشترك فيُسمَع الصدى في المعاينة ويُصدَّر مع المقطع.
 *  2) الخلفية: شبكة مكتبة خلفيات الاستوديو المدمجة (تدرّج الملصق) أو
 *     «بلا خلفية» — يُرسل معرّفها في التسليم فيطبّقه الاستوديو فوراً.
 *  3) الزر الكبير: يرندر المقطع بالصدى ويسلّمه إلى الاستوديو للإنتاج
 *     الكامل (نص الآية + الكاريوكي + الخلفية المختارة + التصدير MP4).
 */
import React, { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  AudioWaveform,
  Clapperboard,
  Loader2,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { BUILTIN_BG_LIBRARY } from '@/lib/background-library';
import {
  ECHO_PRESETS,
  describeEcho,
  type ProducerEchoSettings,
} from '@/lib/audio-producer/producer-echo';
import { toArabicDigits } from '@/lib/quran-utils';

interface ProducerVideoStudioDialogProps {
  open: boolean;
  onClose: () => void;
  echo: ProducerEchoSettings;
  /** يُطبَّق فوراً (رندر مشترك) — يُسمَع في المعاينة ويُصدَّر مع المقطع. */
  onEchoChange: (patch: Partial<ProducerEchoSettings>) => void;
  /** الإنتاج: رندر بالصدى + تسليم للاستوديو مع الخلفية المختارة. */
  onProduce: (bgLibraryId: string | null) => void;
  producing: boolean;
  disabled: boolean;
  verseCount: number;
  editedTotalSec: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  islamic: 'إسلامي',
  nature: 'طبيعي',
};

export function ProducerVideoStudioDialog({
  open,
  onClose,
  echo,
  onEchoChange,
  onProduce,
  producing,
  disabled,
  verseCount,
  editedTotalSec,
}: ProducerVideoStudioDialogProps) {
  const [bgId, setBgId] = useState<string | null>(null);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !producing) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/75" />
        <DialogPrimitive.Content
          dir="rtl"
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => {
            if (producing) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (producing) e.preventDefault();
          }}
          className="studio-scroll fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[94vw] max-w-[680px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] shadow-2xl focus:outline-none"
        >
          {/* الرأس */}
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-gold)]/18 text-[var(--brand-gold)]">
                <Clapperboard className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[var(--ink-primary)]">
                  إنتاج الفيديو الكامل
                </h2>
                <p className="text-[10px] text-[var(--ink-muted)]">
                  صدى الصوت + الخلفية — ثم يُفتح الاستوديو للرندر النهائي
                </p>
              </div>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="إغلاق"
                className="grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--border-hairline)]/40 hover:text-[var(--ink-primary)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* الجسم */}
          <div className="flex flex-col gap-4 p-5">
            {/* ── صدى الصوت ────────────────────────────────────────── */}
            <section aria-label="صدى الصوت">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink-primary)]">
                  <Volume2 className="h-4 w-4 text-[var(--brand-emerald)]" aria-hidden="true" />
                  صدى الصوت
                </h3>
                <button
                  type="button"
                  onClick={() => onEchoChange({ enabled: !echo.enabled })}
                  aria-pressed={echo.enabled}
                  className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[10px] font-bold transition-colors ${
                    echo.enabled
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--ink-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:border-[var(--brand-gold)]'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${echo.enabled ? 'bg-[var(--brand-gold)]' : 'bg-[var(--ink-muted)]'}`}
                    aria-hidden="true"
                  />
                  {echo.enabled ? 'مُفعَّل' : 'معطّل'}
                </button>
              </div>

              {/* إعدادات مسبقة */}
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                {ECHO_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      onEchoChange({ enabled: true, delaySec: p.delaySec, feedback: p.feedback, wet: p.wet })
                    }
                    className={`inline-flex h-7 items-center rounded-lg border px-2.5 text-[10px] font-bold transition-colors ${
                      echo.enabled &&
                      Math.abs(echo.delaySec - p.delaySec) < 1e-6 &&
                      Math.abs(echo.feedback - p.feedback) < 1e-6 &&
                      Math.abs(echo.wet - p.wet) < 1e-6
                        ? 'border-[var(--brand-emerald)] bg-[var(--brand-emerald)]/15 text-[var(--ink-primary)]'
                        : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:border-[var(--brand-emerald)] hover:text-[var(--ink-primary)]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <span className="ms-1 font-mono text-[9px] text-[var(--ink-muted)]" dir="ltr">
                  {describeEcho(echo)}
                </span>
              </div>

              {/* منزلقات دقيقة */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="flex flex-col gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/60 p-2">
                  <span className="flex items-center justify-between text-[10px] font-bold text-[var(--ink-muted)]">
                    التأخير
                    <span className="font-mono tabular-nums text-[var(--ink-primary)]" dir="ltr">
                      {toArabicDigits(Math.round(echo.delaySec * 1000))}ms
                    </span>
                  </span>
                  <input
                    type="range"
                    min={50}
                    max={900}
                    step={10}
                    value={Math.round(echo.delaySec * 1000)}
                    onChange={(e) => onEchoChange({ enabled: true, delaySec: Number(e.target.value) / 1000 })}
                    aria-label="زمن تأخير الصدى بالمللي ثانية"
                    className="h-1.5 accent-[var(--brand-gold)]"
                  />
                </label>
                <label className="flex flex-col gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/60 p-2">
                  <span className="flex items-center justify-between text-[10px] font-bold text-[var(--ink-muted)]">
                    التغذية الراجعة
                    <span className="font-mono tabular-nums text-[var(--ink-primary)]" dir="ltr">
                      {toArabicDigits(Math.round(echo.feedback * 100))}٪
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={85}
                    step={5}
                    value={Math.round(echo.feedback * 100)}
                    onChange={(e) => onEchoChange({ enabled: true, feedback: Number(e.target.value) / 100 })}
                    aria-label="قوة التغذية الراجعة للصدى"
                    className="h-1.5 accent-[var(--brand-gold)]"
                  />
                </label>
                <label className="flex flex-col gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/60 p-2">
                  <span className="flex items-center justify-between text-[10px] font-bold text-[var(--ink-muted)]">
                    نسبة الصدى
                    <span className="font-mono tabular-nums text-[var(--ink-primary)]" dir="ltr">
                      {toArabicDigits(Math.round(echo.wet * 100))}٪
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={5}
                    value={Math.round(echo.wet * 100)}
                    onChange={(e) => onEchoChange({ enabled: true, wet: Number(e.target.value) / 100 })}
                    aria-label="نسبة مزج الصدى الرطبة"
                    className="h-1.5 accent-[var(--brand-gold)]"
                  />
                </label>
              </div>
              <p className="mt-1.5 text-[9px] leading-relaxed text-[var(--ink-muted)]">
                يُطبَّق الصدى فوراً على رندر المحرر — أغلق الحوار وشغّل التلاوة
                لتسمعه، ويُضمَّن تلقائياً في التصدير والتسليم.
              </p>
            </section>

            {/* ── الخلفية ──────────────────────────────────────────── */}
            <section aria-label="خلفية الفيديو">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[var(--ink-primary)]">
                <Sparkles className="h-4 w-4 text-[var(--brand-gold)]" aria-hidden="true" />
                خلفية الفيديو
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setBgId(null)}
                  aria-pressed={bgId === null}
                  title="بدون خلفية متحركة — يبقى نمط الخلفية الحالي في الاستوديو"
                  className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-lg border text-center transition-colors ${
                    bgId === null
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:border-[var(--brand-gold)]/60'
                  }`}
                >
                  <AudioWaveform className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
                  <span className="text-[10px] font-bold text-[var(--ink-muted)]">بلا خلفية</span>
                  <span className="text-[8px] text-[var(--ink-muted)]">كما هي في الاستوديو</span>
                </button>
                {BUILTIN_BG_LIBRARY.map((bg) => {
                  const selected = bgId === bg.id;
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setBgId(bg.id)}
                      aria-pressed={selected}
                      title={`${bg.name} — ${CATEGORY_LABEL[bg.category] ?? bg.category}`}
                      className={`relative flex h-16 flex-col items-center justify-end overflow-hidden rounded-lg border text-center transition-all ${
                        selected
                          ? 'border-[var(--brand-gold)] shadow-[0_0_10px_rgba(212,175,55,0.45)]'
                          : 'border-[var(--border-hairline)] hover:border-[var(--brand-gold)]/60'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${bg.posterColors[0]}, ${bg.posterColors[1]})`,
                      }}
                    >
                      {selected && (
                        <span className="absolute top-1 right-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--brand-gold)] text-[8px] font-black text-[#1F1705]" aria-hidden="true">
                          ✓
                        </span>
                      )}
                      <span className="w-full truncate bg-black/35 px-1.5 py-1 text-[10px] font-bold text-white">
                        {bg.name}
                      </span>
                      <span className="absolute bottom-1 left-1 rounded bg-black/40 px-1 text-[8px] font-bold text-white/80">
                        {CATEGORY_LABEL[bg.category] ?? bg.category}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[9px] leading-relaxed text-[var(--ink-muted)]">
                تُطبَّق الخلفية فور فتح الاستوديو على المقطع المُنتَج، وهناك
                يمكن رفع خلفية مخصّصة أو تعديل النص والكاريوكي والتصدير MP4.
              </p>
            </section>
          </div>

          {/* التذييل */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] px-5 py-4">
            <p className="text-[10px] font-bold leading-relaxed text-[var(--ink-muted)]">
              سيُرنْدَر المقطع المحرَّر
              {echo.enabled ? ' بالصدى' : ''}
              {' '}({toArabicDigits(verseCount)} آية)
              {' '}ثم يُفتح الاستوديو مع الخلفية المختارة لإنتاج الفيديو الكامل.
            </p>
            <button
              type="button"
              onClick={() => onProduce(bgId)}
              disabled={disabled || producing || editedTotalSec <= 0}
              className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-[var(--brand-emerald)] px-5 text-sm font-bold text-[#FAF7F0] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-[var(--brand-gold)] dark:text-[#1F1705]"
            >
              {producing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Clapperboard className="h-4 w-4" aria-hidden="true" />
              )}
              {producing ? 'جارٍ الرندر والتسليم…' : 'إنتاج الفيديو في الاستوديو'}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
