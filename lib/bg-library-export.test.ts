/**
 * Tests for the server-side built-in background resolution: the export job
 * meta carries a bgLibraryId that must pass the strict registry whitelist,
 * and the render pipeline resolves it by copying the asset from public/
 * into the job dir — never accepting a user-supplied path.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveBuiltinBackgroundForJob } from './export-job-manager';

test('resolveBuiltinBackgroundForJob normalizes a valid bgLibraryId', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'bglib-'));
  try {
    await writeFile(path.join(tmp, 'meta.json'), JSON.stringify({ bgLibraryId: 'nature-2-waves' }));
    const meta = { bgLibraryId: 'nature-2-waves', hasBgVideo: true };
    const result = await resolveBuiltinBackgroundForJob(meta as never, tmp);
    assert.equal(result, true);
    // bg_video.bin was copied from the public library asset
    assert.ok(existsSync(path.join(tmp, 'bg_video.bin')));
    const metaFile = JSON.parse(await readFile(path.join(tmp, 'meta.json'), 'utf8'));
    assert.equal(metaFile.bgLibraryId, 'nature-2-waves');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('resolveBuiltinBackgroundForJob rejects unknown or traversal ids with a clear error', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'bglib-'));
  try {
    for (const bad of ['../../etc/passwd', 'unknown-id', 'nature-2-waves.mp4']) {
      const meta = { bgLibraryId: bad, hasBgVideo: true };
      await assert.rejects(
        () => resolveBuiltinBackgroundForJob(meta as never, tmp),
        /الخلفية المختارة غير متوفرة/
      );
    }
    assert.ok(!existsSync(path.join(tmp, 'bg_video.bin')));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('resolveBuiltinBackgroundForJob is a no-op without a bgLibraryId', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'bglib-'));
  try {
    // a pre-existing uploaded bg_video.bin must be left untouched
    await writeFile(path.join(tmp, 'bg_video.bin'), 'uploaded-by-client');
    const result = await resolveBuiltinBackgroundForJob({} as never, tmp);
    assert.equal(result, false);
    const content = await readFile(path.join(tmp, 'bg_video.bin'), 'utf8');
    assert.equal(content, 'uploaded-by-client');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('resolveBuiltinBackgroundForJob fails clearly when the asset file is missing on disk', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'bglib-'));
  try {
    // simulate a deploy without public/assets: point cwd at an empty dir
    const empty = await mkdtemp(path.join(os.tmpdir(), 'empty-public-'));
    const origCwd = process.cwd();
    let caught: Error | null = null;
    process.chdir(empty);
    try {
      await resolveBuiltinBackgroundForJob(
        { bgLibraryId: 'nature-2-waves', hasBgVideo: true } as never,
        tmp
      );
    } catch (err) {
      caught = err as Error;
    } finally {
      process.chdir(origCwd);
      await rm(empty, { recursive: true, force: true });
    }
    assert.ok(caught, 'must throw when the library asset is missing');
    assert.match(caught.message, /الخلفية المختارة غير متوفرة/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
