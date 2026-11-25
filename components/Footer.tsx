'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, ExternalLink } from 'lucide-react';
import { useApp } from './AppProvider';

const QUICK_LINKS = [
  { href: '/', label: 'الرئيسية' },
  { href: '/quran', label: 'القرآن الكريم' },
  { href: '/studio', label: 'الاستوديو' },
  { href: '/search', label: 'البحث' },
  { href: '/admin', label: 'لوحة التحكم' },
];

interface FooterProps {
  compact?: boolean;
}

export function Footer({ compact = false }: FooterProps) {
  const { config, audioState } = useApp();
  const footer = config.footer;

  if (!footer?.enabled) return null;

  const hasAnyLinks =
    footer.showQuickLinks || (footer.customLinks && footer.customLinks.length > 0);

  if (compact) {
    return (
      <footer
        data-testid="site-footer"
        className="shrink-0 border-t border-[var(--border-hairline)] bg-[var(--surface-card)]/95 px-4 py-2 transition-colors sm:px-6"
      >
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-[var(--ink-muted)]">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 font-bold text-[var(--ink-primary)] transition-opacity hover:opacity-85"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--brand-emerald)] text-[#FAF7F0]">
                <BookOpen className="h-3 w-3" aria-hidden="true" />
              </span>
              <span className="font-display text-xs">{config.siteName}</span>
            </Link>
            {footer.copyright.trim() && (
              <>
                <span aria-hidden="true" className="opacity-40">
                  ·
                </span>
                <span>{footer.copyright}</span>
              </>
            )}
          </div>

          {hasAnyLinks && (
            <nav
              aria-label="روابط التذييل"
              className="hidden flex-wrap items-center gap-x-4 gap-y-1 font-semibold md:flex"
            >
              {footer.showQuickLinks &&
                QUICK_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="transition-colors hover:text-[var(--ink-primary)]"
                  >
                    {item.label}
                  </Link>
                ))}
              {footer.customLinks.map((item, idx) => {
                const isExternal =
                  item.href.startsWith('http://') ||
                  item.href.startsWith('https://') ||
                  item.href.startsWith('mailto:');
                if (isExternal) {
                  return (
                    <a
                      key={`${item.href}-${idx}`}
                      href={item.href}
                      target={item.href.startsWith('mailto:') ? undefined : '_blank'}
                      rel={item.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                      className="inline-flex items-center gap-1 text-[var(--brand-emerald)] transition-colors hover:text-[var(--brand-gold)] dark:text-[#E6C75A]"
                    >
                      <span>{item.label}</span>
                      {!item.href.startsWith('mailto:') && (
                        <ExternalLink className="h-2.5 w-2.5 opacity-75" aria-hidden="true" />
                      )}
                    </a>
                  );
                }
                return (
                  <Link
                    key={`${item.href}-${idx}`}
                    href={item.href}
                    className="text-[var(--brand-emerald)] transition-colors hover:text-[var(--brand-gold)] dark:text-[#E6C75A]"
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </footer>
    );
  }

  return (
    <footer
      data-testid="site-footer"
      className={`shrink-0 border-t border-[var(--border-hairline)] bg-[var(--surface-card)]/90 transition-colors ${
        audioState.visible ? 'pb-24' : ''
      }`}
    >
      <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          {/* Brand & short description */}
          <div className="max-w-md space-y-1.5">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 text-[var(--ink-primary)] transition-opacity hover:opacity-85"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-emerald)] text-[#FAF7F0] shadow-xs">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-display text-base font-bold tracking-tight">
                {config.siteName}
              </span>
            </Link>
            {footer.description.trim() && (
              <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
                {footer.description}
              </p>
            )}
          </div>

          {/* Inline quick & custom links */}
          {hasAnyLinks && (
            <nav
              aria-label="روابط التذييل"
              className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-[var(--ink-muted)]"
            >
              {footer.showQuickLinks &&
                QUICK_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="transition-colors hover:text-[var(--ink-primary)]"
                  >
                    {item.label}
                  </Link>
                ))}
              {footer.customLinks.map((item, idx) => {
                const isExternal =
                  item.href.startsWith('http://') ||
                  item.href.startsWith('https://') ||
                  item.href.startsWith('mailto:');
                if (isExternal) {
                  return (
                    <a
                      key={`${item.href}-${idx}`}
                      href={item.href}
                      target={item.href.startsWith('mailto:') ? undefined : '_blank'}
                      rel={item.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                      className="inline-flex items-center gap-1 text-[var(--brand-emerald)] transition-colors hover:text-[var(--brand-gold)] dark:text-[#E6C75A]"
                    >
                      <span>{item.label}</span>
                      {!item.href.startsWith('mailto:') && (
                        <ExternalLink className="h-3 w-3 opacity-75" aria-hidden="true" />
                      )}
                    </a>
                  );
                }
                return (
                  <Link
                    key={`${item.href}-${idx}`}
                    href={item.href}
                    className="text-[var(--brand-emerald)] transition-colors hover:text-[var(--brand-gold)] dark:text-[#E6C75A]"
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {/* Bottom copyright & QUL credit hairline row */}
        {(footer.copyright.trim() || footer.showCredits) && (
          <div className="mt-5 flex flex-col gap-2 border-t border-[var(--border-hairline)] pt-4 text-[11px] text-[var(--ink-muted)] sm:flex-row sm:items-center sm:justify-between">
            <span>{footer.copyright}</span>
            {footer.showCredits && (
              <span>النصوص العثمانية والترجمات من مكتبة QUL مفتوحة المصدر</span>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
