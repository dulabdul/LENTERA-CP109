import { z } from 'zod';
import { airPayloadSchema, dataIssueSchema, hourPm25Schema, isoUtcSchema, locationSchema, sourceResponseSchema, type DataIssue, type Location } from './contracts';
import { estimateAqi } from './aqi';
import { evaluateFreshness } from './freshness';
import { HOUR_MS, POLICY } from './policy';
import { currentHour } from './time';

export const airSeriesSchema = z.object({
  source: z.literal('open-meteo-cams-global'), queryLocation: locationSchema, modelGridLocation: locationSchema,
  runAt: isoUtcSchema.nullable(), series: z.array(hourPm25Schema).min(1).max(192), issues: z.array(dataIssueSchema),
}).strict().superRefine((value, ctx) => {
  const times = value.series.map(sample => Date.parse(sample.validAt));
  if (times.some((time, index) => time % HOUR_MS !== 0 || (index > 0 && time <= times[index - 1]!))) {
    ctx.addIssue({ code: 'custom', message: 'Air series must contain increasing, unique UTC hours' });
  }
});
export type AirSeries = z.infer<typeof airSeriesSchema>;
export const airCacheRecordSchema = z.object({
  schemaVersion: z.literal('1.0'), fetchedAt: isoUtcSchema, dataVersion: z.string().regex(/^[a-f0-9]{64}$/), content: airSeriesSchema,
}).strict();
export type AirCacheRecord = z.infer<typeof airCacheRecordSchema>;
export const airResponseSchema = sourceResponseSchema(airPayloadSchema).superRefine((response, ctx) => {
  if (!response.data) return;
  const hour = currentHour(new Date(response.meta.evaluatedAt)), data = response.data;
  const times = [...data.history, ...(data.current ? [data.current] : []), ...data.forecast].map(sample => Date.parse(sample.validAt));
  if (!data.current || Date.parse(data.current.validAt) !== hour || data.current.pm25UgM3 === null || new Set(times).size !== times.length || times.some(time => time % HOUR_MS !== 0)
    || data.history.some(sample => Date.parse(sample.validAt) < hour - 23 * HOUR_MS || Date.parse(sample.validAt) >= hour)
    || data.forecast.some(sample => Date.parse(sample.validAt) <= hour || Date.parse(sample.validAt) > hour + POLICY.AIR_FORECAST_HOURS * HOUR_MS)
    || (data.aqi.status === 'available' && (Date.parse(data.aqi.periodTo) !== hour || Date.parse(data.aqi.periodFrom) !== hour - 23 * HOUR_MS))) {
    ctx.addIssue({ code: 'custom', message: 'Air panel time or coverage inconsistent with evaluation hour' });
  }
});
export type AirResponse = z.infer<typeof airResponseSchema>;

export function airBucket(location: Location): Location {
  locationSchema.parse(location);
  return { lat: Number(location.lat.toFixed(POLICY.AIR_CACHE_COORD_DECIMALS)), lon: Number(location.lon.toFixed(POLICY.AIR_CACHE_COORD_DECIMALS)) };
}
export function airCacheKey(location: Location): string {
  const bucket = airBucket(location);
  return `${bucket.lat.toFixed(2)}_${bucket.lon.toFixed(2)}`;
}
export function projectAir(record: AirCacheRecord | null, location: Location, now: Date, options: { lastAttemptAt?: string | null; failed?: boolean; issues?: DataIssue[] } = {}): AirResponse {
  const hour = currentHour(now), content = record?.content;
  const current = content?.series.find(sample => Date.parse(sample.validAt) === hour) ?? null;
  const history = content?.series.filter(sample => { const time = Date.parse(sample.validAt); return time >= hour - 23 * HOUR_MS && time < hour; }) ?? [];
  const forecast = content?.series.filter(sample => { const time = Date.parse(sample.validAt); return time > hour && time <= hour + POLICY.AIR_FORECAST_HOURS * HOUR_MS; }) ?? [];
  const aqi = estimateAqi(content?.series ?? [], now);
  const issues: DataIssue[] = [...(content?.issues ?? []), ...(options.issues ?? [])];
  if (!current || current.pm25UgM3 === null) issues.push({ code: 'missing-hour', source: 'air', detail: 'Sampel PM2.5 untuk jam kini tidak tersedia.' });
  if (aqi.status === 'unavailable') issues.push({ code: 'missing-hour', source: 'air', detail: 'Indeks memerlukan 24 sampel jam yang lengkap dan valid.' });
  if (forecast.length < POLICY.AIR_FORECAST_HOURS || forecast.some(sample => sample.pm25UgM3 === null)) issues.push({ code: 'incomplete-forecast', source: 'air', detail: 'Cakupan prakiraan 48 jam belum lengkap; hanya sampel tersedia yang ditampilkan.' });
  const meta = evaluateFreshness({ kind: 'air', now, fetchedAt: record?.fetchedAt ?? null, dataVersion: record?.dataVersion ?? null, hasPayload: !!record,
    hasCurrentSample: !!current && current.pm25UgM3 !== null, runAt: content?.runAt, lastAttemptAt: options.lastAttemptAt ?? null, latestAttemptFailed: options.failed, issues });
  return airResponseSchema.parse({ meta, data: meta.state === 'unavailable' || !content ? null : {
    requestedLocation: location, queryLocation: content.queryLocation, modelGridLocation: content.modelGridLocation, source: content.source, runAt: content.runAt,
    current, history, forecast, aqi,
  } });
}
