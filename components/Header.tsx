'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, Menu, Moon, Sparkles, Sun, X } from 'lucide-react';
import { useApp } from './AppProvider';
import { StudioTooltip } from './studio-ui/StudioControls';

const NAV_LINKS = [
  { href: '/', label: 'الرئيسية' },
  { href: '/quran', label: 'القرآن الكريم' },
  { href: '/studio', label: 'الاستوديو' },
  { href: '/search', label: 'البحث' },
  { href: '/admin', label: 'لوحة التحكم' },
];

export function Header() {
  const pathname = usePathname();
  const { config, theme, toggleTheme } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="relative z-40 h-16 shrink-0 border-b border-[var(--border-hairline)] bg-[var(--surface-card)]/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6">
        {/* Zone 1: Clean single-line brand wordmark */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-lg font-bold text-[var(--brand-emerald)] transition-opacity hover:opacity-90 dark:text-[#E6C75A]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-emerald)] text-[#E6C75A] ring-1 ring-[#D4AF37]/30">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            {config.siteName}
          </span>
        </Link>

        {/* Zone 2: 5 clean single-line navigation links with Motion layoutId indicator */}
        <nav
          aria-label="التنقل الرئيسي"
          className="hidden items-center gap-1 rounded-xl bg-[var(--surface-subtle)]/70 p-1 md:flex"
        >
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`relative shrink-0 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? 'text-[var(--brand-emerald)] dark:text-[#E6C75A]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="header-active-nav"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-lg bg-[var(--surface-card)] shadow-sm ring-1 ring-[var(--brand-gold)]/45"
                  />
                )}
                <span className="relative z-10">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Theme switch + primary Studio CTA */}
        <div className="flex shrink-0 items-center gap-2">
          <StudioTooltip
            content={
              theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'
            }
          >
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الليلي'
              }
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[#E6C75A]" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </StudioTooltip>

          <Link
            href="/studio"
            className="hidden h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[var(--brand-emerald)] px-4 text-xs font-bold text-[#FAF7F0] shadow-sm transition-opacity hover:opacity-90 sm:inline-flex"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#E6C75A]" aria-hidden="true" />
            <span>صمّم تلاوة</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={mobileOpen}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)] md:hidden"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            aria-label="القائمة الجانبية"
            className="border-b border-[var(--border-hairline)] bg-[var(--surface-card)]/98 px-4 py-3 shadow-xl backdrop-blur-md md:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-[var(--brand-emerald)] text-[#FAF7F0]'
                        : 'text-[var(--ink-primary)] hover:bg-[var(--surface-subtle)]'
                    }`}
                  >
                    <span>{link.label}</span>
                    {active && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-[#E6C75A]"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
