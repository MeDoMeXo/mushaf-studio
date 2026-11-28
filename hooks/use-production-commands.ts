'use client';

/**
 * use-production-commands — موزّع أوامر قوائم استوديو الإنتاج.
 *
 * كل عنصر قائمة في الشريط العلوي/أدوات اليسار يُمرَّر هنا ويُوزَّع على
 * الحوارات أو العمليات الفعلية (قص/دمج/تنقية/حدود آيات/تصدير…) —
 * مقصوص من الجذر (حد ٦٠٠ سطر/ملف).
 */
import { useCallback } from 'react';
import type { AudioProducerController } from '@/hooks/use-audio-producer';
import type { ProductionMixer } from '@/hooks/use-production-mixer';
import type { ProductionClips } from '@/hooks/use-production-clips';
import type { EditedVerseSpan } from '@/lib/production/production-timeline-mapping';
import type {
  ProductionDialogId,
  ProductionExportSettings,
  ProductionMenuActionId,
  ProductionVisuals,
} from '@/lib/production/production-types';

export interface ProductionCommandsContext {
  producer: AudioProducerController;
  mixer: ProductionMixer;
  project: {
    newProject(): void;
    saveProject(name?: string): string | null;
    restoreAutosave(): import('@/lib/production/production-types').ProductionProjectData | null;
    peekLastProject(): string | null;
    openProject(id: string): import('@/lib/production/production-types').ProductionProjectData | null;
    deleteProject(id: string): void;
    dirty: boolean;
    projects: unknown[];
    savedAt: number | null;
    trackSnapshot(input: unknown): void;
  };
  clips: ProductionClips;
  verseSpans: EditedVerseSpan[];
  visuals: ProductionVisuals;
  loadRecitation(opts?: { surah?: number; from?: number; to?: number; reciter?: string }): Promise<boolean>;
  applyProjectData(data: import('@/lib/production/production-types').ProductionProjectData): Promise<void>;
  runExport(override?: Partial<ProductionExportSettings>): Promise<void>;
  setDialog(d: ProductionDialogId): void;
  setVisuals: React.Dispatch<React.SetStateAction<ProductionVisuals>>;
  setExportSettings: React.Dispatch<React.SetStateAction<ProductionExportSettings>>;
  setProjectName(name: string): void;
  audioFileInputRef: React.RefObject<HTMLInputElement | null>;
  showToast(msg: string): void;
  /** نمط التحرير الحالي (يقود بوابة العمليات المدمّرة). */
  mode: import('@/lib/production/production-types').ProductionEditMode;
}

