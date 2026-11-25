#!/usr/bin/env python3
"""Fix pass for review findings C1, I1-I7 + minors. Prints per-fix status."""
from pathlib import Path

def patch(rel, old, new, label):
    p = Path(rel)
    t = p.read_text()
    if old not in t:
        print(f"MISS  {label} ({rel})")
        return False
    p.write_text(t.replace(old, new, 1))
    print(f"OK    {label}")
    return True

R = "/home/z/my-project/"

# ---------- C1: ambient overlays must sit on the processed [bg] label ----------
patch(R+"lib/export-ambient-layer.ts",
"""interface AmbientLayerParams {
  ambientEffect: string;
  hasBgVideoFile: boolean;
  jobDir: string;
  filesInDir: string[];
  width: number;
  height: number;
  effectiveFps: number;
}""",
"""interface AmbientLayerParams {
  ambientEffect: string;
  hasBgVideoFile: boolean;
  jobDir: string;
  filesInDir: string[];
  width: number;
  height: number;
  effectiveFps: number;
  /**
   * Label the ambient layer composites onto. '0:v' (the raw backdrop input)
   * for backdrop jobs; 'bg' (the scaled/cropped/speed-adjusted video label
   * from buildVideoBackgroundFilterGraph) for background-video jobs — overlaying
   * raw [0:v] there would leave [bg] dangling and bypass bgBlur/speed/fps.
   */
  baseLabel?: string;
}""",
"C1: baseLabel param")

patch(R+"lib/export-ambient-layer.ts",
"""  const chain = buildAmbientOverlayFilters({
    effect: ambientEffect,
    inputLabel: '0:v',""",
"""  const chain = buildAmbientOverlayFilters({
    effect: ambientEffect,
    inputLabel: params.baseLabel ?? '0:v',""",
"C1: use baseLabel")

patch(R+"lib/export-render-pipeline.ts",
"""    const ambientLayer = resolveAmbientLayer({
      ambientEffect: meta.ambient,
      hasBgVideoFile,
      jobDir: dir,
      filesInDir,
      width,
      height,
      effectiveFps,
    });""",
"""    const ambientLayer = resolveAmbientLayer({
      ambientEffect: meta.ambient,
      hasBgVideoFile,
      jobDir: dir,
      filesInDir,
      width,
      height,
      effectiveFps,
      // With a bg video the processed stream is labeled [bg] (scale/crop/
      // speed/blur from buildVideoBackgroundFilterGraph) — the ambient layer
      // must composite above THAT, never the raw [0:v] (dangling [bg] label).
      baseLabel: hasBgVideoFile ? 'bg' : '0:v',
    });""",
"C1: pass bg base label for video jobs")

# I7: label-balance test comes in the test file below.

# ---------- I1: surface the library error to the user ----------
patch(R+"lib/export-render-pipeline.ts",
"""    if (detail.includes('Failed to fetch verse audio') || detail.includes('HTTP ')) {
      userMsg = 'تعذّر تحميل بعض تلاوات القارئ من المصدر — جرّب إعادة المحاولة أو اختيار قارئ آخر';
    } else if (detail.includes('مفقودة')) {
      userMsg = detail;
    }""",
"""    if (detail.includes('Failed to fetch verse audio') || detail.includes('HTTP ')) {
      userMsg = 'تعذّر تحميل بعض تلاوات القارئ من المصدر — جرّب إعادة المحاولة أو اختيار قارئ آخر';
    } else if (detail.includes('مفقودة') || detail.includes('الخلفية المختارة')) {
      userMsg = detail;
    }""",
"I1: pass through library error")

# ---------- I2: reject invalid bgLibraryId at session creation ----------
patch(R+"lib/export-job-manager.ts",
"""    bgLibraryId:
      typeof rawMeta.bgLibraryId === 'string' && isBuiltinBackgroundId(rawMeta.bgLibraryId)
        ? rawMeta.bgLibraryId
        : undefined,""",
"""    bgLibraryId: (() => {
      const raw = rawMeta.bgLibraryId;
      if (raw === undefined || raw === null || raw === '') return undefined;
      // An explicitly-supplied id outside the whitelist is rejected outright —
      // silently dropping it would render the export over black instead of
      // failing with a clear message (see review I2).
      if (typeof raw !== 'string' || !isBuiltinBackgroundId(raw)) {
        throw new Error('الخلفية المختارة غير متوفرة — اختر خلفية أخرى من المكتبة');
      }
      return raw;
    })(),""",
"I2: reject invalid bgLibraryId")

