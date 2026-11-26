import { NextRequest, NextResponse } from 'next/server';
import {
  AUDIO_BATCH_MAX_RESPONSE_BYTES,
  AUDIO_BATCH_MAX_VERSES,
  encodeAudioBatchFrames,
  type AudioBatchFrame,
} from '@/lib/audio-batch-codec';
import { RECITERS, type ReciterOption } from '@/lib/quran-data';
import { getUpstreamAudioUrl } from '@/lib/quran-utils';
import { isValidEveryayahFolder } from '@/lib/custom-reciter-spec';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function fetchSingleVerseBytes(
  reciterSlug: string,
  verseId: number,
  customList?: readonly ReciterOption[]
): Promise<Uint8Array> {
  const url = getUpstreamAudioUrl(reciterSlug, verseId, customList);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const ab = await res.arrayBuffer();
      if (ab.byteLength >= 128) {
        return new Uint8Array(ab);
      }
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }
  return new Uint8Array(0);
}

/**
 * POST /api/audio/batch
 * Fetches up to 20 verse MP3s in a single HTTP request (cutting Cloud Run ingress
 * requests by ~16-20x for long surahs like Al-Baqarah 286 verses, preventing HTTP 429).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      reciter?: string;
      verseIds?: unknown;
      folder?: unknown;
    };
    const validReciter = RECITERS.find((r) => r.slug === body.reciter);
    if (!Array.isArray(body.verseIds)) {
      return NextResponse.json({ error: 'بيانات طلب التلاوات غير صالحة' }, { status: 400 });
    }

    // EveryAyah custom reciters: the client sends the validated folder spec.
    // Built-in slugs ignore the spec (whitelist stays authoritative) and
    // mp3quran customs are not batchable here (they stream via the
    // single-verse route with FFmpeg slicing instead).
    let customList: ReciterOption[] | undefined;
    if (!validReciter) {
      const slug = typeof body.reciter === 'string' ? body.reciter : '';
      const folder = typeof body.folder === 'string' ? body.folder : '';
      if (
        /^[a-z0-9][a-z0-9._-]{0,63}$/.test(slug) &&
        isValidEveryayahFolder(folder)
      ) {
        customList = [
          {
            slug,
            name: slug,
            style: 'murattal',
            styleLabel: 'مرتل',
            bitrate: 128,
            source: 'everyayah',
            everyayahFolder: folder,
          },
        ];
      }
    }
    if (!validReciter && !customList) {
      return NextResponse.json({ error: 'بيانات طلب التلاوات غير صالحة' }, { status: 400 });
    }

    const verseIds = body.verseIds
      .slice(0, AUDIO_BATCH_MAX_VERSES)
      .map((v) => Math.floor(Number(v)))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 6236);

    if (!verseIds.length) {
      return NextResponse.json({ error: 'لا توجد آيات صالحة في الطلب' }, { status: 400 });
    }

    const fetchSlug = validReciter ? validReciter.slug : customList![0].slug;
    const fetched: Uint8Array[] = new Array(verseIds.length).fill(new Uint8Array(0));
    let cursor = 0;
    const workers = Array.from({ length: Math.min(6, verseIds.length) }, async () => {
      while (cursor < verseIds.length) {
        const idx = cursor++;
        fetched[idx] = await fetchSingleVerseBytes(fetchSlug, verseIds[idx], customList);
      }
    });
    await Promise.all(workers);

    // Enforce safe 18 MB response cap under Cloud Run's 32 MB limit
    const frames: AudioBatchFrame[] = [];
    let accumulated = 0;
    for (let i = 0; i < verseIds.length; i++) {
      const data = fetched[i];
      if (data.byteLength > 0 && accumulated + data.byteLength <= AUDIO_BATCH_MAX_RESPONSE_BYTES) {
        frames.push({ verseId: verseIds[i], data });
        accumulated += data.byteLength;
      } else {
        frames.push({ verseId: verseIds[i], data: new Uint8Array(0) });
      }
    }

    const encoded = encodeAudioBatchFrames(frames);
    const bodyBuffer = encoded.buffer.slice(
      encoded.byteOffset,
      encoded.byteOffset + encoded.byteLength
    ) as ArrayBuffer;
    return new NextResponse(bodyBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Audio-Batch-Count': String(frames.length),
      },
    });
  } catch (err) {
    console.error('[api/audio/batch] failed:', err);
    return NextResponse.json({ error: 'تعذّر تحميل دفعة التلاوات' }, { status: 500 });
  }
}
