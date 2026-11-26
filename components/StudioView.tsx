'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStudioCanvas } from '@/hooks/use-studio-canvas';
import { useImageActions } from '@/hooks/use-image-actions';
import { useStudioMedia } from '@/hooks/use-studio-media';
import { useStudioMisc } from '@/hooks/use-studio-misc';
import { useStudioPlayback } from '@/hooks/use-studio-playback';
import { useStudioShortcuts } from '@/hooks/use-studio-shortcuts';
import { useTemplateActions } from '@/hooks/use-template-actions';
import { useVersesSource } from '@/hooks/use-verses-source';
import { buildInitialStudioState } from '@/lib/studio-initial-state';
import { useSearchParams } from 'next/navigation';
import {
  RECITERS,
  type SavedCustomTemplate,
  type StudioState,
} from '@/lib/quran-data';
import { bumpStat, loadCustomTemplates } from '@/lib/storage';
import {
  canRedoHistory,
  canUndoHistory,
  createStudioHistory,
  pushStudioHistory,
  replaceStudioPresent,
  shallowEqualStudioObject,
  type StudioHistory,
} from '@/lib/studio-history';
import {
  DEFAULT_VIDEO_EXPORT_SETTINGS,
  EXPORT_QUALITY_PRESETS,
  type VideoExportSettings,
} from '@/lib/video-export';
import { getStudioActiveReciters } from '@/lib/reciter-filter';
import { useApp } from './AppProvider';
import { StudioExportModal } from './StudioExportModal';
import { StudioCommandBar } from './studio-ui/StudioCommandBar';
import { StudioCommandPalette } from './studio-ui/StudioCommandPalette';
import {
  StudioDesignInspector,
  type StyleTab,
  type TemplateCategory,
} from './studio-ui/StudioDesignInspector';
import {
  StudioRecitationPanel,
  type ReciterFilter,
} from './studio-ui/StudioRecitationPanel';
import { StudioStagePanel } from './studio-ui/StudioStagePanel';
import { StudioFullscreenDialog } from './studio-ui/StudioFullscreenDialog';

