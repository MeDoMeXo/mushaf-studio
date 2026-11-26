/**
 * Tests for the built-in background library registry: 9 curated animated
 * backgrounds (5 procedural Islamic + 4 licensed nature clips) served from
 * public/assets/bg-library/ and referenced by id in export sessions.
 * (جدول رقراق / nature-5-river was removed at the owner's request.)
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

test('BUILTIN_BG_LIBRARY holds exactly 9 unique entries — 5 islamic + 4 nature', () => {
  assert.equal(BUILTIN_BG_LIBRARY.length, 9);
  assert.equal(BUILTIN_BG_COUNT, 9);
  const ids = new Set(BUILTIN_BG_LIBRARY.map((b) => b.id));
  assert.equal(ids.size, 9, 'ids must be unique');
  assert.equal(BUILTIN_BG_LIBRARY.filter((b) => b.category === 'islamic').length, 5);
  assert.equal(BUILTIN_BG_LIBRARY.filter((b) => b.category === 'nature').length, 4);
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
  // removed entry (جدول رقراق) must be rejected like any unknown id
  assert.equal(isBuiltinBackgroundId('nature-5-river'), false);
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
