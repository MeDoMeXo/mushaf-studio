'use client';

/**
 * use-production-studio — جذر «استوديو تحرير القرآن الكريم».
 *
 * يجمع: منتج الصوت (تحرير التلاوة + تشغيل) على مِكسر الاستوديو،
 * الآيات من QUL، المشاريع (حفظ/فتح/استعادة)، المقاطع (نصوص/مؤثرات)،
 * المعاينة (راسم الإطار)، والتصدير (WAV/MP3/WebM/MP4) — ويوزّع أوامر
 * القوائم العشر على كل هذه القدرات.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAudioProducer, type AudioProducerController } from '@/hooks/use-audio-producer';
import { useProductionVerses } from '@/hooks/use-production-verses';
import { useProductionMixer, type ProductionMixer } from '@/hooks/use-production-mixer';
import { useProductionProject } from '@/hooks/use-production-project';
import { useProductionExport } from '@/hooks/use-production-export';
import { useProductionClips } from '@/hooks/use-production-clips';
import { useProductionCommands } from '@/hooks/use-production-commands';
import { useProductionFrame } from '@/hooks/use-production-frame';
import { computeSourcePeaks, editedPeaksFromSource, editedVerseSpans } from '@/lib/production/production-timeline-mapping';
import { RECITERS, DEFAULT_TRANSLATION_ID, STUDIO_FONTS, STUDIO_GRADIENTS } from '@/lib/quran-data';
import { getBuiltinBackground } from '@/lib/background-library';
import {
  DEFAULT_PRODUCTION_EXPORT,
  DEFAULT_PRODUCTION_VISUALS,
  formatProductionClock,
  productionCanvasSize,
  type ProductionAmbientKind,
  type ProductionDialogId,
  type ProductionEditMode,
  type ProductionEffectClip,
  type ProductionExportSettings,
  type ProductionMenuActionId,
  type ProductionTextClip,
  type ProductionVisuals,
} from '@/lib/production/production-types';
import type { ProjectSnapshotInput } from '@/hooks/use-production-project';

const DEFAULT_SURAH = 1;
const DEFAULT_FROM = 1;
const DEFAULT_TO = 7;
const DEFAULT_RECITER = RECITERS[0];

const showToast = (msg: string) => toast(msg);

/** مدخلات الاستوديو من العرض — المراجع يملكها العرض (قاعدة refs). */
export interface UseProductionStudioArgs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  audioFileInputRef: React.RefObject<HTMLInputElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useProductionStudio(args: UseProductionStudioArgs) {
  const { canvasRef, audioFileInputRef } = args;
  // ── الحالة الأساسية ────────────────────────────────────────────────────
  const [mode, setMode] = useState<ProductionEditMode>('advanced');
  const [dialog, setDialog] = useState<ProductionDialogId>(null);
  const [projectName, setProjectName] = useState('مشروع جديد');
  const [surahId, setSurahId] = useState(DEFAULT_SURAH);
  const [fromAyah, setFromAyah] = useState(DEFAULT_FROM);
  const [toAyah, setToAyah] = useState(DEFAULT_TO);
  const [reciterSlug, setReciterSlug] = useState(DEFAULT_RECITER.slug);
  const [translationId, setTranslationId] = useState(DEFAULT_TRANSLATION_ID);
  const [visuals, setVisuals] = useState<ProductionVisuals>(DEFAULT_PRODUCTION_VISUALS);
  const [exportSettings, setExportSettings] = useState<ProductionExportSettings>(DEFAULT_PRODUCTION_EXPORT);
  const [zoom, setZoom] = useState(1);
  const [trackVisibility, setTrackVisibility] = useState({ video: true, music: true, effects: true, text: true });
  const [recordings, setRecordings] = useState<{ name: string; file: File }[]>([]);

  // ── المخالب الفرعية ────────────────────────────────────────────────────
  const mixer = useProductionMixer({ showToast });
  const producer: AudioProducerController = useAudioProducer({
    showToast,
    sharedContextRef: mixer.ctxRef,
    outputNodeRef: mixer.masterRef,
  });
  const verses = useProductionVerses(surahId, fromAyah, toAyah, translationId);
  const project = useProductionProject({ showToast, hasAnyWork: producer.source !== null });
  const exporter = useProductionExport({ showToast });

  const reciterName = useMemo(
    () => RECITERS.find((r) => r.slug === reciterSlug)?.name ?? DEFAULT_RECITER.name,
    [reciterSlug]
  );

