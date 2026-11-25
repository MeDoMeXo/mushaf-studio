'use client';

/**
 * useImageActions — canvas image export/copy + template/aspect handlers.
 * Extracted from StudioView per the 600-line file rule.
 */
import { useCallback } from 'react';
import {
  ASPECT_PRESETS,
  type AspectPresetId,
  type SiteConfig,
  type StudioTemplate,
} from '@/lib/quran-data';
import { bumpStat } from '@/lib/storage';
import { buildInitialStudioState } from '@/lib/studio-initial-state';
import { buildArabicCoverFilename } from '@/lib/video-share';

export interface UseImageActionsInput {
  state: import('@/lib/quran-data').StudioState;
  activeVerse: import('@/lib/quran-data').QulVerse | null;
  surahName?: string;
  reciterName?: string;
  config: SiteConfig;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  renderOnce: (timeSec?: number) => void;
  commitState: (
    updater: import('@/lib/quran-data').StudioState | ((prev: import('@/lib/quran-data').StudioState) => import('@/lib/quran-data').StudioState)
  ) => void;
  showToast: (msg: string) => void;
}

export interface UseImageActionsResult {
  handleAspectSelect: (presetId: AspectPresetId) => void;
  handleApplyTemplate: (tpl: StudioTemplate) => void;
  handleReset: () => void;
  handleExportImage: (format: 'png' | 'jpeg') => void;
  handleCopyImage: () => Promise<void>;
}

export function useImageActions({
  state,
  activeVerse,
  surahName,
  reciterName,
  config,
  canvasRef,
  renderOnce,
  commitState,
  showToast,
}: UseImageActionsInput): UseImageActionsResult {
  const handleAspectSelect = useCallback(
    (presetId: AspectPresetId) => {
      if (presetId === 'custom') {
        commitState((p) => ({ ...p, aspect: 'custom' }));
        return;
      }
      const found = ASPECT_PRESETS.find((a) => a.id === presetId);
      if (!found) return;
      commitState((p) => ({
        ...p,
        aspect: found.id,
        width: found.width,
        height: found.height,
      }));
    },
    [commitState]
  );

  const handleApplyTemplate = useCallback(
    (tpl: StudioTemplate) => {
      commitState((p) => {
        if (tpl.id === 'unified-channel-cover') {
          return { ...p, coverMode: true };
        }
        return {
          ...p,
          ...tpl.patch,
          activeTemplateId: tpl.id,
        };
      });
      showToast(`تم تطبيق قالب «${tpl.name}»`);
    },
    [commitState, showToast]
  );

  const handleReset = useCallback(() => {
    commitState(
      buildInitialStudioState(
        config,
        state.surah,
        state.fromAyah,
        state.toAyah,
        state.reciter,
        state.translationId
      )
    );
    showToast('تمت إعادة ضبط التنسيق الافتراضي');
  }, [
    commitState,
    config,
    state.surah,
    state.fromAyah,
    state.toAyah,
    state.reciter,
    state.translationId,
    showToast,
  ]);

  const handleExportImage = useCallback(
    (format: 'png' | 'jpeg') => {
      renderOnce(0);
      const cv = canvasRef.current;
      if (!cv) return;
      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const dataUrl = cv.toDataURL(mime, 0.94);
      const ayahNum = activeVerse?.verse_key.split(':')[1] ?? state.fromAyah;
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = buildArabicCoverFilename({
        surahName,
        ayahNumber: ayahNum,
        reciterName,
        format,
        isIntroCover: Boolean(state.coverMode),
      });
      document.body.appendChild(a);
      a.click();
      a.remove();
      bumpStat('exports', `${state.surah}:${state.fromAyah}`);
      showToast(`تم تنزيل التصميم بصيغة ${format.toUpperCase()}`);
    },
    [renderOnce, state.surah, state.fromAyah, state.coverMode, activeVerse, surahName, reciterName, showToast, canvasRef]
  );

  const handleCopyImage = useCallback(async () => {
    renderOnce(0);
    const cv = canvasRef.current;
    if (!cv) return;
    try {
      const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'));
      if (blob && navigator.clipboard && 'ClipboardItem' in window) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('تم نسخ الصورة إلى الحافظة');
      } else {
        showToast('النسخ غير مدعوم في هذا المتصفح — استخدم تنزيل PNG');
      }
    } catch {
      showToast('تعذّر نسخ الصورة إلى الحافظة');
    }
  }, [renderOnce, showToast, canvasRef]);

  return {
    handleAspectSelect,
    handleApplyTemplate,
    handleReset,
    handleExportImage,
    handleCopyImage,
  };
}
