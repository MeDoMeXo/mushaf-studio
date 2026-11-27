import { NextRequest, NextResponse } from 'next/server';
import { RECITERS } from '@/lib/quran-data';
import { parseCustomReciterSpec, resolveReciterFromSpec } from '@/lib/custom-reciter-spec';
import { getVerseWordTimings } from '@/lib/word-timing-server';
import type { ReciterOption } from '@/lib/quran-data-types';

export const runtime = 'nodejs';

/** أقصى عدد آيات في الطلب الواحد (العميل يقطّعها على دفعات). */
const MAX_ITEMS = 24;
const MAX_TEXT_CHARS = 2000;

interface RequestItem {
  verseId: number;
  text: string;
}

interface ResponseItem {
  verseId: number;
  ok: boolean;
  hopMs?: number;
  /** حدود الكلمات بصيغة مدمجة {i, s, e} لتصغير الحجم. */
  spans?: { i: number; s: number; e: number }[];
}

function parseItems(raw: unknown): RequestItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: RequestItem[] = [];
  for (const item of raw.slice(0, MAX_ITEMS)) {
    if (!item || typeof item !== 'object') return null;
    const verseId = Number((item as { verseId?: unknown }).verseId);
    const text = String((item as { text?: unknown }).text ?? '');
    if (!Number.isInteger(verseId) || verseId < 1 || verseId > 6236) return null;
    if (!text.trim() || text.length > MAX_TEXT_CHARS) return null;
    out.push({ verseId, text });
  }
  return out.length ? out : null;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const payload = body as { reciter?: unknown; items?: unknown };
  const reciterSlug = String(payload.reciter ?? '');
  const items = parseItems(payload.items);
  if (!reciterSlug || !items) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // القارئ: مدمج في القائمة البيضاء، أو مواصفة مخصصة من معلمات الاستعلام
  // (نفس آلية وكيل الصوت تماماً — folder أو server+readId).
  let customList: readonly ReciterOption[] | undefined;
  if (!RECITERS.some((r) => r.slug === reciterSlug)) {
    const spec = parseCustomReciterSpec((key) => req.nextUrl.searchParams.get(key));
    if (!spec) {
      return NextResponse.json({ error: 'Unknown reciter' }, { status: 400 });
    }
    const custom = resolveReciterFromSpec(reciterSlug, spec);
    if (!custom) {
      return NextResponse.json({ error: 'Invalid reciter spec' }, { status: 400 });
    }
    customList = [custom];
  }

  const results: ResponseItem[] = await Promise.all(
    items.map(async (item): Promise<ResponseItem> => {
      try {
        const timings = await getVerseWordTimings(
          customList ? customList[0].slug : reciterSlug,
          item.verseId,
          item.text,
          customList
        );
        if (!timings) return { verseId: item.verseId, ok: false };
        return {
          verseId: item.verseId,
          ok: true,
          hopMs: timings.hopMs,
          spans: timings.spans.map((s) => ({ i: s.index, s: s.startSec, e: s.endSec })),
        };
      } catch {
        return { verseId: item.verseId, ok: false };
      }
    })
  );

  return NextResponse.json(
    { ok: true, results },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
