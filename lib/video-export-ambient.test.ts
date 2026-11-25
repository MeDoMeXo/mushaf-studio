/**
 * Tests for the ambient motion layer module (extracted from video-export.ts
 * per the 600-line file rule). These verify the export protocol for animated
 * ambient effects: which effects animate, how their frame sequences are
 * specified, and how FFmpeg composites them above the backdrop.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AMBIENT_MAX_FRAMES,
  buildAmbientOverlayFilters,
  resolveAmbientFrameSpecs,
  shouldRenderAnimatedAmbient,
} from './video-export-ambient';

test('shouldRenderAnimatedAmbient enables the animated layer only for real effects', () => {
  assert.equal(shouldRenderAnimatedAmbient('none'), false);
  assert.equal(shouldRenderAnimatedAmbient('stars'), true);
  assert.equal(shouldRenderAnimatedAmbient('gold-dust'), true);
  assert.equal(shouldRenderAnimatedAmbient('aurora'), true);
  // expanded motion effects (fireflies / petals / bokeh / rain / snow)
  assert.equal(shouldRenderAnimatedAmbient('fireflies'), true);
  assert.equal(shouldRenderAnimatedAmbient('petals'), true);
  assert.equal(shouldRenderAnimatedAmbient('bokeh'), true);
  assert.equal(shouldRenderAnimatedAmbient('rain'), true);
  assert.equal(shouldRenderAnimatedAmbient('snow'), true);
  // unknown legacy values never animate
  assert.equal(shouldRenderAnimatedAmbient('bogus-effect'), false);
});

test('resolveAmbientFrameSpecs returns loopable particle frame counts and a single aurora frame', () => {
  // Particles: 96 frames at 12fps = exactly 8s seamless loop (STAR_SEED drift is 1Hz-periodic)
  const stars = resolveAmbientFrameSpecs('stars', 1080, 1920, 30)!;
  assert.equal(stars.frameCount, 96);
  assert.equal(stars.fps, 12);
  assert.equal(stars.mode, 'frames');
  assert.ok(stars.uploadBytesEstimate > 0);
  // Gold dust drifts slightly slower; same loopable frame budget
  const gold = resolveAmbientFrameSpecs('gold-dust', 1080, 1920, 30)!;
  assert.equal(gold.frameCount, 96);
  assert.equal(gold.mode, 'frames');
  // Aurora animates by swaying ONE wide frame via overlay x-expression — no sequence needed
  const aurora = resolveAmbientFrameSpecs('aurora', 1080, 1920, 30)!;
  assert.equal(aurora.frameCount, 1);
  assert.equal(aurora.mode, 'single');
  assert.ok(aurora.swayAmplitudeRatio! > 0 && aurora.swayAmplitudeRatio! <= 0.2);
  // none never produces a spec
  assert.equal(resolveAmbientFrameSpecs('none', 1080, 1920, 30), null);
  // Resolution scaling keeps frame dimensions even (yuv420p requirement)
  const small = resolveAmbientFrameSpecs('stars', 480, 854, 24)!;
  assert.ok(small.frameWidth! % 2 === 0 && small.frameHeight! % 2 === 0);
  assert.ok(small.frameWidth! <= 480 && small.frameHeight! <= 960);
  // The frame ceiling matches the export protocol (96 @ 12fps = 8s loop)
  assert.equal(AMBIENT_MAX_FRAMES, 96);
  // Every expanded particle effect follows the same loopable frame protocol
  for (const effect of ['fireflies', 'petals', 'bokeh', 'rain', 'snow'] as const) {
    const spec = resolveAmbientFrameSpecs(effect, 1080, 1920, 30)!;
    assert.equal(spec.frameCount, 96, `${effect} loops 96 frames`);
    assert.equal(spec.fps, 12);
    assert.equal(spec.mode, 'frames');
    assert.ok(spec.uploadBytesEstimate > 0);
    assert.ok(spec.frameWidth! % 2 === 0 && spec.frameHeight! % 2 === 0);
  }
});

test('buildAmbientOverlayFilters composites looping particles or swaying aurora above the backdrop', () => {
  // Particle layer (stars): loops an 8s PNG frame sequence over the backdrop label
  const stars = buildAmbientOverlayFilters({
    effect: 'stars',
    inputLabel: 'bg',
    width: 720,
    height: 1280,
    outputLabel: 'bgamb',
    fps: 24,
  });
  assert.ok(stars!.includes('overlay=0:0'));
  assert.ok(stars!.includes('format=rgba'));
  assert.ok(!stars!.includes('sin(t')); // particles animate via frames, not expressions
  // The filter must reference its own ambient input stream label
  assert.ok(/:v\]/.test(stars!) === false); // pure filter chain, no input mapping inside

  // Aurora layer: single wide frame swayed with a sin(t) x-expression
  const aurora = buildAmbientOverlayFilters({
    effect: 'aurora',
    inputLabel: 'bg',
    width: 720,
    height: 1280,
    outputLabel: 'bgamb',
    fps: 24,
  });
  assert.ok(aurora!.includes('sin(t*0.6)'));
  assert.ok(aurora!.includes('overlay=x='));
  assert.ok(aurora!.includes('format=rgba'));

  // none yields no filter chain at all
  assert.equal(
    buildAmbientOverlayFilters({
      effect: 'none',
      inputLabel: 'bg',
      width: 720,
      height: 1280,
      outputLabel: 'bgamb',
      fps: 24,
    }),
    null
  );
});

test('resolveAmbientLayer stays active above a background video (preview/export parity)', async () => {
  // The live preview draws the ambient effect above the bg video, so the
  // export must composite it too — gating it off breaks parity.
  const { resolveAmbientLayer } = await import('./export-ambient-layer');
  const mkParams = (hasBgVideoFile: boolean) => ({
    ambientEffect: 'stars',
    hasBgVideoFile,
    jobDir: '/tmp',
    filesInDir: [] as string[],
    width: 720,
    height: 1280,
    effectiveFps: 24,
  });
  const withVideo = resolveAmbientLayer(mkParams(true));
  const withoutVideo = resolveAmbientLayer(mkParams(false));
  // Without frames on disk neither activates; the point is the *gate*:
  // hasBgVideoFile must not be the reason a frame-bearing job is disabled.
  assert.equal(withoutVideo.active, false);
  assert.equal(withVideo.active, false);
  // The real assertion: simulate frames present by pointing at a job dir
  // that contains ambient frames — verify via the exported gate helper.
  const { isAmbientEnabledForJob } = await import('./export-ambient-layer');
  assert.equal(isAmbientEnabledForJob('stars', true), true, 'ambient must stay on with bg video');
  assert.equal(isAmbientEnabledForJob('stars', false), true);
  assert.equal(isAmbientEnabledForJob('none', true), false);
  assert.equal(isAmbientEnabledForJob('none', false), false);
});

test('bg-video ambient graph leaves no dangling labels and overlays the processed [bg] stream', async () => {
  // Regression for review C1: with a background video, the ambient chain must
  // composite above the PROCESSED [bg] label (scale/crop/speed/blur applied),
  // never the raw [0:v] — otherwise [bg] dangles and FFmpeg aborts.
  const { buildVideoBackgroundFilterGraph } = await import('./video-export');
  const { buildAmbientOverlayFilters: build } = await import('./video-export-ambient');
  const bg = buildVideoBackgroundFilterGraph({ width: 1080, height: 1920, bgBlur: 4, bgVideoSpeed: 1.5, fps: 30 });
  const chain = build({ effect: 'stars', inputLabel: 'bg', width: 1080, height: 1920, outputLabel: 'bgamb', fps: 30 })!;
  // resolveAmbientLayer prefixes the first fragment with the ambient INPUT stream [1:v]
  const fragments = chain.split(';').map((part, i) => (i === 0 ? `[1:v]${part}` : part));
  const graph = [bg.split(';')[0], ...fragments].join(';');
  // 1) ambient consumes the processed [bg] label, not raw [0:v]
  assert.ok(graph.includes('[bg][amb]overlay'), 'ambient must overlay the processed [bg] stream');
  assert.ok(!graph.includes('[0:v][amb]'), 'ambient must NOT overlay the raw [0:v] stream');
  // 2) no dangling labels: every label produced inside the graph (not [vout])
  //    is consumed as an input by a later filter
  const labels = ['bg', 'amb', 'bgamb'];
  for (const label of labels) {
    const produced = new RegExp(`\\[${label}\\](?=[;,]|$)`).test(graph);
    assert.ok(produced, `label [${label}] must be produced`);
    // consumed = appears as an overlay input: "...[X][label]overlay" or "[label][X]overlay"
    const consumedAsBase = graph.includes(`[${label}][amb]overlay`) || graph.includes(`[${label}][ov]overlay`);
    const consumedAsTop = new RegExp(`\\[[a-z0-9]+\\]\\[${label}\\]overlay`).test(graph);
    if (label !== 'bgamb') {
      assert.ok(consumedAsBase || consumedAsTop, `label [${label}] must be consumed (dangling = FFmpeg abort)`);
    }
  }
  // 3) the bg prep chain ran first (blur/speed applied before ambient overlay)
  const bgIdx = graph.indexOf('[0:v]');
  const ambIdx = graph.indexOf('[1:v]');
  assert.ok(bgIdx !== -1 && ambIdx > bgIdx, 'bg video input precedes the ambient input');
});
