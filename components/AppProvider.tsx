'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Toaster, toast } from 'sonner';
import {
  CONFIG_DEFAULTS,
  RECITERS,
  type QulVerse,
  type SiteConfig,
} from '@/lib/quran-data';
import {
  getReaderPlaybackAudioUrl,
  resolveReciterOption,
  toggleFavoriteReciterSlug,
} from '@/lib/reciter-filter';
import {
  bumpStat,
  CONFIG_EVENT,
  loadFavoriteReciters,
  loadSiteConfig,
  saveFavoriteReciters,
  saveLastRead,
  STORAGE_KEYS,
} from '@/lib/storage';
import {
  resolveTeacherStep,
  sanitizeTeacherMode,
  TEACHER_MODE_DEFAULTS,
  type TeacherModeState,
} from '@/lib/teacher-mode';
import { StudioTooltipProvider } from './studio-ui/StudioControls';

export interface ActiveAudioState {
  visible: boolean;
  playing: boolean;
  buffering: boolean;
  surahId: number;
  surahName: string;
  verses: QulVerse[];
  currentIndex: number;
  currentVerseKey: string | null;
  currentTime: number;
  duration: number;
  reciter: string;
  /** Teacher mode (roadmap item 6): repetition badge + waiting-for-student flag. */
  teacher: TeacherModeState;
  verseRepeatIndex: number;
  waitingForStudent: boolean;
}

export interface ReaderSurahContext {
  surahId: number;
  surahName: string;
  verses: QulVerse[];
}

interface AppContextValue {
  config: SiteConfig;
  refreshConfig: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  audioState: ActiveAudioState;
  activeSurahContext: ReaderSurahContext | null;
  registerSurahContext: (ctx: ReaderSurahContext | null) => void;
  favoriteReciters: string[];
  toggleFavoriteReciter: (slug: string) => void;
  reciterPickerOpen: boolean;
  setReciterPickerOpen: (open: boolean) => void;
  playSurahVerses: (
    verses: QulVerse[],
    surahId: number,
    surahName: string,
    startVerseKey?: string,
    overrideReciter?: string
  ) => void;
  togglePlayPause: () => void;
  nextVerse: () => void;
  prevVerse: () => void;
  /** Teacher mode (roadmap item 6): enable/disable + repeat settings. */
  setTeacherMode: (patch: Partial<TeacherModeState>) => void;
  seekAudio: (timeSec: number) => void;
  setReciter: (slug: string) => void;
  closePlayer: () => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(CONFIG_DEFAULTS);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const versesRef = useRef<QulVerse[]>([]);
  const surahRef = useRef<{ id: number; name: string }>({ id: 0, name: '' });
  const indexRef = useRef<number>(0);
  const reciterRef = useRef<string>(RECITERS[0].slug);

  const [favoriteReciters, setFavoriteReciters] = useState<string[]>([]);
  const [reciterPickerOpen, setReciterPickerOpen] = useState(false);
  const [activeSurahContext, setActiveSurahContext] =
    useState<ReaderSurahContext | null>(null);

  const registerSurahContext = useCallback((ctx: ReaderSurahContext | null) => {
    setActiveSurahContext(ctx);
  }, []);

  const [audioState, setAudioState] = useState<ActiveAudioState>({
    visible: false,
    playing: false,
    buffering: false,
    surahId: 0,
    surahName: '',
    verses: [],
    currentIndex: 0,
    currentVerseKey: null,
    currentTime: 0,
    duration: 0,
    reciter: RECITERS[0].slug,
    teacher: TEACHER_MODE_DEFAULTS,
    verseRepeatIndex: 0,
    waitingForStudent: false,
  });

