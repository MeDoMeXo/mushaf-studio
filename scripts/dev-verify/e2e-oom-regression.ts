/**
 * E2E probe 3 — replays the EXACT failed browser job (1080p karaoke + stars
 * ambient + backdrop, 11 slides) against the live dev server, after the
 * yuva420p OOM fix. This is the regression proof for the OOM bug.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const WORK = '/tmp/e2e-oom-regression';
const FFMPEG = '/usr/bin/ffmpeg';

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

// Reuse the real files from the failed job (backdrop 1080p, 96 ambient frames,
// 11 word slides) — exact same inputs the browser uploaded.
console.log('[1] copying real fixtures from the failed job...');
const SRC = '/tmp/repro-job';
for (const f of readFileSync(path.join(SRC, 'meta.json'), 'utf8') ? [] : []) void f;
cpSync(path.join(SRC, 'backdrop.png'), path.join(WORK, 'backdrop.png'));
for (let i = 0; i < 11; i++) {
  cpSync(path.join(SRC, `slide_${i}.png`), path.join(WORK, `slide_${i}.png`));
}
const meta = JSON.parse(readFileSync(path.join(SRC, 'meta.json'), 'utf8'));
console.log('   original meta: slideCount=%d ambient=%s fps=%d res=%s',
  meta.slideCount, meta.ambient, meta.fps, meta.resolution);

console.log('[2] creating session (same shape as the failed browser job)...');
const wordsCount = meta.wordTimeline.length; // 10 word slides + 1 intro cover
const sessionRes = await fetch(`${BASE}/api/studio/export/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...meta,
    verseIds: [1, 2, 3],
    // no browser-cache audio this time; server downloads from everyayah
  }),
});
if (!sessionRes.ok) throw new Error(`session failed: ${sessionRes.status} ${await sessionRes.text()}`);
const { jobId } = await sessionRes.json();

console.log('[3] uploading backdrop + ambient frames + word slides...');
async function put(form: FormData) {
  const res = await fetch(`${BASE}/api/studio/export/session?id=${jobId}`, { method: 'PUT', body: form });
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
  return res.json();
}
const setupForm = new FormData();
setupForm.append('backdrop', new Blob([readFileSync(`${WORK}/backdrop.png`)], { type: 'image/png' }), 'backdrop.png');
for (let i = 0; i < 96; i++) {
  cpSync(path.join(SRC, `ambient_${String(i).padStart(3, '0')}.png`), path.join(WORK, `a.png`));
  const key = `ambient_${String(i).padStart(3, '0')}`;
  setupForm.append(key, new Blob([readFileSync(path.join(SRC, `${key}.png`))], { type: 'image/png' }), `${key}.png`);
}
await put(setupForm);
const slideForm = new FormData();
for (let i = 0; i < meta.slideCount; i++) {
  slideForm.append(`slide_${i}`, new Blob([readFileSync(`${WORK}/slide_${i}.png`)], { type: 'image/png' }), `slide_${i}.png`);
}
await put(slideForm);

console.log('[4] starting render (1080p karaoke + stars) + polling...');
const t0 = Date.now();
const startRes = await fetch(`${BASE}/api/studio/export/session?id=${jobId}`, { method: 'PATCH' });
if (!startRes.ok) throw new Error(`start failed: ${startRes.status} ${await startRes.text()}`);
let status: any = null;
for (let i = 0; i < 240; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const res = await fetch(`${BASE}/api/studio/export/session?id=${jobId}`);
  status = await res.json();
  if (i % 5 === 0 || status.status?.stage === 'done' || status.status?.stage === 'error') {
    process.stdout.write(`   [${i}s] ${status.status?.stage} ${status.status?.progressPct}% — ${status.status?.stageLabel}\n`);
  }
  if (status.status?.stage === 'done' || status.status?.stage === 'error') break;
}
if (status?.status?.stage !== 'done') {
  throw new Error(`REGRESSION: render failed after fix: ${JSON.stringify(status?.status?.error)}`);
}
console.log('   ✓ RENDER DONE in', ((Date.now() - t0) / 1000).toFixed(1), 's:', JSON.stringify(status.status.result));

console.log('[5] downloading + proving motion...');
const dl = await fetch(`${BASE}/api/studio/export/download?id=${jobId}`);
if (!dl.ok) throw new Error(`download failed: ${dl.status}`);
const videoBuf = Buffer.from(await dl.arrayBuffer());
const outPath = path.join(WORK, 'output.mp4');
writeFileSync(outPath, videoBuf);
console.log(`   saved ${outPath} (${(videoBuf.length / 1024).toFixed(0)} KB)`);

execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '1.0', '-i', outPath, '-frames:v', '1', `${WORK}/f1.png`]);
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '4.0', '-i', outPath, '-frames:v', '1', `${WORK}/f2.png`]);
execFileSync('python3', ['-c', `
from PIL import Image, ImageChops
def diffcount(a, b, box):
    A = Image.open(a).convert('RGB').crop(box)
    B = Image.open(b).convert('RGB').crop(box)
    d = ImageChops.difference(A, B)
    return sum(1 for p in d.getdata() if p != (0,0,0))
amb = diffcount('${WORK}/f1.png', '${WORK}/f2.png', (0, 0, 1080, 400))
band = diffcount('${WORK}/f1.png', '${WORK}/f2.png', (0, 700, 1080, 1300))
print(f'1080p ambient region changed: {amb}')
print(f'1080p word band changed: {band}')
assert amb > 500, 'AMBIENT FROZEN AT 1080p'
assert band > 500, 'WORD TRACKING FROZEN AT 1080p'
print('OOM REGRESSION PASSED: 1080p karaoke + stars renders AND animates ✅')
`], { stdio: 'inherit' });

console.log('\nE2E OOM REGRESSION PROBE PASSED ✅');
process.exit(0);
