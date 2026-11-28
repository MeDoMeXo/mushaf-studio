'use client';

/**
 * useProducerExport — التصدير والتسليم من «منتج الصوت»:
 * رندر المقطع المحرَّر (مرور الصدى في المحرّك مشترك عبر ensureRendered)
 * ثم ترميز WAV وتنزيله، أو تسليمه إلى الاستوديو للإنتاج الكامل مع خلفية
 * مختارة من المكتبة — مستخرج من use-audio-producer وفق حد الـ 600 سطر.
 */
import { useCallback, useState, type RefObject } from 'react';
import {
  downloadBlob,
  encodeWav16bit,
  type ProducerSource,
} from '@/lib/audio-producer/audio-producer-engine';
import {
  mapSourceMarkersToEdited,
  totalKeptSec,
  type ProducerEditState,
} from '@/lib/audio-producer/audio-producer-edit';
import {
  buildProducerFilename,
  setProducerHandoff,
  type ProducerHandoff,
} from '@/lib/audio-producer/producer-handoff';
import type { ProducerEchoSettings } from '@/lib/audio-producer/producer-echo';

export function useProducerExport(options: {
  sourceRef: RefObject<ProducerSource | null>;
  editRef: RefObject<ProducerEditState | null>;
  /** الصدى الحالي — يصل المحرّك عبر الرندر المشترك فلا نحتاجه هنا إلا للسياق. */
  echoRef: RefObject<ProducerEchoSettings | null>;
  ensureRendered: () => Promise<AudioBuffer | null>;
  showToast: (msg: string) => void;
}) {
  const { sourceRef, editRef, ensureRendered, showToast } = options;
  const [rendering, setRendering] = useState(false);

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
  }, [editRef, ensureRendered, showToast, sourceRef]);

  const exportWav = useCallback(async () => {
    const file = await buildExportFile();
    if (!file) return;
    downloadBlob(file, file.name);
    showToast(`تم تصدير المقطع المحرَّر: ${file.name}`);
  }, [buildExportFile, showToast]);

  const sendToStudio = useCallback(
    async (opts?: {
      range?: { surahId: number; fromAyah: number; toAyah: number };
      /** خلفية مختارة من مكتبة الاستوديو تُطبَّق فور الاستلام — أو null. */
      bgLibraryId?: string | null;
    }): Promise<boolean> => {
      const file = await buildExportFile();
      if (!file) return false;
      const src = sourceRef.current;
      const st = editRef.current;
      if (!src || !st) return false;
      const handoff: ProducerHandoff = {
        file,
        label: `${src.label} — مُنتَج المحرر`,
        verseBoundsSec: mapSourceMarkersToEdited(st, src.verseMarkersSec),
        verseNumbers: src.verseNumbers,
        surahId: opts?.range?.surahId ?? 1,
        fromAyah: opts?.range?.fromAyah ?? 1,
        toAyah:
          opts?.range?.toAyah ??
          (src.verseNumbers.length > 0
            ? Math.max(...src.verseNumbers)
            : src.verseMarkersSec.length),
        bgLibraryId: opts?.bgLibraryId ?? null,
        createdAt: Date.now(),
      };
      setProducerHandoff(handoff);
      showToast('جارٍ فتح الاستوديو مع المقطع المحرَّر…');
      return true;
    },
    [buildExportFile, editRef, showToast, sourceRef]
  );

  return { rendering, buildExportFile, exportWav, sendToStudio };
}

export type ProducerExportController = ReturnType<typeof useProducerExport>;
