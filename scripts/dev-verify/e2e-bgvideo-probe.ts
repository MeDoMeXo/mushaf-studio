/**
 * E2E probe 2 — bg-library video background + karaoke word slides + ambient
 * overlay through the REAL pipeline. Proves the video background ANIMATES in
 * the exported file (frames differ over time in text-free regions).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const WORK = '/tmp/e2e-bgvideo-probe';
const FFMPEG = '/usr/bin/ffmpeg';

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

console.log('[1] building word slides (transparent) ...');
const W = 540, H = 960;
const py = `
from PIL import Image, ImageDraw
W, H = ${W}, ${H}
words = 8
gap = 8
bar_w = (W - 2*40 - gap*(words-1)) / words
for s in range(words):
    im = Image.new('RGBA', (W, H), (0,0,0,0))
    dd = ImageDraw.Draw(im)
    for i in range(words):
        x_right = W - 40 - i*(bar_w+gap)
        x_left = x_right - bar_w
        dd.rectangle([x_left, 440, x_right, 510], fill=(250,246,236,235))
    ai = s
    x_right = W - 40 - ai*(bar_w+gap)
    x_left = x_right - bar_w
    dd.rectangle([x_left-6, 430, x_right+6, 520], fill=(201,162,39,255))
    im.save(f'${WORK}/slide_{s}.png')
print('slides done')
`;
execFileSync('python3', ['-c', py], { stdio: 'inherit' });

console.log('[2] creating session with bgLibraryId + wordTimeline + ambient=stars...');
const wordsCount = 8;
const meta = {
  surahId: 1,
  surahName: 'الفاتحة',
  fromAyah: 1,
  toAyah: 1,
  reciter: 'alafasy',
  reciterName: 'مشاري العفاسي',
  verseIds: [1],
  verseTexts: ['بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'],
  wordTimeline: Array.from({ length: wordsCount }, (_, i) => ({
    verseIdx: 0, wordIdx: i, weight: 1 + (i % 3) * 0.4,
  })),
  slideCount: wordsCount,
  baseWidth: 540,
  baseHeight: 960,
  hasBgVideo: true,
  bgLibraryId: 'islamic-1-star-rotate',
  ambient: 'stars',
  bgBlur: 0,
  bgVideoSpeed: 1,
  format: 'mp4',
  resolution: '720p',
  fps: 30,
  quality: 'balanced',
  transition: 'fade',
  transitionDurationMs: 500,
  audioPreset: 'natural',
  ambientSound: 'none',
  ambientVolume: 0.16,
  audioBitrate: 128,
  audioFade: false,
  verseGapSec: 0,
  includeIntroCover: false,
};

const sessionRes = await fetch(`${BASE}/api/studio/export/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(meta),
});
if (!sessionRes.ok) throw new Error(`session failed: ${sessionRes.status} ${await sessionRes.text()}`);
const { jobId } = await sessionRes.json();
console.log('   jobId:', jobId);

// Upload ONLY slides — with a library bg the server copies bg_video.bin itself
// and there is no backdrop.png (hasBgVideo → no backdrop) and ambient frames
// come from the client... BUT does the client actually upload ambient frames
// when hasBgVideo? (uploadExportSetupAssets is called with ambientFrames
// regardless — see export-pipeline.ts. But backdropBlob is null.) Here we
// replicate: ambient frames uploaded, no backdrop, no overlay (client sends
// overlay.png via renderVideoOverlayCanvas — simulate a minimal transparent one).
console.log('[3] uploading ambient frames + overlay + slides...');
async function put(form: FormData) {
  const res = await fetch(`${BASE}/api/studio/export/session?id=${jobId}`, { method: 'PUT', body: form });
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// minimal ambient frames (few star dots) — 96 frames
const pyAmb = `
from PIL import Image, ImageDraw
import math, random
W, H = 540, 960
random.seed(3)
stars = [(random.random(), random.random(), 0.4+random.random()*1.4, random.random()*6.28) for _ in range(25)]
for f in range(96):
    t = f / 96 * 8
    im = Image.new('RGBA', (W, H), (0,0,0,0))
    dd = ImageDraw.Draw(im)
    for (x, y, spd, ph) in stars:
        tw = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(t * spd * 1.8 + ph))
        a = int(tw * 0.7 * 255)
        dd.ellipse([x*W-2.5, y*H-2.5, x*W+2.5, y*H+2.5], fill=(245,248,255,a))
    im.save(f'/tmp/e2e-bgvideo-probe/ambient_{f:03d}.png')
print('ambient frames done')
`;
execFileSync('python3', ['-c', pyAmb], { stdio: 'inherit' });

const pyOverlay = `
from PIL import Image, ImageDraw
W, H = 540, 960
im = Image.new('RGBA', (W, H), (0,0,0,0))
d = ImageDraw.Draw(im)
# thin golden frame border (ornament overlay stand-in)
d.rectangle([12, 12, W-12, H-12], outline=(201,162,39,200), width=6)
im.save('/tmp/e2e-bgvideo-probe/overlay.png')
print('overlay done')
`;
execFileSync('python3', ['-c', pyOverlay], { stdio: 'inherit' });

const setupForm = new FormData();
for (let i = 0; i < 96; i++) {
  const key = `ambient_${String(i).padStart(3, '0')}`;
  setupForm.append(key, new Blob([readFileSync(`${WORK}/${key}.png`)], { type: 'image/png' }), `${key}.png`);
}
setupForm.append('overlay', new Blob([readFileSync(`${WORK}/overlay.png`)], { type: 'image/png' }), 'overlay.png');
await put(setupForm);

const slideForm = new FormData();
for (let i = 0; i < wordsCount; i++) {
  slideForm.append(`slide_${i}`, new Blob([readFileSync(`${WORK}/slide_${i}.png`)], { type: 'image/png' }), `slide_${i}.png`);
}
await put(slideForm);

console.log('[4] starting render + polling...');
const startRes = await fetch(`${BASE}/api/studio/export/session?id=${jobId}`, { method: 'PATCH' });
if (!startRes.ok) throw new Error(`start failed: ${startRes.status} ${await startRes.text()}`);
let status: any = null;
for (let i = 0; i < 180; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const res = await fetch(`${BASE}/api/studio/export/session?id=${jobId}`);
  status = await res.json();
  process.stdout.write(`   [${i}s] ${status.status?.stage} ${status.status?.progressPct}% — ${status.status?.stageLabel}\n`);
  if (status.status?.stage === 'done' || status.status?.stage === 'error') break;
}
if (status?.status?.stage !== 'done') {
  throw new Error(`render failed: ${JSON.stringify(status)}`);
}
console.log('   ✓ done:', JSON.stringify(status.status.result));

console.log('[5] downloading...');
const dl = await fetch(`${BASE}/api/studio/export/download?id=${jobId}`);
if (!dl.ok) throw new Error(`download failed: ${dl.status}`);
const videoBuf = Buffer.from(await dl.arrayBuffer());
const outPath = path.join(WORK, 'output.mp4');
writeFileSync(outPath, videoBuf);
console.log(`   saved ${outPath} (${(videoBuf.length / 1024).toFixed(0)} KB)`);

console.log('[6] proving bg video animation + word tracking...');
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '0.7', '-i', outPath, '-frames:v', '1', `${WORK}/f1.png`]);
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '2.7', '-i', outPath, '-frames:v', '1', `${WORK}/f2.png`]);

const proof = execFileSync('python3', ['-c', `
from PIL import Image, ImageChops
def diffcount(a, b, box):
    A = Image.open(a).convert('RGB').crop(box)
    B = Image.open(b).convert('RGB').crop(box)
    d = ImageChops.difference(A, B)
    return sum(1 for p in d.getdata() if p != (0,0,0))
bg = diffcount('${WORK}/f1.png', '${WORK}/f2.png', (30, 30, 510, 380))
print(f'bg-video region changed: {bg}')
assert bg > 200, 'BG VIDEO FROZEN — background static in export'
band = diffcount('${WORK}/f1.png', '${WORK}/f2.png', (0, 400, 540, 540))
print(f'word band changed: {band}')
assert band > 300, 'WORD TRACKING FROZEN'
print('PROOF_OK: bg video animates + word tracking advances')
`], { stdio: 'inherit' });

console.log('\nE2E BG-VIDEO PROBE PASSED ✅');
process.exit(0);
