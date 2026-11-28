'use client';

/**
 * ProductionDialogShell — صدفة حوار موحّدة لاستوديو الإنتاج + حقول صغيرة
 * مشتركة (صف، شريط تمرير، اختيار، زر) لكل حوارات القوائم.
 */
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function ProdDialog(props: {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const { title, icon, onClose, children, wide } = props;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#062318]/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`flex max-h-[86vh] w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} flex-col overflow-hidden rounded-2xl border border-[#d4af37]/40 bg-[var(--surface-card)] shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-2 bg-[#123c22] px-4 py-2.5 text-white">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            {icon}
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-md p-1 hover:bg-white/15"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="studio-scroll overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/** صف حقل مع تسمية. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold text-[var(--ink-muted)]">
      {label}
      {children}
    </label>
  );
}

/** شريط تمرير موحّد. */
export function RangeInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="range"
      {...props}
      className={`w-full accent-[var(--brand-gold)] ${props.className ?? ''}`}
    />
  );
}

/** زر ذهبي أساسي. */
export function GoldButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`h-9 rounded-xl bg-gradient-to-l from-[#e8c44a] to-[#c99b2f] px-4 text-sm font-bold text-[#123c22] shadow enabled:hover:brightness-105 disabled:opacity-50 ${props.className ?? ''}`}
    />
  );
}

/** زر ثانوي أبيض. */
export function PlainButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`h-9 rounded-xl border border-[#d4af37]/50 bg-white px-4 text-sm font-semibold text-[#123c22] enabled:hover:bg-[#fdf8ea] disabled:opacity-50 ${props.className ?? ''}`}
    />
  );
}

/** إدخال نصي موحّد. */
export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-9 rounded-lg border border-[var(--border-hairline)] bg-white px-3 text-sm text-[var(--ink-primary)] outline-none focus:border-[#d4af37] ${props.className ?? ''}`}
    />
  );
}
