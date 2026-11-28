import { execFile } from 'node:child_process';
import { NextRequest, NextResponse } from 'next/server';
import { resolveFfmpegPath } from '@/lib/ffmpeg-resolver';

/**
 * POST /api/production/encode — ترميز FFmpeg لخط الإنتاج النهائي.
 *
 * الغرض: يستقبل الاستوديو (استوديو تحرير القرآن الكريم) وسائط جاهزة
 * (مزيج صوت WAV من المتصفح، أو WebM من مسجل الوسائط، أو MP4 مبدئي)
 * ويعيد ترميزها إلى الصيغة النهائية المطلوبة للتنزيل:
 *   - mp3 : صوت فقط، libmp3lame بمعدل بت قابل للتخصيص (32..320 كبت/ث).
 *   - wav : صوت فقط، PCM 16-bit دون فقد.
 *   - mp4 : H.264 (veryfast/CRF 23) + AAC، مع frag_mp4 حتى ينساب عبر
 *           الأنابيب، وقياس اختياري scale=w:h عند إرسال width/height.
 *   - webm: VP9 + Opus (امتياز إضافي لأن صيغة التصدير تشمل WebM).
 *
 * الأمان والحدود:
 *   - runtime=nodejs و maxDuration=300 (أقصى مدة منصة).
 *   - سقف الحجم 250 ميغابايت، وتحقق من البايتات السحرية
 *     (RIFF/WAVE أو EBML/WebM أو ftyp/MP4) — يُرفض ما سواها بـ 415.
 *   - FFmpeg يُستدعى بـ execFile مع مصفوفة وسائط فقط (لا سطر أوامر ولا
 *     shell إطلاقاً)، ويُقتل قسراً بعد 240 ثانية، والمخرج يجمع في الذاكرة.
 * الاستجابة: application/octet-stream مع Content-Disposition لمرفق
 * production.{format}، أو رسالة خطأ عربية عند فشل الترميز.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_INPUT_BYTES = 250 * 1024 * 1024;
const FFMPEG_TIMEOUT_MS = 240_000;
const STDIN_CHUNK_BYTES = 4 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024 * 1024;
const FORMATS = new Set(['mp3', 'wav', 'mp4', 'webm']);

type EncodeFormat = 'mp3' | 'wav' | 'mp4' | 'webm';

/** استنتاج الحاوية من البايتات السحرية: WAV / WebM / MP4، أو مجهول. */
function sniffContainer(head: Uint8Array): 'wav' | 'webm' | 'mp4' | 'unknown' {
  if (
    head.length >= 12 &&
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && // "RIFF"
    head[8] === 0x57 && head[9] === 0x41 && head[10] === 0x56 && head[11] === 0x45 // "WAVE"
  ) {
    return 'wav';
  }
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    return 'webm';
  }
  if (
    head.length >= 8 &&
    head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70 // "ftyp" @ 4
  ) {
    return 'mp4';
  }
  return 'unknown';
}

/** وسائط FFmpeg لكل صيغة — مصفوفة نصية صريحة تُنفَّذ بلا قشرة. */
function buildFfmpegArgs(
  format: EncodeFormat,
  bitrateKbps: number,
  width?: number,
  height?: number
): string[] {
  const scaleArgs =
    width && height && width > 0 && height > 0 ? ['-vf', `scale=${width}:${height}`] : [];
  switch (format) {
    case 'mp3':
      return ['-i', 'pipe:0', '-vn', '-c:a', 'libmp3lame', '-b:a', `${bitrateKbps}k`, '-f', 'mp3', 'pipe:1'];
    case 'wav':
      return ['-i', 'pipe:0', '-vn', '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1'];
    case 'mp4':
      return [
        '-i', 'pipe:0',
        ...scaleArgs,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        // empty_moov: MP4 مجزّأ قابل للانساب عبر HTTP (متوافق مع كل بناءات
        // ffmpeg الثابتة — frag_mp4 يُرفض في بعض بناءات v7 الرسمية).
        '-movflags', 'empty_moov',
        // الأنبوب لا يحمل امتداداً — يُعلن التنسيق صريحاً وإلا فشل المُضمّن.
        '-f', 'mp4',
        'pipe:1',
      ];
    case 'webm':
      return [
        '-i', 'pipe:0',
        ...scaleArgs,
        '-c:v', 'libvpx-vp9',
        '-b:v', '0',
        '-crf', '32',
        '-row-mt', '1',
        '-c:a', 'libopus',
        '-b:a', '128k',
        '-f', 'webm',
        'pipe:1',
      ];
  }
}

