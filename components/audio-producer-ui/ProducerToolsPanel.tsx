'use client';

/**
 * ProducerToolsPanel — لوحة أدوات التحرير في «منتج الصوت»:
 * قصّ/تقسيم/اقتطاع + كشف السكوت وقصّه + المستوى (مكسب/تطبيع) + تراجع/إعادة.
 */
import React from 'react';
import {
  Crop,
  Gauge,
  History,
  Redo2,
  RotateCcw,
  Scissors,
  Split,
  Trash2,
  Undo2,
  Volume2,
} from 'lucide-react';
import { formatAudioTime, toArabicDigits } from '@/lib/quran-utils';
import type { ProducerEditState, TimeSpan } from '@/lib/audio-producer/audio-producer-edit';

interface ProducerToolsPanelProps {
  hasSource: boolean;
  edit: ProducerEditState | null;
  selection: TimeSpan | null;
  silences: TimeSpan[];
  silenceTotalSec: number;
  thresholdRatio: number;
  minSilenceSec: number;
  canUndo: boolean;
  canRedo: boolean;
  onCutSelection: () => void;
  onSplitAtPlayhead: () => void;
  onTrimBefore: () => void;
  onTrimAfter: () => void;
  onRestore: () => void;
  onThresholdChange: (v: number) => void;
  onMinSilenceChange: (v: number) => void;
  onDetectSilences: () => void;
  onRemoveSilences: () => void;
  onClearSelection: () => void;
  onMasterGainChange: (db: number) => void;
  onNormalizeChange: (on: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
}

function ToolButton({
  icon,
  label,
  hint,
  onClick,
  disabled,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger' | 'gold';
}) {
  const toneCls =
    tone === 'danger'
      ? 'border-red-500/40 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-300'
      : tone === 'gold'
        ? 'border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/10 text-[var(--ink-primary)] hover:bg-[var(--brand-gold)]/20'
        : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)] hover:border-[var(--brand-gold)]/50';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${toneCls}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[var(--brand-gold)]">{icon}</span>
      <h3 className="text-xs font-bold text-[var(--ink-primary)]">{title}</h3>
    </div>
  );
}

