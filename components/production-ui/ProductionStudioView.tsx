'use client';

/**
 * ProductionStudioView — الواجهة الكاملة لاستوديو تحرير القرآن الكريم.
 *
 * التوزيع المرجعي (RTL): الهيدر + شريط القوائم فوق، ثم شريط المشروع
 * والنقل، ثم الشبكة: مكتبة الوسائط (يمين) + المعاينة (وسط) + أدوات
 * التحرير (يسار) + الخطوط الزمنية أسفل الوسط/اليسار + إعدادات التصدير
 * أسفل اليمين + شريط الحالة في القاع.
 *
 * المراجع (كانفيس/فيديو الخلفية/رافع الملف) يملكها هذا العرض وتُمرَّر
 * إلى الخطاف الجذر (قاعدة react-hooks/refs).
 */
import { useEffect, useRef } from 'react';
import { useProductionStudio } from '@/hooks/use-production-studio';
import { getBuiltinBackground } from '@/lib/background-library';
import { StudioBgVideoElement } from '@/components/studio-ui/StudioBgVideoElement';
import { ProductionHeader } from './ProductionHeader';
import { ProductionSubBar } from './ProductionSubBar';
import { ProductionLeftToolbar } from './ProductionLeftToolbar';
import { ProductionPreview } from './ProductionPreview';
import { ProductionMediaLibrary } from './ProductionMediaLibrary';
import { ProductionTimeline } from './ProductionTimeline';
import { ProductionExportPanel } from './ProductionExportPanel';
import { ProductionStatusBar } from './ProductionStatusBar';
import { ProductionDialogHost } from './ProductionDialogHost';

