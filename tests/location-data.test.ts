import { describe, expect, it } from 'vitest';
import { fetchLocationData, LocationRateLimited } from '../src/lib/location-data';
import { recommendationsFromAir } from '../src/lib/services/recommendations';
import { projectAir } from '../src/lib/air-series';
import { parseOpenMeteo } from '../src/lib/providers/open-meteo';
import { syntheticAirResponse } from '../fixtures/air-provider';
import { SYNTHETIC_NOW } from '../fixtures/provider-scenarios';
const location = { lat: -2.21, lon: 113.92 };
function air(version = 'a') { return projectAir({ schemaVersion: '1.0', fetchedAt: SYNTHETIC_NOW.toISOString(), dataVersion: version.repeat(64), content: parseOpenMeteo(syntheticAirResponse(), location, SYNTHETIC_NOW) }, location, SYNTHETIC_NOW); }
const controller = () => new AbortController();
describe('location request coordination without a DOM', () => {
  it('fetches air then recommendation with location/audience only, not a browser AQI', async () => {
    const calls: string[] = [], value = air(); const rec = recommendationsFromAir(value, location, 'sensitive', SYNTHETIC_NOW);
    const result = await fetchLocationData({ location, audience: 'sensitive', signal: controller().signal, fetch: async url => { calls.push(String(url)); return Response.json(calls.length === 1 ? value : rec); } });
    expect(calls).toEqual(['/api/air?lat=-2.21&lon=113.92', '/api/recommendations?lat=-2.21&lon=113.92&audience=sensitive']); expect(result.recommendation.response.result.audience).toBe('sensitive');
  });
  it('retries air once on version mismatch and exposes the matching new basis', async () => {
    const old = air('a'), fresh = air('b'), rec = recommendationsFromAir(fresh, location, 'general', SYNTHETIC_NOW); let calls = 0; const versions: Array<string | null> = [];
    const result = await fetchLocationData({ location, audience: 'general', signal: controller().signal, onAir: value => { versions.push(value.response.meta.dataVersion); }, fetch: async () => Response.json([old, rec, fresh][calls++]) });
    expect(calls).toBe(3); expect(versions).toEqual(['a'.repeat(64), 'b'.repeat(64)]); expect(result.air.response.meta.dataVersion).toBe(result.recommendation.response.result.basisDataVersion);
  });
  it('does not loop on a persistently mismatched version', async () => {
    const old = air('a'), other = air('b'), rec = recommendationsFromAir(other, location, 'general', SYNTHETIC_NOW); let calls = 0;
    const result = await fetchLocationData({ location, audience: 'general', signal: controller().signal, fetch: async () => Response.json(++calls === 2 ? rec : old) });
    expect(calls).toBe(3); expect(result.air.response.meta.dataVersion).not.toBe(result.recommendation.response.result.basisDataVersion);
  });
  it('does not accept an old response or invoke onAir after the selection is aborted', async () => {
    const active = controller(); let release!: (value: Response) => void, displayed = 0;
    const pending = fetchLocationData({ location, audience: 'general', signal: active.signal, onAir: () => { displayed++; }, fetch: async () => new Promise(resolve => { release = resolve; }) });
    active.abort(); release(Response.json(air())); await expect(pending).rejects.toThrow(); expect(displayed).toBe(0);
  });
  it('keeps valid air but rejects a late action response after audience/location changes', async () => {
    const active = controller(); let release!: (value: Response) => void, calls = 0, airCount = 0;
    const value = air(), rec = recommendationsFromAir(value, location, 'general', SYNTHETIC_NOW);
    const pending = fetchLocationData({ location, audience: 'general', signal: active.signal, onAir: () => { airCount++; }, fetch: async () => ++calls === 1 ? Response.json(value) : new Promise(resolve => { release = resolve; }) });
    await new Promise(resolve => setTimeout(resolve, 0)); active.abort(); release(Response.json(rec)); await expect(pending).rejects.toThrow(); expect(airCount).toBe(1);
  });
  it.each(['location', 'audience'] as const)('rejects recommendations with another %s', async kind => {
    const value = air(), rec = recommendationsFromAir(value, location, kind === 'audience' ? 'outdoor' : 'general', SYNTHETIC_NOW);
    if (kind === 'location') rec.result.location = { lat: -2.214, lon: 113.92 };
    let calls = 0; await expect(fetchLocationData({ location, audience: 'general', signal: controller().signal, fetch: async () => Response.json(++calls === 1 ? value : rec) })).rejects.toThrow('selection');
  });
  it('honors shared limiter Retry-After without further requests', async () => {
    let calls = 0;
    const promise = fetchLocationData({ location, audience: 'general', signal: controller().signal, fetch: async () => { calls++; return new Response('', { status: 429, headers: { 'retry-after': '42' } }); } });
    await expect(promise).rejects.toMatchObject({ seconds: 42 }); expect(calls).toBe(1);
    expect(new LocationRateLimited(42).message).not.toContain('http');
  });
  it('accepts source-shaped 503/limited responses without treating failure as zero', async () => {
    const unavailable = projectAir(null, location, SYNTHETIC_NOW), rec = recommendationsFromAir(unavailable, location, 'general', SYNTHETIC_NOW); let calls = 0;
    const result = await fetchLocationData({ location, audience: 'general', signal: controller().signal, fetch: async () => Response.json(++calls === 1 ? unavailable : rec, { status: 503 }) });
    expect(calls).toBe(2); expect(result.air.response.data).toBeNull(); expect(result.recommendation.response.result.mode).toBe('limited');
  });
});

describe('monotonic recommendation expiry', () => {
  it('does not extend the validity of a response delayed in transit', async () => {
    const { locationServerTime } = await import('../src/lib/location-data');
    const { recommendationView } = await import('../src/lib/recommendation-view');
    const value = air(), rec = recommendationsFromAir(value, location, 'general', SYNTHETIC_NOW);
    const now = locationServerTime({ response: value, startedAt: 1000 }, { response: rec, startedAt: 2000 }, 1_802_000);
    expect(now.getTime()).toBeGreaterThanOrEqual(Date.parse(rec.result.validUntil));
    expect(recommendationView({ air: value, recommendation: rec, location, audience: 'general', now }).mode).toBe('limited');
  });
  it('expires on tab return using elapsed monotonic time without relying on the device wall clock', async () => {
    const { locationServerTime } = await import('../src/lib/location-data');
    const value = air(), rec = recommendationsFromAir(value, location, 'general', SYNTHETIC_NOW);
    expect(locationServerTime({ response: value, startedAt: 100 }, { response: rec, startedAt: 100 }, 1100).toISOString()).toBe('2026-10-27T13:30:01.000Z');
    expect(locationServerTime({ response: value, startedAt: 100 }, { response: rec, startedAt: 100 }, 1_800_100).toISOString()).toBe('2026-10-27T14:00:00.000Z');
  });
});
