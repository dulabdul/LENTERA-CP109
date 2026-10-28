'use client';
import { useEffect, useMemo } from 'react';
import type { ImageSource, Map as LibreMap } from 'maplibre-gl';
import type { FieldFrame, FieldSnapshot } from '@/lib/air-field/contracts';
import { PM25_SCALE, rasterField } from '@/lib/air-field/raster';
import { formatWib } from '@/lib/hotspot-view';
import { DataStatus } from '@/components/data/DataStatus';
import type { AirFieldResource } from './useAirField';
export function selectFieldFrame(resource: AirFieldResource, selectedAt: string): FieldFrame | null {
  const frames = resource.response?.data?.frames;
  if (!frames) return null;
  return (selectedAt ? frames.find(f => f.validAt === selectedAt) : frames.find(f => Date.parse(f.validAt) === Math.floor(resource.now.getTime() / 3_600_000) * 3_600_000)) ?? null;
}
export function MapAirField({ map, enabled, snapshot, frame, opacity, onError }: { map: LibreMap | null; enabled: boolean; snapshot: FieldSnapshot | null; frame: FieldFrame | null; opacity: number; onError: (failed: boolean) => void }) {
  const image = useMemo(() => {
    if (!enabled || !snapshot || !frame || typeof document === 'undefined') return null;
    try {
      const raster = rasterField(snapshot.grid, frame), canvas = document.createElement('canvas'); canvas.width = raster.width; canvas.height = raster.height;
      const context = canvas.getContext('2d'); if (!context) return null;
      context.putImageData(new ImageData(raster.pixels, raster.width, raster.height), 0, 0); return canvas.toDataURL('image/png');
    } catch { return null; }
  }, [enabled, snapshot, frame]);
  useEffect(() => {
    if (!map) return;
    if (!image || !snapshot) {
      if (map.getLayer('air-field-raster')) map.removeLayer('air-field-raster'); if (map.getSource('air-field-image')) map.removeSource('air-field-image');
      onError(enabled && !!snapshot && !!frame && !image); return;
    }
    const { west, south, east, north } = snapshot.grid, coordinates: [[number, number], [number, number], [number, number], [number, number]] = [[west, north], [east, north], [east, south], [west, south]];
    try {
      const source = map.getSource('air-field-image') as ImageSource | undefined;
      if (source) source.updateImage({ url: image, coordinates });
      else {
        map.addSource('air-field-image', { type: 'image', url: image, coordinates });
        const before = map.getLayer('hotspot-hex-fill') ? 'hotspot-hex-fill' : map.getLayer('province-line') ? 'province-line' : 'clusters';
        map.addLayer({ id: 'air-field-raster', type: 'raster', source: 'air-field-image', paint: { 'raster-opacity': 0.6, 'raster-fade-duration': 0 } }, before);
      }
      onError(false);
    } catch { onError(true); }
  }, [map, image, snapshot, enabled, frame, onError]);
  useEffect(() => { if (map?.getLayer('air-field-raster')) map.setPaintProperty('air-field-raster', 'raster-opacity', opacity); }, [map, opacity, image]);
  useEffect(() => () => { if (map?.getLayer('air-field-raster')) map.removeLayer('air-field-raster'); if (map?.getSource('air-field-image')) map.removeSource('air-field-image'); }, [map]);
  return null;
}
export function AirFieldControls({ enabled, onEnabled, resource, selectedAt, onTime, opacity, onOpacity, renderFailed = false }: {
  enabled: boolean; onEnabled: (value: boolean) => void; resource: AirFieldResource; selectedAt: string; onTime: (time: string) => void; opacity: number; onOpacity: (value: number) => void; renderFailed?: boolean;
}) {
  const snapshot = resource.response?.data;
  return <section className="air-field-controls" aria-label="Lapisan warna PM2.5 model">
    <label className="layer-check"><input type="checkbox" checked={enabled} onChange={event => onEnabled(event.target.checked)}/> Warna PM2.5 model <span>Grid area · terpisah dari indeks 24 jam</span></label>
    {enabled && <><DataStatus state={resource.response?.meta.state ?? 'unavailable'}>{resource.loading ? 'Memperbarui snapshot grid…' : resource.failed ? 'Pembaruan gagal; periksa umur snapshot.' : resource.offline ? 'Offline; grid yang termuat mengikuti batas umur.' : snapshot ? `${snapshot.grid.nx}×${snapshot.grid.ny} posisi sampling ${snapshot.grid.step}°` : 'Snapshot grid operasional belum tersedia. Peta hotspot dan panel lokasi tetap dapat digunakan.'}</DataStatus>
      {snapshot && <><label>Jam model<select value={selectedAt} onChange={event => onTime(event.target.value)}><option value="">Ikuti jam kini server</option>{snapshot.frames.map(f => <option key={f.validAt} value={f.validAt}>{Date.parse(f.validAt) < Math.floor(resource.now.getTime() / 3_600_000) * 3_600_000 ? 'Riwayat' : Date.parse(f.validAt) === Math.floor(resource.now.getTime() / 3_600_000) * 3_600_000 ? 'Jam kini' : 'Prakiraan'} · {formatWib(f.validAt)}</option>)}</select></label><label>Transparansi lapisan<input type="range" min="0.15" max="0.85" step="0.05" value={opacity} onChange={event => onOpacity(Number(event.target.value))}/></label><p>Diambil: {formatWib(snapshot.fetchedAt)}. Jendela pengambilan mulai: {formatWib(snapshot.startedAt)}. Run model tidak diberikan provider. Sampling {snapshot.grid.step}°, model sumber sekitar 0,4°; interpolasi bukan tambahan ketelitian.</p></>}
      <AirFieldLegend enabled={enabled} resource={resource} frame={selectFieldFrame(resource, selectedAt)} renderFailed={renderFailed} inline/>
      <button type="button" onClick={resource.refresh} disabled={resource.loading}>Perbarui grid</button><p>Skala konsentrasi µg/m³, bukan kategori AQI/ISPU. Jam pilihan tidak mengubah rekomendasi kesehatan kini.</p><p><a href="https://open-meteo.com/en/docs/air-quality-api">Open-Meteo ↗</a> / <a href="https://atmosphere.copernicus.eu/">CAMS ↗</a></p></>}
  </section>;
}
export function AirFieldLegend({ enabled, resource, frame, renderFailed, inline = false }: { enabled: boolean; resource: AirFieldResource; frame: FieldFrame | null; renderFailed: boolean; inline?: boolean }) {
  const snapshot = resource.response?.data;
  const gradient = PM25_SCALE.map(s => `rgb(${s.rgb.join(',')}) ${s.value / 150 * 100}%`).join(',');
  if (!enabled) return null;
  return <aside className={inline ? "map-air-legend map-air-legend-inline" : "map-air-legend"} aria-label="Legenda grid PM2.5" aria-live="polite"><strong>PM2.5 model · µg/m³</strong>{snapshot && frame && !renderFailed ? <><span>{Date.parse(frame.validAt) < Math.floor(resource.now.getTime() / 3_600_000) * 3_600_000 ? 'Riwayat' : Date.parse(frame.validAt) === Math.floor(resource.now.getTime() / 3_600_000) * 3_600_000 ? 'Jam kini' : 'Prakiraan'} · {formatWib(frame.validAt)} · {resource.response?.meta.state === 'stale' ? 'Data lama' : resource.response?.meta.state === 'partial' || frame.values.some(v => v === null) ? 'Cakupan sebagian' : 'Data tersedia'}</span><div className="field-color-ramp" style={{ background: `linear-gradient(to right,${gradient})` }}/><div className="field-scale-ticks"><span>0</span><span>25</span><span>50</span><span>100</span><span>≥150</span></div><small>Sampling {snapshot.grid.step}° · area kosong tidak diisi · bukan indeks AQI</small></> : <span>{renderFailed ? 'Lapisan warna gagal dirender.' : resource.loading ? 'Memuat grid…' : 'Grid untuk jam pilihan belum tersedia.'}</span>}</aside>;
}
