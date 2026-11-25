import { NextRequest, NextResponse } from 'next/server';
import { RECITERS } from '@/lib/quran-data';
import { getUpstreamAudioUrl } from '@/lib/quran-utils';
import { isCacheableAudioPayload, readCachedAudio, writeCachedAudio } from '@/lib/server-audio-cache';
import { getOrSliceVerseAudio } from '@/lib/mp3quran-timing';

export const runtime = 'nodejs';

function resolveParams(reciter: string, ayah: string) {
  const validReciter = RECITERS.find((r) => r.slug === reciter);
  const ayahNum = Number(ayah);
  if (
    !validReciter ||
    !Number.isInteger(ayahNum) ||
    ayahNum < 1 ||
    ayahNum > 6236
  ) {
    return null;
  }
  return { reciter: validReciter, ayahNum };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ reciter: string; ayah: string }> }
) {
  const { reciter, ayah } = await context.params;
  const resolved = resolveParams(reciter, ayah);
  if (!resolved) {
    return NextResponse.json(
      { error: 'Invalid reciter or verse identifier' },
      { status: 400 }
    );
  }

  const upstreamUrl = getUpstreamAudioUrl(resolved.reciter.slug, resolved.ayahNum);
  const upstreamHeaders: Record<string, string> = {};
  const rangeHeader = req.headers.get('range');
  if (rangeHeader) {
    upstreamHeaders.Range = rangeHeader;
  }

  // Durable server cache (roadmap item 4): full-file hits skip the upstream
  // CDN entirely. Range requests only use the cache when the full payload is
  // already stored (we slice it ourselves), otherwise they pass through.
  if (!rangeHeader || rangeHeader === 'bytes=0-') {
    const cached = await readCachedAudio(resolved.reciter.slug, resolved.ayahNum);
    if (cached) {
      const headers = new Headers();
      headers.set('Content-Type', 'audio/mpeg');
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'public, max-age=604800, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Content-Length', String(cached.byteLength));
      headers.set('X-Quran-Audio-Cache', 'hit');
      return new NextResponse(new Uint8Array(cached), { status: 200, headers });
    }
  }

  // MP3Quran reciters with verse timing: slice verse on-demand using FFmpeg
  if (resolved.reciter.source === 'mp3quran' && resolved.reciter.mp3quranReadId) {
    const sliced = await getOrSliceVerseAudio(resolved.reciter, resolved.ayahNum);
    if (sliced && sliced.byteLength >= 512) {
      const headers = new Headers();
      headers.set('Content-Type', 'audio/mpeg');
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'public, max-age=604800, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Content-Length', String(sliced.byteLength));
      headers.set('X-Quran-Audio-Cache', 'sliced');
      return new NextResponse(new Uint8Array(sliced), { status: 200, headers });
    }
  }

  // Transient upstream hiccups (everyayah first-connection 502s observed in the
  // audit) are common on free CDNs — retry once after a short backoff before
  // surfacing the failure to the client, mirroring /api/audio/batch behaviour.
  let upstream: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(upstreamUrl, {
        headers: upstreamHeaders,
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok || res.status === 206) {
        upstream = res;
        break;
      }
      upstream = res;
    } catch {
      upstream = null;
    }
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  if (!upstream || (!upstream.ok && upstream.status !== 206)) {
    return NextResponse.json(
      { error: 'Audio source temporarily unavailable' },
      { status: 502 }
    );
  }

  try {
    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=604800, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) headers.set('Content-Range', contentRange);
    headers.set('X-Quran-Audio-Cache', 'miss');

    // Persistable full payloads are teed into the durable cache in the
    // background while the client keeps streaming from the upstream response.
    const lengthNum = contentLength ? Number(contentLength) : null;
    if (isCacheableAudioPayload(upstream.status, lengthNum, upstream.headers.get('content-type'))) {
      void upstream
        .clone()
        .arrayBuffer()
        .then((buf) => writeCachedAudio(resolved.reciter.slug, resolved.ayahNum, Buffer.from(buf)))
        .catch(() => {});
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to stream audio recitation' },
      { status: 502 }
    );
  }
}
