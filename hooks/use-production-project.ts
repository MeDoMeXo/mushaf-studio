'use client';

/**
 * use-production-project — إدارة مشاريع استوديو الإنتاج.
 *
 * يبني حالة المشروع القابلة للتخزين (ProductionProjectData) من حالة
 * الاستوديو الحالية، يطبّقها عند الفتح (مع إعادة تحميل التلاوة)، يحفظ
 * يدوياً وبأسماء، ويحفظ تلقائياً كل ١٥ ثانية لاستعادة آمنة.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearProductionAutosave,
  deleteProductionProject,
  listProductionProjects,
  loadProductionProject,
  readLastProjectId,
  readProductionAutosave,
  rememberLastProject,
  saveProductionProject,
  writeProductionAutosave,
} from '@/lib/production/production-project-store';
import type {
  ProductionEditMode,
  ProductionProjectData,
  ProductionProjectSummary,
  ProductionVisuals,
  ProductionTextClip,
  ProductionEffectClip,
  ProductionExportSettings,
} from '@/lib/production/production-types';
import type { ProducerEchoSettings } from '@/lib/audio-producer/producer-echo';
import type { ProducerEditState } from '@/lib/audio-producer/audio-producer-edit';

const AUTOSAVE_INTERVAL_MS = 15000;

export interface ProjectSnapshotInput {
  name: string;
  surahId: number;
  fromAyah: number;
  toAyah: number;
  reciterSlug: string;
  reciterName: string;
  translationId: number;
  surahName: string;
  durationSec: number;
  edit: ProducerEditState | null;
  verseMarkersSec: number[] | null;
  echo: ProducerEchoSettings;
  visual: ProductionVisuals;
  exportSettings: ProductionExportSettings;
  textClips: ProductionTextClip[];
  effectClips: ProductionEffectClip[];
  musicName: string | null;
  musicGain: number;
  volume: number;
  rate: number;
  mode: ProductionEditMode;
}

export function useProductionProject(options: {
  showToast: (msg: string) => void;
  hasAnyWork: boolean;
}) {
  const { showToast, hasAnyWork } = options;
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProductionProjectSummary[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const inputRef = useRef<ProjectSnapshotInput | null>(null);
  const dirtyFlagRef = useRef(false);
  const currentIdRef = useRef<string | null>(null);
  /** بصمة آخر لقطة متتبَّعة — تغيّرها يعني تغييرات غير محفوظة. */
  const lastSigRef = useRef<string | null>(null);

  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);
  useEffect(() => {
    dirtyFlagRef.current = dirty;
  }, [dirty]);

  const refreshList = useCallback(() => {
    setProjects(listProductionProjects());
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setProjects(listProductionProjects());
    });
    return () => {
      active = false;
    };
  }, [refreshList]);

  /**
   * تُحدَّث لقطة المشروع في كل رندر — يُقارن مع آخر بصمة: التغيّر الفعلي
   * فقط يوسم المشروع «غير محفوظ»، وبعد الحفظ/الفتح تُعاد البصمة صفراً.
   */
  const trackSnapshot = useCallback((input: ProjectSnapshotInput) => {
    inputRef.current = input;
    const sig = JSON.stringify(input);
    if (lastSigRef.current === null) {
      lastSigRef.current = sig;
      return;
    }
    if (sig !== lastSigRef.current) {
      lastSigRef.current = sig;
      setDirty(true);
    }
  }, []);

  // ── الحفظ ───────────────────────────────────────────────────────────

  const buildData = useCallback((): ProjectSnapshotInput | null => inputRef.current, []);

  const saveProject = useCallback(
    (nameOverride?: string) => {
      const snap = buildData();
      if (!snap) {
        showToast('لا يوجد ما يُحفظ بعد — اختر تلاوة أولاً');
        return null;
      }
      const name = (nameOverride ?? snap.name).trim() || `مشروع ${snap.surahName}`;
      const data: ProductionProjectData = {
        version: 1,
        name,
        surahId: snap.surahId,
        fromAyah: snap.fromAyah,
        toAyah: snap.toAyah,
        reciterSlug: snap.reciterSlug,
        reciterName: snap.reciterName,
        translationId: snap.translationId,
        edit: snap.edit,
        verseMarkersSec: snap.verseMarkersSec,
        echo: snap.echo,
        visual: snap.visual,
        exportSettings: snap.exportSettings,
        textClips: snap.textClips,
        effectClips: snap.effectClips,
        musicName: snap.musicName,
        musicGain: snap.musicGain,
        volume: snap.volume,
        rate: snap.rate,
        mode: snap.mode,
      };
      const id = saveProductionProject(currentIdRef.current, data, {
        surahName: snap.surahName,
        durationSec: snap.durationSec,
      });
      if (!id) {
        showToast('تعذّر الحفظ — حجم المشروع كبير (راجع المشاريع القديمة)');
        return null;
      }
      setCurrentId(id);
      rememberLastProject(id);
      setSavedAt(Date.now());
      setDirty(false);
      lastSigRef.current = null;
      refreshList();
      showToast(`حُفظ المشروع: ${name}`);
      return id;
    },
    [buildData, refreshList, showToast]
  );

  // ── الحفظ التلقائي ──────────────────────────────────────────────────

  useEffect(() => {
    const timer = setInterval(() => {
      const snap = inputRef.current;
      if (!snap || !hasAnyWork) return;
      const data: ProductionProjectData = {
        version: 1,
        name: snap.name,
        surahId: snap.surahId,
        fromAyah: snap.fromAyah,
        toAyah: snap.toAyah,
        reciterSlug: snap.reciterSlug,
        reciterName: snap.reciterName,
        translationId: snap.translationId,
        edit: snap.edit,
        verseMarkersSec: snap.verseMarkersSec,
        echo: snap.echo,
        visual: snap.visual,
        exportSettings: snap.exportSettings,
        textClips: snap.textClips,
        effectClips: snap.effectClips,
        musicName: snap.musicName,
        musicGain: snap.musicGain,
        volume: snap.volume,
        rate: snap.rate,
        mode: snap.mode,
      };
      writeProductionAutosave(data, {
        surahName: snap.surahName,
        durationSec: snap.durationSec,
      });
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasAnyWork]);

  /** استعادة آخر حفظ تلقائي (قائمة المشاريع → استعادة). */
  const restoreAutosave = useCallback((): ProductionProjectData | null => {
    const raw = readProductionAutosave();
    if (!raw) {
      showToast('لا يوجد حفظ تلقائي حديث');
      return null;
    }
    showToast(`استُعيدت نسخة محفوظة تلقائياً (${new Date(raw.at).toLocaleTimeString('ar')})`);
    return raw.data;
  }, [showToast]);

  // ── الفتح/الحذف ─────────────────────────────────────────────────────

  const openProject = useCallback(
    (id: string): ProductionProjectData | null => {
      const data = loadProductionProject(id);
      if (!data) {
        showToast('لم يُعثر على المشروع');
        return null;
      }
      setCurrentId(id);
      rememberLastProject(id);
      setSavedAt(Date.now());
      setDirty(false);
      lastSigRef.current = null;
      return data;
    },
    [showToast]
  );

  const deleteProject = useCallback(
    (id: string) => {
      deleteProductionProject(id);
      if (currentIdRef.current === id) {
        setCurrentId(null);
        rememberLastProject(null);
      }
      refreshList();
      showToast('حُذف المشروع');
    },
    [refreshList, showToast]
  );

  const newProject = useCallback(() => {
    setCurrentId(null);
    rememberLastProject(null);
    setSavedAt(null);
    setDirty(false);
    lastSigRef.current = null;
    clearProductionAutosave();
  }, []);

  /** آخر مشروع مفتوح لفتحه تلقائياً عند العودة (أو null). */
  const peekLastProject = useCallback((): string | null => readLastProjectId(), []);

  return {
    currentId,
    projects,
    savedAt,
    dirty,
    trackSnapshot,
    saveProject,
    restoreAutosave,
    openProject,
    deleteProject,
    newProject,
    peekLastProject,
  };
}
