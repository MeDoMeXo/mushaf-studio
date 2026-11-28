'use client';

/**
 * audio-producer-engine — محرّك صفحة «منتج الصوت» (متصفح فقط).
 *
 * المسؤوليات:
 *  1) تحميل المصدر: إما آيات قارئ (جلب كل آية عبر كاش المتصفح نفسه المستخدم
 *     في الاستوديو ثم فك ترميزها ودمجها في بافر واحد متصل بعلامات آيات)،
 *     أو ملف صوتي مرفوع (فك ترميز مباشر).
 *  2) رندر التحرير غير المدمّر: OfflineAudioContext يجدول كل مقطع محفوظ
 *     بمكسبه وتلاشياته على خط محرَّر جديد (نسخ عينات — سريع جداً).
 *  3) ترميز WAV ‏16-bit وتنزيله + تسليم المقطع المحرَّر إلى الاستوديو.
 *
 * بلا أي رفع للخادم — كل شيء محلي في المتصفح.
 */
import { fetchAndCacheVerseAudio } from '@/lib/audio-cache';
import { computePeaks, mixToMono } from '@/lib/timeline-peaks';
import type { QulVerse } from '@/lib/quran-data';
import {
  dbToLinear,
  totalKeptSec,
  type ProducerEditState,
  type TimeSpan,
} from './audio-producer-edit';

/** سقف عدد الآيات المدمجة (حماية ذاكرة — ~٥٠ دقيقة كحد أقصى عملي). */
export const MAX_PRODUCER_VERSES = 200;
/** دقة قمم الموجة المخزنة للمصدر الواحد. */
const SOURCE_PEAK_BUCKETS = 4096;
/** حد التوازي لجلب/فك آيات المصدر. */
const LOAD_CONCURRENCY = 4;

/** المصدر الصوتي المحمّل في المحرر. */
export interface ProducerSource {
  /** البافر المفكوك الكامل (كل الآيات مدمجة أو الملف المرفوع). */
  buffer: AudioBuffer;
  /** المدة بالثواني. */
  durationSec: number;
  /** معدل العينات (Hz). */
  sampleRate: number;
  /** بدايات الآيات على خط المصدر (طولها = عدد الآيات) — فارغ للملف بلا كشف. */
  verseMarkersSec: number[];
  /** أرقام الآيات (1-based داخل السورة). */
  verseNumbers: number[];
  /** عرض مختصر للمصدر. */
  label: string;
  kind: 'verses' | 'file';
}

export interface LoadProgress {
  done: number;
  total: number;
  failed: number;
}

export interface LoadOutcome {
  source: ProducerSource;
  failedVerses: number[];
}

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

/**
 * سياق صوتي مشترك بعمر الجلسة — لا يُغلق أبداً.
 *
 * لماذا؟ ذاكرة قنوات AudioBuffer التي يُنشئها createBuffer/decodeAudioData
 * تُحجز من مجمّع السياق نفسه؛ إغلاق السياق يحرّر المجمّع فتصفر بيانات
 * البافر (خسارة حقيقية شوهدت: مقطع ٤٦ ث صار ١٢ ث صوت + ٣٤ ث سكوت).
 * سياق واحد مشترك لكل عمليات المحرر (فك/إنشاء/نسخ) — مثل أي محطة صوت.
 */
let sharedProducerCtx: AudioContext | null = null;

function getSharedProducerContext(): AudioContext | null {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  if (!sharedProducerCtx || sharedProducerCtx.state === 'closed') {
    sharedProducerCtx = new Ctor();
  }
  return sharedProducerCtx;
}

/** مزج قنوات البافر إلى قناة أحادية (لحساب القمم فقط). */
function bufferToMonoPeaks(buffer: AudioBuffer, buckets: number): Float32Array {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }
  const mono = mixToMono(channels, buffer.length);
  return computePeaks(mono, buckets);
}

