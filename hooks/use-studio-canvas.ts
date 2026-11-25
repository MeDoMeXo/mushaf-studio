'use client';

/**
 * useStudioCanvas — background media + live canvas render loop.
 * Extracted from StudioView per the 600-line file rule: owns the bg image
 * element ref, the audio preload cache bookkeeping, and the render/animation
 * effects (fonts-settle paint, playback raf loop, bg video sync).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  preloadVersesToBrowserCache,
  type AudioCacheProgress,
} from '@/lib/audio-cache';
import { drawStudioFrame } from '@/lib/studio-renderer';
import type { QulVerse, QulChapter, StudioState } from '@/lib/quran-data';
import { StudioAudioDsp } from '@/lib/studio-audio-dsp';
import { calculateTransitionProgress, type VideoExportSettings } from '@/lib/video-export';

export interface AudioCacheRecord {
  scopeKey: string;
  progress: AudioCacheProgress;
}

function syncCanvasMirror(
  src: HTMLCanvasElement,
  dst: HTMLCanvasElement | null | undefined
): void {
  if (!dst || src.width <= 0 || src.height <= 0) return;
  if (dst.width !== src.width || dst.height !== src.height) {
    dst.width = src.width;
    dst.height = src.height;
  }
  const dstCtx = dst.getContext('2d');
  if (dstCtx) {
    dstCtx.clearRect(0, 0, dst.width, dst.height);
    dstCtx.drawImage(src, 0, 0);
  }
}

export interface UseStudioCanvasInput {
  state: StudioState;
  selectedVerses: QulVerse[];
  activeVerse: QulVerse | null;
  activeIdxInRange: number;
  isPlaying: boolean;
  currentChapter: QulChapter | null;
  reciterName: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  fullscreenCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  fullscreenOpen?: boolean;
  bgVideoElRef: React.RefObject<HTMLVideoElement | null>;
  fadeStartRef: React.RefObject<number>;
  studioAudioRef: React.RefObject<HTMLAudioElement | null>;
  dspRef: React.RefObject<StudioAudioDsp | null>;
  bgVideoUrl: string | null;
  bgVideoPlaying: boolean;
  bgVideoReady: boolean;
  customAudioUrl: string | null;
  exportModalOpen: boolean;
  cacheRetryNonce: number;
  exportSettings: VideoExportSettings;
  onAudioCacheRecord?: (record: AudioCacheRecord | null) => void;
}

export interface UseStudioCanvasResult {
  renderOnce: (timeSec?: number) => void;
  triggerTransitionPreview: () => void;
  audioCache: AudioCacheProgress;
  animateBgVideo: boolean;
  bgImgElRef: React.RefObject<HTMLImageElement | null>;
}

export function useStudioCanvas({
  state,
  selectedVerses,
  activeVerse,
  activeIdxInRange,
  isPlaying,
  currentChapter,
  reciterName,
  canvasRef,
  fullscreenCanvasRef,
  fullscreenOpen = false,
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
  onAudioCacheRecord,
}: UseStudioCanvasInput): UseStudioCanvasResult {
  const bgImgElRef = useRef<HTMLImageElement | null>(null);
  const isManualNavigatingRef = useRef(false);
  const [bgImgRevision, setBgImgRevision] = useState(0);
  const [audioCacheRecord, setAudioCacheRecord] = useState<AudioCacheRecord | null>(null);

  // Stable primitive key representing selected reciter + verse IDs for automatic browser audio caching
  const selectedVerseIdsKey = useMemo(
    () => selectedVerses.map((v) => v.id).join(','),
    [selectedVerses]
  );
  const hasCustomAudio = Boolean(customAudioUrl);
  const cacheScopeKey =
    hasCustomAudio || !selectedVerseIdsKey ? '' : `${state.reciter}:${selectedVerseIdsKey}`;

  const audioCache: AudioCacheProgress = useMemo(() => {
    if (!cacheScopeKey) {
      return { status: 'idle', cached: 0, total: 0, failed: 0, fromCacheHits: 0 };
    }
    if (audioCacheRecord?.scopeKey === cacheScopeKey) {
      return audioCacheRecord.progress;
    }
    return {
      status: 'loading',
      cached: 0,
      total: selectedVerses.length,
      failed: 0,
      fromCacheHits: 0,
    };
  }, [cacheScopeKey, audioCacheRecord, selectedVerses.length]);

  // Preload selected verse recitations into browser Cache Storage (pauses during exportModalOpen)
  useEffect(() => {
    if (!cacheScopeKey || !selectedVerseIdsKey || exportModalOpen) return;

    const verseIds = selectedVerseIdsKey
      .split(',')
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (!verseIds.length) return;

    const controller = new AbortController();
    void preloadVersesToBrowserCache({
      reciterSlug: state.reciter,
      verseIds,
      signal: controller.signal,
      onProgress: (progress) => {
        if (!controller.signal.aborted) {
          const record = { scopeKey: cacheScopeKey, progress };
          setAudioCacheRecord(record);
          onAudioCacheRecord?.(record);
        }
      },
    }).catch(() => {});

    return () => {
      controller.abort();
    };
  }, [cacheScopeKey, state.reciter, selectedVerseIdsKey, cacheRetryNonce, exportModalOpen, onAudioCacheRecord]);

  // Preload background image when uploaded or generated via AI
  useEffect(() => {
    if (!state.bgImage) {
      bgImgElRef.current = null;
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      bgImgElRef.current = img;
      setBgImgRevision((r) => r + 1);
    };
    img.onerror = () => {
      if (cancelled) return;
      bgImgElRef.current = null;
    };
    img.src = state.bgImage;
    return () => {
      cancelled = true;
    };
  }, [state.bgImage]);

  // Clean up background video object URL on change/unmount
  useEffect(() => {
    return () => {
      if (bgVideoUrl && bgVideoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(bgVideoUrl);
      }
    };
  }, [bgVideoUrl]);

  // Sync background video playback speed & play/pause state
  useEffect(() => {
    const vid = bgVideoElRef.current;
    if (!vid || !bgVideoUrl) return;
    vid.playbackRate = state.bgVideoSpeed || 1;
    if (state.bgType === 'video' && bgVideoPlaying) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [bgVideoUrl, state.bgType, state.bgVideoSpeed, bgVideoPlaying, bgVideoElRef]);

  // Render Canvas
  const renderOnce = useCallback(
    (timeSec = 0) => {
      const cv = canvasRef.current;
      if (!cv) return;
      if (cv.width !== state.width || cv.height !== state.height) {
        cv.width = state.width;
        cv.height = state.height;
      }
      const ctx = cv.getContext('2d');
      if (!ctx) return;

      const ayahNum = activeVerse ? activeVerse.verse_key.split(':')[1] : String(state.fromAyah);
      const elapsedSinceFade = performance.now() - fadeStartRef.current;
      const { progress, fadeAlpha } = calculateTransitionProgress({
        elapsedMs: elapsedSinceFade,
        durationMs: exportSettings.transitionDurationMs,
        isPlaying,
        isManualNav: isManualNavigatingRef.current,
      });

      drawStudioFrame(ctx, {
        state,
        verseText: activeVerse?.text_uthmani ?? 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
        translationText: activeVerse?.translations?.[0]?.text ?? '',
        surahName: currentChapter?.name_arabic ?? 'الفاتحة',
        ayahLabel: `آية ${ayahNum}`,
        ayahNumber: ayahNum,
        reciterName,
        bgImageEl: bgImgElRef.current,
        bgVideoEl: bgVideoElRef.current,
        timeSec,
        fadeAlpha,
        transitionType: exportSettings.transition,
        transitionProgress: progress,
        activeVerseIndex: activeIdxInRange,
        totalVerses: selectedVerses.length,
      });

      syncCanvasMirror(cv, fullscreenCanvasRef?.current);
    },
    [
      state,
      activeVerse,
      currentChapter,
      reciterName,
      isPlaying,
      activeIdxInRange,
      selectedVerses.length,
      canvasRef,
      fullscreenCanvasRef,
      bgVideoElRef,
      fadeStartRef,
      exportSettings.transition,
      exportSettings.transitionDurationMs,
    ]
  );

  // Trigger render when dependencies or fonts settle
  useEffect(() => {
    let cancelled = false;
    const ensureFontsAndPaint = async () => {
      try {
        await Promise.all([
          document.fonts.load(`${state.fontWeight} ${state.fontSize}px "${state.fontFamily}"`),
          document.fonts.load(`${state.metaFontWeight} 32px "Reem Kufi"`),
          document.fonts.load(`${state.metaFontWeight} 24px "Cairo"`),
        ]);
      } catch {
        // fallback font
      }
      if (!cancelled) renderOnce(0);
    };
    ensureFontsAndPaint();
    return () => {
      cancelled = true;
    };
  }, [
    renderOnce,
    state.fontFamily,
    state.fontSize,
    state.fontWeight,
    state.metaFontWeight,
    bgVideoReady,
    bgImgRevision,
  ]);

  const animateBgVideo = state.bgType === 'video' && bgVideoReady && bgVideoPlaying;

  // Ensure fullscreen canvas receives the current static frame on open when idle
  useEffect(() => {
    if (fullscreenOpen && !isPlaying && !animateBgVideo) {
      renderOnce(0);
    }
  }, [fullscreenOpen, isPlaying, animateBgVideo, renderOnce]);

  // Adaptive animated loop while playing recitation OR looping background video
  useEffect(() => {
    if (!isPlaying && !animateBgVideo) return;
    let rafId = 0;
    const t0 = performance.now();
    let lastDraw = 0;
    let lastCostMs = 0;
    const minFrameMs = isPlaying ? 33 : 42;
    const tick = (now: number) => {
      const targetInterval = Math.max(minFrameMs, Math.min(250, Math.ceil(lastCostMs * 1.4)));
      if (now - lastDraw >= targetInterval) {
        const start = performance.now();
        lastDraw = now;
        renderOnce((now - t0) / 1000);
        lastCostMs = performance.now() - start;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, animateBgVideo, renderOnce]);

  // Smooth live transition animation when flipping verses manually on the canvas while audio is paused
  const triggerTransitionPreview = useCallback(() => {
    fadeStartRef.current = performance.now();
    isManualNavigatingRef.current = true;
    const transDuration = Math.max(250, Number(exportSettings.transitionDurationMs) || 750);
    let rafId = 0;
    const t0 = performance.now();

    const tick = (now: number) => {
      const elapsed = now - t0;
      renderOnce(elapsed / 1000);
      if (elapsed < transDuration) {
        rafId = requestAnimationFrame(tick);
      } else {
        isManualNavigatingRef.current = false;
        renderOnce(0);
      }
    };

    rafId = requestAnimationFrame(tick);
  }, [exportSettings.transitionDurationMs, renderOnce, fadeStartRef]);

  useEffect(() => {
    if (isPlaying || animateBgVideo) {
      isManualNavigatingRef.current = false;
      return;
    }
    triggerTransitionPreview();
  }, [
    activeIdxInRange,
    state.coverMode,
    isPlaying,
    animateBgVideo,
    triggerTransitionPreview,
  ]);

  // Keep unused props typed for compatibility (DSP is synced inside useStudioPlayback)
  void studioAudioRef;
  void dspRef;
  void exportSettings;

  return { renderOnce, triggerTransitionPreview, audioCache, animateBgVideo, bgImgElRef };
}
