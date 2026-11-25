import {
  RECITERS,
  type ReciterOption,
  type ReciterStyle,
} from './quran-data';
import {
  getReciterAudioUrl,
  getUpstreamAudioUrl,
  stripArabicDiacritics,
} from './quran-utils';

export type ReciterFilterTab = 'all' | 'popular' | 'favorites' | ReciterStyle;

export const RECITER_FILTER_TABS: { id: ReciterFilterTab; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'popular', label: 'الأشهر' },
  { id: 'favorites', label: 'المفضلة' },
  { id: 'murattal', label: 'مرتل' },
  { id: 'mujawwad', label: 'مجود' },
  { id: 'warsh', label: 'رواية ورش' },
  { id: 'muallim', label: 'المصحف المعلم' },
];

export function resolveReciterOption(
  slug: string | null | undefined,
  customReciters?: readonly ReciterOption[]
): ReciterOption {
  if (!slug) return RECITERS[0];
  const all =
    customReciters && customReciters.length > 0
      ? [...RECITERS, ...customReciters]
      : RECITERS;
  return all.find((r) => r.slug === slug) ?? RECITERS[0];
}

/**
 * Checks whether a reciter supports native verse-by-verse synchronization.
 * Only reciters from EveryAyah and Islamic Network are natively verse-by-verse.
 * Reciters from full-surah sources (such as Mansour Al-Salimi and other MP3Quran reciters)
 * do not pause verse-by-verse at the end of each ayah and are excluded from Studio.
 */
export function isReciterVerseSynced(reciter: ReciterOption): boolean {
  return reciter.source === 'everyayah' || reciter.source === 'islamic';
}

/**
 * Merges built-in and custom reciters, excluding any slugs listed in disabledSlugs.
 */
export function getActiveReciters(
  customReciters?: readonly ReciterOption[],
  disabledSlugs?: readonly string[]
): ReciterOption[] {
  const disabledSet = new Set(disabledSlugs || []);
  const customs = customReciters || [];
  const combined = [...RECITERS, ...customs];
  return combined.filter((r) => !disabledSet.has(r.slug));
}

/**
 * Returns reciters available for Studio playback & video export.
 * Strictly excludes any reciters that are not verse-by-verse segmented,
 * guaranteeing 100% slide-to-audio synchronization.
 */
export function getStudioActiveReciters(
  customReciters?: readonly ReciterOption[],
  disabledSlugs?: readonly string[]
): ReciterOption[] {
  const active = getActiveReciters(customReciters, disabledSlugs);
  return active.filter((r) => isReciterVerseSynced(r));
}

/**
 * Returns all reciters (built-in + custom) with indicators of custom and disabled status.
 */
export function getAllAdminReciters(
  customReciters?: readonly ReciterOption[],
  disabledSlugs?: readonly string[]
): (ReciterOption & { isCustom: boolean; isDisabled: boolean })[] {
  const disabledSet = new Set(disabledSlugs || []);
  const builtIns = RECITERS.map((r) => ({
    ...r,
    isCustom: false,
    isDisabled: disabledSet.has(r.slug),
  }));
  const customs = (customReciters || []).map((r) => ({
    ...r,
    isCustom: true,
    isDisabled: disabledSet.has(r.slug),
  }));
  return [...builtIns, ...customs];
}

export function toggleFavoriteReciterSlug(
  currentFavorites: readonly string[],
  slug: string
): string[] {
  const cleanSlug = slug.trim();
  if (!cleanSlug) return [...currentFavorites];
  const exists = currentFavorites.includes(cleanSlug);
  if (exists) {
    return currentFavorites.filter((s) => s !== cleanSlug);
  }
  return [cleanSlug, ...currentFavorites.filter((s) => s !== cleanSlug)];
}

export function filterAndSortReciters(
  reciters: readonly ReciterOption[],
  options: {
    query: string;
    tab: ReciterFilterTab;
    favoriteSlugs: readonly string[];
  }
): ReciterOption[] {
  const favSet = new Set(options.favoriteSlugs);
  const normQuery = stripArabicDiacritics(options.query).toLowerCase();

  const filtered = reciters.filter((r) => {
    if (options.tab === 'popular' && !r.popular) return false;
    if (options.tab === 'favorites' && !favSet.has(r.slug)) return false;
    if (
      options.tab !== 'all' &&
      options.tab !== 'popular' &&
      options.tab !== 'favorites' &&
      r.style !== options.tab
    ) {
      return false;
    }
    if (!normQuery) return true;
    const haystack = stripArabicDiacritics(
      `${r.name} ${r.styleLabel} ${r.country ?? ''} ${r.slug}`
    ).toLowerCase();
    return haystack.includes(normQuery);
  });

  if (options.tab === 'all' && favSet.size > 0) {
    return [...filtered].sort((a, b) => {
      const aFav = favSet.has(a.slug) ? 1 : 0;
      const bFav = favSet.has(b.slug) ? 1 : 0;
      return bFav - aFav;
    });
  }

  return filtered;
}

/**
 * Resolves the optimal playback audio URL for real-time verse recitation in the Quran Reader.
 * EveryAyah supports CORS directly from the CDN (zero proxy hops & zero rate-limit impact),
 * while Islamic Network streams through the same-origin proxy route.
 */
export function getReaderPlaybackAudioUrl(
  reciterSlug: string,
  globalVerseId: number
): string {
  const reciter = resolveReciterOption(reciterSlug);
  if (
    (reciter.source === 'everyayah' && reciter.everyayahFolder) ||
    (reciter.source === 'mp3quran' && reciter.mp3quranServer)
  ) {
    return getUpstreamAudioUrl(reciter.slug, globalVerseId);
  }
  return getReciterAudioUrl(reciter.slug, globalVerseId);
}
