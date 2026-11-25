'use client';

/**
 * useStudioPlayback — synchronized studio audio playback engine.
 * Extracted from StudioView per the 600-line file rule: owns the audio
 * element refs, DSP instance, cache-blob URL bookkeeping, playback state and
 * handlers (play verse at index / toggle / seek) plus the audio event wiring
 * and the unmount cleanup.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCachedVerseAudioBlob } from '@/lib/audio-cache';
import { getReciterAudioUrl } from '@/lib/quran-utils';
import { StudioAudioDsp } from '@/lib/studio-audio-dsp';
import type { QulVerse } from '@/lib/quran-data';
import type { VideoExportSettings } from '@/lib/video-export';

export interface UseStudioPlaybackInput {
  selectedVerses: QulVerse[];
  reciterSlug: string;
  customAudioUrl: string | null;
  exportSettings: VideoExportSettings;
  showToast: (msg: string) => void;
}

export interface UseStudioPlaybackResult {
  studioAudioRef: React.RefObject<HTMLAudioElement | null>;
  previewAudioRef: React.RefObject<HTMLAudioElement | null>;
  dspRef: React.RefObject<StudioAudioDsp | null>;
  fadeStartRef: React.RefObject<number>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  activeIdxInRange: number;
  setActiveIdxInRange: React.Dispatch<React.SetStateAction<number>>;
  audioCurrentTime: number;
  audioDuration: number;
  previewingReciter: string | null;
  setPreviewingReciter: React.Dispatch<React.SetStateAction<string | null>>;
  playVerseAtIndex: (idx: number) => void;
  handleTogglePlay: () => void;
  handleSeekAudio: (timeSec: number) => void;
  handlePreviewReciter: (slug: string) => void;
}

export function useStudioPlayback({
  selectedVerses,
  reciterSlug,
  customAudioUrl,
  exportSettings,
  showToast,
}: UseStudioPlaybackInput): UseStudioPlaybackResult {
  const studioAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const dspRef = useRef<StudioAudioDsp | null>(null);
  const cachedPlayBlobUrlRef = useRef<string | null>(null);
  const fadeStartRef = useRef<number>(0);
  const loadedTrackKeyRef = useRef<string>('');

  const [activeIdxInRange, setActiveIdxInRange] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [previewingReciter, setPreviewingReciter] = useState<string | null>(null);

  const activeVerse = selectedVerses[activeIdxInRange];

  // Synchronized Studio Audio Playback
  const playVerseAtIndex = useCallback(
    (idx: number) => {
      const audio = studioAudioRef.current;
      if (!audio || !selectedVerses.length) return;

      if (previewAudioRef.current && !previewAudioRef.current.paused) {
        previewAudioRef.current.pause();
        setPreviewingReciter(null);
      }

      if (
        exportSettings.audioPreset !== 'natural' ||
        exportSettings.ambientSound !== 'none'
      ) {
        if (!dspRef.current) dspRef.current = new StudioAudioDsp();
        dspRef.current.applyPreset(audio, exportSettings.audioPreset);
      }

      const safeIdx = Math.max(0, Math.min(idx, selectedVerses.length - 1));
      setActiveIdxInRange(safeIdx);
      fadeStartRef.current = performance.now();

      const startAudioPlayback = () => {
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch((err: unknown) => {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setIsPlaying(false);
            if (err instanceof DOMException && err.name === 'NotAllowedError') {
              showToast('المتصفح منع التشغيل التلقائي — اضغط زر التشغيل للمتابعة');
            } else {
              showToast('تعذّر تحميل التلاوة — تحقق من الاتصال أو جرّب قارئاً آخر');
            }
          });
      };

      if (customAudioUrl) {
        const key = `custom:${customAudioUrl}`;
        if (loadedTrackKeyRef.current !== key) {
          audio.src = customAudioUrl;
          loadedTrackKeyRef.current = key;
          audio.load();
        }
        startAudioPlayback();
      } else {
        const verse = selectedVerses[safeIdx];
        const key = `${reciterSlug}:${verse.id}`;
        loadedTrackKeyRef.current = key;

        void getCachedVerseAudioBlob(reciterSlug, verse.id).then((cachedBlob) => {
          if (loadedTrackKeyRef.current !== key) return;
          if (cachedPlayBlobUrlRef.current) {
            URL.revokeObjectURL(cachedPlayBlobUrlRef.current);
            cachedPlayBlobUrlRef.current = null;
          }
          if (cachedBlob) {
            const blobUrl = URL.createObjectURL(cachedBlob);
            cachedPlayBlobUrlRef.current = blobUrl;
            audio.src = blobUrl;
          } else {
            audio.src = getReciterAudioUrl(reciterSlug, verse.id);
          }
          audio.load();
          startAudioPlayback();
        });
      }
    },
    [
      selectedVerses,
      customAudioUrl,
      reciterSlug,
      showToast,
      exportSettings.audioPreset,
      exportSettings.ambientSound,
    ]
  );

  const handleTogglePlay = useCallback(() => {
    const audio = studioAudioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    const expectedKey = customAudioUrl
      ? `custom:${customAudioUrl}`
      : activeVerse
        ? `${reciterSlug}:${activeVerse.id}`
        : '';

    if (
      expectedKey &&
      loadedTrackKeyRef.current === expectedKey &&
      audio.currentTime > 0 &&
      !audio.ended
    ) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          playVerseAtIndex(activeIdxInRange);
        });
    } else {
      playVerseAtIndex(activeIdxInRange);
    }
  }, [isPlaying, customAudioUrl, activeVerse, reciterSlug, activeIdxInRange, playVerseAtIndex]);

  const handleSeekAudio = useCallback((timeSec: number) => {
    const audio = studioAudioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const clamped = Math.max(0, Math.min(audio.duration, timeSec));
    audio.currentTime = clamped;
    setAudioCurrentTime(clamped);
  }, []);

  // Audio element event wiring (time/ended/pause)
  useEffect(() => {
    const audio = studioAudioRef.current;
    if (!audio) return;

    const onTime = () => {
      setAudioCurrentTime(audio.currentTime);
      if (Number.isFinite(audio.duration)) setAudioDuration(audio.duration);
    };
    const onEnded = () => {
      if (!customAudioUrl && activeIdxInRange + 1 < selectedVerses.length) {
        playVerseAtIndex(activeIdxInRange + 1);
      } else {
        setIsPlaying(false);
      }
    };
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
    };
  }, [activeIdxInRange, selectedVerses.length, customAudioUrl, playVerseAtIndex]);

  // Keep Web Audio live preview DSP synced
  useEffect(() => {
    const audio = studioAudioRef.current;
    if (!audio) return;
    if (!isPlaying) {
      dspRef.current?.stopAmbient();
      return;
    }
    if (!dspRef.current) {
      dspRef.current = new StudioAudioDsp();
    }
    if (exportSettings.audioPreset !== 'natural' || exportSettings.ambientSound !== 'none') {
      dspRef.current.applyPreset(audio, exportSettings.audioPreset);
      dspRef.current.syncAmbient(
        audio,
        exportSettings.ambientSound,
        exportSettings.ambientVolume,
        true
      );
    } else {
      dspRef.current.applyPreset(audio, 'natural');
      dspRef.current.stopAmbient();
    }
  }, [
    isPlaying,
    exportSettings.audioPreset,
    exportSettings.ambientSound,
    exportSettings.ambientVolume,
  ]);

  // Cleanup audio & DSP on unmount
  useEffect(() => {
    const pEl = previewAudioRef.current;
    const sEl = studioAudioRef.current;
    return () => {
      pEl?.pause();
      sEl?.pause();
      dspRef.current?.dispose();
      if (cachedPlayBlobUrlRef.current) {
        URL.revokeObjectURL(cachedPlayBlobUrlRef.current);
        cachedPlayBlobUrlRef.current = null;
      }
    };
  }, []);

  // Reciter preview sample playback
  const handlePreviewReciter = useCallback(
    (slug: string) => {
      const pAudio = previewAudioRef.current;
      if (!pAudio) return;
      if (previewingReciter === slug) {
        pAudio.pause();
        setPreviewingReciter(null);
        return;
      }
      if (studioAudioRef.current && !studioAudioRef.current.paused) {
        studioAudioRef.current.pause();
        setIsPlaying(false);
      }
      pAudio.src = getReciterAudioUrl(slug, 1);
      pAudio.onended = () => setPreviewingReciter(null);
      pAudio
        .play()
        .then(() => setPreviewingReciter(slug))
        .catch(() => {
          setPreviewingReciter(null);
          showToast('تعذّر تشغيل عينة القارئ مؤقتاً');
        });
    },
    [previewingReciter, showToast]
  );

  return {
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
  };
}
