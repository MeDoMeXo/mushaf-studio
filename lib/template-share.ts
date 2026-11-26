/**
 * Shareable custom templates (roadmap item 7).
 *
 * SavedCustomTemplate lives in localStorage on one device only. This module
 * adds export/import as a small JSON code: users share designs between
 * devices and friends without any server-side account.
 *
 * The format is versioned (`mushaf-studio-template` v1). Import validates the
 * payload strictly — patch keys must be known StudioState fields with
 * type-matched values — so a malformed or hostile file can never corrupt the
 * local template list.
 */
import type { SavedCustomTemplate, StudioState } from './quran-data';
import { toArabicDigits } from './quran-utils';

export const TEMPLATE_SHARE_FORMAT = 'mushaf-studio-template';
export const TEMPLATE_SHARE_VERSION = 1;
export const TEMPLATE_SHARE_MAX_TEMPLATES = 50; // import refuses absurd bulk payloads
export const MAX_SAVED_TEMPLATE_BG_IMAGE_CHARS = 450_000;

/** Whitelisted StudioState patch fields a template may carry. */
export const TEMPLATE_PATCH_FIELDS = [
  'textSource',
  'translationId',
  'bgType',
  'bgIdx',
  'bgColor',
  'bgImage',
  'bgLibraryId',
  'bgBlur',
  'bgVideoSpeed',
  'colorLut',
  'ambient',
  'overlay',
  'vignette',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'metaFontWeight',
  'lineHeight',
  'verticalOffset',
  'translationFontFamily',
  'letterSpacing',
  'playbackGapSec',
  'wordSyncOffsetMs',
  'textColor',
  'align',
  'shadow',
  'glow',
  'goldFrame',
  'corners',
  'frameStyle',
  'cornerStyle',
  'patternStyle',
  'patternOpacity',
  'surahBannerStyle',
  'ornamentColor',
  'showAyahNumber',
  'ayahNumberStyle',
  'showFooter',
  'showReciterFooter',
  'surahPosition',
  'surahOffsetY',
  'reciterPosition',
  'reciterOffsetY',
  'showProgressDots',
  'watermark',
  'coverMode',
  'aspect',
  'width',
  'height',
] as const;

export type TemplatePatchKey = (typeof TEMPLATE_PATCH_FIELDS)[number];

/** Type guards for each whitelisted field's expected value type. */
function isNumber(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

function isBoolOrNum(v: unknown): boolean {
  return typeof v === 'boolean' || isNumber(v);
}

function isSafeBgImage(v: unknown): boolean {
  if (v === null) return true;
  if (typeof v !== 'string' || v.length > MAX_SAVED_TEMPLATE_BG_IMAGE_CHARS) return false;
  return (
    /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(v) ||
    /^\/assets\/[A-Za-z0-9_./-]+$/.test(v)
  );
}

const PATCH_FIELD_TYPE_GUARDS: Record<TemplatePatchKey, (v: unknown) => boolean> = {
  textSource: (v) => v === 'uthmani' || v === 'translation' || v === 'both',
  translationId: isNumber,
  bgType: (v) => typeof v === 'string',
  bgIdx: isNumber,
  bgColor: (v) => typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v),
  bgImage: isSafeBgImage,
  bgLibraryId: (v) => v === null || typeof v === 'string',
  bgBlur: isNumber,
  bgVideoSpeed: isNumber,
  colorLut: (v) => typeof v === 'string',
  ambient: (v) => typeof v === 'string',
  overlay: isNumber,
  vignette: isNumber,
  fontFamily: (v) => typeof v === 'string',
  fontSize: isNumber,
  fontWeight: isNumber,
  metaFontWeight: isNumber,
  lineHeight: isNumber,
  verticalOffset: isNumber,
  translationFontFamily: (v) => typeof v === 'string' && v.length > 0 && v.length <= 60,
  letterSpacing: isNumber,
  playbackGapSec: isNumber,
  wordSyncOffsetMs: isNumber,
  textColor: (v) => typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v),
  align: (v) => typeof v === 'string',
  shadow: isBoolOrNum,
  glow: isBoolOrNum,
  goldFrame: isBoolOrNum,
  corners: isBoolOrNum,
  frameStyle: (v) => typeof v === 'string',
  cornerStyle: (v) => typeof v === 'string',
  patternStyle: (v) => typeof v === 'string',
  patternOpacity: isNumber,
  surahBannerStyle: (v) => typeof v === 'string',
  ornamentColor: (v) => typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v),
  showAyahNumber: (v) => typeof v === 'boolean',
  ayahNumberStyle: (v) => typeof v === 'string',
  showFooter: (v) => typeof v === 'boolean',
  showReciterFooter: (v) => typeof v === 'boolean',
  surahPosition: (v) => typeof v === 'string',
  surahOffsetY: isNumber,
  reciterPosition: (v) => typeof v === 'string',
  reciterOffsetY: isNumber,
  showProgressDots: (v) => typeof v === 'boolean',
  watermark: (v) => typeof v === 'string' && v.length <= 80,
  coverMode: (v) => typeof v === 'boolean',
  aspect: (v) => typeof v === 'string',
  width: isNumber,
  height: isNumber,
};

