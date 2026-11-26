/**
 * Built-in animated background library — 9 curated looping clips served
 * from public/assets/bg-library/: 5 procedural Islamic patterns (generated
 * in-repo by scripts/generate-islamic-backgrounds.py) + 4 licensed nature
 * clips (Mixkit License, fetched by scripts/fetch-nature-backgrounds.sh).
 *
 * The registry is the single source of truth shared by the studio UI (the
 * background tab's library grid), the client export pipeline (which sends
 * only the id) and the server render pipeline (which resolves the id against
 * this whitelist and copies the file — never a user-supplied path).
 */

export type BuiltinBackgroundCategory = 'islamic' | 'nature';

export interface BuiltinBackground {
  id: string;
  name: string;
  category: BuiltinBackgroundCategory;
  file: string;
  /** Two-stop gradient shown on the library card before the video loads. */
  posterColors: [string, string];
  /** License note; nature clips cite Mixkit, islamic clips are in-repo procedural. */
  license: string;
  /** Upstream source page (nature clips) or empty for in-repo procedural art. */
  sourceUrl: string;
}

export const BUILTIN_BG_LIBRARY: readonly BuiltinBackground[] = [
  {
    id: 'islamic-1-star-rotate',
    name: 'نجمة ثمانية دوّارة',
    category: 'islamic',
    file: 'islamic-1-star-rotate.mp4',
    posterColors: ['#1a2440', '#c9a227'],
    license: 'Procedural (generated in-repo, scripts/generate-islamic-backgrounds.py)',
    sourceUrl: '',
  },
  {
    id: 'islamic-2-arabesque',
    name: 'أرابيسك يتنفس',
    category: 'islamic',
    file: 'islamic-2-arabesque.mp4',
    posterColors: ['#102e2c', '#44b298'],
    license: 'Procedural (generated in-repo, scripts/generate-islamic-backgrounds.py)',
    sourceUrl: '',
  },
  {
    id: 'islamic-3-geometry',
    name: 'شبكة ثمانيات متلألئة',
    category: 'islamic',
    file: 'islamic-3-geometry.mp4',
    posterColors: ['#181e38', '#e6c75a'],
    license: 'Procedural (generated in-repo, scripts/generate-islamic-backgrounds.py)',
    sourceUrl: '',
  },
  {
    id: 'islamic-4-lanterns',
    name: 'قناديل رمضان',
    category: 'islamic',
    file: 'islamic-4-lanterns.mp4',
    posterColors: ['#1e183a', '#e6c75a'],
    license: 'Procedural (generated in-repo, scripts/generate-islamic-backgrounds.py)',
    sourceUrl: '',
  },
  {
    id: 'islamic-5-light-rays',
    name: 'أشعة نور',
    category: 'islamic',
    file: 'islamic-5-light-rays.mp4',
    posterColors: ['#403a58', '#fff0c8'],
    license: 'Procedural (generated in-repo, scripts/generate-islamic-backgrounds.py)',
    sourceUrl: '',
  },
  {
    id: 'nature-1-clouds',
    name: 'غيوم فوق الجبال',
    category: 'nature',
    file: 'nature-1-clouds.mp4',
    posterColors: ['#8fa8c8', '#e8eef6'],
    license: 'Mixkit License',
    sourceUrl: 'https://mixkit.co/free-stock-video/clouds/',
  },
  {
    id: 'nature-2-waves',
    name: 'أمواج البحر',
    category: 'nature',
    file: 'nature-2-waves.mp4',
    posterColors: ['#2a6b8f', '#bfe3f0'],
    license: 'Mixkit License',
    sourceUrl: 'https://mixkit.co/free-stock-video/waves/',
  },
  {
    id: 'nature-3-sunset',
    name: 'غروب السحر',
    category: 'nature',
    file: 'nature-3-sunset.mp4',
    posterColors: ['#8a4a2f', '#f2c17d'],
    license: 'Mixkit License',
    sourceUrl: 'https://mixkit.co/free-stock-video/sunset/',
  },
  {
    id: 'nature-4-leaves',
    name: 'أوراق تتمايل',
    category: 'nature',
    file: 'nature-4-leaves.mp4',
    posterColors: ['#3d5a3a', '#b8d4a8'],
    license: 'Mixkit License',
    sourceUrl: 'https://mixkit.co/free-stock-video/leaves/',
  },
];

export const BUILTIN_BG_COUNT = BUILTIN_BG_LIBRARY.length;

/** All registry ids — handy for iteration/validators (plan Task 4 interface). */
export const BUILTIN_BG_IDS: readonly string[] = BUILTIN_BG_LIBRARY.map((bg) => bg.id);

const BG_BY_ID: ReadonlyMap<string, BuiltinBackground> = new Map(
  BUILTIN_BG_LIBRARY.map((bg) => [bg.id, bg])
);

/** Strict whitelist check — the only ids the export server will ever resolve. */
export function isBuiltinBackgroundId(id: string | undefined | null): boolean {
  return typeof id === 'string' && BG_BY_ID.has(id);
}

/** Resolves a library entry by id, or null for anything unknown. */
export function getBuiltinBackground(id: string | undefined | null): BuiltinBackground | null {
  if (typeof id !== 'string') return null;
  return BG_BY_ID.get(id) ?? null;
}

/** Public URL for the studio's <video> preview element, or null when unknown. */
export function getBuiltinBackgroundPublicPath(id: string | undefined | null): string | null {
  const bg = getBuiltinBackground(id);
  return bg ? `/assets/bg-library/${bg.file}` : null;
}
