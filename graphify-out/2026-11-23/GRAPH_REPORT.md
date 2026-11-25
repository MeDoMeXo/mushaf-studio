# Graph Report - applet  (2026-11-23)

## Corpus Check
- 130 files · ~103,151 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .css 1)

## Summary
- 882 nodes · 2722 edges · 30 communities (26 shown, 4 thin omitted)
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
- package.json
- compilerOptions
- steps
- react
- template-share.ts
- toArabicDigits
- overrides
- surah-cover.ts
- AppProvider.tsx
- utils.ts
- scripts
- allowScripts
- .eslintrc.json
- postcss.config.mjs
- studio-renderer.ts
- QuranIndexView.tsx
- reciter-health.ts
- quran-utils.ts
- HomeView.tsx
- next@^15.4.9

## God Nodes (most connected - your core abstractions)
1. `toArabicDigits()` - 54 edges
2. `react` - 51 edges
3. `StudioState` - 42 edges
4. `StudioView()` - 29 edges
5. `lucide-react` - 27 edges
6. `QulVerse` - 23 edges
7. `runExportPipeline()` - 22 edges
8. `runExportPipeline()` - 22 edges
9. `SiteConfig` - 22 edges
10. `RECITERS` - 22 edges

## Surprising Connections (you probably didn't know these)
- `SurahReaderPage()` --calls--> `ReaderView()`  [EXTRACTED]
  app/quran/[id]/page.tsx → components/ReaderView.tsx
- `AdminStudioSectionProps` --references--> `SiteConfig`  [EXTRACTED]
  components/admin-ui/AdminStudioSection.tsx → lib/quran-data-types.ts
- `ExportSettingsSectionsProps` --references--> `VideoExportSettings`  [EXTRACTED]
  components/studio-ui/ExportSettingsSections.tsx → lib/video-export.ts
- `StudioTextPanelProps` --references--> `StudioState`  [EXTRACTED]
  components/studio-ui/StudioTextPanel.tsx → lib/quran-data-types.ts
- `UseVersesSourceInput` --references--> `StudioState`  [EXTRACTED]
  hooks/use-verses-source.ts → lib/quran-data-types.ts

## Import Cycles
- None detected.

## Communities (30 total, 4 thin omitted)

### Community 0 - "export-job-manager.ts"
Cohesion: 0.05
Nodes (93): GET(), resolveParams(), runtime, downloadVerseAudio(), execFileAsync, ExportPayloadMeta, maxDuration, POST() (+85 more)

### Community 1 - "storage.ts"
Cohesion: 0.06
Nodes (76): AdminPage(), AdminAppearanceSection(), AdminAppearanceSectionProps, AdminBackupSection(), AdminBackupSectionProps, AdminContentSection(), AdminContentSectionProps, AdminFooterSection() (+68 more)

### Community 2 - "eslint.config.mjs"
Cohesion: 0.25
Nodes (6): __dirname, __filename, eslint@9.39.1, eslint-config-next@16.0.8, eslint, eslint-config-next

### Community 3 - "check-file-size.ts"
Cohesion: 0.29
Nodes (7): countLines(), files, offenders, readFileSyncSafe(), ROOT, SKIP_DIRS, walk()

### Community 4 - "audio-cache.ts"
Cohesion: 0.07
Nodes (65): fetchSingleVerseBytes(), maxDuration, POST(), runtime, ExportCompletedCard(), ExportCompletedCardProps, useStudioPlayback(), AUDIO_BATCH_CLIENT_CHUNK_SIZE (+57 more)

### Community 5 - "gen_audit_report.js"
Cohesion: 0.10
Nodes (24): body, coverChildren, coverTable, doc, footerArabic, footerRoman, fs, header (+16 more)

### Community 6 - "StudioDesignInspector.tsx"
Cohesion: 0.13
Nodes (24): StudioAudioPanel(), StudioBackgroundPanel(), StudioDesignInspector(), STYLE_TAB_VALUES, STYLE_TABS, StyleTab, TEMPLATE_CATEGORIES, TemplateCategory (+16 more)

### Community 7 - "StudioView.tsx"
Cohesion: 0.06
Nodes (62): StudioPage(), ReaderSurahContext, ExportCompletedMeta, StudioAudioPanelProps, StudioCommandBar(), StudioCommandPalette(), StudioCommandPaletteProps, StudioFullscreenDialog() (+54 more)

### Community 8 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, autoprefixer@^10.4.21, cmdk@^1.1.1, @google/genai@^3.6.1, lucide-react@^0.553.0, motion@^12.23.24, postcss@^8.5.33, @radix-ui/react-accordion@^1.3.1 (+15 more)

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
Cohesion: 0.09
Nodes (20): amiri, amiriQuran, cairo, FONT_VARIABLES, JSON_LD_WEB_APP, metadata, notoNaskh, reemKufi (+12 more)

### Community 14 - "template-share.ts"
Cohesion: 0.15
Nodes (23): useTemplateActions(), UseTemplateActionsInput, UseTemplateActionsResult, SavedCustomTemplate, saveCustomTemplates(), buildSavedDesignTemplate(), exportTemplatesToJson(), importTemplatesFromJson() (+15 more)

