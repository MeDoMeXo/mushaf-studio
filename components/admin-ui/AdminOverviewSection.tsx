'use client';

/**
 * AdminOverviewSection — KPI cards, 14-day analytics chart, latest events log.
 * Extracted from AdminView (roadmap item 3): the section is fully derived
 * from (stats, todayStats) and owns only its chart canvas effect.
 */
import React, { useEffect, useRef } from 'react';
import { toArabicDigits } from '@/lib/quran-utils';
import type { SiteStats } from '@/lib/quran-data';

const EVENT_LABELS: Record<string, string> = {
  visits: 'زيارة',
  reads: 'قراءة سورة',
  plays: 'تلاوة صوتية',
  exports: 'تصدير تصميم',
  searches: 'بحث قرآني',
};

export interface AdminOverviewSectionProps {
  stats: SiteStats;
  todayStats: SiteStats['daily'][string];
}

export function AdminOverviewSection({ stats, todayStats }: AdminOverviewSectionProps) {
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw 14-day analytics chart
  useEffect(() => {
    const cv = chartCanvasRef.current;
    if (!cv) return;

    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 640;
    const H = 220;
    cv.width = W * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const days = Object.keys(stats.daily || {}).sort().slice(-14);
    const activeDays =
      days.length > 0 ? days : [new Date().toISOString().slice(0, 10)];

    const series = [
      { key: 'visits' as const, color: '#3B82F6', label: 'زيارات' },
      { key: 'reads' as const, color: '#C9A227', label: 'قراءات' },
      { key: 'plays' as const, color: '#16A34A', label: 'تلاوات' },
      { key: 'exports' as const, color: '#DC2626', label: 'تصديرات' },
    ];

    let maxVal = 1;
    for (const d of activeDays) {
      const bucket = stats.daily[d];
      if (!bucket) continue;
      for (const s of series) {
        maxVal = Math.max(maxVal, bucket[s.key] || 0);
      }
    }

    const pad = { t: 16, r: 16, b: 42, l: 42 };
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;
    const colW = plotW / activeDays.length;
    const yFor = (v: number) => pad.t + plotH * (1 - v / maxVal);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.fillStyle = '#8A9A92';
    ctx.font = '11px Cairo, sans-serif';
    ctx.textAlign = 'center';

    for (let step = 0; step <= 4; step++) {
      const val = Math.round((maxVal * step) / 4);
      const yy = yFor(val);
      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(W - pad.r, yy);
      ctx.stroke();
      ctx.fillText(String(val), pad.l - 18, yy + 4);
    }

    activeDays.forEach((d, idx) => {
      const x0 = pad.l + idx * colW;
      const bw = Math.min(12, Math.max(4, colW / (series.length + 1) - 2));
      const groupW = series.length * bw + (series.length - 1) * 2;
      const startX = x0 + (colW - groupW) / 2;

      series.forEach((s, si) => {
        const v = stats.daily[d]?.[s.key] ?? 0;
        const barH = plotH * (v / maxVal);
        ctx.fillStyle = s.color;
        ctx.fillRect(
          startX + si * (bw + 2),
          yFor(v),
          bw,
          v > 0 ? Math.max(3, barH) : 0
        );
      });

      ctx.fillStyle = '#8A9A92';
      ctx.fillText(d.slice(5), x0 + colW / 2, H - 20);
    });

    // Legend
    let lx = pad.l;
    ctx.textAlign = 'left';
    series.forEach((s) => {
      ctx.fillStyle = s.color;
      ctx.fillRect(lx, H - 10, 8, 8);
      ctx.fillStyle = '#8A9A92';
      ctx.fillText(s.label, lx + 12, H - 2);
      lx += 68;
    });
  }, [stats]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: 'إجمالي الزيارات', total: stats.visits, today: todayStats.visits },
          { label: 'سور مقروءة', total: stats.reads, today: todayStats.reads },
          { label: 'تلاوات مشغّلة', total: stats.plays, today: todayStats.plays },
          { label: 'تصاميم مصدّرة', total: stats.exports, today: todayStats.exports },
          { label: 'عمليات البحث', total: stats.searches, today: todayStats.searches },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-4"
          >
            <p className="text-xs font-semibold text-[var(--ink-muted)]">
              {kpi.label}
            </p>
            <p className="mt-1.5 text-2xl font-extrabold text-[var(--ink-primary)] tabular-nums">
              {toArabicDigits(kpi.total)}
            </p>
            <p className="mt-1 text-xs text-[var(--brand-emerald)] dark:text-[#E6C75A]">
              اليوم: {toArabicDigits(kpi.today)}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
        <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
          النشاط خلال آخر ١٤ يوماً
        </h2>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
          إحصائيات محلية مسجلة من استخدام القارئ والاستوديو
        </p>
        <canvas
          ref={chartCanvasRef}
          className="mt-4 block h-[220px] w-full"
        />
      </div>

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
        <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
          أحدث الأحداث
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--ink-muted)]">
                <th className="py-2 font-semibold">الوقت</th>
                <th className="py-2 font-semibold">الحدث</th>
                <th className="py-2 font-semibold">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {stats.log.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="py-6 text-center text-xs text-[var(--ink-muted)]"
                  >
                    لا توجد أحداث مسجلة بعد — تصفح السور أو صدّر تصميماً من الاستوديو.
                  </td>
                </tr>
              ) : (
                stats.log.slice(0, 10).map((row, idx) => (
                  <tr
                    key={`${row.t}-${idx}`}
                    className="border-b border-[var(--border-hairline)] last:border-none"
                  >
                    <td className="py-2.5 text-xs text-[var(--ink-muted)] tabular-nums">
                      {new Date(row.t).toLocaleString('ar', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </td>
                    <td className="py-2.5 text-xs font-semibold text-[var(--brand-emerald)] dark:text-[#E6C75A]">
                      {EVENT_LABELS[row.e] ?? row.e}
                    </td>
                    <td className="py-2.5 font-mono text-xs text-[var(--ink-primary)]">
                      {row.d || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