/** كتابة البافر إلى stdin على دفعات مع احترام الضغط العكسي (drain). */
function writeAllToStdin(stdin: NodeJS.WritableStream, input: Buffer): void {
  let offset = 0;
  const step = () => {
    while (offset < input.length) {
      const end = Math.min(input.length, offset + STDIN_CHUNK_BYTES);
      const mayContinue = stdin.write(input.subarray(offset, end));
      offset = end;
      if (!mayContinue) {
        stdin.once('drain', step);
        return;
      }
    }
    try {
      stdin.end();
    } catch {
      /* انتهى الاستهلاك مبكراً — الترميز يحسم النتيجة */
    }
  };
  step();
}

type FfmpegResult =
  | { ok: true; data: Buffer }
  | { ok: false; timedOut: boolean; stderr: string };

/** تشغيل FFmpeg: يُغذّى stdin ويُجمع stdout، مع قتل مؤقّت بعد 240 ثانية. */
function runFfmpeg(bin: string, args: string[], input: Buffer): Promise<FfmpegResult> {
  return new Promise((resolve) => {
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const child = execFile(
      bin,
      args,
      { maxBuffer: MAX_OUTPUT_BYTES, encoding: 'buffer' as const, killSignal: 'SIGKILL' },
      (err, stdout, stderr) => {
        if (timer) clearTimeout(timer);
        if (err) {
          const errText = Buffer.isBuffer(stderr) ? stderr.toString('utf8') : String(stderr ?? '');
          resolve({ ok: false, timedOut, stderr: errText.slice(0, 400) });
        } else {
          const out = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? '');
          resolve({ ok: true, data: out });
        }
      }
    );

    timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* العملية قد تكون انتهت قبل المؤقّت */
      }
    }, FFMPEG_TIMEOUT_MS);

    if (child.stdin) {
      child.stdin.on('error', () => {
        /* EPIPE: انسحب FFmpeg مبكراً — يُحسم عبر رد النداء */
      });
      writeAllToStdin(child.stdin, input);
    }
  });
}

/** قراءة عدد صحيح اختياري من حقل النموذج. */
function parseOptionalInt(value: FormDataEntryValue | null): number | undefined {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'يجب إرسال الطلب بصيغة multipart/form-data' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'ملف الإدخال مفقود أو فارغ' }, { status: 400 });
    }
    if (file.size > MAX_INPUT_BYTES) {
      return NextResponse.json({ error: 'حجم الملف يتجاوز الحد المسموح (250 ميغابايت)' }, { status: 413 });
    }

    const format = String(formData.get('format') || '').toLowerCase();
    if (!FORMATS.has(format)) {
      return NextResponse.json(
        { error: 'صيغة ترميز غير مدعومة — يُسمح بـ mp3 أو wav أو mp4 أو webm' },
        { status: 400 }
      );
    }

    let bitrate = parseOptionalInt(formData.get('bitrate')) ?? 192;
    bitrate = Math.max(32, Math.min(320, bitrate));

    const width = parseOptionalInt(formData.get('width'));
    const height = parseOptionalInt(formData.get('height'));
    // yuv420p يتطلب أبعاداً زوجية — نقرّب لأقرب زوجي صحيح.
    const evenDim = (v: number | undefined) => (v && v > 0 ? Math.max(2, Math.floor(v / 2) * 2) : undefined);

    // التحقق من البايتات السحرية قبل شغل أي عملية.
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const sniffed = sniffContainer(head);
    if (sniffed === 'unknown') {
      return NextResponse.json(
        { error: 'صيغة الملف غير مدعومة — يُسمح بـ WAV أو WebM أو MP4 فقط' },
        { status: 415 }
      );
    }

    const inputBuf = Buffer.from(await file.arrayBuffer());
    const args = buildFfmpegArgs(
      format as EncodeFormat,
      bitrate,
      evenDim(width),
      evenDim(height)
    );

    const ffmpegBin = resolveFfmpegPath();
    const result = await runFfmpeg(ffmpegBin, args, inputBuf);

    if (!result.ok) {
      if (result.timedOut) {
        return NextResponse.json({ error: 'انتهت مهلة ترميز الملف (240 ثانية)' }, { status: 500 });
      }
      console.error(
        `[production/encode] ffmpeg failed (${format}):`,
        result.stderr.replace(/\s+/g, ' ').slice(0, 300)
      );
      return NextResponse.json({ error: 'فشل ترميز الملف' }, { status: 500 });
    }

    if (result.data.length === 0) {
      return NextResponse.json({ error: 'فشل ترميز الملف — لا مخرجات' }, { status: 500 });
    }

    const body = new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
    return new NextResponse(body as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="production.${format}"`,
        'Content-Length': String(result.data.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[production/encode:POST] failed:', err);
    return NextResponse.json({ error: 'تعذّر تنفيذ طلب الترميز' }, { status: 500 });
  }
}
