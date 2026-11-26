/**
 * سجل أقسام لوحة التنسيق (خمسة تبويبات) — المصدر الوحيد لهوية كل قسم:
 * المعرّف + التبويب + التسمية العربية. تستخدمه إدارة ظهور الأقسام في
 * الاستوديو (use-inspector-section-visibility) ومفتاح localStorage.
 * إضافة قسم جديد = سطر واحد هنا + غلاف StudioInspectorSection في اللوح.
 */

export type InspectorSectionTab = 'templates' | 'ornaments' | 'background' | 'text' | 'audio';

export interface InspectorSectionMeta {
  id: string;
  tab: InspectorSectionTab;
  label: string;
}

/** مفتاح تخزين تفضيلات إظهار الأقسام في المتصفح. */
export const INSPECTOR_SECTION_STORAGE_KEY = 'mushaf-studio-inspector-sections';

export const INSPECTOR_TAB_LABELS: Record<InspectorSectionTab, string> = {
  templates: 'قوالب',
  ornaments: 'زخارف',
  background: 'الخلفية',
  text: 'النص',
  audio: 'الصوت',
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
  { id: 'txt-links', tab: 'text', label: 'الروابط' },

  // ── تبويب الصوت ──
  { id: 'aud-dsp', tab: 'audio', label: 'الهندسة الصوتية والمؤثرات المحيطية' },
  { id: 'aud-ambient', tab: 'audio', label: 'مؤثرات طبيعية هادئة' },
  { id: 'aud-transitions', tab: 'audio', label: 'الانتقالات وفاصل الآيات' },
  { id: 'aud-cinematic', tab: 'audio', label: 'فلاتر الألوان السينمائية' },
  { id: 'aud-quality', tab: 'audio', label: 'جودة الفيديو وإعدادات التصدير' },
];

const SECTION_IDS = new Set(INSPECTOR_SECTIONS.map((s) => s.id));

/** هل هذا المعرّف قسم مسجّل فعلاً؟ (حماية من قيم دخيلة في التخزين المحلي) */
export function isInspectorSectionId(id: unknown): id is string {
  return typeof id === 'string' && SECTION_IDS.has(id);
}
