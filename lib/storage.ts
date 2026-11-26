import {
  CONFIG_DEFAULTS,
  EMPTY_STATS,
  type DailyStatBucket,
  type SavedCustomTemplate,
  type SiteConfig,
  type SiteStats,
} from './quran-data';
import { mergeSiteConfig, recordStatEvent } from './quran-utils';

export const STORAGE_KEYS = {
  CONFIG: 'quran_config_v1',
  STATS: 'quran_stats_v1',
  TEMPLATES: 'quran_custom_templates_v1',
  LAST_READ: 'qlast',
  BOOKMARKS: 'qbookmarks_v1',
  THEME: 'qtheme',
  RECITER: 'qreciter',
  FAVORITE_RECITERS: 'qfav_reciters_v1',
  TRANSLATION: 'qtrans',
  VSIZE: 'qvsize',
  SHOW_TRANS: 'qshowtrans',
  VERSE_HIGHLIGHT: 'qverse_highlight_v1',
  ADMIN_PIN: 'quran_admin_pin',
  ADMIN_SESSION: 'quran_admin_session',
  TEACHER_MODE: 'quran_teacher_mode_v1',
} as const;

export const CONFIG_EVENT = 'quran-config-updated';
export const STATS_EVENT = 'quran-stats-updated';

export interface LastReadInfo {
  surah: number;
  ayah: number;
  name: string;
}

export interface BookmarkItem {
  verseKey: string;
  surahId: number;
  ayahNumber: number;
  surahName: string;
  snippet: string;
  savedAt: number;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

export function loadSiteConfig(): SiteConfig {
  const raw = readJson<Partial<SiteConfig> | null>(STORAGE_KEYS.CONFIG, null);
  return mergeSiteConfig(raw);
}

export function saveSiteConfig(config: SiteConfig): SiteConfig {
  const updated: SiteConfig = { ...config, updatedAt: Date.now() };
  writeJson(STORAGE_KEYS.CONFIG, updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONFIG_EVENT, { detail: updated }));
  }
  return updated;
}

export function resetSiteConfig(): SiteConfig {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEYS.CONFIG);
    window.dispatchEvent(new CustomEvent(CONFIG_EVENT, { detail: CONFIG_DEFAULTS }));
  }
  return { ...CONFIG_DEFAULTS };
}

export function loadStats(): SiteStats {
  const raw = readJson<SiteStats | null>(STORAGE_KEYS.STATS, null);
  if (!raw) return { ...EMPTY_STATS, daily: {}, log: [] };
  return {
    ...EMPTY_STATS,
    ...raw,
    daily: raw.daily ?? {},
    log: Array.isArray(raw.log) ? raw.log : [],
  };
}

export function bumpStat(kind: keyof DailyStatBucket, detail = ''): SiteStats {
  const next = recordStatEvent(loadStats(), kind, detail);
  writeJson(STORAGE_KEYS.STATS, next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STATS_EVENT, { detail: next }));
  }
  return next;
}

export function saveStats(stats: SiteStats): void {
  writeJson(STORAGE_KEYS.STATS, stats);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STATS_EVENT, { detail: stats }));
  }
}

export function resetStats(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEYS.STATS);
    window.dispatchEvent(new CustomEvent(STATS_EVENT, { detail: EMPTY_STATS }));
  }
}

export function loadCustomTemplates(): SavedCustomTemplate[] {
  return readJson<SavedCustomTemplate[]>(STORAGE_KEYS.TEMPLATES, []);
}

export function saveCustomTemplates(list: SavedCustomTemplate[]): void {
  writeJson(STORAGE_KEYS.TEMPLATES, list);
}

export function loadLastRead(): LastReadInfo | null {
  return readJson<LastReadInfo | null>(STORAGE_KEYS.LAST_READ, null);
}

export function saveLastRead(info: LastReadInfo): void {
  writeJson(STORAGE_KEYS.LAST_READ, info);
}

export function loadBookmarks(): BookmarkItem[] {
  return readJson<BookmarkItem[]>(STORAGE_KEYS.BOOKMARKS, []);
}

export function saveBookmarks(items: BookmarkItem[]): void {
  writeJson(STORAGE_KEYS.BOOKMARKS, items);
}

export function loadFavoriteReciters(): string[] {
  const raw = readJson<unknown>(STORAGE_KEYS.FAVORITE_RECITERS, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

export function saveFavoriteReciters(slugs: string[]): void {
  writeJson(STORAGE_KEYS.FAVORITE_RECITERS, slugs);
}

export function getAdminPin(): string {
  if (typeof window === 'undefined') return '1234';
  return window.localStorage.getItem(STORAGE_KEYS.ADMIN_PIN) || '1234';
}

export function setAdminPin(pin: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS.ADMIN_PIN, pin);
}

export function isAdminAuthenticated(): boolean {
  const session = readJson<{ t: number } | null>(STORAGE_KEYS.ADMIN_SESSION, null);
  if (!session) return false;
  if (Date.now() - session.t > 8 * 3600 * 1000) {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
    }
    return false;
  }
  return true;
}

export function loginAdmin(pin: string): boolean {
  if (pin !== getAdminPin()) return false;
  writeJson(STORAGE_KEYS.ADMIN_SESSION, { t: Date.now() });
  return true;
}

export function logoutAdmin(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
  }
}
