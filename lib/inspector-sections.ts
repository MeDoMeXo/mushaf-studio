/**
 * سجل أقسام لوحة التنسيق في الاستوديو (ستة تبويبات) — المصدر الوحيد لهوية كل قسم:
 * المعرّف + التبويب + التسمية العربية. تُدار إعدادات الظهور مركزيّاً من لوحة
 * التحكم (SiteConfig.studio.hiddenInspectorSections).
 * إضافة قسم جديد = سطر واحد هنا + غلاف StudioInspectorSection في اللوح.
 */

export type InspectorSectionTab = 'templates' | 'ornaments' | 'background' | 'text' | 'audio' | 'production';

export interface InspectorSectionMeta {
  id: string;
  tab: InspectorSectionTab;
  label: string;
}

export const INSPECTOR_TAB_ORDER: readonly InspectorSectionTab[] = [
  'templates',
  'ornaments',
  'background',
  'text',
  'audio',
  'production',
];

export const INSPECTOR_TAB_LABELS: Record<InspectorSectionTab, string> = {
  templates: 'قوالب',
  ornaments: 'زخارف',
  background: 'الخلفية',
  text: 'النص',
  audio: 'الصوت',
  production: 'منتج الصوت',
};

export const INSPECTOR_SECTIONS: InspectorSectionMeta[] = [
  // ── تبويب القوالب ──
  { id: 'tpl-gallery', tab: 'templates', label: 'قوالب التصميم الجاهزة' },
  { id: 'tpl-custom', tab: 'templates', label: 'قوالبي المحفوظة ومشاركتها' },

  // ── تبويب الزخارف ──
  { id: 'orn-harmony', tab: 'ornaments', label: 'التنسيق الزخرفي السريع' },
  { id: 'orn-frame', tab: 'ornaments', label: 'الإطار الإسلامي' },
  { id: 'orn-pattern', tab: 'ornaments', label: 'النقش الهندسي الخلفي' },
  { id: 'orn-corner', tab: 'ornaments', label: 'زخارف الزوايا' },
  { id: 'orn-banner', tab: 'ornaments', label: 'خرطوشة اسم السورة' },
  { id: 'orn-ayah', tab: 'ornaments', label: 'فاصلة رقم الآية' },
  { id: 'orn-color', tab: 'ornaments', label: 'لون التذهيب والزخارف' },

  // ── تبويب الخلفية ──
  { id: 'bg-source', tab: 'background', label: 'نوع الخلفية ومصدرها' },
  { id: 'bg-ambient', tab: 'background', label: 'حركة الخلفية والمؤثرات' },
  { id: 'bg-adjust', tab: 'background', label: 'تعتيم وتظليل وضبابية الخلفية' },

  // ── تبويب النص ──
  { id: 'txt-typography', tab: 'text', label: 'الخط والسماكة وخط الترجمة' },
  { id: 'txt-layout', tab: 'text', label: 'المقاسات وتوزيع الآية' },
  { id: 'txt-wordtrack', tab: 'text', label: 'تتبّع الكلمة المتلوة' },
  { id: 'txt-colors', tab: 'text', label: 'لون النص والمحاذاة' },
  { id: 'txt-ayahnum', tab: 'text', label: 'رقم الآية بزخرفة إسلامية' },
  { id: 'txt-labels', tab: 'text', label: 'اسم السورة والقارئ' },
  { id: 'txt-layers', tab: 'text', label: 'المؤثرات وعناصر الشريحة' },
  { id: 'txt-watermark', tab: 'text', label: 'العلامة المائية' },

  // ── تبويب الصوت ──
  { id: 'aud-dsp', tab: 'audio', label: 'الهندسة الصوتية والمؤثرات المحيطية' },
  { id: 'aud-ambient', tab: 'audio', label: 'مؤثرات طبيعية هادئة' },
  { id: 'aud-transitions', tab: 'audio', label: 'الانتقالات وفاصل الآيات' },
  { id: 'aud-cinematic', tab: 'audio', label: 'فلاتر الألوان السينمائية' },
  { id: 'aud-quality', tab: 'audio', label: 'جودة الفيديو وإعدادات التصدير' },

  // ── تبويب منتج الصوت ──
  { id: 'prd-timeline', tab: 'production', label: 'الخط الزمني للتلاوة' },
  { id: 'prd-tools', tab: 'production', label: 'أدوات المنتج' },
];

const SECTION_IDS = new Set(INSPECTOR_SECTIONS.map((s) => s.id));

/** هل هذا المعرّف قسم مسجّل فعلاً؟ (حماية من قيم دخيلة في الإعدادات المحفوظة) */
export function isInspectorSectionId(id: unknown): id is string {
  return typeof id === 'string' && SECTION_IDS.has(id);
}

export function getInspectorSectionsByTab(tab: InspectorSectionTab): InspectorSectionMeta[] {
  return INSPECTOR_SECTIONS.filter((s) => s.tab === tab);
}

export function sanitizeHiddenInspectorSections(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (isInspectorSectionId(item) && !seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

export function isInspectorSectionHidden(
  hiddenIds: readonly string[] | undefined,
  id: string
): boolean {
  return Array.isArray(hiddenIds) && hiddenIds.includes(id);
}

export function toggleHiddenInspectorSection(
  hiddenIds: readonly string[],
  id: string
): string[] {
  if (!isInspectorSectionId(id)) return [...hiddenIds];
  if (hiddenIds.includes(id)) {
    return hiddenIds.filter((item) => item !== id);
  }
  return [...hiddenIds, id];
}

