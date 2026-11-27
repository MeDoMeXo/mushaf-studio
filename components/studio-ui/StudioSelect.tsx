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
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((o) => o.value === value);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  // Clamp the dropdown inside the viewport: if there is more room above than
  // below, render the list upward so it never overflows the screen bottom.
  useLayoutEffect(() => {
    if (!open || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const roomBelow = window.innerHeight - rect.bottom;
    const roomAbove = rect.top;
    setDropUp(roomBelow < 220 && roomAbove > roomBelow);
  }, [open]);

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

      {open && (
        <div
          ref={listRef}
          role="listbox"
          dir="rtl"
          className={`studio-scroll absolute z-50 max-h-60 w-full min-w-fit overflow-y-auto rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] py-1 shadow-xl ring-1 ring-black/5 ${
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
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
                    className="sticky top-0 z-[1] bg-[var(--surface-card)] px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]"
                  >
                    {opt.group}
                  </div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={optionStyle ? optionStyle(opt.value) : undefined}
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
      )}
    </div>
  );
}
