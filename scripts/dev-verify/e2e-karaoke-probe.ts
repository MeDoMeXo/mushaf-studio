/**
 * E2E probe — drives the REAL export pipeline over HTTP against the live dev
 * server, simulating exactly what StudioExportModal does for a karaoke
 * (word-tracking) export with an animated ambient background.
 *
 * Steps:
 *  1. POST /api/studio/export/session   (meta with wordTimeline + ambient=stars)
 *  2. PUT backdrop.png + 96 ambient frames + word slides (transparent PNGs
 *     where the "active word" bar moves — mimicking wordHighlight tracking)
 *  3. PATCH to start rendering, poll GET until done
 *  4. Download output.mp4 and prove BOTH:
 *     a) the ambient background ANIMATES (pixel diffs in text-free region)
 *     b) the word-tracking highlight MOVES between consecutive word slides
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const WORK = '/tmp/e2e-karaoke-probe';
const FFMPEG = '/usr/bin/ffmpeg';
const FFPROBE = '/usr/bin/ffprobe';

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

// ---------- fixtures via PIL ----------
console.log('[1] building client-like fixtures (word slides + ambient frames + backdrop)...');
const W = 540, H = 960;
const py = `
from PIL import Image, ImageDraw
import math, random
W, H = ${W}, ${H}
# backdrop: gradient only (NO ambient — client excludes it when animated)
bd = Image.new('RGB', (W, H))
d = ImageDraw.Draw(bd)
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=(int(18+28*t), int(38+22*t), int(58+18*t)))
bd.save('${WORK}/backdrop.png')

# 12 word slides: transparent, full "verse" text as 12 bars laid out RTL in one
# line; the highlighted (active) word bar moves one step per slide — exactly
# what wordHighlight tracking produces. Highlight = golden block behind word.
words = 12
gap = 8
bar_w = (W - 2*40 - gap*(words-1)) / words
random.seed(11)
for s in range(words):
    im = Image.new('RGBA', (W, H), (0,0,0,0))
    dd = ImageDraw.Draw(im)
    # all words (soft cream), RTL: word 0 at right
    for i in range(words):
        x_right = W - 40 - i*(bar_w+gap)
        x_left = x_right - bar_w
        yy = 440
        dd.rectangle([x_left, yy, x_right, yy+70], fill=(250,246,236,235))
    # active word highlighted in gold (word index == slide index)
    ai = s
    x_right = W - 40 - ai*(bar_w+gap)
    x_left = x_right - bar_w
    dd.rectangle([x_left-6, 430, x_right+6, 520], fill=(201,162,39,255))
    im.save(f'${WORK}/slide_{s}.png')

# 96 stars ambient frames (same math shape as STAR_SEED twinkle)
stars = [(random.random(), random.random(), 0.4+random.random()*1.4, random.random()*6.28) for _ in range(40)]
for f in range(96):
    t = f / 96 * 8
    im = Image.new('RGBA', (W, H), (0,0,0,0))
    dd = ImageDraw.Draw(im)
    for (x, y, spd, ph) in stars:
        tw = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(t * spd * 1.8 + ph))
        r = 2.5
        a = int(tw * 0.72 * 255)
        dd.ellipse([x*W-r, y*H-r, x*W+r, y*H+r], fill=(245,248,255,a))
    im.save(f'${WORK}/ambient_{f:03d}.png')
print('fixtures done')
`;
execFileSync('python3', ['-c', py], { stdio: 'inherit' });

// ---------- karaoke word timeline like buildKaraokeExportPlan ----------
console.log('[2] creating export session with wordTimeline (karaoke)...');
const wordsCount = 12;
const wordTimeline = Array.from({ length: wordsCount }, (_, i) => ({
  verseIdx: 0,
  wordIdx: i,
  weight: 1 + (i % 3) * 0.4,
}));
const meta = {
  surahId: 1,
  surahName: 'الفاتحة',
  fromAyah: 1,
  toAyah: 1,
  reciter: 'alafasy',
  reciterName: 'مشاري العفاسي',
  verseIds: [1],
  verseTexts: ['بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'],
  wordTimeline,
  slideCount: wordsCount,
  baseWidth: 540,
  baseHeight: 960,
  hasBgVideo: false,
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
if (!sessionRes.ok) {
  throw new Error(`session create failed: ${sessionRes.status} ${await sessionRes.text()}`);
}
const { jobId } = await sessionRes.json();
console.log('   jobId:', jobId);

// ---------- upload assets ----------
console.log('[3] uploading backdrop + ambient frames + word slides...');
async function put(form: FormData) {
  const res = await fetch(`${BASE}/api/studio/export/session?id=${jobId}`, {
    method: 'PUT',
    body: form,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// backdrop + ambient in one bounded form
const setupForm = new FormData();
setupForm.append(
  'backdrop',
  new Blob([readFileSync(`${WORK}/backdrop.png`)], { type: 'image/png' }),
  'backdrop.png'
);
for (let i = 0; i < 96; i++) {
  const key = `ambient_${String(i).padStart(3, '0')}`;
  setupForm.append(
    key,
    new Blob([readFileSync(`${WORK}/${key}.png`)], { type: 'image/png' }),
    `${key}.png`
  );
}
await put(setupForm);

// word slides in a batch
const slideForm = new FormData();
for (let i = 0; i < wordsCount; i++) {
  slideForm.append(
    `slide_${i}`,
    new Blob([readFileSync(`${WORK}/slide_${i}.png`)], { type: 'image/png' }),
    `slide_${i}.png`
  );
}
await put(slideForm);

// ---------- start + poll ----------
console.log('[4] starting render and polling...');
const startRes = await fetch(`${BASE}/api/studio/export/session?id=${jobId}`, { method: 'PATCH' });
if (!startRes.ok) throw new Error(`start failed: ${startRes.status} ${await startRes.text()}`);
let status: any = null;
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const res = await fetch(`${BASE}/api/studio/export/session?id=${jobId}`);
  status = await res.json();
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  process.stdout.write(`   [${i}s] ${status.status?.stage} ${status.status?.progressPct}% — ${status.status?.stageLabel}\r\n`);
  if (status.status?.stage === 'done' || status.status?.stage === 'error') break;
}
if (status?.status?.stage !== 'done') {
  throw new Error(`render did not finish: ${JSON.stringify(status)}`);
}
console.log('   ✓ render done:', JSON.stringify(status.status.result));

// ---------- download ----------
console.log('[5] downloading output...');
const dl = await fetch(`${BASE}/api/studio/export/download?id=${jobId}`);
if (!dl.ok) throw new Error(`download failed: ${dl.status}`);
const videoBuf = Buffer.from(await dl.arrayBuffer());
const outPath = path.join(WORK, 'output.mp4');
writeFileSync(outPath, videoBuf);
console.log(`   saved ${outPath} (${(videoBuf.length / 1024).toFixed(0)} KB)`);

// ---------- PROOF ----------
console.log('[6] proving ambient animation + word highlight movement...');
// Frames early in word-1 slide vs late (different word slides, ~1s apart)
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '0.7', '-i', outPath, '-frames:v', '1', `${WORK}/f1.png`]);
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '2.7', '-i', outPath, '-frames:v', '1', `${WORK}/f2.png`]);
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '0.25', '-i', outPath, '-frames:v', '1', `${WORK}/f1b.png`]);

const proof = execFileSync('python3', ['-c', `
from PIL import Image, ImageChops
def diffcount(a_path, b_path, box):
    a = Image.open(a_path).convert('RGB').crop(box)
    b = Image.open(b_path).convert('RGB').crop(box)
    d = ImageChops.difference(a, b)
    return sum(1 for p in d.getdata() if p != (0, 0, 0))

W, H = ${W}, ${H}
# 1) ambient animation in TEXT-FREE top region (slides only paint y=430..520)
amb = diffcount('${WORK}/f1.png', '${WORK}/f2.png', (0, 0, W, 380))
print(f'ambient region pixels changed (t=0.7 vs t=2.7): {amb}')
assert amb > 50, 'AMBIENT FROZEN — background effects missing in export'

# 2) word highlight movement: gold block is at different x across word slides.
# Compare the text band y=400..540 between two different word slides.
band = diffcount('${WORK}/f1.png', '${WORK}/f2.png', (0, 400, W, 540))
print(f'text band pixels changed (word tracking): {band}')
assert band > 500, 'WORD HIGHLIGHT FROZEN — karaoke slides identical (static images bug)'

# 3) same-slide ambient still moves (0.25s apart within one word slide)
same = diffcount('${WORK}/f1b.png', '${WORK}/f1.png', (0, 0, W, 380))
print(f'same-word-slide ambient delta (0.45s apart): {same}')
assert same > 10, 'AMBIENT FROZEN WITHIN SINGLE SLIDE'
print('PROOF_OK: ambient animates AND word highlight advances')
`], { stdio: 'inherit' });

console.log('\nE2E KARAOKE PROBE PASSED ✅');
process.exit(0);
