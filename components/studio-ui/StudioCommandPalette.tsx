'use client';

import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import {
  BookOpen,
  Download,
  Languages,
  Maximize2,
  Mic,
  Monitor,
  Redo2,
  RotateCcw,
  Search,
  Sparkles,
  Undo2,
  Video,
  X,
} from 'lucide-react';
import {
  ASPECT_PRESETS,
  RECITERS,
  STUDIO_TEMPLATES,
  TRANSLATIONS,
  type AspectPresetId,
  type QulChapter,
  type StudioTemplate,
} from '@/lib/quran-data';
import { toArabicDigits } from '@/lib/quran-utils';

interface StudioCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: QulChapter[];
  activeSurah: number;
  activeReciter: string;
  activeTranslationId: number;
  activeTemplateId?: string;
  canUndo: boolean;
  canRedo: boolean;
  onSelectSurah: (surahId: number) => void;
  onSelectReciter: (slug: string) => void;
  onSelectTranslation: (translationId: number) => void;
  onSelectTemplate: (tpl: StudioTemplate) => void;
  onSelectAspect: (aspect: AspectPresetId) => void;
  onExportVideo: () => void;
  onExportPng: () => void;
  onOpenFullscreen: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}

export function StudioCommandPalette({
  open,
  onOpenChange,
  chapters,
  activeSurah,
  activeReciter,
  activeTranslationId,
  activeTemplateId,
  canUndo,
  canRedo,
  onSelectSurah,
  onSelectReciter,
  onSelectTranslation,
  onSelectTemplate,
  onSelectAspect,
  onExportVideo,
  onExportPng,
  onOpenFullscreen,
  onUndo,
  onRedo,
  onReset,
}: StudioCommandPaletteProps) {
  const runAndClose = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          dir="rtl"
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14%] z-50 w-[94vw] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] shadow-2xl focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">
            لوحة الأوامر والبحث السريع في الاستوديو
          </DialogPrimitive.Title>

          <Command
            loop
            className="flex flex-col bg-[var(--surface-card)] text-[var(--ink-primary)]"
          >
            {/* Search Input Header */}
            <div className="flex items-center gap-2.5 border-b border-[var(--border-hairline)] px-4 py-3">
              <Search
                className="h-4 w-4 shrink-0 text-[var(--brand-gold)]"
                aria-hidden="true"
              />
              <Command.Input
                autoFocus
                placeholder="ابحث عن سورة، قارئ، قالب إسلامي، مقاس، أو إجراء سريع..."
                className="w-full bg-transparent text-sm font-medium text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:outline-none"
              />
              <DialogPrimitive.Close
                aria-label="إغلاق لوحة الأوامر"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink-primary)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>

            {/* Results List */}
            <Command.List className="max-h-[420px] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-xs font-medium text-[var(--ink-muted)]">
                لا توجد نتائج مطابقة — جرّب اسم سورة أو قارئ أو قالب آخر.
              </Command.Empty>

              {/* Quick Actions */}
              <Command.Group
                heading="إجراءات سريعة"
                className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-[var(--ink-muted)]"
              >
                <Command.Item
                  value="تصدير الفيديو export video mp4 webm"
                  onSelect={() => runAndClose(onExportVideo)}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)] aria-selected:bg-[var(--surface-subtle)] aria-selected:text-[var(--brand-emerald)] dark:aria-selected:text-[#E6C75A]"
                >
                  <span className="flex items-center gap-2">
                    <Video className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
                    <span>تصدير الفيديو الكامل (MP4 / WebM)</span>
                  </span>
                  <span className="text-[11px] text-[var(--ink-muted)]">تصدير</span>
                </Command.Item>

                <Command.Item
                  value="تنزيل غلاف صورة png download image"
                  onSelect={() => runAndClose(onExportPng)}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)] aria-selected:bg-[var(--surface-subtle)]"
                >
                  <span className="flex items-center gap-2">
                    <Download className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
                    <span>تنزيل غلاف البطاقة بصيغة PNG</span>
                  </span>
                </Command.Item>

                <Command.Item
                  value="معاينة ملء الشاشة fullscreen zoom"
                  onSelect={() => runAndClose(onOpenFullscreen)}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)] aria-selected:bg-[var(--surface-subtle)]"
                >
                  <span className="flex items-center gap-2">
                    <Maximize2 className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
                    <span>معاينة التصميم بملء الشاشة</span>
                  </span>
                </Command.Item>

                {canUndo && (
                  <Command.Item
                    value="تراجع undo خطوة للخلف"
                    onSelect={() => runAndClose(onUndo)}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)] aria-selected:bg-[var(--surface-subtle)]"
                  >
                    <span className="flex items-center gap-2">
                      <Undo2 className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" />
                      <span>تراجع عن آخر تعديل</span>
                    </span>
                    <kbd className="font-mono text-[10px] text-[var(--ink-muted)]">Ctrl+Z</kbd>
                  </Command.Item>
                )}

                {canRedo && (
                  <Command.Item
                    value="إعادة redo خطوة للأمام"
                    onSelect={() => runAndClose(onRedo)}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)] aria-selected:bg-[var(--surface-subtle)]"
                  >
                    <span className="flex items-center gap-2">
                      <Redo2 className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" />
                      <span>إعادة التعديل المتراجع عنه</span>
                    </span>
                    <kbd className="font-mono text-[10px] text-[var(--ink-muted)]">Ctrl+Y</kbd>
                  </Command.Item>
                )}

                <Command.Item
                  value="إعادة ضبط التنسيق reset defaults"
                  onSelect={() => runAndClose(onReset)}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)] aria-selected:bg-[var(--surface-subtle)]"
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" />
                    <span>إعادة ضبط التنسيق الافتراضي</span>
                  </span>
                </Command.Item>
              </Command.Group>

              {/* Islamic Templates */}
              <Command.Group
                heading="القوالب الإسلامية الجاهزة"
                className="mt-2 border-t border-[var(--border-hairline)] pt-2 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-[var(--ink-muted)]"
              >
                {STUDIO_TEMPLATES.map((tpl) => (
                  <Command.Item
                    key={tpl.id}
                    value={`قالب ${tpl.name} ${tpl.subtitle} ${tpl.category}`}
                    onSelect={() => runAndClose(() => onSelectTemplate(tpl))}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)] aria-selected:bg-[var(--surface-subtle)]"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        style={{ background: tpl.previewBg }}
                        className="h-5 w-7 shrink-0 rounded border border-white/15"
                        aria-hidden="true"
                      />
                      <span className="truncate">{tpl.name}</span>
                      <span className="truncate text-[11px] font-normal text-[var(--ink-muted)]">
                        · {tpl.subtitle}
                      </span>
                    </span>
                    {activeTemplateId === tpl.id && (
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--brand-gold)]" aria-hidden="true" />
                    )}
                  </Command.Item>
                ))}
              </Command.Group>

              {/* Aspect Ratios */}
              <Command.Group
                heading="مقاسات الفيديو والبطاقة"
                className="mt-2 border-t border-[var(--border-hairline)] pt-2 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-[var(--ink-muted)]"
              >
                {ASPECT_PRESETS.map((ap) => (
                  <Command.Item
                    key={ap.id}
                    value={`مقاس أبعاد ${ap.label} ${ap.ratio} ${ap.width}x${ap.height}`}
                    onSelect={() => runAndClose(() => onSelectAspect(ap.id))}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)] aria-selected:bg-[var(--surface-subtle)]"
                  >
                    <span className="flex items-center gap-2">
                      <Monitor className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" />
                      <span>
                        {ap.label} · {ap.ratio}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-[var(--ink-muted)] tabular-nums">
                      {ap.width}×{ap.height}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>

              {/* QUL Translations */}
              <Command.Group
                heading="الترجمات المعتمدة من QUL"
                className="mt-2 border-t border-[var(--border-hairline)] pt-2 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-[var(--ink-muted)]"
              >
                {TRANSLATIONS.map((tr) => (
                  <Command.Item
                    key={tr.id}
                    value={`ترجمة translation qul ${tr.name} ${tr.id}`}
                    onSelect={() => runAndClose(() => onSelectTranslation(tr.id))}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)] aria-selected:bg-[var(--surface-subtle)]"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Languages className="h-3.5 w-3.5 shrink-0 text-[var(--brand-gold)]" aria-hidden="true" />
                      <span className="truncate">{tr.name}</span>
                    </span>
                    {activeTranslationId === tr.id && (
                      <span className="shrink-0 text-[11px] font-bold text-[var(--brand-emerald)] dark:text-[#E6C75A]">
                        نشطة
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>

              {/* Reciters */}
              <Command.Group
                heading="القراء العالميون"
                className="mt-2 border-t border-[var(--border-hairline)] pt-2 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-[var(--ink-muted)]"
              >
                {RECITERS.map((r) => (
                  <Command.Item
                    key={r.slug}
                    value={`قارئ ${r.name} ${r.styleLabel} ${r.slug}`}
                    onSelect={() => runAndClose(() => onSelectReciter(r.slug))}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)] aria-selected:bg-[var(--surface-subtle)]"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Mic className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--ink-muted)]">
                      {activeReciter === r.slug ? 'نشط · ' : ''}
                      {r.styleLabel}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>

              {/* Surahs */}
              <Command.Group
                heading="سور القرآن الكريم"
                className="mt-2 border-t border-[var(--border-hairline)] pt-2 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-[var(--ink-muted)]"
              >
                {chapters.map((ch) => (
                  <Command.Item
                    key={ch.id}
                    value={`سورة ${ch.name_arabic} ${ch.name_simple} ${ch.id}`}
                    onSelect={() => runAndClose(() => onSelectSurah(ch.id))}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)] aria-selected:bg-[var(--surface-subtle)]"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" />
                      <span>
                        {toArabicDigits(ch.id)}. سورة {ch.name_arabic}
                      </span>
                    </span>
                    <span className="text-[11px] text-[var(--ink-muted)] tabular-nums">
                      {activeSurah === ch.id ? 'الحالية · ' : ''}
                      {toArabicDigits(ch.verses_count)} آية
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>

            {/* Footer Hints */}
            <div className="flex items-center justify-between border-t border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 px-4 py-2 text-[11px] text-[var(--ink-muted)]">
              <span>التنقل بالأسهم ↑↓ · الاختيار بـ Enter</span>
              <span>Esc للإغلاق</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
