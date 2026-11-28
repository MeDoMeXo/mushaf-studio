'use client';

/**
 * ProductionStatusBar — شريط الحالة السفلي:
 * (يمين) مدة المشروع وحجمه وزمن آخر حفظ بنسبة عربية،
 * (يسار) أزرار: حفظ باسم، فتح مشروع، مشروع جديد (ذهبية).
 */
import React from 'react';
import { BadgeCheck, Clock, FolderOpen, HardDrive, Plus, Save } from 'lucide-react';
import { formatProductionClock } from '@/lib/production/production-types';
import { toArabicDigits } from '@/lib/quran-utils';

export interface ProductionStatusBarProps {
  totalSec: number;
  sizeMb: number;
  savedAt: number | null;
  onNew: () => void;
  onOpen: () => void;
  onSaveAs: () => void;
}

/** وصف نسبي عربي لزمن آخر حفظ: الآن / قبل ن دقيقة / قبل ساعة… */
function savedTimeLabel(savedAt: number | null): string {
  if (savedAt == null) return 'غير محفوظ';
  const ageSec = Math.max(0, (Date.now() - savedAt) / 1000);
  if (ageSec < 60) return 'الآن';
  const minutes = Math.floor(ageSec / 60);
  if (minutes < 60) return `قبل ${toArabicDigits(minutes)} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'قبل ساعة';
  if (hours < 24) return `قبل ${toArabicDigits(hours)} ساعات`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'قبل يوم' : `قبل ${toArabicDigits(days)} أيام`;
}

export function ProductionStatusBar(props: ProductionStatusBarProps) {
  const { totalSec, sizeMb, savedAt, onNew, onOpen, onSaveAs } = props;
  const savedLabel = savedTimeLabel(savedAt);

  return (
    <footer
      className="flex min-h-10 w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-b-2xl border-t border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-1.5 text-xs text-[var(--ink-muted)] sm:h-10 sm:flex-nowrap sm:py-0"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 shrink-0" aria-hidden />
          <span>مدة المشروع:</span>
          <span dir="ltr" className="font-semibold tabular-nums text-[var(--ink-primary)]">
            {formatProductionClock(totalSec)}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <HardDrive className="h-3 w-3 shrink-0" aria-hidden />
          <span>حجم المشروع:</span>
          <span className="font-semibold tabular-nums text-[var(--ink-primary)]">{sizeMb}</span>
          <span>ميغابايت</span>
        </span>
        <span className="flex items-center gap-1">
          <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#1e9e5a]" aria-hidden />
          <span>تم الحفظ:</span>
          <span className="font-semibold text-[var(--ink-primary)]">{savedLabel}</span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onSaveAs}
          className="flex h-7 items-center gap-1 rounded-full border border-[#e3dac6] bg-white px-3 text-[11px] font-bold text-[#0b3d2e] transition-colors hover:bg-[#f5f2e8]"
        >
          <Save className="h-3 w-3" aria-hidden />
          <span>حفظ باسم</span>
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="flex h-7 items-center gap-1 rounded-full border border-[#e3dac6] bg-white px-3 text-[11px] font-bold text-[#0b3d2e] transition-colors hover:bg-[#f5f2e8]"
        >
          <FolderOpen className="h-3 w-3" aria-hidden />
          <span>فتح مشروع</span>
        </button>
        <button
          type="button"
          onClick={onNew}
          className="flex h-8 items-center gap-1 rounded-full bg-gradient-to-l from-[#e8c44a] to-[#c99b2f] px-4 text-[11px] font-bold text-[#123c22] shadow transition-[filter] hover:brightness-105"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          <span>مشروع جديد</span>
        </button>
      </div>
    </footer>
  );
}
