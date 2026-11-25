#!/usr/bin/env tsx
/**
 * check-file-size.ts — enforces the project-wide 600-line file ceiling.
 *
 * Rule: no source file (ts/tsx, excluding declarations, generated code,
 * skills, node_modules, .next) may exceed 600 lines. Run in CI and locally:
 *   tsx scripts/check-file-size.ts
 * Exit code 1 with an offender list when any file breaks the rule.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_LINES = 600;
const ROOT = process.cwd();

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'skills',
  'agent-skills',
  'coverage',
]);

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name)) {
      out.push(full);
    }
  }
}

function countLines(file: string): number {
  const content = readFileSyncSafe(file);
  if (content === null) return 0;
  // `wc -l` counts newline characters; a trailing newline adds none — match it
  // exactly so the ceiling equals what developers see from `wc -l`.
  const nl = content.endsWith('\n') ? content.slice(0, -1).split('\n').length : content.split('\n').length;
  return nl;
}

function readFileSyncSafe(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

const files: string[] = [];
walk(ROOT, files);

const offenders: { file: string; lines: number }[] = [];
for (const f of files) {
  const lines = countLines(f);
  if (lines > MAX_LINES) {
    offenders.push({ file: f.replace(ROOT + '/', ''), lines });
  }
}

if (offenders.length > 0) {
  console.error(`✗ ${offenders.length} file(s) exceed the ${MAX_LINES}-line ceiling:`);
  for (const o of offenders.sort((a, b) => b.lines - a.lines)) {
    console.error(`  ${String(o.lines).padStart(5)}  ${o.file}`);
  }
  console.error('\nSplit the file (components/sections, hooks, or lib modules) so every file stays ≤ 600 lines.');
  process.exit(1);
}

console.log(`✓ all ${files.length} source files are within the ${MAX_LINES}-line ceiling`);
process.exit(0);
