/**
 * Synchronized SRT subtitle generation (roadmap item 5).
 *
 * The video export pipeline already computes per-slide durations twice — the
 * audio-concat timeline — and SRT needs exactly the same numbers. This module
 * derives an SRT track from that timeline so subtitles never drift from the
 * rendered video: slide i starts when the audio for verse i starts, and runs
 * until the next verse begins (including the inter-verse gap).
 *
 * Verse text is resolved by the caller (client or QUL fetch); here we only
 * format timestamps and escape SRT markup.
 */

export const SRT_MAX_VERSE_TEXT_CHARS = 220; // long ayahs stay on one cue; players wrap lines

/** Formats seconds as an SRT timestamp `HH:MM:SS,mmm`. */
export function formatSrtTimestamp(totalSec: number): string {
  const safe = Math.max(0, Number.isFinite(totalSec) ? totalSec : 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/** Escapes SRT-significant characters and clamps cue length. */
export function sanitizeSrtText(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ') // cues are single blocks; newlines break block layout
    .replace(/--> /g, '— ') // a literal "-->" inside text corrupts the cue header
    .replace(/<[^>]*>/g, '') // strip HTML-ish tags (QUL translations may carry them)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SRT_MAX_VERSE_TEXT_CHARS);
}

export type SrtCueInput = {
  /** Display text of the verse (Uthmani or translation). */
  text: string;
  /** How long this verse's slide/audio lasts, seconds. */
  durationSec: number;
  /** Optional override for the cue start (defaults to cumulative start). */
  startSec?: number;
};

export type SrtCue = {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
};

/**
 * Builds the cue list from per-slide durations — the exact array the export
 * pipeline feeds the concat demuxer, guaranteeing subtitle/video sync.
 * Durations are floored at 0.25s to match the manifest's own safety floor.
 */
export function buildSrtCues(entries: SrtCueInput[]): SrtCue[] {
  const cues: SrtCue[] = [];
  let cursor = 0;
  entries.forEach((entry, i) => {
    const dur = Math.max(0.25, Number(entry.durationSec) || 1);
    const start = entry.startSec !== undefined ? Math.max(0, entry.startSec) : cursor;
    const end = Math.max(start + dur, start + 0.25);
    const text = sanitizeSrtText(entry.text);
    if (text) {
      cues.push({ index: i + 1, startSec: start, endSec: end, text });
    }
    cursor = entry.startSec !== undefined ? Math.max(cursor, end) : cursor + dur;
  });
  return cues;
}

/** Renders cues as a valid SRT file body (UTF-8, CRLF blocks per spec). */
export function renderSrtFile(cues: SrtCue[]): string {
  if (!cues.length) return '';
  const blocks = cues.map((cue, i) => {
    // The SRT spec expects strictly sequential cue numbers, so the file
    // renumbers (an in-memory cue may keep its original entry index).
    const from = formatSrtTimestamp(cue.startSec);
    const to = formatSrtTimestamp(cue.endSec);
    return `${i + 1}\r\n${from} --> ${to}\r\n${cue.text}\r\n`;
  });
  return blocks.join('\r\n');
}

/**
 * Full pipeline: durations + texts → SRT body. Durations and texts must be
 * index-aligned (one per slide/verse).
 */
export function buildSrtFromTimeline(
  durationsSec: number[],
  texts: string[],
  opts: { offsetSec?: number } = {}
): string {
  const n = Math.min(durationsSec.length, texts.length);
  const entries: SrtCueInput[] = [];
  for (let i = 0; i < n; i++) {
    entries.push({
      text: texts[i],
      durationSec: durationsSec[i],
      startSec: opts.offsetSec ? opts.offsetSec + i * 0 : undefined,
    });
  }
  // offsetSec shifts the whole timeline (rarely needed; kept for symmetry)
  const cues = buildSrtCues(entries);
  const body = renderSrtFile(cues);
  return opts.offsetSec && body ? applySrtOffset(body, opts.offsetSec) : body;
}

/** Parses the timestamps of a rendered SRT body and shifts them (test helper). */
export function applySrtOffset(srtBody: string, offsetSec: number): string {
  return srtBody.replace(
    /(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/g,
    (_m, h1, m1, s1, ms1, h2, m2, s2, ms2) => {
      const from = Number(h1) * 3600 + Number(m1) * 60 + Number(s1) + Number(ms1) / 1000 + offsetSec;
      const to = Number(h2) * 3600 + Number(m2) * 60 + Number(s2) + Number(ms2) / 1000 + offsetSec;
      return `${formatSrtTimestamp(from)} --> ${formatSrtTimestamp(to)}`;
    }
  );
}
