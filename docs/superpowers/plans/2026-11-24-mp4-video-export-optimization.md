# MP4 Video Export Compression & Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize MP4 video export encoding pipeline to drastically reduce exported file sizes (from ~350MB down to ~60-80MB for 70 verses / 25 minutes) while maintaining pristine Uthmani text sharpness and high visual fidelity, adhering strictly to the 600-line file ceiling and Graphify knowledge architecture.

**Architecture:** Introduce `resolveVideoBitrateBounds` in `lib/video-export.ts` to compute resolution- and tier-aware `-maxrate` and `-bufsize` limits; apply `-tune stillimage` for slide-based exports in `lib/export-render-pipeline.ts`; replace `superfast` preset with `veryfast` to enable CABAC & B-frame macroblock compression; tune CRF levels (`high: 20`, `balanced: 24`, `compact: 28`); and update test suites in `lib/video-export.test.ts`.

**Tech Stack:** Next.js 15, TypeScript 5.9, FFmpeg 9.1 (`libx264`), Bun test runner.

**Spec:** Documented in conversation history, `doc/06-video-export-pipeline.md`, and `doc/12-superpowers-agentic-architecture.md`.

## Global Constraints
- Maximum 600 lines per file (`bun run scripts/check-file-size.ts`).
- Preserve Arabic RTL, Uthmani calligraphy, and medallion rendering 100%.
- Zero external paid APIs or third-party costs.
- All unit tests must pass (`bun test`).
- Type check clean (`tsc --noEmit`).

## Review Focus
1. `resolveVideoBitrateBounds` handles all combinations of resolutions (1080p, 720p, 480p), tiers (high, balanced, compact), and `hasBgVideo` flag.
2. Static slides exports (`hasBgVideo === false`) get `-tune stillimage` and capped `-maxrate` / `-bufsize`.
3. Animated video background exports (`hasBgVideo === true`) omit `-tune stillimage` and receive appropriate dynamic video bitrates.
4. `preset` never falls back to `superfast` (which balloons sizes by 300%), keeping `veryfast` for optimal compression and rapid encoding speed.
5. All source files stay strictly under 600 lines.

---

### Task 1: Add Bitrate Bounding & Refine CRF in `lib/video-export.ts`

**Files:**
- Modify: `lib/video-export.ts`
- Test: `lib/video-export.test.ts`

- [ ] Write failing test in `lib/video-export.test.ts` verifying `resolveVideoBitrateBounds` and updated `getCrfForQuality`.
- [ ] Run `bun test lib/video-export.test.ts` to confirm test failure.
- [ ] Implement `resolveVideoBitrateBounds` and updated `getCrfForQuality` in `lib/video-export.ts`.
- [ ] Update `estimateExportSizeMb` to reflect the refined bitrate caps.
- [ ] Run `bun test lib/video-export.test.ts` to confirm test passes.
- [ ] Verify line count is <= 600 (`bun run scripts/check-file-size.ts`).

---

### Task 2: Update FFmpeg Encoding Arguments in `lib/export-render-pipeline.ts`

**Files:**
- Modify: `lib/export-render-pipeline.ts`
- Test: `lib/video-export.test.ts`

- [ ] Write tests verifying that MP4 encoding parameters incorporate `-tune stillimage`, `-maxrate`, `-bufsize`, and `veryfast` preset.
- [ ] Implement parameter injection in `lib/export-render-pipeline.ts`:
  - Determine `bitrateBounds = resolveVideoBitrateBounds(meta.resolution, meta.quality, hasBgVideoFile)`.
  - Add `-maxrate` and `-bufsize` to `videoArgs`.
  - Add `-tune stillimage` when `!hasBgVideoFile`.
  - Set `-preset veryfast` (removing `superfast` downgrade).
- [ ] Run `bun test` to confirm all tests pass.
- [ ] Check file line count (`bun run scripts/check-file-size.ts`) to ensure `lib/export-render-pipeline.ts` stays <= 600 lines.

---

### Task 3: End-to-End Verification

**Files:**
- Test: All suites (`bun test`)
- Types: `bun run tsc --noEmit`
- Linter / Limits: `bun run scripts/check-file-size.ts`

- [ ] Run `bun test` across the full test suite.
- [ ] Run `tsc --noEmit` to verify type safety.
- [ ] Run `bun run scripts/check-file-size.ts` to verify strict 600-line compliance.
