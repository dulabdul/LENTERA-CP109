import { latLngToCell, cellToBoundary, getHexagonAreaAvg, UNITS } from 'h3-js';
import type { FeatureCollection, Polygon } from 'geojson';
import type { DataState } from './contracts';
export type HexResolution = 4 | 5 | 6;
export interface HexInput { geometry: { type: 'Point'; coordinates: number[] }; properties: { id: string; acquiredAt: string } }
export interface HexProperties { id: string; count: number; firstAt: string; lastAt: string }
export type HotspotHexagons = FeatureCollection<Polygon, HexProperties>;
export const HEX_RESOLUTIONS: HexResolution[] = [4, 5, 6];
export function hexAreaKm2(resolution: HexResolution) { return getHexagonAreaAvg(resolution, UNITS.km2); }
export function buildHotspotHexagons(features: HexInput[], resolution: HexResolution, state: DataState): HotspotHexagons | null {
  if (!HEX_RESOLUTIONS.includes(resolution)) throw Error('Unsupported H3 resolution');
  if (state === 'unavailable') return null;
  const seen = new Set<string>(), cells = new Map<string, HexProperties>();
  for (const feature of features) {
    const [lon, lat] = feature.geometry.coordinates;
    if (feature.geometry.type !== 'Point' || !Number.isFinite(lon) || !Number.isFinite(lat) || lon! < -180 || lon! > 180 || lat! < -90 || lat! > 90 || !feature.properties.id || seen.has(feature.properties.id) || !Number.isFinite(Date.parse(feature.properties.acquiredAt))) throw Error('Invalid/duplicate detection for H3');
    seen.add(feature.properties.id);
    const id = latLngToCell(lat!, lon!, resolution), time = feature.properties.acquiredAt, cell = cells.get(id);
    if (cell) { cell.count++; if (time < cell.firstAt) cell.firstAt = time; if (time > cell.lastAt) cell.lastAt = time; }
    else cells.set(id, { id, count: 1, firstAt: time, lastAt: time });
  }
  return { type: 'FeatureCollection', features: [...cells.values()].sort((a, b) => a.id.localeCompare(b.id)).map(properties => ({ type: 'Feature', id: properties.id, properties, geometry: { type: 'Polygon', coordinates: [cellToBoundary(properties.id, true)] } })) };
}
