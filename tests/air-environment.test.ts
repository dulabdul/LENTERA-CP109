import { afterEach, describe, expect, it, vi } from 'vitest';
import { readEnvironment } from '../src/lib/env';
import { createAirRuntime } from '../src/lib/services/air-runtime';
import { R2ObjectStore } from '../src/lib/storage/object-store';
import type { S3Client } from '@aws-sdk/client-s3';
afterEach(() => vi.unstubAllEnvs());
describe('air configuration and production gates', () => {
  it.each([{OPEN_METEO_BASE_URL:'not-a-url'},{OPEN_METEO_BASE_URL:'https://invalid.test'},{OPEN_METEO_BASE_URL:'https://customer-air-quality-api.open-meteo.com'},{OPEN_METEO_API_KEY:'synthetic'},{AIR_UPSTREAM_REQUESTS_PER_DAY:'0'},{RATE_LIMIT_SECRET:'too-short'}])('rejects invalid provider/budget/secret config', config => expect(() => readEnvironment(config)).toThrow());
  it('accepts an explicit customer endpoint/key and integer budget', () => {
    expect(readEnvironment({OPEN_METEO_BASE_URL:'https://customer-air-quality-api.open-meteo.com',OPEN_METEO_API_KEY:'synthetic',AIR_UPSTREAM_REQUESTS_PER_DAY:'100',RATE_LIMIT_SECRET:'synthetic-long-secret-at-least-32-characters'}).server.AIR_UPSTREAM_REQUESTS_PER_DAY).toBe(100);
  });
  it('fails closed in production without persistent limiter wiring', () => {
    vi.stubEnv('NODE_ENV','production'); vi.stubEnv('RATE_LIMIT_PROVIDER',undefined); vi.stubEnv('RATE_LIMIT_SECRET',undefined); vi.stubEnv('AIR_UPSTREAM_REQUESTS_PER_DAY',undefined);
    expect(createAirRuntime()).toBeNull();
    vi.stubEnv('RATE_LIMIT_PROVIDER','hosting'); expect(createAirRuntime()).toBeNull();
  });
  it('does not issue an unsafe conditional R2 deletion when support is unverified', async () => {
    const send=vi.fn(); const store=new R2ObjectStore({send} as unknown as S3Client,'synthetic');
    await expect(store.delete('air/cache/synthetic.json.gz','synthetic-etag')).rejects.toThrow('not verified'); expect(send).not.toHaveBeenCalled();
  });
});
