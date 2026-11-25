export type RovingDirection = 'rtl' | 'ltr';

export interface RovingTabItem {
  id: string;
  disabled?: boolean;
}

/**
 * Pure RTL/LTR roving-focus index calculator for horizontal tablists.
 *
 * In RTL mode:
 * - ArrowLeft moves visually forward (index + 1, wrapping to 0)
 * - ArrowRight moves visually backward (index - 1, wrapping to length - 1)
 *
 * In LTR mode:
 * - ArrowRight moves forward (index + 1)
 * - ArrowLeft moves backward (index - 1)
 *
 * Home/End jump to the first/last enabled tab respectively.
 * Returns null if the key does not correspond to roving tab navigation or no enabled tab exists.
 */
export function resolveRovingTabIndex(
  items: readonly RovingTabItem[],
  currentIndex: number,
  key: string,
  dir: RovingDirection = 'rtl'
): number | null {
  const count = items.length;
  if (count === 0) return null;

  const isEnabled = (idx: number) => !items[idx]?.disabled;
  const hasAnyEnabled = items.some((it) => !it.disabled);
  if (!hasAnyEnabled) return null;

  if (key === 'Home') {
    for (let i = 0; i < count; i++) {
      if (isEnabled(i)) return i;
    }
    return null;
  }

  if (key === 'End') {
    for (let i = count - 1; i >= 0; i--) {
      if (isEnabled(i)) return i;
    }
    return null;
  }

  let delta = 0;
  if (key === 'ArrowLeft') {
    delta = dir === 'rtl' ? 1 : -1;
  } else if (key === 'ArrowRight') {
    delta = dir === 'rtl' ? -1 : 1;
  } else {
    return null;
  }

  const safeStart =
    currentIndex >= 0 && currentIndex < count ? currentIndex : 0;

  for (let step = 1; step <= count; step++) {
    const candidate = (safeStart + delta * step + count * step) % count;
    if (isEnabled(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Generates deterministic, hydration-safe DOM IDs for tab triggers and panels.
 */
export function buildTabDomIds(idPrefix: string, value: string): {
  tabId: string;
  panelId: string;
} {
  const safePrefix = idPrefix.replace(/[^a-zA-Z0-9_-]/g, '-');
  const safeValue = value.replace(/[^a-zA-Z0-9_-]/g, '-');
  return {
    tabId: `${safePrefix}-tab-${safeValue}`,
    panelId: `${safePrefix}-panel-${safeValue}`,
  };
}