export function useProductionCommands(ctx: ProductionCommandsContext): (id: ProductionMenuActionId) => void {
  const { producer, mixer, project, clips, verseSpans, visuals } = ctx;
  const { setDialog, setVisuals, setExportSettings, setProjectName } = ctx;
  const { loadRecitation, applyProjectData, runExport } = ctx;
  const { audioFileInputRef, showToast, mode } = ctx;

  // ── توزيع الأوامر (قوائم الشريط العلوي + أدوات اليسار) ───────────────
  const canEdit = mode !== 'preview';
  const quickGuard = useCallback(
    (fn: () => void) =>
      () => {
        if (mode === 'preview') {
          showToast('وضع المعاينة فقط — بدّل إلى تحرير متقدم/سريع');
          return;
        }
        fn();
      },
    [mode]
  );

  const handleAction = useCallback(
    (id: ProductionMenuActionId) => {
      void mixer.resumeContext();
      switch (id) {
        // المشاريع
        case 'project:new':
          producer.clearSource();
          project.newProject();
          setProjectName('مشروع جديد');
          clips.setTextClips([]);
          clips.setEffectClips([]);
          showToast('مشروع جديد فارغ — اختر سورة من مكتبة القرآن');
          break;
        case 'project:open':
          setDialog('open-project');
          break;
        case 'project:save':
          project.saveProject();
          break;
        case 'project:restore': {
          const data = project.restoreAutosave();
          if (data) void applyProjectData(data);
          break;
        }
        // مكتبة القرآن
        case 'quran:surahs':
          setDialog('surah-picker');
          break;
        case 'quran:verses':
          setDialog('verse-range');
          break;
        case 'quran:recitation':
          void loadRecitation();
          break;
        case 'quran:reciters':
          setDialog('reciters');
          break;
        // مكتبة الصوت
        case 'sound:recordings':
          setDialog('recordings');
          break;
        case 'sound:effects':
          setDialog('effects');
          break;
        case 'sound:ambient':
          setDialog('ambient');
          break;
        // مكتبة الصور
        case 'images:backgrounds':
          setDialog('bg-images');
          break;
        case 'images:ornaments':
          setDialog('ornaments');
          break;
        case 'images:logos':
          setDialog('watermark');
          break;
        // تحرير الصوت
        case 'audio:clean':
          quickGuard(() => setDialog('clean'))();
          break;
        case 'audio:denoise':
          quickGuard(() => setDialog('denoise'))();
          break;
        case 'audio:level':
          quickGuard(() => setDialog('level'))();
          break;
        // تحرير الفيديو
        case 'video:cut':
        case 'tool:cut':
          quickGuard(() => setDialog('cut'))();
          break;
        case 'video:merge':
        case 'tool:merge':
          quickGuard(() => {
            if (producer.silences.length === 0) producer.detectSilences();
            producer.removeSilences();
          })();
          break;
        case 'video:transitions':
          setDialog('transitions');
          break;
        case 'video:animate':
          setDialog('animate');
          break;
        // النصوص
        case 'text:verses': {
          // مقطع لكل آية على مسار النصوص (يمكن إخفاء نص آية منها).
          const spans = verseSpans;
          if (!spans.length) {
            showToast('حمّل التلاوة أولاً');
            break;
          }
          clips.setTextClips((prev) => {
            const fresh = prev.filter((c) => c.kind !== 'verse');
            for (const sp of spans) {
              fresh.push({
                id: `verse-${sp.number}`,
                text: `الآية ${sp.number}`,
                kind: 'verse',
                startSec: sp.startSec,
                endSec: sp.endSec,
                color: '#5eb8e8',
                scale: 1,
              });
            }
            return fresh;
          });
          showToast('أُضيفت مقاطع الآيات على مسار النصوص');
          break;
        }
        case 'text:surah':
          setVisuals((v) => ({ ...v, showSurahTitle: !v.showSurahTitle }));
          break;
        case 'text:reciter':
          setVisuals((v) => ({ ...v, showReciterName: !v.showReciterName }));
          break;
        case 'text:custom':
          setDialog('custom-text');
          break;
        // الترجمة
        case 'translation:pick':
          setDialog('translation');
          break;
        case 'translation:toggle':
          setVisuals((v) => ({ ...v, showTranslation: !v.showTranslation }));
          showToast(visuals.showTranslation ? 'أُخفيت الترجمة' : 'تُعرض الترجمة أسفل الآية');
          break;
        // التوقيت والمزامنة
        case 'sync:verses':
          setDialog('sync');
          break;
        // التصدير
        case 'export:mp3':
          setExportSettings((s) => ({ ...s, mode: 'audio', format: 'mp3' }));
          void runExport({ mode: 'audio', format: 'mp3' });
          break;
        case 'export:wav':
          setExportSettings((s) => ({ ...s, mode: 'audio', format: 'wav' }));
          void runExport({ mode: 'audio', format: 'wav' });
          break;
        case 'export:mp4':
          setExportSettings((s) => ({ ...s, mode: 'video', format: 'mp4' }));
          void runExport({ mode: 'video', format: 'mp4' });
          break;
        case 'export:quality':
          showToast('اضبط الجودة من لوحة «إعدادات التصدير» أسفل اليسار');
          break;
        // الأدوات
        case 'tool:effects':
          setDialog('effects');
          break;
        case 'tool:enhance':
          setDialog('level');
          break;
        case 'tool:music':
          setDialog('music');
          break;
        case 'tool:text':
          setDialog('custom-text');
          break;
        case 'tool:image':
          setDialog('bg-images');
          break;
        case 'tool:record':
          setDialog('record');
          break;
        case 'tool:upload':
          audioFileInputRef.current?.click();
          break;
        // التطبيق
        case 'app:settings':
          setDialog('settings');
          break;
        case 'app:help':
          setDialog('help');
          break;
        case 'app:export':
          void runExport();
          break;
        case 'app:save':
          project.saveProject();
          break;
        default:
          break;
      }
    },
    [applyProjectData, audioFileInputRef, loadRecitation, mixer, producer, project, quickGuard, runExport, verseSpans, visuals.showTranslation]
  );

  return handleAction;
}
