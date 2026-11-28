'use client';

/**
 * use-production-mixer — مِكسر استوديو الإنتاج الصوتي.
 *
 * يملك سياق WebAudio مشتركاً وعقدة مِكسر رئيسية تُصبّ فيها التلاوة
 * (عبر useAudioProducer.outputNodeRef) والموسيقى الخلفية والمحيطات،
 * فيُسمَع الخليط نفسه ويُسجَّل نفسه (MediaStream للفيديو).
 *
 * كذلك يملك تسجيل الميكروفون (MediaRecorder) لالتلاوة الخاصة.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { buildAmbientLoop, type AmbientKind } from '@/lib/production/production-ambient';
import { computeMusicPeaks } from '@/lib/production/production-timeline-mapping';
import type { ProductionEffectClip } from '@/lib/production/production-types';

export interface MixerMusicState {
  name: string;
  durationSec: number;
  /** قمم الموجة (0..1) لرسم المسار الأرجواني. */
  peaks: Float32Array | null;
}

export function useProductionMixer(options: {
  showToast: (msg: string) => void;
}) {
  const { showToast } = options;

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const streamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // الموسيقى
  const musicBufferRef = useRef<AudioBuffer | null>(null);
  const musicNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const [musicState, setMusicState] = useState<MixerMusicState | null>(null);
  const [musicGain, setMusicGainState] = useState(0.35);

  // المحيطات النشطة
  const ambientNodesRef = useRef<Map<string, { node: AudioBufferSourceNode; gain: GainNode }>>(new Map());
  const ambientBuffersRef = useRef<Map<AmbientKind, AudioBuffer>>(new Map());

  // تسجيل الميكروفون
  const [recording, setRecording] = useState(false);
  const [recorderSec, setRecorderSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** إنشاء السياق والمِكسر عند أول استخدام (بعد إيماءة مستخدم). */
  const ensureGraph = useCallback((): { ctx: AudioContext; master: GainNode } | null => {
    if (typeof window === 'undefined') return null;
    let ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      ctxRef.current = ctx;
    }
    if (!masterRef.current || masterRef.current.context !== ctx) {
      const master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
      masterRef.current = master;
    }
    return { ctx, master: masterRef.current };
  }, []);

  /** استئناف السياق (بعد أي إيماءة). */
  const resumeContext = useCallback(async () => {
    const g = ensureGraph();
    if (g && g.ctx.state === 'suspended') {
      await g.ctx.resume().catch(() => {});
    }
  }, [ensureGraph]);

  // ── الموسيقى ────────────────────────────────────────────────────────

  const loadMusic = useCallback(
    async (file: File) => {
      const g = ensureGraph();
      if (!g) {
        showToast('المتصفح لا يدعم Web Audio');
        return false;
      }
      try {
        const buf = await file.arrayBuffer();
        const decoded = await g.ctx.decodeAudioData(buf);
        musicBufferRef.current = decoded;
        musicNodeRef.current?.stop();
        musicNodeRef.current = null;
        setMusicState({
          name: file.name,
          durationSec: decoded.duration,
          peaks: computeMusicPeaks(decoded, 1024),
        });
        showToast(`أُضيفت الموسيقى: ${file.name}`);
        return true;
      } catch {
        showToast('تعذّر فك ترميز ملف الموسيقى');
        return false;
      }
    },
    [ensureGraph, showToast]
  );

  const removeMusic = useCallback(() => {
    try {
      musicNodeRef.current?.stop();
    } catch {
      // تجاهل
    }
    musicNodeRef.current = null;
    musicBufferRef.current = null;
    setMusicState(null);
  }, []);

  /** تشغيل الموسيقى من إزاحة (تُدار من مشغّل الاستوديو الرئيسي). */
  const startMusic = useCallback(
    (offsetSec: number) => {
      const g = ensureGraph();
      const buffer = musicBufferRef.current;
      if (!g || !buffer || !musicState) return;
      try {
        musicNodeRef.current?.stop();
      } catch {
        // تجاهل
      }
      const node = g.ctx.createBufferSource();
      node.buffer = buffer;
      node.loop = true;
      const gain = g.ctx.createGain();
      gain.gain.value = musicGain;
      node.connect(gain);
      gain.connect(g.master);
      const off = Math.max(0, Math.min(offsetSec, buffer.duration - 0.02));
      node.start(0, off);
      musicNodeRef.current = node;
      musicGainRef.current = gain;
    },
    [ensureGraph, musicGain, musicState]
  );

  const stopMusic = useCallback(() => {
    try {
      musicNodeRef.current?.stop();
    } catch {
      // تجاهل
    }
    musicNodeRef.current = null;
  }, []);

  const setMusicGain = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      setMusicGainState(clamped);
      const ctx = ctxRef.current;
      if (musicGainRef.current && ctx) {
        musicGainRef.current.gain.setTargetAtTime(clamped, ctx.currentTime, 0.05);
      }
    },
    []
  );

  // ── المحيطات ────────────────────────────────────────────────────────

  const startAmbient = useCallback(
    (clip: ProductionEffectClip) => {
      if (clip.kind !== 'ambient') return;
      const g = ensureGraph();
      if (!g) return;
      let buf = ambientBuffersRef.current.get(clip.ambient);
      if (!buf) {
        const built = buildAmbientLoop(g.ctx, clip.ambient);
        if (!built) return;
        ambientBuffersRef.current.set(clip.ambient, built);
        buf = built;
      }
      const node = g.ctx.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      const gain = g.ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, clip.gain));
      node.connect(gain);
      gain.connect(g.master);
      node.start();
      ambientNodesRef.current.set(clip.id, { node, gain });
    },
    [ensureGraph]
  );

  const stopAmbient = useCallback((id: string) => {
    const entry = ambientNodesRef.current.get(id);
    if (entry) {
      try {
        entry.node.stop();
      } catch {
        // تجاهل
      }
      ambientNodesRef.current.delete(id);
    }
  }, []);

  const stopAllAmbients = useCallback(() => {
    for (const [id] of ambientNodesRef.current) stopAmbient(id);
  }, [stopAmbient]);

  /** تفعيل المحيطات التي يقع فيها رأس القراءة (تُستدعى كل تحديث). */
  const syncAmbients = useCallback(
    (clips: ProductionEffectClip[], playheadSec: number) => {
      const active = new Set(
        clips
          .filter((c) => c.kind === 'ambient' && playheadSec >= c.startSec && playheadSec < c.endSec)
          .map((c) => c.id)
      );
      for (const [id] of ambientNodesRef.current) {
        if (!active.has(id)) stopAmbient(id);
      }
      for (const clip of clips) {
        if (clip.kind === 'ambient' && active.has(clip.id) && !ambientNodesRef.current.has(clip.id)) {
          startAmbient(clip);
        }
      }
    },
    [startAmbient, stopAmbient]
  );

  // ── تسجيل الميكروفون ────────────────────────────────────────────────

  const startRecording = useCallback(async (): Promise<File | null> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      showToast('المتصفح لا يدعم تسجيل الميكروفون');
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(
        (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) recChunksRef.current.push(e.data);
      };
      const done = new Promise<File | null>((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(recChunksRef.current, { type: rec.mimeType || 'audio/webm' });
          const file = new File([blob], `تلاوة-مسجلة-${Date.now()}.webm`, { type: blob.type });
          recChunksRef.current = [];
          resolve(file);
        };
      });
      rec.start(250);
      mediaRecorderRef.current = rec;
      setRecording(true);
      setRecorderSec(0);
      recTimerRef.current = setInterval(() => setRecorderSec((s) => s + 1), 1000);
      showToast('بدأ التسجيل — اضبط الجهاز ثم أوقفه للتحرير');
      return done;
    } catch {
      showToast('تعذّر الوصول إلى الميكروفون');
      return null;
    }
  }, [showToast]);

  const finishRecording = useCallback((): Promise<File | null> => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    const done = new Promise<File | null>((resolve) => {
      rec.onstop = () => {
        const stream = rec.stream;
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recChunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const file = new File([blob], `تلاوة-مسجلة-${Date.now()}.webm`, { type: blob.type });
        recChunksRef.current = [];
        resolve(file);
      };
    });
    try {
      rec.stop();
    } catch {
      // تجاهل
    }
    mediaRecorderRef.current = null;
    setRecording(false);
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    return done;
  }, []);

  /** إنهاء التسجيل المعلّق بلا نتيجة (نظافة عند الفك/الإلغاء). */
  const cancelRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        // تجاهل
      }
      rec.stream.getTracks().forEach((t) => t.stop());
    }
    mediaRecorderRef.current = null;
    setRecording(false);
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
  }, []);

  /** عقدة مِكسر للتصدير المرئي (تُنشأ مرة وتصبّ في المُسجّل). */
  const ensureCaptureStream = useCallback((): MediaStream | null => {
    const g = ensureGraph();
    if (!g) return null;
    if (!streamDestRef.current) {
      streamDestRef.current = g.ctx.createMediaStreamDestination();
      g.master.connect(streamDestRef.current);
    }
    return streamDestRef.current.stream;
  }, [ensureGraph]);

  const getCtxSampleRate = useCallback((): number => ctxRef.current?.sampleRate ?? 44100, []);

  // ── تنظيف عند الفك ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelRecording();
      stopMusic();
      stopAllAmbients();
      // نُبقي السياق حياً إن كان مشتركاً مع منتج الصوت (البافرات فيه) —
      // إغلاقه قد يصفّر بيانات بافرات الجلسة (درس موثّق في المحرّك).
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ctxRef,
    masterRef,
    ensureGraph,
    resumeContext,
    // موسيقى
    musicState,
    musicGain,
    setMusicGain,
    loadMusic,
    removeMusic,
    startMusic,
    stopMusic,
    // محيطات
    startAmbient,
    stopAmbient,
    stopAllAmbients,
    syncAmbients,
    // تسجيل
    recording,
    recorderSec,
    startRecording,
    finishRecording,
    cancelRecording,
    // تصدير
    ensureCaptureStream,
    getCtxSampleRate,
  };
}

export type ProductionMixer = ReturnType<typeof useProductionMixer>;
