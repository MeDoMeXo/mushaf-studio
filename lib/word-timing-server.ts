/**
 * الخدمة الخادمية لتوقيتات الكلمات: تفك ترميز ملف الآية الصوتي عبر
 * ffmpeg إلى PCM أحادي 8kHz، حساب غلاف RMS، ثم بناء حدود الكلمات
 * الحقيقية بأوزان النطق — مع كاش LRU في الذاكرة (الغلاف ثابت لكل
 * ملف، لا يعاد فكّه أبداً) وطبقة كاش الصوت الدائمة على القرص.
 *
 * يستهلكه:
 *   - app/api/word-timing/route.ts (المعاينة الحية عبر fetch).
 *   - lib/export-audio-prep.ts (خطة التصدير — الملفات منزّلة محلياً).
 *
 * لا DOM هنا — وحدة خادمية صرفة، تعمل داخل Next.js (runtime nodejs).
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { getUpstreamAudioUrl } from './quran-utils';
import { readCachedAudio, writeCachedAudio } from './server-audio-cache';
import { isFfmpegAvailable, resolveFfmpegPath } from './ffmpeg-resolver';
import { buildAyahWordTimings } from './verse-words';
import {
  WORD_TIMING_HOP_MS,
  buildWordTimingSpans,
  computeRmsEnvelope,
  type WordTimingSpan,
} from './word-timing-engine';

const DECODE_RATE = 8000;
const ENVELOPE_CACHE_LIMIT = 512; // آية × قارئ (الغلاف ~4KB لكل 10 ثوانٍ)
const SPAN_CACHE_LIMIT = 512;
const DECODE_TIMEOUT_MS = 20000;

/** غلاف RMS جاهز لآية واحدة (يُحسب مرة واحدة ويُعاد استخدامها). */
interface EnvelopeEntry {
  envelope: Float32Array;
  durationSec: number;
}

const envelopeCache = new Map<string, EnvelopeEntry>();
const spanCache = new Map<string, { hopMs: number; spans: WordTimingSpan[] }>();

function lruGet<T>(cache: Map<string, T>, key: string): T | undefined {
  const hit = cache.get(key);
  if (hit !== undefined) {
    // إعادة الإدراج تجدد حداثة المفتاح (LRU تقريبي بلا حذف).
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

function lruPut<T>(cache: Map<string, T>, key: string, value: T, limit: number): void {
  cache.set(key, value);
  while (cache.size > limit) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/**
 * يفك ترميز مصدر صوتي إلى PCM s16le أحادي 8kHz عبر ffmpeg.
 * source: مسار ملف محلي أو Buffer عبر stdin. null عند غياب ffmpeg
 * أو فشل التفكيك — المستدعي يتراجع للنموذج التقديري بلا انهيار.
 */
function decodePcm(
  source: { kind: 'path'; path: string } | { kind: 'buffer'; data: Buffer }
): Promise<Int16Array | null> {
  if (!isFfmpegAvailable()) return Promise.resolve(null);
  const ffmpeg = resolveFfmpegPath();
  const args =
    source.kind === 'path'
      ? ['-v', 'error', '-i', source.path]
      : ['-v', 'error', '-i', 'pipe:0'];
  return new Promise((resolve) => {
    const child = spawn(ffmpeg, [
      ...args,
      '-ac', '1',
      '-ar', String(DECODE_RATE),
      '-f', 's16le',
      'pipe:1',
    ]);
    const chunks: Buffer[] = [];
    let settled = false;
    const finish = (pcm: Int16Array | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(pcm);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(null);
    }, DECODE_TIMEOUT_MS);

    child.stdout.on('data', (c: Buffer) => chunks.push(c));
    child.stderr.on('data', () => {}); // ffmpeg -v error: يُتجاهل — الفشل يُقرر بحالة الخروج
    child.on('error', () => finish(null));
    child.on('close', (code) => {
      if (code !== 0) {
        finish(null);
        return;
      }
      const total = Buffer.concat(chunks);
      if (total.byteLength < 2000) {
        // أقصر من ~0.12s — ملف تالف أو فارغ
        finish(null);
        return;
      }
      // نسخة بمحاذاة بايتين مضمونة (Buffer.concat قد ترجع offset فردي)
      const aligned = new Uint8Array(total.byteLength);
      aligned.set(total);
      finish(new Int16Array(aligned.buffer, 0, Math.floor(aligned.length / 2)));
    });
    if (source.kind === 'buffer') {
      child.stdin.on('error', () => {}); // EPIPE عند خروج مبكر
      child.stdin.end(source.data);
    }
  });
}

function envelopeFromPcm(pcm: Int16Array | null): EnvelopeEntry | null {
  if (!pcm || pcm.length < 2000) return null;
  const envelope = computeRmsEnvelope(pcm, DECODE_RATE, WORD_TIMING_HOP_MS);
  if (envelope.length < 40) return null;
  return { envelope, durationSec: pcm.length / DECODE_RATE };
}

/**
 * يضمن وجود غلاف RMS لآية عند قارئ: كاش الذاكرة ← كاش القرص ← جلب
 * المنبع (مع كتابة كاش القرد في الخلفية) ← فك الترميز. null عند فشل
 * أي مرحلة (يعني تراجع المستهلك للنموذج التقديري القديم).
 */
async function getVerseEnvelope(
  reciterSlug: string,
  globalVerseId: number,
  customReciters?: readonly import('./quran-data-types').ReciterOption[]
): Promise<EnvelopeEntry | null> {
  const key = `${reciterSlug}:${globalVerseId}`;
  const cached = lruGet(envelopeCache, key);
  if (cached) return cached;

  // 1) كاش القرص الدائم (نفس طبقة وكيل الصوت)
  let bytes = await readCachedAudio(reciterSlug, globalVerseId);
  if (!bytes || bytes.byteLength < 2048) {
    // 2) جلب المنبع مباشرة (بمواصفات القارئ المخصصة إن وجدت)
    const url = getUpstreamAudioUrl(reciterSlug, globalVerseId, customReciters);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MushafStudio/1.0' },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.byteLength >= 2048) {
          // خزّن في كاش القرص ليخدم الوكيل والتصدير لاحقاً فوراً
          void writeCachedAudio(reciterSlug, globalVerseId, bytes).catch(() => {});
        }
      }
    } catch {
      return null;
    }
  }
  if (!bytes || bytes.byteLength < 2048) return null;

  const entry = envelopeFromPcm(await decodePcm({ kind: 'buffer', data: bytes }));
  if (!entry) return null;
  lruPut(envelopeCache, key, entry, ENVELOPE_CACHE_LIMIT);
  return entry;
}

