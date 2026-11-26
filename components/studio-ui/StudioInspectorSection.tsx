'use client';

/**
 * StudioInspectorSection — غلاف قسم قابل للإخفاء داخل تبويبات لوحة التنسيق.
 * وهو ظاهر يُرسم المحتوى كما هو تماماً (صفر تغيير بصري على التصميم الحالي)،
 * وعند الإخفاء يعرض عنوان القسم فقط مع زر «إظهار». الحالة تمر عبر سياق
 * مشترك توفّره اللوحة الأم (StudioDesignInspector) كي لا تحتاج كل لوحة
 * تنسيق props جديدة — وتُدار المفاتيح كلها من شريط الأدوات العلوي.
 */
import React, { createContext, useContext } from 'react';
import { Eye } from 'lucide-react';
import type { InspectorSectionVisibilityApi } from '@/hooks/use-inspector-section-visibility';

interface InspectorSectionsContextValue {
  api: InspectorSectionVisibilityApi;
}

const InspectorSectionsContext = createContext<InspectorSectionsContextValue | null>(null);

interface InspectorSectionsProviderProps {
  api: InspectorSectionVisibilityApi;
  children: React.ReactNode;
}

export function InspectorSectionsProvider({ api, children }: InspectorSectionsProviderProps) {
  const value = React.useMemo(() => ({ api }), [api]);
  return <InspectorSectionsContext.Provider value={value}>{children}</InspectorSectionsContext.Provider>;
}

interface StudioInspectorSectionProps {
  /** معرّف القسم المسجّل في lib/inspector-sections.ts */
  id: string;
  /** التسمية العربية للقسم — تظهر فقط حين يكون القسم مخفياً */
  title: string;
  children: React.ReactNode;
}

export function StudioInspectorSection({ id, title, children }: StudioInspectorSectionProps) {
  const ctx = useContext(InspectorSectionsContext);
  const hidden = ctx?.api.isHidden(id) ?? false;

  if (!hidden) return <>{children}</>;

  return (
    <div
      data-inspector-section-hidden={id}
      className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-[var(--border-hairline)] bg-[var(--surface-subtle)]/50 px-3 py-2"
    >
      <p className="truncate text-xs font-bold text-[var(--ink-muted)]">{title}</p>
      <button
        type="button"
        onClick={() => ctx?.api.showSection(id)}
        aria-label={`إظهار قسم ${title}`}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/10 px-2 py-1 text-[10px] font-bold text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-gold)]/25 focus-visible:outline-2 focus-visible:outline-[var(--brand-gold)]"
      >
        <Eye className="h-3 w-3" aria-hidden="true" />
        <span>إظهار</span>
      </button>
    </div>
  );
}
