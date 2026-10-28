'use client';
import { useEffect, useState } from 'react';
import type { Map as LibreMap, Marker, MapMouseEvent, ExpressionSpecification } from 'maplibre-gl';
import { parseProvinces, provinceManifest, type Provinces } from '@/lib/map-provinces';
const SOURCE = 'province-boundaries';
export function MapRegionLayers({ map }: { map: LibreMap | null }) {
  const [collection, setCollection] = useState<Provinces | null>(null), [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(true), [focused, setFocused] = useState(''), [hovered, setHovered] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/data/provinces.geojson?v=${provinceManifest.sha256}`,  { signal: controller.signal, cache: 'force-cache' }).then(async response => {
      if (!response.ok) throw Error(); const data = parseProvinces(await response.json()); if (!controller.signal.aborted) setCollection(data);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!map || !collection) return;
    const before = map.getLayer('clusters') ? 'clusters' : undefined;
    map.addSource(SOURCE, { type: 'geojson', data: collection, promoteId: 'id', attribution: 'Batas indikatif © Deny Herianto, CC BY 4.0' });
    const active = ['any', ['boolean', ['feature-state', 'hover'], false], ['boolean', ['feature-state', 'focused'], false]] as ExpressionSpecification;
    map.addLayer({ id: 'province-fill', type: 'fill', source: SOURCE, paint: { 'fill-color': '#15803d', 'fill-opacity': ['case', active, 0.16, 0.025] } }, before);
    map.addLayer({ id: 'province-line', type: 'line', source: SOURCE, paint: { 'line-color': ['case', active, '#4ade80', '#3b6a55'], 'line-opacity': 0.8, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.7, 8, 1.5] } }, before);
    let previous: string | null = null, disposed = false; const labels: Marker[] = [];
    const onMove = (event: MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(event.point, { layers: ['province-fill'] })[0];
      const id = typeof feature?.id === 'string' ? feature.id : null;
      if (id === previous) return;
      if (previous) map.setFeatureState({ source: SOURCE, id: previous }, { hover: false });
      previous = id;
      if (id) map.setFeatureState({ source: SOURCE, id }, { hover: true });
      setHovered(typeof feature?.properties?.PROVINSI === 'string' ? feature.properties.PROVINSI : '');
    };
    const onLeave = () => { if (previous && map.getSource(SOURCE)) map.setFeatureState({ source: SOURCE, id: previous }, { hover: false }); previous = null; setHovered(''); };
    const showLabels = () => { const shown = map.getZoom() >= 6 && map.getLayoutProperty('province-line', 'visibility') !== 'none'; for (const marker of labels) marker.getElement().hidden = !shown; };
    void import('maplibre-gl').then(({ Marker }) => {
      if (disposed) return;
      for (const province of provinceManifest.catalog) {
        const element = document.createElement('span'); element.className = 'province-map-label'; element.textContent = province.name; element.setAttribute('aria-hidden', 'true');
        const marker = new Marker({ element, anchor: 'center', opacityWhenCovered: 0 }).setLngLat(province.label as [number, number]).addTo(map); labels.push(marker);
      }
      showLabels();
    });
    map.on('mousemove', onMove); map.on('zoomend', showLabels); map.on('idle', showLabels); map.getCanvas().addEventListener('mouseleave', onLeave);
    return () => {
      disposed = true; map.off('mousemove', onMove); map.off('zoomend', showLabels); map.off('idle', showLabels); map.getCanvas().removeEventListener('mouseleave', onLeave); labels.forEach(marker => marker.remove());
      if (map.getLayer('province-line')) map.removeLayer('province-line'); if (map.getLayer('province-fill')) map.removeLayer('province-fill'); if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    };
  }, [map, collection]);
  useEffect(() => {
    if (!map?.getLayer('province-line')) return;
    for (const id of ['province-fill', 'province-line']) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    // Label visibility is also updated on idle after style changes.
  }, [map, collection, visible]);
  useEffect(() => {
    if (!map?.getSource(SOURCE) || !focused) return;
    const province = provinceManifest.catalog.find(p => p.id === focused); if (!province) return;
    map.setFeatureState({ source: SOURCE, id: focused }, { focused: true });
    map.fitBounds([[province.bounds[0]!, province.bounds[1]!], [province.bounds[2]!, province.bounds[3]!]], { padding: 40, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300 });
    return () => { if (map.getSource(SOURCE)) map.setFeatureState({ source: SOURCE, id: focused }, { focused: false }); };
  }, [map, collection, focused]);
  return <div className="region-layer-controls">
    <label className="layer-check"><input type="checkbox" checked={visible} onChange={event => setVisible(event.target.checked)} disabled={failed || !collection}/> Batas provinsi <span>38 wilayah · dataset 2025</span></label>
    <label className="region-select">Fokus wilayah<select value={focused} onChange={event => setFocused(event.target.value)} disabled={!map || !collection}><option value="">Pilih provinsi</option>{provinceManifest.catalog.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <p className="region-feedback" aria-live="polite">{failed ? 'Batas provinsi belum dapat dimuat; peta dan hotspot tetap tersedia.' : !collection ? 'Memuat batas wilayah…' : hovered || provinceManifest.catalog.find(p => p.id === focused)?.name || 'Arahkan penunjuk pada wilayah atau gunakan pilihan provinsi.'}</p>
    <details className="region-provenance"><summary>Sumber batas indikatif</summary><p>{provinceManifest.note}</p><p>Geometri komunitas; sumber survei awal belum dijelaskan penerbit. ID bentuk pada dataset bukan kode administrasi resmi. Pusat label bukan ibu kota.</p><a href={provinceManifest.source}>Deny Herianto · dataset 38 provinsi ↗</a> · <a href={provinceManifest.licenseUrl}>CC BY 4.0 ↗</a></details>
  </div>;
}
