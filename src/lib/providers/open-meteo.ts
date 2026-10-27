import 'server-only';
import { z } from 'zod';
import { airSeriesSchema, type AirSeries } from '../air-series';
import { locationSchema, type DataIssue, type Location } from '../contracts';
import { HOUR_MS, POLICY } from '../policy';

export class AirProviderError extends Error {
  constructor(public readonly code: 'upstream-error' | 'invalid-response', public readonly retryable = false, public readonly retryAfterMs = 1000) {
    super(code === 'upstream-error' ? 'Pengambilan Open-Meteo gagal.' : 'Respons Open-Meteo tidak valid.');
  }
}
const rawSchema = z.object({
  latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180), utc_offset_seconds: z.literal(0),
  hourly_units: z.object({ time: z.literal('unixtime'), pm2_5: z.string() }),
  hourly: z.object({ time: z.array(z.number().int()).min(1).max(192), pm2_5: z.array(z.number().nullable()).max(192) }),
});
export function parseOpenMeteo(raw: unknown, queryLocation: Location, now: Date): AirSeries {
  const parsed = rawSchema.safeParse(raw);
  if (!parsed.success) throw new AirProviderError('invalid-response');
  const value = parsed.data;
  if (value.hourly_units.pm2_5.replace(/μ/g, 'µ') !== 'µg/m³' || value.hourly.time.length !== value.hourly.pm2_5.length || Math.abs(value.latitude - queryLocation.lat) > 1 || Math.abs(value.longitude - queryLocation.lon) > 1) throw new AirProviderError('invalid-response');
  const from = new Date(now); from.setUTCHours(0, 0, 0, 0); from.setUTCDate(from.getUTCDate() - 2);
  const to = from.getTime() + 5 * 24 * HOUR_MS;
  let invalidSamples = 0;
  const series = value.hourly.time.map((seconds, index) => {
    const ms = seconds * 1000, pm25 = value.hourly.pm2_5[index]!;
    if (!Number.isSafeInteger(ms) || ms < from.getTime() || ms >= to || ms % HOUR_MS !== 0 || (index > 0 && seconds <= value.hourly.time[index - 1]!)) throw new AirProviderError('invalid-response');
    const valid = pm25 === null || (Number.isFinite(pm25) && pm25 >= 0);
    if (!valid) invalidSamples++;
    return { validAt: new Date(ms).toISOString(), pm25UgM3: valid ? pm25 : null };
  });
  const issues: DataIssue[] = invalidSamples ? [{ code: 'invalid-response', source: 'air', detail: `${invalidSamples} nilai PM2.5 tidak valid ditandai tidak tersedia.` }] : [];
  // This endpoint does not document a model-run timestamp; never substitute fetch or generation time.
  return airSeriesSchema.parse({ source: 'open-meteo-cams-global', queryLocation, modelGridLocation: { lat: value.latitude, lon: value.longitude }, runAt: null, series, issues });
}
export function buildOpenMeteoUrl(baseUrl: string, queryLocation: Location, key?: string): string {
  locationSchema.parse(queryLocation);
  const url = new URL(baseUrl);
  const hosts = ['air-quality-api.open-meteo.com', 'customer-air-quality-api.open-meteo.com'];
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password || url.port || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new AirProviderError('invalid-response');
  if (url.hostname.startsWith('customer-') && !key) throw new AirProviderError('invalid-response');
  if (key && !url.hostname.startsWith('customer-')) throw new AirProviderError('invalid-response');
  url.pathname = '/v1/air-quality';
  const params: Record<string, string> = { latitude: String(queryLocation.lat), longitude: String(queryLocation.lon), hourly: 'pm2_5', domains: 'cams_global', past_days: '2', forecast_days: '3', timezone: 'GMT', timeformat: 'unixtime' };
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  if (key) url.searchParams.set('apikey', key);
  return url.toString();
}
export function createAirFetcher(options: { baseUrl: string; key?: string; fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; beforeRequest?: () => Promise<void> }) {
  const request = options.fetch ?? fetch;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  return async (location: Location, now: Date): Promise<AirSeries> => {
    const url = buildOpenMeteoUrl(options.baseUrl, location, options.key);
    for (let attempt = 0; attempt < 2; attempt++) {
      await options.beforeRequest?.();
      try {
        const response = await request(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(POLICY.UPSTREAM_TIMEOUT_SECONDS * 1000) });
        if (!response.ok) {
          const header = response.headers.get('retry-after');
          const delay = header ? (/^\d+$/.test(header) ? Number(header) * 1000 : Math.max(0, Date.parse(header) - now.getTime())) : 1000;
          await response.body?.cancel();
          throw new AirProviderError('upstream-error', response.status === 429 || response.status >= 500, Number.isFinite(delay) ? delay : 1000);
        }
        if (Number(response.headers.get('content-length')) > 1024 * 1024) throw new AirProviderError('invalid-response');
        const reader = response.body?.getReader(); if (!reader) throw new AirProviderError('invalid-response');
        const chunks: Uint8Array[] = []; let bytes = 0;
        try {
          while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 1024 * 1024) throw new AirProviderError('invalid-response'); chunks.push(part.value); }
        } finally { await reader.cancel().catch(() => {}); }
        let raw: unknown;
        try { raw = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AirProviderError('invalid-response'); }
        return parseOpenMeteo(raw, location, now);
      } catch (error) {
        const safe = error instanceof AirProviderError ? error : new AirProviderError('upstream-error', true);
        if (attempt === 1 || !safe.retryable || safe.retryAfterMs > 20_000) throw safe;
        await sleep(safe.retryAfterMs);
      }
    }
    throw new AirProviderError('upstream-error');
  };
}
