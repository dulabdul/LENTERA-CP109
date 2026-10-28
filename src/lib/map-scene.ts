import type { RasterSourceSpecification, RasterDEMSourceSpecification, StyleSpecification } from 'maplibre-gl';
import type { ViewBounds } from './hotspot-view';
import { POLICY } from './policy';
export type MapViewMode = 'flat' | 'globe' | 'terrain';
export type MapBasemap = 'map' | 'satellite';
export const VIEW_MODES: { id: MapViewMode; label: string; hint: string }[] = [
  { id: 'flat', label: 'Flat', hint: 'Peta datar untuk memeriksa deteksi' },
  { id: 'globe', label: 'Globe', hint: 'Permukaan bumi melengkung' },
  { id: 'terrain', label: '3D Terrain', hint: 'Elevasi model permukaan dengan kemiringan kamera' },
];
export const SCENE_PRESETS = {
  flat: { projection: 'mercator', pitch: 0, terrain: false },
  globe: { projection: 'globe', pitch: 0, terrain: false },
  terrain: { projection: 'globe', pitch: 60, terrain: true },
} as const;
export const SCENE_SOURCE = { map: 'scene-map', labels: 'scene-labels', satellite: 'scene-satellite', terrain: 'scene-dem' } as const;
export const SCENE_LAYER = { map: 'scene-map-layer', labels: 'scene-labels-layer', satellite: 'scene-satellite-layer' } as const;
export const ESRI_ATTRIBUTION = 'Tiles © <a href="https://www.esri.com/">Esri</a> · Esri, HERE, Garmin, OpenStreetMap contributors';
export const SATELLITE_ATTRIBUTION = 'Imagery © <a href="https://www.esri.com/">Esri</a> and imagery providers · <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer">Source & credits</a>';
export const TERRAIN_ATTRIBUTION = 'Elevation: <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen Terrain Tiles / AWS Open Data</a> · <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">DEM attribution</a>';
const esri = 'https://services.arcgisonline.com/ArcGIS/rest/services';
export function streetSource(key?: string): RasterSourceSpecification {
  return { type: 'raster', tiles: [key ? `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}` : `${esri}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: key ? 20 : 16,
    attribution: key ? '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · © <a href="https://carto.com/attribution/">CARTO</a>' : ESRI_ATTRIBUTION };
}
export function streetLabels(): RasterSourceSpecification { return { type: 'raster', tiles: [`${esri}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 16, attribution: ESRI_ATTRIBUTION }; }
export function satelliteSource(): RasterSourceSpecification { return { type: 'raster', tiles: [`${esri}/World_Imagery/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19, attribution: SATELLITE_ATTRIBUTION }; }
export function terrainSource(): RasterDEMSourceSpecification { return { type: 'raster-dem', tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 13, attribution: TERRAIN_ATTRIBUTION }; }
export function createSceneStyle(key?: string): StyleSpecification {
  return { version: 8, sources: { [SCENE_SOURCE.map]: streetSource(key), ...(!key ? { [SCENE_SOURCE.labels]: streetLabels() } : {}) }, layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0b1220' } },
    { id: SCENE_LAYER.map, type: 'raster', source: SCENE_SOURCE.map },
    ...(!key ? [{ id: SCENE_LAYER.labels, type: 'raster' as const, source: SCENE_SOURCE.labels }] : []),
  ] };
}
// The old detection filter accepts one rectangle. Normalize camera world copies
// and intersect its bounding rectangle with the existing Indonesia data coverage.
export function cameraDataBounds(bounds: ViewBounds): ViewBounds | null {
  let [west, south, east, north] = bounds;
  if (![west,south,east,north].every(Number.isFinite) || north < south) return null;
  if (east < west) east += 360 * Math.ceil((west - east) / 360);
  const [rw,rs,re,rn] = POLICY.INDONESIA_FETCH_BBOX;
  if (north < rs || south > rn) return [180,90,180,90];
  const low = Math.max(rs,south), high = Math.min(rn,north);
  if (east - west >= 360) return [rw,low,re,high];
  const offset = Math.floor((west - rw) / 360);
  const spans: [number,number][] = [];
  for (let shift = offset - 1; shift <= offset + 2; shift++) {
    const w = Math.max(rw,west - shift * 360), e = Math.min(re,east - shift * 360);
    if (w <= e) spans.push([w,e]);
  }
  return spans.length ? [Math.min(...spans.map(s=>s[0])),low,Math.max(...spans.map(s=>s[1])),high] : [180,90,180,90];
}
export function regionalCameraBounds(mode: MapViewMode): [[number,number],[number,number]] | null { return mode === 'flat' ? [[90,-18],[148,15]] : null; }
