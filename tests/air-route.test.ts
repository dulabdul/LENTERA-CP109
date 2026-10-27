import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../src/app/api/air/route';
import { createAirRuntime } from '../src/lib/services/air-runtime';
import { AirService } from '../src/lib/services/air';
import { AirRepository } from '../src/lib/storage/air-repository';
import { TestObjectStore } from './helpers/object-store';
import { syntheticAirResponse } from '../fixtures/air-provider';
import { SYNTHETIC_NOW } from '../fixtures/provider-scenarios';
import { parseOpenMeteo } from '../src/lib/providers/open-meteo';
vi.mock('../src/lib/services/air-runtime', () => ({ createAirRuntime: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
const request = () => new Request('http://localhost/api/air?lat=-2.21&lon=113.92');
describe('GET /api/air in-process handler contract', () => {
  it('returns 400 before creating runtime for invalid input', async () => {
    const response = await GET(new Request('http://localhost/api/air?lat=3.14&lon=101.69'));
    expect(response.status).toBe(400); expect(createAirRuntime).not.toHaveBeenCalled();
  });
  it('returns source-shaped 503 on missing configuration and does not expose secrets', async () => {
    vi.mocked(createAirRuntime).mockReturnValue(null);
    const response = await GET(request()); expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ meta: { state: 'unavailable' }, data: null });
    vi.mocked(createAirRuntime).mockImplementation(() => { throw new Error('synthetic-secret-key'); });
    expect(await (await GET(request())).text()).not.toContain('synthetic-secret-key');
  });
  it('returns 429 with Retry-After before invoking source service', async () => {
    const get = vi.fn();
    const service = { get } as unknown as AirService;
    vi.mocked(createAirRuntime).mockReturnValue({ service, consume: async () => ({ allowed: false, retryAfter: 42 }) });
    const response = await GET(request()); expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('42'); expect(get).not.toHaveBeenCalled();
  });
  it('fails closed if the shared limiter fails', async () => {
    const get = vi.fn();
    vi.mocked(createAirRuntime).mockReturnValue({ service: { get } as unknown as AirService, consume: async () => { throw new Error('storage private detail'); } });
    const response = await GET(request()); expect(response.status).toBe(503); expect(get).not.toHaveBeenCalled(); expect(await response.text()).not.toContain('private');
  });
  it('returns model data through real service/cache/projection with a mocked provider', async () => {
    vi.useFakeTimers(); vi.setSystemTime(SYNTHETIC_NOW);
    const service = new AirService(new AirRepository(new TestObjectStore()), async location => parseOpenMeteo(syntheticAirResponse(), location, SYNTHETIC_NOW));
    vi.mocked(createAirRuntime).mockReturnValue({ service, consume: async () => ({ allowed: true, retryAfter: 0 }) });
    const response = await GET(request()); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json(); expect(body.data).toMatchObject({ source: 'open-meteo-cams-global', current: { pm25UgM3: 22 }, aqi: { status: 'available', value: 75 } });
    expect(body.data.runAt).toBeNull(); expect(body.data.forecast).toHaveLength(48);
  });
  it('returns partial as 200 with missing-index explanation', async () => {
    vi.useFakeTimers(); vi.setSystemTime(SYNTHETIC_NOW);
    const raw = syntheticAirResponse(); raw.hourly.pm2_5[raw.hourly.time.indexOf(Date.parse('2026-10-27T12:00:00Z') / 1000)] = null;
    const service = new AirService(new AirRepository(new TestObjectStore()), async location => parseOpenMeteo(raw, location, SYNTHETIC_NOW));
    vi.mocked(createAirRuntime).mockReturnValue({ service, consume: async () => ({ allowed: true, retryAfter: 0 }) });
    const response = await GET(request()); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ meta: { state: 'partial' }, data: { aqi: { status: 'unavailable' } } });
  });
});
