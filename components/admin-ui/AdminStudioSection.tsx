'use client';

/**
 * AdminStudioSection — studio defaults form + live canvas preview.
 * Extracted from AdminView (600-line rule): the preview-drawing effect moved
 * here together with the canvas ref it needs.
 */
import React, { useEffect, useRef } from 'react';
import {
  STUDIO_FONTS,
  STUDIO_GRADIENTS,
  type SiteConfig,
} from '@/lib/quran-data';
import { StudioSlider, StudioSwitch } from '../studio-ui/StudioControls';
import { AdminStudioSectionsCard } from './AdminStudioSectionsCard';

export interface AdminStudioSectionProps {
  draft: SiteConfig;
  onDraftChange: (draft: SiteConfig) => void;
  persistDraft: (next: SiteConfig, msg: string) => void;
}

export function AdminStudioSection({
  draft,
  onDraftChange,
  persistDraft,
}: AdminStudioSectionProps) {
  const studioPreviewRef = useRef<HTMLCanvasElement | null>(null);

  // Draw live Studio defaults preview canvas
  useEffect(() => {
    const cv = studioPreviewRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W = 420;
    const H = 420;
    cv.width = W;
    cv.height = H;

    const gradPreset =
      STUDIO_GRADIENTS[draft.studio.bgIdx] ?? STUDIO_GRADIENTS[0];
    const g = ctx.createLinearGradient(0, 0, W, H);
    gradPreset.stops.forEach(([pct, col]) => g.addColorStop(pct / 100, col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(201,162,39,0.75)';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, W - 32, H - 32);

    const fontPx = Math.round(draft.studio.fontSize * 0.34);
    ctx.font = `${fontPx}px "${draft.studio.fontFamily}", serif`;
    ctx.fillStyle = draft.studio.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText('ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ', W / 2, H / 2 - 22);
    ctx.fillText('ٱلْحَىُّ ٱلْقَيُّومُ', W / 2, H / 2 + 28);

    if (draft.studio.footer) {
      ctx.font = '600 16px "Reem Kufi", Cairo, sans-serif';
      ctx.fillStyle = '#E6C75A';
      ctx.fillText('﴿ سورة البقرة · ٢٥٥ ﴾', W / 2, H - 36);
    }
    if (draft.studio.watermark) {
      ctx.font = '11px Cairo, sans-serif';
      ctx.fillStyle = 'rgba(250,247,240,0.6)';
      ctx.textAlign = 'left';
      ctx.direction = 'ltr';
      ctx.fillText(draft.studio.watermark, 24, H - 20);
    }
  }, [draft.studio]);

  return (
    <div className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5 space-y-4">
        <h2 className="font-display text-lg font-bold text-[var(--ink-primary)]">
          افتراضيات استوديو التصميم
        </h2>

        <div>
          <label
            htmlFor="st-def-font"
            className="block text-xs font-bold text-[var(--ink-muted)]"
          >
            عائلة الخط
          </label>
          <select
            id="st-def-font"
            value={draft.studio.fontFamily}
            onChange={(e) =>
              onDraftChange({
                ...draft,
                studio: { ...draft.studio, fontFamily: e.target.value },
              })
            }
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)]"
          >
            {STUDIO_FONTS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="st-def-bg"
            className="block text-xs font-bold text-[var(--ink-muted)]"
          >
            الخلفية الافتراضية
          </label>
          <select
            id="st-def-bg"
            value={draft.studio.bgIdx}
            onChange={(e) =>
              onDraftChange({
                ...draft,
                studio: {
                  ...draft.studio,
                  bgIdx: Number(e.target.value),
                },
              })
            }
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)]"
          >
            {STUDIO_GRADIENTS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <StudioSlider
          id="st-def-size"
          label="حجم الخط الافتراضي"
          valueDisplay={`${draft.studio.fontSize}px`}
          min={48}
          max={140}
          step={2}
          value={draft.studio.fontSize}
          onChange={(val) =>
            onDraftChange({
              ...draft,
              studio: {
                ...draft.studio,
                fontSize: val,
              },
            })
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="st-def-color"
              className="block text-xs font-bold text-[var(--ink-muted)]"
            >
              لون النص
            </label>
            <input
              id="st-def-color"
              type="color"
              value={draft.studio.color}
              onChange={(e) =>
                onDraftChange({
                  ...draft,
                  studio: { ...draft.studio, color: e.target.value },
                })
              }
              className="mt-1.5 h-10 w-full cursor-pointer rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-1"
            />
          </div>
          <div>
            <label
              htmlFor="st-def-wm"
              className="block text-xs font-bold text-[var(--ink-muted)]"
            >
              العلامة المائية
            </label>
            <input
              id="st-def-wm"
              type="text"
              value={draft.studio.watermark}
              onChange={(e) =>
                onDraftChange({
                  ...draft,
                  studio: { ...draft.studio, watermark: e.target.value },
                })
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-primary)]"
            />
            <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
              يُدرج تلقائياً في أسفل غلاف البداية والتصميمات في الاستوديو.
            </p>
          </div>
        </div>

        <StudioSwitch
          id="st-def-footer"
          label="إظهار اسم السورة ورقم الآية أسفل التصميم"
          checked={draft.studio.footer}
          onCheckedChange={(checked) =>
            onDraftChange({
              ...draft,
              studio: { ...draft.studio, footer: checked },
            })
          }
        />

        <button
          type="button"
          onClick={() =>
            persistDraft(draft, 'تم حفظ افتراضيات الاستوديو')
          }
          className="rounded-lg bg-[var(--brand-emerald)] px-5 py-2.5 text-sm font-bold text-[#FAF7F0] transition-opacity hover:opacity-90"
        >
          حفظ افتراضيات الاستوديو
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)]">
        <div className="border-b border-[var(--border-hairline)] px-5 py-3.5">
          <h2 className="font-display text-base font-bold text-[var(--ink-primary)]">
            معاينة حية لافتراضيات الاستوديو
          </h2>
        </div>
        <div className="studio-stage-grid grid place-items-center p-6">
          <canvas
            ref={studioPreviewRef}
            className="aspect-square w-full max-w-[360px] rounded-xl shadow-xl ring-1 ring-black/15 dark:ring-white/10"
          />
        </div>
      </div>
    </div>

    <AdminStudioSectionsCard
      draft={draft}
      onDraftChange={onDraftChange}
      persistDraft={persistDraft}
    />
    </div>
  );
}
