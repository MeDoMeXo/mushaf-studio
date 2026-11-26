/**
 * Verse-highlight palette for the Quran reader — the recited verse (تظليل
 * الآية المتلوة) is tinted with a user-controllable color, persisted via
 * lib/storage (STORAGE_KEYS.VERSE_HIGHLIGHT).
 */
export interface VerseHighlightColorOption {
  id: string;
  label: string;
  hex: string;
}

export const VERSE_HIGHLIGHT_COLORS: VerseHighlightColorOption[] = [
  { id: 'gold', label: 'ذهبي', hex: '#D4AF37' },
  { id: 'emerald', label: 'زمردي', hex: '#2FA37C' },
  { id: 'terracotta', label: 'نحاسي', hex: '#C77B4A' },
  { id: 'violet', label: 'بنفسجي', hex: '#8B7BC7' },
  { id: 'rose', label: 'وردي', hex: '#D98CA6' },
  { id: 'teal', label: 'فيروزي', hex: '#4FB3C6' },
  { id: 'slate', label: 'رمادي', hex: '#8A8F98' },
];

export const DEFAULT_VERSE_HIGHLIGHT_COLOR_ID = 'gold';

export function resolveVerseHighlightColor(
  id: string | null | undefined
): VerseHighlightColorOption {
  const found = VERSE_HIGHLIGHT_COLORS.find((c) => c.id === id);
  if (found) return found;
  return (
    VERSE_HIGHLIGHT_COLORS.find((c) => c.id === DEFAULT_VERSE_HIGHLIGHT_COLOR_ID) ??
    VERSE_HIGHLIGHT_COLORS[0]
  );
}

function normalizeHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** hex + alpha → "rgba(r, g, b, a)" CSS string (safe fallback on bad input). */
export function hexToRgbaCss(hex: string, alpha: number): string {
  const rgb = normalizeHex(hex);
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  if (!rgb) return `rgba(212, 175, 55, ${safeAlpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
}
