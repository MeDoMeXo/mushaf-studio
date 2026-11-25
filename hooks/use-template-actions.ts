'use client';

/**
 * useTemplateActions — custom template save/delete/share actions.
 * Extracted from StudioView per the 600-line file rule: the pure-UI template
 * mutation handlers (persist via lib/storage, share via lib/template-share).
 */
import { useCallback } from 'react';
import type { SavedCustomTemplate, StudioState } from '@/lib/quran-data';
import { toArabicDigits } from '@/lib/quran-utils';
import { saveCustomTemplates } from '@/lib/storage';
import {
  buildSavedDesignTemplate,
  exportTemplatesToJson,
  importTemplatesFromJson,
} from '@/lib/template-share';

export interface UseTemplateActionsInput {
  state: StudioState;
  surahName?: string;
  customTemplates: SavedCustomTemplate[];
  newTemplateName: string;
  setCustomTemplates: React.Dispatch<React.SetStateAction<SavedCustomTemplate[]>>;
  setNewTemplateName: React.Dispatch<React.SetStateAction<string>>;
  showToast: (msg: string) => void;
}

export interface UseTemplateActionsResult {
  handleSaveCustomTemplate: (e: React.FormEvent) => void;
  handleQuickSaveDesign: () => void;
  handleDeleteCustomTemplate: (id: string) => void;
  handleExportTemplates: (templates: SavedCustomTemplate[]) => void;
  handleImportTemplates: (file: File) => Promise<void>;
}

export function useTemplateActions({
  state,
  surahName,
  customTemplates,
  newTemplateName,
  setCustomTemplates,
  setNewTemplateName,
  showToast,
}: UseTemplateActionsInput): UseTemplateActionsResult {
  const handleSaveCustomTemplate = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const name = newTemplateName.trim();
      if (!name) {
        showToast('اكتب اسماً للقالب قبل الحفظ');
        return;
      }
      const item = buildSavedDesignTemplate({
        state,
        surahName,
        customName: name,
      });
      const next = [item, ...customTemplates];
      setCustomTemplates(next);
      saveCustomTemplates(next);
      setNewTemplateName('');
      showToast(`تم حفظ القالب «${item.name}»`);
    },
    [newTemplateName, state, surahName, customTemplates, setCustomTemplates, setNewTemplateName, showToast]
  );

  const handleQuickSaveDesign = useCallback(() => {
    const item = buildSavedDesignTemplate({
      state,
      surahName,
      customName: newTemplateName.trim() || null,
    });
    const next = [item, ...customTemplates];
    setCustomTemplates(next);
    saveCustomTemplates(next);
    if (newTemplateName.trim()) {
      setNewTemplateName('');
    }
    showToast(`تم حفظ التصميم «${item.name}» في قوالبي المحفوظة`);
  }, [state, surahName, newTemplateName, customTemplates, setCustomTemplates, setNewTemplateName, showToast]);

  const handleDeleteCustomTemplate = useCallback(
    (id: string) => {
      const next = customTemplates.filter((t) => t.id !== id);
      setCustomTemplates(next);
      saveCustomTemplates(next);
      showToast('تم حذف القالب المحفوظ');
    },
    [customTemplates, setCustomTemplates, showToast]
  );

  // Roadmap item 7: share custom templates as a small JSON file.
  const handleExportTemplates = useCallback(
    (templates: SavedCustomTemplate[]) => {
      if (templates.length === 0) {
        showToast('لا توجد قوالب محفوظة للتصدير بعد');
        return;
      }
      const json = exportTemplatesToJson(templates);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = templates.length === 1
        ? `mushaf-template-${templates[0].name.replace(/\s+/g, '-').slice(0, 40)}.json`
        : 'mushaf-templates.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(`تم تصدير ${toArabicDigits(templates.length)} قالباً — شارك الملف مع من تشاء`);
    },
    [showToast]
  );

  const handleImportTemplates = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const res = importTemplatesFromJson(
          text,
          new Set(customTemplates.map((t) => t.id))
        );
        if (!res.ok) {
          showToast(res.error ?? 'تعذّر استيراد الملف');
          return;
        }
        const next = [...res.templates, ...customTemplates];
        setCustomTemplates(next);
        saveCustomTemplates(next);
        showToast(`تم استيراد ${toArabicDigits(res.templates.length)} قالباً بنجاح`);
      } catch {
        showToast('تعذّر قراءة ملف القوالب');
      }
    },
    [customTemplates, setCustomTemplates, showToast]
  );

  return {
    handleSaveCustomTemplate,
    handleQuickSaveDesign,
    handleDeleteCustomTemplate,
    handleExportTemplates,
    handleImportTemplates,
  };
}
