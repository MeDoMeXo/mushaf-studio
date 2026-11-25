import { NextResponse } from 'next/server';
import { FALLBACK_CHAPTERS, QUL_API_BASE } from '@/lib/quran-data';

export const revalidate = 86400;

export async function GET() {
  try {
    const res = await fetch(`${QUL_API_BASE}/chapters?language=ar`, {
      next: { revalidate: 86400 },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`QUL chapters error: ${res.status}`);
    }
    const data = await res.json();
    return NextResponse.json(
      { chapters: data.chapters ?? FALLBACK_CHAPTERS, source: 'qul' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch {
    return NextResponse.json(
      { chapters: FALLBACK_CHAPTERS, source: 'fallback' },
      { status: 200 }
    );
  }
}
