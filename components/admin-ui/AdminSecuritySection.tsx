'use client';

/**
 * AdminSecuritySection — local PIN change form.
 * Extracted from AdminView (roadmap item 3): owns its own form state, calls
 * the storage-layer helpers directly, and reports success via toast.
 */
import React, { useState } from 'react';
import { getAdminPin, setAdminPin } from '@/lib/storage';
import { validatePinChange } from '@/lib/quran-utils';

export interface AdminSecuritySectionProps {
  showToast: (msg: string) => void;
}

export function AdminSecuritySection({ showToast }: AdminSecuritySectionProps) {
  const [curPin, setCurPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [secFeedback, setSecFeedback] = useState('');

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    const res = validatePinChange(getAdminPin(), curPin, newPin, confirmPin);
    if (!res.ok) {
      setSecFeedback(res.error);
      return;
    }
    setAdminPin(newPin);
    setCurPin('');
    setNewPin('');
    setConfirmPin('');
    setSecFeedback('');
    showToast('تم تغيير رمز الدخول بنجاح');
  };

  return (
    <form
      onSubmit={handleChangePin}
      className="max-w-lg rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5 space-y-4"
    >
      <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
        تغيير رمز الدخول المحلي
      </h2>
      <div>
        <label
          htmlFor="sec-cur"
          className="block text-xs font-bold text-[var(--ink-muted)]"
        >
          الرمز الحالي
        </label>
        <input
          id="sec-cur"
          type="password"
          inputMode="numeric"
          value={curPin}
          onChange={(e) => setCurPin(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)]"
        />
      </div>
      <div>
        <label
          htmlFor="sec-new"
          className="block text-xs font-bold text-[var(--ink-muted)]"
        >
          الرمز الجديد (٤ إلى ٨ أرقام)
        </label>
        <input
          id="sec-new"
          type="password"
          inputMode="numeric"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)]"
        />
      </div>
      <div>
        <label
          htmlFor="sec-confirm"
          className="block text-xs font-bold text-[var(--ink-muted)]"
        >
          تأكيد الرمز الجديد
        </label>
        <input
          id="sec-confirm"
          type="password"
          inputMode="numeric"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)]"
        />
      </div>

      {secFeedback && (
        <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">
          {secFeedback}
        </p>
      )}

      <button
        type="submit"
        className="rounded-lg bg-[var(--brand-emerald)] px-5 py-2.5 text-sm font-bold text-[#FAF7F0] hover:opacity-90"
      >
        تحديث الرمز
      </button>
    </form>
  );
}