/** Filters an unknown patch object down to valid whitelisted fields only. */
export function sanitizeTemplatePatch(patch: unknown): Partial<StudioState> {
  const clean: Record<string, unknown> = {};
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return clean;
  for (const key of TEMPLATE_PATCH_FIELDS) {
    const value = (patch as Record<string, unknown>)[key];
    if (value !== undefined && PATCH_FIELD_TYPE_GUARDS[key](value)) {
      clean[key] = value;
    }
  }
  return clean as Partial<StudioState>;
}

/**
 * Builds a complete SavedCustomTemplate from the current StudioState.
 * Generates a readable Arabic default name when customName is omitted and
 * guards against oversized custom background images exceeding storage quota.
 */
export function buildSavedDesignTemplate(input: {
  state: StudioState;
  surahName?: string | null;
  customName?: string | null;
  now?: number;
}): SavedCustomTemplate {
  const { state, surahName, customName } = input;
  const now = input.now ?? Date.now();
  const f = Math.max(1, Math.floor(state.fromAyah || 1));
  const t = Math.max(f, Math.floor(state.toAyah || f));
  const rangeAr =
    f === t ? toArabicDigits(f) : `${toArabicDigits(f)}–${toArabicDigits(t)}`;
  const cleanSurah = (surahName || 'القرآن').trim();
  const trimmedCustom = (customName || '').trim();
  const autoName = `تصميم ${cleanSurah} (${rangeAr})`;
  const name = (trimmedCustom || autoName).slice(0, 60);

  const safeBgImage =
    state.bgType === 'image' && isSafeBgImage(state.bgImage)
      ? state.bgImage
      : null;

  return {
    id: `tpl_${now}`,
    name,
    createdAt: now,
    patch: {
      textSource: state.textSource,
      translationId: state.translationId,
      bgType: state.bgType === 'image' && !safeBgImage ? 'gradient' : state.bgType,
      bgIdx: state.bgIdx,
      bgColor: state.bgColor,
      bgImage: safeBgImage,
      bgLibraryId: state.bgLibraryId ?? null,
      bgBlur: state.bgBlur,
      bgVideoSpeed: state.bgVideoSpeed,
      colorLut: state.colorLut,
      ambient: state.ambient,
      overlay: state.overlay,
      vignette: state.vignette,
      fontFamily: state.fontFamily,
      fontSize: state.fontSize,
      fontWeight: state.fontWeight,
      metaFontWeight: state.metaFontWeight,
      lineHeight: state.lineHeight,
      verticalOffset: state.verticalOffset,
      translationFontFamily: state.translationFontFamily || 'Cairo',
      letterSpacing: Number(state.letterSpacing ?? 0),
      playbackGapSec: Number(state.playbackGapSec ?? 0),
      wordSyncOffsetMs: Number(state.wordSyncOffsetMs ?? 0),
      textColor: state.textColor,
      align: state.align,
      shadow: state.shadow,
      glow: state.glow,
      goldFrame: state.goldFrame,
      corners: state.corners,
      frameStyle: state.frameStyle,
      cornerStyle: state.cornerStyle,
      patternStyle: state.patternStyle,
      patternOpacity: state.patternOpacity,
      surahBannerStyle: state.surahBannerStyle,
      ornamentColor: state.ornamentColor,
      showAyahNumber: state.showAyahNumber,
      ayahNumberStyle: state.ayahNumberStyle,
      showFooter: state.showFooter,
      showReciterFooter: state.showReciterFooter,
      surahPosition: state.surahPosition,
      surahOffsetY: state.surahOffsetY,
      reciterPosition: state.reciterPosition,
      reciterOffsetY: state.reciterOffsetY,
      showProgressDots: state.showProgressDots,
      watermark: state.watermark,
      coverMode: Boolean(state.coverMode),
      aspect: state.aspect,
      width: state.width,
      height: state.height,
    },
  };
}

