import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySrtOffset,
  buildSrtCues,
  buildSrtFromTimeline,
  formatSrtTimestamp,
  renderSrtFile,
  sanitizeSrtText,
  SRT_MAX_VERSE_TEXT_CHARS,
} from './srt-subtitles';

test('formatSrtTimestamp formats hours, minutes, seconds, and milliseconds', () => {
  assert.equal(formatSrtTimestamp(0), '00:00:00,000');
  assert.equal(formatSrtTimestamp(5.5), '00:00:05,500');
  assert.equal(formatSrtTimestamp(75.25), '00:01:15,250');
  assert.equal(formatSrtTimestamp(3661.999), '01:01:01,999');
  // Negative / NaN inputs clamp to zero instead of corrupting the cue
  assert.equal(formatSrtTimestamp(-3), '00:00:00,000');
  assert.equal(formatSrtTimestamp(Number.NaN), '00:00:00,000');
});

test('sanitizeSrtText strips markup, collapses whitespace, and clamps length', () => {
  assert.equal(sanitizeSrtText('  بِسْمِ   ٱللَّهِ  '), 'بِسْمِ ٱللَّهِ');
  // HTML tags from translations are removed
  assert.equal(sanitizeSrtText('<i>Allah</i> is One'), 'Allah is One');
  // Newlines become spaces (cues are single blocks)
  assert.equal(sanitizeSrtText('line1\nline2'), 'line1 line2');
  // A literal "-->" would corrupt the cue header
  assert.equal(sanitizeSrtText('a --> b'), 'a — b');
  // Length clamp
  const long = 'x'.repeat(400);
  assert.equal(sanitizeSrtText(long).length, SRT_MAX_VERSE_TEXT_CHARS);
});

test('buildSrtCues turns durations into contiguous, indexed cues', () => {
  const cues = buildSrtCues([
    { text: 'الأولى', durationSec: 2.0 },
    { text: 'الثانية', durationSec: 3.0 },
    { text: '', durationSec: 1.0 }, // empty text → cue skipped
    { text: 'الثالثة', durationSec: 1.5 },
  ]);
  assert.equal(cues.length, 3);
  assert.equal(cues[0].startSec, 0);
  assert.equal(cues[0].endSec, 2);
  // The empty-text entry still advances the timeline cursor
  assert.equal(cues[1].startSec, 2);
  assert.equal(cues[1].endSec, 5);
  assert.equal(cues[2].startSec, 6); // after the skipped 1s entry
  assert.equal(cues[2].endSec, 7.5);
  // A skipped entry leaves a gap in entry-order indexes (render renumbers)
  assert.equal(cues[2].index, 4);
});

test('renderSrtFile emits a spec-compliant body with CRLF blocks', () => {
  const cues = buildSrtCues([
    { text: 'بِسْمِ ٱللَّهِ', durationSec: 2.5 },
    { text: 'ٱلرَّحْمَـٰنِ', durationSec: 3 },
  ]);
  const body = renderSrtFile(cues);
  assert.match(body, /^1\r\n00:00:00,000 --> 00:00:02,500\r\nبِسْمِ ٱللَّهِ\r\n\r\n2\r\n00:00:02,500 --> 00:00:05,500\r\nٱلرَّحْمَـٰنِ\r\n$/);
  assert.equal(renderSrtFile([]), '');
});

test('buildSrtFromTimeline mirrors the concat-manifest duration floor', () => {
  // Durations below the manifest's 0.25s floor are lifted to 0.25 in SRT too,
  // keeping subtitles aligned with the rendered video timeline.
  const body = buildSrtFromTimeline([0.1, 2], ['a', 'b']);
  assert.match(body, /00:00:00,000 --> 00:00:00,250/);
  assert.match(body, /00:00:00,250 --> 00:00:02,250/);
});

test('applySrtOffset shifts both timestamps of every cue', () => {
  const body = '1\r\n00:00:01,000 --> 00:00:02,000\r\nhello\r\n';
  const shifted = applySrtOffset(body, 60);
  assert.match(shifted, /00:01:01,000 --> 00:01:02,000/);
  // No-op offset leaves the body untouched
  assert.equal(applySrtOffset(body, 0), body);
});
