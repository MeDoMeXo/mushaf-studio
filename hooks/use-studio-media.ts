'use client';

/**
 * useStudioMedia — custom background/asset upload state & handlers.
 * Extracted from StudioView per the 600-line file rule: owns bg image/video
 * and custom audio upload state plus their file-input handlers.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getBuiltinBackground,
  getBuiltinBackgroundPublicPath,
  type BuiltinBackground,
} from '@/lib/background-library';
import {
  analyzeCustomAudioFile,
  buildEvenFallbackBounds,
} from '@/lib/custom-audio-boundaries';
import type { StudioState } from '@/lib/quran-data';

export interface UseStudioMediaInput {
  commitState: (
    updater: (prev: StudioState) => StudioState
  ) => void;
  showToast: (msg: string) => void;
  /** Current state.bgLibraryId — keeps the preview <video> in sync when a
   * saved/shared template applies a library background (no File object then). */
  bgLibraryId?: string | null;
  /** Current state.bgType, to gate the sync below to video mode only. */
  bgType?: StudioState['bgType'];
  /** عدد الآيات المحددة حالياً — يلزم الكشف التلقائي لحدود الآيات فور رفع
   *  الملف الصوتي المخصص (التتبّع يعمل مباشرة دون خطوة يدوية). */
  verseCount?: number;
}

export interface UseStudioMediaResult {
  bgVideoUrl: string | null;
  bgVideoFile: File | null;
  bgVideoName: string;
  bgVideoReady: boolean;
  setBgVideoReady: React.Dispatch<React.SetStateAction<boolean>>;
  bgVideoPlaying: boolean;
  setBgVideoPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  customAudioUrl: string | null;
  customAudioFile: File | null;
  customAudioName: string;
  setCustomAudioUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setCustomAudioFile: React.Dispatch<React.SetStateAction<File | null>>;
  setCustomAudioName: React.Dispatch<React.SetStateAction<string>>;
  bgVideoElRef: React.RefObject<HTMLVideoElement | null>;
  handleBgFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBgVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectBgLibrary: (bg: BuiltinBackground) => void;
  handleRemoveBgVideo: () => void;
  handleAudioFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function useStudioMedia({
  commitState,
  showToast,
  bgLibraryId,
  bgType,
  verseCount,
}: UseStudioMediaInput): UseStudioMediaResult {
  const [bgVideoUrl, setBgVideoUrl] = useState<string | null>(null);
  const [bgVideoFile, setBgVideoFile] = useState<File | null>(null);
  const [bgVideoName, setBgVideoName] = useState<string>('');
  const [bgVideoReady, setBgVideoReady] = useState(false);
  const [bgVideoPlaying, setBgVideoPlaying] = useState(true);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [customAudioName, setCustomAudioName] = useState<string>('');
  const bgVideoElRef = useRef<HTMLVideoElement | null>(null);

  // Template/share links can set bgLibraryId without touching local media
  // state (no File object) — sync the preview <video> src to the library clip
  // so the preview matches what the export will render (parity invariant).
  useEffect(() => {
    if (bgType !== 'video' || !bgLibraryId || bgVideoFile) return;
    const url = getBuiltinBackgroundPublicPath(bgLibraryId);
    if (!url || url === bgVideoUrl) return;
    // Defer to a macrotask: setState must not run synchronously inside the
    // effect body (react-hooks/set-state-in-effect — same fix as TransitionPreviewCard).
    const tid = setTimeout(() => {
      setBgVideoUrl(url);
      setBgVideoName(getBuiltinBackground(bgLibraryId)?.name ?? '');
      setBgVideoReady(false);
      setBgVideoPlaying(true);
    }, 0);
    return () => clearTimeout(tid);
  }, [bgType, bgLibraryId, bgVideoFile, bgVideoUrl]);

  const handleBgFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        commitState((p) => ({
          ...p,
          bgType: 'image',
          bgImage: String(reader.result),
        }));
        showToast('تم تحميل صورة الخلفية');
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [commitState, showToast]
  );

