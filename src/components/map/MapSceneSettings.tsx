'use client';
import { VIEW_MODES } from '@/lib/map-scene';
import type { MapSceneResource } from './useMapScene';
export function MapSceneSettings({ scene, ready, allowTerrain = false }: { scene: MapSceneResource; ready: boolean; allowTerrain?: boolean }) {
  return <div className="workspace-scene-settings">
    <fieldset><legend>Peta dasar</legend><div className="scene-options">{(['map','satellite'] as const).map(value => <button type="button" key={value} disabled={!ready} aria-pressed={scene.basemap === value} title={value === 'satellite' ? 'Citra latar; waktu citra berbeda dari deteksi hotspot' : 'Peta jalan dan nama tempat'} onClick={() => scene.selectBasemap(value)}><span aria-hidden="true">{value === 'map' ? '▧' : '◈'}</span> {value === 'map' ? 'Map' : 'Satellite'}</button>)}</div></fieldset>
    <fieldset><legend>Tampilan</legend><div className="scene-options">{VIEW_MODES.map(value => <button type="button" key={value.id} disabled={!ready || (value.id === 'terrain' && !allowTerrain)} aria-pressed={scene.viewMode === value.id} title={value.hint} onClick={() => scene.selectView(value.id)}>{value.label}</button>)}</div></fieldset>
    <p className="scene-load-state" role="status">{!ready ? 'Menyiapkan peta…' : scene.terrainLoading ? 'Memuat elevasi Terrain…' : scene.baseLoading ? 'Memuat peta dasar…' : scene.streetFailed && scene.basemap === 'map' ? 'Peta dasar lokal indikatif' : `${scene.basemap === 'satellite' ? 'Citra satelit' : 'Peta jalan'} · ${VIEW_MODES.find(v=>v.id === scene.viewMode)?.label}`}</p>
    {scene.basemap === 'satellite' && <p className="scene-context-note">Citra latar bukan pengamatan langsung saat ini. Waktu deteksi dan model udara tetap terpisah.</p>}
    {scene.viewMode !== 'flat' && <p className="scene-context-note">Daftar dan jumlah mengikuti batas geografis viewport. Sebagian titik dapat tertutup horizon atau relief.</p>}
    {scene.notice && <p className="scene-notice" role="status">{scene.notice}</p>}
  </div>;
}
