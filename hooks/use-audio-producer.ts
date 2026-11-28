'use client';

/**
 * useAudioProducer — عقل التحرير الصوتي: تحميل المصدر (آيات/ملف)،
 * تحرير غير مدمّر بتراجع/إعادة (مقاطع + حدود آيات)، كشف السكوت،
 * موضع الآيات، الصدى، والتصدير/التسليم. الحسابات في lib/audio-producer/*،
 * التشغيل في use-audio-producer-playback، الرسم في use-producer-view.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QulVerse } from '@/lib/quran-data';
import {
  computePeakLevels,
  loadSourceFromFile,
  loadSourceFromVerses,
  type ProducerSource,
} from '@/lib/audio-producer/audio-producer-engine';
import {
  createInitialEditState,
  findSilenceSpans,
  keptRatio,
  mapEditedToSourceSec,
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
  clampEchoSettings,
  DEFAULT_ECHO,
  type ProducerEchoSettings,
} from '@/lib/audio-producer/producer-echo';
import {
  moveVerseMarker,
  nudgeVerseMarker as nudgeMarkerOp,
} from '@/lib/audio-producer/verse-markers';
import { useProducerPlayback } from './use-audio-producer-playback';
import { useProducerView } from './use-producer-view';
import { useProducerExport } from './use-producer-export';

const HISTORY_LIMIT = 40;

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

/** لقطة تراجع: التحرير + حدود الآيات (null = لم تُمسّ). */
interface ProducerSnapshot {
  edit: ProducerEditState;
  verseMarkers: number[] | null;
}

export function useAudioProducer(options: {
  showToast: (msg: string) => void;
  /** سياق مشترك (استوديو الإنتاج) — يوحّد الخلط والتسجيل. */
  sharedContextRef?: React.RefObject<AudioContext | null>;
  /** عقدة خرج (مِكسر الاستوديو) لتصبّ فيها التلاوة. */
  outputNodeRef?: React.RefObject<AudioNode | null>;
}) {
  const { showToast, sharedContextRef, outputNodeRef } = options;

  const [source, setSource] = useState<ProducerSource | null>(null);
  const [loadState, setLoadState] = useState<ProducerLoadState>({
    status: 'idle',
    done: 0,
    total: 0,
  });
  const [edit, setEdit] = useState<ProducerEditState | null>(null);
  const [history, setHistory] = useState<{ undo: ProducerSnapshot[]; redo: ProducerSnapshot[] }>({
    undo: [],
    redo: [],
  });
  const [selection, setSelection] = useState<TimeSpan | null>(null);
  const [silences, setSilences] = useState<TimeSpan[]>([]);
  const [silenceOpts, setSilenceOpts] = useState<SilenceOptions>({
    thresholdRatio: 0.06,
    minSilenceSec: 0.4,
  });
  const [echo, setEchoState] = useState<ProducerEchoSettings>(DEFAULT_ECHO);

  const sourceRef = useRef<ProducerSource | null>(null);
  const editRef = useRef<ProducerEditState | null>(null);
  const echoRef = useRef<ProducerEchoSettings | null>(null);
  const historyRef = useRef(history);
  const loadAbortRef = useRef<AbortController | null>(null);
  const peakLevelsRef = useRef<{ peakLevels: number[]; windowSec: number } | null>(null);

  useEffect(() => {
    sourceRef.current = source;
    editRef.current = edit;
    echoRef.current = echo;
    historyRef.current = history;
  }, [source, edit, echo, history]);

  // محرّك التشغيل + إطار العرض + التصدير
  const playback = useProducerPlayback({
    sourceRef,
    editRef,
    echoRef,
    showToast,
    sharedContextRef,
    outputNodeRef,
  });
  const { invalidateRender, resetEngine, stopAndReset, ensureRendered } = playback;
  const viewCtl = useProducerView(sourceRef);
  const exporter = useProducerExport({ sourceRef, editRef, echoRef, ensureRendered, showToast });

  // ── التحرير: تقديم + تراجع/إعادة ────────────────────────────────────
  /** يلتقط لقطة للحالة الحالية (التحرير والحدود معاً) قبل أي تغيير. */
  const pushUndoSnapshot = useCallback(
    (verseMarkers: number[] | null) => {
      const st = editRef.current;
      const src = sourceRef.current;
      if (!st || !src) return;
      setHistory((h) => ({
        undo: [...h.undo.slice(-HISTORY_LIMIT + 1), { edit: st, verseMarkers }],
        redo: [],
      }));
    },
    []
  );

  const applyEdit = useCallback(
    (updater: (prev: ProducerEditState) => ProducerEditState) => {
      const prev = editRef.current;
      if (!prev) return;
      const next = updater(prev);
      if (next === prev) return;
      pushUndoSnapshot(null);
      invalidateRender();
      setEdit(next);
    },
    [invalidateRender, pushUndoSnapshot]
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.undo.length === 0) return;
    const snap = h.undo[h.undo.length - 1];
    const cur = editRef.current;
    const src = sourceRef.current;
    if (!cur || !src) return;
    // لقطة الإعادة تحفظ الحدود الحالية إن كانت ستتغير بهذا التراجع.
    const markersToRestore = snap.verseMarkers;
    const redoSnap: ProducerSnapshot = {
      edit: cur,
      verseMarkers: markersToRestore !== null ? src.verseMarkersSec : null,
    };
    setEdit(snap.edit);
    if (markersToRestore !== null) {
      setSource((p) => (p ? { ...p, verseMarkersSec: markersToRestore } : p));
    }
    setHistory((hh) => ({ undo: hh.undo.slice(0, -1), redo: [...hh.redo, redoSnap] }));
    invalidateRender();
  }, [invalidateRender]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.redo.length === 0) return;
    const snap = h.redo[h.redo.length - 1];
    const cur = editRef.current;
    const src = sourceRef.current;
    if (!cur || !src) return;
    const markersToRestore = snap.verseMarkers;
    const undoSnap: ProducerSnapshot = {
      edit: cur,
      verseMarkers: markersToRestore !== null ? src.verseMarkersSec : null,
    };
    setEdit(snap.edit);
    if (markersToRestore !== null) {
      setSource((p) => (p ? { ...p, verseMarkersSec: markersToRestore } : p));
    }
    setHistory((hh) => ({ undo: [...hh.undo, undoSnap], redo: hh.redo.slice(0, -1) }));
    invalidateRender();
  }, [invalidateRender]);

  // ── تحرير موضع الآيات (حدودها الزمنية) ─────────────────────────────
  /** نقل بداية آية لزمن مطلق — بتراجع وإشعار. */
  const setVerseMarker = useCallback(
    (idx: number, sec: number) => {
      const src = sourceRef.current;
      if (!src) return false;
      const next = moveVerseMarker(src.verseMarkersSec, src.durationSec, idx, sec);
      if (!next) return false;
      pushUndoSnapshot(src.verseMarkersSec);
      setSource((p) => (p ? { ...p, verseMarkersSec: next } : p));
      showToast(`ضُبط موضع الآية ${src.verseNumbers[idx] ?? idx + 1}`);
      return true;
    },
    [pushUndoSnapshot, showToast]
  );

