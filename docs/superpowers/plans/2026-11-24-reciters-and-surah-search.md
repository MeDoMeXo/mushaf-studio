# Quran Reciters Expansion & Studio Surah Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 high-demand contemporary Quran reciters (منصور السالمي، إسلام صبحي، ناصر القطامي، أحمد النفيس، حسن صالح، عبد العزيز سحيم، بدر التركي) with MP3Quran CDN integration, and add real-time Surah search in Studio with diacritic-tolerant filtering.

**Architecture:** Extend `ReciterOption` with `source: 'mp3quran'` and `mp3quranServer`. Update audio resolution in `lib/quran-utils.ts`, `lib/reciter-filter.ts`, and `/api/audio/[reciter]/[ayah]/route.ts`. Expand `next.config.ts` CSP for MP3Quran CDN. Create a dedicated `StudioSurahSelector.tsx` subcomponent (<120 lines) to keep `StudioRecitationPanel.tsx` well under the 600-line ceiling while providing instant search with `stripArabicDiacritics`.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.9, Tailwind CSS 4, Bun 1.4+ (`bun test`).

## Global Constraints
- Maximum file length: 600 lines per file (`bun run scripts/check-file-size.ts`).
- Authentic Uthmani calligraphy & RTL layout preserved.
- Arabic-Indic numerals for Quranic contexts via `toArabicDigits()`.
- Zero paid APIs or third-party cost.
- All unit tests must pass (`bun test`).

## Review Focus
1. Diacritic tolerance: searching "الكهف", "الكهف", "كهف", "18" matches Surah Al-Kahf accurately.
2. Reciter audio streaming: MP3Quran server URLs construct valid 3-digit padded surah files (e.g. `001.mp3`).
3. CSP compliance: `https://*.mp3quran.net https://cdn.mp3quran.net` permitted in `next.config.ts`.
4. File size limits: all touched files strictly under 600 lines.
5. Backward compatibility: existing 38 reciters and EveryAyah/Islamic Network endpoints unchanged.

---

### Task 1: Type Definitions & CSP Configuration
**Files:**
- Modify: `lib/quran-data-types.ts:45-60`
- Modify: `lib/reciter-health.ts:15-55`
- Modify: `next.config.ts:28-40`
- Test: `lib/reciter-health.test.ts`

- [ ] Step 1: Extend `ReciterOption` in `lib/quran-data-types.ts` to include `'mp3quran'` in `source` and optional `mp3quranServer?: string`.
- [ ] Step 2: Update `ReciterHealthResult` and `toHealthResult` in `lib/reciter-health.ts` to accept `'mp3quran'`.
- [ ] Step 3: Add `https://*.mp3quran.net https://cdn.mp3quran.net` to `media-src` and `connect-src` in `next.config.ts`.
- [ ] Step 4: Run `bun test lib/reciter-health.test.ts` to verify type and health test stability.

---

### Task 2: Reciters Catalog & Audio Resolvers
**Files:**
- Modify: `lib/quran-data.ts:49-95`
- Modify: `lib/quran-utils.ts:109-125`
- Modify: `lib/reciter-filter.ts:80-96`
- Modify: `app/api/audio/[reciter]/[ayah]/route.ts:40-75`
- Test: `lib/quran-utils.test.ts`, `lib/reciter-filter.test.ts`

- [ ] Step 1: Add new test cases for MP3Quran audio resolution to `lib/quran-utils.test.ts` and `lib/reciter-filter.test.ts` (Red).
- [ ] Step 2: Register the 6 new reciters and verify `ea.nasseralqatami` in `RECITERS` in `lib/quran-data.ts`.
- [ ] Step 3: Update `getUpstreamAudioUrl` in `lib/quran-utils.ts` and `getReaderPlaybackAudioUrl` in `lib/reciter-filter.ts` to handle `source === 'mp3quran'`.
- [ ] Step 4: Run `bun test` to confirm tests pass (Green).

---

### Task 3: StudioSurahSelector Subcomponent
**Files:**
- Create: `components/studio-ui/StudioSurahSelector.tsx`
- Test: `components/studio-ui/StudioSurahSelector.test.tsx` or `lib/quran-utils.test.ts`

- [ ] Step 1: Write test for Surah search filtering.
- [ ] Step 2: Implement `StudioSurahSelector` with search input, clear button, and filtered `<select>` with keyboard navigation.
- [ ] Step 3: Verify component styling and RTL accessibility.

---

### Task 4: Integrate Surah Search in StudioRecitationPanel
**Files:**
- Modify: `components/studio-ui/StudioRecitationPanel.tsx:143-170`
- Test: `bun run scripts/check-file-size.ts`, `bun run tsc --noEmit`

- [ ] Step 1: Replace raw `<select>` in `StudioRecitationPanel.tsx` with `StudioSurahSelector`.
- [ ] Step 2: Verify line count of `StudioRecitationPanel.tsx` (drops from 549 to ~515 lines).
- [ ] Step 3: Verify TypeScript build cleanly.

---

### Task 5: End-to-End Verification & Health Checks
**Files:**
- All touched files
- Verification commands: `bun test`, `bun run tsc --noEmit`, `bun run scripts/check-file-size.ts`

- [ ] Step 1: Run all unit test suites (`bun test`).
- [ ] Step 2: Run file size audit script.
- [ ] Step 3: Run TypeScript compiler check.
