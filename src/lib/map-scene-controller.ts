import type { Map as LibreMap } from 'maplibre-gl';
import { regionalCameraBounds, satelliteSource, SCENE_LAYER, SCENE_PRESETS, SCENE_SOURCE, terrainSource, type MapBasemap, type MapViewMode } from './map-scene';
export function applyBasemap(map: LibreMap, selected: MapBasemap, streetFailed = false, labelsFailed = false) {
  if (selected === 'satellite' && !map.getSource(SCENE_SOURCE.satellite)) {
    map.addSource(SCENE_SOURCE.satellite, satelliteSource());
    const before = map.getLayer('country-fill') ? 'country-fill' : 'country-line';
    map.addLayer({ id: SCENE_LAYER.satellite, type: 'raster', source: SCENE_SOURCE.satellite, paint: { 'raster-fade-duration': 200 } }, map.getLayer(before) ? before : undefined);
  }
  for (const [id, visible] of [[SCENE_LAYER.map, selected === 'map' && !streetFailed], [SCENE_LAYER.labels, selected === 'map' && !streetFailed && !labelsFailed], [SCENE_LAYER.satellite, selected === 'satellite'], ['country-fill', selected === 'map' && streetFailed]] as const) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
}
export function applyProjection(map: LibreMap, selected: MapViewMode, reducedMotion: boolean) {
  const preset = SCENE_PRESETS[selected];
  map.setMaxBounds(regionalCameraBounds(selected));
  if (!preset.terrain) map.setTerrain(null);
  map.setProjection({ type: preset.projection });
  if (preset.terrain) {
    if (!map.getSource(SCENE_SOURCE.terrain)) map.addSource(SCENE_SOURCE.terrain, terrainSource());
    map.setTerrain({ source: SCENE_SOURCE.terrain, exaggeration: 1 });
  }
  map.setSky({ 'sky-color': '#101f37', 'horizon-color': '#243d59', 'fog-color': '#111c2d', 'sky-horizon-blend': 0.45, 'horizon-fog-blend': 0.3, 'fog-ground-blend': 0.15, 'atmosphere-blend': selected === 'flat' ? 0 : 0.45 });
  map.easeTo({ pitch: preset.pitch, padding: { top: 0, right: 0, left: 0, bottom: preset.terrain ? Math.round(map.getContainer().clientHeight * 0.12) : 0 }, duration: reducedMotion ? 0 : 280 });
}
export function isSceneSource(id?: string) { return !!id && (Object.values(SCENE_SOURCE) as string[]).includes(id); }

// Observe only the requested presentation source. Errors from data layers never
// change the basemap or scene. The returned cleanup owns every listener/timer.
export function observeSceneSource(map: LibreMap, source: string, onReady: () => void, onFailure: () => void, timeoutMs = 20_000) {
  let active = true, ready = false, failed = false;
  const fail = () => { if (active && !failed) { failed = true; onFailure(); } };
  const sync = () => { if (active && !failed && !ready && map.getSource(source) && map.isSourceLoaded(source)) { ready = true; onReady(); } };
  const error = (event: import('maplibre-gl').ErrorEvent & { sourceId?: string }) => { if (event.sourceId === source) fail(); };
  map.on('error', error); map.on('sourcedata', sync); map.on('idle', sync);
  const timer = setTimeout(() => { if (!ready) { sync(); if (!ready) fail(); } }, timeoutMs);
  // Wait for a source/idle event after visibility and projection have rendered.
  // A cached, previously hidden source may report loaded before requesting tiles.
  return () => { active = false; clearTimeout(timer); map.off('error', error); map.off('sourcedata', sync); map.off('idle', sync); };
}
