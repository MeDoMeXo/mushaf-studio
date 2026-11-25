'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Globe2,
  Loader2,
  Mic,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import type { ReciterOption, SiteConfig } from '@/lib/quran-data';
import { getAllAdminReciters, isReciterVerseSynced } from '@/lib/reciter-filter';
import {
  checkAllRecitersHealth,
  probeSingleReciterHealth,
  resolveProbeUrlForReciter,
  type ReciterHealthResult,
} from '@/lib/reciter-health';
import { stripArabicDiacritics, toArabicDigits } from '@/lib/quran-utils';
import { AddReciterModal } from './AddReciterModal';

export interface AdminRecitersSectionProps {
  draft: SiteConfig;
  onDraftChange: (draft: SiteConfig) => void;
  persistDraft: (next: SiteConfig, msg: string) => void;
}

type ReciterFilterTab =
  | 'all'
  | 'active'
  | 'disabled'
  | 'custom'
  | 'murattal'
  | 'mujawwad'
  | 'warsh'
  | 'muallim';

const FILTER_TABS: { id: ReciterFilterTab; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'active', label: 'النشطة' },
  { id: 'disabled', label: 'المعطلة' },
  { id: 'custom', label: 'المخصصة' },
  { id: 'murattal', label: 'مرتل' },
  { id: 'mujawwad', label: 'مجود' },
  { id: 'warsh', label: 'ورش' },
  { id: 'muallim', label: 'معلم' },
];

