import { describe, expect, it } from 'vitest';
import { estimateAqi } from '../src/lib/aqi';
import { evaluateActions } from '../src/lib/actions';
import { recommendationResponseSchema } from '../src/lib/action-contracts';
import { evaluateFreshness } from '../src/lib/freshness';
import { recommendationsFromAir, serveRecommendations } from '../src/lib/services/recommendations';
import type { AirService } from '../src/lib/services/air';
import { projectAir } from '../src/lib/air-series';
import { parseOpenMeteo } from '../src/lib/providers/open-meteo';
import { SYNTHETIC_NOW, syntheticPm25 } from '../fixtures/provider-scenarios';
import { syntheticAirResponse } from '../fixtures/air-provider';
const location = { lat: -2.21, lon: 113.92 };
const meta = evaluateFreshness({ kind: 'air', now: SYNTHETIC_NOW, hasPayload: true, fetchedAt: SYNTHETIC_NOW.toISOString(), dataVersion: 'synthetic-v1' });
const input = { now: SYNTHETIC_NOW, meta, location, audience: 'general' as const, aqi: estimateAqi(syntheticPm25(22), SYNTHETIC_NOW) };
function air() { return projectAir({ schemaVersion: '1.0', fetchedAt: SYNTHETIC_NOW.toISOString(), dataVersion: 'a'.repeat(64), content: parseOpenMeteo(syntheticAirResponse(), location, SYNTHETIC_NOW) }, location, SYNTHETIC_NOW); }
describe('recommendation validation and expiry', () => {
  it.each(['metadata-version', 'basis-version', 'source', 'rule', 'expiry', 'input-period', 'meta-state'] as const)('rejects a mismatched %s', kind => {
    const body = { meta, result: evaluateActions(input) }; const changed = structuredClone(body);
    if (kind === 'metadata-version') changed.meta.dataVersion = 'another';
    if (kind === 'basis-version') changed.result.basisDataVersion = 'another';
    if (kind === 'source') (changed.result.sourceUrls as string[])[0] = 'https://invalid.test';
    if (kind === 'rule') changed.result.ruleId = 'wrong';
    if (kind === 'expiry') changed.result.validUntil = '2026-10-27T14:01:00.000Z';
    if (kind === 'input-period' && changed.result.mode === 'targeted') changed.result.basis.periodFrom = '2026-10-27T12:00:00.000Z';
    if (kind === 'meta-state') changed.meta.state = 'stale';
    expect(recommendationResponseSchema.safeParse(changed).success).toBe(false);
  });
  it('ends limited mode at the next hour even if five minutes have not elapsed', () => {
    const now = new Date('2026-10-27T13:59:59Z');
    const result = evaluateActions({ ...input, now, meta: { ...meta, state: 'partial' } }); expect(result.validUntil).toBe('2026-10-27T14:00:00.000Z'); expect(result.mode).toBe('limited');
  });
  it('suppresses malformed index values rather than accepting fabricated categories', () => {
    const result = evaluateActions({ ...input, aqi: { ...input.aqi, status: 'available', value: 999 } as typeof input.aqi });
    expect(result).toMatchObject({ mode: 'limited', basis: null });
  });
  it('reprojects an hour boundary after source IO and checks exact location', () => {
    const response = recommendationsFromAir(air(), location, 'outdoor', new Date('2026-10-27T14:00:00Z'));
    expect(response.result.mode).toBe('limited'); expect(response.result.forTime).toBe('2026-10-27T14:00:00.000Z'); expect(response.meta.evaluatedAt).toBe('2026-10-27T14:00:00.000Z');
    expect(() => recommendationsFromAir(air(), { lat: -2.214, lon: 113.92 }, 'general', SYNTHETIC_NOW)).toThrow('location');
  });
  it('performs one bounded source read when the hour changes, restoring the full forecast horizon', async () => {
    const now = new Date('2026-10-27T14:00:00Z'); let reads = 0;
    const current = projectAir({ schemaVersion: '1.0', fetchedAt: SYNTHETIC_NOW.toISOString(), dataVersion: 'a'.repeat(64), content: parseOpenMeteo(syntheticAirResponse(), location, SYNTHETIC_NOW) }, location, now);
    const service = { get: async () => ++reads === 1 ? air() : current } as unknown as AirService;
    const response = await serveRecommendations(service, location, 'general', () => now);
    expect(reads).toBe(2); expect(response.result.mode).toBe('targeted'); expect(response.result.forTime).toBe(now.toISOString());
  });
  it('bounds targeted guidance by both source expiry and the next hour', () => {
    const result = evaluateActions({ ...input, meta: { ...meta, validUntil: '2026-10-27T13:30:10Z' } }); expect(result.validUntil).toBe('2026-10-27T13:30:10.000Z');
  });
});
