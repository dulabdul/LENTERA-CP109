import { mkdtemp, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it, expect } from 'vitest';
import { FileObjectStore } from '../src/lib/storage/object-store';
import { AirFieldRepository, pruneLocalAirField } from '../src/lib/air-field/storage';
import { TestObjectStore } from './helpers/object-store';
import { FIELD_TEST_NOW, mockOperationalField } from '../fixtures/air-field';
it('prunes old local artifacts but keeps the active snapshot and all fresh objects; skips non-disk stores', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lentera-field-retention-'));
  try {
    const store = new FileObjectStore(root), repo = new AirFieldRepository(store);
    // In-memory contract fixture written only to an isolated temporary test directory.
    const active = await repo.publish(mockOperationalField());
    const expired = `air-field/snapshots/${'a'.repeat(64)}.json.gz`, recent = `air-field/snapshots/${'b'.repeat(64)}.json.gz`;
    await store.put(expired, Buffer.from('synthetic expired artifact')); await store.put(recent, Buffer.from('synthetic recent artifact'));
    const now = new Date(FIELD_TEST_NOW.getTime() + 72 * 3_600_000), old = new Date(FIELD_TEST_NOW), fresh = now;
    for (const key of [`air-field/snapshots/${active}.json.gz`, expired]) await utimes(join(root, key), old, old);
    await utimes(join(root, recent), fresh, fresh);
    expect(await pruneLocalAirField(store, now)).toEqual({ skipped: false, deleted: 1 });
    expect(await store.get(expired)).toBeNull(); expect(await store.get(recent)).not.toBeNull(); expect(await store.get(`air-field/snapshots/${active}.json.gz`)).not.toBeNull();
    expect(await pruneLocalAirField(new TestObjectStore(), now)).toEqual({ skipped: true, deleted: 0 });
  } finally { await rm(root, { recursive: true, force: true }); }
});