  /** اسم السورة مشتقّ من الفصل المحمّل — بلا حالة إضافية. */
  const surahName = verses.currentChapter?.name_arabic ?? 'السورة';

  // ── مقاطع النصوص والمؤثرات (مسارات الخط الزمني) ──────────────────────
  const clips = useProductionClips({
    showToast,
    echoEnabled: producer.echo.enabled,
    echoWet: producer.echo.wet,
    totalSec: producer.editedTotalSec,
    surahName,
  });

  // ── قمم الموجة وفترات الآيات (خط محرَّر) ────────────────────────────────
  const sourcePeaks = useMemo(
    () => (producer.source ? computeSourcePeaks(producer.source.buffer, 2048) : null),
    [producer.source]
  );

  const editIntervals = useMemo(() => producer.edit?.intervals ?? [], [producer.edit]);

  const editedPeaks = useMemo(() => {
    if (!sourcePeaks || !producer.source || !producer.edit) return null;
    return editedPeaksFromSource(
      sourcePeaks,
      producer.source.durationSec,
      producer.edit.intervals,
      1400
    );
  }, [sourcePeaks, producer.source, producer.edit]);

  const verseSpans = useMemo(() => {
    if (!producer.source || !producer.edit) return [];
    return editedVerseSpans(
      producer.source.verseMarkersSec,
      producer.source.durationSec,
      producer.edit.intervals
    );
  }, [producer.source, producer.edit]);