export interface VerseWordTimings {
  hopMs: number;
  spans: WordTimingSpan[];
}

/**
 * التوقيتات الحقيقية لآية عند قارئ مع نصّها العثماني — تحسب الأوزان
 * من نص الآية (محرّك النطق نفسه) وتوزّعها على الخط المنطوق الفعلي.
 * null = تعذّر التحليل (يتراجع المستهلك للنموذج التقديري).
 */
export async function getVerseWordTimings(
  reciterSlug: string,
  globalVerseId: number,
  verseText: string,
  customReciters?: readonly import('./quran-data-types').ReciterOption[]
): Promise<VerseWordTimings | null> {
  const text = (verseText || '').trim();
  if (!text) return null;
  const textKey = createHash('sha1').update(text).digest('hex').slice(0, 12);
  const key = `${reciterSlug}:${globalVerseId}:${textKey}`;
  const cached = lruGet(spanCache, key);
  if (cached) return cached;

  const timings = buildAyahWordTimings(text);
  if (!timings.length) return null;
  const weights = timings.map((t) => t.weight);

  const entry = await getVerseEnvelope(reciterSlug, globalVerseId, customReciters);
  if (!entry) return null;
  const spans = buildWordTimingSpans(entry.envelope, weights, WORD_TIMING_HOP_MS);
  if (!spans || spans.length !== weights.length) return null;
  const result: VerseWordTimings = { hopMs: WORD_TIMING_HOP_MS, spans };
  lruPut(spanCache, key, result, SPAN_CACHE_LIMIT);
  return result;
}

/**
 * نفس الحساب من ملف صوتي محلي (مسار التصدير: الملفات نُزّلت مسبقاً
 * في مجلد المهمة). الأوزان تُمرَّر مباشرة (خط زمن التصدير يحملها
 * أصلاً) — لا حاجة للنص هنا. null = تراجع للتوزيع التقديري.
 */
export async function getVerseWordTimingsFromFile(
  filePath: string,
  weights: readonly number[]
): Promise<WordTimingSpan[] | null> {
  if (!weights.length) return null;
  const entry = envelopeFromPcm(await decodePcm({ kind: 'path', path: filePath }));
  if (!entry) return null;
  const spans = buildWordTimingSpans(entry.envelope, weights, WORD_TIMING_HOP_MS);
  if (!spans || spans.length !== weights.length) return null;
  return spans;
}
