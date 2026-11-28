'use client';

/**
 * ProductionLeftToolbar — القائمة اليسرى «أدوات التحرير»:
 * رأس أخضر داكن ذهبي، ثم تسع أدوات تحرير (تُعطَّل في وضع المعاينة)،
 * ثم قسم «أنماط العرض» بثلاثة أنماط: متقدم / سريع / معاينة فقط.
 */
import React from 'react';
import {
  Eye,
  FileUp,
  ImagePlus,
  Layers,
  LayoutGrid,
  Mic,
  Merge,
  Music,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Type,
  Zap,
} from 'lucide-react';
import type { ProductionEditMode } from '@/lib/production/production-types';

type IconType = typeof Sparkles;

type ToolActionId =
  | 'tool:cut'
  | 'tool:merge'
  | 'tool:effects'
  | 'tool:enhance'
  | 'tool:music'
  | 'tool:text'
  | 'tool:image'
  | 'tool:record'
  | 'tool:upload';

export interface ProductionLeftToolbarProps {
  mode: ProductionEditMode;
  onMode: (m: ProductionEditMode) => void;
  onTool: (id: ToolActionId) => void;
  canEdit: boolean;
}

const TOOLS: { id: ToolActionId; label: string; icon: IconType }[] = [
  { id: 'tool:cut', label: 'قص وتقسيم', icon: Scissors },
  { id: 'tool:merge', label: 'دمج المقاطع', icon: Merge },
  { id: 'tool:effects', label: 'إضافة مؤثرات', icon: Sparkles },
  { id: 'tool:enhance', label: 'تحسين الصوت', icon: SlidersHorizontal },
  { id: 'tool:music', label: 'إضافة موسيقى', icon: Music },
  { id: 'tool:text', label: 'إضافة نص', icon: Type },
  { id: 'tool:image', label: 'إضافة صورة', icon: ImagePlus },
  { id: 'tool:record', label: 'تسجيل صوت', icon: Mic },
  { id: 'tool:upload', label: 'تحميل ملف', icon: FileUp },
];

const MODES: { id: ProductionEditMode; label: string; icon: IconType }[] = [
  { id: 'advanced', label: 'تحرير متقدم', icon: Layers },
  { id: 'quick', label: 'تحرير سريع', icon: Zap },
  { id: 'preview', label: 'معاينة فقط', icon: Eye },
];

export function ProductionLeftToolbar(props: ProductionLeftToolbarProps) {
  const { mode, onMode, onTool, canEdit } = props;

  return (
    <aside
      aria-label="أدوات التحرير"
      className="flex w-[210px] shrink-0 flex-col gap-2 overflow-y-auto rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-2 studio-scroll"
    >
      <div className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-[#123c22] px-3 text-sm font-bold text-white">
        <Sparkles className="h-4 w-4 text-[#e6c75a]" aria-hidden />
        <span>أدوات التحرير</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            disabled={!canEdit}
            onClick={() => onTool(tool.id)}
            className="flex h-9 w-full items-center gap-2 rounded-lg border border-[#d4af37]/50 bg-white px-3 text-sm font-semibold text-[#123c22] shadow-sm transition-colors hover:bg-[#fdfbf4] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <tool.icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{tool.label}</span>
          </button>
        ))}
      </div>

      {!canEdit && (
        <p className="rounded-lg bg-[#fdf8ea] px-2 py-1.5 text-[11px] leading-5 text-[#8a6a14]">
          الوضع الحالي للمعاينة فقط
        </p>
      )}

      <div className="mt-1 flex h-7 shrink-0 items-center gap-1 rounded-full bg-[#123c22] px-3 text-xs font-bold text-white">
        <LayoutGrid className="h-3 w-3 text-[#e6c75a]" aria-hidden />
        <span>أنماط العرض</span>
      </div>

      <div className="flex flex-col gap-1.5 pb-1" role="radiogroup" aria-label="أنماط العرض">
        {MODES.map((m) => {
          const selected = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onMode(m.id)}
              className={`flex h-9 w-full items-center gap-2 rounded-lg border px-3 text-sm font-semibold shadow-sm transition-colors ${
                selected
                  ? 'border-[#b88a1e] bg-[#fdf8ea] text-[var(--brand-gold)]'
                  : 'border-[#d4af37]/50 bg-white text-[#123c22] hover:bg-[#fdfbf4]'
              }`}
            >
              <m.icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{m.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
