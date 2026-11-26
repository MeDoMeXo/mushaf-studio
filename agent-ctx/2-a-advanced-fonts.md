# Task 2-a — Advanced Fonts System (work record)

Agent: 2-a (fonts). Parallel batch sibling tasks: 2-b (layers), 2-c (timing) — they own other files; I did not touch any file on the forbidden list.

## Files created

1. `app/api/fonts/route.ts` (165 lines, NEW)
   - `runtime = 'nodejs'`; conventions copied from `app/api/studio/export/route.ts` + `app/api/audio/batch/route.ts` (NextRequest/NextResponse, `promises as fs`, Arabic error bodies, `console.error('[api/fonts] ...')`).
   - GET → reads `public/uploads/fonts/registry.json`, tolerates missing/corrupt registry (returns `{ fonts: [] }`), `Cache-Control: no-store`.
   - POST → multipart `file` + `family`. Validates: ext woff2|ttf|otf|woff (case-insensitive; woff allowed but woff2/ttf/otf preferred), size ≤ 8MB, size ≥ 256B (anti empty file), family sanitized (strip `"` `'` + control chars, trim, ≤ 40 chars, pattern: Arabic \u0600-\u06FF/\u0750-\u077F **or Latin** letters + digits + spaces + hyphens — Latin allowed as a pragmatic superset for names like "MyKufi"), duplicate family rejected. Filename slugged ASCII-only with random fallback (`font-<hex>`), collision → random suffix. Atomic registry write (temp file + rename). Returns 200 `{ family, file }`.
   - DELETE `?family=` → removes entry + file (basename-guarded), returns `{ ok: true }` / 404.
   - Imports `CustomFontMeta` **type-only** from `@/lib/custom-fonts` (erased at compile — no server/client bundling issue).
   - **Verified end-to-end with curl against the running dev server**: GET [] → POST Arabic family (Arabic slug → random fallback name) → GET 1 entry → duplicate 400 → bad ext 400 → quotes stripped → DELETE 404/200 → registry empty again. All test artifacts removed afterwards.

