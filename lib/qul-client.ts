import {
  DEFAULT_TRANSLATION_ID,
  FALLBACK_CHAPTERS,
  FALLBACK_VERSES,
  type QulChapter,
  type QulVerse,
} from './quran-data';

let chaptersCache: QulChapter[] | null = null;
let chaptersPromise: Promise<QulChapter[]> | null = null;
const versesCache = new Map<string, QulVerse[]>();

export async function fetchChapters(): Promise<QulChapter[]> {
  if (chaptersCache) return chaptersCache;
  if (chaptersPromise) return chaptersPromise;

  chaptersPromise = fetch('/api/qul/chapters')
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { chapters?: QulChapter[] };
      const list = Array.isArray(data.chapters) && data.chapters.length > 0
        ? data.chapters
        : FALLBACK_CHAPTERS;
      chaptersCache = list;
      return list;
    })
    .catch(() => {
      chaptersCache = FALLBACK_CHAPTERS;
      return FALLBACK_CHAPTERS;
    })
    .finally(() => {
      chaptersPromise = null;
    });

  return chaptersPromise;
}

export async function fetchChapterVerses(
  surahId: number,
  translationId: number = DEFAULT_TRANSLATION_ID
): Promise<QulVerse[]> {
  const key = `${surahId}:${translationId}`;
  const existing = versesCache.get(key);
  if (existing) return existing;

  try {
    const res = await fetch(
      `/api/qul/chapters/${surahId}/verses?translation=${translationId}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { verses?: QulVerse[] };
    const verses = Array.isArray(data.verses) ? data.verses : [];
    if (verses.length > 0) {
      versesCache.set(key, verses);
      return verses;
    }
  } catch {
    // Fall back to deterministic seed verses if offline
  }

  return FALLBACK_VERSES[surahId] ?? FALLBACK_VERSES[1];
}

export async function fetchSingleVerse(
  surahId: number,
  ayahNumber: number,
  translationId: number = DEFAULT_TRANSLATION_ID
): Promise<QulVerse | null> {
  const verses = await fetchChapterVerses(surahId, translationId);
  const exact = verses.find((v) => v.verse_key === `${surahId}:${ayahNumber}`);
  return exact ?? verses[ayahNumber - 1] ?? verses[0] ?? null;
}
