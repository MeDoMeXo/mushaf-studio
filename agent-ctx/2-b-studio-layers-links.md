# Task 2-b — Unified Layers Panel + On-Video Links Manager

Agent: 2-b (layers/links agent) · Files owned: `components/studio-ui/StudioLayersPanel.tsx`, `components/studio-ui/StudioStagePanel.tsx` (nothing else touched).

## What was implemented

### 1. `components/studio-ui/StudioLayersPanel.tsx` — full implementation (stub replaced, ~483 lines)
Kept the exported component name `StudioLayersPanel` and props interface `{ state, onPatchState }` exactly as the stub had them, so `StudioDesignInspector`'s existing wiring (`<StudioLayersPanel state={state} onPatchState={onPatchState} />` inside the "الطبقات" tab) works unchanged.

**Section 1 — «مصفوفة الطبقات»** (grouped StudioSwitch rows, bold label + tiny muted description per row, groups with `text-[11px] font-bold` gold `border-r-2` headers, hairline separators between groups):
- **النصوص**: «نص الآيات» (checked = `!state.hideVerses` → `{ hideVerses: !next }`, description «إخفاؤه ينتج فيديو صوتيًا مع الخلفية والزخارف»), «الترجمة» (checked = textSource 'both'|'translation' → on: uthmani→'both' keep others; off→'uthmani'), «رقم الآية المزخرف» (simple `showAyahNumber`), «اسم السورة» (checked = `showFooter && surahPosition !== 'hidden'`; on: `{ showFooter: true, surahPosition: hidden→'top' }`; off: `{ showFooter: false, surahPosition: 'hidden' }`), «اسم القارئ» (same pattern with `showReciterFooter`/`reciterPosition`), «العلامة المائية» (checked = `showWatermark !== false`).
- **الزخارف**: «الإطار الذهبي» (goldFrame + frameStyle 'mushaf' fallback on / 'none' off — copied from StudioTextPanel), «زخارف الزوايا» (corners + cornerStyle 'rub_el_hizb' fallback), «نقاط التقدّم» (simple `showProgressDots`), «النمط الهندسي» (checked = `patternStyle !== 'none'`; on: none→'khatam8'; off→'none').
- **المشهد**: «الغلاف الافتتاحي» (simple `coverMode`), «الروابط فوق الفيديو» (checked = `showLinks !== false` + `countEnabledLinks` gold pill badge «n رابط ظاهر», hidden when 0), «تأثير الجو المحيط» (checked = `ambient !== 'none'`; on: none→'gold-dust'; off→'none').

**Section 2 — «الروابط فوق الفيديو»**: master StudioSwitch «إظهار الروابط» → `{ showLinks: next }`; empty-state dashed card («أضف رابطك الأول…» + 3 quick preset buttons from `INTERNAL_LINK_PRESETS` appending `createStudioLink({ kind:'internal', label, url, position:'bottom-left', style:'glass' })`); per-link compact editor cards (`rounded-xl border p-3 space-y-2`) with:
- Row 1: compact StudioSwitch (enabled, label «ظاهر») + label text input (flex-1) + Trash2 delete (hover red border/text).
- Row 2: url input (`dir="ltr"` text-left mono, h-8) + «داخلي»/«خارجي» kind segmented control (aria-pressed, TextPanel bordered-button pattern).
- Row 3: position select (`LINK_POSITION_OPTIONS`, h-8) + style select (`LINK_STYLE_OPTIONS`, h-8), labels «الموضع»/«المظهر».
- All edits immutable via `onPatchState({ links: links.map(l => l.id === id ? { ...l, ...patch } : l) })` (local `StudioLinkRow` subcomponent defined in the same file, per the ≤600-line fallback guidance).
- «إضافة رابط خارجي» dashed gold button (Plus icon) → `createStudioLink()` appended.
- Gold hint card with the exact spec text (drawn into exported video / click-to-open in preview / internal same-tab, external new-tab).
- Count footer: «n رابط · m ظاهر» via `countEnabledLinks(state)` (n = total).
- Extra UX nicety (not in spec, harmless): links list dims (`opacity-55`) when master `showLinks === false`.

Imports are exactly the allowed set: react, lucide-react (`Plus`, `Trash2`), types from `@/lib/quran-data`, `@/lib/studio-links` (countEnabledLinks / createStudioLink / INTERNAL_LINK_PRESETS / LINK_POSITION_OPTIONS / LINK_STYLE_OPTIONS), `./StudioControls` (StudioSwitch), `./StudioTabs` (StudioTabPanel). All design tokens (ink-primary, ink-muted, surface-subtle, surface-card, border-hairline, brand-gold) reused; RTL Arabic labels throughout; unique switch ids (`lyr-*`, `lyr-links-master`, `link-pos-<id>`, `link-style-<id>`) for a11y.

### 2. `components/studio-ui/StudioStagePanel.tsx` — canvas click-to-open links
- Added `import { hitTestLink, openStudioLink } from '@/lib/studio-links';`
- Added `onClick` + `onMouseMove` handlers on the existing `<canvas ref={canvasRef}>` exactly per spec (client→canvas coordinate mapping via `getBoundingClientRect` scaling; click hit-tests via `hitTestLink(state, x, y)` then `openStudioLink(link)`; mousemove sets `cursor: pointer|default`).
- **Integration note: the canvas had NO pre-existing onClick/onMouseMove/any event handlers** (verse navigation lives in the filmstrip/transport controls below the stage), so the handlers were added cleanly with zero conflict — nothing had to be merged or conditionally delegated. All existing canvas props (ref, all `data-*` attributes, `className="block h-full w-full"`) preserved untouched. The panel already received `state` in its props interface — no prop changes needed.

## Verification
- Read dev.log after finishing: latest compiles of `/studio` are green (`✓ Compiled`, `GET /studio 200`) — no compile errors from my files.
- A `TypeError: selectedVerses.length` runtime error appears in dev.log — it originates in `components/studio-ui/StudioTimingPanel.tsx:36` which is agent 2-c's file (mid-wiring), NOT my files.

## Boundaries respected
Only the two owned files were modified. No edits to StudioControls.tsx (selects/segmented controls defined locally in StudioLayersPanel.tsx), no renderer changes needed (parent already wired `drawLinksOverlay` into canvas rendering + export), no new packages, no tests, no git, no lint/dev-server runs.