export function ProductionStudioView() {
  // المراجع ملك العرض — تُغذّي الراسم والفيديو والرافع.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const ctl = useProductionStudio({ canvasRef, videoRef, audioFileInputRef });
  const { producer, project, exporter } = ctl;

  // ── اختصارات لوحة المفاتيح ────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        producer.togglePlay();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) producer.redo();
        else producer.undo();
      } else if (e.key === 'Home') {
        producer.seekToEdge('start');
      } else if (e.key === 'End') {
        producer.seekToEdge('end');
      } else if (e.key === 'ArrowLeft') {
        producer.seekEdited(producer.playheadEditedSec + 2);
      } else if (e.key === 'ArrowRight') {
        producer.seekEdited(Math.max(0, producer.playheadEditedSec - 2));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [producer]);

  const removeEffect = (id: string) => {
    if (id === 'echo-visual') {
      producer.setEcho({ enabled: false });
      return;
    }
    ctl.removeEffectClip(id);
  };

  const loadingLabel =
    producer.loadState.status === 'loading'
      ? `جلب التلاوة… ${producer.loadState.done}/${producer.loadState.total}`
      : producer.loadState.status === 'error'
        ? (producer.loadState.message ?? 'خطأ في التحميل')
        : null;

  const bgName = getBuiltinBackground(ctl.visuals.bgId)?.name ?? 'تدرّج مخصص';
  const saveState: 'saved' | 'dirty' | 'saving' = project.dirty ? 'dirty' : 'saved';

  return (
    <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-2.5 px-3 pb-3 sm:gap-3 sm:px-4">
      {/* الشريط العلوي + شريط القوائم العشر */}
      <ProductionHeader
        onAction={ctl.handleAction}
        showTranslation={ctl.visuals.showTranslation}
        canSave={producer.source !== null}
        saveState={saveState}
      />

      {/* شريط المشروع والنقل الصوتي */}
      <ProductionSubBar
        projectName={`${ctl.surahName} — ${ctl.reciterName}`}
        exportSettings={ctl.exportSettings}
        onExportSettings={(patch) => ctl.setExportSettings((s) => ({ ...s, ...patch }))}
        isPlaying={producer.isPlaying}
        onTogglePlay={producer.togglePlay}
        onStop={() => {
          producer.pause();
          producer.seekEdited(0);
        }}
        onPrevVerse={() => producer.seekToVerse(Math.max(0, producer.activeVerseIdx - 1))}
        onNextVerse={() => producer.seekToVerse(producer.activeVerseIdx + 1)}
        playheadSec={producer.playheadEditedSec}
        totalSec={producer.editedTotalSec}
        volume={producer.volume}
        onVolume={(v) => producer.setVolume(v)}
      />

      {/* الشبكة الرئيسية: مكتبة (يمين) · معاينة (وسط) · أدوات (يسار) · مسارات + تصدير أسفل */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[260px_minmax(0,1fr)_215px] xl:grid-rows-[minmax(0,1fr)_318px]">
        {/* يمين أعلى: مكتبة الوسائط */}
        <div className="order-3 min-h-0 xl:order-1 xl:row-span-1">
          <ProductionMediaLibrary
            activeBgId={ctl.visuals.bgId}
            onApplyBackground={(bgId) => ctl.setVisuals((v) => ({ ...v, bgId }))}
            onAddMusic={() => ctl.setDialog('music')}
            onRemoveMusic={ctl.removeMusic}
            hasMusic={ctl.musicState !== null}
            musicName={ctl.musicState?.name ?? null}
            effectClips={ctl.timelineEffectClips}
            onAddAmbient={ctl.addAmbientClip}
            onRemoveEffect={removeEffect}
          />
        </div>

        {/* وسط: المعاينة */}
        <div className="order-1 flex min-h-[420px] flex-col xl:order-2 xl:row-span-1">
          <ProductionPreview
            canvasRef={canvasRef}
            canvasW={ctl.canvasW}
            canvasH={ctl.canvasH}
            isPlaying={producer.isPlaying}
            onTogglePlay={producer.togglePlay}
            playheadSec={producer.playheadEditedSec}
            totalSec={producer.editedTotalSec}
            onUndo={producer.undo}
            onRedo={producer.redo}
            canUndo={producer.canUndo}
            canRedo={producer.canRedo}
            zoom={ctl.zoom}
            onZoom={ctl.setZoom}
            onZoomFit={() => ctl.setZoom(1)}
            trackVisibility={ctl.trackVisibility}
            onToggleTrack={(t) => ctl.setTrackVisibility((v) => ({ ...v, [t]: !v[t] }))}
            visuals={ctl.visuals}
            onVisuals={(patch) => ctl.setVisuals((v) => ({ ...v, ...patch }))}
            loadingLabel={loadingLabel}
            onFullscreen={() => canvasRef.current?.requestFullscreen?.()}
          />
        </div>

        {/* يسار: أدوات التحرير */}
        <div className="order-2 xl:order-3 xl:row-span-2">
          <ProductionLeftToolbar
            mode={ctl.mode}
            onMode={ctl.setMode}
            onTool={ctl.handleAction}
            canEdit={ctl.canEdit}
          />
        </div>

        {/* أسفل الوسط/اليسار: المسارات الزمنية */}
        <div className="order-4 min-w-0 xl:col-start-2 xl:col-end-4 xl:row-start-2">
          <ProductionTimeline
            totalSec={producer.editedTotalSec}
            playheadSec={producer.playheadEditedSec}
            onSeek={(sec) => producer.seekEdited(sec)}
            peaks={ctl.editedPeaks}
            musicPeaks={ctl.musicState?.peaks ?? null}
            verseSpans={ctl.verseSpans}
            gaps={[]}
            textClips={ctl.textClips}
            onTextClipUpdate={ctl.updateTextClip}
            effectClips={ctl.timelineEffectClips}
            onRemoveEffect={removeEffect}
            zoom={ctl.zoom}
            onZoom={ctl.setZoom}
            onZoomFit={() => ctl.setZoom(1)}
            trackVisibility={ctl.trackVisibility}
            onToggleTrack={(t) => ctl.setTrackVisibility((v) => ({ ...v, [t]: !v[t] }))}
            filmstrip={ctl.filmstrip}
            videoLabel={bgName}
          />
        </div>

        {/* أسفل اليمين: إعدادات التصدير */}
        <div className="order-5 xl:col-start-1 xl:row-start-2">
          <ProductionExportPanel
            exportSettings={ctl.exportSettings}
            onExportSettings={(patch) => ctl.setExportSettings((s) => ({ ...s, ...patch }))}
            onExport={() => void ctl.runExport()}
            onCancelExport={exporter.cancelExport}
            exporting={exporter.exporting}
            progress={exporter.progress?.ratio ?? null}
            progressLabel={exporter.progress?.phase}
            estimatedMb={ctl.estimatedMb}
          />
        </div>
      </div>

      {/* شريط الحالة */}
      <ProductionStatusBar
        totalSec={producer.editedTotalSec}
        sizeMb={ctl.estimatedMb}
        savedAt={project.savedAt}
        onNew={() => ctl.handleAction('project:new')}
        onOpen={() => ctl.setDialog('open-project')}
        onSaveAs={() => ctl.setDialog('save-as')}
      />

      {/* عنصر فيديو الخلفية الخفي + رافع الملفات الصوتي */}
      <StudioBgVideoElement
        videoRef={videoRef}
        src={ctl.bgUrl}
        playing={producer.isPlaying}
        speed={1}
        onReady={() => {
          /* الراسم يسحب الإطار كل رسمة */
        }}
      />
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void producer.loadFile(f);
          e.target.value = '';
        }}
        aria-hidden="true"
      />

      {/* الحوارات */}
      <ProductionDialogHost ctl={ctl} />
    </div>
  );
}
