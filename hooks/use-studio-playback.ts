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
  /** فاصل صمت بين الآيات أثناء معاينة الاستوديو (ثوانٍ، 0..5) — من StudioState. */
  playbackGapSec?: number;
  /** حدود الآيات داخل الملف الصوتي المرفوع (ثوانٍ بداية كل آية) — تُستخدم
   *  للتقدّم التلقائي بين الآيات أثناء المعاينة ومزامنة الكاريوكي. */
  customVerseBounds?: number[];
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
  playbackGapSec = 0,
  customVerseBounds,
  showToast,
}: UseStudioPlaybackInput): UseStudioPlaybackResult {
  const studioAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const dspRef = useRef<StudioAudioDsp | null>(null);
  const cachedPlayBlobUrlRef = useRef<string | null>(null);
  const fadeStartRef = useRef<number>(0);
  const loadedTrackKeyRef = useRef<string>('');
  // مؤقّت فاصل الآيات (وقفة صمت اختيارية قبل الآية التالية) — يُلغى عند أي
  // تنقّل يدوي/إيقاف حتى لا ينتقل التشغيل بعد تدخّل المستخدم.
  const gapTimerRef = useRef<number | null>(null);
  const clearPendingGap = useCallback(() => {
    if (gapTimerRef.current !== null) {
      window.clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
  }, []);

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

      // تشغيل جديد = إلغاء أي فاصل معلّق بين الآيات (تدخّل المستخدم)
      clearPendingGap();

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
      clearPendingGap,
      exportSettings.audioPreset,
      exportSettings.ambientSound,
    ]
  );

  const handleTogglePlay = useCallback(() => {
    const audio = studioAudioRef.current;
    if (!audio) return;
    if (isPlaying) {
      clearPendingGap();
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
  }, [isPlaying, customAudioUrl, activeVerse, reciterSlug, activeIdxInRange, playVerseAtIndex, clearPendingGap]);

  const handleSeekAudio = useCallback((timeSec: number) => {
    clearPendingGap();
    const audio = studioAudioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const clamped = Math.max(0, Math.min(audio.duration, timeSec));
    audio.currentTime = clamped;
    setAudioCurrentTime(clamped);
  }, [clearPendingGap]);

  // Audio element event wiring (time/ended/pause)
  useEffect(() => {
    const audio = studioAudioRef.current;
    if (!audio) return;

    const onTime = () => {
      setAudioCurrentTime(audio.currentTime);
      if (Number.isFinite(audio.duration)) setAudioDuration(audio.duration);

      // تقدّم تلقائي بين الآيات مع الملف الصوتي المرفوع: عندما يتجاوز موضع
      // التشغيل بداية الآية التالية (وفق الحدود المضبوطة) ننتقل إليها
      // فوراً — نفس سلوك الملفات الفردية لكن على خط الحدود الزمني.
      if (
        customAudioUrl &&
        Array.isArray(customVerseBounds) &&
        customVerseBounds.length === selectedVerses.length &&
        isPlaying
      ) {
        const t = audio.currentTime;
        let target = activeIdxInRange;
        for (let i = customVerseBounds.length - 1; i >= 0; i--) {
          if (t >= customVerseBounds[i]) {
            target = i;
            break;
          }
        }
        if (target !== activeIdxInRange) {
          fadeStartRef.current = performance.now();
          setActiveIdxInRange(target);
        }
      }
    };
    const onEnded = () => {
      if (!customAudioUrl && activeIdxInRange + 1 < selectedVerses.length) {
        // فاصل صمت اختياري بعد انتهاء الآية وقبل التالية: مؤقّت قابل للإلغاء
        // عند أي إيقاف/تنقّل يدوي (clearPendingGap أعلاه) — لا يؤثر على ملف
        // الصوت المخصص الكامل (لا حدود آيات فيه أصلاً).
        const gapMs = Math.max(0, Math.min(5, playbackGapSec)) * 1000;
        if (gapMs > 0) {
          gapTimerRef.current = window.setTimeout(() => {
            gapTimerRef.current = null;
            playVerseAtIndex(activeIdxInRange + 1);
          }, gapMs);
          return;
        }
        playVerseAtIndex(activeIdxInRange + 1);
      } else {
        setIsPlaying(false);
      }
    };
    const onPause = () => {
      clearPendingGap();
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
    };
  }, [activeIdxInRange, selectedVerses.length, customAudioUrl, customVerseBounds, isPlaying, playVerseAtIndex, playbackGapSec, clearPendingGap]);

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
    clearPendingGap();
    return () => {
      clearPendingGap();
      pEl?.pause();
      sEl?.pause();
      dspRef.current?.dispose();
      if (cachedPlayBlobUrlRef.current) {
        URL.revokeObjectURL(cachedPlayBlobUrlRef.current);
        cachedPlayBlobUrlRef.current = null;
      }
    };
  }, [clearPendingGap]);

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
        clearPendingGap();
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
    [previewingReciter, showToast, clearPendingGap]
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
