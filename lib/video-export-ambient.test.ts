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
