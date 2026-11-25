import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_TRANSLATION_ID,
  FALLBACK_VERSES,
  QUL_API_BASE,
  type QulVerse,
} from '@/lib/quran-data';

export const revalidate = 86400;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const surahId = Number(id);
  if (!Number.isInteger(surahId) || surahId < 1 || surahId > 114) {
    return NextResponse.json({ error: 'Invalid surah id' }, { status: 400 });
  }

  const transParam = Number(req.nextUrl.searchParams.get('translation'));
  const translationId =
    Number.isInteger(transParam) && transParam > 0
      ? transParam
      : DEFAULT_TRANSLATION_ID;

  try {
    const allVerses: QulVerse[] = [];
    let page = 1;

    while (page <= 6) {
      const url = `${QUL_API_BASE}/chapters/${surahId}/verses?fields=text_uthmani,page_number&translations=${translationId}&per_page=300&page=${page}`;
      const res = await fetch(url, {
        next: { revalidate: 86400 },
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`QUL verses error: ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data.verses)) {
        allVerses.push(...data.verses);
      }
      if (!data.pagination || !data.pagination.next_page) {
        break;
      }
      page += 1;
    }

    if (allVerses.length === 0) {
      throw new Error('Empty verses response');
    }

    return NextResponse.json(
      { verses: allVerses, source: 'qul' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        verses: FALLBACK_VERSES[surahId] ?? FALLBACK_VERSES[1],
        source: 'fallback',
      },
      { status: 200 }
    );
  }
}
