/**
 * End-to-end verification of the animated ambient export fix.
 *
 * Simulates the REAL server pipeline (lib/export-render-pipeline.ts engine
 * selection + exact FFmpeg argument shapes) against fixtures that mimic what
 * the client uploads: backdrop.png (no frozen ambient), transparent verse
 * slides, and the 96-frame ambient particle sequence / single aurora frame.
 *
 * Then extracts frames from the produced video and proves the background
 * region ANIMATES (pixel differences over time in text-free areas).
 *
 * Run: bun /home/z/my-project/scripts/dev-verify/e2e-ambient-export.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const WORK = '/tmp/e2e-ambient';
const FFMPEG = '/usr/bin/ffmpeg';
const FFPROBE = '/usr/bin/ffprobe';

// ---- Shared server-side helpers (the real production code) ----
import {
  buildAmbientOverlayFilters,
  resolveAmbientFrameSpecs,
} from '../../lib/video-export';
import { resolveAmbientLayer } from '../../lib/export-ambient-layer';
import { appendEncodeTail } from '../../lib/export-encode-args';
import { buildChainedXfadeFilters } from '../../lib/export-job-helpers';

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

// ---------- 1) Build client-like fixtures with PIL (no DOM needed) ----------
console.log('[1] building fixtures...');
const py = `
from PIL import Image, ImageDraw
import math
W, H = 540, 960
# backdrop.png: gradient + vignette-ish overlay, NO ambient effect
bd = Image.new('RGB', (W, H))
d = ImageDraw.Draw(bd)
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=(int(20+30*t), int(40+25*t), int(60+20*t)))
bd.save('${WORK}/backdrop.png')
# verse slides: TRANSPARENT with white "text" bar in the middle
for i in range(3):
    sl = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sl)
    ds.rectangle([90, 430 + i*10, W-90, 500 + i*10], fill=(255, 250, 240, 255))
    sl.save(f'${WORK}/slide_{i}.png')
# 96 ambient particle frames (stars): dot positions drift like STAR_SEED math
import random
random.seed(7)
stars = [(random.random(), random.random(), 0.4+random.random()*1.4, random.random()*6.28) for _ in range(40)]
FW, FH = 540, 960
for f in range(96):
    t = f / 96 * 8  # one 8s loop at 12fps
    im = Image.new('RGBA', (FW, FH), (0,0,0,0))
    dd = ImageDraw.Draw(im)
    for (x, y, spd, ph) in stars:
        tw = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(t * spd * 1.8 + ph))
        r = 2.5
        a = int(tw * 0.72 * 255)
        dd.ellipse([x*FW-r, y*FH-r, x*FW+r, y*FH+r], fill=(245,248,255,a))
    im.save(f'${WORK}/ambient_{f:03d}.png')
# aurora single wide frame (540*1.16=626 wide)
aw = Image.new('RGBA', (626, FH), (0,0,0,0))
da = ImageDraw.Draw(aw)
for x in range(626):
    dx = abs(x-313)/313
    a = int(56*(1-dx)**2)
    da.line([(x, 100), (x, FH)], fill=(68,178,152,max(0,a)))
aw.save('${WORK}/aurora_single.png')
print('fixtures done')
`;
execFileSync('python3', ['-c', py], { stdio: 'inherit' });

// ---------- 2) Drive the REAL production resolution code ----------
console.log('[2] resolving ambient layer through production code...');
const dir = WORK;
const filesInDir = readdirSync(dir);
const ambientSpec = resolveAmbientFrameSpecs('stars', 540, 960, 30);
if (!ambientSpec) throw new Error('FAIL: stars spec missing');
console.log('   stars spec:', ambientSpec.mode, ambientSpec.frameCount, '@', ambientSpec.fps, 'fps');

const layer = resolveAmbientLayer({
  ambientEffect: 'stars',
  hasBgVideoFile: false,
  jobDir: dir,
  filesInDir,
  width: 540,
  height: 960,
  effectiveFps: 30,
});
if (!layer.active || !layer.ambientFilters) throw new Error('FAIL: ambient layer inactive');
console.log('   inputArgs:', layer.inputArgs.join(' '));
console.log('   filters:', layer.ambientFilters.join(' ; '));

// aurora path
const auroraDir = `${WORK}-aurora`;
mkdirSync(auroraDir, { recursive: true });
execFileSync('cp', [`${WORK}/backdrop.png`, `${WORK}/slide_0.png`, `${WORK}/slide_1.png`, auroraDir]);
writeFileSync(path.join(auroraDir, 'ambient_000.png'), readFileSyncBuf(`${WORK}/aurora_single.png`));
const auroraLayer = resolveAmbientLayer({
  ambientEffect: 'aurora',
  hasBgVideoFile: false,
  jobDir: auroraDir,
  filesInDir: readdirSync(auroraDir),
  width: 540,
  height: 960,
  effectiveFps: 30,
});
if (!auroraLayer.active) throw new Error('FAIL: aurora layer inactive');
console.log('   aurora filters:', auroraLayer.ambientFilters!.join(' ; '));

// ---------- 3) Build engine-2 command (xfade + backdrop + ambient) ----------
console.log('[3] building FFmpeg command exactly like engine (backdrop+xfade+ambient)...');
const width = 540, height = 960, effectiveFps = 30;
const normalizedDurs = [2.0, 2.0, 2.0];
const transDur = 0.5;
const videoArgs: string[] = ['-y'];
videoArgs.push('-loop', '1', '-framerate', String(effectiveFps), '-t', '7.5', '-i', `${dir}/backdrop.png`);
videoArgs.push(...layer.inputArgs);
for (let i = 0; i < 3; i++) {
  const clipDur = i < 2 ? normalizedDurs[i] + transDur : normalizedDurs[i] + 1.0;
  videoArgs.push('-loop', '1', '-framerate', String(effectiveFps), '-t', clipDur.toFixed(3), '-i', `${dir}/slide_${i}.png`);
}
const { filters: vFilters, outLabel } = buildChainedXfadeFilters({
  slideCount: 3,
  normalizedDurs,
  transDur,
  xfadeName: 'fade',
  width,
  height,
  effectiveFps,
  isRgba: true,
  inputOffset: 2,
  finalLabel: 'ov',
});
vFilters.unshift(...layer.ambientFilters);
vFilters.push(`[bgamb][${outLabel}]overlay=0:0,format=yuv420p[vout]`);
videoArgs.push('-filter_complex', vFilters.join(';'));
videoArgs.push('-map', '[vout]');
appendEncodeTail(videoArgs, {
  meta: { surahId: 1, surahName: 'الفاتحة', fromAyah: 1, toAyah: 3, reciterName: 'test', format: 'mp4', resolution: '720p', quality: 'balanced' },
  crf: 24,
  effectiveFps,
  hasBgVideoFile: false,
  hasAnimatedVisualLayer: true,
  slideCount: 3,
  totalAudioDur: 6.5,
  outputPath: `${dir}/output_stars.mp4`,
});
console.log('   ffmpeg argc:', videoArgs.length);
execFileSync(FFMPEG, videoArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
console.log('   ✓ stars video encoded');

// aurora video via the concat engine shape (backdrop + ambient + concat slides)
const videoArgs2: string[] = ['-y'];
videoArgs2.push('-loop', '1', '-framerate', String(effectiveFps), '-t', '7.5', '-i', `${auroraDir}/backdrop.png`);
videoArgs2.push(...auroraLayer.inputArgs);
writeFileSync(`${auroraDir}/slides_list.txt`, "file 'slide_0.png'\nduration 3.0\nfile 'slide_1.png'\nduration 3.5\nfile 'slide_1.png'\n");
videoArgs2.push('-f', 'concat', '-safe', '0', '-i', `${auroraDir}/slides_list.txt`);
const filters2 = [
  ...auroraLayer.ambientFilters!,
  `[2:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1,fps=${effectiveFps},format=yuva420p[slides]`,
  `[bgamb][slides]overlay=0:0,format=yuv420p[vout]`,
];
videoArgs2.push('-filter_complex', filters2.join(';'), '-map', '[vout]');
appendEncodeTail(videoArgs2, {
  meta: { surahId: 1, surahName: 'الفاتحة', fromAyah: 1, toAyah: 2, reciterName: 'test', format: 'mp4', resolution: '720p', quality: 'balanced' },
  crf: 24,
  effectiveFps,
  hasBgVideoFile: false,
  hasAnimatedVisualLayer: true,
  slideCount: 2,
  totalAudioDur: 6.5,
  outputPath: `${auroraDir}/output_aurora.mp4`,
});
execFileSync(FFMPEG, videoArgs2, { stdio: ['ignore', 'ignore', 'pipe'] });
console.log('   ✓ aurora video encoded');

// ---------- 4) Probe outputs ----------
for (const f of [`${dir}/output_stars.mp4`, `${auroraDir}/output_aurora.mp4`]) {
  const out = execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', f]).toString();
  const parsed = JSON.parse(out);
  const v = parsed.streams.find((s: any) => s.codec_type === 'video');
  console.log(`   probe ${path.basename(f)}: ${v.width}x${v.height} dur=${parsed.format.duration}`);
  if (!v || v.width !== 540) throw new Error('FAIL: bad video stream');
}

// ---------- 5) THE PROOF: background region must animate ----------
console.log('[5] extracting frames and proving background animation...');
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '0.5', '-i', `${dir}/output_stars.mp4`, '-frames:v', '1', `${dir}/check_t1.png`]);
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '3.5', '-i', `${dir}/output_stars.mp4`, '-frames:v', '1', `${dir}/check_t2.png`]);
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '0.5', '-i', `${auroraDir}/output_aurora.mp4`, '-frames:v', '1', `${auroraDir}/check_a1.png`]);
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '3.5', '-i', `${auroraDir}/output_aurora.mp4`, '-frames:v', '1', `${auroraDir}/check_a2.png`]);

const proof = execFileSync('python3', ['-c', `
from PIL import Image, ImageChops
def changed(a_path, b_path, box):
    a = Image.open(a_path).convert('RGB').crop(box)
    b = Image.open(b_path).convert('RGB').crop(box)
    diff = ImageChops.difference(a, b)
    return sum(1 for p in diff.getdata() if p != (0, 0, 0))
# text-free top region (slides draw text around y=430-510 only)
stars_changed = changed('${dir}/check_t1.png', '${dir}/check_t2.png', (0, 0, 540, 380))
aurora_changed = changed('${auroraDir}/check_a1.png', '${auroraDir}/check_a2.png', (0, 0, 540, 380))
print(f'stars bg pixels changed  t=0.5s vs t=3.5s: {stars_changed}')
print(f'aurora bg pixels changed t=0.5s vs t=3.5s: {aurora_changed}')
assert stars_changed > 50, 'STARS BACKGROUND FROZEN — FIX FAILED'
assert aurora_changed > 500, 'AURORA BACKGROUND FROZEN — FIX FAILED'
print('PROOF_OK: backgrounds animate')
`], { stdio: 'inherit' });

// ---------- 6) Regression: ambient=none must keep legacy frozen path intact ----------
console.log('[6] regression: none → no ambient input args, backdrop engine untouched...');
const noneLayer = resolveAmbientLayer({
  ambientEffect: 'none',
  hasBgVideoFile: false,
  jobDir: dir,
  filesInDir,
  width: 540,
  height: 960,
  effectiveFps: 30,
});
if (noneLayer.active || noneLayer.inputArgs.length || noneLayer.ambientFilters) {
  throw new Error('FAIL: none must stay inactive');
}
// bg-video present → ambient suppressed (video already animates)
const bgvidLayer = resolveAmbientLayer({
  ambientEffect: 'stars',
  hasBgVideoFile: true,
  jobDir: dir,
  filesInDir,
  width: 540,
  height: 960,
  effectiveFps: 30,
});
if (bgvidLayer.active) throw new Error('FAIL: ambient must yield to bg video');
console.log('   ✓ none inactive, bg-video suppresses ambient');

console.log('\nALL E2E CHECKS PASSED ✅');
process.exit(0);

function readFileSyncBuf(p: string) {
  return require('node:fs').readFileSync(p);
}
