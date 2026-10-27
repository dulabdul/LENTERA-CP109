import { projectAir, type AirResponse } from './air-series';
import type { AqiCategory, HourPm25 } from './contracts';
import { HOUR_MS } from './policy';
export const aqiLabels: Record<AqiCategory, string> = {
  good: 'Baik', moderate: 'Sedang', sensitive: 'Tidak sehat bagi kelompok sensitif', unhealthy: 'Tidak sehat', very_unhealthy: 'Sangat tidak sehat', hazardous: 'Berbahaya',
};
export function airLocationKey(location: { lat: number; lon: number }) { return `${location.lat},${location.lon}`; }
export function airView(response: AirResponse, now: Date, offline: boolean, refreshFailed: boolean): AirResponse {
  if (!response.data) return response;
  const data = response.data;
  const series = [...data.history, ...(data.current ? [data.current] : []), ...data.forecast].sort((a, b) => a.validAt.localeCompare(b.validAt));
  const projected = projectAir({ schemaVersion: '1.0', fetchedAt: response.meta.fetchedAt!, dataVersion: response.meta.dataVersion!, content: {
    source: data.source, queryLocation: data.queryLocation, modelGridLocation: data.modelGridLocation, runAt: data.runAt, series, issues: response.meta.issues,
  } }, data.requestedLocation, now, { failed: offline || refreshFailed || response.meta.state === 'stale', lastAttemptAt: response.meta.lastAttemptAt });
  if (response.meta.state === 'partial' && projected.meta.state === 'ok') projected.meta.state = 'partial';
  return projected;
}
// Nulls and absent hours split line segments: the chart never interpolates missing values.
export function airChartSegments(series: HourPm25[]): Array<Array<{ at: number; value: number }>> {
  const segments: Array<Array<{ at: number; value: number }>> = []; let segment: Array<{ at: number; value: number }> = [];
  for (const sample of series) {
    const at = Date.parse(sample.validAt), value = sample.pm25UgM3;
    if (value === null || !Number.isFinite(value) || value < 0) { if (segment.length) segments.push(segment); segment = []; continue; }
    if (segment.length && at - segment.at(-1)!.at !== HOUR_MS) { segments.push(segment); segment = []; }
    segment.push({ at, value });
  }
  if (segment.length) segments.push(segment);
  return segments;
}
export function matchingAirLocation(response: AirResponse, location: { lat: number; lon: number }) {
  return !response.data || airLocationKey(response.data.requestedLocation) === airLocationKey(location);
}
