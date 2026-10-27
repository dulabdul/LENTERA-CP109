import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync, gunzipSync } from 'node:zlib';
import { syntheticAirResponse } from '../fixtures/air-provider';
import { SYNTHETIC_NOW } from '../fixtures/provider-scenarios';
import { AirRepository } from '../src/lib/storage/air-repository';
import { FileObjectStore, StoreConflict } from '../src/lib/storage/object-store';
import { AirService, parseAirQuery } from '../src/lib/services/air';
import { parseOpenMeteo } from '../src/lib/providers/open-meteo';
import { HOUR_MS } from '../src/lib/policy';
import { TestObjectStore } from './helpers/object-store';
const location = { lat: -2.21, lon: 113.92 };
const content = () => parseOpenMeteo(syntheticAirResponse(), location, SYNTHETIC_NOW);
const folders: string[] = [];
afterEach(async () => { for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true }); });
describe('persistent air series and request projection', () => {
  it('persists actual disk bytes and recovers in a new service instance without refetch', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'lentera-air-synthetic-')); folders.push(folder);
    const repo = new AirRepository(new FileObjectStore(folder)); let calls = 0;
    const service = new AirService(repo, async () => { calls++; return content(); }, () => SYNTHETIC_NOW);
    const first = await service.get(location);
    const restored = new AirService(new AirRepository(new FileObjectStore(folder)), async () => { throw new Error('must not fetch'); }, () => SYNTHETIC_NOW);
    const second = await restored.get({ lat: -2.214, lon: 113.924 });
    expect(first.meta.state).toBe('ok'); expect(second.meta.state).toBe('ok'); expect(calls).toBe(1);
    expect(second.meta.dataVersion).toBe(first.meta.dataVersion); expect(second.data?.requestedLocation).toEqual({ lat: -2.214, lon: 113.924 }); expect(second.data?.queryLocation).toEqual(location);
  });
  it('recomputes a cached current/index after an hour change before TTL', async () => {
    let now = SYNTHETIC_NOW, calls = 0;
    const service = new AirService(new AirRepository(new TestObjectStore()), async () => { calls++; return content(); }, () => now);
    const first = await service.get(location); now = new Date('2026-10-27T14:00:00.000Z'); const second = await service.get(location);
    expect(calls).toBe(1); expect(second.meta.fetchedAt).toBe(first.meta.fetchedAt); expect(second.data?.aqi).toMatchObject({ periodTo: now.toISOString() });
  });
  it('coalesces requests in one service and keeps exact requested locations distinct', async () => {
    let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; }); let calls = 0;
    const service = new AirService(new AirRepository(new TestObjectStore()), async () => { calls++; await held; return content(); }, () => SYNTHETIC_NOW);
    const a = service.get(location), b = service.get({ lat: -2.214, lon: 113.921 });
    await new Promise(resolve => setTimeout(resolve, 5)); release(); const responses = await Promise.all([a, b]);
    expect(calls).toBe(1); expect(responses[0]!.data?.requestedLocation).toEqual(location); expect(responses[1]!.data?.requestedLocation.lat).toBe(-2.214);
  });
  it('uses a persistent lease across independent instances', async () => {
    const store = new TestObjectStore(); let calls = 0;
    const first = new AirRepository(store), second = new AirRepository(store); const lease = await first.claim(location, SYNTHETIC_NOW);
    expect(lease).not.toBeNull(); expect(await second.claim(location, SYNTHETIC_NOW)).toBeNull();
    const service = new AirService(second, async () => { calls++; return content(); }, () => SYNTHETIC_NOW);
    expect((await service.get(location)).meta.state).toBe('unavailable'); expect(calls).toBe(0);
    await first.finish(lease!, content(), SYNTHETIC_NOW); expect((await service.get(location)).meta.state).toBe('ok');
  });
  it('preserves last-good on upstream failure, persists cooldown and expires at six hours', async () => {
    let now = SYNTHETIC_NOW, fail = false, calls = 0;
    const store = new TestObjectStore(), repo = new AirRepository(store);
    const service = new AirService(repo, async () => { calls++; if (fail) throw new Error('private upstream URL'); return content(); }, () => now);
    const fresh = await service.get(location); now = new Date(now.getTime() + HOUR_MS); fail = true;
    const stale = await service.get(location); expect(stale.meta.state).toBe('stale'); expect(stale.meta.dataVersion).toBe(fresh.meta.dataVersion); expect(stale.meta.fetchedAt).toBe(fresh.meta.fetchedAt);
    expect(JSON.stringify(stale)).not.toContain('private'); await service.get(location); expect(calls).toBe(2);
    now = new Date(SYNTHETIC_NOW.getTime() + 6 * HOUR_MS); expect(await service.get(location)).toMatchObject({ meta: { state: 'unavailable' }, data: null });
  });
  it('recovers a cancelled/expired lease and rejects the obsolete writer', async () => {
    const repo = new AirRepository(new TestObjectStore()); const old = await repo.claim(location, SYNTHETIC_NOW); const later = new Date(SYNTHETIC_NOW.getTime() + 70_000);
    const next = await repo.claim(location, later); expect(next).not.toBeNull(); await expect(repo.finish(old!, content(), later)).rejects.toBeInstanceOf(StoreConflict);
    await repo.finish(next!, content(), later); expect((await repo.read(location)).failed).toBe(false);
  });
  it('rejects corrupted gzip, checksum and metadata then fetches a valid replacement', async () => {
    const store = new TestObjectStore(), repo = new AirRepository(store);
    const service = new AirService(repo, async () => content(), () => SYNTHETIC_NOW); await service.get(location);
    await store.put('air/cache/-2.21_113.92.json.gz', Buffer.from('corrupt')); await store.put('air/attempts/-2.21_113.92.json', Buffer.from('corrupt'));
    expect((await repo.read(location)).record).toBeNull(); expect((await service.get(location)).meta.state).toBe('ok');
  });
  it('does not publish a fresh source when persistence fails', async () => {
    const store = new TestObjectStore(); store.failWrites = true;
    const service = new AirService(new AirRepository(store), async () => content(), () => SYNTHETIC_NOW);
    expect(await service.get(location)).toMatchObject({ meta: { state: 'unavailable' }, data: null });
  });
  it('rejects valid gzip whose record was changed without updating its checksum', async () => {
    const store = new TestObjectStore(), repo = new AirRepository(store);
    const lease = await repo.claim(location, SYNTHETIC_NOW); await repo.finish(lease!, content(), SYNTHETIC_NOW);
    const key = 'air/cache/-2.21_113.92.json.gz';
    const envelope = JSON.parse(gunzipSync((await store.get(key))!.body).toString());
    envelope.record.fetchedAt = '2026-10-27T14:00:00.000Z';
    await store.put(key, gzipSync(Buffer.from(JSON.stringify(envelope))));
    const read = await repo.read(location); expect(read.record).toBeNull(); expect(read.issues.some(issue => issue.code === 'invalid-response')).toBe(true);
  });
  it('does not retry missing current hour on every request inside the minimum retry interval', async () => {
    let calls = 0; const value = content(); value.series.find(sample => sample.validAt === '2026-10-27T13:00:00.000Z')!.pm25UgM3 = null;
    const service = new AirService(new AirRepository(new TestObjectStore()), async () => { calls++; return value; }, () => SYNTHETIC_NOW);
    expect((await service.get(location)).meta.state).toBe('unavailable'); await service.get(location); expect(calls).toBe(1);
  });
  it('prunes only records older than 24 hours while CAS preserves a concurrent update', async () => {
    const store = new TestObjectStore(), repo = new AirRepository(store); const lease = await repo.claim(location, SYNTHETIC_NOW); await repo.finish(lease!, content(), SYNTHETIC_NOW);
    expect(await repo.prune(new Date(SYNTHETIC_NOW.getTime() + 23 * HOUR_MS))).toBe(0);
    expect(await repo.prune(new Date(SYNTHETIC_NOW.getTime() + 25 * HOUR_MS))).toBe(2);
    const folder = await mkdtemp(join(tmpdir(), 'lentera-air-delete-')); folders.push(folder); const disk = new FileObjectStore(folder);
    await disk.put('air/test.json', Buffer.from('old')); const before = await disk.get('air/test.json'); await disk.put('air/test.json', Buffer.from('new'));
    await expect(disk.delete('air/test.json', before!.etag)).rejects.toBeInstanceOf(StoreConflict); expect((await disk.get('air/test.json'))!.body.toString()).toBe('new');
  });
  it.each(['', 'lat=&lon=113.92', 'lat=NaN&lon=113.92', 'lat=-2.21&lon=113.92&lat=1', 'lat=3.14&lon=101.69', 'lat=-2.21&lon=113.92&aqi=10', 'lat=91&lon=113.92'])('rejects invalid, foreign or extra query %s', text => expect(() => parseAirQuery(new URLSearchParams(text))).toThrow());
});
