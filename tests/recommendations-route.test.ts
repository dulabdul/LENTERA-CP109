import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../src/app/api/recommendations/route';
import { GET as airGET } from '../src/app/api/air/route';
import { createAirRuntime } from '../src/lib/services/air-runtime';
import { AirService } from '../src/lib/services/air';
import { AirRepository } from '../src/lib/storage/air-repository';
import { AirRequestLimiter } from '../src/lib/services/air-limits';
import { parseOpenMeteo } from '../src/lib/providers/open-meteo';
import { syntheticAirResponse } from '../fixtures/air-provider';
import { SYNTHETIC_NOW } from '../fixtures/provider-scenarios';
import { recommendationResponseSchema } from '../src/lib/action-contracts';
import { TestObjectStore } from './helpers/object-store';
import type { Audience } from '../src/lib/contracts';
vi.mock('../src/lib/services/air-runtime', () => ({ createAirRuntime: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
const request = (query = 'lat=-2.21&lon=113.92') => new Request(`http://localhost/api/recommendations?${query}`);
function configured(value: number | null = 22, transform?: (raw: ReturnType<typeof syntheticAirResponse>) => void) {
  vi.useFakeTimers(); vi.setSystemTime(SYNTHETIC_NOW);
  const raw = syntheticAirResponse(SYNTHETIC_NOW, value); transform?.(raw);
  const store = new TestObjectStore(); let fetches = 0;
  const service = new AirService(new AirRepository(store), async location => { fetches++; return parseOpenMeteo(raw, location, SYNTHETIC_NOW); });
  vi.mocked(createAirRuntime).mockReturnValue({ service, consume: async () => ({ allowed: true, retryAfter: 0 }) });
  return { service, store, fetches: () => fetches };
}
describe('GET /api/recommendations, server-owned model basis', () => {
  for (const [value, category] of [[0, 'good'], [10, 'moderate'], [40, 'sensitive'], [70, 'unhealthy'], [150, 'very_unhealthy'], [250, 'hazardous'], [400, 'hazardous']] as const) {
    it.each(['general', 'sensitive', 'outdoor'] as const)(`returns verified basis for ${value} µg/m³ and %s`, async audience => {
      configured(value);
      const response = await GET(request(`lat=-2.21&lon=113.92&audience=${audience}`));
      expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
      const body = recommendationResponseSchema.parse(await response.json());
      expect(body.result).toMatchObject({ mode: 'targeted', audience, ruleId: `LK-AIR-${category}-${audience}-v1`, basis: { category, sampleCount: 24, beyondScale: value === 400 } });
      expect(body.result.basisDataVersion).toBe(body.meta.dataVersion); expect(body.result.validUntil).toBe('2026-10-27T14:00:00.000Z');
      if (body.result.mode === 'targeted') { expect(body.result.basis.periodTo).toBe('2026-10-27T13:00:00.000Z'); if (value === 400) expect(body.result.basis.value).toBeNull(); }
    });
  }
  it.each(['lat=-2.21&lon=113.92&aqi=10', 'lat=-2.21&lon=113.92&dataVersion=forged', 'lat=-2.21&lon=113.92&forTime=2026-10-20', 'lat=-2.21&lon=113.92&audience=general&audience=outdoor', 'lat=-2.21&lon=113.92&audience=unknown', 'lat=3.14&lon=101.69', 'lat=NaN&lon=113.92'])('rejects invalid or forged input before creating services: %s', async query => {
    expect((await GET(request(query))).status).toBe(400); expect(createAirRuntime).not.toHaveBeenCalled();
  });
  it('defaults audience and reuses the exact AirService cache/version from /api/air', async () => {
    const state = configured();
    const air = await (await airGET(new Request('http://localhost/api/air?lat=-2.21&lon=113.92'))).json();
    const recommendation = recommendationResponseSchema.parse(await (await GET(request())).json());
    expect(recommendation.result.audience).toBe('general'); expect(recommendation.result.basisDataVersion).toBe(air.meta.dataVersion); expect(state.fetches()).toBe(1);
  });
  it('returns partial as 200/limited with no category messages or stale basis', async () => {
    configured(22, raw => { raw.hourly.pm2_5[raw.hourly.time.indexOf(Date.parse('2026-10-27T12:00:00Z') / 1000)] = null; });
    const response = await GET(request()); expect(response.status).toBe(200);
    const body = recommendationResponseSchema.parse(await response.json()); expect(body.meta.state).toBe('partial'); expect(body.result).toMatchObject({ mode: 'limited', basis: null, ruleId: 'LK-DATA-LIMITED-v1' }); expect(body.result.reason).toContain('belum lengkap');
  });
  it('returns 503 with limited guidance for unavailable current samples', async () => {
    configured(null);
    const response = await GET(request()); expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ meta: { state: 'unavailable' }, result: { mode: 'limited', basis: null } });
  });
  it('never targets fallback after a failed fetch, and expires after six hours', async () => {
    const state = configured(); await GET(request()); state.store.failWrites = true;
    vi.setSystemTime(new Date(SYNTHETIC_NOW.getTime() + 3_600_000));
    const response = await GET(request()); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ meta: { state: 'stale' }, result: { mode: 'limited', basis: null } });
    vi.setSystemTime(new Date(SYNTHETIC_NOW.getTime() + 6 * 3_600_000)); expect((await GET(request())).status).toBe(503);
  });
  it('keeps limited guidance on missing config or exceptions without leaking raw errors', async () => {
    vi.mocked(createAirRuntime).mockReturnValue(null);
    expect(await (await GET(request())).json()).toMatchObject({ meta: { state: 'unavailable' }, result: { mode: 'limited' } });
    vi.mocked(createAirRuntime).mockImplementation(() => { throw new Error('synthetic-private-token'); });
    const response = await GET(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain('synthetic-private-token');
  });
  it('returns 429/Retry-After before touching the source, and fails closed on limiter failure', async () => {
    const get = vi.fn(); const service = { get } as unknown as AirService;
    vi.mocked(createAirRuntime).mockReturnValue({ service, consume: async () => ({ allowed: false, retryAfter: 31 }) });
    const blocked = await GET(request()); expect(blocked.status).toBe(429); expect(blocked.headers.get('retry-after')).toBe('31'); expect(get).not.toHaveBeenCalled();
    vi.mocked(createAirRuntime).mockReturnValue({ service, consume: async () => { throw new Error('private limiter'); } });
    expect((await GET(request())).status).toBe(503); expect(get).not.toHaveBeenCalled();
  });
  it('enforces a combined 20-request limit across air and recommendations', async () => {
    const state = configured(), limiter = new AirRequestLimiter(state.store, 'synthetic-shared-air-actions-secret');
    vi.mocked(createAirRuntime).mockReturnValue({ service: state.service, consume: (_request, now) => limiter.consume('synthetic-client', now) });
    for (let i = 0; i < 19; i++) expect((await airGET(new Request('http://localhost/api/air?lat=-2.21&lon=113.92'))).status).toBe(200);
    expect((await GET(request())).status).toBe(200); expect((await airGET(new Request('http://localhost/api/air?lat=-2.21&lon=113.92'))).status).toBe(429); expect(state.fetches()).toBe(1);
  });
});
