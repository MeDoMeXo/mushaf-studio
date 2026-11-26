#!/usr/bin/env node
/**
 * Cross-platform production server launcher — starts the Next.js standalone
 * server with NODE_ENV=production and mirrors output to server.log. Replaces
 * the Unix-only `NODE_ENV=production bun .next/standalone/server.js | tee server.log`
 * which fails on Windows (env-var prefix syntax + `tee` unavailable).
 *
 * Works with `bun run start`, `npm run start`, and `node scripts/start.mjs`.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const serverPath = join(projectRoot, '.next', 'standalone', 'server.js');
const logPath = join(projectRoot, 'server.log');

if (!existsSync(serverPath)) {
  console.error(
    '[start] .next/standalone/server.js not found — run `npm run build` (or `bun run build`) first.'
  );
  process.exit(1);
}

const log = createWriteStream(logPath, { flags: 'w' });

// Prefer bun if available (faster startup), otherwise node.
const isWin = process.platform === 'win32';
const bunPath = join(process.env.USERPROFILE || '', '.bun', 'bin', `bun${isWin ? '.exe' : ''}`);
const useBun = existsSync(bunPath) || process.env.BUN_INSTALL !== undefined;

const child = spawn(process.execPath, [serverPath], {
  cwd: join(projectRoot, '.next', 'standalone'),
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production' },
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
  const msg = `Failed to start server: ${err.message}\n`;
  process.stderr.write(msg);
  log.write(msg);
  process.exit(1);
});

child.on('close', (code) => {
  log.end();
  process.exit(code ?? 0);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
