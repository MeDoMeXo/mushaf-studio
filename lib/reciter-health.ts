/**
 * Reciter health check — HEAD-request probe of every reciter's CDN audio.
 *
 * The RECITERS list (38 reciters) is maintained by hand; a folder rename or
 * bitrate change on the upstream CDNs (cdn.islamic.network / everyayah.com)
 * breaks a reciter silently until a user hits a 502. This module resolves
 * each reciter's upstream URL for a sample verse (Al-Fatiha 1:1) and issues a
 * cheap HEAD request, so drift is caught early (run from CI or a cron job).
 */
import {
  AUDIO_CDN_BASE,
  EVERYAYAH_CDN_BASE,
  RECITERS,
  type ReciterOption,
} from './quran-data';
import { getUpstreamAudioUrl, globalVerseIdToSurahAyah } from './quran-utils';

export const RECITER_HEALTH_SAMPLE_VERSE = 1; // Al-Fatiha 1:1 (global verse id 1)
export const RECITER_HEALTH_TIMEOUT_MS = 10000;

export type ReciterHealthResult = {
  slug: string;
  name: string;
  source: 'islamic' | 'everyayah' | 'mp3quran';
  url: string;
  ok: boolean;
  status: number | null;
  error?: string;
  ms: number;
};

export type ReciterHealthReport = {
  checkedAt: string;
  total: number;
  healthy: number;
  broken: number;
  results: ReciterHealthResult[];
};

/** Resolves the upstream probe URL for one reciter by slug (pure, testable). */
export function getReciterProbeUrl(reciterSlug: string): string {
  return getUpstreamAudioUrl(reciterSlug, RECITER_HEALTH_SAMPLE_VERSE);
}

/** Resolves the probe URL directly from a ReciterOption object (supports custom reciters). */
export function resolveProbeUrlForReciter(
  reciter: ReciterOption,
  verseId: number = RECITER_HEALTH_SAMPLE_VERSE
): string {
  if (typeof window !== 'undefined' && reciter.source === 'islamic') {
    return `/api/audio/${reciter.slug}/${verseId}`;
  }
  if (reciter.source === 'everyayah' && reciter.everyayahFolder) {
    const { surah, ayah } = globalVerseIdToSurahAyah(verseId);
    const sss = String(surah).padStart(3, '0');
    const aaa = String(ayah).padStart(3, '0');
    return `${EVERYAYAH_CDN_BASE}/${reciter.everyayahFolder}/${sss}${aaa}.mp3`;
  }
  if (reciter.source === 'mp3quran' && reciter.mp3quranServer) {
    const { surah } = globalVerseIdToSurahAyah(verseId);
    const sss = String(surah).padStart(3, '0');
    return `${reciter.mp3quranServer}${sss}.mp3`;
  }
  return `${AUDIO_CDN_BASE}/${reciter.bitrate}/${reciter.slug}/${verseId}.mp3`;
}

/** Maps a fetch outcome to a structured result row (pure, testable). */
export function toHealthResult(
  reciter: { slug: string; name: string; source?: string },
  url: string,
  outcome: { ok: boolean; status: number | null; error?: string },
  ms: number
): ReciterHealthResult {
  return {
    slug: reciter.slug,
    name: reciter.name,
    source:
      reciter.source === 'everyayah'
        ? 'everyayah'
        : reciter.source === 'mp3quran'
        ? 'mp3quran'
        : 'islamic',
    url,
    ok: outcome.ok,
    status: outcome.status ?? null,
    error: outcome.error,
    ms,
  };
}

/** HTTP statuses we treat as "the audio exists upstream". */
export function isHealthyStatus(status: number | null): boolean {
  // 200 = full body, 206 = range honored (both mean the asset is reachable);
  // 405 = HEAD not allowed but GET would work (some CDNs reject HEAD only).
  return status !== null && (status === 200 || status === 206 || status === 405);
}

/** Probes a single reciter with a lightweight HEAD request. */
export async function probeSingleReciterHealth(
  reciter: ReciterOption,
  timeoutMs = RECITER_HEALTH_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch
): Promise<ReciterHealthResult> {
  const url = resolveProbeUrlForReciter(reciter);
  const started = Date.now();
  let outcome: { ok: boolean; status: number | null; error?: string };
  try {
    const res = await fetchImpl(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    outcome = { ok: isHealthyStatus(res.status), status: res.status };
  } catch (err) {
    outcome = {
      ok: false,
      status: null,
      error: err instanceof Error ? err.message : 'network error',
    };
  }
  return toHealthResult(reciter, url, outcome, Date.now() - started);
}

/** Probes reciters with bounded concurrency and returns a full report. */
export async function checkAllRecitersHealth(
  concurrency = 6,
  timeoutMs = RECITER_HEALTH_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
  recitersList: readonly ReciterOption[] = RECITERS
): Promise<ReciterHealthReport> {
  const results: ReciterHealthResult[] = [];
  const queue = [...recitersList];

  async function worker() {
    while (queue.length) {
      const reciter = queue.shift();
      if (!reciter) break;
      const res = await probeSingleReciterHealth(reciter, timeoutMs, fetchImpl);
      results.push(res);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, recitersList.length) }, worker)
  );
  return {
    checkedAt: new Date().toISOString(),
    total: results.length,
    healthy: results.filter((r) => r.ok).length,
    broken: results.filter((r) => !r.ok).length,
    results,
  };
}

/** Renders a compact human-readable table of a report (used by CLI + CI). */
export function renderHealthReport(report: ReciterHealthReport): string {
  const lines = [
    `فحص صحة القرّاء — ${report.checkedAt}`,
    `الإجمالي: ${report.total} · سليم: ${report.healthy} · معطّل: ${report.broken}`,
  ];
  for (const r of report.results) {
    const mark = r.ok ? '✓' : '✗';
    const status = r.status ?? 'ERR';
    const ms = `${r.ms}ms`;
    lines.push(`${mark} ${r.slug} (${r.source}) — HTTP ${status} — ${ms}${r.error ? ` — ${r.error}` : ''}`);
  }
  return lines.join('\n');
}
