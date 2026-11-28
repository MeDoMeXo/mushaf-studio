/**
 * اختبارات صدى الصوت (producer-echo): القيود إلى المدى الصالح، مطابقة
 * الإعدادات المسبقة، أثر السماع، وذيل الصدى المحسوب من التغذية الراجعة.
 */
import test from 'node:test';
import assert from 'node:assert';
import {
  DEFAULT_ECHO,
  ECHO_PRESETS,
  clampEchoSettings,
  describeEcho,
  echoTailSec,
  isEchoAudible,
  matchEchoPreset,
  type ProducerEchoSettings,
} from './producer-echo';

test('clampEchoSettings: values clamped into legal ranges', () => {
  const s = clampEchoSettings({ enabled: true, delaySec: 5, feedback: -1, wet: 2 });
  assert.equal(s.enabled, true);
  assert.equal(s.delaySec, 0.9); // upper clamp
  assert.equal(s.feedback, 0); // lower clamp
  assert.equal(s.wet, 0.6); // upper clamp
  // NaN values fall back to defaults / zeros, never NaN out.
  const n = clampEchoSettings({ delaySec: Number.NaN, feedback: Number.NaN, wet: Number.NaN });
  assert.ok(Number.isFinite(n.delaySec));
  assert.equal(n.feedback, 0);
  assert.equal(n.wet, 0);
});

test('echo presets are all legal and self-consistent', () => {
  for (const p of ECHO_PRESETS) {
    const s = clampEchoSettings({ enabled: true, ...p });
    assert.equal(s.delaySec, p.delaySec, `${p.id} delay within range`);
    assert.equal(s.feedback, p.feedback, `${p.id} feedback within range`);
    assert.equal(s.wet, p.wet, `${p.id} wet within range`);
    assert.equal(matchEchoPreset(s)?.id, p.id, `${p.id} round-trips through clamp`);
    assert.ok(isEchoAudible(s), `${p.id} audible by default`);
  }
});

test('isEchoAudible: disabled or inaudible wet/feedback is false', () => {
  assert.equal(isEchoAudible({ ...DEFAULT_ECHO, enabled: false, wet: 0.5 }), false);
  assert.equal(isEchoAudible({ ...DEFAULT_ECHO, enabled: true, wet: 0 }), false);
  assert.equal(isEchoAudible({ ...DEFAULT_ECHO, enabled: true, wet: 0.3, feedback: 0 }), false);
  assert.equal(isEchoAudible(null), false);
  assert.equal(isEchoAudible(undefined), false);
});

test('echoTailSec: bounded by 4s and zero when inaudible', () => {
  assert.equal(echoTailSec({ ...DEFAULT_ECHO, enabled: false }), 0);
  // subtle preset: repeats = ln(0.01)/ln(0.22) ≈ 2.82 → ~0.4s
  const subtle = ECHO_PRESETS[0];
  const t = echoTailSec({ enabled: true, ...subtle });
  assert.ok(t > 0.2 && t < 0.6, `subtle tail ≈ 0.4s (got ${t})`);
  // cavern: feedback 0.62 → repeats ≈ 10.6 × 0.55s ≈ 5.8 → clamped to 4
  const cavern = ECHO_PRESETS[3];
  assert.equal(echoTailSec({ enabled: true, ...cavern }), 4);
});

test('describeEcho: Arabic summary reflects state', () => {
  assert.equal(describeEcho({ ...DEFAULT_ECHO, enabled: false }), 'بلا صدى');
  const d = describeEcho({ enabled: true, ...ECHO_PRESETS[0] });
  assert.ok(d.startsWith('صدى خفيف'), `names the preset (got ${d})`);
  assert.ok(d.includes('140ms'), `mentions delay in ms (got ${d})`);
});

test('DEFAULT_ECHO is disabled by default (render path stays dry)', () => {
  assert.equal(DEFAULT_ECHO.enabled, false);
  const custom: ProducerEchoSettings = { enabled: true, delaySec: 0.3, feedback: 0.4, wet: 0.25 };
  assert.equal(matchEchoPreset(custom), null, 'custom values match no preset');
});
