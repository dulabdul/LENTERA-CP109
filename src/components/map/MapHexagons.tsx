'use client';
import { useEffect, useMemo } from 'react';
import type { GeoJSONSource, Map as LibreMap, Marker } from 'maplibre-gl';
import { cellToLatLng } from 'h3-js';
import { buildHotspotHexagons, HEX_RESOLUTIONS, hexAreaKm2, type HexInput, type HexResolution, type HexProperties } from '@/lib/hotspot-hexagons';
import type { DataState } from '@/lib/contracts';
import { formatWib } from '@/lib/hotspot-view';
export function MapHexagons({ map, features, state, period, mode, onMode, resolution, onResolution, selectedId, onSelection }: {
  map: LibreMap | null; features: HexInput[]; state: DataState; period: string; mode: 'heatmap' | 'points' | 'hexagons'; onMode: (value: 'heatmap' | 'points' | 'hexagons') => void;
  resolution: HexResolution; onResolution: (value: HexResolution) => void; selectedId: string | null; onSelection: (value: HexProperties | null) => void;
}) {
  const { collection, invalid } = useMemo(() => {
    try { return { collection: mode === 'hexagons' ? buildHotspotHexagons(features, resolution, state) : null, invalid: false }; }
    catch { return { collection: null, invalid: true }; }
  }, [features, resolution, state, mode]);
  useEffect(() => {
    if (!map) return;
    map.addSource('hotspot-hexagons', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const before = map.getLayer('province-line') ? 'province-line' : 'clusters';
    map.addLayer({ id: 'hotspot-hex-fill', type: 'fill', source: 'hotspot-hexagons', paint: { 'fill-color': ['interpolate', ['linear'], ['get', 'count'], 1, '#0e7490', 10, '#2563eb', 100, '#9333ea'], 'fill-opacity': 0.48 } }, before);
    map.addLayer({ id: 'hotspot-hex-line', type: 'line', source: 'hotspot-hexagons', paint: { 'line-color': '#7dd3fc', 'line-opacity': 0.85, 'line-width': 1 } }, before);
    return () => { for (const id of ['hotspot-hex-line', 'hotspot-hex-fill']) if (map.getLayer(id)) map.removeLayer(id); if (map.getSource('hotspot-hexagons')) map.removeSource('hotspot-hexagons'); };
  }, [map]);
  useEffect(() => {
    const source = map?.getSource('hotspot-hexagons') as GeoJSONSource | undefined;
    if (!map || !source) return;
    void source.setData(collection ?? { type: 'FeatureCollection', features: [] }).catch(() => {});
    if (map.getLayer('hotspot-heatmap')) map.setLayoutProperty('hotspot-heatmap', 'visibility', mode === 'heatmap' ? 'visible' : 'none');
    for (const id of ['clusters', 'detections', 'selected-detection-halo']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', mode === 'hexagons' ? 'none' : 'visible');
    for (const id of ['hotspot-hex-fill', 'hotspot-hex-line']) map.setLayoutProperty(id, 'visibility', mode === 'hexagons' ? 'visible' : 'none');
  }, [map, collection, mode]);
  useEffect(() => {
    if (!map || !collection || mode !== 'hexagons') return;
    let disposed = false; const markers: Marker[] = [];
    void import('maplibre-gl').then(({ Marker }) => {
      if (disposed) return;
      for (const feature of [...collection.features].sort((a, b) => b.properties.count - a.properties.count).slice(0, 120)) {
        const [lat, lon] = cellToLatLng(feature.properties.id), element = document.createElement('span');
        element.className = 'hex-map-count'; element.setAttribute('aria-hidden', 'true'); element.textContent = feature.properties.count.toLocaleString('id-ID');
        markers.push(new Marker({ element, anchor: 'center', opacityWhenCovered: 0 }).setLngLat([lon, lat]).addTo(map));
      }
    });
    return () => { disposed = true; markers.forEach(marker => marker.remove()); };
  }, [map, collection, mode]);
  const selected = collection?.features.find(feature => feature.properties.id === selectedId)?.properties;
  useEffect(() => { onSelection(mode === 'hexagons' ? selected ?? null : null); }, [selected, mode, onSelection]);
  return <section className="hex-controls" aria-label="Mode visualisasi deteksi">
    <fieldset><legend>Visualisasi hotspot</legend><div className="segmented"><button type="button" aria-pressed={mode === 'heatmap'} onClick={() => onMode('heatmap')}>Heatmap sebaran</button><button type="button" aria-pressed={mode === 'points'} onClick={() => onMode('points')}>Titik & cluster</button><button type="button" aria-pressed={mode === 'hexagons'} onClick={() => onMode('hexagons')}>Hexagon H3</button></div></fieldset>
    {mode === 'heatmap' && <p className="field-help" style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>Gradasi kabut panas otomatis bertransisi mulus menjadi titik deteksi individual saat peta diperbesar ke level kabupaten/kota.</p>}
    {mode === 'hexagons' && <><label>Ukuran sel<select value={resolution} onChange={event => onResolution(Number(event.target.value) as HexResolution)}>{HEX_RESOLUTIONS.map(value => <option key={value} value={value}>Resolusi {value} · rerata {hexAreaKm2(value).toLocaleString('id-ID', { maximumFractionDigits: 0 })} km²</option>)}</select></label><p aria-live="polite">{collection ? `${features.length.toLocaleString('id-ID')} deteksi · ${collection.features.length.toLocaleString('id-ID')} sel terisi · ${period}` : invalid ? 'Agregasi H3 gagal divalidasi; gunakan mode titik atau daftar deteksi.' : 'Data hotspot belum tersedia; sel tidak diisi angka nol.'}</p><p>Agregasi sesuai viewport dan filter. Sel dapat melintasi batas provinsi. Warna cyan–ungu menunjukkan jumlah deteksi, bukan AQI atau jumlah kejadian kebakaran.{state !== 'ok' && ' Cakupan data terbatas/lama; tidak menyatakan nihil deteksi nasional.'}</p>{selected && <p className="hex-selected">Sel {selected.id}: <strong>{selected.count} deteksi</strong><br/>Akuisisi: {formatWib(selected.firstAt)} — {formatWib(selected.lastAt)}</p>}</>}
  </section>;
}
