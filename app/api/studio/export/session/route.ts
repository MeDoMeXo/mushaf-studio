import { NextRequest, NextResponse } from 'next/server';
import {
  appendBgVideoChunk,
  cancelExportJob,
  createExportSession,
  isValidJobId,
  readJobStatus,
  saveUploadedSlideBatch,
  type ExportJobMeta,
} from '@/lib/export-job-manager';
import { startExportJob } from '@/lib/export-render-pipeline';
import {
  isValidUploadedMediaHeader,
  isValidVideoBinaryHeader,
  MAX_EXPORT_FORM_BYTES,
  MAX_UPLOADED_AUDIO_BYTES,
  MAX_UPLOADED_SLIDE_BYTES,
} from '@/lib/video-export';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/studio/export/session
 * Creates a new chunked export session (accepts JSON or multipart with optional customAudio).
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let meta: Partial<ExportJobMeta> = {};
    let customAudioBuf: Buffer | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const metaRaw = formData.get('meta');
      if (typeof metaRaw !== 'string') {
        return NextResponse.json({ error: 'بيانات جلسة التصدير غير مكتملة' }, { status: 400 });
      }
      meta = JSON.parse(metaRaw) as Partial<ExportJobMeta>;
      const customAudio = formData.get('customAudio');
      if (customAudio instanceof File && customAudio.size > 0) {
        // Trust boundary: cap size and verify MP3/WAV magic bytes before persisting.
        if (customAudio.size > MAX_UPLOADED_AUDIO_BYTES) {
          return NextResponse.json(
            { error: 'حجم الملف الصوتي المخصص يتجاوز الحد المسموح' },
            { status: 413 }
          );
        }
        const head = new Uint8Array(await customAudio.slice(0, 12).arrayBuffer());
        if (!isValidUploadedMediaHeader(head, 'audio')) {
          return NextResponse.json(
            { error: 'الملف الصوتي غير صالح — يُسمح بـ MP3 أو WAV فقط' },
            { status: 415 }
          );
        }
        customAudioBuf = Buffer.from(await customAudio.arrayBuffer());
      }
    } else {
      const contentLength = Number(req.headers.get('content-length') || 0);
      if (contentLength > MAX_EXPORT_FORM_BYTES) {
        return NextResponse.json(
          { error: 'حجم طلب جلسة التصدير يتجاوز الحد المسموح' },
          { status: 413 }
        );
      }
      meta = (await req.json()) as Partial<ExportJobMeta>;
    }

    const status = await createExportSession(meta, customAudioBuf);
    return NextResponse.json({ jobId: status.jobId, status }, { status: 201 });
  } catch (err) {
    console.error('[studio/export/session:POST] failed:', err);
    return NextResponse.json(
      { error: 'تعذّر إنشاء جلسة تصدير الفيديو' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/studio/export/session?id=<jobId>
 * Uploads a small batch of slides (e.g. 12 slides, ~1-2 MB) to stay well under Cloud Run limits.
 */
export async function PUT(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('id') || '';
  if (!isValidJobId(jobId)) {
    return NextResponse.json({ error: 'معرّف الجلسة غير صالح' }, { status: 400 });
  }

  try {
    const kind = req.nextUrl.searchParams.get('kind');
    if (kind === 'bgvideo') {
      const chunkIndex = Math.max(0, Number.parseInt(req.nextUrl.searchParams.get('chunk') || '0', 10) || 0);
      const buf = Buffer.from(await req.arrayBuffer());
      if (!buf.byteLength) {
        return NextResponse.json({ error: 'جزء الفيديو فارغ' }, { status: 400 });
      }
      if (buf.byteLength > 16 * 1024 * 1024) {
        return NextResponse.json({ error: 'حجم جزء الفيديو يتجاوز الحد المسموح' }, { status: 413 });
      }
      // First chunk carries the MP4/WebM magic bytes — reject renamed non-video
      // payloads. The background video is user-uploaded so either container is legit.
      if (chunkIndex === 0) {
        const head = new Uint8Array(buf.buffer, buf.byteOffset, Math.min(12, buf.byteLength));
        if (!isValidVideoBinaryHeader(head, 'mp4') && !isValidVideoBinaryHeader(head, 'webm')) {
          return NextResponse.json(
            { error: 'صيغة فيديو الخلفية غير صالحة — يُسمح بـ MP4 أو WebM فقط' },
            { status: 415 }
          );
        }
      }
      const res = await appendBgVideoChunk(jobId, chunkIndex, buf);
      return NextResponse.json(res, { status: 200 });
    }

    const formData = await req.formData();
    const batch: { index: number; ext: 'png' | 'jpg'; buffer: Buffer }[] = [];
    const audioBatch: { index: number; buffer: Buffer }[] = [];
    let backdropBuffer: Buffer | undefined;

    for (const [key, val] of formData.entries()) {
      if (!(val instanceof File)) continue;
      if (key === 'backdrop') {
        if (val.size > MAX_UPLOADED_SLIDE_BYTES) {
          return NextResponse.json({ error: 'حجم خلفية الفيديو يتجاوز الحد المسموح' }, { status: 413 });
        }
        backdropBuffer = Buffer.from(await val.arrayBuffer());
        continue;
      }
      const slideMatch = /^slide_(\d+)$/.exec(key);
      if (slideMatch) {
        const index = Number(slideMatch[1]);
        const ext: 'png' | 'jpg' =
          val.type === 'image/jpeg' || val.name.endsWith('.jpg') ? 'jpg' : 'png';
        // Trust boundary: size cap + PNG/JPEG magic bytes check before writing to disk.
        if (val.size > MAX_UPLOADED_SLIDE_BYTES) {
          return NextResponse.json(
            { error: `حجم الشريحة يتجاوز الحد المسموح (${val.name || 'شريحة'})` },
            { status: 413 }
          );
        }
        const head = new Uint8Array(await val.slice(0, 12).arrayBuffer());
        if (!isValidUploadedMediaHeader(head, ext)) {
          return NextResponse.json(
            { error: 'صيغة الشريحة غير صالحة — يُسمح بصور PNG أو JPEG فقط' },
            { status: 415 }
          );
        }
        const buffer = Buffer.from(await val.arrayBuffer());
        batch.push({ index, ext, buffer });
        continue;
      }
      const audioMatch = /^audio_(\d+)$/.exec(key);
      if (audioMatch) {
        const index = Number(audioMatch[1]);
        if (val.size > MAX_UPLOADED_SLIDE_BYTES) {
          return NextResponse.json(
            { error: `حجم مقطع التلاوة يتجاوز الحد المسموح (${val.name || 'مقطع'})` },
            { status: 413 }
          );
        }
        const buffer = Buffer.from(await val.arrayBuffer());
        if (buffer.byteLength >= 128 && isValidUploadedMediaHeader(
          new Uint8Array(buffer.buffer, buffer.byteOffset, Math.min(12, buffer.byteLength)),
          'mp3'
        )) {
          audioBatch.push({ index, buffer });
        }
      }
    }

    if (!batch.length && !audioBatch.length && !backdropBuffer) {
      return NextResponse.json({ error: 'لم يتم إرفاق شرائح في هذه الدفعة' }, { status: 400 });
    }

    const res = await saveUploadedSlideBatch(jobId, batch, audioBatch, backdropBuffer);
    return NextResponse.json(res, { status: 200 });
  } catch (err) {
    console.error(`[studio/export/session:PUT:${jobId}] failed:`, err);
    const msg = err instanceof Error ? err.message : 'فشل رفع دفعة الشرائح';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/studio/export/session?id=<jobId>
 * Starts the asynchronous FFmpeg rendering pipeline and returns 202 immediately.
 */
export async function PATCH(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('id') || '';
  if (!isValidJobId(jobId)) {
    return NextResponse.json({ error: 'معرّف الجلسة غير صالح' }, { status: 400 });
  }

  try {
    const status = await startExportJob(jobId);
    return NextResponse.json({ status }, { status: 202 });
  } catch (err) {
    console.error(`[studio/export/session:PATCH:${jobId}] failed:`, err);
    const msg = err instanceof Error ? err.message : 'تعذّر بدء معالجة الفيديو';
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}

/**
 * GET /api/studio/export/session?id=<jobId>
 * Returns real-time server progress for an export job.
 */
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('id') || '';
  if (!isValidJobId(jobId)) {
    return NextResponse.json({ error: 'معرّف الجلسة غير صالح' }, { status: 400 });
  }

  const status = await readJobStatus(jobId);
  if (!status) {
    return NextResponse.json(
      { error: 'انتهت صلاحية جلسة التصدير — يرجى إعادة المحاولة' },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { status },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}

/**
 * DELETE /api/studio/export/session?id=<jobId>
 * Immediately kills active FFmpeg process and cleans up temp files.
 */
export async function DELETE(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('id') || '';
  if (!isValidJobId(jobId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await cancelExportJob(jobId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