/**
 * تحميل آيات قارئ ودمجها في مصدر واحد:
 * - الآيات تُجلب من كاش المتصفح (أو تُجلب وتُخزَّن) عبر مسار الاستوديو نفسه.
 * - decodeAudioData يوحّد معدل العينات إلى معدل السياق فيصير الدمج نسخاً مباشراً.
 * - الآيات الفاشلة تُتخطى مع تقريرها (بلا انقطاع) — علامات الآيات تعكس ذلك.
 */
export async function loadSourceFromVerses(options: {
  reciterSlug: string;
  /** اسم القارئ للعرض في بطاقة المصدر — يُختصر إلى السلوغ إن غاب. */
  reciterName?: string;
  verses: QulVerse[];
  onProgress?: (p: LoadProgress) => void;
  signal?: AbortSignal;
}): Promise<LoadOutcome> {
  const { reciterSlug, reciterName, verses, onProgress, signal } = options;
  const ctx = getSharedProducerContext();
  if (!ctx) throw new Error('المتصفح لا يدعم Web Audio المطلوب للمحرر');

  const targets = verses.filter((v) => v.id > 0).slice(0, MAX_PRODUCER_VERSES);
  if (targets.length === 0) throw new Error('لا آيات مختارة للتحميل');

  {
    const decoded: (AudioBuffer | null)[] = new Array(targets.length).fill(null);
    let done = 0;
    let nextIndex = 0;

    // فكّ ترميز SERIALIZED على السياق الواحد: استدعاءات decodeAudioData
    // المتزامنة على نفس AudioContext معروفة بإخراج بافرات مُصفَّرة (صفرية)
    // في كروم — الجلب يبقى متوازياً والفكّ (CPU-bound أصلاً) متسلسلاً.
    let decodeChain: Promise<unknown> = Promise.resolve();
    const decodeSequential = (arr: ArrayBuffer): Promise<AudioBuffer> => {
      const run = decodeChain.then(() => ctx.decodeAudioData(arr));
      decodeChain = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    };

    const worker = async (): Promise<void> => {
      while (!signal?.aborted) {
        const i = nextIndex++;
        if (i >= targets.length) return;
        const verse = targets[i];
        try {
          const blob = await fetchAndCacheVerseAudio(reciterSlug, verse.id, signal);
          const arr = await blob.arrayBuffer();
          if (signal?.aborted) return;
          decoded[i] = await decodeSequential(arr);
        } catch {
          decoded[i] = null; // آية فاشلة معزولة — لا توقف الباقي
        }
        done += 1;
        onProgress?.({ done, total: targets.length, failed: 0 });
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(LOAD_CONCURRENCY, targets.length) }, () => worker())
    );
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const failedVerses: number[] = [];
    const kept: { buffer: AudioBuffer; verse: QulVerse }[] = [];
    for (let i = 0; i < targets.length; i++) {
      if (decoded[i]) {
        kept.push({ buffer: decoded[i] as AudioBuffer, verse: targets[i] });
      } else {
        failedVerses.push(targets[i].id);
      }
    }
    if (kept.length === 0) {
      throw new Error('تعذّر تحميل أي آية — تحقّق من الاتصال أو جرّب قارئاً آخر');
    }

    // رقم الآية من verse_key إن غاب verse_number (نمط استجابات QUL).
    const verseNo = (verse: QulVerse, fallback: number): number =>
      verse.verse_number ?? (Number(verse.verse_key?.split(':').pop() ?? fallback) || fallback);

    // الدمج: قنوات العدد الأقصى، معدل السياق الموحّد.
    // ⚠ حاسم: تُستدعى getChannelData() مرة واحدة لكل قناة وتُخبّأ
    // عروض (views) المصدر والوجهة قبل الحلقة — استدعاؤها المتكرر داخل
    // الحلقة على سياق «يعمل» يعيد عروضاً تضيع كتاباتها بعد حدّ (خسارة
    // حقيقية شوهدت: مقطع ٤٦ ث صار ١٢ ث). العرض المخبّأ يكتب دائماً.
    const sampleRate = kept[0].buffer.sampleRate;
    const channels = kept.reduce((m, k) => Math.max(m, k.buffer.numberOfChannels), 1);
    const totalLen = kept.reduce((m, k) => m + k.buffer.length, 0);
    const merged = ctx.createBuffer(channels, totalLen, sampleRate);
    const mergedViews: Float32Array[] = [];
    for (let c = 0; c < channels; c++) mergedViews.push(merged.getChannelData(c));
    const keptViews: Float32Array[][] = kept.map((k) => {
      const views: Float32Array[] = [];
      for (let c = 0; c < channels; c++) {
        views.push(
          k.buffer.numberOfChannels === 1
            ? k.buffer.getChannelData(0)
            : k.buffer.getChannelData(Math.min(c, k.buffer.numberOfChannels - 1))
        );
      }
      return views;
    });
    const verseMarkers: number[] = [];
    const verseNumbers: number[] = [];
    let cursorSamples = 0;
    for (let k = 0; k < kept.length; k++) {
      const { verse } = kept[k];
      const bufferLen = kept[k].buffer.length;
      verseMarkers.push(Number((cursorSamples / sampleRate).toFixed(4)));
      verseNumbers.push(verseNo(verse, k + 1));
      const room = Math.max(0, totalLen - cursorSamples);
      const copyLen = Math.min(bufferLen, room);
      for (let c = 0; c < channels; c++) {
        mergedViews[c].set(keptViews[k][c].subarray(0, copyLen), cursorSamples);
      }
      cursorSamples += bufferLen;
    }

    const source: ProducerSource = {
      buffer: merged,
      durationSec: merged.duration,
      sampleRate,
      verseMarkersSec: verseMarkers,
      verseNumbers,
      label: `${kept.length} آية — ${reciterName ?? reciterSlug}`,
      kind: 'verses',
    };
    onProgress?.({ done: targets.length, total: targets.length, failed: failedVerses.length });
    return { source, failedVerses };
  }
}

