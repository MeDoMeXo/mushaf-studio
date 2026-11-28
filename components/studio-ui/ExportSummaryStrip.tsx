'use client';

/**
 * ExportSummaryStrip — شريط ملخص التصدير (الشرائح/الأبعاد/الصوت/الحجم).
 * مستخرج من StudioExportModal التزاماً بقاعدة ٦٠٠ سطر (نقية العرض فقط).
 */
import React from 'react';
import { toArabicDigits } from '@/lib/quran-utils';

interface ExportSummaryStripProps {
  verseCount: number;
  karaokeSlideCount: number;
  /** مستوى التتبّع في التصدير: 'word' كلمة-بكلمة أو 'segment' عبارة-بعبارة (خُفّض لطول المدة). */
  karaokeGranularity?: 'word' | 'segment' | null;
  includeIntroCover: boolean;
  targetDims: { width: number; height: number };
  customAudioFile: File | null;
  customAudioName: string;
  reciterName: string;
  estimatedSizeMb: number;
}

export function ExportSummaryStrip({
  verseCount,
  karaokeSlideCount,
  karaokeGranularity,
  includeIntroCover,
  targetDims,
  customAudioFile,
  customAudioName,
  reciterName,
  estimatedSizeMb,
}: ExportSummaryStripProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/75 p-3 sm:grid-cols-4">
      <div>
        <p className="text-[11px] text-[var(--ink-muted)]">عدد الشرائح</p>
        <p className="text-sm font-bold text-[var(--ink-primary)] tabular-nums">
          {karaokeSlideCount > 0
            ? `${toArabicDigits(karaokeSlideCount)} شريحة تتبّع`
            : `${toArabicDigits(verseCount)} آيات`}
          {karaokeSlideCount === 0 && includeIntroCover ? ' + غلاف' : ''}
        </p>
        {karaokeSlideCount > 0 && (
          <p className="mt-0.5 text-[10px] text-[var(--brand-emerald)] dark:text-[#E6C75A]">
            {karaokeGranularity === 'segment'
              ? 'تتبّع عبارة-بعبارة متزامن مع التلاوة (خُفّض من مستوى الكلمة لطول المدة)'
              : 'تتبّع كلمة-بكلمة متزامن مع التلاوة'}
          </p>
        )}
      </div>
      <div>
        <p className="text-[11px] text-[var(--ink-muted)]">الأبعاد النهائية</p>
        <p className="text-sm font-bold text-[var(--ink-primary)] tabular-nums">
          {targetDims.width}×{targetDims.height}
        </p>
      </div>
      <div>
        <p className="text-[11px] text-[var(--ink-muted)]">الصوت المستخدم</p>
        <p className="truncate text-sm font-bold text-[var(--brand-emerald)] dark:text-[#E6C75A]">
          {customAudioFile ? customAudioName : reciterName.split(' ').slice(0, 2).join(' ')}
        </p>
      </div>
      <div>
        <p className="text-[11px] text-[var(--ink-muted)]">الحجم التقريبي</p>
        <p dir="ltr" className="text-right text-sm font-bold text-[var(--ink-primary)] tabular-nums">
          ~{estimatedSizeMb} MB
        </p>
      </div>
    </div>
  );
}