### Community 15 - "toArabicDigits"
Cohesion: 0.23
Nodes (13): AudioPlayerBar(), ReciterPickerModal(), StudioCommandBarProps, StudioSliderProps, StudioSwitchProps, StudioTooltip(), StudioTooltipProps, formatAudioTime() (+5 more)

### Community 16 - "overrides"
Cohesion: 0.17
Nodes (12): overrides, postcss, postcss-selector-parser, typescript-eslint, @typescript-eslint/ast-spec, @typescript-eslint/eslint-plugin, @typescript-eslint/parser, @typescript-eslint/type-utils (+4 more)

### Community 17 - "surah-cover.ts"
Cohesion: 0.12
Nodes (32): AiCoverRequestBody, maxDuration, POST(), runtime, AdminStudioSectionProps, StudioBackgroundPanelProps, StudioCoverGeneratorCard(), StudioCoverGeneratorCardProps (+24 more)

### Community 18 - "AppProvider.tsx"
Cohesion: 0.26
Nodes (12): ReaderSettingsPanelProps, RECITER_PICKER_TAB_VALUES, ReciterPickerModalProps, RECITERS, ReciterOption, stripArabicDiacritics(), filterAndSortReciters(), getReaderPlaybackAudioUrl() (+4 more)

### Community 19 - "utils.ts"
Cohesion: 0.33
Nodes (4): clsx@^2.1.1, tailwind-merge@^3.3.1, clsx, tailwind-merge

### Community 20 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, clean, dev, lint, start

### Community 21 - "allowScripts"
Cohesion: 0.40
Nodes (5): allowScripts, @google/genai@2.32.0, protobufjs@7.6.6, re2@1.27.2, @tailwindcss/oxide@4.1.11

### Community 27 - "studio-renderer.ts"
Cohesion: 0.06
Nodes (82): revalidate, revalidate, LABEL_POSITION_OPTIONS, META_WEIGHT_OPTIONS, StudioTextPanelProps, VERSE_WEIGHT_OPTIONS, HARMONIZED_PRESETS, AYAH_MEDALLION_OPTIONS (+74 more)

### Community 28 - "QuranIndexView.tsx"
Cohesion: 0.17
Nodes (15): QuranIndexPage(), SearchPage(), MAIN_SECTION_VALUES, PLACE_TAB_VALUES, PLACE_TABS, QuranIndexView(), RECITER_TAB_VALUES, QUICK_TERMS (+7 more)

### Community 29 - "reciter-health.ts"
Cohesion: 0.11
Nodes (25): RFC-9110, buildSrtDownloadFilename(), ByteRangeParseResult, parseByteRangeHeader(), resolveExportDownloadDisposition(), checkAllRecitersHealth(), worker(), getReciterProbeUrl() (+17 more)

### Community 30 - "quran-utils.ts"
Cohesion: 0.19
Nodes (14): RECITER_FILTER_TABS, ReciterFilter, StudioRecitationPanelProps, TEXT_SOURCE_OPTIONS, DEFAULT_TRANSLATION_ID, TRANSLATIONS, TextSourceMode, ARABIC_DIGITS (+6 more)

### Community 31 - "HomeView.tsx"
Cohesion: 0.29
Nodes (9): HomePage(), HomeView(), PLACE_FILTER_TABS, PLACE_FILTER_VALUES, StudioTabsRoot(), filterChapters(), pickVerseOfDay(), LastReadInfo (+1 more)

## Knowledge Gaps
- **2 isolated node(s):** `next`, `RFC-9110`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 206 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `toArabicDigits` to `export-job-manager.ts`, `storage.ts`, `audio-cache.ts`, `StudioDesignInspector.tsx`, `StudioView.tsx`, `dependencies`, `package.json`, `react`, `template-share.ts`, `surah-cover.ts`, `AppProvider.tsx`, `studio-renderer.ts`, `QuranIndexView.tsx`, `quran-utils.ts`, `HomeView.tsx`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **What connects `next`, `RFC-9110` to the rest of the system?**
  _2 weakly-connected nodes found - possible missing edges._
- **Should `export-job-manager.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05284147557328016 - nodes in this community are weakly interconnected._
- **Why does `toArabicDigits()` connect `toArabicDigits` to `export-job-manager.ts`, `storage.ts`, `audio-cache.ts`, `StudioDesignInspector.tsx`, `StudioView.tsx`, `template-share.ts`, `AppProvider.tsx`, `studio-renderer.ts`, `QuranIndexView.tsx`, `quran-utils.ts`, `HomeView.tsx`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `storage.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05860805860805861 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `toArabicDigits` to `export-job-manager.ts`, `storage.ts`, `audio-cache.ts`, `StudioDesignInspector.tsx`, `StudioView.tsx`, `dependencies`, `package.json`, `react`, `surah-cover.ts`, `AppProvider.tsx`, `studio-renderer.ts`, `QuranIndexView.tsx`, `quran-utils.ts`, `HomeView.tsx`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `audio-cache.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06698564593301436 - nodes in this community are weakly interconnected._