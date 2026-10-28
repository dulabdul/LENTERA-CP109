/** SYNTHETIC test fixtures. Never import into operational UI or ingest job. */
import { fieldLocations, type FieldGrid, type FieldSnapshot } from '../src/lib/air-field/contracts';
export const FIELD_TEST_NOW = new Date('2026-10-27T12:00:00.000Z');
export const SMALL_FIELD_GRID: FieldGrid = { west: 110, south: -3, east: 111, north: -2, step: 1, nx: 2, ny: 2 };
export function syntheticField(grid: FieldGrid = SMALL_FIELD_GRID): FieldSnapshot {
  const locations = fieldLocations(grid);
  return { schemaVersion: '1.0', kind: 'pm25-model-grid', source: 'open-meteo-cams-global', nativeResolutionDegrees: 0.4, grid,
    startedAt: FIELD_TEST_NOW.toISOString(), fetchedAt: FIELD_TEST_NOW.toISOString(), runAt: null, synthetic: true, modelLocations: locations,
    frames: Array.from({ length: 25 }, (_, i) => ({ validAt: new Date(FIELD_TEST_NOW.getTime() + i * 3_600_000).toISOString(), values: locations.map((_, j) => 10 + j) })),
    attribution: 'PM2.5: Open-Meteo / Copernicus CAMS global; model, bukan sensor. Sampling LENTERA, bukan grid native.' };
}
// Contract simulation for in-memory stores or isolated temporary test directories only.
// Never publish this fixture into the operational .data namespace or R2.
export function mockOperationalField(grid: FieldGrid = SMALL_FIELD_GRID): FieldSnapshot { return { ...syntheticField(grid), synthetic: false }; }
export function syntheticFieldProviderRow(lat: number, lon: number) { return { latitude: lat, longitude: lon, utc_offset_seconds: 0, hourly_units: { time: 'unixtime', pm2_5: 'µg/m³' }, hourly: { time: Array.from({ length: 25 }, (_, i) => FIELD_TEST_NOW.getTime() / 1000 + i * 3600), pm2_5: Array(25).fill(22) } }; }
