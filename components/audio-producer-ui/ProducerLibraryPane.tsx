'use client';

/**
 * ProducerLibraryPane — عمود «مكتبة الآيات» القابل للتوسيع في «منتج الصوت»:
 * مقبض سحب على حافته اليسرى (المكتبة يمين الواجهة RTL) يوسّعه ويضيّقه
 * بحدود ٢٤٠..٥٦٠ بكسل، وزر طيّ/بسط في رأسه. العرض والطيّ يُحفظان
 * محلياً بين الجلسات (يديره الأب عبر onWidthChange/onToggleCollapsed).
 * في الشاشات الصغيرة (< md) العمود مكدّس بعرض كامل بلا مقبض.
 */
import React, { useCallback, useRef } from 'react';
import { GripVertical, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export const LIB_MIN_W = 240;
export const LIB_MAX_W = 560;

interface ProducerLibraryPaneProps {
  width: number;
  onWidthChange: (w: number) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  children: React.ReactNode;
}

export function ProducerLibraryPane({
  width,
  onWidthChange,
  collapsed,
  onToggleCollapsed,
  children,
}: ProducerLibraryPaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const isDesktop = !useIsMobile();

  /** عرض من موضع المؤشر: المسافة من حافة الأب اليمنى (المكتبة يميناً RTL). */
  const widthFromPointer = useCallback((clientX: number): number | null => {
    const parent = paneRef.current?.parentElement;
    if (!parent) return null;
    const rect = parent.getBoundingClientRect();
    const fromRight = rect.right - clientX;
    return Math.round(
      Math.max(LIB_MIN_W, Math.min(LIB_MAX_W, fromRight - 8))
    );
  }, []);

  // سحب المقبض: التقاط المؤشر على المقبض نفسه ثم تحديث مستمر.
  const onHandleDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    []
  );
  const onHandleMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const w = widthFromPointer(e.clientX);
      if (w !== null) onWidthChange(w);
    },
    [onWidthChange, widthFromPointer]
  );

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label="بسط مكتبة الآيات"
        title="بسط مكتبة الآيات (توسيع الشريط الجانبي)"
        className="hidden h-full min-h-[180px] w-9 shrink-0 flex-col items-center justify-start gap-1 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] pt-2 text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--brand-gold)] md:flex"
      >
        <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
        <span
          className="mt-2 text-[10px] font-bold [writing-mode:vertical-rl]"
          aria-hidden="true"
        >
          مكتبة الآيات
        </span>
      </button>
    );
  }

  return (
    <div
      ref={paneRef}
      className="relative flex min-h-0 flex-col md:shrink-0"
      style={isDesktop ? { width } : undefined}
    >
      {/* شريط تحكم رأس العمود: طيّ + العرض الحالي */}
      <div className="mb-1 hidden shrink-0 items-center justify-between px-1 md:flex">
        <span className="text-[10px] font-bold text-[var(--ink-muted)]">
          مكتبة الآيات
        </span>
        <span className="flex items-center gap-1">
          <span className="font-mono text-[9px] tabular-nums text-[var(--ink-muted)]">
            {width}px
          </span>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="طيّ مكتبة الآيات"
            title="طيّ مكتبة الآيات (توسيع المعاينة)"
            className="grid h-6 w-6 place-items-center rounded-md text-[var(--ink-muted)] transition-colors hover:bg-[var(--brand-gold)]/15 hover:text-[var(--brand-gold)]"
          >
            <PanelRightClose className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </span>
      </div>

      {/* المحتوى */}
      <div className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>

      {/* مقبض السحب على الحافة اليسرى (بين المكتبة والمعاينة) */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="مقبض توسيع مكتبة الآيات — اسحب لتغيير عرض الشريط الجانبي"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onWidthChange(Math.min(LIB_MAX_W, width + 24));
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            onWidthChange(Math.max(LIB_MIN_W, width - 24));
          }
        }}
        title="اسحب لتوسيع أو تضييق مكتبة الآيات"
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={(e) => {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            // تجاهل
          }
        }}
        className="group/handle absolute inset-y-0 left-0 z-20 hidden w-2 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center md:flex"
      >
        <span
          className="h-14 w-[3px] rounded-full bg-[var(--border-hairline)] transition-colors group-focus/handle:bg-[var(--brand-gold)] group-hover/handle:bg-[var(--brand-gold)] group-hover/handle:shadow-[0_0_8px_rgba(212,175,55,0.8)]"
          aria-hidden="true"
        >
          <GripVertical className="absolute inset-0 m-auto h-3.5 w-3.5 text-[var(--ink-muted)] opacity-0 transition-opacity group-hover/handle:opacity-100" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}
