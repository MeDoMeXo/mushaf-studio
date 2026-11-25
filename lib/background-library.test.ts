/**
 * Tests for the built-in background library registry: 10 curated animated
 * backgrounds (5 procedural Islamic + 5 licensed nature clips) served from
 * public/assets/bg-library/ and referenced by id in export sessions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  BUILTIN_BG_COUNT,
  BUILTIN_BG_LIBRARY,
  isBuiltinBackgroundId,
  getBuiltinBackground,
  getBuiltinBackgroundPublicPath,
} from './background-library';

test('BUILTIN_BG_LIBRARY holds exactly 10 unique entries — 5 islamic + 5 nature', () => {
  assert.equal(BUILTIN_BG_LIBRARY.length, 10);
  assert.equal(BUILTIN_BG_COUNT, 10);
  const ids = new Set(BUILTIN_BG_LIBRARY.map((b) => b.id));
  assert.equal(ids.size, 10, 'ids must be unique');
  assert.equal(BUILTIN_BG_LIBRARY.filter((b) => b.category === 'islamic').length, 5);
  assert.equal(BUILTIN_BG_LIBRARY.filter((b) => b.category === 'nature').length, 5);
});

test('every library entry points at an existing mp4 inside public/assets/bg-library', () => {
  for (const bg of BUILTIN_BG_LIBRARY) {
    assert.ok(bg.file.endsWith('.mp4'));
    assert.ok(bg.file.startsWith(bg.category === 'islamic' ? 'islamic-' : 'nature-'));
    const abs = path.join(process.cwd(), 'public', 'assets', 'bg-library', bg.file);
    assert.ok(existsSync(abs), `missing on disk: ${bg.file}`);
    assert.ok(bg.name.length > 0);
    assert.deepEqual(bg.posterColors.length, 2);
  }
});

test('isBuiltinBackgroundId accepts known ids and rejects anything else', () => {
  assert.equal(isBuiltinBackgroundId('islamic-1-star-rotate'), true);
  assert.equal(isBuiltinBackgroundId('nature-5-river'), true);
  // path traversal / injection attempts must never match
  assert.equal(isBuiltinBackgroundId('../../etc/passwd'), false);
  assert.equal(isBuiltinBackgroundId('islamic-1-star-rotate.mp4'), false);
  assert.equal(isBuiltinBackgroundId(''), false);
  assert.equal(isBuiltinBackgroundId('nonsense'), false);
});

test('getBuiltinBackground resolves entries and returns null for unknown ids', () => {
  const bg = getBuiltinBackground('nature-2-waves');
  assert.ok(bg);
  assert.equal(bg.file, 'nature-2-waves.mp4');
  assert.equal(getBuiltinBackground('does-not-exist'), null);
  assert.equal(getBuiltinBackground('../islamic-1-star-rotate'), null);
});

test('nature entries carry license attribution (Mixkit) with a source URL', () => {
  for (const bg of BUILTIN_BG_LIBRARY.filter((b) => b.category === 'nature')) {
    assert.ok(bg.license.length > 0, `${bg.id} must document its license`);
    assert.ok(bg.sourceUrl.startsWith('https://'), `${bg.id} must cite its source URL`);
  }
});

test('getBuiltinBackgroundPublicPath returns the public URL for a valid id', () => {
  assert.equal(
    getBuiltinBackgroundPublicPath('islamic-1-star-rotate'),
    '/assets/bg-library/islamic-1-star-rotate.mp4'
  );
  assert.equal(getBuiltinBackgroundPublicPath('unknown'), null);
});
