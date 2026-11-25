'use client';

/**
 * AdminBackupSection — full JSON export/import + reset actions.
 * Extracted from AdminView (roadmap item 3): receives draft/stats plus the
 * same refresh callbacks the parent already owned.
 */
import React, { useRef } from 'react';
import { Copy, Download, RotateCcw, Upload } from 'lucide-react';
import {
  EMPTY_STATS,
  type SiteConfig,
  type SiteStats,
} from '@/lib/quran-data';
import { mergeSiteConfig } from '@/lib/quran-utils';
import {
  loadStats,
  resetSiteConfig,
  resetStats,
  saveSiteConfig,
  saveStats,
} from '@/lib/storage';

export interface AdminBackupSectionProps {
  draft: SiteConfig;
  stats: SiteStats;
  onDraftChange: (cfg: SiteConfig) => void;
  onStatsChange: (stats: SiteStats) => void;
  refreshConfig: () => void;
  showToast: (msg: string) => void;
}

export function AdminBackupSection({
  draft,
  stats,
  onDraftChange,
  onStatsChange,
  refreshConfig,
  showToast,
}: AdminBackupSectionProps) {
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const handleExportJson = () => {
    const payload = JSON.stringify({ config: draft, stats }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quran-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('تم تنزيل النسخة الاحتياطية');
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ config: draft, stats }, null, 2)
      );
      showToast('تم نسخ JSON إلى الحافظة');
    } catch {
      showToast('تعذّر النسخ إلى الحافظة');
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed.config) {
          const merged = mergeSiteConfig(parsed.config);
          saveSiteConfig(merged);
          onDraftChange(merged);
          refreshConfig();
        }
        if (parsed.stats) {
          saveStats({ ...EMPTY_STATS, ...parsed.stats });
          onStatsChange(loadStats());
        }
        showToast('تم استيراد النسخة الاحتياطية بنجاح');
      } catch {
        showToast('ملف النسخة غير صالح');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
        <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
          نسخة احتياطية كاملة (JSON)
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          تصدير أو استيراد الإعدادات والإحصائيات المحلية بالكامل.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-emerald)] px-4 py-2.5 text-xs font-bold text-[#FAF7F0] hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>تنزيل JSON</span>
          </button>
          <button
            type="button"
            onClick={handleCopyJson}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-2.5 text-xs font-semibold text-[var(--ink-primary)] hover:border-[var(--brand-gold)]"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            <span>نسخ إلى الحافظة</span>
          </button>
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-2.5 text-xs font-semibold text-[var(--ink-primary)] hover:border-[var(--brand-gold)]"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>استيراد نسخة</span>
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportJson}
            className="hidden"
          />
        </div>

        <pre
          dir="ltr"
          className="studio-scroll mt-4 max-h-60 overflow-auto rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3 text-left font-mono text-xs text-[var(--ink-muted)]"
        >
          {JSON.stringify({ config: draft, stats }, null, 2)}
        </pre>
      </div>

      <div className="rounded-xl border border-red-500/30 bg-[var(--surface-card)] p-5">
        <h2 className="font-display text-lg font-bold text-red-600 dark:text-red-400">
          إعادة التعيين
        </h2>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => {
              const fresh = resetSiteConfig();
              onDraftChange(fresh);
              refreshConfig();
              showToast('تمت استعادة الإعدادات الافتراضية');
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-500/20 dark:text-red-300"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>إعادة ضبط الإعدادات فقط</span>
          </button>
          <button
            type="button"
            onClick={() => {
              resetStats();
              onStatsChange(loadStats());
              showToast('تم مسح الإحصائيات المحلية');
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-500/20 dark:text-red-300"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>مسح الإحصائيات فقط</span>
          </button>
        </div>
      </div>
    </div>
  );
}