export function AdminRecitersSection({
  draft,
  onDraftChange,
  persistDraft,
}: AdminRecitersSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<ReciterFilterTab>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Health probe tracking
  const [isBatchProbing, setIsBatchProbing] = useState(false);
  const [singleProbingSlug, setSingleProbingSlug] = useState<string | null>(null);
  const [probeResults, setProbeResults] = useState<Record<string, ReciterHealthResult>>({});

  // Audio preview playback
  const [previewingSlug, setPreviewingSlug] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const allReciters = useMemo(() => {
    return getAllAdminReciters(draft.customReciters, draft.disabledReciters);
  }, [draft.customReciters, draft.disabledReciters]);

  const activeCount = allReciters.filter((r) => !r.isDisabled).length;
  const disabledCount = allReciters.filter((r) => r.isDisabled).length;
  const customCount = allReciters.filter((r) => r.isCustom).length;

  const filteredReciters = useMemo(() => {
    const q = stripArabicDiacritics(searchQuery).toLowerCase().trim();
    return allReciters.filter((r) => {
      if (filterTab === 'active' && r.isDisabled) return false;
      if (filterTab === 'disabled' && !r.isDisabled) return false;
      if (filterTab === 'custom' && !r.isCustom) return false;
      if (
        filterTab !== 'all' &&
        filterTab !== 'active' &&
        filterTab !== 'disabled' &&
        filterTab !== 'custom' &&
        r.style !== filterTab
      ) {
        return false;
      }
      if (!q) return true;
      const ar = stripArabicDiacritics(r.name).toLowerCase();
      const co = stripArabicDiacritics(r.country || '').toLowerCase();
      return ar.includes(q) || r.slug.toLowerCase().includes(q) || co.includes(q);
    });
  }, [allReciters, searchQuery, filterTab]);

  // Batch probe all reciters
  const handleRunBatchProbe = async () => {
    setIsBatchProbing(true);
    try {
      const report = await checkAllRecitersHealth(8, 8000, fetch, allReciters);
      const mapped: Record<string, ReciterHealthResult> = {};
      for (const res of report.results) {
        mapped[res.slug] = res;
      }
      setProbeResults(mapped);
    } catch {
      // Non-fatal
    } finally {
      setIsBatchProbing(false);
    }
  };

  // Single probe for one reciter
  const handleProbeSingle = async (reciter: ReciterOption) => {
    setSingleProbingSlug(reciter.slug);
    try {
      const res = await probeSingleReciterHealth(reciter);
      setProbeResults((prev) => ({ ...prev, [reciter.slug]: res }));
    } catch {
      // Non-fatal
    } finally {
      setSingleProbingSlug(null);
    }
  };

  // Audio preview toggle
  const handleToggleAudioPreview = (reciter: ReciterOption) => {
    if (previewingSlug === reciter.slug) {
      if (audioRef.current) audioRef.current.pause();
      setPreviewingSlug(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }
    const url = resolveProbeUrlForReciter(reciter);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().then(() => setPreviewingSlug(reciter.slug)).catch(() => {
      setPreviewingSlug(null);
    });
    audio.onended = () => setPreviewingSlug(null);
  };

  // Toggle reciter disabled state
  const handleToggleDisabled = (slug: string) => {
    const current = draft.disabledReciters ?? [];
    const isCurrentlyDisabled = current.includes(slug);
    const nextDisabled = isCurrentlyDisabled
      ? current.filter((s) => s !== slug)
      : [...current, slug];
    const next = { ...draft, disabledReciters: nextDisabled };
    onDraftChange(next);
    persistDraft(
      next,
      isCurrentlyDisabled ? 'تم تفعيل القارئ بنجاح' : 'تم تعطيل القارئ بنجاح'
    );
  };

  // Add custom reciter
  const handleAddCustomReciter = (reciter: ReciterOption) => {
    const currentCustoms = draft.customReciters ?? [];
    const nextCustoms = [reciter, ...currentCustoms.filter((r) => r.slug !== reciter.slug)];
    const next = { ...draft, customReciters: nextCustoms };
    onDraftChange(next);
    persistDraft(next, `تمت إضافة القارئ ${reciter.name} بنجاح`);
  };

  // Delete custom reciter
  const handleDeleteCustomReciter = (slug: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا القارئ المخصص؟')) return;
    const currentCustoms = draft.customReciters ?? [];
    const nextCustoms = currentCustoms.filter((r) => r.slug !== slug);
    const next = { ...draft, customReciters: nextCustoms };
    onDraftChange(next);
    persistDraft(next, 'تم حذف القارئ المخصص بنجاح');
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Top Banner Stats & Controls */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-4 shadow-sm">
          <span className="text-xs font-semibold text-[var(--ink-muted)]">إجمالي القرّاء</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--ink-primary)]">
            {toArabicDigits(allReciters.length)}
          </div>
          <span className="text-[10px] text-[var(--ink-muted)]">موزعون عبر 3 مكتبات عالمية</span>
        </div>

        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-4 shadow-sm">
          <span className="text-xs font-semibold text-[var(--ink-muted)]">القرّاء النشطون</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {toArabicDigits(activeCount)}
          </div>
          <span className="text-[10px] text-[var(--ink-muted)]">يظهرون في الاستوديو والقارئ</span>
        </div>

        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-4 shadow-sm">
          <span className="text-xs font-semibold text-[var(--ink-muted)]">القرّاء المعطلون</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-amber-500">
            {toArabicDigits(disabledCount)}
          </div>
          <span className="text-[10px] text-[var(--ink-muted)]">مخفيون من واجهات الزوار</span>
        </div>

        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-4 shadow-sm">
          <span className="text-xs font-semibold text-[var(--ink-muted)]">القرّاء المخصصون</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--brand-gold)]">
            {toArabicDigits(customCount)}
          </div>
          <span className="text-[10px] text-[var(--ink-muted)]">أضيفوا يدوياً عبر الإدارة</span>
        </div>
      </div>

      {/* Primary Actions Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div>
          <h2 className="font-display text-base font-bold text-[var(--ink-primary)]">
            إدارة القرّاء والمكتبات الصوتية
          </h2>
          <p className="text-xs text-[var(--ink-muted)]">
            التحكم الشامل في مصادر التلاوة، فحص سرعة واستجابة الخوادم، وإضافة قرّاء جدد
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRunBatchProbe}
            disabled={isBatchProbing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand-gold)] bg-[var(--brand-gold)]/10 px-4 py-2 text-xs font-bold text-[var(--brand-gold)] hover:bg-[var(--brand-gold)] hover:text-[#1F1705] disabled:opacity-50 transition-all shadow-sm"
          >
            {isBatchProbing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>جاري فحص الـ {toArabicDigits(allReciters.length)} خادماً...</span>
              </>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5" />
                <span>فحص شامل لجميع الخوادم ⚡</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-emerald)] px-4 py-2 text-xs font-bold text-[#FAF7F0] shadow-sm hover:opacity-90 active:scale-95 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>إضافة قارئ جديد +</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم القارئ، الرواية، أو الدولة..."
            className="h-9 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] pe-3 ps-8 text-xs font-medium text-[var(--ink-primary)] placeholder-[var(--ink-muted)] focus:border-[var(--brand-gold)] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 overflow-x-auto rounded-xl bg-[var(--surface-subtle)] p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                filterTab === tab.id
                  ? 'bg-[var(--brand-gold)] text-[#1F1705]'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reciters Table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] shadow-sm">
        <div className="studio-scroll max-h-[520px] overflow-auto">
          <table className="w-full text-right text-xs">
            <thead className="sticky top-0 z-10 border-b border-[var(--border-hairline)] bg-[var(--surface-subtle)]/90 backdrop-blur-sm text-[var(--ink-muted)]">
              <tr>
                <th className="px-4 py-3 font-bold">القارئ الكريم</th>
                <th className="px-3 py-3 font-bold">الأسلوب والرواية</th>
                <th className="px-3 py-3 font-bold">المصدر الصوتي</th>
                <th className="px-3 py-3 font-bold">الجودة</th>
                <th className="px-3 py-3 font-bold">حالة الاتصال بالخادم</th>
                <th className="px-4 py-3 font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-hairline)]/60">
              {filteredReciters.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[var(--ink-muted)]">
                    لا توجد نتائج مطابقة لبحثك
                  </td>
                </tr>
              ) : (
                filteredReciters.map((r) => {
                  const probe = probeResults[r.slug];
                  const isProbing = singleProbingSlug === r.slug;
                  const isPlaying = previewingSlug === r.slug;

                  return (
                    <tr
                      key={r.slug}
                      className={`transition-colors hover:bg-[var(--surface-subtle)]/40 ${
                        r.isDisabled ? 'opacity-60 bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Name & Country */}
                      <td className="px-4 py-3 font-semibold text-[var(--ink-primary)]">
                        <div className="flex items-center gap-2">
                          <span>{r.name}</span>
                          {r.isCustom && (
                            <span className="rounded-full bg-[var(--brand-gold)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--brand-gold)]">
                              مخصص
                            </span>
                          )}
                        </div>
                        <span className="block text-[10px] text-[var(--ink-muted)]">
                          {r.country || 'العالم الإسلامي'} · {r.slug}
                        </span>
                      </td>

                      {/* Style */}
                      <td className="px-3 py-3 font-medium text-[var(--ink-muted)]">
                        {r.styleLabel}
                      </td>

                      {/* Source & Timing Sync Badge */}
                      <td className="px-3 py-3 font-medium text-[var(--ink-muted)]">
                        <div>
                          {r.source === 'everyayah'
                            ? 'EveryAyah'
                            : r.source === 'mp3quran'
                            ? 'MP3Quran CDN'
                            : 'Islamic Network'}
                        </div>
                        {isReciterVerseSynced(r) ? (
                          <span className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            متزامن آية بآية ⚡
                          </span>
                        ) : (
                          <span
                            className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400"
                            title="تلاوة سورة كاملة متصلة"
                          >
                            سورة كاملة
                          </span>
                        )}
                      </td>

                      {/* Bitrate */}
                      <td className="px-3 py-3 font-mono text-[var(--brand-emerald)] dark:text-[#E6C75A]">
                        {toArabicDigits(r.bitrate)}kbps
                      </td>

                      {/* Live Ping Status Badge */}
                      <td className="px-3 py-3">
                        {probe ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              probe.ok
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/10 text-rose-500'
                            }`}
                          >
                            {probe.ok ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                <span>متصل ({toArabicDigits(probe.ms)}ms)</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3 w-3" />
                                <span>تعذر الاتصال</span>
                              </>
                            )}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--ink-muted)]/70">
                            لم يُفحص بعد
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Test Probe Button */}
                          <button
                            type="button"
                            onClick={() => handleProbeSingle(r)}
                            disabled={isProbing}
                            title="اختبار الاتصال بالخادم الصوتي"
                            className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-gold)] hover:text-[var(--brand-gold)] disabled:opacity-40"
                          >
                            {isProbing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Wifi className="h-3 w-3" />
                            )}
                          </button>

                          {/* Audio Preview Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleAudioPreview(r)}
                            title={isPlaying ? 'إيقاف الاستماع' : 'استماع عينة من الفاتحة'}
                            className={`grid h-7 w-7 place-items-center rounded-lg border transition-colors ${
                              isPlaying
                                ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)] text-[#1F1705]'
                                : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                            }`}
                          >
                            {isPlaying ? (
                              <Square className="h-3 w-3" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </button>

                          {/* Toggle Active / Disabled Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleDisabled(r.slug)}
                            title={r.isDisabled ? 'تفعيل القارئ' : 'تعطيل القارئ مؤقتاً'}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                              r.isDisabled
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                                : 'bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-amber-500'
                            }`}
                          >
                            {r.isDisabled ? 'تفعيل ✓' : 'تعطيل'}
                          </button>

                          {/* Delete Custom Reciter */}
                          {r.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomReciter(r.slug)}
                              title="حذف هذا القارئ المخصص"
                              className="grid h-7 w-7 place-items-center rounded-lg text-rose-500/70 transition-colors hover:bg-rose-500/15 hover:text-rose-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Reciter Modal */}
      <AddReciterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddReciter={handleAddCustomReciter}
      />
    </div>
  );
}
