'use client';

/**
 * producer-handoff — جسر تسليم مقطع صوتي محرَّر من «منتج الصوت» إلى الاستوديو.
 *
 * التنقّل داخل التطبيق (client-side navigation) يبقي وحدات JS حيّة، لذا
 * مرجع الوحدة يحمل الـ Blob مباشرة. أما إعادة التحميل الكاملة فتفقده —
 * عندها يُقرأ علم sessionStorage ويعرض الاستوديو تنبيهاً صادقاً بدل
 * الصمت، ويُمسح العلم.
 *
 * الحدود (verseBoundsSec) بإحداثيات الخط «المحرَّر» (بعد القصّ) وطولها =
 * عدد الآيات الأصلي (آيات القصّ الكامل تلتصق بالدرزة) — يطابق توقّع
 * الاستوديو في customVerseBounds.
 */

export interface ProducerHandoff {
  /** الملف WAV المُنتَج من الرندر. */
  file: File;
  /** تسمية المصدر: «سورة الفاتحة — العفاسي (محرَّر)» أو اسم الملف. */
  label: string;
  /** بدايات الآيات على الخط المحرَّر (طولها = عدد الآيات). */
  verseBoundsSec: number[];
  /** أرقام الآيات (1-based داخل السورة). */
  verseNumbers: number[];
  /** نطاق الآيات الذي حُمّل في المنتج — ليضبط الاستوديو اختياره ليطابق. */
  surahId: number;
  fromAyah: number;
  toAyah: number;
  /**
   * خلفية مختارة من مكتبة الاستوديو المدمجة (bg-library) يطبّقها الاستوديو
   * فور الاستلام — null تعني «ترك الخلفية كما هي». معرّف من القائمة
   * البيضاء في lib/background-library فقط.
   */
  bgLibraryId?: string | null;
  createdAt: number;
}

const HANDOFF_MODULE_KEY = 'mushaf-producer-handoff';
export const HANDOFF_SESSION_FLAG = 'mushaf-producer-handoff-pending';

let pendingHandoff: ProducerHandoff | null = null;

/** تسجيل مقطع جاهز للتسليم — يُستدعى بعد الرندر في صفحة المنتج. */
export function setProducerHandoff(handoff: ProducerHandoff): void {
  pendingHandoff = handoff;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(
        HANDOFF_SESSION_FLAG,
        JSON.stringify({ label: handoff.label, createdAt: handoff.createdAt })
      );
    } catch {
      // وضع خاص/امتلاء — المرجع الحي يكفي لهذه الجلسة
    }
  }
}

/** استهلاك اليد المنتظرة (يحذفها) — يُستدعى عند تركيب الاستوديو. */
export function consumeProducerHandoff(): ProducerHandoff | null {
  const h = pendingHandoff;
  pendingHandoff = null;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(HANDOFF_SESSION_FLAG);
    } catch {
      // تجاهل
    }
  }
  return h;
}

/** هل بُقيت علامة جلسة بلا Blob؟ (إعادة تحميل بعد إرسال) */
export function peekHandoffLost(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(HANDOFF_SESSION_FLAG) !== null;
  } catch {
    return false;
  }
}

/** مسح علامة الجلسة (بعد التنبيه في الاستوديو). */
export function clearHandoffFlag(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(HANDOFF_SESSION_FLAG);
  } catch {
    // تجاهل
  }
}

/** اسم ملف تنزيل مقطع مُنتَج. */
export function buildProducerFilename(label: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const clean = label.replace(/[/\\:*?"<>|]+/g, ' ').replace(/\s+/g, '-').slice(0, 60);
  return `mushaf-audio-${clean || 'producer'}-${stamp}.wav`;
}