patch(R+"app/api/studio/export/session/route.ts",
"""  } catch (err) {
    console.error('[studio/export/session:POST] failed:', err);
    return NextResponse.json(
      { error: 'تعذّر إنشاء جلسة تصدير الفيديو' },
      { status: 500 }
    );
  }
}""",
"""  } catch (err) {
    console.error('[studio/export/session:POST] failed:', err);
    const detail = err instanceof Error ? err.message : '';
    if (detail.includes('الخلفية المختارة')) {
      return NextResponse.json({ error: detail }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'تعذّر إنشاء جلسة تصدير الفيديو' },
      { status: 500 }
    );
  }
}""",
"I2: route 400 for library errors")

# ---------- I3: template apply syncs the preview <video> to the library id ----------
patch(R+"hooks/use-studio-media.ts",
"""import { useCallback, useRef, useState } from 'react';
import { getBuiltinBackgroundPublicPath, type BuiltinBackground } from '@/lib/background-library';
import type { StudioState } from '@/lib/quran-data';

export interface UseStudioMediaInput {
  commitState: (
    updater: (prev: StudioState) => StudioState
  ) => void;
  showToast: (msg: string) => void;
}""",
"""import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getBuiltinBackground,
  getBuiltinBackgroundPublicPath,
  type BuiltinBackground,
} from '@/lib/background-library';
import type { StudioState } from '@/lib/quran-data';

export interface UseStudioMediaInput {
  commitState: (
    updater: (prev: StudioState) => StudioState
  ) => void;
  showToast: (msg: string) => void;
  /** Current state.bgLibraryId — keeps the preview <video> in sync when a
   * saved/shared template applies a library background (no File object then). */
  bgLibraryId?: string | null;
  /** Current state.bgType, to gate the sync below to video mode only. */
  bgType?: StudioState['bgType'];
  /** Whether the user has an uploaded bg video File (uploads override library). */
  hasUploadedBgVideo?: boolean;
}""",
"I3: hook inputs")

patch(R+"hooks/use-studio-media.ts",
"""export function useStudioMedia({
  commitState,
  showToast,
}: UseStudioMediaInput): UseStudioMediaResult {""",
"""export function useStudioMedia({
  commitState,
  showToast,
  bgLibraryId,
  bgType,
  hasUploadedBgVideo,
}: UseStudioMediaInput): UseStudioMediaResult {""",
"I3: destructure inputs")

patch(R+"hooks/use-studio-media.ts",
"""  const bgVideoElRef = useRef<HTMLVideoElement | null>(null);
""",
"""  const bgVideoElRef = useRef<HTMLVideoElement | null>(null);

  // Template/share links can set bgLibraryId without touching local media
  // state (no File object) — sync the preview <video> src to the library clip
  // so the preview matches what the export will render (parity invariant).
  useEffect(() => {
    if (bgType !== 'video' || !bgLibraryId || hasUploadedBgVideo) return;
    const url = getBuiltinBackgroundPublicPath(bgLibraryId);
    if (!url || url === bgVideoUrl) return;
    setBgVideoUrl(url);
    setBgVideoName(getBuiltinBackground(bgLibraryId)?.name ?? '');
    setBgVideoReady(false);
    setBgVideoPlaying(true);
  }, [bgType, bgLibraryId, hasUploadedBgVideo, bgVideoUrl]);
""",
"I3: sync effect")

patch(R+"components/StudioView.tsx",
"""  } = useStudioMedia({ commitState, showToast });""",
"""  } = useStudioMedia({
    commitState,
    showToast,
    bgLibraryId: state.bgLibraryId,
    bgType: state.bgType,
    hasUploadedBgVideo: Boolean(bgVideoFile),
  });""",
"I3: StudioView passes state")

