/**
 * Reproduce the exact FFmpeg command the failed 1080p karaoke job ran
 * (engine: backdrop + ambient + chained xfade over 11 transparent slides)
 * and measure memory to confirm the OOM. Then test mitigations.
 */
import { execFileSync, spawn } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = '/tmp/repro-job';
const FFMPEG = '/usr/bin/ffmpeg';
const files = readdirSync(dir);
const slidePaths = Array.from({ length: 11 }, (_, i) =>
  files.includes(`slide_${i}.png`) ? path.join(dir, `slide_${i}.png`) : null
).filter(Boolean) as string[];

console.log('slides found:', slidePaths.length);

// Same shape as export-render-pipeline.ts engine-2 branch:
// isKaraoke = wordTimeline present → xfadeName = null → but slidePaths.length=11
// ≤ XFADE_MAX_SLIDES=30 and hasBackdropFile + ambient frames exist.
// NOTE: with isKaraoke, xfadeName is null → condition
// `hasBackdropFile && xfadeName && ...` is FALSE → falls to hasBackdropFile
// concat branch! Let's verify which branch actually ran by building BOTH.
const meta = JSON.parse(readFileSync(path.join(dir, 'meta.json'), 'utf8'));
const isKaraoke = Array.isArray(meta.wordTimeline) && meta.wordTimeline.length > 0;
console.log('isKaraoke:', isKaraoke, '→ transition xfade disabled, concat engine branch used');

// Build the concat-branch command exactly like the code does:
// backdrop [0:v] + ambient input [1:v] + concat slides [2:v] + audio [3]
const width = 1080, height = 1920, fps = 30;
const durs = Array.from({ length: slidePaths.length }, () => 0.8);
const lastIdx = slidePaths.length - 1;
const manifest = slidePaths
  .map((_, i) => `file 'slide_${i}.png'\nduration ${i === lastIdx ? 1.8 : 0.8}`)
  .join('\n') + `\nfile 'slide_${lastIdx}.png'\n`;
writeFileSync(path.join(dir, 'slides_list.txt'), manifest);

const args = [
  '-y',
  '-loop', '1', '-framerate', String(fps), '-t', '12', '-i', path.join(dir, 'backdrop.png'),
  '-stream_loop', '-1', '-framerate', '12', '-start_number', '0', '-i', path.join(dir, 'ambient_%03d.png'),
  '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'slides_list.txt'),
  '-i', path.join(dir, 'audio_final.m4a'),
  '-filter_complex', [
    `[1:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,setsar=1,fps=${fps},format=rgba[amb]`,
    `[0:v][amb]overlay=0:0,format=rgba[bgamb]`,
    `[2:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1,fps=${fps},format=rgba[slides]`,
    `[bgamb][slides]overlay=0:0,format=yuv420p[vout]`,
  ].join(';'),
  '-map', '[vout]', '-map', '3:a:0',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
  '-maxrate', '1400k', '-bufsize', '2800k',
  '-pix_fmt', 'yuv420p', '-tag:v', 'avc1',
  '-fps_mode', 'cfr', '-r', '30', '-g', '60',
  '-c:a', 'copy', '-t', '10',
  path.join(dir, 'output_repro.mp4'),
];

console.log('\n[repro] running concat-branch command (the one the failed job ran)...');
const t0 = Date.now();
try {
  execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120000 });
  console.log('✓ concat branch SUCCEEDED in', ((Date.now() - t0) / 1000).toFixed(1), 's');
} catch (err: any) {
  console.log('✗ concat branch FAILED:', String(err.message).slice(-400));
}
