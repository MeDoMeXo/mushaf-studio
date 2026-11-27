'use client';

/**
 * StudioSelect — a viewport-safe, app-themed custom dropdown that replaces
 * native <select> elements in the studio side panels.
 *
 * Why: native <select> option lists are rendered by the OS and on Windows
 * they frequently overflow past the screen edge (especially in the narrow
 * left-side Design inspector), clipping options so the user cannot see or
 * pick them — "اختفاء إدارة الأقسام خارج الإطار". This component renders
 * the list in the DOM with a max-height scroll area and clamps its position
 * to the viewport so it never disappears off-screen.
 *
 * The list is portal-rendered into document.body with position:fixed. Panels
 * wrap their content in overflow:hidden (accordion curtains animate their
 * height), which used to clip the dropdown mid-option — the exact bug in the
 * screenshot. A portal escapes any ancestor clipping and stacking context.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface StudioSelectOption {
  value: string;
  label: string;
  /** عنوان مجموعة اختياري — الخيارات المتتالية بنفس العنوان تُجمَّع تحته. */
  group?: string;
}

interface StudioSelectProps {
  id?: string;
  'aria-label'?: string;
  value: string;
  options: StudioSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  /** Optional compact mode (h-8 instead of h-9). */
  compact?: boolean;
  /** Optional per-option inline style (e.g. fontFamily for font previews). */
  optionStyle?: (value: string) => React.CSSProperties;
}

export function StudioSelect({
  id,
  'aria-label': ariaLabel,
  value,
  options,
  onChange,
  className,
  compact = false,
  optionStyle,
}: StudioSelectProps) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [fixedPos, setFixedPos] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((o) => o.value === value);

  // Position the portalled list: fixed coordinates matching the trigger's
  // bounding box, clamped to the viewport (drop up when more room above).
  const positionList = React.useCallback(() => {
    if (!open || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const maxH = 240; // max-h-60
    const roomBelow = window.innerHeight - rect.bottom;
    const roomAbove = rect.top;
    const up = roomBelow < Math.min(maxH, 200) && roomAbove > roomBelow;
    setDropUp(up);
    setFixedPos({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    positionList();
    // Track scrolls (capture = any scrollable ancestor) and resizes so the
    // list keeps hugging the trigger; cheap on every event.
    window.addEventListener('scroll', positionList, true);
    window.addEventListener('resize', positionList);
    return () => {
      window.removeEventListener('scroll', positionList, true);
      window.removeEventListener('resize', positionList);
    };
  }, [open, positionList]);

  // On open, scroll the selected option into view (it may sit far down a
  // long grouped list — e.g. the default translation inside the English
  // group). Native scrollIntoView with block:'center' — group headers are
  // NOT sticky (they scroll with content, like native <select> optgroups),
  // so no header covers rows and no height math is needed. The original bug
  // (options clipped by the panel's overflow:hidden) is solved by the
  // body portal, not by geometry.
  useLayoutEffect(() => {
    if (!open || !fixedPos || !listRef.current) return;
    const list = listRef.current;
    const sel = list.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!sel) return;
    sel.scrollIntoView({ block: 'center' });
  }, [open, fixedPos]);

  // Close on outside click or Escape — the list lives in body now, so check
  // both the trigger wrapper and the portalled list for "inside" hits.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (
        wrapperRef.current?.contains(t) ||
        listRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const listBox = open && fixedPos ? (
    <div
      ref={listRef}
      role="listbox"
      dir="rtl"
      style={{
        position: 'fixed',
        top: dropUp ? undefined : fixedPos.top + fixedPos.height,
        bottom: dropUp ? window.innerHeight - fixedPos.top : undefined,
        left: fixedPos.left,
        width: fixedPos.width,
      }}
      className="studio-scroll z-[9999] max-h-60 min-w-fit overflow-y-auto rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] py-1 shadow-xl ring-1 ring-black/5"
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        const showGroupHeader =
          opt.group !== undefined && opt.group !== options[i - 1]?.group;
        return (
          <React.Fragment key={opt.value}>
            {showGroupHeader && (
              <div
                role="presentation"
                className="bg-[var(--surface-subtle)]/60 px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]"
              >
                {opt.group}
              </div>
            )}
            <button
              type="button"
              role="option"
              aria-selected={active}
              style={optionStyle ? optionStyle(opt.value) : undefined}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-right text-[11px] font-semibold transition-colors ${
                active
                  ? 'bg-[var(--brand-gold)]/15 text-[var(--ink-primary)]'
                  : 'text-[var(--ink-primary)] hover:bg-[var(--surface-subtle)]'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{opt.label}</span>
              {active && (
                <Check
                  className="h-3 w-3 shrink-0 text-[var(--brand-gold)]"
                  aria-hidden="true"
                />
              )}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  ) : null;

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ''}`}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2 text-[11px] font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)] focus:border-[var(--brand-gold)] focus:outline-none ${
          compact ? 'h-8' : 'h-9'
        }`}
      >
        <span
          className="min-w-0 flex-1 truncate text-right"
          style={optionStyle && selected ? optionStyle(selected.value) : undefined}
        >
          {selected?.label ?? '—'}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)] transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {listBox && createPortal(listBox, document.body)}
    </div>
  );
}
