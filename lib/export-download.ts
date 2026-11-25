/**
 * Pure HTTP download helpers for /api/studio/export/download:
 * byte-range parsing (RFC 9110), Content-Disposition mode, and SRT filename derivation.
 */

export type ByteRangeParseResult =
  | { ok: true; start: number; end: number; isPartial: boolean }
  | { ok: false; unsatisfiable: true };

/**
 * Parses an HTTP `Range` request header against a known file size.
 * Supports:
 * - missing/empty header -> full range [0, fileSize - 1]
 * - `bytes=start-end`
 * - `bytes=start-`
 * - `bytes=-suffixLength`
 */
export function parseByteRangeHeader(
  rangeHeader: string | null | undefined,
  fileSize: number
): ByteRangeParseResult {
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { ok: false, unsatisfiable: true };
  }
  const maxIndex = Math.floor(fileSize) - 1;
  if (!rangeHeader || !rangeHeader.trim()) {
    return { ok: true, start: 0, end: maxIndex, isPartial: false };
  }

  const trimmed = rangeHeader.trim();
  const match = /^bytes=(\d*)-(\d*)$/i.exec(trimmed);
  if (!match) {
    return { ok: false, unsatisfiable: true };
  }

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) {
    return { ok: false, unsatisfiable: true };
  }

  // Suffix byte range: `bytes=-N` (last N bytes)
  if (!rawStart && rawEnd) {
    const suffixLen = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffixLen) || suffixLen <= 0) {
      return { ok: false, unsatisfiable: true };
    }
    const start = Math.max(0, fileSize - suffixLen);
    return { ok: true, start, end: maxIndex, isPartial: true };
  }

  const start = Number.parseInt(rawStart, 10);
  if (!Number.isFinite(start) || start < 0 || start > maxIndex) {
    return { ok: false, unsatisfiable: true };
  }

  const parsedEnd = rawEnd ? Number.parseInt(rawEnd, 10) : maxIndex;
  if (!Number.isFinite(parsedEnd) || parsedEnd < start) {
    return { ok: false, unsatisfiable: true };
  }

  const end = Math.min(maxIndex, parsedEnd);
  return { ok: true, start, end, isPartial: true };
}

/**
 * Derives a safe ASCII `.srt` filename from the exported video filename.
 */
export function buildSrtDownloadFilename(videoFilename?: string | null): string {
  const cleaned = (videoFilename || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!cleaned) return 'subtitles.srt';
  const stripped = cleaned.replace(/\.(mp4|webm|srt)$/i, '');
  return `${stripped || 'subtitles'}.srt`;
}

/**
 * Resolves Content-Disposition type based on `?download=1`.
 */
export function resolveExportDownloadDisposition(
  downloadParam: string | null | undefined
): 'attachment' | 'inline' {
  return downloadParam === '1' || downloadParam === 'true' ? 'attachment' : 'inline';
}
