'use client';

/**
 * use-production-frame — رندرة معاينة «استوديو الإنتاج».
 *
 * يملك حلقة rAF التي ترسم إطاراً حتمياً لكل لحظة تشغيل (المعاينة)،
 * يعيد الرسم عند أي تغيير والوقوف، يحسب كاليوكي الآية النشطة (نسبة
 * تقدّم النطق داخلها)، ويبني مصغرات فيلمstrip لمسار الفيديو من مقاطع
 * الخلفية الحقيقية.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  drawProductionFrame,
  type ProductionFramePayload,
  type ProductionVerseInfo,
} from '@/lib/production/production-frame-renderer';
import { splitAyahTokens } from '@/lib/verse-words';
import type { QulVerse } from '@/lib/quran-data';
import type { ProductionTextClip, ProductionVisuals } from '@/lib/production/production-types';
import type { EditedVerseSpan } from '@/lib/production/production-timeline-mapping';
import { getBuiltinBackgroundPublicPath } from '@/lib/background-library';

export interface UseProductionFrameRefs {
  /** كانفيس المعاينة (يُملك من العرض). */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** عنصر فيديو الخلفية (يُملك من العرض — يُغذّي الراسم). */
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export interface UseProductionFrameArgs {
  width: number;
  height: number;
  visuals: ProductionVisuals;
  surahName: string;
  reciterName: string;
  translationText: string | null;
  selectedVerses: QulVerse[];
  activeVerseIdx: number;
  playheadEditedSec: number;
  isPlaying: boolean;
  totalSec: number;
  verseSpans: EditedVerseSpan[];
  textClips: ProductionTextClip[];
}

export function useProductionFrame(
  frameRefs: UseProductionFrameRefs,
  args: UseProductionFrameArgs
) {
  const { canvasRef, videoRef } = frameRefs;
  const { width, height, visuals, isPlaying } = args;
  const [filmstrip, setFilmstrip] = useState<string[]>([]);
  const argsRef = useRef(args);
  useEffect(() => {
    argsRef.current = args;
  }, [args]);

  const bgUrl = useMemo(() => {
    if (visuals.bgId.startsWith('gradient:')) return null;
    return getBuiltinBackgroundPublicPath(visuals.bgId);
  }, [visuals.bgId]);
  /** بناء معلومات الآية الحالية (كاليوكي/نص/كلمات). */
  const buildVerseInfo = useCallback(
    (a: UseProductionFrameArgs, t: number): ProductionVerseInfo | null => {
      const verse = a.selectedVerses[a.activeVerseIdx];
      if (!verse) return null;
      const span = a.verseSpans[a.activeVerseIdx];
      let ratio = 0;
      if (span && span.endSec > span.startSec) {
        ratio = Math.max(0, Math.min(1, (t - span.startSec) / (span.endSec - span.startSec)));
      }
      return {
        text: verse.text_uthmani,
        ayahNumber: a.selectedVerses[a.activeVerseIdx].verse_key
          ? Number(a.selectedVerses[a.activeVerseIdx].verse_key.split(':')[1] || 1)
          : 1,
        words: splitAyahTokens(verse.text_uthmani),
        progressRatio: ratio,
      };
    },
    []
  );

  /** رسم إطار واحد عند زمن t (نفس ما يستعمله مسار تصدير الفيديو). */
  const renderFrame = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const a = argsRef.current;
      const activeClips = a.textClips.filter((c) => t >= c.startSec && t <= c.endSec);
      const payload: ProductionFramePayload = {
        width,
        height,
        timeSec: t,
        totalSec: a.totalSec,
        bgCanvas: videoRef.current && videoRef.current.readyState >= 2
          ? videoRef.current
          : null,
        visuals: a.visuals,
        verse: buildVerseInfo(a, t),
        surahName: a.surahName,
        reciterName: a.reciterName,
        translationText: a.translationText,
        activeTextClips: activeClips,
      };
      drawProductionFrame(ctx, payload);
    },
    [buildVerseInfo, canvasRef, height, videoRef, width]
  );

  // ── حلقة الرسم ──────────────────────────────────────────────────────
  // أثناء التشغيل: rAF يقرأ رأس القراءة من مرجع دائم الصلاحية. عند الوقوف
  // أو تغيير أي مدخل: رسم واحد فوري (بلا حلقة).

  const playheadRef = useRef(args.playheadEditedSec);
  useEffect(() => {
    playheadRef.current = args.playheadEditedSec;
  }, [args.playheadEditedSec]);

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const loop = () => {
      renderFrame(playheadRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, renderFrame]);

  useEffect(() => {
    if (!isPlaying) renderFrame(args.playheadEditedSec);
  }, [
    isPlaying,
    renderFrame,
    args.playheadEditedSec,
    args.visuals,
    args.activeVerseIdx,
    args.surahName,
    args.reciterName,
    args.translationText,
    args.textClips,
    args.verseSpans,
    width,
    height,
  ]);

  // ── فيديو الخلفية ─────────────────────────────────────────────────────
  // يُدار تشغيله من العرض الرئيسي (start/stop مع التشغيل) — هنا نضبط
  // الزمن عند الوقوف/البحث فقط.

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !bgUrl) return;
    if (isPlaying) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
      const target = args.playheadEditedSec % Math.max(0.1, vid.duration || 10);
      try {
        vid.currentTime = target;
      } catch {
        // تجاهل — قبل جاهزية البيانات
      }
    }
  }, [bgUrl, isPlaying, videoRef, args.playheadEditedSec]);

  // ── مصغرات مسار الفيديو (فيلمstrip حقيقي من مقطع الخلفية) ────────────

  useEffect(() => {
    let cancelled = false;
    const build = async () => {
      if (!bgUrl) {
        setFilmstrip([]);
        return;
      }
      try {
        // عنصر فيديو خفي مستقل للمصغرات (لا يعبث بعنصر المعاينة).
        const vid = document.createElement('video');
        vid.src = bgUrl;
        vid.muted = true;
        vid.preload = 'auto';
        await new Promise<void>((resolve, reject) => {
          vid.onloadeddata = () => resolve();
          vid.onerror = () => reject(new Error('bg load failed'));
          setTimeout(() => reject(new Error('bg load timeout')), 8000);
        });
        if (cancelled) return;
        const thumb = document.createElement('canvas');
        thumb.width = 64;
        thumb.height = 44;
        const tctx = thumb.getContext('2d');
        const dur = vid.duration || 10;
        const shots: string[] = [];
        for (let i = 0; i < 8; i++) {
          vid.currentTime = (dur * i) / 8 + 0.05;
          await new Promise<void>((resolve) => {
            vid.onseeked = () => resolve();
            setTimeout(resolve, 500);
          });
          if (cancelled || !tctx) return;
          const vw = vid.videoWidth || 64;
          const vh = vid.videoHeight || 44;
          const s = Math.max(64 / vw, 44 / vh);
          tctx.drawImage(vid, (64 - vw * s) / 2, (44 - vh * s) / 2, vw * s, vh * s);
          shots.push(thumb.toDataURL('image/jpeg', 0.6));
        }
        if (!cancelled) setFilmstrip(shots);
      } catch {
        if (!cancelled) setFilmstrip([]);
      }
    };
    void build();
    return () => {
      cancelled = true;
    };
  }, [bgUrl]);

  return { renderFrame, filmstrip, bgUrl };
}
