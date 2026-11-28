/**
 * Pure state helpers for Studio top-to-bottom collapsible accordion curtains.
 * Keeps curtain expand/collapse/expand-all/collapse-all logic decoupled and unit-testable.
 */

export const RECITATION_CURTAIN_IDS = [
  'rec-surah',
  'rec-custom-audio',
  'rec-reciters',
] as const;

export type RecitationCurtainId = (typeof RECITATION_CURTAIN_IDS)[number];

export const DEFAULT_OPEN_RECITATION_CURTAINS: readonly RecitationCurtainId[] = [
  'rec-surah',
  'rec-reciters',
];

export const DEFAULT_OPEN_INSPECTOR_CURTAINS: readonly string[] = [
  'tpl-gallery',
  'orn-harmony',
  'orn-frame',
  'bg-source',
  'txt-typography',
  'txt-layout',
  'aud-dsp',
  'aud-transitions',
  'prd-timeline',
];

export function isCurtainOpen(openIds: readonly string[], id: string): boolean {
  return openIds.includes(id);
}

export function toggleCurtainId(
  openIds: readonly string[],
  id: string
): string[] {
  if (openIds.includes(id)) {
    return openIds.filter((item) => item !== id);
  }
  return [...openIds, id];
}

export function expandAllCurtains(
  openIds: readonly string[],
  visibleIds: readonly string[]
): string[] {
  const seen = new Set(openIds);
  const next = [...openIds];
  for (const id of visibleIds) {
    if (!seen.has(id)) {
      seen.add(id);
      next.push(id);
    }
  }
  return next;
}

export function collapseAllCurtains(
  openIds: readonly string[],
  visibleIds: readonly string[]
): string[] {
  const toClose = new Set(visibleIds);
  return openIds.filter((id) => !toClose.has(id));
}

export function areAllCurtainsExpanded(
  openIds: readonly string[],
  visibleIds: readonly string[]
): boolean {
  if (visibleIds.length === 0) return false;
  const openSet = new Set(openIds);
  return visibleIds.every((id) => openSet.has(id));
}

export function areAllCurtainsCollapsed(
  openIds: readonly string[],
  visibleIds: readonly string[]
): boolean {
  if (visibleIds.length === 0) return true;
  const openSet = new Set(openIds);
  return visibleIds.every((id) => !openSet.has(id));
}
