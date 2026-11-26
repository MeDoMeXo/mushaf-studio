'use client';

/**
 * ExportMinimizedChip — شريحة التصدير العائمة عند تصغير نافذة التصدير:
 * عرض حالة التقدّم أو اسم الملف المكتمل + زر إعادة الفتح.
 * مستخرجة من StudioExportModal التزاماً بقاعدة ٦٠٠ سطر (نقية العرض فقط).
 */
import React from 'react';
import { CheckCircle2, Loader2, Maximize2 } from 'lucide-react';
import { EXPORT_DHIKR_LIST } from '@/lib/video-export';

interface ExportMinimizedChipProps {
  isBusy: boolean;
  progressPct: number;
  dhikrIdx: number;
  exportedFilename?: string | null;
  onRestore: () => void;
}

export function ExportMinimizedChip({
  isBusy,
  progressPct,
  dhikrIdx,
  exportedFilename,
  onRestore,
}: ExportMinimizedChipProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-5 z-50 flex items-center gap-3 rounded-2xl border border-[var(--brand-gold)]/60 bg-[var(--surface-card)] px-4 py-3 shadow-2xl"
    >
      {isBusy ? (
        <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-gold)]" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="h-5 w-5 text-[var(--brand-emerald)] dark:text-[#E6C75A]" aria-hidden="true" />
      )}
      <div className="min-w-[150px]">
        <p className="text-xs font-bold text-[var(--ink-primary)]">
          {isBusy ? `جاري التصدير (${progressPct}%)` : 'اكتمل تصدير الفيديو'}
        </p>
        <p className="truncate text-[11px] text-[var(--ink-muted)]">
          {isBusy ? EXPORT_DHIKR_LIST[dhikrIdx] : exportedFilename}
        </p>
      </div>
      <button
        type="button"
        onClick={onRestore}
        aria-label="إظهار نافذة التصدير"
        className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-gold)] px-2.5 py-1.5 text-xs font-bold text-[#1F1705]"
      >
        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span>عرض</span>
      </button>
    </div>
  );
}
