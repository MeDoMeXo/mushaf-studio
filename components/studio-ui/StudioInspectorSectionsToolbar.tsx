'use client';

/**
 * StudioInspectorSectionsToolbar — شريط أدوات أعلى لوحة التنسيق: زر يفتح
 * قائمة بكل الأقسام (مجمّعة حسب التبويب) مع مفتاح ظهور لكل قسم وأزرار
 * «إظهار الكل / إخفاء الكل».
 *
 * المنسدلة تُرسم بـ position:fixed وتُقيَّد داخل إطار العرض (clamp):
 * محاذاة حافة الزر، عرض لا يتجاوز ٩٥٪ من الشاشة، وفتح لأعلى/أسفل حسب
 * المساحة المتاحة — فلا تتجاوز حافة الشاشة ولا تُقصّها حاويات اللوحة
 * (overflow-hidden/overflow-y-auto) كما كان يحدث مع position:absolute.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

/** Fixed-position geometry, clamped to the viewport. */
interface MenuGeometry {
  left: number;
  width: number;
  /** CSS top (open downward) or bottom (open upward) — exactly one is set. */
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const MENU_MIN_HEIGHT = 200;
const MENU_VIEWPORT_MARGIN = 8;
const MENU_GAP = 6;

export function StudioInspectorSectionsToolbar({ api }: StudioInspectorSectionsToolbarProps) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<MenuGeometry | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  /** Compute the clamped geometry from the button's live viewport rect. */
  const computeGeometry = useCallback((): MenuGeometry | null => {
    const btn = btnRef.current;
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const width = Math.min(320, vw - 2 * MENU_VIEWPORT_MARGIN);
    // RTL: right-align the menu with the button, then clamp within the screen.
    let left = Math.round(rect.right - width);
    left = Math.max(
      MENU_VIEWPORT_MARGIN,
      Math.min(left, vw - width - MENU_VIEWPORT_MARGIN)
    );

    const spaceBelow = vh - rect.bottom - MENU_GAP - MENU_VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_GAP - MENU_VIEWPORT_MARGIN;
    const openUp = spaceBelow < MENU_MIN_HEIGHT && spaceAbove > spaceBelow;
    const maxHeight = Math.min(
      320,
      Math.max(MENU_MIN_HEIGHT, openUp ? spaceAbove : spaceBelow)
    );

    if (openUp) {
      return {
        left,
        width,
        bottom: Math.max(0, vh - rect.top + MENU_GAP),
        maxHeight,
      };
    }
    return { left, width, top: Math.round(rect.bottom + MENU_GAP), maxHeight };
  }, []);

  const openMenu = useCallback(() => {
    setMenu(computeGeometry());
    setOpen(true);
  }, [computeGeometry]);

  const closeMenu = useCallback(() => setOpen(false), []);

  // Escape key + outside clicks + viewport changes close the menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        !menuRef.current?.contains(target) &&
        !btnRef.current?.contains(target)
      ) {
        closeMenu();
      }
    };
    const onViewportChange = () => closeMenu();
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', onViewportChange);
    // Any scroll OUTSIDE the menu (panel/page) closes it so it never detaches.
    const onScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      closeMenu();
    };
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, closeMenu]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? closeMenu() : openMenu())}
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

      {open && menu && (
        <div
          ref={menuRef}
          role="dialog"
          aria-label="إدارة ظهور أقسام لوحة التنسيق"
          dir="rtl"
          style={{
            position: 'fixed',
            left: `${menu.left}px`,
            width: `${menu.width}px`,
            ...(menu.top !== undefined ? { top: `${menu.top}px` } : {}),
            ...(menu.bottom !== undefined ? { bottom: `${menu.bottom}px` } : {}),
            maxHeight: `${menu.maxHeight}px`,
          }}
          className="studio-scroll z-[60] overflow-y-auto rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3 text-right shadow-2xl"
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
      )}
    </div>
  );
}
