#!/usr/bin/env node
/**
 * Cross-platform production build — runs `next build` then copies
 * `.next/static` and `public/` into `.next/standalone/` so the standalone
 * server is fully self-contained. Replaces the Unix-only
 * `next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`
 * which fails on Windows (`cp` is not available in cmd.exe).
 *
 * Works with `bun run build`, `npm run build`, and `node scripts/build.mjs`.
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const nextDir = join(projectRoot, '.next');
const standaloneDir = join(nextDir, 'standalone');

const isWin = process.platform === 'win32';
const binDir = join(projectRoot, 'node_modules', '.bin');
const childEnv = {
  ...process.env,
  PATH: `${binDir}${isWin ? ';' : ':'}${process.env.PATH || process.env.Path || ''}`,
};
const nextBin = join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

function log(msg) {
  console.log(`[build] ${msg}`);
}

// 1) next build
log('Running next build...');
const buildExit = await new Promise((resolveBuild) => {
  const child = spawn(process.execPath, [nextBin, 'build'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: childEnv,
  });
  child.on('close', (code) => resolveBuild(code ?? 0));
});
if (buildExit !== 0) {
  console.error(`[build] next build failed with exit code ${buildExit}`);
  process.exit(buildExit);
}

// 2) Copy .next/static → .next/standalone/.next/static
const staticSrc = join(nextDir, 'static');
const staticDst = join(standaloneDir, '.next', 'static');
if (existsSync(staticSrc)) {
  mkdirSync(join(standaloneDir, '.next'), { recursive: true });
  log(`Copying .next/static -> .next/standalone/.next/static`);
  cpSync(staticSrc, staticDst, { recursive: true });
} else {
  log('WARNING: .next/static not found — skipping copy.');
}

// 3) Copy public → .next/standalone/public
const publicSrc = join(projectRoot, 'public');
const publicDst = join(standaloneDir, 'public');
if (existsSync(publicSrc)) {
  log('Copying public -> .next/standalone/public');
  cpSync(publicSrc, publicDst, { recursive: true });
}

log('Build complete.');
