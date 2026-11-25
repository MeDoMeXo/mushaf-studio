/**
 * Pure immutable Undo/Redo history engine for Mushaf Studio.
 * Keeps a bounded stack of past/future snapshots and deduplicates identical consecutive states.
 */

export interface StudioHistory<T> {
  past: T[];
  present: T;
  future: T[];
  maxLength: number;
}

export function createStudioHistory<T>(
  initial: T,
  maxLength = 40
): StudioHistory<T> {
  return {
    past: [],
    present: initial,
    future: [],
    maxLength: Math.max(1, maxLength),
  };
}

export function pushStudioHistory<T>(
  history: StudioHistory<T>,
  nextPresent: T,
  isEqual?: (a: T, b: T) => boolean
): StudioHistory<T> {
  const same = isEqual
    ? isEqual(history.present, nextPresent)
    : Object.is(history.present, nextPresent);
  if (same) return history;

  const nextPast = [...history.past, history.present];
  const trimmedPast =
    nextPast.length > history.maxLength
      ? nextPast.slice(nextPast.length - history.maxLength)
      : nextPast;

  return {
    ...history,
    past: trimmedPast,
    present: nextPresent,
    future: [],
  };
}

export function replaceStudioPresent<T>(
  history: StudioHistory<T>,
  nextPresent: T
): StudioHistory<T> {
  return {
    ...history,
    present: nextPresent,
  };
}

export function undoStudioHistory<T>(history: StudioHistory<T>): StudioHistory<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  const nextPast = history.past.slice(0, -1);
  return {
    ...history,
    past: nextPast,
    present: previous,
    future: [history.present, ...history.future].slice(0, history.maxLength),
  };
}

export function redoStudioHistory<T>(history: StudioHistory<T>): StudioHistory<T> {
  if (history.future.length === 0) return history;
  const [next, ...remainingFuture] = history.future;
  const nextPast = [...history.past, history.present];
  const trimmedPast =
    nextPast.length > history.maxLength
      ? nextPast.slice(nextPast.length - history.maxLength)
      : nextPast;

  return {
    ...history,
    past: trimmedPast,
    present: next,
    future: remainingFuture,
  };
}

export function canUndoHistory<T>(history: StudioHistory<T>): boolean {
  return history.past.length > 0;
}

export function canRedoHistory<T>(history: StudioHistory<T>): boolean {
  return history.future.length > 0;
}

export function shallowEqualStudioObject<T extends object>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  const keysA = Object.keys(a) as (keyof T)[];
  const keysB = Object.keys(b) as (keyof T)[];
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}
