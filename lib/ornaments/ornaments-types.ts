/**
 * Authentic Islamic Geometric Patterns, Illuminated Mushaf Frames,
 * Corner Rosettes, Surah Cartouche Banners, and Ayah Medallions.
 *
 * Pure mathematical geometry generators (Hankin star polygons, Rub el Hizb,
 * Mamluk 12-fold Girih rosettes, pointed Mihrab arches, lobed Mushaf cartouches)
 * decoupled from Canvas 2D rendering so both unit tests and HTML5 Canvas /
 * server-side video export share one authoritative source of truth.
 */

export type IslamicPatternStyle =
  | 'none'
  | 'khatam8'
  | 'girih12'
  | 'arabesque'
  | 'hexgrid';

export type IslamicFrameStyle =
  | 'none'
  | 'classic'
  | 'mihrab'
  | 'mushaf'
  | 'andalus'
  | 'ottoman';

export type IslamicCornerStyle =
  | 'none'
  | 'rub_el_hizb'
  | 'shamsa'
  | 'floral_corner'
  | 'crescent_star';

export type SurahBannerStyle =
  | 'classic'
  | 'cartouche'
  | 'mihrab_crest'
  | 'minimal';

export type IslamicAyahMedallionStyle =
  | 'rosette'
  | 'rub_el_hizb'
  | 'shamsa'
  | 'ornate'
  | 'minimal';

export interface Point2D {
  x: number;
  y: number;
}

export interface OrnamentOptionMeta<T extends string> {
  id: T;
  name: string;
  subtitle: string;
  era?: string;
}

export interface OrnamentColorPreset {
  id: string;
  name: string;
  hex: string;
  secondaryHex: string;
}

export interface ResolvedOrnamentConfig {
  frameStyle: IslamicFrameStyle;
  cornerStyle: IslamicCornerStyle;
  patternStyle: IslamicPatternStyle;
  patternOpacity: number;
  surahBannerStyle: SurahBannerStyle;
  ayahNumberStyle: IslamicAyahMedallionStyle;
  ornamentColor: string;
}

export interface OrnamentInputState {
  goldFrame?: boolean;
  corners?: boolean;
  frameStyle?: IslamicFrameStyle;
  cornerStyle?: IslamicCornerStyle;
  patternStyle?: IslamicPatternStyle;
  patternOpacity?: number;
  surahBannerStyle?: SurahBannerStyle;
  ayahNumberStyle?: IslamicAyahMedallionStyle;
  ornamentColor?: string;
}