export function ProducerToolsPanel({
  hasSource,
  edit,
  selection,
  silences,
  silenceTotalSec,
  thresholdRatio,
  minSilenceSec,
  canUndo,
  canRedo,
  onCutSelection,
  onSplitAtPlayhead,
  onTrimBefore,
  onTrimAfter,
  onRestore,
  onThresholdChange,
  onMinSilenceChange,
  onDetectSilences,
  onRemoveSilences,
  onClearSelection,
  onMasterGainChange,
  onNormalizeChange,
  onUndo,
  onRedo,
}: ProducerToolsPanelProps) {
  const disabled = !hasSource || !edit;
  const selText = selection
    ? `التحديد: ${formatAudioTime(selection.startSec)} → ${formatAudioTime(selection.endSec)} (${toArabicDigits(
        (selection.endSec - selection.startSec).toFixed(1)
      )} ث)`
    : null;

  return (
    <div className="space-y-3" data-testid="producer-tools">
      <SectionTitle icon={<Scissors className="h-3.5 w-3.5" />} title="قصّ وتحرير" />
      <div className="space-y-1.5">
        {selText && (
          <p className="rounded-lg bg-[var(--brand-gold)]/10 px-2 py-1.5 text-[10px] font-bold text-[var(--ink-primary)] tabular-nums">
            {selText}
            <button
              type="button"
              onClick={onClearSelection}
              className="mr-1 text-[var(--brand-gold)] underline"
            >
              مسح
            </button>
          </p>
        )}
        <ToolButton
          icon={<Scissors className="h-3.5 w-3.5" />}
          label="قصّ التحديد"
          hint="حذف النطاق المحدد من المقطع"
          onClick={onCutSelection}
          disabled={disabled || !selection}
          tone="danger"
        />
        <ToolButton
          icon={<Split className="h-3.5 w-3.5" />}
          label="تقسيم عند المؤشر"
          hint="شقّ المقطع عند موضع مؤشر التشغيل — لضبط مكسب كل جزء"
          onClick={onSplitAtPlayhead}
          disabled={disabled}
        />
        <div className="grid grid-cols-2 gap-1.5">
          <ToolButton
            icon={<Crop className="h-3.5 w-3.5" />}
            label="اقتطاع البداية"
            hint="قصّ كل ما قبل المؤشر"
            onClick={onTrimBefore}
            disabled={disabled}
          />
          <ToolButton
            icon={<Crop className="h-3.5 w-3.5 rotate-180" />}
            label="اقتطاع النهاية"
            hint="قصّ كل ما بعد المؤشر"
            onClick={onTrimAfter}
            disabled={disabled}
          />
        </div>
        <ToolButton
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          label="استعادة المقطع كاملاً"
          hint="إلغاء كل القصّ والعودة للمصدر"
          onClick={onRestore}
          disabled={disabled}
          tone="gold"
        />
      </div>

      <SectionTitle icon={<Trash2 className="h-3.5 w-3.5" />} title="قصّ السكوت" />
      <div className="space-y-2">
        <label className="block text-[10px] font-semibold text-[var(--ink-muted)]">
          عتبة السكوت: {toArabicDigits(Math.round(thresholdRatio * 100))}٪ من الذروة
          <input
            type="range"
            min={0.02}
            max={0.3}
            step={0.01}
            value={thresholdRatio}
            disabled={disabled}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            className="mt-1 h-1.5 w-full accent-[var(--brand-gold)]"
          />
        </label>
        <label className="block text-[10px] font-semibold text-[var(--ink-muted)]">
          أقصر سكوت: {toArabicDigits(minSilenceSec.toFixed(1))} ث
          <input
            type="range"
            min={0.2}
            max={2}
            step={0.1}
            value={minSilenceSec}
            disabled={disabled}
            onChange={(e) => onMinSilenceChange(Number(e.target.value))}
            className="mt-1 h-1.5 w-full accent-[var(--brand-gold)]"
          />
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <ToolButton
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label="كشف السكوت"
            hint="تحليل الموجة وإبراز الفترات الهادئة"
            onClick={onDetectSilences}
            disabled={disabled}
          />
          <ToolButton
            icon={<Scissors className="h-3.5 w-3.5" />}
            label="قصّ كل السكوت"
            hint="حذف كل الفترات الهادئة المكتشفة"
            onClick={onRemoveSilences}
            disabled={disabled || silences.length === 0}
            tone="danger"
          />
        </div>
        {silences.length > 0 && (
          <p className="rounded-lg bg-sky-500/10 px-2 py-1.5 text-[10px] font-bold text-sky-700 tabular-nums dark:text-sky-300">
            {toArabicDigits(silences.length)} فترة سكوت · إجمالي{' '}
            {formatAudioTime(silenceTotalSec)} — اضبط ثم «قصّ كل السكوت»
          </p>
        )}
      </div>

      <SectionTitle icon={<Volume2 className="h-3.5 w-3.5" />} title="المستوى" />
      <div className="space-y-2">
        <label className="block text-[10px] font-semibold text-[var(--ink-muted)]">
          المكسب الرئيسي: {toArabicDigits((edit?.masterGainDb ?? 0).toFixed(1))} dB
          <input
            type="range"
            min={-12}
            max={12}
            step={0.5}
            value={edit?.masterGainDb ?? 0}
            disabled={disabled}
            onChange={(e) => onMasterGainChange(Number(e.target.value))}
            className="mt-1 h-1.5 w-full accent-[var(--brand-gold)]"
          />
        </label>
        <button
          type="button"
          onClick={() => onNormalizeChange(!(edit?.normalize ?? false))}
          disabled={disabled}
          aria-pressed={edit?.normalize ?? false}
          className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-bold transition-colors disabled:opacity-40 ${
            edit?.normalize
              ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/20 text-[var(--ink-primary)]'
              : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:border-[var(--brand-gold)]/50'
          }`}
        >
          <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
          <span>تطبيع الذروة (٩٥٪)</span>
        </button>
        <p className="text-[10px] leading-relaxed text-[var(--ink-muted)]">
          التطبيع يرفع/يخفض مستوى المقطع كاملاً بحيث تكون أعلى ذروة ٩٥٪ — مفيد
          لتوحيد مستوى التلاوة قبل التصدير.
        </p>
      </div>

      <SectionTitle icon={<History className="h-3.5 w-3.5" />} title="التراجع" />
      <div className="grid grid-cols-2 gap-1.5">
        <ToolButton
          icon={<Undo2 className="h-3.5 w-3.5" />}
          label="تراجع"
          onClick={onUndo}
          disabled={disabled || !canUndo}
        />
        <ToolButton
          icon={<Redo2 className="h-3.5 w-3.5" />}
          label="إعادة"
          onClick={onRedo}
          disabled={disabled || !canRedo}
        />
      </div>
    </div>
  );
}
