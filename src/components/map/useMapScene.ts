'use client';
import { useEffect, useState } from 'react';
import type { Map as LibreMap, ErrorEvent as LibreErrorEvent } from 'maplibre-gl';
import { SCENE_SOURCE, type MapBasemap, type MapViewMode } from '@/lib/map-scene';
import { applyBasemap, applyProjection, observeSceneSource } from '@/lib/map-scene-controller';
export function useMapScene(map: LibreMap | null) {
  const [basemap, setBasemap] = useState<MapBasemap>('map'), [viewMode, setViewMode] = useState<MapViewMode>('flat');
  const [streetFailed, setStreetFailed] = useState(false), [labelsFailed, setLabelsFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null), [baseLoading, setBaseLoading] = useState(true), [terrainLoading, setTerrainLoading] = useState(false);
  useEffect(() => {
    if (!map) return;
    try { applyBasemap(map, basemap, streetFailed, labelsFailed); } catch { setNotice('Peta dasar gagal diterapkan. Lapisan dan daftar data tetap tersedia.'); }
  }, [map, basemap, streetFailed, labelsFailed]);
  useEffect(() => {
    if (!map) return;
    try { applyProjection(map, viewMode, window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { setViewMode('flat'); setNotice('Mode tampilan belum dapat diterapkan; kembali ke Flat.'); }
  }, [map, viewMode]);
  useEffect(() => {
    if (!map) return;
    const source = basemap === 'satellite' ? SCENE_SOURCE.satellite : SCENE_SOURCE.map;
    setBaseLoading(!(streetFailed && basemap === 'map'));
    const fail = (id?: string) => {
      if (id === SCENE_SOURCE.satellite && basemap === 'satellite') { setBasemap('map'); setNotice('Citra satelit gagal dimuat; kembali ke Peta. Layer data dipertahankan.'); }
      if (id === SCENE_SOURCE.map && basemap === 'map') { setStreetFailed(true); setBaseLoading(false); setNotice('Peta dasar gagal dimuat. Batas lokal indikatif, deteksi dan daftar tetap tersedia.'); }
      if (id === SCENE_SOURCE.labels) { setLabelsFailed(true); setNotice('Sebagian label peta dasar belum tersedia. Batas provinsi tetap dapat digunakan.'); }
    };
    const stop = observeSceneSource(map, source, () => setBaseLoading(false), () => fail(source));
    const onLabelsError = (event: LibreErrorEvent & { sourceId?: string }) => { if (event.sourceId === SCENE_SOURCE.labels) fail(event.sourceId); };
    map.on('error', onLabelsError);
    return () => { stop(); map.off('error', onLabelsError); };
  }, [map, basemap, streetFailed]);
  useEffect(() => {
    if (!map || viewMode !== 'terrain') { setTerrainLoading(false); return; }
    setTerrainLoading(true);
    return observeSceneSource(map, SCENE_SOURCE.terrain, () => setTerrainLoading(false), () => {
      setTerrainLoading(false); setViewMode('flat'); setNotice('Data elevasi gagal dimuat; kembali ke Flat. Peta, filter dan layer data tetap tersedia.');
    });
  }, [map, viewMode]);
  return { basemap, viewMode, notice, baseLoading, terrainLoading, streetFailed,
    selectBasemap: (value: MapBasemap) => { setNotice(null); if (value === 'map') { setStreetFailed(false); setLabelsFailed(false); } setBasemap(value); if (map?.getSource(value === 'satellite' ? SCENE_SOURCE.satellite : SCENE_SOURCE.map)) map.refreshTiles(value === 'satellite' ? SCENE_SOURCE.satellite : SCENE_SOURCE.map); },
    selectView: (value: MapViewMode) => { setNotice(null); setViewMode(value); },
    setNotice, setViewMode, setTerrainLoading,
  };
}
export type MapSceneResource = ReturnType<typeof useMapScene>;
