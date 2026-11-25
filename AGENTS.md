# Mushaf Studio — Agent Instructions & Memory

> **قاعدة إلزامية صارمة (Mandatory Invariant):**
> يُحظر تماماً تنفيذ أي عمل أو تعديل أو استكشاف بدون استدعاء وتطبيق معمارية مهارات Superpowers الـ 15 المعتمدة مع مخطط المعرفة Graphify.
> التوثيق الكامل: [`doc/12-superpowers-agentic-architecture.md`](./doc/12-superpowers-agentic-architecture.md).

This repository uses **Superpowers** (`obra/superpowers`) methodology and **Graphify** knowledge architecture for software development.

## Active Rules & Skills
- **Skills Location:** `.agents/skills/`
- **Knowledge Graph:** `graphify-out/` (interactive live view: `http://localhost:3000/graphify/graph.html`)
- **Primary Instructions:** See `GEMINI.md`
- **Core Workflow:**
  1. Check for relevant skills in `.agents/skills/` before taking action.
  2. For architectural modifications: check Graphify dependency graph (`GRAPH_REPORT.md`) for blast radius analysis.
  3. For new features or architecture changes: use `brainstorming` followed by `writing-plans`.
  4. For coding: use `test-driven-development` (`bun test`).
  5. For debugging: use `systematic-debugging` (no trial-and-error edits).
  6. For completing tasks: use `verification-before-completion`.

## Project Rules
- Files must remain under 600 lines (`bun run scripts/check-file-size.ts`).
- Respect Uthmani calligraphy and RTL design.
- Audio/video rendering relies on FFmpeg/FFprobe via `resolveFfmpegPath()` and `resolveFfprobePath()`.
