/**
 * E2E probe — custom-audio verse boundaries reach the exported video.
 *
 * Builds a synthetic recitation (3 verses: 4s voice, 0.8s gap, 6s voice,
 * 0.9s gap, 3s voice ≈ 14.7s) with FFmpeg, uploads it with explicit
 * customVerseBounds [0, 4.8, 11.7], runs a full export session against the
 * live dev server, then verifies:
 *   1) the exported video duration ≈ intro (2.5s) + 14.7s audio,
 *   2) per-slide durations derived from the export match the boundaries
 *      (each verse slide lasts its real segment, NOT an even ~4.9s split).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const WORK = '/tmp/e2e-custom-bounds';
const FFMPEG = '/usr/bin/ffmpeg';

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

// ── 1) synthetic 3-verse recitation with real silence gaps ───────────────
// 4s tone + 0.8s silence + 6s tone + 0.9s silence + 3s tone = 14.7s
console.log('[1] synthesizing 3-verse custom audio (4s/gap/6s/gap/3s)...');
const audioPath = path.join(WORK, 'custom.mp3');
execFileSync(FFMPEG, [
  '-y',
  '-filter_complex',
  [
    'sine=frequency=220:duration=4[a]',
    'anullsrc=d=0.8[s1]',
    'sine=frequency=260:duration=6[b]',
    'anullsrc=d=0.9[s2]',
    'sine=frequency=300:duration=3[c]',
    '[a][s1][b][s2][c]concat=n=5:v=0:a=1[out]',
  ].join(';'),
  '-map', '[out]', '-b:a', '128k', audioPath,
], { stdio: 'pipe' });

// ── 2) real boundaries for that audio ────────────────────────────────────
const BOUNDS = [0, 4.8, 11.7]; // verse starts inside the file
const AUDIO_TOTAL = 14.7;

console.log('[2] creating export session with customVerseBounds...');
const meta = {
  surahId: 1,
  surahName: 'الفاتحة',
  fromAyah: 1,
  toAyah: 3,
  reciter: 'alafasy',
  reciterName: 'مشاري العفاسي',
  verseIds: [1, 2, 3],
  verseTexts: ['', 'أَوَّلُ آيَةٍ', 'ثَانِيَةٌ', 'ثَالِثَةٌ'], // slide0 = intro
  customVerseBounds: BOUNDS,
  slideCount: 4, // intro cover + 3 verses
  includeIntroCover: true,
  introCoverDurationSec: 2.5,
  baseWidth: 1080,
  baseHeight: 1920,
  hasBgVideo: false,
  format: 'mp4',
  resolution: '720p',
  fps: 30,
  quality: 'medium',
  transition: 'fade',
  transitionDurationMs: 600,
  audioPreset: 'natural',
  ambientSound: 'none',
  ambientVolume: 0.2,
  ambient: 'none',
  verseGapSec: 0,
  audioFade: true,
  audioBitrate: 128,
};

const form = new FormData();
form.append('meta', JSON.stringify(meta));
form.append(
  'customAudio',
  new Blob([readFileSync(audioPath)], { type: 'audio/mpeg' }),
  'custom.mp3'
);
const sessionRes = await fetch(`${BASE}/api/studio/export/session`, {
  method: 'POST',
  body: form,
});
if (!sessionRes.ok)
  throw new Error(`session failed: ${sessionRes.status} ${await sessionRes.text()}`);
const { jobId } = await sessionRes.json();
console.log('    jobId =', jobId);

console.log('[3] uploading backdrop + 4 slides (intro + 3 verses)...');
// 780x1386 PNG slides — DISTINCT colors per slide so scene-change detection
// can see the verse transitions in the final video (720p tier of 1080x1920).
const SLIDE_COLORS = ['0x101820', '0x401020', '0x104030', '0x203050'];
for (let i = 0; i < 4; i++) {
  const png = path.join(WORK, `slide_${i}.png`);
  execFileSync(FFMPEG, [
    '-y', '-f', 'lavfi',
    '-i', `color=c=${SLIDE_COLORS[i]}:s=780x1386:d=1`,
    '-frames:v', '1', png,
  ], { stdio: 'pipe' });
}
execFileSync(FFMPEG, [
  '-y', '-f', 'lavfi',
  '-i', 'color=c=0x0a0f14:s=780x1386:d=1',
  '-frames:v', '1', path.join(WORK, 'backdrop.png'),
], { stdio: 'pipe' });

const setupForm = new FormData();
setupForm.append(
  'backdrop',
  new Blob([readFileSync(path.join(WORK, 'backdrop.png'))], { type: 'image/png' }),
  'backdrop.png'
);
let upRes = await fetch(`${BASE}/api/studio/export/session?id=${jobId}`, {
  method: 'PUT',
  body: setupForm,
});
if (!upRes.ok) throw new Error(`backdrop upload failed: ${upRes.status} ${await upRes.text()}`);

const slideForm = new FormData();
for (let i = 0; i < 4; i++) {
  slideForm.append(
    `slide_${i}`,
    new Blob([readFileSync(path.join(WORK, `slide_${i}.png`))], { type: 'image/png' }),
    `slide_${i}.png`
  );
}
upRes = await fetch(`${BASE}/api/studio/export/session?id=${jobId}`, {
  method: 'PUT',
  body: slideForm,
});
if (!upRes.ok) throw new Error(`slide upload failed: ${upRes.status} ${await upRes.text()}`);

console.log('[4] starting render + polling...');
await fetch(`${BASE}/api/studio/export/session?id=${jobId}`, { method: 'PATCH' });

let status: any = null;
for (let i = 0; i < 150; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const st = await fetch(`${BASE}/api/studio/export/session?id=${jobId}`);
  status = (await st.json())?.status;
  if (i % 5 === 0) process.stdout.write(`    [${i}s] ${status?.stage} ${status?.progressPct}%\n`);
  if (status?.stage === 'done' || status?.stage === 'error') break;
}
if (!status || status.stage === 'error')
  throw new Error(`export failed: ${JSON.stringify(status).slice(0, 400)}`);
const filename = status.result?.filename;
if (!filename) throw new Error(`no result filename: ${JSON.stringify(status).slice(0, 300)}`);
console.log('    stage =', status.stage, '| filename =', filename, '| server duration =', status.result.durationSec);

console.log('[5] downloading result + probing duration...');
const dlRes = await fetch(`${BASE}/api/studio/export/download?id=${jobId}`);
if (!dlRes.ok) throw new Error(`download failed: ${dlRes.status}`);
const videoBuf = Buffer.from(await dlRes.arrayBuffer());
const videoPath = path.join(WORK, 'out.mp4');
writeFileSync(videoPath, videoBuf);
console.log(`    saved ${videoPath} (${Math.round(videoBuf.length / 1024)} KB)`);

const probe = JSON.parse(
  execFileSync('/usr/bin/ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'json', videoPath,
  ], { stdio: 'pipe' }).toString()
);
const totalDur = Number(probe.format.duration);
console.log(`    total video duration = ${totalDur.toFixed(2)}s`);

// ── 6) assertions ────────────────────────────────────────────────────────
const expectedTotal = 2.5 + AUDIO_TOTAL; // intro + audio
const durOk = Math.abs(totalDur - expectedTotal) < 1.0;
console.log(`    expected ≈ ${expectedTotal}s → ${durOk ? '✅' : '❌'}`);

// Per-slide verification via per-second luma averages: xfade blends slide
// colors smoothly (scene detection sees nothing), but the SECOND containing
// each boundary is a mix of both slide colors — and seconds BETWEEN
// boundaries carry a single slide's color. Real bounds [0,4.8,11.7] ⇒
// boundaries at 2.5 / 7.3 / 14.2; an even split would put them at
// 2.5 / 7.4 / 12.3 — second 12 tells them apart.
const statsRaw = execFileSync(FFMPEG, [
  '-i', videoPath,
  '-vf', 'fps=1,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-',
  '-f', 'null', '-',
], { stdio: 'pipe' }).toString();
const yavgs = [...statsRaw.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map((m) =>
  Number(m[1])
);
console.log('    per-second YAVG:', yavgs.map((v) => v.toFixed(0)).join(' '));
if (yavgs.length < 15) throw new Error(`too few samples: ${yavgs.length}`);

// slide colors Y: intro≈34 v1≈40 v2≈52 v3≈51. fps=1 samples the FIRST frame
// of each second, so a boundary at t=2.5 shows as a jump between second 2
// (pure intro) and second 3 (first pure v1). Real bounds [0,4.8,11.7] ⇒
// jumps at seconds 2→3, 7→8, 14→15; an even split would jump at 2→3, 7→8,
// 12→13 — the LAST jump position is the discriminator.
const sec = (i: number) => yavgs[Math.min(i, yavgs.length - 1)];
const jumpAt = (i: number) => Math.abs(sec(i + 1) - sec(i)) > 2;
const jump23 = jumpAt(2); // intro → v1 (both layouts)
const jump78 = jumpAt(7); // v1 → v2 at 7.3 (both layouts ≈7.4)
const jump1415 = jumpAt(14) || Math.abs(sec(14) - sec(13)) > 0.5; // v2 → v3 at 14.2
const noEarlyJump1213 = !jumpAt(12); // even split would transition here
console.log(
  `    jumps: 2→3=${jump23 ? '✅' : '❌'} 7→8=${jump78 ? '✅' : '❌'} 14→15=${jump1415 ? '✅' : '❌'} no-early-12→13=${noEarlyJump1213 ? '✅' : '❌'}`
);

if (!durOk || !jump23 || !jump78 || !jump1415 || !noEarlyJump1213) {
  console.error('E2E CUSTOM BOUNDS FAILED ❌');
  process.exit(1);
}
console.log('\nE2E CUSTOM BOUNDS PASSED ✅ — real verse boundaries drive slide durations');