  // ── مزامنة الموسيقى والمحيطات مع التشغيل ──────────────────────────────
  useEffect(() => {
    if (producer.isPlaying) {
      mixer.startMusic(producer.playheadEditedSec);
    } else {
      mixer.stopMusic();
      mixer.stopAllAmbients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producer.isPlaying]);

  useEffect(() => {
    if (producer.isPlaying) {
      mixer.syncAmbients(clips.effectClips, producer.playheadEditedSec);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producer.playheadEditedSec, clips.effectClips, producer.isPlaying]);

  // ── المعاينة (راسم الإطار) ──────────────────────────────────────────────
  const activeVerse = verses.selectedVerses[producer.activeVerseIdx] ?? verses.selectedVerses[0];
  const translationText = useMemo(
    () => verses.translationOf(activeVerse),
    [verses, activeVerse]
  );
  const { width: canvasW, height: canvasH } = useMemo(
    () => productionCanvasSize(exportSettings.aspect, exportSettings.quality),
    [exportSettings.aspect, exportSettings.quality]
  );

  // إنشاء سياق المِكسر مبكراً (معلّقاً حتى أول إيماءة) حتى يرتبط محرك
  // التشغيل بسياق واحد دائم — لا يُنشئ سياقاً خاصاً ينافس مِكسر الاستوديو.
  useEffect(() => {
    mixer.ensureGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const frame = useProductionFrame(
    { canvasRef, videoRef: args.videoRef },
    {
    width: canvasW,
    height: canvasH,
    visuals,
    surahName,
    reciterName,
    translationText,
    selectedVerses: verses.selectedVerses,
    activeVerseIdx: producer.activeVerseIdx,
    playheadEditedSec: producer.playheadEditedSec,
    isPlaying: producer.isPlaying,
    totalSec: producer.editedTotalSec,
    verseSpans,
    textClips: clips.textClips,
    }
  );

  // ── تحميل التلاوة ──────────────────────────────────────────────────────
  const versesRef = useRef(verses);
  useEffect(() => {
    versesRef.current = verses;
  }, [verses]);
  const playheadLiveRef = useRef(producer.playheadEditedSec);
  useEffect(() => {
    playheadLiveRef.current = producer.playheadEditedSec;
  }, [producer.playheadEditedSec]);

  /** انتظار جلب فصل معين (سورة أخرى) — بحد أقصى ٥ ثوان. */
  const waitForChapter = useCallback(async (surah: number, timeoutMs = 5000): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const v = versesRef.current;
      if (v.currentChapter?.id === surah && v.chapterVerses.length > 0) return true;
      await new Promise((r) => setTimeout(r, 150));
    }
    return versesRef.current.currentChapter?.id === surah;
  }, []);

  const loadRecitation = useCallback(
    async (opts?: { surah?: number; from?: number; to?: number; reciter?: string }) => {
      const s = opts?.surah ?? surahId;
      const f = opts?.from ?? fromAyah;
      const t = opts?.to ?? toAyah;
      const r = opts?.reciter ?? reciterSlug;
      const ok = await waitForChapter(s);
      if (!ok) {
        showToast('تعذّر جلب آيات السورة — أعد المحاولة');
        return false;
      }
      const allVerses = versesRef.current.chapterVerses;
      const versesList = allVerses.slice(Math.max(0, f - 1), Math.max(1, t));
      if (!versesList.length) {
        showToast('لا توجد آيات في النطاق المحدد');
        return false;
      }
      await producer.loadVerses(r, versesList, reciterName);
      clips.ensureDefaultTextClips(producer.editedTotalSec || 10);
      return true;
    },
    [clips, fromAyah, producer, reciterName, reciterSlug, surahId, toAyah, waitForChapter]
  );

  // ── تطبيق مشروع محفوظ ─────────────────────────────────────────────────
  const applyProjectData = useCallback(
    async (data: import('@/lib/production/production-types').ProductionProjectData) => {
      setProjectName(data.name);
      setSurahId(data.surahId);
      setFromAyah(data.fromAyah);
      setToAyah(data.toAyah);
      setReciterSlug(data.reciterSlug);
      setTranslationId(data.translationId);
      setVisuals({ ...DEFAULT_PRODUCTION_VISUALS, ...data.visual });
      setExportSettings({ ...DEFAULT_PRODUCTION_EXPORT, ...data.exportSettings });
      clips.setTextClips(data.textClips ?? []);
      clips.setEffectClips(data.effectClips ?? []);
      setMode(data.mode ?? 'advanced');
      if (data.musicName) {
        showToast(`المشروع فيه موسيقى «${data.musicName}» — أعد رفع الملف من مكتبة الصوت`);
      }
      // انتظار جلب آيات السورة الجديدة ثم التحميل بالتحديد المحفوظ.
      await waitForChapter(data.surahId, 6000);
      await loadRecitation({
        surah: data.surahId,
        from: data.fromAyah,
        to: data.toAyah,
        reciter: data.reciterSlug,
      });
      await new Promise((r) => setTimeout(r, 150));
      if (data.echo) producer.setEcho(data.echo);
      if (data.edit) producer.applyEdit(() => ({ ...data.edit! }));
      if (data.verseMarkersSec?.length) {
        await new Promise((r) => setTimeout(r, 120));
        producer.setVerseMarkersBulk(data.verseMarkersSec);
      }
      showToast(`فُتح المشروع: ${data.name}`);
    },
    [loadRecitation, producer, waitForChapter]
  );

  // تحميل تلقائي أول مرة (فاتحة كاملة بالعفاسي) أو فتح آخر مشروع.
  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current || verses.selectedVerses.length === 0) return;
    bootRef.current = true;
    // العمل داخل مهمة دقيقة — بلا setState متزامن داخل جسم التأثير.
    Promise.resolve().then(() => {
      if (producer.source) return;
      const lastId = project.peekLastProject();
      if (lastId) {
        const data = project.openProject(lastId);
        if (data) {
          void applyProjectData(data);
          return;
        }
      }
      void loadRecitation();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verses.selectedVerses]);


  // ── تتبّع لقطة المشروع (حفظ/تلقائي) ────────────────────────────────────
  useEffect(() => {
    const snap: ProjectSnapshotInput = {
      name: projectName,
      surahId,
      fromAyah,
      toAyah,
      reciterSlug,
      reciterName,
      translationId,
      surahName,
      durationSec: producer.editedTotalSec,
      edit: producer.edit,
      verseMarkersSec: producer.source?.verseMarkersSec ?? null,
      echo: producer.echo,
      visual: visuals,
      exportSettings,
      textClips: clips.textClips,
      effectClips: clips.effectClips,
      musicName: mixer.musicState?.name ?? null,
      musicGain: mixer.musicGain,
      volume: producer.volume,
      rate: producer.rate,
      mode,
    };
    project.trackSnapshot(snap);
  });

  // ── التصدير ───────────────────────────────────────────────────────────
  const estimatedMb = useMemo(() => {
    const total = producer.editedTotalSec;
    if (exportSettings.mode === 'video') {
      const mbps = exportSettings.quality === '1080' ? 8 : exportSettings.quality === '720' ? 5 : 2.5;
      return Math.max(1, Math.round((total * mbps) / 8));
    }
    return Math.max(1, Math.round((total * exportSettings.bitrateKbps) / 8 / 1024));
  }, [producer.editedTotalSec, exportSettings]);

  const runExport = useCallback(async (override?: Partial<ProductionExportSettings>) => {
    if (!producer.source || !producer.edit) {
      showToast('حمّل تلاوة أولاً من مكتبة القرآن');
      return;
    }
    const settings = override ? { ...exportSettings, ...override } : exportSettings;
    if (settings.mode === 'audio') {
      await exporter.exportAudio({
        source: producer.source,
        edit: producer.edit,
        echo: producer.echo,
        musicBuffer: null,
        musicGain: mixer.musicGain,
        effectClips: clips.effectClips,
        totalSec: producer.editedTotalSec,
        settings,
      });
      return;
    }
    // تصدير مرئي: تسجيل المعاينة الحية (مزيج المِكسر نفسه).
    const canvas = canvasRef.current;
    if (!canvas) {
      showToast('لا توجد معاينة جاهزة');
      return;
    }
    await exporter.recordVideo({
      canvas,
      audioStream: mixer.ensureCaptureStream(),
      totalSec: producer.editedTotalSec,
      settings,
      startPlayback: async () => {
        producer.seekEdited(0);
        await producer.play();
      },
      stopPlayback: () => producer.pause(),
      getPlayheadSec: () => playheadLiveRef.current,
    });
  }, [canvasRef, clips.effectClips, exportSettings, exporter, mixer, producer]);

  const handleAction = useProductionCommands({
    producer,
    mixer,
    project,
    clips,
    verseSpans,
    visuals,
    loadRecitation,
    applyProjectData,
    runExport,
    setDialog,
    setVisuals,
    setExportSettings,
    setProjectName,
    audioFileInputRef,
    showToast,
    mode,
  });

  const canEdit = mode !== 'preview';

  // ── الحجم التقديري/العرض ──────────────────────────────────────────────
  return {
    // المصادر (بلا مراجع — قاعدة refs: العرض يملك المراجع)
    producer,
    verses,
    project,
    exporter,
    waitForChapter,
    // مزيج الخلاط (مُسطّح — بلا مراجع)
    musicState: mixer.musicState,
    musicGain: mixer.musicGain,
    setMusicGain: mixer.setMusicGain,
    loadMusic: mixer.loadMusic,
    removeMusic: mixer.removeMusic,
    recording: mixer.recording,
    recorderSec: mixer.recorderSec,
    startRecording: mixer.startRecording,
    finishRecording: mixer.finishRecording,
    cancelRecording: mixer.cancelRecording,
    ensureCaptureStream: mixer.ensureCaptureStream,
    // راسم الإطار (مُسطّح — بلا مراجع)
    filmstrip: frame.filmstrip,
    bgUrl: frame.bgUrl,
    // الحالة
    mode,
    setMode,
    dialog,
    setDialog,
    projectName,
    setProjectName,
    surahId,
    setSurahId,
    surahName,
    fromAyah,
    setFromAyah,
    toAyah,
    setToAyah,
    reciterSlug,
    setReciterSlug,
    reciterName,
    translationId,
    setTranslationId,
    visuals,
    setVisuals,
    exportSettings,
    setExportSettings,
    textClips: clips.textClips,
    addTextClip: clips.addTextClip,
    updateTextClip: clips.updateTextClip,
    removeTextClip: clips.removeTextClip,
    effectClips: clips.effectClips,
    timelineEffectClips: clips.timelineEffectClips,
    addAmbientClip: clips.addAmbientClip,
    removeEffectClip: clips.removeEffectClip,
    zoom,
    setZoom,
    trackVisibility,
    setTrackVisibility,
    recordings,
    setRecordings,
    canEdit,
    // مشتقات العرض
    editedPeaks,
    verseSpans,
    estimatedMb,
    activeVerse,
    translationText,
    canvasW,
    canvasH,
    loadRecitation,
    applyProjectData,
    runExport,
    handleAction,
    showToast,
  };
}

export type ProductionStudioController = ReturnType<typeof useProductionStudio>;

/** فهرس سريع للخطوط والتدرجات للحوارات. */
export const PRODUCTION_FONTS = STUDIO_FONTS;
export const PRODUCTION_GRADIENTS = STUDIO_GRADIENTS;
export { getBuiltinBackground, formatProductionClock };
