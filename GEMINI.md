# Mushaf Studio — Project Memory & Agent Rules

@./.agents/skills/using-superpowers/SKILL.md
@./.agents/skills/using-superpowers/references/antigravity-tools.md

> [!IMPORTANT]
> **MANDATORY INVARIANT — ZERO ACTIONS WITHOUT SUPERPOWERS (15 SKILLS) & GRAPHIFY:**
> Under NO circumstances may the agent perform any coding, file modifications, architectural changes, debugging, or task completion without explicitly invoking and following the 15 Superpowers skills architecture (`.agents/skills/`) combined with Graphify architectural knowledge analysis (`graphify-out/`).
> Full architectural specification: [`doc/12-superpowers-agentic-architecture.md`](./doc/12-superpowers-agentic-architecture.md).

## 1. Core Operating Methodology (Superpowers)
This project adheres strictly to the software development methodology established by **obra/superpowers**:

- **Invoke Skills Before Action:** If a situation matches an available skill, invoke that skill before writing code, proposing solutions, or making arbitrary edits.
- **Brainstorming First:** Before creating new features, architectural changes, or refactoring, brainstorm and clarify specifications in bite-sized chunks with the user (`superpowers:brainstorming`).
- **Atomic Implementation Plans:** Structure complex work into bite-sized, verify-as-you-go task plans (`superpowers:writing-plans`).
- **Test-Driven Development (TDD):** Follow strict Red-Green-Refactor discipline. Write failing tests before modifying or adding production code (`superpowers:test-driven-development`). Run tests with `bun test`.
- **Systematic Debugging:** When encountering errors, follow the 4-phase root cause analysis: Reproduce → Isolate → Understand Cause → Fix & Verify. Never apply speculative trial-and-error fixes (`superpowers:systematic-debugging`).
- **Verification Before Completion:** Always verify functionality end-to-end, run unit tests, and check types before declaring a task complete (`superpowers:verification-before-completion`).

---

## 2. Project Architecture & Standards

### Technology Stack
- **Framework:** Next.js 15 (App Router, standalone output), React 19, TypeScript 5.9.
- **Styling:** Tailwind CSS 4.x with PostCSS and Typography plugin.
- **Runtime & Package Manager:** Bun 1.4+ (default and preferred), with Node.js fallback.
- **Media Pipeline:** FFmpeg 9.1 & FFprobe for audio probing, background video compositing, and verse-by-verse slide rendering.

### Critical Invariants & Rules
1. **600-Line File Rule:** No single source file (`app/`, `components/`, `lib/`, `hooks/`) may exceed 600 lines. Run `bun run scripts/check-file-size.ts` to ensure compliance.
2. **Arabic & Typography Integrity:**
   - Mushaf verses must preserve full authentic Uthmani calligraphy and diacritics.
   - Digits in Quranic contexts must use Arabic-Indic numerals via `toArabicDigits()`.
   - Layout is strictly Right-to-Left (RTL) for all Arabic reader views and UI components.
3. **FFmpeg & Audio Pipeline:**
   - Always use `resolveFfmpegPath()` and `resolveFfprobePath()` from `lib/export-job-helpers.ts` to support both Windows WinGet paths and POSIX systems.
   - Verse audio fetching must respect the local audio cache (`lib/server-audio-cache.ts`) and upstream rate limits.
4. **Security & CSP:**
   - Next.js CSP in `next.config.ts` must keep `default-src 'self'`, and allow safe domains (`everyayah.com` for audio/media, `unpkg.com` for local graphify tools).

---

## 3. Graphify Knowledge Architecture & Impact Protocol
Graphify serves as the project's architectural radar:
- **Corpus & Topology:** 867 nodes, 2669 edges, 32 communities, 0 import cycles.
- **God Nodes (Impact Alert):** Special care and impact checks are required before modifying core abstractions:
  - `toArabicDigits()` (54 edges)
  - `StudioState` (39 edges)
  - `StudioView()` (28 edges)
  - `runExportPipeline()` (46 edges across export routes)
  - `RECITERS` (22 edges)
- **Blast Radius Analysis:** Before changing any central module, verify affected files via [`graphify-out/GRAPH_REPORT.md`](file:///c:/Users/PC/Desktop/quran/graphify-out/GRAPH_REPORT.md) or the interactive graph at [http://localhost:3000/graphify/graph.html](http://localhost:3000/graphify/graph.html).

---

## 4. Installed Skills Directory
The following skills are installed and linked in `.agents/skills/`:
- `using-superpowers`: Meta-skill for skill discovery and enforcement.
- `brainstorming`: Socratic design exploration and spec drafting.
- `writing-plans`: Step-by-step implementation plan drafting.
- `executing-plans`: Systematic execution of approved plans.
- `test-driven-development`: Red-Green-Refactor testing workflows.
- `systematic-debugging`: 4-phase root cause analysis for bug fixing.
- `verification-before-completion`: Pre-completion verification protocol.
- `subagent-driven-development`: Isolated subagent task execution.
- `requesting-code-review` & `receiving-code-review`: Peer review standards.
- `finishing-a-development-branch`: Clean merging and branch conclusion.
- `using-git-worktrees`: Clean parallel worktree isolation.
- `dispatching-parallel-agents`: Multi-agent orchestration.
- `writing-skills`: Authoring and pressure-testing agent skills.
- `diagnosing-superpowers`: Troubleshooting skill setups.
