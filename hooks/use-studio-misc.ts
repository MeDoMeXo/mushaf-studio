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
  replaceStateSilent: (updater: (prev: StudioState) => StudioState) => void;
  studioAudioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  activeIdxInRange: number;
  setIsPlaying: (v: boolean) => void;
  setActiveIdxInRange: (v: number) => void;
  handleTogglePlay: () => void;
  playVerseAtIndex: (idx: number) => void;
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
  handleStageTogglePlay: () => void;
  handleSelectCoverSlide: () => void;
  handleSelectVerseIndex: (idx: number) => void;
  handlePrevSlide: () => void;
  handleNextSlide: () => void;
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
    replaceStateSilent,
    studioAudioRef,
    isPlaying,
    activeIdxInRange,
    setIsPlaying,
    setActiveIdxInRange,
    handleTogglePlay,
    playVerseAtIndex,
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

  const handleStageTogglePlay = useCallback(() => {
    if (!isPlaying && state.coverMode) replaceStateSilent((prev) => ({ ...prev, coverMode: false }));
    handleTogglePlay();
  }, [handleTogglePlay, isPlaying, replaceStateSilent, state.coverMode]);

  const handleSelectCoverSlide = useCallback(() => {
    studioAudioRef.current?.pause();
    setIsPlaying(false);
    if (!state.coverMode) replaceStateSilent((p) => ({ ...p, coverMode: true }));
  }, [replaceStateSilent, setIsPlaying, state.coverMode, studioAudioRef]);

  const handleSelectVerseIndex = useCallback(
    (idx: number) => {
      if (state.coverMode) replaceStateSilent((p) => ({ ...p, coverMode: false }));
      setActiveIdxInRange(idx);
      if (isPlaying) playVerseAtIndex(idx);
    },
    [isPlaying, playVerseAtIndex, replaceStateSilent, setActiveIdxInRange, state.coverMode]
  );

  const handlePrevSlide = useCallback(() => {
    if (!state.coverMode && activeIdxInRange === 0) {
      studioAudioRef.current?.pause();
      setIsPlaying(false);
      replaceStateSilent((p) => ({ ...p, coverMode: true }));
      return;
    }
    const prev = Math.max(0, activeIdxInRange - 1);
    setActiveIdxInRange(prev);
    if (isPlaying) playVerseAtIndex(prev);
  }, [activeIdxInRange, isPlaying, playVerseAtIndex, replaceStateSilent, setActiveIdxInRange, setIsPlaying, state.coverMode, studioAudioRef]);

  const handleNextSlide = useCallback(() => {
    if (state.coverMode) {
      replaceStateSilent((p) => ({ ...p, coverMode: false }));
      setActiveIdxInRange(0);
      if (isPlaying) playVerseAtIndex(0);
      return;
    }
    const next = Math.min(selectedVersesCount - 1, activeIdxInRange + 1);
    setActiveIdxInRange(next);
    if (isPlaying) playVerseAtIndex(next);
  }, [activeIdxInRange, isPlaying, playVerseAtIndex, replaceStateSilent, selectedVersesCount, setActiveIdxInRange, state.coverMode]);

  return {
    updateExportSettings,
    handleUndo,
    handleRedo,
    handleSelectSurah,
    handleSelectReciter,
    handleStageTogglePlay,
    handleSelectCoverSlide,
    handleSelectVerseIndex,
    handlePrevSlide,
    handleNextSlide,
    previewTargetDims,
    previewEstimatedSizeMb,
  };
}
