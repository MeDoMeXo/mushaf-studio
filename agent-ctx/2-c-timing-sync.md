# Task 2-c — Timing & Sync Panel + Long-Surah Sections + Batch Export

Agent: 2-c (timing/sync/sections/batch-export). Parallel batch: 2-a fonts, 2-b layers (untouched).

## Files modified / created

| File | Action | Lines |
|---|---|---|
| `components/studio-ui/StudioTimingPanel.tsx` | full implementation (replaced stub) | 565 |
| `components/studio-ui/BatchSectionsExport.tsx` | NEW — batch loop + toggle/completed cards | 209 |
| `components/studio-ui/ExportModalBanners.tsx` | NEW — extracted 2 presentational blocks from the modal (600-line rule) | 95 |
| `components/StudioExportModal.tsx` | batch sections export (prop `sections?`, toggle card, batch branch in `handleStartExport`, completed-list card, footer label) | 593 |
| `components/StudioView.tsx` | ONE added prop line: `sections={state.sections}` | — |

No lib/, hooks/, app/api, or other agents' files touched. StudioTextPanel / StudioLayersPanel / StudioFontPicker / StudioDesignInspector / StudioStagePanel untouched. `lib/studio-sections.ts` used read-only.

## What was implemented

### StudioTimingPanel (tab «التوقيت»)
1. **الفواصل الزمنية بين الآيات**: `StudioSlider` default gap (verseGapSec 0–1.5, step 0.05, `ث` display) → `onUpdateExportSettings`; muted hint. Per-verse gap editor: `studio-scroll max-h-72 overflow-y-auto` list, one `VerseGapRow` per selected verse («الآية ٥» + h-8 w-20 dir=ltr number input 0–3 step 0.05, placeholder «افتراضي», draft-pattern for smooth decimal typing + live write-through), gold «تخصيص» badge when override exists, RotateCcw reset (immutable key delete). ayah = `v.verse_number ?? state.fromAyah + i`. Writes `onPatchState({ verseGaps: {...(state.verseGaps ?? {}), [String(ayah)]: num} })`. Cap note «عرض أول ٤٠ آية» when > 40 verses (informational; full list still rendered inside the scroll). Readout chip: verses count · custom-gap count · estimated time mm:ss = Σ(5.5 + effective gap), labeled «تقديري (5.5ث/آية)».
2. **مزامنة التتبّع والترجمات**: `StudioSlider` audioOffsetMs −1000..1000 step 50 (`ms` display) → `onPatchState({ audioOffsetMs })`, quick-reset-to-0 button when non-zero, muted hint about positive/negative semantics (preview + SRT).
3. **تقطيع السور الطويلة — المقاطع**: intro text; auto-split row (perN number input, default 10, clamped 1–50 + gold Scissors «توليد المقاطع» → `autoSplitSections`); boundary-split row (dir=ltr text input, Enter/button → parse + `splitAtBoundaries`, inline red error «أدخل أرقام آيات مفصولة بفواصل» on invalid); sections list (max-h-[420px] scroll) of bordered `SectionRow` cards: inline-editable name (h-8), «تحميل» (Download → `onPatchState({ fromAyah, toAyah })`), «حذف» (Trash2), from/to tiny inputs (w-14, h-8) validated on blur via `normalizeSection(1..surahVerseCount, from ≤ to)` and patched immutably; range chip `١–٢٠ · ٢٠ آية` (toArabicDigits). Footer: «n مقطع · يغطي M آية من أصل N» + «حذف الكل»; gentle note when < 15 verses (non-blocking).

### StudioExportModal + BatchSectionsExport
- New optional prop `sections?: ProjectSection[]` (imported from '@/lib/quran-data').
- `BatchSectionsToggleCard`: role="switch" toggle (StudioSwitch visual clone, modal-consistent inline styles, aria-checked, no StudioControls import) «تصدير المقاطع كفيديوهات منفصلة (n)» + muted description. Placed in the settings view after the summary strip/badges.
- `runBatchSectionExports(args)`: sequential loop — per section: abort check (`DOMException AbortError`), slice `selectedVerses` by `v.verse_number ?? 0` within [from..to]; empty slice → `onErrorToast('المقطع «name» لا يحتوي آيات ضمن النطاق الحالي')` + skip; per-section `studioState: { ...studioState, fromAyah, toAyah }`; reuses the memoized `targetDims`; progress mapping `(i + pct/100) * (100/total)`; stage labels `المقطع i من n — name...` and `[i/n] <pipeline label>`; `onExportSuccess` only accumulates `{ name, filename }` (+ registers the verified local blob URL for later cleanup) — the single-export card state (exportedUrl/Meta/Blob) is NOT overwritten in batch mode. Zero-completed → Arabic error. After loop → stage 'done', label «اكتمل تصدير n مقطع», `onExportSuccess(lastFilename)` once for the whole batch (one stat bump + one toast instead of N).
- `BatchCompletedCard`: bordered list (name + filename, scrollable) + note that each file was auto-downloaded; single-export done flow untouched (batch never sets exportedUrl, so `ExportCompletedCard` stays hidden in batch mode; toggle OFF = byte-identical single flow).
- Footer label when batching: «بدء تصدير المقاطع (n)».
- Toggle OFF ⇒ zero behavior change to the existing single-export flow (same code path; only the shared start-cleanup gained blob-URL revocation of the empty ref).

## CRITICAL FINDING — auto-download behavior in the export pipeline

**`runExportPipeline` triggers the download ITSELF.** In `lib/export-pipeline-poll.ts` (`waitForExportCompletion`, lines 171–178): after the job finishes it fetches a verified local blob (`fetchVerifiedVideoBlob`, ≤120MB) and calls `triggerDownload(localBlobUrl, filename)` (from `lib/export-network.ts`); otherwise it calls `verifyAndDownload(streamUrl, downloadUrl, filename, format, …)` which Range-probes the magic header and calls `triggerDownload(downloadUrl, filename)`. `ExportCompletedCard` has a manual «تنزيل» button that re-uses `verifyAndDownload` — but the automatic path is inside the pipeline.

**Consequence implemented:** the batch loop does NOT add any explicit `triggerSectionDownload` — doing so would double-download each file. Each section's `runExportPipeline` call auto-downloads its own file on success. I reused the pipeline's own trigger; my only memory management is collecting each section's `localBlobUrl` in `sectionBlobUrlsRef` and revoking them on the next export start + unmount (mirrors the existing single-export blob-URL lifecycle).

## Incomplete / deviations
- Stage label after batch uses the COMPLETED count (`اكتمل تصدير ${completed.length} مقطع`) rather than `sections.length` — truthful when sections were skipped for empty slices.
- Parent `onExportSuccess` (stat bump + toast) fires ONCE per batch with the last completed filename (avoids N toasts); stats count a batch as one export event.
- `targetDims` reused unchanged across sections (dimensions depend only on aspect + resolution, not the ayah range) per task note.
- tsc --noEmit: zero errors in all five files (only pre-existing unrelated noise in `examples/` and a parent-owned API route).
