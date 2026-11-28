'use client';

/**
 * useAudioProducer — عقل صفحة «منتج الصوت»: تحميل المصدر (آيات قارئ أو
 * ملف)، نموذج التحرير غير المدمّر مع تراجع/إعادة، كشف السكوت وقصّه،
 * التصدير WAV والتسليم إلى الاستوديو.
 *
 * كل الحسابات الثقيلة في lib/audio-producer/* (نقية قابلة للاختبار)،
 * ومحرّك التشغيل/البحث في hooks/use-audio-producer-playback.ts — هذا
 * الخطاف يربطها بالدورة التفاعلية فقط.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QulVerse } from '@/lib/quran-data';
import {
  computePeakLevels,
  downloadBlob,
  encodeWav16bit,
  loadSourceFromFile,
  loadSourceFromVerses,
  type ProducerSource,
} from '@/lib/audio-producer/audio-producer-engine';
import {
  createInitialEditState,
  findSilenceSpans,
  keptRatio,
  mapEditedToSourceSec,
  mapSourceMarkersToEdited,
  removeRange,
  resetEdits,
  setMasterGainDb as setMasterGainDbOp,
  setNormalize as setNormalizeOp,
  setIntervalFades as setIntervalFadesOp,
  setIntervalGainDb as setIntervalGainDbOp,
  splitAt as splitAtOp,
  totalKeptSec,
  trimAfter as trimAfterOp,
  trimBefore as trimBeforeOp,
  type ProducerEditState,
  type TimeSpan,
} from '@/lib/audio-producer/audio-producer-edit';
import {
  buildProducerFilename,
  setProducerHandoff,
} from '@/lib/audio-producer/producer-handoff';
import { useProducerPlayback } from './use-audio-producer-playback';

const HISTORY_LIMIT = 40;
const ZOOM_FACTOR = 0.6;

export interface ProducerLoadState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  done: number;
  total: number;
  message?: string;
}

export interface SilenceOptions {
  thresholdRatio: number;
  minSilenceSec: number;
}

export function useAudioProducer(options: { showToast: (msg: string) => void }) {
  const { showToast } = options;

  const [source, setSource] = useState<ProducerSource | null>(null);
  const [loadState, setLoadState] = useState<ProducerLoadState>({
    status: 'idle',
    done: 0,
    total: 0,
  });
  const [edit, setEdit] = useState<ProducerEditState | null>(null);
  const [undoStack, setUndoStack] = useState<ProducerEditState[]>([]);
  const [redoStack, setRedoStack] = useState<ProducerEditState[]>([]);

  const [selection, setSelection] = useState<TimeSpan | null>(null);
  const [view, setView] = useState<{ startSec: number; durSec: number }>({
    startSec: 0,
    durSec: 1,
  });
  const [silences, setSilences] = useState<TimeSpan[]>([]);
  const [silenceOpts, setSilenceOpts] = useState<SilenceOptions>({
    thresholdRatio: 0.06,
    minSilenceSec: 0.4,
  });

  const [rendering, setRendering] = useState(false);

  const sourceRef = useRef<ProducerSource | null>(null);
  const editRef = useRef<ProducerEditState | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const peakLevelsRef = useRef<{ peakLevels: number[]; windowSec: number } | null>(null);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  useEffect(() => {
    editRef.current = edit;
  }, [edit]);

  // ── محرّك التشغيل (رندر + نقل + بحث) ──────────────────────────────
  const playback = useProducerPlayback({ sourceRef, editRef, showToast });
  const { invalidateRender, resetEngine, stopAndReset, ensureRendered } = playback;

  // ── تحرير: تقديم + تراجع/إعادة ────────────────────────────────────
  const applyEdit = useCallback(
    (updater: (prev: ProducerEditState) => ProducerEditState) => {
      setEdit((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        if (next === prev) return prev;
        setUndoStack((stack) => [...stack.slice(-HISTORY_LIMIT + 1), prev]);
        setRedoStack([]);
        invalidateRender();
        return next;
      });
    },
    [invalidateRender]
  );

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      setEdit((cur) => {
        if (cur) setRedoStack((redo) => [...redo, cur]);
        return prev;
      });
      invalidateRender();
      return stack.slice(0, -1);
    });
  }, [invalidateRender]);

  const redo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1];
      setEdit((cur) => {
        if (cur) setUndoStack((undo) => [...undo, cur]);
        return next;
      });
      invalidateRender();
      return stack.slice(0, -1);
    });
  }, [invalidateRender]);

  // ── تحميل المصدر ───────────────────────────────────────────────────
  const resetProducerState = useCallback(() => {
    resetEngine();
    setSelection(null);
    setSilences([]);
    peakLevelsRef.current = null;
    setUndoStack([]);
    setRedoStack([]);
  }, [resetEngine]);

  const loadVerses = useCallback(
    async (reciterSlug: string, verses: QulVerse[], reciterName?: string) => {
      loadAbortRef.current?.abort();
      const controller = new AbortController();
      loadAbortRef.current = controller;
      setLoadState({ status: 'loading', done: 0, total: verses.length });
      resetProducerState();
      try {
        const outcome = await loadSourceFromVerses({
          reciterSlug,
          reciterName,
          verses,
          signal: controller.signal,
          onProgress: (p) => setLoadState({ status: 'loading', done: p.done, total: p.total }),
        });
        if (controller.signal.aborted) return;
        setSource(outcome.source);
        setEdit(createInitialEditState(outcome.source.durationSec));
        setView({ startSec: 0, durSec: Math.max(1, outcome.source.durationSec) });
        setLoadState({ status: 'ready', done: outcome.source.verseNumbers.length, total: outcome.source.verseNumbers.length });
        if (outcome.failedVerses.length > 0) {
          showToast(`تم التحميل مع تخطّي ${outcome.failedVerses.length} آية تعذّر جلبها`);
        } else {
          showToast('تم تحميل التلاوة إلى المحرر');
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message =
          err instanceof DOMException && err.name === 'AbortError'
            ? 'أُلغي التحميل'
            : err instanceof Error
              ? err.message
              : 'تعذّر تحميل التلاوة';
        setLoadState({ status: 'error', done: 0, total: verses.length, message });
        showToast(message);
      }
    },
    [resetProducerState, showToast]
  );

  const loadFile = useCallback(
    async (file: File) => {
      setLoadState({ status: 'loading', done: 0, total: 1 });
      resetProducerState();
      try {
        const src = await loadSourceFromFile(file);
        setSource(src);
        setEdit(createInitialEditState(src.durationSec));
        setView({ startSec: 0, durSec: Math.max(1, src.durationSec) });
        setLoadState({ status: 'ready', done: 1, total: 1 });
        showToast(`تم تحميل الملف: ${file.name}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'تعذّر تحميل الملف';
        setLoadState({ status: 'error', done: 0, total: 1, message });
        showToast(message);
      }
    },
    [resetProducerState, showToast]
  );

  const clearSource = useCallback(() => {
    loadAbortRef.current?.abort();
    resetProducerState();
    setSource(null);
    setEdit(null);
    setLoadState({ status: 'idle', done: 0, total: 0 });
  }, [resetProducerState]);

  // كشف حدود الآيات للملف المرفوع (بعد معرفة عدد الآيات).
  const detectFileBoundaries = useCallback(
    (verseCount: number) => {
      const src = sourceRef.current;
      if (!src || src.kind !== 'file' || verseCount <= 0) return false;
      if (!peakLevelsRef.current) {
        peakLevelsRef.current = computePeakLevels(src);
      }
      const { peakLevels, windowSec } = peakLevelsRef.current;
      const maxLevel = peakLevels.reduce((a, b) => Math.max(a, b), 0);
      const threshold = Math.max(0.0001, maxLevel * Math.min(0.6, Math.max(0.005, silenceOpts.thresholdRatio)));
      const minSil = Math.max(0.15, Math.min(3, silenceOpts.minSilenceSec));
      // مشابه لكاشف حدود الاستوديو: فترات السكوت الطويلة = فواصل آيات.
      const spans = findSilenceSpans(peakLevels, windowSec, {
        thresholdRatio: threshold / Math.max(0.0001, maxLevel),
        minSilenceSec: minSil,
      });
      if (spans.length < verseCount - 1) {
        showToast(`اكتُشف ${spans.length} فاصلاً فقط من ${verseCount - 1} — قلّل مدة السكوت الدنيا أو اضبط يدوياً`);
        return false;
      }
      const ranked = spans
        .map((s, i) => ({ i, len: s.endSec - s.startSec }))
        .sort((a, b) => b.len - a.len)
        .slice(0, verseCount - 1)
        .map((e) => e.i)
        .sort((a, b) => a - b);
      const starts: number[] = [0];
      for (const si of ranked) {
        const s = spans[si];
        const v = Math.min(src.durationSec - 0.05, s.endSec - 0.06);
        if (v - starts[starts.length - 1] < 0.25) continue;
        starts.push(Number(v.toFixed(3)));
        if (starts.length >= verseCount) break;
      }
      if (starts.length < verseCount) {
        showToast('تعذّر تمييز كل الآيات — قلّل العتبة أو اضبط يدوياً');
        return false;
      }
      setSource((prev) =>
        prev
          ? {
              ...prev,
              verseMarkersSec: starts,
              verseNumbers: Array.from({ length: verseCount }, (_, i) => i + 1),
            }
          : prev
      );
      showToast(`تم كشف حدود ${verseCount} آية داخل الملف`);
      return true;
    },
    [silenceOpts, showToast]
  );

  // ── عمليات التحرير ────────────────────────────────────────────────
  const cutSelection = useCallback(() => {
    const st = editRef.current;
    if (!st || !selection) return false;
    applyEdit((prev) => removeRange(prev, selection.startSec, selection.endSec));
    setSelection(null);
    stopAndReset();
    return true;
  }, [applyEdit, selection, stopAndReset]);

  const splitAtPlayhead = useCallback(() => {
    const src = sourceRef.current;
    const st = editRef.current;
    if (!src || !st) return false;
    const t = mapEditedToSourceSec(st, playback.playheadEditedSec);
    applyEdit((prev) => splitAtOp(prev, t));
    return true;
  }, [applyEdit, playback.playheadEditedSec]);

  const trimBeforePlayhead = useCallback(() => {
    const src = sourceRef.current;
    const st = editRef.current;
    if (!src || !st) return false;
    const t = mapEditedToSourceSec(st, playback.playheadEditedSec);
    applyEdit((prev) => trimBeforeOp(prev, t));
    stopAndReset();
    return true;
  }, [applyEdit, playback.playheadEditedSec, stopAndReset]);

  const trimAfterPlayhead = useCallback(() => {
    const src = sourceRef.current;
    const st = editRef.current;
    if (!src || !st) return false;
    const t = mapEditedToSourceSec(st, playback.playheadEditedSec);
    applyEdit((prev) => trimAfterOp(prev, t));
    stopAndReset();
    return true;
  }, [applyEdit, playback.playheadEditedSec, stopAndReset]);

  const restoreFull = useCallback(() => {
    applyEdit((prev) => resetEdits(prev));
    stopAndReset();
    showToast('أُعيد المقطع كاملاً');
  }, [applyEdit, showToast, stopAndReset]);

  const setMasterGain = useCallback(
    (db: number) => applyEdit((prev) => setMasterGainDbOp(prev, db)),
    [applyEdit]
  );
  const setNormalizeOn = useCallback(
    (on: boolean) => applyEdit((prev) => setNormalizeOp(prev, on)),
    [applyEdit]
  );
  const setClipGain = useCallback(
    (id: number, db: number) => applyEdit((prev) => setIntervalGainDbOp(prev, id, db)),
    [applyEdit]
  );
  const setClipFades = useCallback(
    (id: number, fadeIn: number, fadeOut: number) =>
      applyEdit((prev) => setIntervalFadesOp(prev, id, fadeIn, fadeOut)),
    [applyEdit]
  );

  // ── السكوت ────────────────────────────────────────────────────────
  const detectSilences = useCallback(() => {
    const src = sourceRef.current;
    if (!src) return 0;
    if (!peakLevelsRef.current) {
      peakLevelsRef.current = computePeakLevels(src);
    }
    const { peakLevels, windowSec } = peakLevelsRef.current;
    const spans = findSilenceSpans(peakLevels, windowSec, silenceOpts);
    setSilences(spans);
    return spans.length;
  }, [silenceOpts]);

  const removeSilences = useCallback(() => {
    const st = editRef.current;
    if (!st || silences.length === 0) return;
    applyEdit((prev) => {
      let next = prev;
      for (const s of silences) {
        next = removeRange(next, s.startSec, s.endSec);
      }
      return next;
    });
    setSilences([]);
    stopAndReset();
    showToast('قُصّت فترات السكوت من المقطع');
  }, [applyEdit, silences, showToast, stopAndReset]);

  // ── العرض/التقريب ─────────────────────────────────────────────────
  const zoomBy = useCallback(
    (factor: number, anchorRatio = 0.5) => {
      const src = sourceRef.current;
      if (!src) return;
      setView((prev) => {
        const nextDur = Math.max(1, Math.min(src.durationSec, prev.durSec * factor));
        const anchor = prev.startSec + prev.durSec * anchorRatio;
        const start = Math.max(0, Math.min(Math.max(0, src.durationSec - nextDur), anchor - nextDur * anchorRatio));
        return { startSec: start, durSec: nextDur };
      });
    },
    []
  );

  const zoomIn = useCallback(() => zoomBy(ZOOM_FACTOR), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / ZOOM_FACTOR), [zoomBy]);
  const zoomFit = useCallback(() => {
    const src = sourceRef.current;
    if (!src) return;
    setView({ startSec: 0, durSec: Math.max(1, src.durationSec) });
  }, []);

  const scrollBySec = useCallback((deltaSec: number) => {
    setView((prev) => ({
      startSec: Math.max(0, prev.startSec + deltaSec),
      durSec: prev.durSec,
    }));
  }, []);

  /** تقريب على نقطة مرساة (نسبة أفقية من العرض الحالي) — لعجلة ctrl+wheel. */
  const zoomAt = useCallback(
    (anchorRatio: number, factor: number) => zoomBy(factor, anchorRatio),
    [zoomBy]
  );

  // ── التصدير والتسليم ──────────────────────────────────────────────
  const buildExportFile = useCallback(async (): Promise<File | null> => {
    const src = sourceRef.current;
    const st = editRef.current;
    if (!src || !st) {
      showToast('حمّل مصدراً أولاً');
      return null;
    }
    const total = totalKeptSec(st);
    if (total <= 0) {
      showToast('لا يوجد صوت محفوظ — المقطع مقصوص بالكامل');
      return null;
    }
    setRendering(true);
    try {
      const buffer = await ensureRendered();
      if (!buffer) {
        showToast('تعذّر رندر المقطع');
        return null;
      }
      const blob = encodeWav16bit(buffer);
      const name = buildProducerFilename(src.label);
      return new File([blob], name, { type: 'audio/wav' });
    } finally {
      setRendering(false);
    }
  }, [ensureRendered, showToast]);

  const exportWav = useCallback(async () => {
    const file = await buildExportFile();
    if (!file) return;
    downloadBlob(file, file.name);
    showToast(`تم تصدير المقطع المحرَّر: ${file.name}`);
  }, [buildExportFile, showToast]);

  const sendToStudio = useCallback(
    async (range?: { surahId: number; fromAyah: number; toAyah: number }): Promise<boolean> => {
      const file = await buildExportFile();
      if (!file) return false;
      const src = sourceRef.current;
      const st = editRef.current;
      if (!src || !st) return false;
      setProducerHandoff({
        file,
        label: `${src.label} — مُنتَج المحرر`,
        verseBoundsSec: mapSourceMarkersToEdited(st, src.verseMarkersSec),
        verseNumbers: src.verseNumbers,
        surahId: range?.surahId ?? 1,
        fromAyah: range?.fromAyah ?? 1,
        toAyah:
          range?.toAyah ??
          (src.verseNumbers.length > 0
            ? Math.max(...src.verseNumbers)
            : src.verseMarkersSec.length),
        createdAt: Date.now(),
      });
      showToast('جارٍ فتح الاستوديو مع المقطع المحرَّر…');
      return true;
    },
    [buildExportFile, showToast]
  );

  // ── مشتقّات جاهزة للعرض ───────────────────────────────────────────
  const playheadSourceSec = useMemo(() => {
    if (!edit) return 0;
    return mapEditedToSourceSec(edit, playback.playheadEditedSec);
  }, [edit, playback.playheadEditedSec]);

  const editedTotalSec = useMemo(() => (edit ? totalKeptSec(edit) : 0), [edit]);
  const keptPct = useMemo(() => (edit ? Math.round(keptRatio(edit) * 100) : 0), [edit]);
  const activeVerseIdx = useMemo(() => {
    if (!source || source.verseMarkersSec.length === 0) return -1;
    const t = playheadSourceSec;
    let idx = 0;
    for (let i = 0; i < source.verseMarkersSec.length; i++) {
      if (t >= source.verseMarkersSec[i] - 1e-4) idx = i;
    }
    return idx;
  }, [source, playheadSourceSec]);

  const verseCount = source?.verseMarkersSec.length ?? 0;

  return {
    // المصدر والتحميل
    source,
    loadState,
    loadVerses,
    loadFile,
    clearSource,
    detectFileBoundaries,
    verseCount,
    // التحرير + التراجع
    edit,
    applyEdit,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    cutSelection,
    splitAtPlayhead,
    trimBeforePlayhead,
    trimAfterPlayhead,
    restoreFull,
    setMasterGain,
    setNormalizeOn,
    setClipGain,
    setClipFades,
    // السكوت
    silences,
    silenceOpts,
    setSilenceOpts,
    detectSilences,
    removeSilences,
    // التحديد والعرض
    selection,
    setSelection,
    clearSelection: () => setSelection(null),
    view,
    zoomIn,
    zoomOut,
    zoomFit,
    zoomAt,
    scrollBySec,
    setView,
    // التشغيل (من محرّك useProducerPlayback)
    isPlaying: playback.isPlaying,
    playheadEditedSec: playback.playheadEditedSec,
    playheadSourceSec,
    editedTotalSec,
    keptPct,
    activeVerseIdx,
    play: playback.play,
    pause: playback.pause,
    togglePlay: playback.togglePlay,
    seekEdited: playback.seekEdited,
    seekSource: playback.seekSource,
    seekToVerse: playback.seekToVerse,
    seekToEdge: playback.seekToEdge,
    volume: playback.volume,
    setVolume: playback.setVolume,
    rate: playback.rate,
    setRate: playback.setRate,
    // التصدير
    rendering,
    exportWav,
    sendToStudio,
  };
}

export type AudioProducerController = ReturnType<typeof useAudioProducer>;
