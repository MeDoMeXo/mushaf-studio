'use client';

/**
 * StudioLinksSection — قسم «الروابط» في تبويب النص بلوحة التنسيق:
 * روابط داخلية سريعة (next/link للتنقل الفوري) + قائمة روابط خارجية يديرها
 * المستخدم (تسمية + رابط، إضافة/حذف) محفوظة في localStorage. الروابط الخارجية
 * تُنقّى عبر sanitizeFooterLinkHref مع اشتراط http/https فقط، وتُفتح في تبويب
 * جديد مع rel="noopener noreferrer" (أمان من tab-nabbing).
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Home, Link2, Plus, Search, Trash2, BookOpen, ChevronDown } from 'lucide-react';
import { sanitizeFooterLinkHref } from '@/lib/quran-utils';
import { toArabicDigits } from '@/lib/quran-utils';

const LINKS_STORAGE_KEY = 'mushaf-studio-external-links';
const MAX_EXTERNAL_LINKS = 8;
const MAX_LINK_LABEL_CHARS = 40;

interface ExternalLinkItem {
  id: string;
  label: string;
  url: string;
}

/** الروابط الخارجية: http/https فقط — لا مسارات داخلية ولا mailto هنا. */
function sanitizeExternalLinkUrl(raw: string): string | null {
  const safe = sanitizeFooterLinkHref(raw);
  if (!safe) return null;
  try {
    const parsed = new URL(safe);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.toString();
    return null;
  } catch {
    return null;
  }
}

const INTERNAL_QUICK_LINKS = [
  { href: '/', label: 'الرئيسية', icon: Home },
  { href: '/quran', label: 'القرآن', icon: BookOpen },
  { href: '/search', label: 'البحث', icon: Search },
] as const;

function readLinksFromStorage(): ExternalLinkItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LINKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const list: ExternalLinkItem[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const label = typeof o.label === 'string' ? o.label.trim().slice(0, MAX_LINK_LABEL_CHARS) : '';
      const url = typeof o.url === 'string' ? o.url : '';
      if (!label || !sanitizeExternalLinkUrl(url)) continue;
      list.push({ id: typeof o.id === 'string' ? o.id : `lnk_${Math.random()}`, label, url });
      if (list.length >= MAX_EXTERNAL_LINKS) break;
    }
    return list;
  } catch {
    return [];
  }
}

export function StudioLinksSection() {
  const [open, setOpen] = useState(true);
  const [links, setLinks] = useState<ExternalLinkItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ترطيب آمن بعد التحميل (microtask) — نفس أسلوب StudioView/AppProvider
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setLinks(readLinksFromStorage());
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const persist = (next: ExternalLinkItem[]) => {
    setLinks(next);
    try {
      if (next.length === 0) window.localStorage.removeItem(LINKS_STORAGE_KEY);
      else window.localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // التخزين معطّل/ممتلئ — القائمة تعمل للجلسة الحالية فقط
    }
  };

  const handleAddLink = () => {
    const label = newLabel.trim().slice(0, MAX_LINK_LABEL_CHARS);
    if (!label) {
      setError('أدخل تسمية للرابط');
      return;
    }
    const url = sanitizeExternalLinkUrl(newUrl);
    if (!url) {
      setError('الرابط الخارجي يجب أن يبدأ بـ http:// أو https://');
      return;
    }
    if (links.length >= MAX_EXTERNAL_LINKS) {
      setError(`الحد الأقصى ${toArabicDigits(MAX_EXTERNAL_LINKS)} روابط خارجية`);
      return;
    }
    setError(null);
    setNewLabel('');
    setNewUrl('');
    persist([...links, { id: `lnk_${Date.now()}`, label, url }]);
  };

  const handleRemoveLink = (id: string) => persist(links.filter((l) => l.id !== id));

  return (
    <div className="border-t border-[var(--border-hairline)] pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-right"
      >
        <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink-primary)]">
          <Link2 className="h-3.5 w-3.5 text-[var(--brand-gold)]" aria-hidden="true" />
          <span>الروابط</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[var(--ink-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="mt-2.5 space-y-3">
          {/* روابط داخلية سريعة — تنقل فوري داخل الموقع */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-[var(--ink-muted)]">
              روابط سريعة داخلية
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {INTERNAL_QUICK_LINKS.map((l) => {
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/60 px-2 py-1.5 text-[11px] font-bold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
                  >
                    <Icon className="h-3 w-3 text-[var(--ink-muted)]" aria-hidden="true" />
                    <span>{l.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-[var(--ink-muted)]">
              روابط خارجية خاصة بك ({toArabicDigits(hydrated ? links.length : 0)}{' '}
              / {toArabicDigits(MAX_EXTERNAL_LINKS)})
            </p>

            {links.length > 0 && (
              <ul className="mb-2 divide-y divide-[var(--border-hairline)]/60 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/40">
                {links.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-[var(--brand-emerald)] underline dark:text-[#E6C75A]"
                      dir="rtl"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{l.label}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(l.id)}
                      aria-label={`حذف الرابط ${l.label}`}
                      className="shrink-0 text-[var(--ink-muted)] transition-colors hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form
              className="space-y-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                handleAddLink();
              }}
            >
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="التسمية (مثال: قناتنا)"
                aria-label="تسمية الرابط الخارجي"
                maxLength={MAX_LINK_LABEL_CHARS}
                className="h-8 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 text-[11px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--brand-gold)] focus:outline-none"
              />
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com"
                dir="ltr"
                className="h-8 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 text-right text-[11px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--brand-gold)] focus:outline-none"
              />
              {error && <p className="text-[10px] font-semibold text-red-500">{error}</p>}
              <button
                type="submit"
                className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 px-2 text-[11px] font-bold text-[var(--ink-primary)] transition-colors hover:bg-[var(--brand-gold)]/25"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                <span>إضافة رابط خارجي</span>
              </button>
            </form>

            <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--ink-muted)]">
              الروابط الخارجية تُحفظ في متصفحك فقط وتُفتح في تبويب جديد بأمان
              (noopener) — يُقبل رابطاً يبدأ بـ http:// أو https:// فقط.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
