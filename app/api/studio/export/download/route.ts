import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import {
  buildSrtDownloadFilename,
  parseByteRangeHeader,
  resolveExportDownloadDisposition,
} from '@/lib/export-download';
import { getJobDir, isValidJobId, readJobStatus } from '@/lib/export-job-manager';

export const runtime = 'nodejs';

/**
 * GET /api/studio/export/download?id=<jobId>[&download=1][&kind=srt]
 * Streams rendered MP4/WebM (with HTTP 206 Range seeking) or UTF-8 `.srt`
 * captions, using RFC 5987 UTF-8 Content-Disposition headers.
 */
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('id') || '';
  if (!isValidJobId(jobId)) {
    return NextResponse.json({ error: 'معرّف الجلسة غير صالح' }, { status: 400 });
  }

  const status = await readJobStatus(jobId);
  if (!status || status.stage !== 'done' || !status.result) {
    return NextResponse.json({ error: 'الفيديو غير جاهز أو انتهت صلاحيته' }, { status: 404 });
  }

  const kind = req.nextUrl.searchParams.get('kind');
  const jobDir = getJobDir(jobId);

  if (kind === 'srt') {
    // lang=en streams the translation track (output_en.srt); default is the
    // Arabic Uthmani track. Both share the same timeline grid.
    const lang = req.nextUrl.searchParams.get('lang');
    const srtPath = path.join(
      jobDir,
      lang === 'en' ? 'output_en.srt' : 'output.srt'
    );
    try {
      const srtBody = await fs.readFile(srtPath, 'utf8');
      const baseAscii = buildSrtDownloadFilename(status.result.filename);
      const displaySrt = (status.result.displayFilename || baseAscii).replace(
        /\.(mp4|webm|srt)$/i,
        lang === 'en' ? '.en.srt' : '.srt'
      );
      return new NextResponse(srtBody, {
        status: 200,
        headers: {
          'Content-Type': 'application/x-subrip; charset=utf-8',
          'Content-Disposition': `attachment; filename="${baseAscii}"; filename*=UTF-8''${encodeURIComponent(displaySrt)}`,
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      return NextResponse.json({ error: 'ملف الترجمة غير متوفر لهذه الجلسة' }, { status: 404 });
    }
  }

  const format = status.result.format === 'webm' ? 'webm' : 'mp4';
  const videoPath = path.join(jobDir, `output.${format}`);
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(videoPath);
  } catch {
    return NextResponse.json({ error: 'ملف الفيديو غير موجود على الخادم' }, { status: 404 });
  }

  const rangeRes = parseByteRangeHeader(req.headers.get('range'), stat.size);
  if (!rangeRes.ok) {
    return new NextResponse(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${stat.size}` },
    });
  }

  const disposition = resolveExportDownloadDisposition(req.nextUrl.searchParams.get('download'));
  const asciiName = status.result.filename || `quran_recitation.${format}`;
  const displayName = status.result.displayFilename || asciiName;
  const contentType = format === 'webm' ? 'video/webm' : 'video/mp4';

  const nodeStream = createReadStream(videoPath, {
    start: rangeRes.start,
    end: rangeRes.end,
  });
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Content-Disposition': `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(displayName)}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': String(rangeRes.end - rangeRes.start + 1),
    'Cache-Control': 'no-store',
  };

  if (rangeRes.isPartial) {
    headers['Content-Range'] = `bytes ${rangeRes.start}-${rangeRes.end}/${stat.size}`;
  }

  return new NextResponse(webStream, {
    status: rangeRes.isPartial ? 206 : 200,
    headers,
  });
}