# ---------- I4: bokeh negative modulo + I5: seamless loop rates ----------
patch(R+"lib/ambient-effects-extra.ts",
"""/** Petals: soft pink/white petals falling with rotation and lateral sway. */""",
"""/**
 * Loop-periodicity helpers: the export protocol loops an 8-second frame
 * sequence, so every motion must return to its t=0 state at t=8. Fall rates
 * are quantized to whole-canvas wraps per loop (n/8 per second) and sway
 * frequencies to multiples of 2π/8 — otherwise particles teleport at the
 * loop seam (review I5).
 */
const LOOP_SEC = 8;
const quantizeFall = (perSec: number): number =>
  Math.max(1, Math.round(perSec * LOOP_SEC)) / LOOP_SEC;
const quantizeSway = (radPerSec: number): number => {
  const unit = (Math.PI * 2) / LOOP_SEC;
  return Math.max(unit, Math.round(radPerSec / unit) * unit);
};

/** Petals: soft pink/white petals falling with rotation and lateral sway. */""",
"I5: loop helpers")

patch(R+"lib/ambient-effects-extra.ts",
"""  for (let i = 0; i < PETAL_SEED.length; i++) {
    const p = PETAL_SEED[i];
    const fall = 0.03 * p.speed;
    const y = (p.y + timeSec * fall) % 1;
    const x = (p.x + Math.sin(timeSec * 0.6 * p.speed + p.phase) * 0.03 + 1) % 1;
    const rot = timeSec * (0.8 + p.speed * 0.6) + p.phase;""",
"""  for (let i = 0; i < PETAL_SEED.length; i++) {
    const p = PETAL_SEED[i];
    const fall = quantizeFall(0.03 * p.speed);
    const y = (p.y + timeSec * fall) % 1;
    const x =
      (p.x + Math.sin(quantizeSway(0.6 * p.speed) * timeSec + p.phase) * 0.03 + 1) % 1;
    const rot = quantizeSway(0.8 + p.speed * 0.6) * timeSec + p.phase;""",
"I5: petals seamless")

patch(R+"lib/ambient-effects-extra.ts",
"""  for (let i = 0; i < BOKEH_SEED.length; i++) {
    const p = BOKEH_SEED[i];
    const y = (p.y - timeSec * 0.012 * p.speed + 1) % 1;
    const x = (p.x + Math.sin(timeSec * 0.25 + p.phase) * 0.015 + 1) % 1;
    const breathe = 0.75 + 0.25 * Math.sin(timeSec * 0.9 * p.speed + p.phase);""",
"""  for (let i = 0; i < BOKEH_SEED.length; i++) {
    const p = BOKEH_SEED[i];
    // Purely oscillatory vertical drift (no net rise): keeps the slow bokeh
    // feel while guaranteeing t=8 equals t=0 — and the double modulo keeps
    // y in [0,1) for arbitrarily long preview sessions (review I4).
    const y =
      ((p.y + Math.sin(quantizeSway(0.15 * p.speed) * timeSec + p.phase) * 0.05) % 1 + 1) % 1;
    const x =
      (p.x + Math.sin(quantizeSway(0.25) * timeSec + p.phase) * 0.015 + 1) % 1;
    const breathe = 0.75 + 0.25 * Math.sin(quantizeSway(0.9 * p.speed) * timeSec + p.phase);""",
"I4+I5: bokeh")

patch(R+"lib/ambient-effects-extra.ts",
"""  for (const p of RAIN_SEED) {
    const speed = 0.55 + p.speed * 0.45;
    const y = (p.y + timeSec * speed) % 1;""",
"""  for (const p of RAIN_SEED) {
    const speed = quantizeFall(0.55 + p.speed * 0.45) / 1;
    const y = (p.y + timeSec * speed) % 1;""",
"I5: rain")

