'use client';

/**
 * AdminView — thin shell for the control panel.
 * Per the 600-line file rule every section now lives in components/admin-ui/*;
 * this file owns only auth, layout, navigation, and the shared draft/stats state.
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  DatabaseBackup,
  FileText,
  Lock,
  LogOut,
  Mic,
  Palette,
  PanelBottom,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CONFIG_DEFAULTS,
  EMPTY_STATS,
  type SiteConfig,
  type SiteStats,
} from '@/lib/quran-data';
import {
  isAdminAuthenticated,
  loadSiteConfig,
  loadStats,
  loginAdmin,
  logoutAdmin,
  saveSiteConfig,
  STATS_EVENT,
} from '@/lib/storage';
import { useApp } from './AppProvider';
import { AdminAppearanceSection } from './admin-ui/AdminAppearanceSection';
import { AdminBackupSection } from './admin-ui/AdminBackupSection';
import { AdminContentSection } from './admin-ui/AdminContentSection';
import { AdminFooterSection } from './admin-ui/AdminFooterSection';
import { AdminOverviewSection } from './admin-ui/AdminOverviewSection';
import { AdminReadingSection } from './admin-ui/AdminReadingSection';
import { AdminRecitersSection } from './admin-ui/AdminRecitersSection';
import { AdminSecuritySection } from './admin-ui/AdminSecuritySection';
import { AdminStudioSection } from './admin-ui/AdminStudioSection';

type AdminSection =
  | 'overview'
  | 'content'
  | 'reciters'
  | 'footer'
  | 'reading'
  | 'studio'
  | 'appearance'
  | 'backup'
  | 'security';

const NAV_ITEMS: { id: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'نظرة عامة', icon: BarChart3 },
  { id: 'reciters', label: 'إدارة القرّاء والمكتبات', icon: Mic },
  { id: 'content', label: 'المحتوى', icon: FileText },
  { id: 'footer', label: 'تذييل الموقع', icon: PanelBottom },
  { id: 'reading', label: 'القراءة والاستماع', icon: BookOpen },
  { id: 'studio', label: 'افتراضيات الاستوديو', icon: Sparkles },
  { id: 'appearance', label: 'المظهر والألوان', icon: Palette },
  { id: 'backup', label: 'النسخ والدمج', icon: DatabaseBackup },
  { id: 'security', label: 'الأمان', icon: ShieldCheck },
];

function todayBucket(stats: SiteStats): SiteStats['daily'][string] {
  const key = new Date().toISOString().slice(0, 10);
  return (
    stats.daily[key] ?? { visits: 0, reads: 0, plays: 0, exports: 0, searches: 0 }
  );
}

export function AdminView() {
  const { refreshConfig, showToast } = useApp();
  const [authed, setAuthed] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const [section, setSection] = useState<AdminSection>('overview');
  const [draft, setDraft] = useState<SiteConfig>(CONFIG_DEFAULTS);
  const [stats, setStats] = useState<SiteStats>(EMPTY_STATS);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setAuthed(isAdminAuthenticated());
      setDraft(loadSiteConfig());
      setStats(loadStats());
    });

    const onStats = () => setStats(loadStats());
    window.addEventListener(STATS_EVENT, onStats);
    return () => {
      active = false;
      window.removeEventListener(STATS_EVENT, onStats);
    };
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginAdmin(pinInput.trim())) {
      setAuthed(true);
      setPinError('');
      setPinInput('');
    } else {
      setPinError('رمز الدخول غير صحيح — الرمز الافتراضي هو 1234');
    }
  };

  const persistDraft = (next: SiteConfig, msg: string) => {
    const saved = saveSiteConfig(next);
    setDraft(saved);
    refreshConfig();
    showToast(msg);
  };

  if (!authed) {
    return (
      <main className="grid w-full flex-1 place-items-center px-4 py-12">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-8 shadow-sm"
        >
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-[var(--brand-emerald)] text-[#E6C75A]">
            <Lock className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-display mt-4 text-center text-2xl font-bold text-[var(--ink-primary)]">
            لوحة التحكم
          </h1>
          <p className="mt-1 text-center text-xs text-[var(--ink-muted)]">
            إدارة المحتوى، افتراضيات القراءة، الاستوديو، والمظهر
          </p>

          <div className="mt-5 rounded-lg border border-[var(--brand-gold)]/30 bg-[var(--brand-gold)]/10 px-3 py-2 text-center text-xs text-[var(--ink-primary)]">
            رمز الدخول الافتراضي: <strong className="tabular-nums">1234</strong>
          </div>

          <div className="mt-5">
            <label
              htmlFor="admin-pin-input"
              className="block text-xs font-bold text-[var(--ink-muted)]"
            >
              رمز الدخول
            </label>
            <input
              id="admin-pin-input"
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm tabular-nums text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
              required
            />
            {pinError && (
              <p role="alert" className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                {pinError}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="mt-5 w-full rounded-lg bg-[var(--brand-emerald)] px-5 py-2.5 text-sm font-bold text-[#FAF7F0] transition-opacity hover:opacity-90"
          >
            دخول
          </button>
        </form>
      </main>
    );
  }

  const todayStats = todayBucket(stats);

  return (
    <div className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 gap-5 px-4 pb-24 pt-5 sm:px-6 lg:grid-cols-[256px_1fr] 2xl:max-w-[1680px]">
      {/* Sidebar Navigation */}
      <aside className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3.5 sm:p-4 lg:sticky lg:top-4 lg:flex lg:h-[calc(100dvh-6.5rem)] lg:flex-col">
        <div className="border-b border-[var(--border-hairline)] pb-3">
          <p className="font-display text-base font-bold text-[var(--brand-emerald)] dark:text-[#E6C75A]">
            إدارة المنصة
          </p>
          <p className="text-xs text-[var(--ink-muted)]">
            مزامنة فورية مع الموقع والاستوديو
          </p>
        </div>

        <nav
          aria-label="أقسام لوحة التحكم"
          className="studio-scroll mt-3 flex flex-nowrap gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setSection(item.id)}
                className={`relative flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors lg:w-full ${
                  active
                    ? 'text-[#FAF7F0]'
                    : 'text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink-primary)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="admin-nav-active"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-xl bg-[var(--brand-emerald)] shadow-sm"
                  />
                )}
                <Icon className="relative z-10 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-[var(--border-hairline)] pt-3 lg:mt-auto">
          <p className="text-xs text-[var(--ink-muted)]">
            آخر تحديث:{' '}
            <span className="font-semibold text-[var(--ink-primary)]">
              {draft.updatedAt
                ? new Date(draft.updatedAt).toLocaleDateString('ar')
                : 'الافتراضي'}
            </span>
          </p>
          <button
            type="button"
            onClick={() => {
              logoutAdmin();
              setAuthed(false);
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
          <div>
            <h1 className="font-display text-xl font-bold text-[var(--ink-primary)]">
              {NAV_ITEMS.find((n) => n.id === section)?.label ?? 'نظرة عامة'}
            </h1>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              كل التغييرات تُطبّق فورياً على الموقع كله
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3.5 text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--brand-gold)]"
          >
            <span>معاينة الموقع</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {section === 'overview' && (
          <AdminOverviewSection stats={stats} todayStats={todayStats} />
        )}

        {section === 'reciters' && (
          <AdminRecitersSection
            draft={draft}
            onDraftChange={setDraft}
            persistDraft={persistDraft}
          />
        )}

        {section === 'content' && (
          <AdminContentSection
            draft={draft}
            onDraftChange={setDraft}
            persistDraft={persistDraft}
          />
        )}

        {section === 'footer' && (
          <AdminFooterSection
            draft={draft}
            onDraftChange={setDraft}
            persistDraft={persistDraft}
          />
        )}

        {section === 'reading' && (
          <AdminReadingSection
            draft={draft}
            onDraftChange={setDraft}
            persistDraft={persistDraft}
          />
        )}

        {section === 'studio' && (
          <AdminStudioSection
            draft={draft}
            onDraftChange={setDraft}
            persistDraft={persistDraft}
          />
        )}

        {section === 'appearance' && (
          <AdminAppearanceSection
            draft={draft}
            onDraftChange={setDraft}
            persistDraft={persistDraft}
          />
        )}

        {section === 'backup' && (
          <AdminBackupSection
            draft={draft}
            stats={stats}
            onDraftChange={setDraft}
            onStatsChange={setStats}
            refreshConfig={refreshConfig}
            showToast={showToast}
          />
        )}

        {section === 'security' && <AdminSecuritySection showToast={showToast} />}
      </main>
    </div>
  );
}
