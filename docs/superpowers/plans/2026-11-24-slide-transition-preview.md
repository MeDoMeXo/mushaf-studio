# Slide & Transition Preview Implementation Plan (Refined for Fullscreen Zoom)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an authentic, high-fidelity slide and transition preview experience directly integrated into the Fullscreen Zoom view ("خيار التكبير") and enhance the Export Settings preview card, eliminating miniature canvas font distortion while maintaining the 600-line file ceiling and Graphify knowledge architecture.

**Architecture:**
1. **Fullscreen Zoom Integration (`StudioFullscreenDialog.tsx`)**:
   - Add transition selector (`SLIDE_TRANSITION_OPTIONS`) and a "تجربة الانتقال 🎬" (Test Transition) button in the fullscreen monitor HUD.
   - Wire `triggerTransitionPreview` from `use-studio-canvas.ts` through `StudioView.tsx` into `StudioFullscreenDialog.tsx`.
   - Ensure slide filmstrip navigation (Next/Prev and Ayah pills) triggers smooth full-resolution transitions on the fullscreen canvas.
2. **Export Modal Bridge & Clean CSS Preview (`TransitionPreviewCard.tsx`)**:
   - Redesign `TransitionPreviewCard.tsx`: remove the distorted downscaled 180px canvas.
   - Replace with a high-fidelity typography-based CSS motion simulator matching the active transition (`fade`, `zoomin`, `slideup`, `fadeblack`, `fadewhite`, `dissolve`), which never distorts Arabic script.
   - Add a prominent "معاينة بملء الشاشة المكبرة (التكبير) ⛶" button that launches the Fullscreen Dialog directly from the Export Modal.
3. **StudioView & Modal Plumbing (`StudioView.tsx`, `StudioExportModal.tsx`, `ExportSettingsSections.tsx`)**:
   - Pass `onOpenFullscreen` from `StudioView` through `StudioExportModal` to `ExportSettingsSections`.
   - Pass `exportSettings`, `onUpdateExportSettings`, and `onTriggerTransitionPreview` to `StudioFullscreenDialog`.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.9, Radix UI Dialog, Tailwind CSS, Bun test runner.

## Global Constraints
- Maximum 600 lines per file (`bun run scripts/check-file-size.ts`).
- Preserve Arabic RTL, Uthmani calligraphy, Arabic-Indic numbers (`toArabicDigits`), and zero external costs.
- All unit tests must pass (`bun test`).
- Type check clean (`tsc --noEmit`).

---

### Task 1: Expose `triggerTransitionPreview` in `hooks/use-studio-canvas.ts`

**Files:**
- Modify: `hooks/use-studio-canvas.ts`
- Test: `lib/video-export.test.ts`

- [x] Export `triggerTransitionPreview` callback in `UseStudioCanvasResult`.
- [x] Ensure `triggerTransitionPreview` animates the current slide with `transitionProgress` (0..1) on both main and fullscreen mirrored canvases.
- [x] Run `bun test` and verify line count is <= 600 lines.

---

### Task 2: Integrate Transition Controls in `StudioFullscreenDialog.tsx` ("خيار التكبير")

**Files:**
- Modify: `components/studio-ui/StudioFullscreenDialog.tsx`
- Modify: `components/StudioView.tsx`

- [x] Add `exportSettings`, `onUpdateExportSettings`, and `onTriggerTransitionPreview` props to `StudioFullscreenDialogProps`.
- [x] Render transition selector dropdown and "تجربة الانتقال 🎬" button in the Fullscreen Dialog header.
- [x] Connect `StudioView.tsx` to pass these props to `StudioFullscreenDialog`.
- [x] Verify `StudioView.tsx` and `StudioFullscreenDialog.tsx` stay strictly under 600 lines.

---

### Task 3: Redesign `TransitionPreviewCard.tsx` and Link Fullscreen from Export Modal

**Files:**
- Modify: `components/studio-ui/TransitionPreviewCard.tsx`
- Modify: `components/studio-ui/ExportSettingsSections.tsx`
- Modify: `components/StudioExportModal.tsx`

- [x] Redesign `TransitionPreviewCard.tsx` to use distortion-free typography cards with accurate CSS motion simulation.
- [x] Add the one-click "معاينة بملء الشاشة المكبرة (التكبير) ⛶" button.
- [x] Connect `onOpenFullscreen` from `StudioExportModal` to `ExportSettingsSections`.
- [x] Run `bun test`, `tsc --noEmit`, and `check-file-size.ts`.