export function StudioView() {
  const searchParams = useSearchParams();
  const { config, showToast } = useApp();

  const initialSurah = Number(searchParams.get('surah') || 1);
  const initialFrom = Number(searchParams.get('from') || 1);
  const initialTo = Number(
    searchParams.get('to') || (searchParams.get('from') ? initialFrom : 3)
  );
  const initialReciter = searchParams.get('reciter');
  const initialTranslation = Number(searchParams.get('translation') || 0) || null;

  const [history, setHistory] = useState<StudioHistory<StudioState>>(() =>
    createStudioHistory(
      buildInitialStudioState(config, initialSurah, initialFrom, initialTo, initialReciter, initialTranslation),
      40
    )
  );
  const state = history.present;
  const canUndo = canUndoHistory(history);
  const canRedo = canRedoHistory(history);

  const commitState = useCallback(
    (updater: StudioState | ((prev: StudioState) => StudioState)) => {
      setHistory((prev) => {
        const next = typeof updater === 'function' ? updater(prev.present) : updater;
        return pushStudioHistory(prev, next, shallowEqualStudioObject);
      });
    },
    []
  );

  const replaceStateSilent = useCallback(
    (updater: (prev: StudioState) => StudioState) => {
      setHistory((prev) => replaceStudioPresent(prev, updater(prev.present)));
    },
    []
  );

  const handlePatchState = useCallback(
    (patch: Partial<StudioState>) => {
      commitState((prev) => ({ ...prev, ...patch }));
    },
    [commitState]
  );

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [activeQualityPresetId, setActiveQualityPresetId] = useState<string>('reels_1080');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);
  const bgVideoFileInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  const [styleTab, setStyleTab] = useState<StyleTab>('templates');
  const [templateCat, setTemplateCat] = useState<TemplateCategory>('all');
  const [reciterQuery, setReciterQuery] = useState('');
  const [reciterFilter, setReciterFilter] = useState<ReciterFilter>('all');
  const [customTemplates, setCustomTemplates] = useState<SavedCustomTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [exportSettings, setExportSettings] = useState<VideoExportSettings>(DEFAULT_VIDEO_EXPORT_SETTINGS);
  const [cacheRetryNonce, setCacheRetryNonce] = useState(0);

  const channelWatermark = config.studio.watermark || config.siteName;

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setCustomTemplates(loadCustomTemplates());
    });
    return () => { active = false; };
  }, []);

  // Keep Admin-configured channel watermark synced after client config hydration
  const prevWatermarkSyncRef = useRef(channelWatermark);
  useEffect(() => {
    if (prevWatermarkSyncRef.current === channelWatermark) return;
    prevWatermarkSyncRef.current = channelWatermark;
    replaceStateSilent((prev) => ({ ...prev, watermark: channelWatermark }));
  }, [channelWatermark, replaceStateSilent]);

  // ── Decomposed logic lives in hooks/ (600-line file rule) ──
  const {
    chapters,
    chapterVerses,
    loadingVerses,
    loadingTranslation,
    currentChapter,
    selectedVerses,
  } = useVersesSource({
    state,
    replaceStateSilent,
    onSurahSwitch: () => setActiveIdxInRange(0),
  });
  const {
    bgVideoUrl,
    bgVideoFile,
    bgVideoName,
    bgVideoReady,
    setBgVideoReady,
    bgVideoPlaying,
    setBgVideoPlaying,
    customAudioUrl,
    customAudioFile,
    customAudioName,
    setCustomAudioUrl,
    setCustomAudioFile,
    setCustomAudioName,
    bgVideoElRef,
    handleBgFileUpload,
    handleBgVideoUpload,
    handleRemoveBgVideo,
    handleSelectBgLibrary,
    handleAudioFileUpload,
  } = useStudioMedia({ commitState, showToast });
  const {
    studioAudioRef,
    previewAudioRef,
    dspRef,
    fadeStartRef,
    isPlaying,
    setIsPlaying,
    activeIdxInRange,
    setActiveIdxInRange,
    audioCurrentTime,
    audioDuration,
    previewingReciter,
    setPreviewingReciter,
    playVerseAtIndex,
    handleTogglePlay,
    handleSeekAudio,
    handlePreviewReciter,
  } = useStudioPlayback({
    selectedVerses,
    reciterSlug: state.reciter,
    customAudioUrl,
    exportSettings,
    showToast,
  });
  const {
    updateExportSettings,
    handleUndo,
    handleRedo,
    handleSelectSurah,
    handleSelectReciter,
    previewTargetDims,
    previewEstimatedSizeMb,
  } = useStudioMisc({
    state,
    selectedVersesCount: selectedVerses.length,
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
  });

  const activeVerse =
    selectedVerses[Math.min(activeIdxInRange, Math.max(0, selectedVerses.length - 1))] ??
    chapterVerses[0] ??
    null;

  const activeReciterObj = useMemo(() => {
    const list = getStudioActiveReciters(config.customReciters, config.disabledReciters);
    return list.find((r) => r.slug === state.reciter) ?? list[0] ?? RECITERS[0];
  }, [config.customReciters, config.disabledReciters, state.reciter]);

  const {
    renderOnce,
    triggerTransitionPreview,
    audioCache,
    animateBgVideo,
    bgImgElRef,
  } = useStudioCanvas({
    state,
    selectedVerses,
    activeVerse,
    activeIdxInRange,
    isPlaying,
    currentChapter,
    reciterName: activeReciterObj.name,
    canvasRef,
    fullscreenCanvasRef,
    fullscreenOpen,
    bgVideoElRef,
    fadeStartRef,
    studioAudioRef,
    dspRef,
    bgVideoUrl,
    bgVideoPlaying,
    bgVideoReady,
    customAudioUrl,
    exportModalOpen,
    cacheRetryNonce,
    exportSettings,
  });
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
    const next = Math.min(selectedVerses.length - 1, activeIdxInRange + 1);
    setActiveIdxInRange(next);
    if (isPlaying) playVerseAtIndex(next);
  }, [activeIdxInRange, isPlaying, playVerseAtIndex, replaceStateSilent, selectedVerses.length, setActiveIdxInRange, state.coverMode]);

  useStudioShortcuts({
    commandOpen, exportModalOpen, fullscreenOpen, canvasRef, fullscreenCanvasRef, setCommandOpen,
    handleUndo, handleRedo, handleTogglePlay: handleStageTogglePlay, onPrevSlide: handlePrevSlide, onNextSlide: handleNextSlide,
  });
  const { handleAspectSelect, handleApplyTemplate, handleReset, handleExportImage, handleCopyImage } =
    useImageActions({
      state,
      activeVerse,
      surahName: currentChapter?.name_arabic,
      reciterName: activeReciterObj.name,
      config,
      canvasRef,
      renderOnce,
      commitState,
      showToast,
    });
  const {
    handleSaveCustomTemplate,
    handleQuickSaveDesign,
    handleDeleteCustomTemplate,
    handleExportTemplates,
    handleImportTemplates,
  } = useTemplateActions({
    state,
    surahName: currentChapter?.name_arabic,
    customTemplates,
    newTemplateName,
    setCustomTemplates,
    setNewTemplateName,
    showToast,
  });
  const handleOpenFullscreen = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (!isPlaying && !animateBgVideo) renderOnce(0);
    setFullscreenOpen(true);
  }, [animateBgVideo, isPlaying, renderOnce]);

  const attachFullscreenCanvas = useCallback((node: HTMLCanvasElement | null) => {
    fullscreenCanvasRef.current = node;
    const src = canvasRef.current;
    if (!node || !src || src.width <= 0 || src.height <= 0) return;
    node.width = src.width;
    node.height = src.height;
    const ctx = node.getContext('2d');
    if (ctx) { ctx.clearRect(0, 0, node.width, node.height); ctx.drawImage(src, 0, 0); }
  }, []);

  const handleOpenExportModal = useCallback(() => {
    studioAudioRef.current?.pause();
    previewAudioRef.current?.pause();
    setIsPlaying(false);
    setPreviewingReciter(null);
    setExportModalOpen(true);
  }, [previewAudioRef, setIsPlaying, setPreviewingReciter, studioAudioRef]);

  return (
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-3 sm:px-6 xl:min-h-0 xl:overflow-hidden">
        {/* Pro Top Studio Command Ribbon */}
        <StudioCommandBar
          surahId={state.surah}
          surahName={currentChapter?.name_arabic ?? 'الفاتحة'}
          fromAyah={state.fromAyah}
          toAyah={state.toAyah}
          selectedCount={selectedVerses.length}
          reciterName={activeReciterObj.name}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onReset={handleReset}
          onOpenCommandPalette={() => setCommandOpen(true)}
          onExportPng={() => handleExportImage('png')}
          onExportVideo={handleOpenExportModal}
        />

        {/* 3-Pane Creative Workbench Grid */}
        <div className="grid grid-cols-1 items-start gap-3.5 xl:min-h-0 xl:flex-1 xl:grid-cols-[336px_minmax(0,1fr)_364px] xl:items-stretch xl:overflow-hidden">
          {/* Right Rail (RTL start): Recitation & Verses */}
          <StudioRecitationPanel
            state={state}
            chapters={chapters}
            totalChapterVerses={chapterVerses.length}
            selectedVersesCount={selectedVerses.length}
            customAudioUrl={customAudioUrl}
            customAudioName={customAudioName}
            reciterQuery={reciterQuery}
            reciterFilter={reciterFilter}
            previewingReciter={previewingReciter}
            audioFileInputRef={audioFileInputRef}
            onSelectSurah={handleSelectSurah}
            onChangeRange={(fromAyah, toAyah) => {
              setActiveIdxInRange(0);
              commitState((p) => ({ ...p, fromAyah, toAyah }));
            }}
            onChangeTextSource={(textSource) => handlePatchState({ textSource })}
            onChangeTranslation={(translationId) => handlePatchState({ translationId })}
            loadingTranslation={loadingTranslation}
            onAudioFileUpload={handleAudioFileUpload}
            onRemoveCustomAudio={() => {
              setCustomAudioUrl(null);
              setCustomAudioFile(null);
              setCustomAudioName('');
            }}
            onReciterQueryChange={setReciterQuery}
            onReciterFilterChange={setReciterFilter}
            onSelectReciter={handleSelectReciter}
            onPreviewReciter={handlePreviewReciter}
          />

          {/* Center Focal Anchor: Live Darkroom Artboard Stage & Transport */}
          <StudioStagePanel
            state={state}
            canvasRef={canvasRef}
            activeVerse={activeVerse}
            selectedVerses={selectedVerses}
            activeIdxInRange={activeIdxInRange}
            loadingVerses={loadingVerses}
            bgVideoReady={bgVideoReady}
            customAudioUrl={customAudioUrl}
            audioCache={audioCache}
            isPlaying={isPlaying}
            audioCurrentTime={audioCurrentTime}
            audioDuration={audioDuration}
            activeReciterName={activeReciterObj.name}
            exportSettings={exportSettings}
            previewEstimatedSizeMb={previewEstimatedSizeMb}
            onAspectSelect={handleAspectSelect}
            onCustomDimensionsChange={(dims) => handlePatchState(dims)}
            onOpenFullscreen={handleOpenFullscreen}
            onRetryCache={() => setCacheRetryNonce((n) => n + 1)}
            onSelectCoverSlide={handleSelectCoverSlide}
            onSelectVerseIndex={handleSelectVerseIndex}
            onTogglePlay={handleStageTogglePlay}
            onPrevVerse={handlePrevSlide}
            onNextVerse={handleNextSlide}
            onSeekAudio={handleSeekAudio}
            onOpenExportModal={handleOpenExportModal}
            onExportImage={handleExportImage}
            onQuickSaveDesign={handleQuickSaveDesign}
            onCopyImage={handleCopyImage}
          />

          {/* Left Rail (RTL end): Design, Ornaments, Typography & Audio Inspector */}
          <StudioDesignInspector
            state={state}
            styleTab={styleTab}
            templateCat={templateCat}
            customTemplates={customTemplates}
            newTemplateName={newTemplateName}
            bgVideoUrl={bgVideoUrl}
            bgVideoFile={bgVideoFile}
            bgVideoName={bgVideoName}
            bgVideoReady={bgVideoReady}
            bgVideoPlaying={bgVideoPlaying}
            exportSettings={exportSettings}
            activeQualityPresetId={activeQualityPresetId}
            previewTargetDims={previewTargetDims}
            previewEstimatedSizeMb={previewEstimatedSizeMb}
            bgFileInputRef={bgFileInputRef}
            bgVideoFileInputRef={bgVideoFileInputRef}
            onStyleTabChange={setStyleTab}
            onTemplateCatChange={setTemplateCat}
            onPatchState={handlePatchState}
            onApplyTemplate={handleApplyTemplate}
            onNewTemplateNameChange={setNewTemplateName}
            onSaveCustomTemplate={handleSaveCustomTemplate}
            onApplyCustomTemplate={(ct) => {
              commitState((p) => ({ ...p, ...ct.patch, activeTemplateId: undefined }));
              showToast(`تم تطبيق «${ct.name}»`);
            }}
            onDeleteCustomTemplate={handleDeleteCustomTemplate}
            onExportTemplates={handleExportTemplates}
            onImportTemplates={(file) => void handleImportTemplates(file)}
            onBgFileUpload={handleBgFileUpload}
            onBgVideoUpload={handleBgVideoUpload}
            onToggleBgVideoPlaying={() => setBgVideoPlaying((v) => !v)}
            onRemoveBgVideo={handleRemoveBgVideo}
            onSelectBgLibrary={handleSelectBgLibrary}
            onUpdateExportSettings={updateExportSettings}
            onSelectQualityPreset={(presetId) => {
              setActiveQualityPresetId(presetId);
              const found = EXPORT_QUALITY_PRESETS.find((p) => p.id === presetId);
              if (found) updateExportSettings(found.patch);
            }}
            onAspectSelect={handleAspectSelect}
            onOpenExportModal={handleOpenExportModal}
          />
        </div>

        {/* cmdk Quick Command Palette (Ctrl+K / Cmd+K) */}
        <StudioCommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          chapters={chapters}
          activeSurah={state.surah}
          activeReciter={state.reciter}
          activeTranslationId={state.translationId}
          activeTemplateId={state.activeTemplateId}
          canUndo={canUndo}
          canRedo={canRedo}
          onSelectSurah={handleSelectSurah}
          onSelectReciter={handleSelectReciter}
          onSelectTranslation={(translationId) => {
            commitState((p) => ({
              ...p,
              translationId,
              textSource: p.textSource === 'uthmani' ? 'both' : p.textSource,
            }));
            showToast('تم تحديث الترجمة المعتمدة في التصميم');
          }}
          onSelectTemplate={handleApplyTemplate}
          onSelectAspect={handleAspectSelect}
          onExportVideo={handleOpenExportModal}
          onExportPng={() => handleExportImage('png')}
          onOpenFullscreen={handleOpenFullscreen}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onReset={handleReset}
        />

        <StudioFullscreenDialog
          open={fullscreenOpen}
          onOpenChange={setFullscreenOpen}
          attachCanvasRef={attachFullscreenCanvas}
          surahName={currentChapter?.name_arabic ?? 'الفاتحة'}
          reciterName={activeReciterObj.name}
          coverMode={Boolean(state.coverMode)}
          selectedVerses={selectedVerses}
          activeIdxInRange={activeIdxInRange}
          isPlaying={isPlaying}
          audioCurrentTime={audioCurrentTime}
          audioDuration={audioDuration}
          exportSettings={exportSettings}
          onUpdateExportSettings={updateExportSettings}
          onTriggerTransitionPreview={triggerTransitionPreview}
          onSelectCoverSlide={handleSelectCoverSlide}
          onSelectVerseIndex={handleSelectVerseIndex}
          onTogglePlay={handleStageTogglePlay}
          onPrevSlide={handlePrevSlide}
          onNextSlide={handleNextSlide}
          onSeekAudio={handleSeekAudio}
        />

        <StudioExportModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          onOpenFullscreen={handleOpenFullscreen}
          studioState={state}
          exportSettings={exportSettings}
          onUpdateExportSettings={updateExportSettings}
          selectedVerses={selectedVerses}
          surahName={currentChapter?.name_arabic ?? 'الفاتحة'}
          surahNameEn={currentChapter?.name_simple ?? null}
          isFullSurah={
            state.fromAyah === 1 &&
            state.toAyah === (currentChapter?.verses_count ?? state.toAyah)
          }
          reciterName={activeReciterObj.name}
          onAspectSelect={handleAspectSelect}
          getBgImageEl={() => bgImgElRef.current}
          bgVideoFile={bgVideoFile}
          bgVideoName={bgVideoName}
          customAudioFile={customAudioFile}
          customAudioName={customAudioName}
          audioCache={audioCache}
          onExportSuccess={(filename) => {
            bumpStat(
              'exports',
              `video:${exportSettings.format}:${state.surah}:${state.fromAyah}-${state.toAyah}`
            );
            showToast(`تم تصدير وتنزيل الفيديو: ${filename}`);
          }}
          onErrorToast={showToast}
        />

        <audio ref={studioAudioRef} crossOrigin="anonymous" preload="auto" />
        <audio ref={previewAudioRef} crossOrigin="anonymous" preload="none" />
        <video
          ref={bgVideoElRef}
          src={bgVideoUrl ?? undefined}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          onLoadedData={() => {
            setBgVideoReady(true);
            const vid = bgVideoElRef.current;
            if (vid) {
              vid.playbackRate = state.bgVideoSpeed || 1;
              if (bgVideoPlaying) vid.play().catch(() => {});
            }
            renderOnce(0);
          }}
          className="hidden"
        />
      </main>
  );
}
