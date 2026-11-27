/**
 * Diagnose: run the xfade-engine branch (4 slides + fade + ambient + backdrop,
 * no karaoke) through the LIVE server with real fixtures, capturing the exact
 * FFmpeg argv the server spawns (via a PATH-shim wrapper) to verify whether
 * the running server picked up the yuva420p fix.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, cpSync, chmodSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const WORK = '/tmp/e2e-xfade-diag';
const SRC = '/tmp/repro-job';

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

console.log('[1] create session: 4 slides, fade, gold-dust ambient, 1080p, NO karaoke (xfade engine)...');
const meta = {
  surahId: 1, surahName: 'الفاتحة', fromAyah: 1, toAyah: 3,
  reciter: 'alafasy', reciterName: 'test',
  verseIds: [1, 2, 3],
  verseTexts: ['a', 'b', 'c'],
  slideCount: 4,
  baseWidth: 1080, baseHeight: 1920,
  hasCustomAudio: false, hasBgVideo: false, bgBlur: 0, bgVideoSpeed: 1,
  format: 'mp4', resolution: '1080p', fps: 30, quality: 'balanced',
  transition: 'fade', transitionDurationMs: 500,
  audioPreset: 'natural', ambientSound: 'none', ambientVolume: 0.16,
  ambient: 'gold-dust', audioBitrate: 128, audioFade: false, verseGapSec: 0,
  includeIntroCover: true, introCoverDurationSec: 2.5,
};
const sessionRes = await fetch(`${BASE}/api/studio/export/session`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta),
});
const { jobId } = await sessionRes.json();

console.log('[2] upload backdrop + ambient + 4 slides...');
async function put(form: FormData) {
  const res = await fetch(`${BASE}/api/studio/export/session?id=${jobId}`, { method: 'PUT', body: form });
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
}
const setupForm = new FormData();
setupForm.append('backdrop', new Blob([readFileSync(`${SRC}/backdrop.png`)], { type: 'image/png' }), 'backdrop.png');
for (let i = 0; i < 96; i++) {
  const key = `ambient_${String(i).padStart(3, '0')}`;
  setupForm.append(key, new Blob([readFileSync(`${SRC}/${key}.png`)], { type: 'image/png' }), `${key}.png`);
}
await put(setupForm);
const slideForm = new FormData();
for (let i = 0; i < 4; i++) {
  slideForm.append(`slide_${i}`, new Blob([readFileSync(`${SRC}/slide_${i}.png`)], { type: 'image/png' }), `slide_${i}.png`);
}
await put(slideForm);

console.log('[3] PATCH to start + poll (this is the OOM-repro branch)...');
await fetch(`${BASE}/api/studio/export/session?id=${jobId}`, { method: 'PATCH' });
let status: any = null;
const t0 = Date.now();
for (let i = 0; i < 240; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const res = await fetch(`${BASE}/api/studio/export/session?id=${jobId}`);
  status = await res.json();
  if (i % 5 === 0 || status.status?.stage === 'done' || status.status?.stage === 'error') {
    console.log(`   [${i}s] ${status.status?.stage} ${status.status?.progressPct}%`);
  }
  if (status.status?.stage === 'done' || status.status?.stage === 'error') break;
}
if (status?.status?.stage === 'done') {
  console.log('   ✓ XFADE BRANCH PASSED:', JSON.stringify(status.status.result));
} else {
  console.log('   ✗ XFADE BRANCH FAILED:', status.status?.error);
  process.exit(1);
}
process.exit(0);
