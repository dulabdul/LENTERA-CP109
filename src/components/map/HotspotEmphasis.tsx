'use client';
import { useEffect } from 'react';
import type { GeoJSONSource, Map as LibreMap, Marker } from 'maplibre-gl';
import type { HotspotPayload } from '@/lib/contracts';
export function HotspotEmphasis({ map, selected }: { map: LibreMap | null; selected: HotspotPayload['features'][number] | null }) {
  useEffect(() => {
    if (!map) return;
    let disposed = false; const markers = new Map<number, Marker>();
    void import('maplibre-gl').then(({ Marker }) => {
      if (disposed) return;
      const sync = () => {
        if (disposed || !map.getLayer('clusters')) return;
        const keep = new Set<number>();
        for (const feature of map.queryRenderedFeatures(undefined, { layers: ['clusters'] }).slice(0, 200)) {
          if (feature.geometry.type !== 'Point') continue;
          const id = Number(feature.properties?.cluster_id), count = Number(feature.properties?.point_count);
          if (!Number.isSafeInteger(id) || !Number.isSafeInteger(count) || count < 1 || keep.has(id)) continue;
          keep.add(id); const coordinate = feature.geometry.coordinates as [number, number];
          let marker = markers.get(id);
          if (!marker) {
            const element = document.createElement('span'); element.className = 'hotspot-cluster-count'; element.setAttribute('aria-hidden', 'true');
            marker = new Marker({ element, anchor: 'center', opacityWhenCovered: 0 }).setLngLat(coordinate).addTo(map); markers.set(id, marker);
          }
          marker.setLngLat(coordinate); marker.getElement().textContent = count.toLocaleString('id-ID');
          marker.getElement().style.pointerEvents = 'none'; // Existing canvas cluster handler receives the click.
        }
        for (const [id, marker] of markers) if (!keep.has(id)) { marker.remove(); markers.delete(id); }
      };
      map.on('idle', sync); sync();
      cleanup = () => map.off('idle', sync);
    });
    let cleanup = () => {};
    return () => { disposed = true; cleanup(); markers.forEach(marker => marker.remove()); };
  }, [map]);
  useEffect(() => {
    if (!map) return;
    map.addSource('selected-detection', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'selected-detection-halo', type: 'circle', source: 'selected-detection', paint: { 'circle-radius': 14, 'circle-color': '#f97316', 'circle-opacity': 0.22, 'circle-stroke-color': '#fbbf24', 'circle-stroke-width': 2 } });
    return () => { if (map.getLayer('selected-detection-halo')) map.removeLayer('selected-detection-halo'); if (map.getSource('selected-detection')) map.removeSource('selected-detection'); };
  }, [map]);
  useEffect(() => { const source = map?.getSource('selected-detection') as GeoJSONSource | undefined; void source?.setData({ type: 'FeatureCollection', features: selected ? [selected] : [] }).catch(() => {}); }, [map, selected]);
  return null;
}
