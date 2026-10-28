import { afterEach, describe, it, expect, vi } from 'vitest';
import { GET } from '../src/app/api/air-field/route';
import { createAirFieldRepository } from '../src/lib/air-field/runtime';
import { AirFieldRepository } from '../src/lib/air-field/storage';
import { TestObjectStore } from './helpers/object-store';
import { FIELD_TEST_NOW, mockOperationalField } from '../fixtures/air-field';
vi.mock('../src/lib/air-field/runtime', () => ({ createAirFieldRepository: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
describe('GET /api/air-field snapshot-only endpoint (in-process tests)', () => {
  it('rejects query inputs before touching storage', async () => {
    const response = await GET(new Request('http://localhost/api/air-field?lat=0')); expect(response.status).toBe(400); expect(createAirFieldRepository).not.toHaveBeenCalled();
  });
  it('fails safely when storage/provider setup is absent, with no credential diagnostics', async () => {
    vi.mocked(createAirFieldRepository).mockReturnValue(null); expect((await GET(new Request('http://localhost/api/air-field'))).status).toBe(503);
    vi.mocked(createAirFieldRepository).mockImplementation(() => { throw Error('synthetic-private-token'); }); const result = await GET(new Request('http://localhost/api/air-field')); expect(result.status).toBe(503); expect(await result.text()).not.toContain('synthetic-private-token');
  });
  it('serves an existing snapshot without upstream fetch or changes to location AQI data', async () => {
    vi.useFakeTimers(); vi.setSystemTime(FIELD_TEST_NOW); const repo = new AirFieldRepository(new TestObjectStore()); await repo.publish(mockOperationalField());
    vi.mocked(createAirFieldRepository).mockReturnValue(repo); const result = await GET(new Request('http://localhost/api/air-field'));
    expect(result.status).toBe(200); expect(result.headers.get('cache-control')).toContain('s-maxage=60'); const body = await result.json(); expect(body.meta.state).toBe('ok'); expect(body.data.kind).toBe('pm25-model-grid'); expect(body.data).not.toHaveProperty('aqi');
  });
});
