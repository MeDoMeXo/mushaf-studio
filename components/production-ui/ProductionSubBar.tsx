'use client';

/**
 * ProductionSubBar — الشريط الفرعي (سطر ثانٍ) تحت الرأس:
 * بطاقة كريمية بثلاث بطاقات داخلية — (يمين) المشروع الحالي بمصغّر وقلم
 * تعديل الاسم، (وسط) مفاتيح وضع التصدير + محددات الصيغة ومعدل العينات
 * والبت، (يسار) بطاقة النقل: الزمن والاستدراك والآية السابقة/التالية
 * والتشغيل/الإيقاف ومنزلق مستوى الصوت.
 */
import React from 'react';
import {
  AudioLines,
  BookOpenText,
  Clapperboard,
  Pencil,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Pause,
  Volume2,
} from 'lucide-react';
import {
  AUDIO_BITRATES,
  formatProductionClock,
  type ProductionExportFormat,
  type ProductionExportSettings,
} from '@/lib/production/production-types';

export interface ProductionSubBarProps {
  projectName: string;
  exportSettings: ProductionExportSettings;
  onExportSettings: (patch: Partial<ProductionExportSettings>) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onPrevVerse?: () => void;
  onNextVerse?: () => void;
  playheadSec: number;
  totalSec: number;
  volume: number;
  onVolume: (v: number) => void;
  onRename?: () => void;
}

const noop = () => {};

export function ProductionSubBar(props: ProductionSubBarProps) {
  const {
    projectName,
    exportSettings,
    onExportSettings,
    isPlaying,
    onTogglePlay,
    onStop,
    onPrevVerse,
    onNextVerse,
    playheadSec,
    totalSec,
    volume,
    onVolume,
    onRename,
  } = props;

  const prevVerse = onPrevVerse ?? noop;
  const nextVerse = onNextVerse ?? noop;
  const rename = onRename ?? noop;

  const onFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === 'mp3' || v === 'wav' || v === 'mp4' || v === 'webm') {
      onExportSettings({ format: v as ProductionExportFormat });
    }
  };

  const onSampleRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === '44.1') onExportSettings({ sampleRateKhz: 44.1 });
    else if (e.target.value === '48') onExportSettings({ sampleRateKhz: 48 });
  };

  const onBitrateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const n = Number(e.target.value);
    if (Number.isFinite(n)) onExportSettings({ bitrateKbps: n });
  };

  return (
    <div className="flex w-full flex-wrap items-stretch gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-2 shadow-sm md:h-[72px] md:flex-nowrap md:p-3">
      {/* بطاقة المشروع (يمين) */}
      <div className="flex w-[250px] max-w-full items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-white p-2">
        <div
          className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#123c22] to-[#0b3d2e]"
          aria-hidden
        >
          <BookOpenText className="h-4 w-4 text-[#d4af37]" />
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-[11px] text-[var(--ink-muted)]">المشروع الحالي</span>
          <span className="truncate text-sm font-bold text-[var(--ink-primary)]" title={projectName}>
            {projectName}
          </span>
        </div>
        <button
          type="button"
          onClick={rename}
          aria-label="تعديل اسم المشروع"
          title="تعديل اسم المشروع"
          className="ms-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--ink-muted)] transition-colors hover:bg-[#f5f2e8] hover:text-[#123c22]"
        >
          <Pencil className="h-3 w-3" aria-hidden />
        </button>
      </div>

      {/* بطاقة الوضع والإعدادات (وسط) */}
      <div className="flex flex-col justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-white px-3 py-2">
        <div className="flex items-center gap-2" role="group" aria-label="وضع التصدير">
          <button
            type="button"
            onClick={() => onExportSettings({ mode: 'video' })}
            aria-pressed={exportSettings.mode === 'video'}
            className={`flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
              exportSettings.mode === 'video'
                ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white'
                : 'border-[#d4af37]/50 bg-white text-[#123c22] hover:bg-[#fdfbf4]'
            }`}
          >
            <Clapperboard className="h-3.5 w-3.5" aria-hidden />
            <span>الفيديو</span>
          </button>
          <button
            type="button"
            onClick={() => onExportSettings({ mode: 'audio' })}
            aria-pressed={exportSettings.mode === 'audio'}
            className={`flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
              exportSettings.mode === 'audio'
                ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white'
                : 'border-[#d4af37]/50 bg-white text-[#123c22] hover:bg-[#fdfbf4]'
            }`}
          >
            <AudioLines className="h-3.5 w-3.5" aria-hidden />
            <span>الصوت</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={exportSettings.format}
            onChange={onFormatChange}
            aria-label="صيغة الملف"
            title="صيغة الملف"
            className="h-6 rounded-md border border-[#e3dac6] bg-white px-1.5 text-[11px] text-[#1f1b16]"
          >
            <option value="mp3">MP3</option>
            <option value="wav">WAV</option>
            <option value="mp4">MP4</option>
            <option value="webm">WebM</option>
          </select>
          <select
            value={String(exportSettings.sampleRateKhz)}
            onChange={onSampleRateChange}
            aria-label="معدل العينات"
            title="معدل العينات"
            className="h-6 rounded-md border border-[#e3dac6] bg-white px-1.5 text-[11px] text-[#1f1b16]"
          >
            <option value="44.1">44.1 kHz</option>
            <option value="48">48 kHz</option>
          </select>
          <select
            value={String(exportSettings.bitrateKbps)}
            onChange={onBitrateChange}
            aria-label="معدل البت"
            title="معدل البت"
            className="h-6 rounded-md border border-[#e3dac6] bg-white px-1.5 text-[11px] text-[#1f1b16]"
          >
            {AUDIO_BITRATES.map((n) => (
              <option key={n} value={String(n)}>
                {n} kbps
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* بطاقة النقل (يسار) */}
      <div className="flex min-w-[280px] flex-1 items-center gap-3 rounded-xl border border-[var(--border-hairline)] bg-white px-3 py-2">
        <div
          dir="ltr"
          className="shrink-0 text-sm font-bold tabular-nums text-[#1f1b16]"
          aria-live="off"
          title="موضع التشغيل / المدة الكلية"
        >
          {formatProductionClock(playheadSec)} / {formatProductionClock(totalSec)}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={prevVerse}
            aria-label="الآية السابقة"
            title="الآية السابقة"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#123c22] transition-colors hover:bg-[#f5f2e8]"
          >
            <SkipBack className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'إيقاف التشغيل مؤقتاً' : 'تشغيل'}
            title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0b3d2e] text-white shadow-md transition-colors hover:bg-[#0d4a36]"
          >
            {isPlaying ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={nextVerse}
            aria-label="الآية التالية"
            title="الآية التالية"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#123c22] transition-colors hover:bg-[#f5f2e8]"
          >
            <SkipForward className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onStop}
            aria-label="إيقاف"
            title="إيقاف"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-muted)] transition-colors hover:bg-[#f5f2e8]"
          >
            <Square className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <Volume2 className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" aria-hidden />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            aria-label="مستوى الصوت"
            className="w-24 accent-[#b88a1e]"
          />
          <span className="w-9 shrink-0 text-end text-[11px] tabular-nums text-[var(--ink-muted)]">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