2. `lib/custom-fonts.ts` (100 lines, NEW)
   - `CustomFontMeta` (canonical type), `fetchCustomFonts` (empty on error), `uploadCustomFont` (FormData POST, surfaces server's Arabic error message), `deleteCustomFont` (treats 404 as success), `customFontFormatHint(ext)` → woff2|truetype|opentype|woff, `ensureCustomFontLoaded` — injects `<style id="custom-font-${CSS.escape(family)}">` with `@font-face { font-family: "F"; src: url("/uploads/fonts/FILE") format(...); font-display: block; }` (idempotent by id), then `document.fonts.load('400 48px "F"')` + `('700 48px "F"')` in try/catch. Custom families automatically work on canvas via `resolveCanvasFontFamily`'s unknown-name passthrough.

3. `components/studio-ui/StudioFontPicker.tsx` (385 lines, NEW)
   - `StudioFontPicker` (props: `selected`, `customFonts`, `onSelect`, optional `onCustomFontsChange`): `studio-scroll max-h-72 overflow-y-auto` grid-cols-2 of font cards — each renders `بِسْمِ ٱللَّهِ` in the actual font (built-ins via `var(--font-…, "Name")` CSS vars incl. KFGQPC vars; customs via `"${family}", serif`) + `text-[10px]` label; custom cards get «مخصص» badge; selected = gold ring pattern from StudioDesignInspector template cards (`border-[var(--brand-gold)] bg-[var(--brand-gold)]/12 ring-2 ring-[var(--brand-gold)]/35`); radiogroup/radio ARIA.
   - Custom fonts block inside the same file: family text input (maxLength 40), hidden file input (accept .woff2,.ttf,.otf,.woff) triggered by a dashed «اختيار ملف الخط» button showing picked name, gold «رفع الخط» button (Loader2 spinner while busy), inline red error text, custom list with Trash2 delete buttons (delete resets selection to 'Amiri Quran' if it was the selected family).
   - `StudioElementFonts` (second export, props: `state`, `onPatchState`, `customFonts`): «خطوط العناصر» — two compact selects for `labelFontFamily` (default 'Reem Kufi') and `translationFontFamily` (default 'Cairo'), options = STUDIO_FONTS + custom (`X — مخصص`); «تحكم دقيق» — StudioSlider تباعد الحروف 0–24 step 1, StudioSlider سماكة حدود النص 0–12 step 0.5 (`${v}px` displays), textStrokeColor swatch grid (grid-cols-8, STUDIO_TEXT_COLORS, default '#0B3D2E' matching lib/studio-initial-state.ts).
   - Extracted from StudioTextPanel to satisfy the 600-line rule (panel would have been ~626 inline).

## Files modified

4. `app/layout.tsx` — added 8 Google fonts following the existing pattern (subsets `['arabic']`, `display: 'swap'`, CSS vars, appended to FONT_VARIABLES): Aref_Ruqaa (['400','700'] → --font-aref-ruqaa), Lateef (['400','700'] → --font-lateef), Gulzar ('400' → --font-gulzar), El_Messiri (['400','500','700'] → --font-el-messiri), Tajawal (['400','500','700'] → --font-tajawal), Almarai (['300','400','700'] → --font-almarai), Noto_Kufi_Arabic (variable → --font-noto-kufi), Rakkas ('400' → --font-rakkas). All 6 original fonts + 2 local KFGQPC fonts untouched. Weights validated against `next/dist/compiled/@next/font/dist/google/font-data.json` (Lateef is NOT variable despite 200–800 weights, so explicit ['400','700'] was required; Gulzar/Rakkas are single-400 → explicit '400'; Noto Kufi Arabic is variable → no weight).

5. `lib/studio-renderer-shared.ts` — added the 8 exact FONT_CSS_VAR_MAP entries specified by the task (Aref Ruqaa, Lateef, Gulzar, El Messiri, Tajawal, Almarai, Noto Kufi Arabic, Rakkas).

6. `components/studio-ui/StudioTextPanel.tsx` (523 → 540 lines) — replaced the plain `<select id="st-font-select">` entirely with `<StudioFontPicker>` + `<StudioElementFonts>`; added `customFonts` state + mount effect (cancelled flag; fetchCustomFonts → Promise.all(ensureCustomFontLoaded) → setCustomFonts). All existing sections kept (weights, sliders, karaoke, colors, align, medallion, labels positioning, layer switches, watermark). Imports now: @/lib/quran-data, @/lib/custom-fonts, ./StudioControls, ./StudioFontPicker, ./StudioTabs, @/lib/islamic-ornaments, @/lib/verse-highlight.

7. `lib/export-pipeline.ts` — ONLY added two try/catch `document.fonts.load` blocks after the existing fontFamily pre-warm: `600 ${fontSize}px "${labelFontFamily || 'Reem Kufi'}"` and `400 ${fontSize}px "${translationFontFamily || 'Cairo'}"`. Nothing else changed.

## Decisions / gotchas
- `app/globals.css` NOT touched: its @font-face entries are ONLY for the two KFGQPC local woff2 files (as the task anticipated); the 8 new fonts flow through next/font CSS vars, no duplication needed.
- CSP in next.config.ts (`font-src 'self' data:`, `style-src 'unsafe-inline'`) already permits same-origin /uploads/fonts @font-face + inline style injection — no config change needed.
- `public/uploads/fonts/` is created lazily at runtime (`fs.mkdir recursive` on POST/DELETE/writeRegistry); GET works with no directory/registry. Test artifacts were cleaned; registry.json + dir were removed after smoke tests (route recreates on demand).
- StudioTextPanel mounts per active tab (StudioTabPanel returns null when inactive) → the mount effect re-runs per tab activation; harmless (no-store GET, idempotent @font-face injection by style id).
- Per-element fonts + typography extras live in `StudioElementFonts` inside StudioFontPicker.tsx (not inline in the panel) purely to respect the 600-line hard limit — they render inside the text tab exactly as specified; hard rule explicitly allows splitting into subcomponents.
- Duplicate `CustomFontMeta` definition avoided: route type-imports from lib/custom-fonts (type-only import is erased, no server/client boundary issue).

## Verification
- `bunx tsc --noEmit`: zero errors in ALL of my 7 files (only pre-existing errors remain in other agents' files: export/session route 'webp' type, StudioExportModal onSectionStart, examples/* missing modules — untouched by me, reported to parent via this note).
- Dev server (auto-run) compiled everything clean: repeated `✓ Compiled … GET /studio 200` after edits, `/api/fonts` GET/POST/DELETE all logged correctly. No next/font errors.
- `bun run lint` NOT run per task instruction (parent verifies).
