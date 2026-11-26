'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Globe2,
  Loader2,
  Mic,
  Radio,
  Sparkles,
  Wifi,
  X,
} from 'lucide-react';
import type { ReciterOption, ReciterStyle } from '@/lib/quran-data';
import { probeSingleReciterHealth } from '@/lib/reciter-health';
import { toArabicDigits } from '@/lib/quran-utils';

interface AddReciterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddReciter: (reciter: ReciterOption) => void;
}

const STYLE_OPTIONS: { id: ReciterStyle; label: string }[] = [
  { id: 'murattal', label: 'مرتل (حفص عن عاصم)' },
  { id: 'mujawwad', label: 'مجود (تلاوة خاشعة)' },
  { id: 'warsh', label: 'رواية ورش عن نافع' },
  { id: 'muallim', label: 'المصحف المعلم' },
];

function transliterateArabicName(name: string): string {
  const map: Record<string, string> = {
    'أ': 'a', 'إ': 'i', 'آ': 'aa', 'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
    'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'dh', 'ع': 'a',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'h', 'ء': '', 'ئ': 'y', 'ؤ': 'w',
  };

  let clean = name.trim().toLowerCase();
  clean = clean.replace(/عبد\s*الله/g, 'abdullah');
  clean = clean.replace(/عبد\s*الرحمن/g, 'abdurrahman');
  clean = clean.replace(/عبد\s*العزيز/g, 'abdulaziz');
  clean = clean.replace(/عبد\s*المحسن/g, 'abdulmohsen');
  clean = clean.replace(/عبد\s*الباسط/g, 'abdulbasit');
  clean = clean.replace(/محمد/g, 'mohammad');
  clean = clean.replace(/أحمد|احمد/g, 'ahmad');
  clean = clean.replace(/محمود/g, 'mahmoud');
  clean = clean.replace(/صالح/g, 'saleh');
  clean = clean.replace(/علي/g, 'ali');

  const chars = clean.split('');
  let result = '';
  for (const ch of chars) {
    if (map[ch] !== undefined) {
      result += map[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      result += ch;
    } else if (ch === ' ' || ch === '-' || ch === '_') {
      if (result && !result.endsWith('_') && !result.endsWith('-')) {
        result += '_';
      }
    }
  }
  return result.replace(/^_+|_+$/g, '').slice(0, 25);
}

function deriveSlugFromInput(
  arabicName: string,
  sourceType: 'mp3quran' | 'everyayah',
  urlOrFolder: string
): string {
  const prefix = sourceType === 'mp3quran' ? 'mq' : 'ea';

  // 1. If URL or folder is entered, extract folder segment
  const trimmedUrl = urlOrFolder.trim().replace(/\/+$/, '');
  if (trimmedUrl) {
    const parts = trimmedUrl.split('/');
    let segment = parts[parts.length - 1];
    if ((segment === 'r1' || segment === 'r2') && parts.length >= 2) {
      segment = parts[parts.length - 2];
    }
    const cleanSegment = segment
      .replace(/_(?:128|192|64|32|40|48)kbps/gi, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
    if (cleanSegment && cleanSegment !== 'audio' && cleanSegment !== 'data') {
      return `${prefix}.${cleanSegment}`;
    }
  }

  // 2. Otherwise derive from Arabic name
  if (arabicName.trim()) {
    const transliterated = transliterateArabicName(arabicName);
    if (transliterated) {
      return `${prefix}.${transliterated}`;
    }
  }

  return `${prefix}.reciter_${Date.now().toString().slice(-4)}`;
}

export function AddReciterModal({
  isOpen,
  onClose,
  onAddReciter,
}: AddReciterModalProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [style, setStyle] = useState<ReciterStyle>('murattal');
  const [country, setCountry] = useState('السعودية');
  const [bitrate, setBitrate] = useState<128 | 192 | 64>(128);
  const [source, setSource] = useState<'mp3quran' | 'everyayah'>('mp3quran');
  const [serverUrl, setServerUrl] = useState('');
  const [readIdInput, setReadIdInput] = useState('');
  const [isManualSlug, setIsManualSlug] = useState(false);

  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    ok: boolean;
    status: number | null;
    ms: number;
    error?: string;
  } | null>(null);
  const [validationError, setValidationError] = useState('');

  if (!isOpen) return null;

  const buildCandidateReciter = (): ReciterOption => {
    const cleanSlug =
      slug.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') ||
      `custom.${Date.now()}`;
    const cleanUrl = serverUrl.trim();
    const styleLabel =
      STYLE_OPTIONS.find((s) => s.id === style)?.label.split(' ')[0] || 'مرتل';
    // Optional MP3Quran timing read id — enables server-side FFmpeg verse
    // slicing so the reciter becomes verse-by-verse synced in Reader & Studio.
    const parsedReadId = Number(readIdInput.trim());
    const validReadId =
      source === 'mp3quran' &&
      readIdInput.trim() !== '' &&
      Number.isInteger(parsedReadId) &&
      parsedReadId >= 1 &&
      parsedReadId <= 99999
        ? parsedReadId
        : undefined;

    return {
      slug: cleanSlug,
      name: name.trim() || 'قارئ جديد',
      style,
      styleLabel,
      country: country.trim() || 'العالم الإسلامي',
      bitrate,
      source,
      mp3quranServer: source === 'mp3quran' ? cleanUrl : undefined,
      mp3quranReadId: validReadId,
      everyayahFolder: source === 'everyayah' ? cleanUrl : undefined,
      popular: true,
    };
  };

  const handleProbe = async () => {
    if (!name.trim() || !serverUrl.trim()) {
      setValidationError('يرجى كتابة اسم القارئ ورابط خادم الصوت أولاً');
      return;
    }
    setValidationError('');
    setIsProbing(true);
    setProbeResult(null);
    try {
      const candidate = buildCandidateReciter();
      const res = await probeSingleReciterHealth(candidate);
      setProbeResult({
        ok: res.ok,
        status: res.status,
        ms: res.ms,
        error: res.error,
      });
    } catch (err) {
      setProbeResult({
        ok: false,
        status: null,
        ms: 0,
        error: err instanceof Error ? err.message : 'فشل فحص الرابط',
      });
    } finally {
      setIsProbing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setValidationError('اسم القارئ مطلوب');
      return;
    }
    if (!serverUrl.trim()) {
      setValidationError('رابط خادم التلاوة الصوتي مطلوب');
      return;
    }
    const finalReciter = buildCandidateReciter();
    onAddReciter(finalReciter);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-add-reciter-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <div
        dir="rtl"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--brand-gold)]/40 bg-[var(--surface-card)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]">
              <Mic className="h-4 w-4" />
            </div>
            <div>
              <h3
                id="modal-add-reciter-title"
                className="font-display text-base font-bold text-[var(--ink-primary)]"
              >
                إضافة قارئ ومصدر صوتي جديد
              </h3>
              <p className="text-[11px] text-[var(--ink-muted)]">
                ربط تلاوات القارئ مع إمكانية الفحص والتأكد المباشر
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {validationError && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)]">
                اسم القارئ الكريـم *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  const val = e.target.value;
                  setName(val);
                  if (!isManualSlug) {
                    setSlug(deriveSlugFromInput(val, source, serverUrl));
                  }
                }}
                placeholder="مثال: محمد اللحيدان"
                className="mt-1 h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[var(--ink-muted)]">
                  المعرّف التقني (Slug)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsManualSlug(false);
                    setSlug(deriveSlugFromInput(name, source, serverUrl));
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--brand-gold)] hover:underline"
                  title="إعادة التوليد التلقائي"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>توليد تلقائي 🪄</span>
                </button>
              </div>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setIsManualSlug(true);
                }}
                placeholder="mq.mohammad_allhdan"
                className="mt-1 h-9 w-full font-mono rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)]">
                الأسلوب والرواية
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as ReciterStyle)}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 text-xs font-medium text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
              >
                {STYLE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)]">
                الدولة / الأصل
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="مثال: السعودية"
                className="mt-1 h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-medium text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)]">
                الجودة (Bitrate)
              </label>
              <select
                value={bitrate}
                onChange={(e) => setBitrate(Number(e.target.value) as 128 | 192 | 64)}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 text-xs font-medium text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
              >
                <option value={192}>192 kbps (فائقة)</option>
                <option value={128}>128 kbps (قياسية)</option>
                <option value={64}>64 kbps (مضغوطة)</option>
              </select>
            </div>
          </div>

          {/* Audio Source Provider */}
          <div>
            <label className="block text-xs font-semibold text-[var(--ink-muted)]">
              نوع الخادم الصوتي
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSource('mp3quran');
                  if (!isManualSlug) {
                    setSlug(deriveSlugFromInput(name, 'mp3quran', serverUrl));
                  }
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-bold transition-all ${
                  source === 'mp3quran'
                    ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/10 text-[var(--brand-gold)]'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)]'
                }`}
              >
                <Radio className="h-3.5 w-3.5" />
                <span>خادم MP3Quran CDN</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSource('everyayah');
                  if (!isManualSlug) {
                    setSlug(deriveSlugFromInput(name, 'everyayah', serverUrl));
                  }
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-bold transition-all ${
                  source === 'everyayah'
                    ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/10 text-[var(--brand-gold)]'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--ink-muted)]'
                }`}
              >
                <Globe2 className="h-3.5 w-3.5" />
                <span>مجلد EveryAyah (آية بآية)</span>
              </button>
            </div>
          </div>

          {/* Server URL Input */}
          <div>
            <label className="block text-xs font-semibold text-[var(--ink-muted)]">
              {source === 'mp3quran'
                ? 'رابط خادم السور الكامل (Server Base URL) *'
                : 'اسم مجلد القارئ في EveryAyah *'}
            </label>
            <input
              type="text"
              required
              value={serverUrl}
              onChange={(e) => {
                const val = e.target.value;
                setServerUrl(val);
                setProbeResult(null);
                if (!isManualSlug) {
                  setSlug(deriveSlugFromInput(name, source, val));
                }
              }}
              placeholder={
                source === 'mp3quran'
                  ? 'https://cdn.mp3quran.net/audio/reciter-name/r1/'
                  : 'Yasser_Ad-Dussary_128kbps'
              }
              className="mt-1 h-9 w-full font-mono rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
              {source === 'mp3quran'
                ? 'الرابط الذي تنتهي بنهايته ملفات 001.mp3 وما بعدها مع سلاش في النهاية.'
                : 'اسم المجلد في everyayah.com/data/ حيث توجد ملفات 001001.mp3.'}
            </p>
          </div>

          {source === 'mp3quran' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)]">
                معرّف التلاوة للتوقيتات (Read ID) — اختياري
              </label>
              <input
                type="number"
                min={1}
                max={99999}
                value={readIdInput}
                onChange={(e) => setReadIdInput(e.target.value)}
                placeholder="مثال: 1194"
                className="mt-1 h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--ink-primary)] focus:border-[var(--brand-gold)] focus:outline-none"
              />
              <p className="mt-1 text-[10px] leading-relaxed text-[var(--ink-muted)]">
                عند إدخاله يُقطّع الخادم كل آية بدقة من ملف السورة الكاملة (FFmpeg)
                فيعمل القارئ بالمزامنة آية بآية في القارئ والاستوديو. بدونه تُشغّل
                السورة كاملة كملف واحد ولا يظهر القارئ في القارئ والاستوديو.
              </p>
            </div>
          )}

          {/* Pre-save Live Probe Test Bar */}
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--ink-primary)]">
                فحص الاتصال بالخادم الصوتي
              </span>
              <button
                type="button"
                onClick={handleProbe}
                disabled={isProbing || !serverUrl.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 px-3 py-1.5 text-xs font-bold text-[var(--brand-gold)] hover:bg-[var(--brand-gold)] hover:text-[#1F1705] disabled:opacity-40"
              >
                {isProbing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>جاري الفحص...</span>
                  </>
                ) : (
                  <>
                    <Wifi className="h-3 w-3" />
                    <span>اختبار الرابط الآن ⚡</span>
                  </>
                )}
              </button>
            </div>

            {probeResult && (
              <div
                className={`mt-2.5 flex items-center gap-2 rounded-lg p-2.5 text-xs font-semibold ${
                  probeResult.ok
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 text-rose-500'
                }`}
              >
                {probeResult.ok ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      ✓ خادم الصوت متصل ويعمل بنجاح (HTTP{' '}
                      {toArabicDigits(probeResult.status || 200)} ·{' '}
                      {toArabicDigits(probeResult.ms)} مللي ثانية)
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      ✗ تعذّر التحقق من الرابط: {probeResult.error || 'خطأ 404 أو الرابط غير صحيح'}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border-hairline)] pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border-hairline)] px-4 py-2 text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-emerald)] px-5 py-2 text-xs font-bold text-[#FAF7F0] shadow-sm hover:opacity-90 active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>إضافة القارئ وحفظه</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
