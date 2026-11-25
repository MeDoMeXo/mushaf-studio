# Graph Report - applet  (2026-11-23)

## Corpus Check
- 128 files · ~100,755 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .css 1)

## Summary
- 867 nodes · 2669 edges · 32 communities (27 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- export-job-manager.ts
- storage.ts
- eslint.config.mjs
- check-file-size.ts
- audio-cache.ts
- gen_audit_report.js
- StudioDesignInspector.tsx
- StudioView.tsx
- dependencies
- reciter-health.ts
- package.json
- compilerOptions
- steps
- react
- template-share.ts
- toArabicDigits
- overrides
- @google/genai
- AppProvider.tsx
- utils.ts
- scripts
- allowScripts
- .eslintrc.json
- postcss.config.mjs
- layout.tsx
- @radix-ui/react-accordion
- studio-renderer.ts
- lucide-react
- audio-cache.ts
- quran-utils.ts
- QuranIndexView.tsx

## God Nodes (most connected - your core abstractions)
1. `toArabicDigits()` - 54 edges
2. `react` - 50 edges
3. `StudioState` - 39 edges
4. `StudioView()` - 28 edges
5. `lucide-react` - 26 edges
6. `runExportPipeline()` - 24 edges
7. `QulVerse` - 23 edges
8. `runExportPipeline()` - 22 edges
9. `SiteConfig` - 22 edges
10. `RECITERS` - 22 edges

## Surprising Connections (you probably didn't know these)
- `StudioOrnamentsPanelProps` --references--> `StudioState`  [EXTRACTED]
  components/StudioOrnamentsPanel.tsx → lib/quran-data-types.ts
- `StudioBackgroundPanelProps` --references--> `StudioState`  [EXTRACTED]
  components/studio-ui/StudioBackgroundPanel.tsx → lib/quran-data-types.ts
- `StudioTextPanelProps` --references--> `StudioState`  [EXTRACTED]
  components/studio-ui/StudioTextPanel.tsx → lib/quran-data-types.ts
- `UseVerseActionsResult` --references--> `QulVerse`  [EXTRACTED]
  hooks/use-verse-actions.ts → lib/quran-data-types.ts
- `AdminPage()` --calls--> `AdminView()`  [EXTRACTED]
  app/admin/page.tsx → components/AdminView.tsx

## Import Cycles
- None detected.

## Communities (32 total, 5 thin omitted)

### Community 0 - "export-job-manager.ts"
Cohesion: 0.06
Nodes (90): GET(), resolveParams(), runtime, downloadVerseAudio(), execFileAsync, ExportPayloadMeta, maxDuration, POST() (+82 more)

### Community 1 - "storage.ts"
Cohesion: 0.07
Nodes (60): AdminPage(), AdminAppearanceSection(), AdminAppearanceSectionProps, AdminBackupSection(), AdminBackupSectionProps, AdminContentSection(), AdminContentSectionProps, AdminFooterSection() (+52 more)

### Community 2 - "eslint.config.mjs"
Cohesion: 0.25
Nodes (6): __dirname, __filename, eslint@9.39.1, eslint-config-next@16.0.8, eslint, eslint-config-next

### Community 3 - "check-file-size.ts"
Cohesion: 0.29
Nodes (7): countLines(), files, offenders, readFileSyncSafe(), ROOT, SKIP_DIRS, walk()

### Community 4 - "audio-cache.ts"
Cohesion: 0.07
Nodes (61): fetchSingleVerseBytes(), maxDuration, POST(), runtime, ExportCompletedCard(), ExportCompletedCardProps, ExportCompletedMeta, ExportSettingsSections() (+53 more)

### Community 5 - "gen_audit_report.js"
Cohesion: 0.10
Nodes (24): body, coverChildren, coverTable, doc, footerArabic, footerRoman, fs, header (+16 more)

### Community 6 - "StudioDesignInspector.tsx"
Cohesion: 0.10
Nodes (28): StudioAudioPanel(), StudioBackgroundPanel(), StudioBackgroundPanelProps, StudioDesignInspector(), STYLE_TAB_VALUES, STYLE_TABS, StyleTab, TEMPLATE_CATEGORIES (+20 more)

### Community 7 - "StudioView.tsx"
Cohesion: 0.07
Nodes (61): StudioPage(), ActiveAudioState, AppContextValue, ReaderSurahContext, ExportSettingsSectionsProps, StudioAudioPanelProps, StudioCommandBar(), StudioCommandBarProps (+53 more)

### Community 8 - "dependencies"
Cohesion: 0.08
Nodes (24): dependencies, autoprefixer@^10.4.21, cmdk@^1.1.1, lucide-react@^0.553.0, motion@^12.23.24, next@^15.4.9, postcss@^8.5.33, @radix-ui/react-dialog@^1.3.1 (+16 more)

### Community 9 - "reciter-health.ts"
Cohesion: 0.27
Nodes (11): checkAllRecitersHealth(), worker(), getReciterProbeUrl(), isHealthyStatus(), RECITER_HEALTH_SAMPLE_VERSE, RECITER_HEALTH_TIMEOUT_MS, ReciterHealthReport, ReciterHealthResult (+3 more)

### Community 10 - "package.json"
Cohesion: 0.13
Nodes (20): description, devDependencies, tailwindcss@4.1.11, @tailwindcss/postcss@^4.1.11, @tailwindcss/typography@^0.5.20, @types/node@^20, @types/react@^19, @types/react-dom@^19 (+12 more)

### Community 11 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx (+12 more)

### Community 12 - "steps"
Cohesion: 0.09
Nodes (26): DISABLE_HMR, jobs, reciter-health, verify, name, on, pull_request, push (+18 more)

### Community 13 - "react"
Cohesion: 0.18
Nodes (9): useApp(), AppShell(), Footer(), FooterProps, QUICK_LINKS, Header(), NAV_LINKS, nextConfig (+1 more)

### Community 14 - "template-share.ts"
Cohesion: 0.16
Nodes (21): UseTemplateActionsInput, UseTemplateActionsResult, SavedCustomTemplate, buildSavedDesignTemplate(), exportTemplatesToJson(), importTemplatesFromJson(), isBoolOrNum(), isNumber() (+13 more)

### Community 15 - "toArabicDigits"
Cohesion: 0.32
Nodes (9): SurahReaderPage(), ReaderView(), ReaderViewProps, useVerseActions(), UseVerseActionsInput, UseVerseActionsResult, toArabicDigits(), BookmarkItem (+1 more)

### Community 16 - "overrides"
Cohesion: 0.17
Nodes (12): overrides, postcss, postcss-selector-parser, typescript-eslint, @typescript-eslint/ast-spec, @typescript-eslint/eslint-plugin, @typescript-eslint/parser, @typescript-eslint/type-utils (+4 more)

### Community 18 - "AppProvider.tsx"
Cohesion: 0.23
Nodes (17): RootLayout(), AppContext, AppProvider(), AudioPlayerBar(), RECITER_PICKER_TAB_VALUES, ReciterPickerModal(), ReciterPickerModalProps, StudioTooltip() (+9 more)

### Community 19 - "utils.ts"
Cohesion: 0.33
Nodes (4): clsx@^2.1.1, tailwind-merge@^3.3.1, clsx, tailwind-merge

### Community 20 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, clean, dev, lint, start

### Community 21 - "allowScripts"
Cohesion: 0.40
Nodes (5): allowScripts, @google/genai@2.32.0, protobufjs@7.6.6, re2@1.27.2, @tailwindcss/oxide@4.1.11

### Community 25 - "layout.tsx"
Cohesion: 0.17
Nodes (10): amiri, amiriQuran, cairo, FONT_VARIABLES, JSON_LD_WEB_APP, metadata, notoNaskh, reemKufi (+2 more)

### Community 27 - "studio-renderer.ts"
Cohesion: 0.06
Nodes (81): revalidate, revalidate, LABEL_POSITION_OPTIONS, META_WEIGHT_OPTIONS, StudioTextPanelProps, VERSE_WEIGHT_OPTIONS, HARMONIZED_PRESETS, StudioOrnamentsPanelProps (+73 more)

### Community 28 - "lucide-react"
Cohesion: 0.16
Nodes (19): SearchPage(), QUICK_TERMS, SearchHit, SearchView(), RECITER_FILTER_TABS, ReciterFilter, StudioRecitationPanel(), StudioRecitationPanelProps (+11 more)

### Community 29 - "audio-cache.ts"
Cohesion: 0.07
Nodes (43): RFC-9110, useStudioPlayback(), UseStudioPlaybackResult, AUDIO_BATCH_CLIENT_CHUNK_SIZE, abortableSleep(), AUDIO_CACHE_NAME, AudioCacheStatus, buildAudioCacheKey() (+35 more)

### Community 30 - "quran-utils.ts"
Cohesion: 0.27
Nodes (13): TRANSLATIONS, ARABIC_DIGITS, buildArabicSearchRegex(), filterChapters(), formatAudioTime(), getUpstreamAudioUrl(), globalVerseIdToSurahAyah(), recordStatEvent() (+5 more)

### Community 31 - "QuranIndexView.tsx"
Cohesion: 0.19
Nodes (15): HomePage(), QuranIndexPage(), HomeView(), PLACE_FILTER_TABS, PLACE_FILTER_VALUES, MAIN_SECTION_VALUES, PLACE_TAB_VALUES, PLACE_TABS (+7 more)

## Knowledge Gaps
- **2 isolated node(s):** `next`, `RFC-9110`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 202 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `StudioView.tsx` to `storage.ts`, `audio-cache.ts`, `StudioDesignInspector.tsx`, `dependencies`, `package.json`, `react`, `template-share.ts`, `toArabicDigits`, `AppProvider.tsx`, `studio-renderer.ts`, `lucide-react`, `audio-cache.ts`, `QuranIndexView.tsx`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **What connects `next`, `RFC-9110` to the rest of the system?**
  _2 weakly-connected nodes found - possible missing edges._
- **Should `export-job-manager.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06143994461751471 - nodes in this community are weakly interconnected._
- **Why does `toArabicDigits()` connect `toArabicDigits` to `export-job-manager.ts`, `storage.ts`, `audio-cache.ts`, `StudioDesignInspector.tsx`, `StudioView.tsx`, `template-share.ts`, `AppProvider.tsx`, `studio-renderer.ts`, `lucide-react`, `quran-utils.ts`, `QuranIndexView.tsx`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `storage.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06735159817351598 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `storage.ts`, `audio-cache.ts`, `StudioDesignInspector.tsx`, `StudioView.tsx`, `dependencies`, `package.json`, `react`, `toArabicDigits`, `AppProvider.tsx`, `studio-renderer.ts`, `QuranIndexView.tsx`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Should `audio-cache.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06651017214397496 - nodes in this community are weakly interconnected._