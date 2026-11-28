/**
 * producer-echo — إعدادات صدى الصوت (reverb صدى) لرندر «منتج الصوت».
 *
 * سلسلة DSP بسيطة وواضحة (تأخير + تغذية راجعة + مزج رطب/جاف) تُبنى في
 * OfflineAudioContext داخل audio-producer-engine — هذه الوحدة تحمل النموذج
 * نقياً فقط: القيود، الإعدادات المسبقة، والوصف — قابلة للاختبار مباشرة.
 */

/** إعدادات صدى الصوت القابلة للتطبيق على الرندر. */
export interface ProducerEchoSettings {
  /** تفعيل الصدى — خارج التفعيل الرندر جاف تماماً (مسار مستقيم). */
  enabled: boolean;
  /** زمن التأخير بين التكرارات (ثوانٍ) — 0.05..0.9. */
  delaySec: number;
  /** التغذية الراجعة 0..0.85 — كل تكرار يُضرب بها فتخفت تدريجياً. */
  feedback: number;
  /** نسبة الصدى الرطبة من الخرج 0..0.6 (الباقي جاف دائماً ١). */
  wet: number;
}

/** الإعدادات الافتراضية: صدى معتدل مُفعَّل — طابع مسجد صغير. */
export const DEFAULT_ECHO: ProducerEchoSettings = {
  enabled: false,
  delaySec: 0.22,
  feedback: 0.32,
  wet: 0.18,
};

export interface EchoPreset {
  id: string;
  label: string;
  /** القيم الثلاث العملية (بلا enabled — يفعّلها اختيار الإعداد). */
  delaySec: number;
  feedback: number;
  wet: number;
}

/** إعدادات مسبقة موصوفة بدل أرقام مجرّدة أمام المستخدم. */
export const ECHO_PRESETS: readonly EchoPreset[] = [
  { id: 'subtle', label: 'خفيف', delaySec: 0.14, feedback: 0.22, wet: 0.1 },
  { id: 'chamber', label: 'قاعة', delaySec: 0.26, feedback: 0.38, wet: 0.2 },
  { id: 'mosque', label: 'مسجد', delaySec: 0.38, feedback: 0.5, wet: 0.28 },
  { id: 'cavern', label: 'كهف', delaySec: 0.55, feedback: 0.62, wet: 0.4 },
];

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/** يقيّ أي إعدادات جزئية إلى المدى الصالح (قيم خارج المدى تُقصّ). */
export function clampEchoSettings(
  partial: Partial<ProducerEchoSettings>
): ProducerEchoSettings {
  return {
    enabled: Boolean(partial.enabled),
    delaySec: clamp(Number(partial.delaySec) || DEFAULT_ECHO.delaySec, 0.05, 0.9),
    feedback: clamp(Number(partial.feedback) || 0, 0, 0.85),
    wet: clamp(Number(partial.wet) || 0, 0, 0.6),
  };
}

/** أقرب إعداد مسبق مطابق للقيم الثلاث — أو null إن لم يماثل شيئاً. */
export function matchEchoPreset(s: ProducerEchoSettings): EchoPreset | null {
  for (const p of ECHO_PRESETS) {
    if (
      Math.abs(p.delaySec - s.delaySec) < 1e-6 &&
      Math.abs(p.feedback - s.feedback) < 1e-6 &&
      Math.abs(p.wet - s.wet) < 1e-6
    ) {
      return p;
    }
  }
  return null;
}

/** هل سيُسمَع الصدى فعلاً؟ (مُفعَّل بنسبة رطبة ذات أثر) */
export function isEchoAudible(s: ProducerEchoSettings | null | undefined): boolean {
  return Boolean(s && s.enabled && s.wet > 0.005 && s.feedback > 0.01);
}

/**
 * طول ذيل الصدى بعد نهاية المحتوى (ثوانٍ): عدد التكرارات حتى تخفت التغذية
 * الراجعة دون ١٪ مضروباً في زمن التأخير — بسقف ٤ ثوانٍ حتى لا يتضخم الرندر.
 */
export function echoTailSec(s: ProducerEchoSettings): number {
  if (!isEchoAudible(s) || s.feedback <= 0.01) return 0;
  const repeats = Math.log(0.01) / Math.log(s.feedback);
  return Math.min(4, Math.max(0, repeats * s.delaySec));
}

/** وصف عربي موجز للعرض على الواجهة. */
export function describeEcho(s: ProducerEchoSettings): string {
  if (!s.enabled) return 'بلا صدى';
  const preset = matchEchoPreset(s);
  const base = preset ? `صدى ${preset.label}` : 'صدى مخصص';
  const ms = Math.round(s.delaySec * 1000);
  return `${base} (${ms}ms · ${toPct(s.feedback)}٪ · رطب ${toPct(s.wet)}٪)`;
}

function toPct(v: number): number {
  return Math.round(v * 100);
}