/** تحميل ملف صوتي مرفوع كمصدر للمحرر. */
export async function loadSourceFromFile(file: File): Promise<ProducerSource> {
  const ctx = getSharedProducerContext();
  if (!ctx) throw new Error('المتصفح لا يدعم Web Audio المطلوب للمحرر');
  try {
    const arr = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arr);
    return {
      buffer: decoded,
      durationSec: decoded.duration,
      sampleRate: decoded.sampleRate,
      verseMarkersSec: [],
      verseNumbers: [],
      label: file.name,
      kind: 'file',
    };
  } catch {
    throw new Error('تعذّر فك ترميز الملف — جرّب MP3 أو M4A أو WAV');
  }
}

/** قمم الموجة المخزنة للمصدر (للمعاينة السريعة قبل التقريب). */
export function computeSourcePeaks(source: ProducerSource): Float32Array {
  return bufferToMonoPeaks(source.buffer, SOURCE_PEAK_BUCKETS);
}

/** مستويات ذروة نافذية لكشف السكوت/الحدود (نافذة 40ms افتراضياً). */
export function computePeakLevels(
  source: ProducerSource,
  windowSec = 0.04
): { peakLevels: number[]; windowSec: number } {
  const data = source.buffer.getChannelData(0);
  const winSamples = Math.max(1, Math.floor(windowSec * source.sampleRate));
  const levels: number[] = [];
  for (let pos = 0; pos + winSamples <= data.length; pos += winSamples) {
    let peak = 0;
    for (let j = 0; j < winSamples; j += 2) {
      const v = Math.abs(data[pos + j]);
      if (v > peak) peak = v;
    }
    levels.push(peak);
  }
  return { peakLevels: levels, windowSec };
}

/** أعلى ذروة مطلقة داخل المقاطع المحفوظة (للتطبيع). */
function maxKeptPeak(source: ProducerSource, state: ProducerEditState): number {
  let max = 0;
  const ch = source.buffer.getChannelData(0);
  for (const it of state.intervals) {
    const from = Math.max(0, Math.floor(it.startSec * source.sampleRate));
    const to = Math.min(ch.length, Math.ceil(it.endSec * source.sampleRate));
    for (let i = from; i < to; i += 2) {
      const v = Math.abs(ch[i]);
      if (v > max) {
        max = v;
        if (max >= 1) return max;
      }
    }
  }
  return max;
}

