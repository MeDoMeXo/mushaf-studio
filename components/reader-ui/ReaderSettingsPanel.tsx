'use client';

/**
 * ReaderSettingsPanel — collapsible reading preferences (translation,
 * font size, auto-follow, active reciter summary).
 * Extracted from components/ReaderView.tsx per the 600-line file rule.
 */
import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Headphones, Languages } from 'lucide-react';
import { RECITERS, TRANSLATIONS, type ReciterOption } from '@/lib/quran-data';
import { toArabicDigits } from '@/lib/quran-utils';
import { StudioSlider, StudioSwitch } from '../studio-ui/StudioControls';

export interface ReaderSettingsPanelProps {
  open: boolean;
  translationId: number;
  showTrans: boolean;
  fontSizeRem: number;
  autoFollowVerse: boolean;
  activeReciter: ReciterOption;
  onTranslationChange: (id: number) => void;
  onShowTransToggle: (checked: boolean) => void;
  onFontSizeChange: (val: number) => void;
  onAutoFollowToggle: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenReciterPicker: () => void;
}

export function ReaderSettingsPanel({
  open,
  translationId,
  showTrans,
  fontSizeRem,
  autoFollowVerse,
  activeReciter,
  onTranslationChange,
  onShowTransToggle,
  onFontSizeChange,
  onAutoFollowToggle,
  onOpenReciterPicker,
}: ReaderSettingsPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.section
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
          aria-label="إعدادات القراءة"
          className="mt-3.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="reader-translation"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--ink-muted)]"
                >
                  <Languages className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
                  <span>الترجمة المعتمدة (من QUL)</span>
                </label>
                <select
                  id="reader-translation"
                  value={translationId}
                  onChange={(e) => onTranslationChange(Number(e.target.value))}
                  className="h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors focus:border-[var(--brand-gold)] focus:outline-none"
                >
                  {TRANSLATIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <StudioSwitch
                id="reader-show-trans"
                label="إظهار الترجمة أسفل كل آية"
                checked={showTrans}
                onCheckedChange={onShowTransToggle}
              />
            </div>

            <div className="flex flex-col justify-between gap-4">
              <StudioSlider
                id="reader-font-size"
                label="حجم الخط القرآني"
                valueDisplay={`${fontSizeRem.toFixed(2)} rem`}
                min={1.25}
                max={2.8}
                step={0.05}
                value={fontSizeRem}
                onChange={onFontSizeChange}
              />

              <StudioSwitch
                id="reader-auto-follow"
                label="تتبع الآية تلقائياً أثناء التلاوة"
                checked={autoFollowVerse}
                onCheckedChange={onAutoFollowToggle}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-4 md:col-span-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--ink-muted)]">
                  القارئ المرتبط بتلاوة السورة ({toArabicDigits(RECITERS.length)} مصحفاً مرتلاً عالمياً)
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--ink-primary)]">
                  {activeReciter.name}{' '}
                  <span className="text-xs font-normal text-[var(--ink-muted)] tabular-nums">
                    · {activeReciter.styleLabel}
                    {activeReciter.country ? ` · ${activeReciter.country}` : ''} ·{' '}
                    {activeReciter.bitrate}kbps
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenReciterPicker}
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--brand-gold)]/60 bg-[var(--surface-subtle)] px-3.5 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-gold)]/15"
              >
                <Headphones className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
                <span>تغيير القارئ</span>
              </button>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
