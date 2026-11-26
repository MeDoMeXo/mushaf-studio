'use client';

/**
 * StudioInspectorSectionsToolbar — شريط أدوات أعلى لوحة التنسيق: زر يفتح
 * قائمة بكل الأقسام (مجمّعة حسب التبويب) مع مفتاح ظهور لكل قسم وأزرار
 * «إظهار الكل / إخفاء الكل». بدون أي مكتبة Popover خارجية — قائمة منسدلة
 * خفيفة مع طبقة نقر خارجي لإغلاقها ودعم Escape، متوافقة مع الجوال.
 */
import React, { useState } from 'react';
import { Eye, EyeOff, Layers } from 'lucide-react';
import {
  INSPECTOR_SECTIONS,
  INSPECTOR_TAB_LABELS,
  type InspectorSectionTab,
} from '@/lib/inspector-sections';
import type { InspectorSectionVisibilityApi } from '@/hooks/use-inspector-section-visibility';
import { StudioSwitch } from './StudioControls';

interface StudioInspectorSectionsToolbarProps {
  api: InspectorSectionVisibilityApi;
}

const TAB_ORDER: InspectorSectionTab[] = ['templates', 'ornaments', 'background', 'text', 'audio'];

export function StudioInspectorSectionsToolbar({ api }: StudioInspectorSectionsToolbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 text-[10px] font-bold text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--ink-primary)]"
      >
        <Layers className="h-3 w-3 text-[var(--brand-gold)]" aria-hidden="true" />
        <span>إدارة الأقسام</span>
        {api.hiddenCount > 0 && (
          <span
            aria-label={`${api.hiddenCount} قسم مخفي`}
            className="rounded-full bg-[var(--brand-gold)]/20 px-1.5 py-0.5 text-[9px] font-bold text-[var(--ink-primary)] tabular-nums"
          >
            {api.hiddenCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* طبقة نقر خارجي لإغلاق القائمة (نقر خالص بلا تركيز) */}
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="إدارة ظهور أقسام لوحة التنسيق"
            dir="rtl"
            className="studio-scroll absolute inset-x-0 top-full z-50 mt-1.5 max-h-80 w-[min(20rem,80vw)] overflow-y-auto rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3 text-right shadow-2xl"
          >
            <p className="mb-1 text-[10px] font-bold text-[var(--ink-muted)]">
              إظهار أو إخفاء أقسام لوحة التنسيق — يُحفظ اختيارك في متصفحك
            </p>

            {TAB_ORDER.map((tab) => {
              const sections = INSPECTOR_SECTIONS.filter((s) => s.tab === tab);
              if (!sections.length) return null;
              return (
                <div key={tab} className="mb-2.5">
                  <p className="mb-1 border-b border-[var(--border-hairline)] pb-1 text-[11px] font-bold text-[var(--brand-emerald)] dark:text-[#E6C75A]">
                    {INSPECTOR_TAB_LABELS[tab]}
                  </p>
                  {sections.map((s) => (
                    <StudioSwitch
                      key={s.id}
                      id={`insp-sec-${s.id}`}
                      label={s.label}
                      compact
                      checked={!api.isHidden(s.id)}
                      onCheckedChange={(visible) => {
                        // التبديل فقط إذا كانت الحالة المستهدفة فعلاً مختلفة
                        if (api.isHidden(s.id) !== !visible) api.toggleSection(s.id);
                      }}
                    />
                  ))}
                </div>
              );
            })}

            <div className="mt-1 flex items-center gap-1.5 border-t border-[var(--border-hairline)] pt-2">
              <button
                type="button"
                onClick={() => api.setAllSections(true)}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--brand-emerald)] px-2 text-[10px] font-bold text-[#FAF7F0] transition-opacity hover:opacity-90"
              >
                <Eye className="h-3 w-3" aria-hidden="true" />
                <span>إظهار الكل</span>
              </button>
              <button
                type="button"
                onClick={() => api.setAllSections(false)}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 text-[10px] font-bold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink-primary)]"
              >
                <EyeOff className="h-3 w-3" aria-hidden="true" />
                <span>إخفاء الكل</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
