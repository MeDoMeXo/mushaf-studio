/**
 * YouTube thumbnail (صورة المصغرة) generator — client-side canvas render.
 *
 * Renders the unified channel cover card (Surah title + reciter + Basmala)
 * at the exported video's exact dimensions and downloads it as a PNG (or a
 * high-quality JPEG when the PNG would exceed YouTube's 2MB thumbnail cap),
 * so the channel always gets a matching, readable cover image per upload.
 */
import type { StudioState } from './quran-data';
import { drawStudioFrame } from './studio-renderer';
import { buildArabicCoverFilename } from './video-share';

/** YouTube custom thumbnails must stay under 2MB. */
export const YOUTUBE_THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;
const SAFE_PNG_BYTES = 1.9 * 1024 * 1024;

export interface ExportThumbnailInput {
  studioState: StudioState;
  targetDims: { width: number; height: number };
  surahName: string;
  reciterName: string;
  getBgImageEl: () => HTMLImageElement | null;
}

export interface ExportThumbnailResult {
  blob: Blob;
  filename: string;
}

/**
 * Renders the cover/thumbnail image at the export target dimensions. Returns
 * null when canvas is unavailable (SSR) or the render fails.
 */
export async function renderExportThumbnail(
  input: ExportThumbnailInput
): Promise<ExportThumbnailResult | null> {
  if (typeof document === 'undefined') return null;
  const { studioState, targetDims, surahName, reciterName } = input;

  try {
    await document.fonts.load(
      `${studioState.fontWeight || 400} ${Math.max(24, studioState.fontSize)}px "${studioState.fontFamily}"`
    );
    await document.fonts.load(`700 ${Math.max(18, studioState.fontSize * 0.5)}px "Cairo"`);
  } catch {
    // fall back to whatever is loaded
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetDims.width;
  canvas.height = targetDims.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  drawStudioFrame(ctx, {
    state: {
      ...studioState,
      coverMode: true,
      width: targetDims.width,
      height: targetDims.height,
    },
    verseText: '',
    translationText: '',
    surahName,
    ayahLabel: '',
    reciterName,
    bgImageEl: input.getBgImageEl(),
  });

  let format: 'png' | 'jpeg' = 'png';
  let blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return null;
  if (blob.size > SAFE_PNG_BYTES) {
    const jpg = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', 0.94)
    );
    if (jpg && jpg.size < blob.size) {
      blob = jpg;
      format = 'jpeg';
    }
  }

  return {
    blob,
    filename: buildArabicCoverFilename({
      surahName,
      reciterName,
      format,
      isIntroCover: true,
    }),
  };
}

/** Triggers the browser download for a rendered thumbnail blob. */
export function downloadExportThumbnail(result: ExportThumbnailResult): boolean {
  if (typeof document === 'undefined') return false;
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
