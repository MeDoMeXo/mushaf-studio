/**
 * Unified Channel Intro Cover Helpers (غلاف البداية الموحّد للقناة).
 *
 * Pure deterministic helpers decoupled from Canvas & React UI so all intro cover
 * rules (2.5s silent lead card, Surah-aware Basmala inclusion, SRT alignment,
 * and duration estimation) can be verified cleanly via node:test.
 */

export const INTRO_COVER_DURATION_SEC = 2.5;
export const UNIFIED_COVER_TEMPLATE_ID = 'unified-channel-cover';
export const COVER_BASMALA_TEXT = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

/**
 * Resolves the formatted Basmala line placed beneath the Reciter name on the
 * unified intro cover. Surah At-Tawbah (9) famously omits Basmala.
 */
export function resolveCoverBasmala(surahId: number): string | null {
  if (Math.floor(surahId) === 9) {
    return null;
  }
  return `﴿ ${COVER_BASMALA_TEXT} ﴾`;
}

/**
 * Computes total slides for export: verse slides plus leading cover slide when enabled.
 */
export function resolveIntroCoverSlideCount(
  verseCount: number,
  includeIntroCover: boolean
): number {
  const safeVerses = Math.max(0, Math.floor(verseCount));
  if (safeVerses === 0) return 0;
  return includeIntroCover ? safeVerses + 1 : safeVerses;
}

/**
 * Aligns subtitle texts with the rendered slide timeline so slide_0 (cover)
 * stays silent/caption-free while still advancing the SRT cursor by 2.5s.
 */
export function buildIntroAlignedVerseTexts(
  verseTexts: string[],
  includeIntroCover: boolean
): string[] {
  return includeIntroCover ? ['', ...verseTexts] : [...verseTexts];
}

/**
 * Estimates total exported video duration in seconds, adding 2.5s when the
 * silent unified cover card is injected before Ayah 1.
 */
export function estimateVideoExportDurationSec(params: {
  verseCount: number;
  verseGapSec: number;
  includeIntroCover: boolean;
}): number {
  const safeVerses = Math.max(1, Math.floor(params.verseCount));
  const introSec = params.includeIntroCover ? INTRO_COVER_DURATION_SEC : 0;
  return Math.max(4, introSec + safeVerses * (5.5 + Math.max(0, params.verseGapSec)));
}
