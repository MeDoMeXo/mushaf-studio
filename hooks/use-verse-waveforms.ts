'use client';

/**
 * useVerseWaveforms — استخراج تدريجي لقمم موجات تلاوة الآيات لخط «منتج الصوت».
 *
 * - الوضع المدمج (قارئ + ملف لكل آية): كل آية تُجلب من كاش المتصفح
 *   (getCachedVerseAudioBlob) أو تُجلب وتُخزَّن (fetchAndCacheVerseAudio)، ثم
 *   تُفك ترميزها بـ AudioContext مشترك وتُختزل إلى قمم max-abs.
 * - الوضع المخصص (ملف مرفوع واحد): الملف يُفك مرة واحدة → قمم مسار واحد.
 *
 * التخزين طبقتان: كاش مرجعي دائم (يبقى عبر فتح/إغلاق التبويب) بمفتاح
 * `${reciter}:${verseId}`، ولقطة state منه تُنشر للرسم (قراءة المراجع أثناء
 * الرسم ممنوعة في قواعد react-hooks/refs فاللقطة هي المصدر الرسمي للعرض).
 *
 * التقدّم تدريجي (بالتوازي حتى 4) وقابل للإلغاء فور تغيّر القارئ/الآيات/
 * الملف. الفشل لآية معزولة لا يوقف الباقي — تُقدَّر مدتها احتياطياً.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchAndCacheVerseAudio, getCachedVerseAudioBlob } from '@/lib/audio-cache';
import {
  computePeaks,
  mixToMono,
  type WaveformPeaks,
} from '@/lib/timeline-peaks';
import type { QulVerse } from '@/lib/quran-data';

/** دقة القمم لكل آية (عدد الأعمدة المرسومة داخل مقطعها). */
const VERSE_PEAK_BUCKETS = 220;
/** دقة القمم لمسار الملف المخصص الطويل الواحد. */
const CUSTOM_PEAK_BUCKETS = 1200;
/** حد التوازي لفك الترميز. */
const DECODE_CONCURRENCY = 4;
/** سقف عدد الآيات التي تُفك موجاتها فعلياً (الباقي يُقدَّر) — حماية CPU
 *  عند تحديد سورة كاملة؛ الآيات الأولى والأقصر تُكفي للخط الزمني. */
const MAX_DECODE_VERSES = 96;

export interface WaveformProgress {
  status: 'idle' | 'loading' | 'ready' | 'partial';
  ready: number;
  total: number;
  failed: number;
}

interface UseVerseWaveformsInput {
  selectedVerses: QulVerse[];
  reciterSlug: string;
  /** ملف التلاوة المرفوع (إن وُجد) — يُفك محلياً بالكامل مرة واحدة. */
  customAudioFile: File | null;
  /** تعطيل الاستخراج (مثلاً أثناء عمل التصدير) — اختياري. */
  disabled?: boolean;
}

export interface UseVerseWaveformsResult {
  /** قمم كل آية بمفتاح verseId — الوضع المدمج. */
  verseWaveforms: Map<number, WaveformPeaks>;
  /** قمم المسار الواحد — الوضع المخصص (null خارجه). */
  customWaveform: WaveformPeaks | null;
  progress: WaveformProgress;
  /** إجمالي مدة الخط كما حُلِّل فعلاً (بلا تقديرات) بالثواني. */
  analyzedTotalSec: number;
  /** إعادة التحليل من الصفر (مسح الكاش الدائم). */
  reanalyze: () => void;
}