  const handleBgVideoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setBgVideoReady(false);
      setBgVideoUrl(url);
      setBgVideoFile(file);
      setBgVideoName(file.name);
      setBgVideoPlaying(true);
      commitState((p) => ({ ...p, bgType: 'video', bgLibraryId: null }));
      showToast(`تم تحميل الفيديو المتحرك للخلفية: ${file.name}`);
      e.target.value = '';
    },
    [commitState, showToast]
  );

  const handleSelectBgLibrary = useCallback(
    (bg: BuiltinBackground) => {
      const url = getBuiltinBackgroundPublicPath(bg.id);
      if (!url) return;
      bgVideoElRef.current?.pause();
      // Library clips stream straight from public/ — no File object, so the
      // export pipeline sends only the id and the server copies the asset.
      setBgVideoUrl(url);
      setBgVideoFile(null);
      setBgVideoName(bg.name);
      setBgVideoReady(false);
      setBgVideoPlaying(true);
      commitState((p) => ({ ...p, bgType: 'video', bgLibraryId: bg.id }));
      showToast(`تم اختيار خلفية من المكتبة: ${bg.name}`);
    },
    [commitState, showToast]
  );

  const handleRemoveBgVideo = useCallback(() => {
    bgVideoElRef.current?.pause();
    setBgVideoUrl(null);
    setBgVideoFile(null);
    setBgVideoName('');
    setBgVideoReady(false);
    commitState((p) => ({ ...p, bgType: 'gradient', bgLibraryId: null }));
    showToast('تمت إزالة الفيديو المتحرك');
  }, [commitState, showToast]);

  const handleAudioFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setCustomAudioUrl(url);
      setCustomAudioFile(file);
      setCustomAudioName(file.name);
      showToast(`تم إرفاق المقطع الصوتي: ${file.name}`);

      // كشف تلقائي لحدود الآيات فور الرفع (Web Audio في المتصفح، بلا رفع
      // للخادم) — يضمن عمل تتبّع الكلمات والتقدّم بين الآيات مباشرة دون
      // خطوة يدوية. عند تعذّر الكشف نطبّق توزيعاً متساوياً كنقطة انطلاق
      // يقوّمها المستخدم يدوياً من لوحة «حدود الآيات».
      const count = Math.max(1, Math.floor(verseCount ?? 1));
      void analyzeCustomAudioFile(file, count)
        .then((result) => {
          if (result.ok && result.starts.length === count) {
            commitState((p) => ({
              ...p,
              customVerseBounds: result.starts,
              customVerseBoundsSource: 'auto',
            }));
            showToast('تم كشف حدود الآيات تلقائياً — راجعها وعدّلها إن لزم');
          } else if (result.durationSec > 0) {
            const fallback = buildEvenFallbackBounds(count, result.durationSec);
            if (fallback.length === count) {
              commitState((p) => ({
                ...p,
                customVerseBounds: fallback,
                customVerseBoundsSource: 'auto',
              }));
            }
            showToast(
              'تعذّر كشف الفواصل بدقة — طُبّق توزيع متساوٍ، عدّل الحدود يدوياً من لوحة حدود الآيات'
            );
          }
        })
        .catch(() => {
          /* التحليل اختياري — اللوحة اليدوية تبقى متاحة */
        });
      e.target.value = '';
    },
    [commitState, showToast, verseCount]
  );

  return {
    bgVideoUrl,
    bgVideoFile,
    bgVideoName,
    bgVideoReady,
    setBgVideoReady,
    bgVideoPlaying,
    setBgVideoPlaying,
    customAudioUrl,
    customAudioFile,
    customAudioName,
    setCustomAudioUrl,
    setCustomAudioFile,
    setCustomAudioName,
    bgVideoElRef,
    handleBgFileUpload,
    handleBgVideoUpload,
    handleSelectBgLibrary,
    handleRemoveBgVideo,
    handleAudioFileUpload,
  };
}
