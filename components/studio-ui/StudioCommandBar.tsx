'use client';

import React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Command,
  Download,
  Redo2,
  RotateCcw,
  Search,
  Undo2,
  Video,
} from 'lucide-react';
import { toArabicDigits } from '@/lib/quran-utils';
import { StudioTooltip } from './StudioControls';

interface StudioCommandBarProps {
  surahId: number;
  surahName: string;
  fromAyah: number;
  toAyah: number;
  selectedCount: number;
  reciterName: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onOpenCommandPalette: () => void;
  onExportPng: () => void;
  onExportVideo: () => void;
}

export function StudioCommandBar({
  surahId,
  surahName,
  fromAyah,
  toAyah,
  selectedCount,
  reciterName,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
  onOpenCommandPalette,
  onExportPng,
  onExportVideo,
}: StudioCommandBarProps) {
  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
      {/* Right (RTL start): Editorial Breadcrumb & Current Project Context */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-base font-bold leading-tight text-[var(--brand-emerald)] dark:text-[#E6C75A] sm:text-xl">
            استوديو التلاوات
          </h1>
          <span className="text-[var(--border-hairline)]" aria-hidden="true">
            /
          </span>
          <span className="truncate text-xs font-bold text-[var(--ink-primary)] sm:text-sm">
            سورة {surahName}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ink-muted)] tabular-nums sm:text-xs">
          <span>
            الآيات {toArabicDigits(fromAyah)}–{toArabicDigits(toAyah)} (
            {toArabicDigits(selectedCount)})
          </span>
          <span aria-hidden="true">·</span>
          <span className="max-w-[160px] truncate sm:max-w-[220px]">{reciterName}</span>
        </div>
      </div>

      {/* Center: Quick Command Palette Trigger (cmdk) + Undo/Redo History */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          data-testid="studio-command-trigger"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-medium text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)]"
        >
          <Search className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
          <span className="hidden sm:inline">بحث سريع: سورة، قارئ، قالب...</span>
          <span className="sm:hidden">أوامر</span>
          <kbd className="mr-1 hidden items-center gap-0.5 rounded border border-[var(--border-hairline)] bg-[var(--surface-card)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--ink-muted)] md:inline-flex">
            <Command className="h-2.5 w-2.5" aria-hidden="true" />
            <span>K</span>
          </kbd>
        </button>

        <div
          role="group"
          aria-label="سجل التعديلات"
          className="flex items-center overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)]"
        >
          <StudioTooltip content="تراجع عن آخر تعديل" shortcut="Ctrl+Z">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="تراجع عن آخر تعديل"
              className="grid h-9 w-9 place-items-center text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-card)] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </StudioTooltip>
          <span
            className="h-4 w-px bg-[var(--border-hairline)]"
            aria-hidden="true"
          />
          <StudioTooltip content="إعادة التعديل" shortcut="Ctrl+Y">
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="إعادة التعديل"
              className="grid h-9 w-9 place-items-center text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-card)] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </StudioTooltip>
          <span
            className="h-4 w-px bg-[var(--border-hairline)]"
            aria-hidden="true"
          />
          <StudioTooltip content="إعادة ضبط التنسيق الافتراضي">
            <button
              type="button"
              onClick={onReset}
              aria-label="إعادة ضبط التنسيق"
              className="grid h-9 w-9 place-items-center text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--ink-primary)]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </StudioTooltip>
        </div>
      </div>

      {/* Left (RTL end): Secondary Navigation + Primary Export CTA */}
      <div className="flex items-center gap-2">
        <StudioTooltip content="فتح السورة الحالية في القارئ">
          <Link
            href={`/quran/${surahId}?ayah=${fromAyah}`}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <BookOpen className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" />
            <span className="hidden lg:inline">القارئ</span>
          </Link>
        </StudioTooltip>

        <StudioTooltip content="تنزيل البطاقة الحالية بصيغة PNG">
          <button
            type="button"
            onClick={onExportPng}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <Download className="h-3.5 w-3.5 text-[var(--brand-emerald)] dark:text-[#E6C75A]" aria-hidden="true" />
            <span className="hidden sm:inline">غلاف PNG</span>
          </button>
        </StudioTooltip>

        <button
          type="button"
          onClick={onExportVideo}
          className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--brand-gold)] px-4 text-xs font-bold text-[#1F1705] shadow-sm transition-opacity hover:opacity-95"
        >
          <Video className="h-3.5 w-3.5" aria-hidden="true" />
          <span>تصدير الفيديو</span>
        </button>
      </div>
    </div>
  );
}
