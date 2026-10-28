import { describe, it, expect, vi } from 'vitest';
import { fieldSnapshotSchema, projectField, FIELD_POLICY, fieldLocations } from '../src/lib/air-field/contracts';
import { buildAirField, buildFieldBatchUrl } from '../src/lib/air-field/provider';
import { AirFieldRepository, reserveFieldBudget } from '../src/lib/air-field/storage';
import { rasterField, sampleField, pm25Color } from '../src/lib/air-field/raster';
import { TestObjectStore } from './helpers/object-store';
import { FIELD_TEST_NOW as NOW, SMALL_FIELD_GRID as GRID, syntheticField, mockOperationalField, syntheticFieldProviderRow as row } from '../fixtures/air-field';

describe('MAP-E field contracts and meaning (synthetic fixtures only)', () => {
  it('validates dimensions, source locations, continuous UTC hours and prohibits null-to-zero columns', () => {
    const s = syntheticField(); expect(fieldSnapshotSchema.parse(s).frames).toHaveLength(25);
    s.frames[0]!.values.pop(); expect(() => fieldSnapshotSchema.parse(s)).toThrow();
    const missing = syntheticField(); missing.modelLocations[0] = null; expect(() => fieldSnapshotSchema.parse(missing)).toThrow();
    const time = syntheticField(); time.frames[1]!.validAt = time.frames[0]!.validAt; expect(() => fieldSnapshotSchema.parse(time)).toThrow();
    const mismatch = syntheticField(); mismatch.modelLocations[0] = { lat: 10, lon: 20 }; expect(() => fieldSnapshotSchema.parse(mismatch)).toThrow();
  });
  it('returns unavailable for synthetic, missing, future, expired or missing-current data', () => {
    expect(projectField(syntheticField(), 'v', NOW).data).toBeNull(); expect(projectField(null, null, NOW).data).toBeNull();
    const s = mockOperationalField(); expect(projectField(s, 'v', new Date(NOW.getTime() - 1)).data).toBeNull();
    expect(projectField(s, 'v', new Date(NOW.getTime() + FIELD_POLICY.maxAgeMs + 1)).data).toBeNull();
    s.frames.shift(); expect(projectField(s, 'v', NOW).data).toBeNull();
  });
  it('distinguishes fresh, partial, stale at exact threshold, failed refresh and legitimate zeros', () => {
    const s = mockOperationalField(); expect(projectField(s, 'v', NOW).meta.state).toBe('ok');
    expect(projectField(s, 'v', new Date(NOW.getTime() + FIELD_POLICY.freshMs)).meta.state).toBe('stale');
    expect(projectField(s, 'v', NOW, true).meta.state).toBe('stale');
    s.frames[0]!.values[0] = null; expect(projectField(s, 'v', NOW).meta.state).toBe('partial');
    s.frames[0]!.values.fill(0); expect(projectField(s, 'v', NOW).meta.state).toBe('ok');
    s.frames[0]!.values.fill(null); expect(projectField(s, 'v', NOW).data).toBeNull();
  });
});
describe('MAP-E batch builder and budget', () => {
  const request = async (value: string) => { const u = new URL(value); return u.searchParams.get('latitude')!.split(',').map((lat, i) => row(Number(lat), Number(u.searchParams.get('longitude')!.split(',')[i]))); };
  it('requests multiple actual sample coordinates and assembles row-major timed values', async () => {
    const reserve = vi.fn(async () => {}), fetcher = vi.fn(request);
    const s = await buildAirField({ grid: GRID, now: NOW, baseUrl: 'https://air-quality-api.open-meteo.com', request: fetcher, reserve, sleep: async () => {} });
    expect(reserve).toHaveBeenCalledWith(4); expect(fetcher).toHaveBeenCalledTimes(1); expect(s.frames[0]!.values).toEqual([22, 22, 22, 22]); expect(s.modelLocations).toEqual(fieldLocations(GRID));
    const url = new URL(fetcher.mock.calls[0]![0]); expect(url.searchParams.get('domains')).toBe('cams_global'); expect(url.searchParams.get('start_hour')).toBe('2026-10-27T12:00'); expect(url.searchParams.has('past_days')).toBe(false);
    expect(() => buildFieldBatchUrl('https://untrusted.invalid', fieldLocations(GRID), NOW)).toThrow();
  });
  it('leaves failed source columns null, accounts retry coordinates, and refuses all-failed publication', async () => {
    const larger = { ...GRID, east: 115, nx: 6 }, reserve = vi.fn(async () => {});
    const fetcher = vi.fn(async (url: string) => { const u = new URL(url); if (u.searchParams.get('latitude')!.split(',').length === 10) throw Error('synthetic failure'); return request(url); });
    const s = await buildAirField({ grid: larger, now: NOW, baseUrl: 'https://air-quality-api.open-meteo.com', request: fetcher, reserve, sleep: async () => {} });
    expect(s.frames[0]!.values.filter(v => v !== null)).toHaveLength(2); expect(reserve.mock.calls.flat().reduce((n, v) => n + v, 0)).toBe(22);
    await expect(buildAirField({ grid: GRID, now: NOW, baseUrl: 'https://air-quality-api.open-meteo.com', request: async () => { throw Error(); }, reserve, sleep: async () => {} })).rejects.toThrow('No usable');
  });
  it('enforces shared persistent coordinate budget under concurrency without overspending', async () => {
    const store = new TestObjectStore(); const results = await Promise.allSettled(Array.from({ length: 8 }, () => reserveFieldBudget(store, NOW, 10, 30)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(3); const value = await store.get('air-field/budget/2026-10-27.json'); expect(JSON.parse(value!.body.toString()).used).toBe(30);
    await expect(reserveFieldBudget(store, NOW, 0, 30)).rejects.toThrow();
  });
});
describe('MAP-E immutable field storage and leases', () => {
  it('publishes/reads only checksummed snapshots and rejects synthetic operational publication', async () => {
    const store = new TestObjectStore(), repo = new AirFieldRepository(store);
    await expect(repo.publish(syntheticField())).rejects.toThrow('Synthetic'); const version = await repo.publish(mockOperationalField());
    expect((await repo.read(NOW)).meta.dataVersion).toBe(version);
    const key = `air-field/snapshots/${version}.json.gz`; const object = await store.get(key); object!.body[0] = 0;
    expect((await repo.read(NOW)).data).toBeNull();
  });
  it('prevents old snapshot writers overwriting a newer version', async () => {
    const repo = new AirFieldRepository(new TestObjectStore()), first = mockOperationalField(), second = mockOperationalField(); second.fetchedAt = new Date(NOW.getTime() + 1000).toISOString();
    await repo.publish(second); await expect(repo.publish(first)).rejects.toThrow(); expect((await repo.read(new Date(second.fetchedAt))).data?.fetchedAt).toBe(second.fetchedAt);
  });
  it('grants one live lease, handles failure, expires old writer and preserves previous data', async () => {
    const repo = new AirFieldRepository(new TestObjectStore()); await repo.publish(mockOperationalField());
    const later = new Date(NOW.getTime() + 1000), leases = await Promise.all([repo.claim(later), repo.claim(later)]); expect(leases.filter(Boolean)).toHaveLength(1); const lease = leases.find(Boolean)!;
    await repo.finish(lease, null, later); expect((await repo.read(later)).meta.state).toBe('stale');
    const next = await repo.claim(new Date(later.getTime() + 1)); expect(next).not.toBeNull(); await expect(repo.assertLease(lease, later)).rejects.toThrow();
    await expect(repo.assertLease(next!, new Date(later.getTime() + 21 * 60_000))).rejects.toThrow();
  });
});
describe('MAP-E concentration renderer', () => {
  it('samples row-major field with bilinear weights, exact nodes and outside/null masks', () => {
    expect(sampleField(GRID, [0, 10, 20, 30], 110.5, -2.5)).toBe(15);
    expect(sampleField(GRID, [0, null, 20, 30], 110.5, -2.5)).toBeNull(); expect(sampleField(GRID, [0, null, 20, 30], 110, -3)).toBe(0);
    expect(sampleField(GRID, [0, 10, 20, 30], 109, -2.5)).toBeNull(); expect(() => pm25Color(-1)).toThrow();
  });
  it('puts north at the top with Mercator-correct rows, caps color scale and keeps missing pixels transparent', () => {
    const raster = rasterField(GRID, { validAt: NOW.toISOString(), values: [0, 0, 100, 100] }, 40);
    expect([...raster.pixels.slice(0, 3)]).toEqual(pm25Color(100)); expect([...raster.pixels.slice(-4, -1)]).toEqual(pm25Color(0));
    const missing = rasterField(GRID, { validAt: NOW.toISOString(), values: [null, null, null, null] }, 40); expect(missing.pixels.every(v => v === 0)).toBe(true);
    expect(pm25Color(10000)).toEqual(pm25Color(150));
  });
});
