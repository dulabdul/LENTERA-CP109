import 'server-only';
import { buildOpenMeteoUrl, parseOpenMeteo } from '../providers/open-meteo';
import { fieldLocations, fieldSnapshotSchema, FIELD_POLICY, type FieldGrid, type FieldSnapshot } from './contracts';
import type { Location } from '../contracts';
const HOUR = 3_600_000;
export interface FieldProviderOptions {
  grid: FieldGrid; now: Date; baseUrl: string; key?: string;
  request: (url: string) => Promise<unknown>; reserve: (units: number) => Promise<void>;
  sleep?: (ms: number) => Promise<void>; finishedAt?: () => Date; progress?: (completed: number, total: number) => void;
}
export function buildFieldBatchUrl(baseUrl: string, locations: Location[], now: Date, key?: string) {
  if (!locations.length || locations.length > FIELD_POLICY.batchSize) throw Error('Invalid field batch');
  const url = new URL(buildOpenMeteoUrl(baseUrl, locations[0]!, key));
  url.searchParams.set('latitude', locations.map(p => p.lat).join(',')); url.searchParams.set('longitude', locations.map(p => p.lon).join(','));
  url.searchParams.delete('past_days'); url.searchParams.delete('forecast_days');
  const hour = Math.floor(now.getTime() / HOUR) * HOUR;
  url.searchParams.set('start_hour', new Date(hour).toISOString().slice(0, 13) + ':00'); url.searchParams.set('end_hour', new Date(hour + FIELD_POLICY.horizonHours * HOUR).toISOString().slice(0, 13) + ':00');
  return url.toString();
}
export async function buildAirField(options: FieldProviderOptions): Promise<FieldSnapshot> {
  const locations = fieldLocations(options.grid), size = locations.length, hour = Math.floor(options.now.getTime() / HOUR) * HOUR;
  const frames = Array.from({ length: FIELD_POLICY.horizonHours + 1 }, (_, i) => ({ validAt: new Date(hour + i * HOUR).toISOString(), values: Array<number | null>(size).fill(null) }));
  const modelLocations = Array<Location | null>(size).fill(null), sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  for (let start = 0; start < size; start += FIELD_POLICY.batchSize) {
    const batch = locations.slice(start, start + FIELD_POLICY.batchSize);
    let values: unknown[] | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      await options.reserve(batch.length); // Account for every coordinate, also failed attempts/retry.
      try {
        const raw = await options.request(buildFieldBatchUrl(options.baseUrl, batch, options.now, options.key));
        const rows = Array.isArray(raw) ? raw : batch.length === 1 ? [raw] : [];
        if (rows.length !== batch.length) throw Error('Incorrect field batch size'); values = rows; break;
      } catch { if (attempt === 0) await sleep(2000); }
    }
    if (values) for (let n = 0; n < batch.length; n++) {
      try {
        const series = parseOpenMeteo(values[n], batch[n]!, options.now), byHour = new Map(series.series.map(p => [p.validAt, p.pm25UgM3]));
        if (Math.abs(series.modelGridLocation.lat - batch[n]!.lat) > 0.5 || Math.abs(series.modelGridLocation.lon - batch[n]!.lon) > 0.5) throw Error('Mismatched field location');
        const index = start + n; modelLocations[index] = series.modelGridLocation;
        for (const frame of frames) frame.values[index] = byHour.get(frame.validAt) ?? null;
      } catch { /* Explicit null column; partial coverage, never zero filling. */ }
    }
    options.progress?.(Math.min(start + batch.length, size), size);
    if (start + batch.length < size) await sleep(1500); // <=400 coordinate units/minute before retries.
  }
  if (frames[0]!.values.every(v => v === null)) throw Error('No usable current field samples; keep the previous snapshot');
  return fieldSnapshotSchema.parse({ schemaVersion: '1.0', kind: 'pm25-model-grid', source: 'open-meteo-cams-global', nativeResolutionDegrees: 0.4, grid: options.grid,
    startedAt: options.now.toISOString(), fetchedAt: (options.finishedAt?.() ?? options.now).toISOString(), runAt: null, synthetic: false, modelLocations, frames,
    attribution: 'PM2.5: Open-Meteo / Copernicus CAMS global; model, bukan sensor. Sampling LENTERA, bukan grid native.' });
}
