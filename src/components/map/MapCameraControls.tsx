'use client';
import { useEffect, useState } from 'react';
import type { Map as LibreMap } from 'maplibre-gl';
import { POLICY } from '@/lib/policy';
export function fitDataRegion(map: LibreMap) {
  const { clientWidth: width, clientHeight: height } = map.getContainer();
  const region = POLICY.INDONESIA_FETCH_BBOX;
  // Reserve actual UI space without changing the extent of the data.
  const panel = map.getContainer().closest('.map-workspace')?.querySelector<HTMLElement>('.workspace-layer-panel');
  const panelVisible = panel && window.getComputedStyle(panel).display !== 'none';
  const padding = width >= 900 ? { top: 110, right: panelVisible ? Math.min(380, width * .32) : 30, bottom: 140, left: 80 } : { top: 140, right: 25, bottom: panelVisible ? Math.min(240, height * .38) : 90, left: 25 };
  map.fitBounds([[region[0],region[1]],[region[2],region[3]]], { padding, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280 });
}
export function MapCameraControls({ map }: { map: LibreMap | null }) {
  const [bearing, setBearing] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => { if (!map) return; const sync = () => setBearing(map.getBearing()); map.on('rotate', sync); sync(); return () => { map.off('rotate', sync); }; }, [map]);
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);
  const toggleFullscreen = () => {
    const target = document.getElementById('map-frame') || document.documentElement;
    if (!document.fullscreenElement) {
      if (target.requestFullscreen) void target.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
    }
  };
  const duration = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
  return <nav className="workspace-camera" aria-label="Kontrol kamera peta">
    <div><button type="button" disabled={!map} aria-label="Perbesar peta" onClick={()=>map?.zoomIn({duration:duration()})}>+</button><button type="button" disabled={!map} aria-label="Perkecil peta" onClick={()=>map?.zoomOut({duration:duration()})}>−</button></div>
    <div><button type="button" disabled={!map} aria-label="Putar peta 45 derajat ke kiri" onClick={()=>map?.easeTo({bearing:map.getBearing()-45,duration:duration()})}>↶</button><button type="button" disabled={!map} aria-label="Kembali ke arah utara" title="Kembali ke arah utara" onClick={()=>map?.easeTo({bearing:0,duration:duration()})}><span className="camera-compass" style={{ transform:`rotate(${-bearing}deg)` }}>N<span aria-hidden="true">↑</span></span></button><button type="button" disabled={!map} aria-label="Putar peta 45 derajat ke kanan" onClick={()=>map?.easeTo({bearing:map.getBearing()+45,duration:duration()})}>↷</button></div>
    <div>
      <button type="button" className="camera-home" disabled={!map} aria-label="Kembali ke cakupan Indonesia" title="Kembali ke Indonesia" onClick={()=>{if(map)fitDataRegion(map);}}>⌂</button>
      <button type="button" className="camera-fullscreen" aria-label={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'} title={isFullscreen ? 'Keluar layar penuh (Esc)' : 'Peta Layar Penuh'} onClick={toggleFullscreen}>
        <span aria-hidden="true" style={{ fontSize: '16px', lineHeight: 1 }}>{isFullscreen ? '⤓' : '⤢'}</span>
      </button>
    </div>
  </nav>;
}
