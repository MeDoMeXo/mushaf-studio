'use client';

import React, { createContext, useContext } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

interface InspectorAccordionContextValue {
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
}

const InspectorAccordionContext =
  createContext<InspectorAccordionContextValue | null>(null);

export function InspectorAccordionProvider({
  value,
  children,
}: {
  value: InspectorAccordionContextValue;
  children: React.ReactNode;
}) {
  return (
    <InspectorAccordionContext.Provider value={value}>
      {children}
    </InspectorAccordionContext.Provider>
  );
}

export function useInspectorAccordion() {
  return useContext(InspectorAccordionContext);
}

interface StudioAccordionCurtainProps {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * ستارة أكورديون منسدلة من الأعلى للأسفل لخيارات الاستوديو.
 * تدعم السحب الناعم رأسياً مع مؤشر حالة ومواءمة للوضعين الفاتح والداكن.
 */
export function StudioAccordionCurtain({
  id,
  title,
  open,
  onToggle,
  badge,
  icon,
  children,
  className = '',
}: StudioAccordionCurtainProps) {
  const contentId = `curtain-panel-${id}`;
  const headerId = `curtain-trigger-${id}`;

  return (
    <div
      data-testid={`curtain-${id}`}
      data-state={open ? 'open' : 'closed'}
      className={`overflow-hidden rounded-xl border transition-colors ${
        open
          ? 'border-[var(--brand-gold)]/45 bg-[var(--surface-card)] shadow-xs'
          : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]/45 hover:border-[var(--brand-gold)]/45'
      } ${className}`}
    >
      <button
        id={headerId}
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-right transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-gold)] ${
          open
            ? 'border-b border-[var(--border-hairline)]/70 bg-[var(--surface-subtle)]/55 text-[var(--ink-primary)]'
            : 'text-[var(--ink-primary)] hover:bg-[var(--surface-subtle)]/65'
        }`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {icon ? (
            <span className="shrink-0 text-[var(--brand-gold)]" aria-hidden="true">
              {icon}
            </span>
          ) : (
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
                open ? 'bg-[var(--brand-gold)]' : 'bg-[var(--border-hairline)]'
              }`}
            />
          )}
          <span className="truncate text-xs font-bold">{title}</span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {badge}
          <ChevronDown
            className={`h-4 w-4 text-[var(--ink-muted)] transition-transform duration-200 ${
              open ? 'rotate-180 text-[var(--brand-gold)]' : ''
            }`}
            aria-hidden="true"
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={contentId}
            role="region"
            aria-labelledby={headerId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="space-y-3 p-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface StudioCurtainToolbarProps {
  allOpen: boolean;
  allClosed: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  testIdPrefix: string;
}

/**
 * أزرار «فرد الكل» و«طي الكل» المدمجة في ترويسة ألواح الاستوديو.
 */
export function StudioCurtainToolbar({
  allOpen,
  allClosed,
  onExpandAll,
  onCollapseAll,
  testIdPrefix,
}: StudioCurtainToolbarProps) {
  return (
    <div
      role="group"
      aria-label="فرد أو طي جميع الأقسام"
      className="inline-flex shrink-0 items-center overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)]"
    >
      <button
        type="button"
        data-testid={`${testIdPrefix}-expand-all`}
        onClick={onExpandAll}
        disabled={allOpen}
        title="فرد جميع الستاير"
        className="inline-flex h-7 items-center gap-1 px-2 text-[11px] font-bold text-[var(--ink-primary)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--brand-emerald)] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-[#E6C75A]"
      >
        <ChevronsUpDown className="h-3 w-3 text-[var(--brand-gold)]" aria-hidden="true" />
        <span>فرد الكل</span>
      </button>
      <span className="h-3.5 w-px bg-[var(--border-hairline)]" aria-hidden="true" />
      <button
        type="button"
        data-testid={`${testIdPrefix}-collapse-all`}
        onClick={onCollapseAll}
        disabled={allClosed}
        title="طي جميع الستاير"
        className="inline-flex h-7 items-center gap-1 px-2 text-[11px] font-bold text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--ink-primary)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronsDownUp className="h-3 w-3" aria-hidden="true" />
        <span>طي الكل</span>
      </button>
    </div>
  );
}