/**
 * رندر حالة التحرير إلى AudioBuffer نهائي (الخط المحرَّر): جدولة كل مقطع
 * محفوظ بمكسبه وتلاشياته على OfflineAudioContext — نسخ عينات سريع.
 */
export async function renderEdited(
  source: ProducerSource,
  state: ProducerEditState
): Promise<AudioBuffer> {
  const totalSec = totalKeptSec(state);
  if (totalSec <= 0) {
    throw new Error('لا مقاطع محفوظة للرندر');
  }
  const OfflineCtor: typeof OfflineAudioContext | undefined =
    typeof window === 'undefined'
      ? undefined
      : window.OfflineAudioContext ??
        (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
          .webkitOfflineAudioContext;
  if (!OfflineCtor) throw new Error('المتصفح لا يدعم الرندر دون اتصال');

  const sr = source.sampleRate;
  const channels = source.buffer.numberOfChannels;
  const ctx = new OfflineCtor(channels, Math.ceil(totalSec * sr) + 1, sr);

  let normalizeLin = 1;
  if (state.normalize) {
    const peak = maxKeptPeak(source, state);
    if (peak > 0.0001) normalizeLin = Math.min(8, 0.95 / peak);
  }
  const masterLin = dbToLinear(state.masterGainDb) * normalizeLin;

  let cursor = 0;
  for (const it of state.intervals) {
    const durSec = Math.max(0.005, it.endSec - it.startSec);
    const node = ctx.createBufferSource();
    node.buffer = source.buffer;
    const gain = ctx.createGain();
    const lin = dbToLinear(it.gainDb) * masterLin;
    const when = cursor;
    const fi = Math.min(it.fadeInSec, durSec / 2);
    const fo = Math.min(it.fadeOutSec, durSec / 2);

    if (fi > 0) {
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(lin, when + fi);
    } else {
      gain.gain.setValueAtTime(lin, when);
    }
    if (fo > 0) {
      gain.gain.setValueAtTime(lin, when + durSec - fo);
      gain.gain.linearRampToValueAtTime(0.0001, when + durSec);
    } else {
      gain.gain.setValueAtTime(lin, when + durSec - 0.005);
    }

    node.connect(gain);
    gain.connect(ctx.destination);
    node.start(when, it.startSec, durSec);
    cursor += durSec;
  }

  const rendered = await ctx.startRendering();
  // نسخ الناتج إلى بافر من السياق المشترك الدائم: ناتج سياق الرندر
  // المؤقت (يُلغى بعد الرندر) قد يُطبّق عليه مصير مجمّع الذاكرة نفسه.
  // (تُخبّأ عروض القنوات مرة واحدة — نمط الدمج نفسه.)
  const shared = getSharedProducerContext();
  if (!shared) return rendered;
  const safe = shared.createBuffer(
    rendered.numberOfChannels,
    rendered.length,
    rendered.sampleRate
  );
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    const srcView = rendered.getChannelData(c);
    const dstView = safe.getChannelData(c);
    dstView.set(srcView);
  }
  return safe;
}

/** ترميز AudioBuffer إلى WAV ‏16-bit PCM (Blob). */
export function encodeWav16bit(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = channels[c][i];
      s = Math.max(-1, Math.min(1, s));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: 'audio/wav' });
}

/** تنزيل Blob باسم ملف. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** تقاطع نطاقين (لعرض السكوت داخل نافذة العرض). */
export function spanOverlap(a: TimeSpan, b: TimeSpan): TimeSpan | null {
  const startSec = Math.max(a.startSec, b.startSec);
  const endSec = Math.min(a.endSec, b.endSec);
  return endSec - startSec > 0 ? { startSec, endSec } : null;
}
