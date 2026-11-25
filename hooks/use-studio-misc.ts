'use client';

/**
 * useStudioMisc — selection/undo/export-preview handlers for StudioView.
 * Extracted per the 600-line file rule.
 */
import { useCallback, useMemo } from 'react';
import type { StudioState } from '@/lib/quran-data';
import {
  canRedoHistory,
  canUndoHistory,
  redoStudioHistory,
  undoStudioHistory,
  type StudioHistory as StudioHistoryType,
} from '@/lib/studio-history';
import { estimateVideoExportDurationSec } from '@/lib/surah-cover';
import {
  estimateExportSizeMb,
  resolveExportDimensions,
  type VideoExportSettings,
} from '@/lib/video-export';

export interface UseStudioMiscInput {
  state: StudioState;
  selectedVersesCount: number;
  exportSettings: VideoExportSettings;
  setExportSettings: React.Dispatch<React.SetStateAction<VideoExportSettings>>;
  setHistory: React.Dispatch<React.SetStateAction<StudioHistoryType<import('@/lib/quran-data').StudioState>>>;
  commitState: (
    updater: StudioState | ((prev: StudioState) => StudioState)
  ) => void;
  studioAudioRef: React.RefObject<HTMLAudioElement | null>;
  setIsPlaying: (v: boolean) => void;
  setActiveIdxInRange: (v: number) => void;
  setCustomAudioUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setCustomAudioFile: React.Dispatch<React.SetStateAction<File | null>>;
  setCustomAudioName: React.Dispatch<React.SetStateAction<string>>;
  showToast: (msg: string) => void;
}

export interface UseStudioMiscResult {
  updateExportSettings: (patch: Partial<VideoExportSettings>) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleSelectSurah: (nextId: number) => void;
  handleSelectReciter: (slug: string) => void;
  previewTargetDims: { width: number; height: number };
  previewEstimatedSizeMb: number;
}

export function useStudioMisc(input: UseStudioMiscInput): UseStudioMiscResult {
  const {
    state,
    selectedVersesCount,
    exportSettings,
    setExportSettings,
    setHistory,
    commitState,
    studioAudioRef,
    setIsPlaying,
    setActiveIdxInRange,
    setCustomAudioUrl,
    setCustomAudioFile,
    setCustomAudioName,
    showToast,
  } = input;

  const updateExportSettings = useCallback((patch: Partial<VideoExportSettings>) => {
    setExportSettings((prev) => ({ ...prev, ...patch }));
  }, [setExportSettings]);

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (!canUndoHistory(prev)) return prev;
      return undoStudioHistory(prev);
    });
    showToast('تم التراجع عن آخر تعديل');
  }, [setHistory, showToast]);

  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      if (!canRedoHistory(prev)) return prev;
      return redoStudioHistory(prev);
    });
    showToast('تمت إعادة التعديل');
  }, [setHistory, showToast]);

  const handleSelectSurah = useCallback(
    (nextId: number) => {
      setIsPlaying(false);
      studioAudioRef.current?.pause();
      setActiveIdxInRange(0);
      commitState((p) => ({
        ...p,
        surah: nextId,
        fromAyah: 1,
        toAyah: 3,
      }));
    },
    [commitState, setIsPlaying, studioAudioRef, setActiveIdxInRange]
  );

  const handleSelectReciter = useCallback(
    (slug: string) => {
      commitState((p) => ({ ...p, reciter: slug }));
      setCustomAudioUrl(null);
      setCustomAudioFile(null);
      setCustomAudioName('');
    },
    [commitState, setCustomAudioUrl, setCustomAudioFile, setCustomAudioName]
  );

  const previewTargetDims = useMemo(
    () => resolveExportDimensions(state.width, state.height, exportSettings.resolution),
    [state.width, state.height, exportSettings.resolution]
  );

  const previewEstimatedSizeMb = useMemo(
    () =>
      estimateExportSizeMb({
        durationSec: estimateVideoExportDurationSec({
          verseCount: selectedVersesCount,
          verseGapSec: exportSettings.verseGapSec,
          includeIntroCover: exportSettings.includeIntroCover !== false,
        }),
        width: previewTargetDims.width,
        height: previewTargetDims.height,
        fps: exportSettings.fps,
        quality: exportSettings.quality,
        audioBitrateKbps: exportSettings.audioBitrate,
      }),
    [selectedVersesCount, exportSettings, previewTargetDims]
  );

  return {
    updateExportSettings,
    handleUndo,
    handleRedo,
    handleSelectSurah,
    handleSelectReciter,
    previewTargetDims,
    previewEstimatedSizeMb,
  };
}
