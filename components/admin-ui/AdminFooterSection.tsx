'use client';

/**
 * AdminFooterSection — site footer configuration + live mini preview.
 * Extracted from AdminView (600-line rule): owns its custom-link form state.
 */
import React, { useState } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  CONFIG_DEFAULTS,
  type SiteConfig,
} from '@/lib/quran-data';
import { sanitizeFooterLinkHref, toArabicDigits } from '@/lib/quran-utils';
import { StudioSwitch } from '../studio-ui/StudioControls';

export interface AdminFooterSectionProps {
  draft: SiteConfig;
  onDraftChange: (draft: SiteConfig) => void;
  persistDraft: (next: SiteConfig, msg: string) => void;
}

export function AdminFooterSection({
  draft,
  onDraftChange,
  persistDraft,
}: AdminFooterSectionProps) {
  const [newFooterLabel, setNewFooterLabel] = useState('');
  const [newFooterHref, setNewFooterHref] = useState('');
  const [footerLinkError, setFooterLinkError] = useState('');

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
              إعدادات تذييل الموقع (الفوتر)
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              تحكّم بظهور الفوتر البسيط أسفل جميع الصفحات، ونص الوصف والحقوق والروابط الإضافية.
            </p>
          </div>
          <StudioSwitch
            id="cfg-footer-enabled"
            label="إظهار الفوتر في الموقع"
            compact
            checked={draft.footer.enabled}
            onCheckedChange={(checked) =>
              onDraftChange({
                ...draft,
                footer: { ...draft.footer, enabled: checked },
              })
            }
          />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="cfg-footer-desc"
              className="block text-xs font-bold text-[var(--ink-muted)]"
            >
              وصف مختصر أسفل الشعار
            </label>
            <input
              id="cfg-footer-desc"
              type="text"
              value={draft.footer.description}
              onChange={(e) =>
                onDraftChange({
                  ...draft,
                  footer: { ...draft.footer, description: e.target.value },
                })
              }
              placeholder="منصة قرآنية مفتوحة للقراءة بالرسم العثماني..."
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="cfg-footer-copyright"
              className="block text-xs font-bold text-[var(--ink-muted)]"
            >
              نص الحقوق في الشريط السفلي
            </label>
            <input
              id="cfg-footer-copyright"
              type="text"
              value={draft.footer.copyright}
              onChange={(e) =>
                onDraftChange({
                  ...draft,
                  footer: { ...draft.footer, copyright: e.target.value },
                })
              }
              placeholder="© مصحف الاستوديو · جميع الحقوق محفوظة"
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
            />
          </div>

          <StudioSwitch
            id="cfg-footer-quick-links"
            label="إظهار روابط التنقل السريعة"
            description="الرئيسية، القرآن الكريم، الاستوديو، البحث، لوحة التحكم"
            checked={draft.footer.showQuickLinks}
            onCheckedChange={(checked) =>
              onDraftChange({
                ...draft,
                footer: { ...draft.footer, showQuickLinks: checked },
              })
            }
          />

          <StudioSwitch
            id="cfg-footer-credits"
            label="إظهار إشارة مصدر النصوص (QUL)"
            description="سطر توثيق مكتبة QUL مفتوحة المصدر في الشريط السفلي"
            checked={draft.footer.showCredits}
            onCheckedChange={(checked) =>
              onDraftChange({
                ...draft,
                footer: { ...draft.footer, showCredits: checked },
              })
            }
          />
        </div>

        {/* Custom Footer Links */}
        <div className="mt-6 border-t border-[var(--border-hairline)] pt-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--ink-primary)]">
              روابط إضافية مخصّصة ({toArabicDigits(draft.footer.customLinks.length)} / ٦)
            </h3>
            <span className="text-[11px] text-[var(--ink-muted)]">
              تقبل روابط داخلية (/quran) أو خارجية (https://...) أو بريد (mailto:)
            </span>
          </div>

          {draft.footer.customLinks.length > 0 && (
            <ul className="mt-3 space-y-2">
              {draft.footer.customLinks.map((item, idx) => (
                <li
                  key={`${item.href}-${idx}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/70 px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-[var(--ink-primary)]">
                      {item.label}
                    </span>
                    <span
                      dir="ltr"
                      className="mr-2 inline-block truncate font-mono text-[11px] text-[var(--ink-muted)]"
                    >
                      {item.href}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`حذف رابط ${item.label}`}
                    onClick={() =>
                      onDraftChange({
                        ...draft,
                        footer: {
                          ...draft.footer,
                          customLinks: draft.footer.customLinks.filter(
                            (_, i) => i !== idx
                          ),
                        },
                      })
                    }
                    className="rounded-lg p-1.5 text-[var(--ink-muted)] transition-colors hover:bg-red-500/10 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {draft.footer.customLinks.length < 6 && (
            <div className="mt-3 grid gap-2.5 sm:grid-cols-[1fr_1.4fr_auto]">
              <input
                type="text"
                value={newFooterLabel}
                onChange={(e) => {
                  setNewFooterLabel(e.target.value);
                  if (footerLinkError) setFooterLinkError('');
                }}
                placeholder="اسم الرابط (مثال: تواصل معنا)"
                aria-label="اسم الرابط الإضافي"
                className="h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
              />
              <input
                type="text"
                dir="ltr"
                value={newFooterHref}
                onChange={(e) => {
                  setNewFooterHref(e.target.value);
                  if (footerLinkError) setFooterLinkError('');
                }}
                placeholder="https://example.com أو mailto:..."
                aria-label="عنوان الرابط الإضافي"
                className="h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-mono text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const label = newFooterLabel.trim().slice(0, 40);
                  const safeHref = sanitizeFooterLinkHref(newFooterHref);
                  if (!label) {
                    setFooterLinkError('يرجى كتابة اسم الرابط أولاً');
                    return;
                  }
                  if (!safeHref) {
                    setFooterLinkError(
                      'يرجى إدخال رابط صحيح يبدأ بـ / أو https:// أو mailto:'
                    );
                    return;
                  }
                  onDraftChange({
                    ...draft,
                    footer: {
                      ...draft.footer,
                      customLinks: [
                        ...draft.footer.customLinks,
                        { label, href: safeHref },
                      ],
                    },
                  });
                  setNewFooterLabel('');
                  setNewFooterHref('');
                  setFooterLinkError('');
                }}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 text-xs font-bold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                إضافة رابط
              </button>
            </div>
          )}

          {footerLinkError && (
            <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
              {footerLinkError}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => persistDraft(draft, 'تم حفظ إعدادات تذييل الموقع')}
            className="rounded-lg bg-[var(--brand-emerald)] px-5 py-2.5 text-sm font-bold text-[#FAF7F0] hover:opacity-90"
          >
            حفظ إعدادات الفوتر
          </button>
          <button
            type="button"
            onClick={() => {
              const next = { ...draft, footer: { ...CONFIG_DEFAULTS.footer } };
              persistDraft(next, 'تمت استعادة إعدادات الفوتر الافتراضية');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-semibold text-[var(--ink-primary)] hover:border-[var(--brand-gold)]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            استعادة الافتراضي
          </button>
        </div>
      </div>

      {/* Live Mini Preview of the Site Footer */}
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-[var(--ink-primary)]">
            معاينة فورية لتذييل الموقع
          </h3>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              draft.footer.enabled
                ? 'bg-[var(--brand-emerald)]/12 text-[var(--brand-emerald)] dark:bg-[#E6C75A]/15 dark:text-[#E6C75A]'
                : 'bg-[var(--surface-subtle)] text-[var(--ink-muted)]'
            }`}
          >
            {draft.footer.enabled ? 'مفعّل' : 'مخفي'}
          </span>
        </div>

        {draft.footer.enabled ? (
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-canvas)] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-display text-sm font-bold text-[var(--ink-primary)]">
                  {draft.siteName}
                </p>
                {draft.footer.description.trim() && (
                  <p className="text-xs text-[var(--ink-muted)]">
                    {draft.footer.description}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[var(--ink-muted)]">
                {draft.footer.showQuickLinks && (
                  <>
                    <span>الرئيسية</span>
                    <span>القرآن الكريم</span>
                    <span>الاستوديو</span>
                    <span>البحث</span>
                  </>
                )}
                {draft.footer.customLinks.map((item, i) => (
                  <span
                    key={`${item.href}-${i}`}
                    className="text-[var(--brand-emerald)] dark:text-[#E6C75A]"
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            {(draft.footer.copyright.trim() || draft.footer.showCredits) && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3 text-[11px] text-[var(--ink-muted)]">
                <span>{draft.footer.copyright}</span>
                {draft.footer.showCredits && (
                  <span>النصوص العثمانية والترجمات من مكتبة QUL مفتوحة المصدر</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--border-hairline)] p-4 text-center text-xs text-[var(--ink-muted)]">
            الفوتر مخفي حالياً — فعّل خيار «إظهار الفوتر في الموقع» أعلاه لعرضه أسفل الصفحات.
          </p>
        )}
      </div>
    </div>
  );
}
