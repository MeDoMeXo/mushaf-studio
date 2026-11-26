/**
 * Custom-reciter wire spec (isomorphic, pure) — shared by the client URL
 * builders and the server audio proxy routes.
 *
 * Custom reciters are defined client-side (admin panel → localStorage config),
 * so the server cannot resolve their slugs from the static RECITERS list.
 * Instead the client appends a strictly-validated wire spec (query params /
 * export meta fields) that lets the proxy fetch, cache and FFmpeg-slice verse
 * audio for them exactly like a built-in reciter:
 *
 *   - everyayah customs:  ?folder=Alafasy_128kbps
 *   - mp3quran customs:   ?server=https://server8.mp3quran.net/…/&readId=1194
 *
 * Every validator below is security-critical (the server fetches remote URLs
 * based on these values), so hostnames are pinned to the known Quran CDNs and
 * folder names / slugs are charset-constrained to block path traversal.
 */
import type { ReciterOption } from './quran-data-types';

export interface CustomReciterSpec {
  /** EveryAyah data folder (e.g. "Alafasy_128kbps"). */
  folder?: string;
  /** MP3Quran server base URL (must be https and on an mp3quran.net host). */
  server?: string;
  /** MP3Quran timing read id — enables server-side verse slicing. */
  readId?: number;
}

const CUSTOM_SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const EVERYAYAH_FOLDER_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,80}$/;

export function isValidCustomReciterSlug(slug: string): boolean {
  return CUSTOM_SLUG_RE.test(slug);
}

export function isValidEveryayahFolder(folder: string): boolean {
  return EVERYAYAH_FOLDER_RE.test(folder);
}

export function isValidMp3quranServer(server: string): boolean {
  try {
    const url = new URL(server);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    // Pin to the MP3Quran CDN family (matches the app CSP media/connect policy)
    // — blocks SSRF against arbitrary internal/external hosts.
    return host === 'mp3quran.net' || host.endsWith('.mp3quran.net');
  } catch {
    return false;
  }
}

export function isValidMp3quranReadId(readId: number): boolean {
  return Number.isInteger(readId) && readId >= 1 && readId <= 99_999;
}

/** Builds the validated wire spec for a custom reciter (null for built-ins). */
export function buildCustomReciterSpec(reciter: ReciterOption): CustomReciterSpec | null {
  if (reciter.source === 'everyayah' && reciter.everyayahFolder) {
    if (!isValidEveryayahFolder(reciter.everyayahFolder)) return null;
    return { folder: reciter.everyayahFolder };
  }
  if (reciter.source === 'mp3quran' && reciter.mp3quranServer) {
    if (!isValidMp3quranServer(reciter.mp3quranServer)) return null;
    const spec: CustomReciterSpec = { server: reciter.mp3quranServer };
    if (
      reciter.mp3quranReadId !== undefined &&
      isValidMp3quranReadId(reciter.mp3quranReadId)
    ) {
      spec.readId = reciter.mp3quranReadId;
    }
    return spec;
  }
  return null;
}

/** URL query string (leading "?") carrying the spec for same-origin proxy calls. */
export function buildCustomReciterSpecQuery(reciter: ReciterOption): string {
  const spec = buildCustomReciterSpec(reciter);
  if (!spec) return '';
  const params = new URLSearchParams();
  if (spec.folder) params.set('folder', spec.folder);
  if (spec.server) params.set('server', spec.server);
  if (spec.readId !== undefined) params.set('readId', String(spec.readId));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Parses + validates a spec from generic search-param access (works for both
 * web `URLSearchParams` and `NextUrl.searchParams`). Returns null when the
 * values fail validation — callers must reject the request in that case.
 */
export function parseCustomReciterSpec(
  getParam: (key: string) => string | null
): CustomReciterSpec | null {
  const folder = getParam('folder');
  const server = getParam('server');
  const readIdRaw = getParam('readId');

  if (folder !== null && server !== null) return null;
  if (folder !== null) {
    if (!isValidEveryayahFolder(folder)) return null;
    return { folder };
  }
  if (server !== null) {
    if (!isValidMp3quranServer(server)) return null;
    const spec: CustomReciterSpec = { server };
    if (readIdRaw !== null) {
      const readId = Number(readIdRaw);
      if (!isValidMp3quranReadId(readId)) return null;
      spec.readId = readId;
    }
    return spec;
  }
  return null;
}

/**
 * Reconstructs a ReciterOption from a validated spec + slug. The option is
 * only used for URL building / FFmpeg slicing — display fields get neutral
 * defaults.
 */
export function resolveReciterFromSpec(
  slug: string,
  spec: CustomReciterSpec
): ReciterOption | null {
  if (!isValidCustomReciterSlug(slug)) return null;
  if (spec.folder) {
    if (!isValidEveryayahFolder(spec.folder)) return null;
    return {
      slug,
      name: slug,
      style: 'murattal',
      styleLabel: 'مرتل',
      bitrate: 128,
      source: 'everyayah',
      everyayahFolder: spec.folder,
    };
  }
  if (spec.server) {
    if (!isValidMp3quranServer(spec.server)) return null;
    const option: ReciterOption = {
      slug,
      name: slug,
      style: 'murattal',
      styleLabel: 'مرتل',
      bitrate: 128,
      source: 'mp3quran',
      mp3quranServer: spec.server,
    };
    if (spec.readId !== undefined) {
      if (!isValidMp3quranReadId(spec.readId)) return null;
      option.mp3quranReadId = spec.readId;
    }
    return option;
  }
  return null;
}
