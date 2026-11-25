/**
 * Teacher mode (وضع المصحف المعلم) — roadmap item 6.
 *
 * Classic halaqa drill: the reciter chants each ayah N times, then the student
 * repeats it before the next ayah plays. Two orthogonal knobs:
 *
 *  - repeatCount: how many times the ayah is chanted (1–10)
 *  - pauseAfterEachVerse: after the chants finish, playback WAITS (no auto
 *    advance) until the student taps "next" — the pause is the student's turn
 *
 * This module holds the pure sequencing logic; the AppProvider wires it into
 * the audio element's `ended` event.
 */

export const TEACHER_MODE_MIN_REPEATS = 1;
export const TEACHER_MODE_MAX_REPEATS = 10;

export interface TeacherModeState {
  enabled: boolean;
  repeatCount: number;
  /** seconds the verse stays silent between teacher repetitions (0–5) */
  interRepeatGapSec: number;
  /** stop after the ayah's repetitions and wait for the student */
  pauseAfterEachVerse: boolean;
}

export const TEACHER_MODE_DEFAULTS: TeacherModeState = {
  enabled: false,
  repeatCount: 2,
  interRepeatGapSec: 1.0,
  pauseAfterEachVerse: true,
};

/** Clamps arbitrary input into a valid TeacherModeState. */
export function sanitizeTeacherMode(raw: Partial<TeacherModeState> | null | undefined): TeacherModeState {
  const n = Math.max(
    TEACHER_MODE_MIN_REPEATS,
    Math.min(TEACHER_MODE_MAX_REPEATS, Math.floor(Number(raw?.repeatCount) || TEACHER_MODE_DEFAULTS.repeatCount))
  );
  return {
    enabled: Boolean(raw?.enabled),
    repeatCount: n,
    interRepeatGapSec: Math.max(0, Math.min(5, Number(raw?.interRepeatGapSec ?? 1))),
    pauseAfterEachVerse: raw?.pauseAfterEachVerse !== false,
  };
}

/**
 * Decides what the player should do when a verse audio chunk finishes.
 *
 * Pure function over (how many times this verse already played, settings,
 * whether another verse exists) so it is trivially unit-testable.
 */
export type TeacherStep =
  | { action: 'replay-same-verse'; nextRepeat: number }
  | { action: 'wait-for-student' }
  | { action: 'advance-to-next-verse' }
  | { action: 'stop' };

export function resolveTeacherStep(
  verseRepeatIndex: number,
  mode: TeacherModeState,
  hasNextVerse: boolean
): TeacherStep {
  if (!mode.enabled) {
    // Without teacher mode the original behaviour: chain to the next verse.
    return hasNextVerse
      ? { action: 'advance-to-next-verse' }
      : { action: 'stop' };
  }
  // More teacher repetitions pending for THIS verse?
  if (verseRepeatIndex + 1 < mode.repeatCount) {
    return { action: 'replay-same-verse', nextRepeat: verseRepeatIndex + 1 };
  }
  // Repetitions done. In pause mode the student repeats now — player waits.
  if (mode.pauseAfterEachVerse) {
    return { action: 'wait-for-student' };
  }
  // No pause mode: continue like normal playback.
  return hasNextVerse ? { action: 'advance-to-next-verse' } : { action: 'stop' };
}

/** Human label for the current repetition state (drives the UI badge). */
export function describeTeacherProgress(
  verseRepeatIndex: number,
  mode: TeacherModeState
): string {
  if (!mode.enabled) return '';
  const current = Math.min(verseRepeatIndex + 1, mode.repeatCount);
  return `التكرار ${current} من ${mode.repeatCount}`;
}

/** Student signals readiness: after a wait, tapping next resumes drilling. */
export function studentAdvanceAction(mode: TeacherModeState, hasNextVerse: boolean): TeacherStep {
  return hasNextVerse
    ? { action: 'advance-to-next-verse' }
    : { action: 'stop' };
}
