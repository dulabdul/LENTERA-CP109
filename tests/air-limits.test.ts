import { describe, expect, it } from 'vitest';
import { AirRequestLimiter, AirUpstreamBudget, requestLimitIdentity } from '../src/lib/services/air-limits';
import { TestObjectStore } from './helpers/object-store';
import { SYNTHETIC_NOW } from '../fixtures/provider-scenarios';
const secret = 'synthetic-secret-for-tests-never-production';
describe('persistent shared air/actions rate limits', () => {
  it('caps the combined count across two instances at 20 requests in a rolling minute', async () => {
    const store = new TestObjectStore(), a = new AirRequestLimiter(store, secret), b = new AirRequestLimiter(store, secret);
    for (let i = 0; i < 20; i++) expect((await (i % 2 ? a : b).consume('192.0.2.1', SYNTHETIC_NOW)).allowed).toBe(true);
    expect(await b.consume('192.0.2.1', SYNTHETIC_NOW)).toEqual({ allowed: false, retryAfter: 60 });
    expect((await b.consume('192.0.2.1', new Date(SYNTHETIC_NOW.getTime() + 60_000))).allowed).toBe(true);
    expect((await b.consume('192.0.2.2', SYNTHETIC_NOW)).allowed).toBe(true);
    expect(JSON.stringify([...store.objects.keys()])).not.toContain('192.0.2');
  });
  it('does not reset a rolling window at the next calendar minute', async () => {
    const limiter = new AirRequestLimiter(new TestObjectStore(), secret);
    for (let i = 0; i < 20; i++) await limiter.consume('synthetic', new Date('2026-10-27T13:30:59Z'));
    expect((await limiter.consume('synthetic', new Date('2026-10-27T13:31:00Z'))).retryAfter).toBe(59);
  });
  it('does not exceed the limit during concurrent writes', async () => {
    const store = new TestObjectStore(); const limiters = [new AirRequestLimiter(store, secret), new AirRequestLimiter(store, secret)];
    const result = await Promise.allSettled(Array.from({ length: 25 }, (_, i) => limiters[i % 2]!.consume('synthetic', SYNTHETIC_NOW)));
    const allowed = result.filter(item => item.status === 'fulfilled' && item.value.allowed).length;
    expect(allowed).toBeLessThanOrEqual(20); expect(allowed).toBeGreaterThan(0);
    const state = JSON.parse([...store.objects.values()][0]!.body.toString()); expect(state.acceptedAt.length).toBe(allowed);
  });
  it('fails closed when storage is unavailable or state is corrupt', async () => {
    const store = new TestObjectStore(), limiter = new AirRequestLimiter(store, secret); store.failWrites = true;
    await expect(limiter.consume('synthetic', SYNTHETIC_NOW)).rejects.toThrow(); store.failWrites = false; await limiter.consume('synthetic', SYNTHETIC_NOW);
    await store.put([...store.objects.keys()][0]!, Buffer.from('corrupt')); await expect(limiter.consume('synthetic', SYNTHETIC_NOW)).rejects.toThrow();
  });
  it('does not trust forwarded headers on arbitrary development/production hosts', () => {
    const request = new Request('http://localhost/api/air', { headers: { 'x-forwarded-for': '192.0.2.1' } });
    expect(requestLimitIdentity(request, false, false)).toBe('development-shared'); expect(() => requestLimitIdentity(request, false, true)).toThrow();
    expect(() => requestLimitIdentity(request, true, true)).toThrow();
  });
  it('normalizes trusted IPv6 identities and rejects multi-value or invalid headers', () => {
    const identity = (value: string) => requestLimitIdentity(new Request('https://synthetic.test/api/air', { headers: { 'x-vercel-forwarded-for': value } }), true, true);
    expect(identity('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(identity('2001:db8::1')); expect(identity('::ffff:192.0.2.1')).toBe('192.0.2.1');
    expect(() => identity('192.0.2.1,192.0.2.2')).toThrow(); expect(() => identity('not-an-ip')).toThrow();
  });
  it('shares an explicit daily upstream budget and counts retries separately', async () => {
    const store = new TestObjectStore(), a = new AirUpstreamBudget(store, 2), b = new AirUpstreamBudget(store, 2);
    await a.consume(SYNTHETIC_NOW); await b.consume(SYNTHETIC_NOW); await expect(a.consume(SYNTHETIC_NOW)).rejects.toThrow('Batas');
    await expect(a.consume(new Date('2026-10-28T00:00:00Z'))).resolves.toBeUndefined();
  });
});

describe('maintenance retention', () => {
  it('removes expired limiter identities and old budgets without deleting an active counter', async () => {
    const { pruneAirLimits } = await import('../src/lib/services/air-limits');
    const store = new TestObjectStore();
    await new AirRequestLimiter(store, secret).consume('synthetic', SYNTHETIC_NOW); await new AirUpstreamBudget(store, 2).consume(SYNTHETIC_NOW);
    expect(await pruneAirLimits(store, new Date(SYNTHETIC_NOW.getTime() + 25 * 3_600_000))).toBe(1);
    expect([...store.objects.keys()]).toEqual(['limits/upstream/2026-10-27.json']);
    expect(await pruneAirLimits(store, new Date(SYNTHETIC_NOW.getTime() + 49 * 3_600_000))).toBe(1);
  });
});
