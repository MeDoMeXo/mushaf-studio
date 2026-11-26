/**
 * Initial StudioState builder — extracted from StudioView per the 600-line
 * file rule. Pure: merges site config + URL params into sane studio defaults.
 */
import {
  DEFAULT_TRANSLATION_ID,
  RECITERS,
  type SiteConfig,
  type StudioState,
} from '@/lib/quran-data';

export function buildInitialStudioState(
  cfg: SiteConfig,
  surahParam: number,
  fromParam: number,
  toParam: number,
  reciterParam: string | null,
  translationParam?: number | null
): StudioState {
  return {
    surah: surahParam >= 1 && surahParam <= 114 ? surahParam : 1,
    fromAyah: fromParam >= 1 ? fromParam : 1,
    toAyah: toParam >= fromParam && toParam >= 1 ? toParam : fromParam >= 1 ? fromParam : 3,
    textSource: 'uthmani',
    translationId:
      translationParam && Number.isInteger(translationParam) && translationParam > 0
        ? translationParam
        : cfg.defaultTranslation || DEFAULT_TRANSLATION_ID,
    reciter: reciterParam || cfg.defaultReciter || RECITERS[0].slug,
    bgType: 'gradient',
    bgIdx: 0,
    bgColor: '#0B3D2E',
    bgImage: null,
    bgBlur: 0,
    bgVideoSpeed: 1,
    bgLibraryId: null,
    colorLut: 'none',
    ambient: 'gold-dust',
    overlay: 0.14,
    vignette: 0.28,
    fontFamily: cfg.studio.fontFamily || 'Amiri Quran',
    fontSize: cfg.studio.fontSize || 86,
    fontWeight: 400,
    metaFontWeight: 600,
    lineHeight: 1.75,
    verticalOffset: 0,
    textColor: cfg.studio.color || '#FAF7F0',
    align: 'center',
    shadow: true,
    glow: false,
    verseLineMode: 'wrap',
    hideVerses: false,
    wordHighlight: false,
    wordHighlightStyle: 'block',
    wordHighlightColor: '#C9A227',
    wordHighlightOpacity: 0.35,
    goldFrame: true,
    corners: true,
    frameStyle: 'mushaf',
    cornerStyle: 'rub_el_hizb',
    patternStyle: 'khatam8',
    patternOpacity: 0.13,
    surahBannerStyle: 'cartouche',
    ornamentColor: '#D4AF37',
    activeTemplateId: 'madinah-mushaf',
    showAyahNumber: true,
    ayahNumberStyle: 'rosette',
    showFooter: cfg.studio.footer !== false,
    showReciterFooter: true,
    surahPosition: 'top',
    surahOffsetY: 0,
    reciterPosition: 'bottom',
    reciterOffsetY: 0,
    showProgressDots: false,
    watermark: cfg.studio.watermark || cfg.siteName,
    coverMode: false,
    aspect: '9:16',
    width: 1080,
    height: 1920,
  };
}