export function useVerseWaveforms({
  selectedVerses,
  reciterSlug,
  customAudioFile,
  disabled = false,
}: UseVerseWaveformsInput): UseVerseWaveformsResult {
  // الكاش الدائم: يبقى عبر فتح/إغلاق تبويب المنتج طول الجلسة.
  const peaksCacheRef = useRef<Map<string, WaveformPeaks>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const runNonceRef = useRef(0);
  // مرجع مستقر لقائمة الآيات — تأثيرات الجلب تقرأه دون أن تعتمد على هوية
  // المصفوفة (المفتاح الآيتي هو الضابط) — نفس نمط use-studio-canvas.
  const selectedVersesRef = useRef(selectedVerses);
  useEffect(() => {
    selectedVersesRef.current = selectedVerses;
  }, [selectedVerses]);

  const isCustom = Boolean(customAudioFile);
  const verseIdsKey = useMemo(
    () => selectedVerses.map((v) => v.id).join(','),
    [selectedVerses]
  );

  // نطاق التقدّم الحالي — تقدّم جولة قديمة (قارئ/آيات/ملف آخر) لا يُعرض.
  const [progressRecord, setProgressRecord] = useState<{
    scopeKey: string;
    progress: WaveformProgress;
  } | null>(null);
  const progressScopeKey = isCustom
    ? `custom:${customAudioFile?.name}:${customAudioFile?.size}`
    : `${reciterSlug}:${verseIdsKey}:${disabled ? 'off' : 'on'}`;
  const expectedTotal = isCustom
    ? 1
    : Math.min(MAX_DECODE_VERSES, selectedVerses.filter((v) => v.id > 0).length);
  const progress = useMemo<WaveformProgress>(() => {
    const rec = progressRecord;
    if (rec && rec.scopeKey === progressScopeKey) return rec.progress;
    if (!isCustom && (!verseIdsKey || disabled)) {
      return { status: 'idle', ready: 0, total: 0, failed: 0 };
    }
    return { status: 'loading', ready: 0, total: expectedTotal, failed: 0 };
  }, [progressRecord, progressScopeKey, expectedTotal, isCustom, verseIdsKey, disabled]);

  // لقطة الكاش للعرض — تُنشر من التأثيرات فقط (لا قراءة مراجع أثناء الرسم).
  const [snapshot, setSnapshot] = useState<ReadonlyMap<string, WaveformPeaks>>(
    () => new Map()
  );
  const [resetNonce, setResetNonce] = useState(0);

  /** نشر نسخة من الكاش الدائم إلى لقطة العرض — من التأثيرات فقط. */
  const publishSnapshot = useCallback(() => {
    setSnapshot(new Map(peaksCacheRef.current));
  }, []);

  const getAudioContext = useCallback((): AudioContext | null => {
    if (audioCtxRef.current) return audioCtxRef.current;
    const Ctor: typeof AudioContext | undefined =
      typeof window === 'undefined'
        ? undefined
        : window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
    if (!Ctor) return null;
    audioCtxRef.current = new Ctor();
    return audioCtxRef.current;
  }, []);

  /** فك بافر ArrayBuffer إلى قمم مختزلة + مدة دقيقة. */
  const decodeToPeaks = useCallback(
    async (buf: ArrayBuffer, buckets: number): Promise<WaveformPeaks | null> => {
      const ctx = getAudioContext();
      if (!ctx) return null;
      try {
        const audio = await ctx.decodeAudioData(buf);
        const channels: Float32Array[] = [];
        for (let c = 0; c < audio.numberOfChannels; c++) {
          channels.push(audio.getChannelData(c));
        }
        const mono = mixToMono(channels, audio.length);
        return {
          durationSec: audio.duration,
          peaks: computePeaks(mono, buckets),
        };
      } catch {
        return null;
      }
    },
    [getAudioContext]
  );

  // ── الوضع المخصص: ملف واحد يُفك مرة ─────────────────────────────────
  useEffect(() => {
    if (!customAudioFile) return;
    if (disabled) return;
    const myNonce = ++runNonceRef.current;
    let cancelled = false;
    const cacheKey = `custom:${customAudioFile.name}:${customAudioFile.size}`;
    const scopeKey = progressScopeKey;

    void (async () => {
      setProgressRecord({
        scopeKey,
        progress: { status: 'loading', ready: 0, total: 1, failed: 0 },
      });
      try {
        const buf = await customAudioFile.arrayBuffer();
        if (cancelled || myNonce !== runNonceRef.current) return;
        const result = await decodeToPeaks(buf, CUSTOM_PEAK_BUCKETS);
        if (cancelled || myNonce !== runNonceRef.current) return;
        if (result) {
          peaksCacheRef.current.set(cacheKey, result);
          setProgressRecord({
            scopeKey,
            progress: { status: 'ready', ready: 1, total: 1, failed: 0 },
          });
        } else {
          setProgressRecord({
            scopeKey,
            progress: { status: 'partial', ready: 0, total: 1, failed: 1 },
          });
        }
        publishSnapshot();
      } catch {
        if (cancelled || myNonce !== runNonceRef.current) return;
        setProgressRecord({
          scopeKey,
          progress: { status: 'partial', ready: 0, total: 1, failed: 1 },
        });
        publishSnapshot();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customAudioFile, disabled, decodeToPeaks, publishSnapshot, progressScopeKey]);

  // ── الوضع المدمج: قمم لكل آية على حدة (تدريجي متوازٍ قابل للإلغاء) ──
  useEffect(() => {
    if (isCustom || disabled || !verseIdsKey) {
      return;
    }

    const myNonce = ++runNonceRef.current;
    const controller = new AbortController();
    const signal = controller.signal;
    const scopeKey = progressScopeKey;

    const verses = selectedVersesRef.current ?? [];
    const cache = peaksCacheRef.current;
    // سقف الفك: الآيات الزائدة تُقدَّر مددها من لوحة المنتج (نمط هادئ).
    const targets = verses
      .filter((v) => v.id > 0)
      .slice(0, MAX_DECODE_VERSES);
    const total = targets.length;
    if (total === 0) return;

    let ready = 0;
    let failed = 0;
    let dirty = false;
    const flush = () => {
      if (signal.aborted) return;
      setProgressRecord({
        scopeKey,
        progress: {
          status: ready + failed >= total ? (failed > 0 ? 'partial' : 'ready') : 'loading',
          ready,
          total,
          failed,
        },
      });
      if (dirty) {
        dirty = false;
        publishSnapshot();
      }
    };

    const analyzeOne = async (verse: QulVerse): Promise<void> => {
      const key = `${reciterSlug}:${verse.id}`;
      if (cache.has(key)) {
        ready += 1;
        return;
      }
      try {
        let blob = await getCachedVerseAudioBlob(reciterSlug, verse.id);
        if (!blob && !signal.aborted) {
          blob = await fetchAndCacheVerseAudio(reciterSlug, verse.id, signal);
        }
        if (!blob) throw new Error('no audio blob');
        const buf = await blob.arrayBuffer();
        if (signal.aborted || myNonce !== runNonceRef.current) return;
        const result = await decodeToPeaks(buf, VERSE_PEAK_BUCKETS);
        if (!result) throw new Error('decode failed');
        if (signal.aborted || myNonce !== runNonceRef.current) return;
        cache.set(key, result);
        dirty = true;
        ready += 1;
      } catch {
        if (signal.aborted) return;
        failed += 1;
      }
    };

    // تجميع متوازٍ محدود — يُلغى فوراً عند أي تغيير (AbortController).
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (!signal.aborted) {
        const idx = nextIndex;
        if (idx >= targets.length) return;
        nextIndex += 1;
        await analyzeOne(targets[idx]);
        flush();
      }
    };

    void (async () => {
      // نشر أي قمم محفوظة من زيارات سابقة للتبويب قبل البدء.
      setProgressRecord({
        scopeKey,
        progress: { status: 'loading', ready: 0, total, failed: 0 },
      });
      publishSnapshot();
      await Promise.all(
        Array.from({ length: Math.min(DECODE_CONCURRENCY, total) }, () => worker())
      );
    })();

    return () => {
      controller.abort();
    };
  }, [reciterSlug, verseIdsKey, isCustom, disabled, resetNonce, decodeToPeaks, publishSnapshot, progressScopeKey]);

  // إغلاق AudioContext عند التفكيك (تحرير موارد فك الترميز).
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  const reanalyze = useCallback(() => {
    peaksCacheRef.current.clear();
    publishSnapshot();
    setResetNonce((n) => n + 1);
  }, [publishSnapshot]);

  // ── مشتقّات العرض — تقرأ اللقطة فقط (لا مراجع أثناء الرسم) ────────
  const verseWaveforms = useMemo(() => {
    const out = new Map<number, WaveformPeaks>();
    if (isCustom) return out;
    for (const v of selectedVerses) {
      const hit = snapshot.get(`${reciterSlug}:${v.id}`);
      if (hit) out.set(v.id, hit);
    }
    return out;
  }, [isCustom, reciterSlug, selectedVerses, snapshot]);

  const customWaveform = useMemo(() => {
    if (!customAudioFile) return null;
    return (
      snapshot.get(`custom:${customAudioFile.name}:${customAudioFile.size}`) ?? null
    );
  }, [customAudioFile, snapshot]);

  const analyzedTotalSec = useMemo(() => {
    if (isCustom) return customWaveform?.durationSec ?? 0;
    let t = 0;
    for (const v of selectedVerses) {
      t += verseWaveforms.get(v.id)?.durationSec ?? 0;
    }
    return t;
  }, [isCustom, customWaveform, verseWaveforms, selectedVerses]);

  return {
    verseWaveforms,
    customWaveform,
    progress,
    analyzedTotalSec,
    reanalyze,
  };
}