/** إزاحة بداية آية بثوانٍ (أزرار الموضع). */
  const nudgeVerse = useCallback(
    (idx: number, deltaSec: number) => {
      const src = sourceRef.current;
      if (!src) return null;
      const next = nudgeMarkerOp(src.verseMarkersSec, src.durationSec, idx, deltaSec);
      if (!next) return null;
      pushUndoSnapshot(src.verseMarkersSec);
      setSource((p) => (p ? { ...p, verseMarkersSec: next } : p));
      return next[idx];
    },
    [pushUndoSnapshot]
  );

  /** سحب حدّ آية: لقطة عند البدء + معاينة حية — تراجع نقطة واحدة. */
  const beginVerseMarkerDrag = useCallback(() => {
    const src = sourceRef.current;
    if (src) pushUndoSnapshot(src.verseMarkersSec);
  }, [pushUndoSnapshot]);

  /** معاينة نقل حدّ آية أثناء السحب (بلا تراجع ولا إشعارات). */
  const previewVerseMarker = useCallback((idx: number, sec: number) => {
    const src = sourceRef.current;
    if (!src) return;
    const next = moveVerseMarker(src.verseMarkersSec, src.durationSec, idx, sec);
    if (!next) return;
    setSource((p) => (p ? { ...p, verseMarkersSec: next } : p));
  }, []);

  /** ضبط كل حدود الآيات جملةً (فتح مشروع) — بتراجع واحد. */
  const setVerseMarkersBulk = useCallback(
    (markers: number[]) => {
      const src = sourceRef.current;
      if (!src || !markers.length) return false;
      const clean = markers.map(Number).filter((m) => Number.isFinite(m) && m >= 0 && m <= src.durationSec);
      if (clean.length !== markers.length) return false;
      pushUndoSnapshot(src.verseMarkersSec);
      setSource((p) => (p ? { ...p, verseMarkersSec: clean } : p));
      return true;
    },
    [pushUndoSnapshot]
  );

  // ── صدى الصوت ──────────────────────────────────────────────────────
  /** يقيّد دائماً — لا تصل قيم خارج المدى إلى المحرّك أبداً. */
  const setEcho = useCallback(
    (next: Partial<ProducerEchoSettings>) => {
      setEchoState((prev) => clampEchoSettings({ ...prev, ...next }));
      invalidateRender();
    },
    [invalidateRender]
  );

  // ── تحميل المصدر ───────────────────────────────────────────────────
  const resetProducerState = useCallback(() => {
    resetEngine();
    setSelection(null);
    setSilences([]);
    peakLevelsRef.current = null;
    setHistory({ undo: [], redo: [] });
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
        viewCtl.fitToSource();
        setLoadState({
          status: 'ready',
          done: outcome.source.verseNumbers.length,
          total: outcome.source.verseNumbers.length,
        });
        if (outcome.failedVerses.length > 0) {
          showToast(`تم التحميل مع تخطّي ${outcome.failedVerses.length} آية تعذّر جلبها`);
        } else {
          showToast('تم تحميل التلاوة إلى المحرر');
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'تعذّر تحميل التلاوة';
        setLoadState({ status: 'error', done: 0, total: verses.length, message });
        showToast(message);
      }
    },
    [resetProducerState, showToast, viewCtl]
  );

  const loadFile = useCallback(
    async (file: File) => {
      setLoadState({ status: 'loading', done: 0, total: 1 });
      resetProducerState();
      try {
        const src = await loadSourceFromFile(file);
        setSource(src);
        setEdit(createInitialEditState(src.durationSec));
        viewCtl.fitToSource();
        setLoadState({ status: 'ready', done: 1, total: 1 });
        showToast(`تم تحميل الملف: ${file.name}`);
      } catch (err) {
        setLoadState({ status: 'error', done: 0, total: 1, message: err instanceof Error ? err.message : 'تعذّر تحميل الملف' });
        showToast('تعذّر تحميل الملف');
      }
    },
    [resetProducerState, showToast, viewCtl]
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

  // ── عمليات التحرير (مقاطع الصوت) ───────────────────────────────────
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

  /** حذف آية كاملة من التلاوة (قصّ مداها في إحداثيات المصدر). */
  const removeVerse = useCallback(
    (idx: number) => {
      const src = sourceRef.current;
      if (!src || idx < 0 || idx >= src.verseMarkersSec.length) return false;
      const startSec = src.verseMarkersSec[idx];
      const endSec =
        idx + 1 < src.verseMarkersSec.length ? src.verseMarkersSec[idx + 1] : src.durationSec;
      if (endSec - startSec <= 0.01) return false;
      applyEdit((prev) => removeRange(prev, startSec, endSec));
      stopAndReset();
      showToast(`حُذفت الآية ${src.verseNumbers[idx] ?? idx + 1} من التلاوة`);
      return true;
    },
    [applyEdit, showToast, stopAndReset]
  );

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

  // ── السكوت ──────────────────────────────────────────────────────────
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

  // ── مشتقّات جاهزة للعرض ────────────────────────────────────────────
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
    canUndo: history.undo.length > 0,
    canRedo: history.redo.length > 0,
    cutSelection,
    splitAtPlayhead,
    trimBeforePlayhead,
    trimAfterPlayhead,
    restoreFull,
    removeVerse,
    setMasterGain,
    setNormalizeOn,
    setClipGain,
    setClipFades,
    // موضع الآيات
    setVerseMarker,
    setVerseMarkersBulk,
    nudgeVerse,
    beginVerseMarkerDrag,
    previewVerseMarker,
    // صدى الصوت
    echo,
    setEcho,
    // السكوت
    silences,
    silenceOpts,
    setSilenceOpts,
    detectSilences,
    removeSilences,
    // التحديد والعرض (use-producer-view)
    selection,
    setSelection,
    clearSelection: () => setSelection(null),
    view: viewCtl.view,
    setView: viewCtl.setView,
    zoomIn: viewCtl.zoomIn,
    zoomOut: viewCtl.zoomOut,
    zoomFit: viewCtl.zoomFit,
    zoomAt: viewCtl.zoomAt,
    scrollBySec: viewCtl.scrollBySec,
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
    // التصدير والتسليم (use-producer-export)
    rendering: exporter.rendering,
    exportWav: exporter.exportWav,
    sendToStudio: exporter.sendToStudio,
  };
}

export type AudioProducerController = ReturnType<typeof useAudioProducer>;
