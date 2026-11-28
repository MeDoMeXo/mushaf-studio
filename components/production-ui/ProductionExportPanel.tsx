'use client';

/**
 * ProductionExportPanel — إعدادات التصدير (البطاقة السفلى اليمنى):
 * وضع الفيديو/الصوت (تبديل الوضع يصحّح الصيغة تلقائياً)، الجودة أو معدل
 * البت حسب الوضع، صيغة الملف، مجلد الحفظ، الحجم التقريبي، وزر التصدير
 * الذهبي مع شريط تقدم وزر إلغاء أثناء التصدير.
 */
import React from 'react';
import {
  AudioLines,
  Clapperboard,
  Folder,
  HardDrive,
  Settings2,
  Upload,
} from 'lucide-react';
import {
  AUDIO_BITRATES,
  type ProductionExportFormat,
  type ProductionExportSettings,
} from '@/lib/production/production-types';

export interface ProductionExportPanelProps {
  exportSettings: ProductionExportSettings;
  onExportSettings: (patch: Partial<ProductionExportSettings>) => void;
  onExport: () => void;
  onCancelExport: () => void;
  exporting: boolean;
  progress: number | null;
  progressLabel?: string;
  estimatedMb: number;
  onPickFolder?: () => void;
}

const noop = () => {};

const QUALITY_OPTIONS: { value: '480' | '720' | '1080'; label: string }[] = [
  { value: '1080', label: '1080p — فائقة' },
  { value: '720', label: '720p — عالية (الافتراضي)' },
  { value: '480', label: '480p — سريعة' },
];

const AUDIO_FORMAT_OPTIONS: ProductionExportFormat[] = ['mp3', 'wav'];
const VIDEO_FORMAT_OPTIONS: ProductionExportFormat[] = ['mp4', 'webm'];

export function ProductionExportPanel(props: ProductionExportPanelProps) {
  const {
    exportSettings,
    onExportSettings,
    onExport,
    onCancelExport,
    exporting,
    progress,
    progressLabel,
    estimatedMb,
    onPickFolder,
  } = props;

  const pickFolder = onPickFolder ?? noop;
  const isAudio = exportSettings.mode === 'audio';

  /** تبديل الوضع يصحّح الصيغة معاً (الصوت→MP3، الفيديو→MP4). */
  const onMode = (mode: 'audio' | 'video') => {
    if (mode === exportSettings.mode) return;
    onExportSettings(mode === 'audio' ? { mode: 'audio', format: 'mp3' } : { mode: 'video', format: 'mp4' });
  };

  const onQualityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === '480' || v === '720' || v === '1080') onExportSettings({ quality: v });
  };

  const onBitrateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const n = Number(e.target.value);
    if (Number.isFinite(n)) onExportSettings({ bitrateKbps: n });
  };

  const formatOptions = isAudio ? AUDIO_FORMAT_OPTIONS : VIDEO_FORMAT_OPTIONS;
  const effectiveFormat = formatOptions.includes(exportSettings.format)
    ? exportSettings.format
    : formatOptions[0];

  const onFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value as ProductionExportFormat;
    if (formatOptions.includes(v)) onExportSettings({ format: v });
  };

  const pct = Math.max(0, Math.min(100, Math.round(progress ?? 0)));

  return (
    <aside
      aria-label="إعدادات التصدير"
      className="flex w-[260px] shrink-0 flex-col gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3 shadow-sm"
    >
      <div className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-[#123c22] px-3 text-sm font-bold text-white">
        <Settings2 className="h-4 w-4 text-[#e6c75a]" aria-hidden />
        <span>إعدادات التصدير</span>
      </div>

      <div className="flex items-center gap-2" role="group" aria-label="وضع التصدير">
        <button
          type="button"
          onClick={() => onMode('video')}
          aria-pressed={!isAudio}
          className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
            !isAudio
              ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white'
              : 'border-[#d4af37]/50 bg-white text-[#123c22] hover:bg-[#fdfbf4]'
          }`}
        >
          <Clapperboard className="h-3.5 w-3.5" aria-hidden />
          <span>الفيديو</span>
        </button>
        <button
          type="button"
          onClick={() => onMode('audio')}
          aria-pressed={isAudio}
          className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
            isAudio
              ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white'
              : 'border-[#d4af37]/50 bg-white text-[#123c22] hover:bg-[#fdfbf4]'
          }`}
        >
          <AudioLines className="h-3.5 w-3.5" aria-hidden />
          <span>الصوت</span>
        </button>
      </div>

      {isAudio ? (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-[var(--ink-primary)]">معدل البت:</span>
          <select
            value={String(exportSettings.bitrateKbps)}
            onChange={onBitrateChange}
            aria-label="معدل البت"
            className="h-8 w-full rounded-lg border border-[#e3dac6] bg-white px-2 text-xs text-[#1f1b16]"
          >
            {AUDIO_BITRATES.map((n) => (
              <option key={n} value={String(n)}>
                {n} كبت/ث
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-[var(--ink-primary)]">جودة التصدير:</span>
          <select
            value={exportSettings.quality}
            onChange={onQualityChange}
            aria-label="جودة التصدير"
            className="h-8 w-full rounded-lg border border-[#e3dac6] bg-white px-2 text-xs text-[#1f1b16]"
          >
            {QUALITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold text-[var(--ink-primary)]">صيغة الملف:</span>
        <select
          value={effectiveFormat}
          onChange={onFormatChange}
          aria-label="صيغة الملف"
          className="h-8 w-full rounded-lg border border-[#e3dac6] bg-white px-2 text-xs text-[#1f1b16]"
        >
          {formatOptions.map((f) => (
            <option key={f} value={f}>
              {f === 'mp3' ? 'MP3' : f === 'wav' ? 'WAV' : f === 'mp4' ? 'MP4' : 'WebM'}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-[var(--ink-primary)]">مجلد الحفظ:</span>
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={exportSettings.saveFolder}
            onChange={(e) => onExportSettings({ saveFolder: e.target.value })}
            aria-label="مجلد الحفظ"
            dir="ltr"
            className="h-8 min-w-0 flex-1 rounded-lg border border-[#e3dac6] bg-white px-2 text-left text-xs text-[#1f1b16]"
          />
          <button
            type="button"
            onClick={pickFolder}
            aria-label="اختيار مجلد الحفظ"
            title="اختيار مجلد الحفظ"
            className="flex h-8 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e3dac6] bg-white text-[#123c22] transition-colors hover:bg-[#f5f2e8]"
          >
            <Folder className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
        <HardDrive className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          الحجم التقريبي: <span className="tabular-nums">{estimatedMb}</span> ميغابايت
        </span>
      </p>

      {exporting ? (
        <div className="flex flex-col gap-2 rounded-xl border border-[#e3dac6] bg-white p-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#123c22]">
            <span className="truncate">{progressLabel ?? 'جارٍ التصدير…'}</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="h-2 w-full overflow-hidden rounded-full bg-[#efeae0]"
          >
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#e8c44a] to-[#c99b2f] transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <button
            type="button"
            onClick={onCancelExport}
            className="h-8 w-full rounded-lg border border-[#e3dac6] bg-white text-xs font-bold text-[#b91c1c] transition-colors hover:bg-[#fdecec]"
          >
            إلغاء
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onExport}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#e8c44a] to-[#c99b2f] text-sm font-bold text-[#123c22] shadow transition-[filter] hover:brightness-105"
        >
          <Upload className="h-4 w-4" aria-hidden />
          <span>تصدير الملف</span>
        </button>
      )}
    </aside>
  );
}
