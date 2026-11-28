'use client';

/**
 * useProducerPlayback — محرّك تشغيل «منتج الصوت»: الرندر المشترك (مخزَّن
 * بوسخ قذر)، تشغيل AudioBufferSourceNode + rAF لمتابعة رأس القراءة،
 * البحث/القفز بإحداثيات الخط المحرَّر أو المصدر أو الآيات، والتحكم في
 * الصوت والسرعة.
 *
 * يعمل فوق مراجع (المصدر/التحرير/الصدى) تمتلكها useAudioProducer — لا حالة
 * تحرير هنا؛ كل الحسابات الثقيلة في lib/audio-producer/*.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { renderEdited, type ProducerSource } from '@/lib/audio-producer/audio-producer-engine';
import {
  mapEditedToSourceSec,
  mapSourceToEditedSec,
  totalKeptSec,
  type ProducerEditState,
} from '@/lib/audio-producer/audio-producer-edit';
import type { ProducerEchoSettings } from '@/lib/audio-producer/producer-echo';

export function useProducerPlayback(options: {
  sourceRef: RefObject<ProducerSource | null>;
  editRef: RefObject<ProducerEditState | null>;
  /** الصدى يمرّ في الرندر المشترك فتشغّل المعاينة نفس ما يُصدَّر. */
  echoRef: RefObject<ProducerEchoSettings | null>;
  showToast: (msg: string) => void;
}) {
  const { sourceRef, editRef, echoRef, showToast } = options;

  const [playheadEditedSec, setPlayheadEditedSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [rate, setRateState] = useState(1);

  // ── مراجع محرّك التشغيل ────────────────────────────────────────────
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const renderedRef = useRef<AudioBuffer | null>(null);
  const renderDirtyRef = useRef(true);
  const renderJobRef = useRef<Promise<AudioBuffer | null> | null>(null);
  const startCtxTimeRef = useRef(0);
  const startOffsetRef = useRef(0);
  const suppressEndedRef = useRef(false);
  const rafRef = useRef(0);
  const volumeRef = useRef(1);
  const rateRef = useRef(1);

  useEffect(() => {
    volumeRef.current = volume;
    if (gainNodeRef.current && ctxRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(volume, ctxRef.current.currentTime, 0.02);
    }
  }, [volume]);

  useEffect(() => {
    rateRef.current = rate;
    if (nodeRef.current) nodeRef.current.playbackRate.setTargetAtTime(rate, ctxRef.current?.currentTime ?? 0, 0.02);
  }, [rate]);

  // ── الرندر (مشترك للتصدير والتشغيل) ────────────────────────────────
  const ensureRendered = useCallback(async (): Promise<AudioBuffer | null> => {
    const src = sourceRef.current;
    const st = editRef.current;
    if (!src || !st) return null;
    if (!renderDirtyRef.current && renderedRef.current) return renderedRef.current;
    if (renderJobRef.current) return renderJobRef.current;
    const job = renderEdited(src, st, echoRef.current ?? undefined)
      .then((buffer) => {
        renderedRef.current = buffer;
        renderDirtyRef.current = false;
        renderJobRef.current = null;
        return buffer;
      })
      .catch(() => {
        renderJobRef.current = null;
        return null;
      });
    renderJobRef.current = job;
    return job;
  }, [editRef, echoRef, sourceRef]);

  /** يُستدعى بعد أي تعديل/تراجع/إعادة — الرندر المخزَّن لم يعد صالحاً. */
  const invalidateRender = useCallback(() => {
    renderDirtyRef.current = true;
  }, []);

  // التشغيل يُوقف عند أي تغيير بنيوي (المحتوى المسموع تغيّر) — يُستأنف يدوياً.
  const stopPlayback = useCallback(() => {
    suppressEndedRef.current = true;
    try {
      nodeRef.current?.stop();
    } catch {
      // لم يبدأ بعد — تجاهل
    }
    nodeRef.current = null;
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
  }, []);

  /** إيقاف + تصفير رأس القراءة — بعد قصّ/تقليم يغيّر بنية الخط الزمني. */
  const stopAndReset = useCallback(() => {
    stopPlayback();
    setPlayheadEditedSec(0);
  }, [stopPlayback]);

  /** تفريغ المحرّك بالكامل عند تبديل المصدر: إيقاف + إسقاط الرندر. */
  const resetEngine = useCallback(() => {
    stopAndReset();
    renderedRef.current = null;
    renderDirtyRef.current = true;
    renderJobRef.current = null;
  }, [stopAndReset]);

  // ── التشغيل ───────────────────────────────────────────────────────
  const tickRef = useRef<() => void>(() => {});
  const tick = useCallback(() => {
    const ctx = ctxRef.current;
    const node = nodeRef.current;
    if (!ctx || !node) return;
    const total = renderedRef.current?.duration ?? 0;
    const elapsed = (ctx.currentTime - startCtxTimeRef.current) * rateRef.current;
    const pos = startOffsetRef.current + elapsed;
    if (pos >= total) {
      setPlayheadEditedSec(total);
      suppressEndedRef.current = true;
      try {
        node.stop();
      } catch {
        // تجاهل
      }
      nodeRef.current = null;
      cancelAnimationFrame(rafRef.current);
      setIsPlaying(false);
      return;
    }
    setPlayheadEditedSec(pos);
    rafRef.current = requestAnimationFrame(() => tickRef.current());
  }, []);
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const startNodeAt = useCallback(
    (offsetSec: number) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const buffer = renderedRef.current;
      if (!buffer) return;
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = volumeRef.current;
      node.playbackRate.value = rateRef.current;
      node.connect(gain);
      gain.connect(ctx.destination);
      suppressEndedRef.current = false;
      node.onended = () => {
        if (suppressEndedRef.current) return;
        cancelAnimationFrame(rafRef.current);
        nodeRef.current = null;
        setIsPlaying(false);
        setPlayheadEditedSec(renderedRef.current?.duration ?? 0);
      };
      const offset = Math.max(0, Math.min(offsetSec, Math.max(0, buffer.duration - 0.02)));
      node.start(0, offset);
      nodeRef.current = node;
      gainNodeRef.current = gain;
      startCtxTimeRef.current = ctx.currentTime;
      startOffsetRef.current = offset;
      rafRef.current = requestAnimationFrame(tick);
      setIsPlaying(true);
    },
    [tick]
  );

  const play = useCallback(async () => {
    const src = sourceRef.current;
    if (!src) return;
    let ctx = ctxRef.current;
    if (!ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        showToast('المتصفح لا يدعم تشغيل المحرر');
        return;
      }
      ctx = new Ctor();
      ctxRef.current = ctx;
    }
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    const total = (await ensureRendered())?.duration ?? 0;
    const offset = Math.min(playheadEditedSec, Math.max(0, total - 0.02));
    if (total <= 0) {
      showToast('لا يوجد صوت محفوظ للتشغيل — أعد المقطع كاملاً');
      return;
    }
    startNodeAt(offset);
  }, [ensureRendered, playheadEditedSec, showToast, sourceRef, startNodeAt]);

  const pause = useCallback(() => {
    stopPlayback();
  }, [stopPlayback]);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else void play();
  }, [isPlaying, pause, play]);

  // ── البحث/القفز ────────────────────────────────────────────────────
  const seekEdited = useCallback(
    (sec: number) => {
      const st = editRef.current;
      const total = st ? totalKeptSec(st) : 0;
      const t = Math.max(0, Math.min(sec, total));
      setPlayheadEditedSec(t);
      if (isPlaying) {
        startNodeAt(t);
      }
    },
    [editRef, isPlaying, startNodeAt]
  );

  /** تقديم بإحداثيات المصدر (نقرة على الموجة). */
  const seekSource = useCallback(
    (sec: number) => {
      const st = editRef.current;
      if (!st) return;
      seekEdited(mapSourceToEditedSec(st, sec));
    },
    [editRef, seekEdited]
  );

  /** القفز إلى آية (فهرس) على الخط المحرَّر. */
  const seekToVerse = useCallback(
    (idx: number) => {
      const src = sourceRef.current;
      const st = editRef.current;
      if (!src || !st || src.verseMarkersSec.length === 0) return;
      const i = Math.max(0, Math.min(idx, src.verseMarkersSec.length - 1));
      seekEdited(mapSourceToEditedSec(st, src.verseMarkersSec[i]));
    },
    [editRef, seekEdited, sourceRef]
  );

  const seekToEdge = useCallback(
    (edge: 'start' | 'end') => {
      if (edge === 'start') seekEdited(0);
      else {
        const st = editRef.current;
        seekEdited(st ? totalKeptSec(st) : 0);
      }
    },
    [editRef, seekEdited]
  );

  // ── تنظيف عند الفك ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      suppressEndedRef.current = true;
      try {
        nodeRef.current?.stop();
      } catch {
        // تجاهل
      }
      cancelAnimationFrame(rafRef.current);
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  return {
    isPlaying,
    playheadEditedSec,
    volume,
    setVolume: setVolumeState,
    rate,
    setRate: setRateState,
    play,
    pause,
    togglePlay,
    seekEdited,
    seekSource,
    seekToVerse,
    seekToEdge,
    stopAndReset,
    invalidateRender,
    resetEngine,
    ensureRendered,
  };
}

export type ProducerPlaybackController = ReturnType<typeof useProducerPlayback>;
