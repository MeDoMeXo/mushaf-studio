/**
 * Shared helpers for the studio canvas renderer (font resolution + color
 * utilities). Split from lib/studio-renderer.ts per the 600-line file rule.
 */
import { STUDIO_FONTS } from './quran-data';

export function resolveCanvasFontFamily(logicalName: string): string {
  const cached = resolvedFontCache.get(logicalName);
  if (cached) return cached;

  const entry = FONT_CSS_VAR_MAP[logicalName];
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && entry) {
    const computed = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(entry.varName)
      .trim();
    if (computed) {
      const stack = `${computed}, ${entry.fallback}`;
      resolvedFontCache.set(logicalName, stack);
      return stack;
    }
  }

  return entry ? entry.fallback : `"${logicalName}", serif`;
}

export function isLightColor(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return true;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 130;
}

export const FONT_CSS_VAR_MAP: Record<string, { varName: string; fallback: string }> = {
  'Amiri Quran': { varName: '--font-amiri-quran', fallback: '"Amiri Quran", "Amiri", serif' },
  'Scheherazade New': { varName: '--font-scheherazade', fallback: '"Scheherazade New", "Amiri", serif' },
  'Noto Naskh Arabic': { varName: '--font-noto-naskh', fallback: '"Noto Naskh Arabic", "Amiri", serif' },
  'Reem Kufi': { varName: '--font-reem-kufi', fallback: '"Reem Kufi", "Cairo", sans-serif' },
  Amiri: { varName: '--font-amiri', fallback: '"Amiri", serif' },
  Cairo: { varName: '--font-cairo', fallback: '"Cairo", system-ui, sans-serif' },
};
const resolvedFontCache = new Map<string, string>();

/**
 * Resolves a logical Arabic font name (e.g. "Amiri Quran") to the actual
 * loaded next/font/google family name exposed via CSS custom properties,
 * ensuring HTML5 Canvas renders self-hosted fonts with zero fallback drift.
 */
