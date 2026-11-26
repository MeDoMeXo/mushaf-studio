#!/usr/bin/env node
/**
 * Cross-platform dev launcher — runs `next dev -p 3000` and mirrors all
 * output to both the terminal and dev.log. Replaces the Unix-only
 * `next dev -p 3000 2>&1 | tee dev.log` which fails on Windows (`tee`
 * is not available in cmd.exe / PowerShell).
 *
 * Works with both `bun run dev` and `npm run dev` on Windows, macOS, Linux.
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const logPath = join(projectRoot, 'dev.log');

const log = createWriteStream(logPath, { flags: 'w' });

const isWin = process.platform === 'win32';
// Prepend node_modules/.bin to PATH so the `next` CLI is resolvable on every
// platform & launcher (bun, npm, direct `node scripts/dev.mjs`).
const binDir = join(projectRoot, 'node_modules', '.bin');
const childEnv = {
  ...process.env,
  FORCE_COLOR: '1',
  PATH: `${binDir}${isWin ? ';' : ':'}${process.env.PATH || process.env.Path || ''}`,
};

// Resolve the next CLI entry directly to avoid shell-escaping pitfalls.
const nextBin = join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn(process.execPath, [nextBin, 'dev', '-p', '3000'], {
  cwd: projectRoot,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: childEnv,
});

function pipe(stream, target) {
  stream.on('data', (chunk) => {
    target.write(chunk);
    log.write(chunk);
  });
}

pipe(child.stdout, process.stdout);
pipe(child.stderr, process.stderr);

child.on('error', (err) => {
  const msg = `Failed to start next dev: ${err.message}\n`;
  process.stderr.write(msg);
  log.write(msg);
  process.exit(1);
});

child.on('close', (code) => {
  log.end();
  process.exit(code ?? 0);
});

// Forward interrupt/terminate signals so Ctrl+C stops next cleanly.
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
