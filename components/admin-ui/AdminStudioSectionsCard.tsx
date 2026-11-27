'use client';

/**
 * AdminStudioSectionsCard — الإدارة المركزية لظهور أقسام لوحة التصميم في الاستوديو.
 * نُقلت من شريط الاستوديو إلى لوحة التحكم كي يظل الاستوديو مخصّصاً للإبداع فقط
 * وتبقى إعدادات تفعيل/إخفاء الوحدات بيد مسؤول المنصة.
 */
import React from 'react';
import { Eye, EyeOff, Layers } from 'lucide-react';
import {
  getInspectorSectionsByTab,
  INSPECTOR_SECTIONS,
  INSPECTOR_TAB_LABELS,
  INSPECTOR_TAB_ORDER,
  isInspectorSectionHidden,
  sanitizeHiddenInspectorSections,
  toggleHiddenInspectorSection,
} from '@/lib/inspector-sections';
import type { SiteConfig } from '@/lib/quran-data';
import { toArabicDigits } from '@/lib/quran-utils';
import { StudioSwitch } from '../studio-ui/StudioControls';

export interface AdminStudioSectionsCardProps {
  draft: SiteConfig;
  onDraftChange: (draft: SiteConfig) => void;
  persistDraft: (next: SiteConfig, msg: string) => void;
}

export function AdminStudioSectionsCard({
  draft,
  onDraftChange,
  persistDraft,
}: AdminStudioSectionsCardProps) {
  const hiddenIds = sanitizeHiddenInspectorSections(
    draft.studio.hiddenInspectorSections
  );
  const hiddenCount = hiddenIds.length;
  const visibleCount = INSPECTOR_SECTIONS.length - hiddenCount;

  const updateHidden = (nextHidden: string[]) => {
    onDraftChange({
      ...draft,
      studio: {
        ...draft.studio,
        hiddenInspectorSections: nextHidden,
      },
    });
  };

  return (
    <section
      aria-labelledby="admin-studio-sections-title"
      className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
        <div>
          <h2
            id="admin-studio-sections-title"
            className="font-display flex items-center gap-2 text-lg font-bold text-[var(--ink-primary)]"
          >
            <Layers className="h-4 w-4 text-[var(--brand-gold)]" aria-hidden="true" />
            <span>إدارة أقسام لوحة التصميم في الاستوديو</span>
          </h2>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            تحكّم في الأقسام المتاحة للمصممين داخل تبويبات الاستوديو الخمسة — الظاهر حالياً:{' '}
            <strong className="text-[var(--ink-primary)] tabular-nums">
              {toArabicDigits(visibleCount)} من {toArabicDigits(INSPECTOR_SECTIONS.length)}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => updateHidden([])}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <Eye className="h-3.5 w-3.5 text-[var(--brand-emerald)] dark:text-[#E6C75A]" aria-hidden="true" />
            <span>إظهار الكل</span>
          </button>
          <button
            type="button"
            onClick={() => updateHidden(INSPECTOR_SECTIONS.map((s) => s.id))}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-bold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink-primary)]"
          >
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            <span>إخفاء الكل</span>
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {INSPECTOR_TAB_ORDER.map((tab) => {
          const sections = getInspectorSectionsByTab(tab);
          if (!sections.length) return null;
          return (
            <div
              key={tab}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/40 p-3.5"
            >
              <h3 className="mb-2 border-b border-[var(--border-hairline)] pb-1.5 text-xs font-bold text-[var(--brand-emerald)] dark:text-[#E6C75A]">
                تبويب {INSPECTOR_TAB_LABELS[tab]} ({toArabicDigits(sections.length)})
              </h3>
              <div className="space-y-1">
                {sections.map((sec) => {
                  const isVisible = !isInspectorSectionHidden(hiddenIds, sec.id);
                  return (
                    <StudioSwitch
                      key={sec.id}
                      id={`admin-studio-sec-${sec.id}`}
                      label={sec.label}
                      compact
                      checked={isVisible}
                      onCheckedChange={(checked) => {
                        const currentlyHidden = isInspectorSectionHidden(hiddenIds, sec.id);
                        if (currentlyHidden === checked) {
                          updateHidden(toggleHiddenInspectorSection(hiddenIds, sec.id));
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-4">
        <p className="text-xs text-[var(--ink-muted)]">
          تُخفى الأقسام المعطّلة نهائياً من واجهة الاستوديو دون أي أزرار إدارية إضافية.
        </p>
        <button
          type="button"
          onClick={() =>
            persistDraft(draft, 'تم حفظ إعدادات ظهور أقسام الاستوديو')
          }
          className="rounded-lg bg-[var(--brand-emerald)] px-5 py-2.5 text-sm font-bold text-[#FAF7F0] transition-opacity hover:opacity-90"
        >
          حفظ أقسام الاستوديو
        </button>
      </div>
    </section>
  );
}