patch(R+"lib/ambient-effects-extra.ts",
"""  for (const p of SNOW_SEED) {
    const speed = 0.02 + p.speed * 0.03;
    const y = (p.y + timeSec * speed) % 1;
    const x = (p.x + Math.sin(timeSec * 0.5 * p.speed + p.phase) * 0.02 + 1) % 1;""",
"""  for (const p of SNOW_SEED) {
    const speed = quantizeFall(0.02 + p.speed * 0.03);
    const y = (p.y + timeSec * speed) % 1;
    const x =
      (p.x + Math.sin(quantizeSway(0.5 * p.speed) * timeSec + p.phase) * 0.02 + 1) % 1;""",
"I5: snow")

patch(R+"lib/ambient-effects-extra.ts",
"""    const x = (p.x + Math.sin(timeSec * 0.35 * p.speed + p.phase) * 0.06 + 1) % 1;
    const y = (p.y + Math.cos(timeSec * 0.28 * p.speed + p.phase * 1.7) * 0.05 + 1) % 1;
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 2.2 * p.speed + p.phase);""",
"""    const x = (p.x + Math.sin(quantizeSway(0.35 * p.speed) * timeSec + p.phase) * 0.06 + 1) % 1;
    const y = (p.y + Math.cos(quantizeSway(0.28 * p.speed) * timeSec + p.phase * 1.7) * 0.05 + 1) % 1;
    const pulse = 0.5 + 0.5 * Math.sin(quantizeSway(2.2 * p.speed) * timeSec + p.phase);""",
"I5: fireflies sway")

# ---------- I6: fetch script probe args ----------
patch(R+"scripts/fetch-nature-backgrounds.sh",
'''    if probe_ok "$dst"; then echo "   OK ($(numfmt --to=iec --suffix=B $(stat -c%s "$dst")), crf=$crf)"; break; fi''',
'''    if probe_ok "$dst" "$dur" "$side"; then echo "   OK ($(numfmt --to=iec --suffix=B $(stat -c%s "$dst")), crf=$crf)"; break; fi''',
"I6: probe args")

# ---------- Minors ----------
# M1: dead import in panel
patch(R+"components/studio-ui/StudioBackgroundPanel.tsx",
"""import {
  BUILTIN_BG_LIBRARY,
  getBuiltinBackgroundPublicPath,
  type BuiltinBackground,
} from '@/lib/background-library';""",
"""import { BUILTIN_BG_LIBRARY, type BuiltinBackground } from '@/lib/background-library';""",
"M1: dead import")

# M2: gitignore pycache
gi = Path(R+".gitignore")
gt = gi.read_text()
if "__pycache__/" not in gt:
    gi.write_text(gt.rstrip("\n") + "\n__pycache__/\n")
    print("OK    M2: gitignore __pycache__")
else:
    print("SKIP  M2: already ignored")

# M4: BUILTIN_BG_IDS
patch(R+"lib/background-library.ts",
"""export const BUILTIN_BG_COUNT = BUILTIN_BG_LIBRARY.length;""",
"""export const BUILTIN_BG_COUNT = BUILTIN_BG_LIBRARY.length;

/** All registry ids — handy for iteration/validators (plan Task 4 interface). */
export const BUILTIN_BG_IDS: readonly string[] = BUILTIN_BG_LIBRARY.map((bg) => bg.id);""",
"M4: BUILTIN_BG_IDS")

# M5: import AMBIENT_MAX_FRAMES instead of redefining
patch(R+"lib/export-ambient-layer.ts",
"""import {
  buildAmbientOverlayFilters,
  shouldRenderAnimatedAmbient,
} from '@/lib/video-export';

/** Number of ambient frames the export protocol allows (96 @ 12fps = 8s loop). */
export const AMBIENT_MAX_FRAMES = 96;""",
"""import {
  buildAmbientOverlayFilters,
  shouldRenderAnimatedAmbient,
} from '@/lib/video-export';
import { AMBIENT_MAX_FRAMES } from '@/lib/video-export-ambient';

export { AMBIENT_MAX_FRAMES };""",
"M5: shared AMBIENT_MAX_FRAMES")

# M8: split jammed import line
patch(R+"lib/export-render-pipeline.ts",
"""import { buildSrtFromTimeline } from '@/lib/srt-subtitles';import {""",
"""import { buildSrtFromTimeline } from '@/lib/srt-subtitles';
import {""",
"M8: split import")

print("\n-- patch pass done --")