  // Teacher mode (roadmap item 6) — persisted so a drill survives reloads.
  const teacherModeRef = useRef<TeacherModeState>(TEACHER_MODE_DEFAULTS);
  const verseRepeatRef = useRef<number>(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.TEACHER_MODE);
      if (raw) teacherModeRef.current = sanitizeTeacherMode(JSON.parse(raw));
      setAudioState((p) => ({ ...p, teacher: teacherModeRef.current }));
    } catch {
      // Malformed persisted value — defaults already in place.
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    toast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2600);
  }, []);

  const setTeacherMode = useCallback(
    (patch: Partial<TeacherModeState>) => {
      const next = sanitizeTeacherMode({ ...teacherModeRef.current, ...patch });
      teacherModeRef.current = next;
      verseRepeatRef.current = 0;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEYS.TEACHER_MODE, JSON.stringify(next));
        } catch {
          // storage full/blocked — non-fatal
        }
      }
      setAudioState((p) => ({ ...p, teacher: next, verseRepeatIndex: 0, waitingForStudent: false }));
      showToast(
        next.enabled
          ? `وضع المعلم مفعّل — ${next.repeatCount} تكراراً لكل آية${next.pauseAfterEachVerse ? ' مع توقف للتلميذ' : ''}`
          : 'تم إيقاف وضع المعلم'
      );
    },
    [showToast]
  );

  const applyThemeAndBrand = useCallback(
    (cfg: SiteConfig, nextTheme: 'light' | 'dark') => {
      if (typeof document === 'undefined') return;
      const root = document.documentElement;
      root.classList.toggle('dark', nextTheme === 'dark');
      if (cfg.primaryColor) {
        root.style.setProperty('--brand-emerald', cfg.primaryColor);
      } else {
        root.style.removeProperty('--brand-emerald');
      }
      if (cfg.accentColor) {
        root.style.setProperty('--brand-gold', cfg.accentColor);
      } else {
        root.style.removeProperty('--brand-gold');
      }
      document.title = `${cfg.siteName} · ${cfg.tagline}`;
    },
    []
  );

  const refreshConfig = useCallback(() => {
    const loaded = loadSiteConfig();
    setConfig(loaded);
    const savedTheme =
      typeof window !== 'undefined'
        ? (window.localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark' | null)
        : null;
    const effectiveTheme = savedTheme ?? loaded.defaultTheme ?? 'light';
    setTheme(effectiveTheme);
    applyThemeAndBrand(loaded, effectiveTheme);
  }, [applyThemeAndBrand]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      const loaded = loadSiteConfig();
      setConfig(loaded);
      const savedTheme = window.localStorage.getItem(STORAGE_KEYS.THEME) as
        | 'light'
        | 'dark'
        | null;
      const effectiveTheme = savedTheme ?? loaded.defaultTheme ?? 'light';
      setTheme(effectiveTheme);
      applyThemeAndBrand(loaded, effectiveTheme);

      const savedReciter = resolveReciterOption(
        window.localStorage.getItem(STORAGE_KEYS.RECITER) ??
          loaded.defaultReciter ??
          RECITERS[0].slug
      ).slug;
      reciterRef.current = savedReciter;
      setAudioState((prev) => ({ ...prev, reciter: savedReciter }));
      setFavoriteReciters(loadFavoriteReciters());
    });

    const handleConfigEvent = () => refreshConfig();
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.CONFIG) refreshConfig();
    };

    window.addEventListener(CONFIG_EVENT, handleConfigEvent);
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      active = false;
      window.removeEventListener(CONFIG_EVENT, handleConfigEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [applyThemeAndBrand, refreshConfig]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEYS.THEME, next);
      }
      applyThemeAndBrand(config, next);
      return next;
    });
  }, [applyThemeAndBrand, config]);

  const loadTrackByIndex = useCallback((idx: number, autoPlay: boolean) => {
    const audio = audioRef.current;
    const list = versesRef.current;
    if (!audio || idx < 0 || idx >= list.length) return;
    const verse = list[idx];
    indexRef.current = idx;
    // Loading a NEW verse restarts the teacher-mode repetition counter; a
    // same-verse replay (teacher step) keeps it, so it is reset by callers.
    const url = getReaderPlaybackAudioUrl(reciterRef.current, verse.id);
    audio.src = url;
    audio.load();

    // Warm next verse in background for smooth gapless recitation
    const nextVerseObj = list[idx + 1];
    if (preloadAudioRef.current && nextVerseObj) {
      preloadAudioRef.current.src = getReaderPlaybackAudioUrl(
        reciterRef.current,
        nextVerseObj.id
      );
      preloadAudioRef.current.load();
    }

    const ayahNum = Number(verse.verse_key.split(':')[1] || idx + 1);
    saveLastRead({
      surah: surahRef.current.id,
      ayah: ayahNum,
      name: surahRef.current.name,
    });

    setAudioState((prev) => ({
      ...prev,
      visible: true,
      buffering: autoPlay,
      currentIndex: idx,
      currentVerseKey: verse.verse_key,
      currentTime: 0,
      duration: 0,
      waitingForStudent: false,
    }));

    if (autoPlay) {
      audio.play().catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setAudioState((prev) => ({ ...prev, playing: false, buffering: false }));
        showToast('تعذّر تشغيل التلاوة — اضغط زر التشغيل مرة أخرى');
      });
    }
  }, [showToast]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setAudioState((p) => ({ ...p, playing: true }));
    const onPlaying = () =>
      setAudioState((p) => ({ ...p, playing: true, buffering: false }));
    const onWaiting = () =>
      setAudioState((p) => ({ ...p, buffering: true }));
    const onCanPlay = () =>
      setAudioState((p) => ({ ...p, buffering: false }));
    const onPause = () =>
      setAudioState((p) => ({ ...p, playing: false, buffering: false }));
    const onError = () =>
      setAudioState((p) => ({ ...p, playing: false, buffering: false }));
    const onTimeUpdate = () =>
      setAudioState((p) => ({
        ...p,
        currentTime: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : p.duration,
      }));
    const onLoadedMeta = () =>
      setAudioState((p) => ({
        ...p,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      }));
    const onEnded = () => {
      // Teacher mode (roadmap item 6): the verse chant finished — decide
      // between replaying the same verse, waiting for the student, advancing,
      // or stopping, using the pure sequencer from lib/teacher-mode.
      const mode = teacherModeRef.current;
      const hasNext = indexRef.current + 1 < versesRef.current.length;
      const step = resolveTeacherStep(verseRepeatRef.current, mode, hasNext);

      if (step.action === 'replay-same-verse') {
        verseRepeatRef.current = step.nextRepeat;
        setAudioState((p) => ({ ...p, verseRepeatIndex: step.nextRepeat }));
        const gapMs = Math.max(0, Math.min(5000, mode.interRepeatGapSec * 1000));
        window.setTimeout(() => {
          // The wait gap belongs to this repetition decision only; a manual
          // skip during the gap cancels it (index unchanged check).
          loadTrackByIndex(indexRef.current, true);
        }, gapMs);
        return;
      }
      if (step.action === 'wait-for-student') {
        verseRepeatRef.current = 0;
        setAudioState((p) => ({
          ...p,
          playing: false,
          buffering: false,
          waitingForStudent: true,
          verseRepeatIndex: 0,
        }));
        return;
      }
      if (step.action === 'advance-to-next-verse') {
        verseRepeatRef.current = 0;
        setAudioState((p) => ({ ...p, waitingForStudent: false, verseRepeatIndex: 0 }));
        loadTrackByIndex(indexRef.current + 1, true);
        return;
      }
      verseRepeatRef.current = 0;
      setAudioState((p) => ({
        ...p,
        playing: false,
        buffering: false,
        waitingForStudent: false,
        verseRepeatIndex: 0,
      }));
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMeta);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMeta);
      audio.removeEventListener('ended', onEnded);
    };
  }, [loadTrackByIndex]);

  const playSurahVerses = useCallback(
    (
      verses: QulVerse[],
      surahId: number,
      surahName: string,
      startVerseKey?: string,
      overrideReciter?: string
    ) => {
      if (!verses.length) return;
      if (overrideReciter) {
        reciterRef.current = overrideReciter;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEYS.RECITER, overrideReciter);
        }
      }
      versesRef.current = verses;
      surahRef.current = { id: surahId, name: surahName };
      const startIdx = startVerseKey
        ? Math.max(
            0,
            verses.findIndex((v) => v.verse_key === startVerseKey)
          )
        : 0;

      bumpStat('plays', `${surahId}`);
      setAudioState((prev) => ({
        ...prev,
        visible: true,
        surahId,
        surahName,
        verses,
        reciter: reciterRef.current,
      }));
      loadTrackByIndex(startIdx, true);
    },
    [loadTrackByIndex]
  );

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const nextVerse = useCallback(() => {
    if (indexRef.current + 1 < versesRef.current.length) {
      loadTrackByIndex(indexRef.current + 1, true);
    }
  }, [loadTrackByIndex]);

  const prevVerse = useCallback(() => {
    if (indexRef.current > 0) {
      loadTrackByIndex(indexRef.current - 1, true);
    }
  }, [loadTrackByIndex]);

  const seekAudio = useCallback((timeSec: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, timeSec));
  }, []);

  const setReciter = useCallback(
    (slug: string) => {
      const resolved = resolveReciterOption(slug);
      reciterRef.current = resolved.slug;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEYS.RECITER, resolved.slug);
      }
      setAudioState((p) => ({ ...p, reciter: resolved.slug }));
      showToast(`تم اختيار القارئ: ${resolved.name}`);
      if (versesRef.current.length > 0 && audioState.visible) {
        const wasPlaying = !audioRef.current?.paused;
        loadTrackByIndex(indexRef.current, wasPlaying);
      }
    },
    [audioState.visible, loadTrackByIndex, showToast]
  );

  const toggleFavoriteReciter = useCallback((slug: string) => {
    const resolved = resolveReciterOption(slug);
    setFavoriteReciters((prev) => {
      const next = toggleFavoriteReciterSlug(prev, resolved.slug);
      saveFavoriteReciters(next);
      return next;
    });
  }, []);

  const closePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setAudioState((p) => ({
      ...p,
      visible: false,
      playing: false,
      buffering: false,
      currentVerseKey: null,
    }));
  }, []);

  return (
    <AppContext.Provider
      value={{
        config,
        refreshConfig,
        theme,
        toggleTheme,
        audioState,
        activeSurahContext,
        registerSurahContext,
        favoriteReciters,
        toggleFavoriteReciter,
        reciterPickerOpen,
        setReciterPickerOpen,
        playSurahVerses,
        togglePlayPause,
        nextVerse,
        prevVerse,
        setTeacherMode,
        seekAudio,
        setReciter,
        closePlayer,
        toastMessage,
        showToast,
      }}
    >
      <StudioTooltipProvider>{children}</StudioTooltipProvider>
      <audio ref={audioRef} preload="auto" crossOrigin="anonymous" />
      <audio ref={preloadAudioRef} preload="auto" crossOrigin="anonymous" aria-hidden="true" />
      <Toaster
        dir="rtl"
        position="bottom-left"
        offset={16}
        theme={theme}
        toastOptions={{
          duration: 2600,
          style: {
            fontFamily: 'var(--font-cairo), Cairo, sans-serif',
            background: theme === 'dark' ? '#12241F' : '#0B3D2E',
            color: '#FAF7F0',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            borderRadius: '0.75rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
          },
        }}
      />
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