/** Validates one deserialized template row. */
export function isValidSharedTemplate(t: unknown): t is SavedCustomTemplate {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return false;
  const o = t as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0 || o.id.length > 64) return false;
  if (typeof o.name !== 'string' || o.name.trim().length === 0 || o.name.length > 60) return false;
  if (!isNumber(o.createdAt)) return false;
  if (!o.patch || typeof o.patch !== 'object' || Array.isArray(o.patch)) return false;
  // At least one whitelisted field must survive sanitization to be useful
  return Object.keys(sanitizeTemplatePatch(o.patch)).length > 0;
}

export type SharedTemplateFile = {
  format: typeof TEMPLATE_SHARE_FORMAT;
  version: number;
  exportedAt: string;
  templates: SavedCustomTemplate[];
};

/** Serializes templates into a shareable JSON string (deterministic fields). */
export function exportTemplatesToJson(templates: SavedCustomTemplate[]): string {
  const file: SharedTemplateFile = {
    format: TEMPLATE_SHARE_FORMAT,
    version: TEMPLATE_SHARE_VERSION,
    exportedAt: new Date().toISOString(),
    templates: templates
      .slice(0, TEMPLATE_SHARE_MAX_TEMPLATES)
      .map((t) => ({ id: t.id, name: t.name, createdAt: t.createdAt, patch: t.patch })),
  };
  return JSON.stringify(file, null, 2);
}

export type TemplateImportResult = {
  ok: boolean;
  templates: SavedCustomTemplate[];
  error?: string;
};

/**
 * Parses a shared-template JSON payload. Every row is sanitized (unknown keys
 * dropped, patch fields type-checked); ids are re-seeded on collision so
 * importing the same file twice never overwrites existing local templates.
 */
export function importTemplatesFromJson(
  json: string,
  existingIds: Set<string> = new Set()
): TemplateImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, templates: [], error: 'الملف ليس JSON صالحاً' };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, templates: [], error: 'بنية الملف غير صالحة' };
  }
  const o = raw as Record<string, unknown>;
  if (o.format !== TEMPLATE_SHARE_FORMAT) {
    return { ok: false, templates: [], error: 'هذا الملف ليس ملف قوالب مصحف الاستوديو' };
  }
  if (typeof o.version !== 'number' || o.version > TEMPLATE_SHARE_VERSION) {
    return { ok: false, templates: [], error: 'إصدار الملف أحدث من المدعوم — حدّث التطبيق' };
  }
  if (!Array.isArray(o.templates) || o.templates.length === 0) {
    return { ok: false, templates: [], error: 'لا يحتوي الملف على أي قوالب' };
  }
  if (o.templates.length > TEMPLATE_SHARE_MAX_TEMPLATES) {
    return { ok: false, templates: [], error: `الملف يتجاوز الحد (${TEMPLATE_SHARE_MAX_TEMPLATES} قالباً)` };
  }

  const imported: SavedCustomTemplate[] = [];
  const usedIds = new Set(existingIds);
  for (const row of o.templates) {
    if (!isValidSharedTemplate(row)) continue;
    let id = row.id;
    while (usedIds.has(id)) {
      id = `${row.id}_${Math.random().toString(36).slice(2, 8)}`;
    }
    usedIds.add(id);
    imported.push({
      id,
      name: row.name.trim(),
      createdAt: row.createdAt,
      patch: sanitizeTemplatePatch(row.patch),
    });
  }
  if (imported.length === 0) {
    return { ok: false, templates: [], error: 'لم يحتوِ الملف على أي قالب صالح' };
  }
  return { ok: true, templates: imported };
}
