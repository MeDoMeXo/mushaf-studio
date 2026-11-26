/**
 * Client-side custom-reciters registry.
 *
 * Custom reciters live in the site config (admin panel → localStorage), which
 * the AppProvider loads and refreshes. Pure URL-builder helpers deep in
 * lib/quran-utils / lib/audio-cache cannot reach React context, so the
 * provider mirrors the custom list into this tiny module-level registry on
 * every config load/refresh. The registry stays empty on the server (SSR) —
 * server routes resolve customs from explicitly-validated wire specs instead
 * (lib/custom-reciter-spec.ts), so this is a client-only convenience.
 */
import type { ReciterOption } from './quran-data-types';

let registeredCustoms: readonly ReciterOption[] = [];

function sanitize(list: readonly ReciterOption[] | null | undefined): ReciterOption[] {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (r): r is ReciterOption =>
      Boolean(r) && typeof r.slug === 'string' && r.slug.trim().length > 0
  );
}

export function setClientCustomReciters(
  list: readonly ReciterOption[] | null | undefined
): void {
  registeredCustoms = sanitize(list);
}

export function getClientCustomReciters(): readonly ReciterOption[] {
  return registeredCustoms;
}
