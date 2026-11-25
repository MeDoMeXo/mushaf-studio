# Admin Reciters Management & Live Health Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dedicated "إدارة القرّاء والمكتبات" tab in the Admin Control Panel (`/admin`) allowing administrators to add new reciters with live pre-save URL testing, delete custom reciters, toggle/disable reciters, run live batch or single connection health probes, and preview audio recitations.

**Architecture:**
1. Extend `SiteConfig` with `customReciters?: ReciterOption[]` and `disabledReciters?: string[]`.
2. Add helper functions in `lib/reciter-filter.ts` (`getActiveReciters`, `isReciterDisabled`) and in `lib/reciter-health.ts` (`probeSingleReciterHealth`).
3. Add a dedicated `AddReciterModal.tsx` for adding new reciters with a pre-flight probe test button.
4. Add `AdminRecitersSection.tsx` containing total/active/disabled stat counters, a search/filter bar, interactive table with per-reciter health status badges, single probe buttons, sample audio preview, disable/enable switches, and delete buttons.
5. Wire `reciters` tab into `AdminView.tsx` navigation.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.9, Tailwind CSS 4, Lucide icons, Bun test runner.

## Global Constraints
- Every file must stay strictly under 600 lines (`bun run scripts/check-file-size.ts`).
- Authentic Arabic RTL layout and typography, with gold/emerald design system tokens.
- Arabic-Indic numerals for counts via `toArabicDigits()`.
- Zero broken imports, zero TypeScript errors (`tsc --noEmit`), and all 97+ unit tests pass.

## Review Focus
1. Pre-flight URL test: before adding a reciter, the admin can test the CDN link to confirm it returns HTTP 200/206.
2. Safe merge in `lib/storage.ts`: `CONFIG_DEFAULTS` and `mergeSiteConfig` safely preserve `customReciters` and `disabledReciters`.
3. Audio preview: clicking preview on a row plays a sample verse audio without overlapping.
4. Deletion safety: custom reciters can be permanently deleted; built-in reciters cannot be deleted but can be disabled/enabled.
5. File sizes: all touched and newly created files must stay well under 600 lines.

---

### Task 1: Extend Data Types, Defaults, and Filtering Helpers
**Files:**
- Modify: `lib/quran-data-types.ts:167-195`
- Modify: `lib/quran-data.ts:25-35`
- Modify: `lib/quran-utils.ts:200-240`
- Modify: `lib/reciter-filter.ts:20-60`
- Test: `lib/reciter-filter.test.ts`

- [ ] Step 1: Add `customReciters?: ReciterOption[];` and `disabledReciters?: string[];` to `SiteConfig` in `lib/quran-data-types.ts`.
- [ ] Step 2: Update `CONFIG_DEFAULTS` in `lib/quran-data.ts` to include `customReciters: []` and `disabledReciters: []`.
- [ ] Step 3: Update `mergeSiteConfig` in `lib/quran-utils.ts` to copy and sanitize `customReciters` and `disabledReciters`.
- [ ] Step 4: Add `getActiveReciters(customReciters?, disabledSlugs?)` and `getAllAdminReciters(customReciters?, disabledSlugs?)` in `lib/reciter-filter.ts`.
- [ ] Step 5: Add tests for `getActiveReciters` in `lib/reciter-filter.test.ts` and verify with `bun test`.

---

### Task 2: Extend Reciter Health Probe Utilities
**Files:**
- Modify: `lib/reciter-health.ts:60-120`
- Test: `lib/reciter-health.test.ts`

- [ ] Step 1: Add `probeSingleReciterHealth(reciter: ReciterOption, timeoutMs?: number)` in `lib/reciter-health.ts`.
- [ ] Step 2: Update `checkAllRecitersHealth` to accept an optional `reciterList?: readonly ReciterOption[]`.
- [ ] Step 3: Add unit tests for `probeSingleReciterHealth` and parameterized `checkAllRecitersHealth` in `lib/reciter-health.test.ts`.
- [ ] Step 4: Run `bun test lib/reciter-health.test.ts` to confirm tests pass.

---

### Task 3: Build AddReciterModal Subcomponent
**Files:**
- Create: `components/admin-ui/AddReciterModal.tsx`

- [ ] Step 1: Implement form with fields: name, slug, style, country, bitrate, source type (mp3quran / everyayah / custom), and server/folder URL.
- [ ] Step 2: Implement live connection probe button ("فحص الرابط الآن") that tests the entered URL before saving and displays a status badge with response time.
- [ ] Step 3: Implement validation and submission callback `onAdd(reciter: ReciterOption)`.

---

### Task 4: Build AdminRecitersSection Component
**Files:**
- Create: `components/admin-ui/AdminRecitersSection.tsx`

- [ ] Step 1: Implement header stats (إجمالي القرّاء، نشط، معطّل، مخصص) and action buttons (فحص شامل، إضافة قارئ جديد).
- [ ] Step 2: Implement search input and filter tabs (الكل، النشطة، المعطلة، المخصصة، ومرتل/مجود/ورش/معلم).
- [ ] Step 3: Implement interactive table with live ping status badge, single probe trigger, audio sample playback, toggle switch, and delete button for custom reciters.
- [ ] Step 4: Wire `AddReciterModal` open/close and callbacks.

---

### Task 5: Wire Reciters Tab into AdminView Navigation
**Files:**
- Modify: `components/AdminView.tsx:50-80, 250-290`
- Test: `bun run scripts/check-file-size.ts`, `bun run tsc --noEmit`

- [ ] Step 1: Add `'reciters'` to `AdminSection` union and add `{ id: 'reciters', label: 'إدارة القرّاء والمكتبات', icon: Mic }` to `NAV_ITEMS`.
- [ ] Step 2: Render `AdminRecitersSection` when `section === 'reciters'`.
- [ ] Step 3: Verify TypeScript compilation and file sizes.

---

### Task 6: Full Verification and Dev Server Test
**Files:**
- All touched files
- Verification commands: `bun test`, `bun run tsc --noEmit`, `bun run scripts/check-file-size.ts`

- [ ] Step 1: Run full unit test suite (`bun test`).
- [ ] Step 2: Run file size audit (`scripts/check-file-size.ts`).
- [ ] Step 3: Test API and browser playback for custom reciter addition flow.
