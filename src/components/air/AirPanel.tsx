'use client';
import { useState } from 'react';
import type { AirResource } from './useAirData';
import { AqiBadge } from './AqiBadge';
import { AirChart } from './AirChart';
import { DataStatus } from '@/components/data/DataStatus';
import { formatWib } from '@/lib/hotspot-view';
import type { Location } from '@/lib/contracts';
export function AirPanel({ location, resource }: { location: Location | null; resource: AirResource }) {
  const { response, loading, failed, refresh, retryAfter } = resource;
  const data = response?.data ?? null;
  const [selectedAt, setSelectedAt] = useState('');
  const samples = data ? [...data.history, ...(data.current ? [data.current] : []), ...data.forecast] : [];
  const selected = samples.find(sample => sample.validAt === selectedAt) ?? data?.current ?? null;
  const future = !!selected && !!data?.current && selected.validAt > data.current.validAt;
  return <section className="air-panel" aria-label="Udara pada lokasi">
    <p className="eyebrow">UDARA PADA LOKASI</p><h2>PM2.5 model CAMS</h2>
    <DataStatus state={response?.meta.state ?? 'unavailable'}>{loading ? 'Memperbarui data udara…' : !location ? 'Pilih tempat, koordinat, atau titik pada peta.' : retryAfter > 0 ? `Permintaan dibatasi. Coba lagi dalam ${retryAfter} detik.` : failed ? 'Pembaruan gagal; periksa koneksi atau coba lagi.' : 'Open-Meteo · CAMS global'}</DataStatus>
    <div className="air-metric"><p className="metric-label">KONSENTRASI PM2.5 / JAM KINI MODEL</p>
    <p className="air-value">{data?.current?.pm25UgM3?.toLocaleString('id-ID', { maximumFractionDigits: 1 }) ?? '—'} <span>µg/m³</span></p>
    {data?.current ? <p className="field-help">Jam kini model: {formatWib(data.current.validAt)}{response?.meta.state === 'stale' && ' · Data lama/fallback'}</p> : <p className="field-help">Nilai belum tersedia; tidak diganti dengan nol.</p>}
    </div>
    {location && <button onClick={refresh} disabled={loading || retryAfter > 0}>{loading ? 'Memuat…' : 'Perbarui udara'}</button>}
    {data && <>
      <AqiBadge aqi={data.aqi}/>
      {data.current && <AirChart history={data.history} current={data.current} forecast={data.forecast}/>}
      <label className="air-hour-select">Periksa nilai per jam<select value={selected?.validAt ?? ''} onChange={event => setSelectedAt(event.target.value)}>{samples.map(sample => <option key={sample.validAt} value={sample.validAt}>{sample.validAt < data.current!.validAt ? 'Riwayat' : sample.validAt === data.current!.validAt ? 'Jam kini' : 'Prakiraan'} · {formatWib(sample.validAt)}</option>)}</select></label>
      {selected && <p className="hour-value">{future ? 'Prakiraan' : selected.validAt === data.current?.validAt ? 'Jam kini' : 'Riwayat model'}: <strong>{selected.pm25UgM3 === null ? 'Tidak tersedia' : `${selected.pm25UgM3.toLocaleString('id-ID', { maximumFractionDigits: 1 })} µg/m³`}</strong></p>}
      {future && <p className="field-help">Anda meninjau prakiraan. Panel tindakan MVP tetap menggunakan data untuk jam kini.</p>}
      <details className="air-source-details"><summary>Sumber, metode, dan waktu</summary><dl>
        <dt>Lokasi diminta</dt><dd>{data.requestedLocation.lat.toFixed(4)}, {data.requestedLocation.lon.toFixed(4)}</dd>
        <dt>Query cache teknis</dt><dd>{data.queryLocation.lat.toFixed(2)}, {data.queryLocation.lon.toFixed(2)} · bucket 0,01°, bukan resolusi ilmiah</dd>
        <dt>Sel model</dt><dd>{data.modelGridLocation.lat.toFixed(4)}, {data.modelGridLocation.lon.toFixed(4)} · nilai mewakili sel model, bukan rumah</dd>
        <dt>Diambil</dt><dd>{formatWib(response!.meta.fetchedAt)}</dd>
        <dt>Run model</dt><dd>{data.runAt ? formatWib(data.runAt) : 'Waktu run tidak diberikan provider'}</dd>
        <dt>Batas kesegaran</dt><dd>{formatWib(response!.meta.validUntil)}</dd>
        <dt>Waktu UTC</dt><dd>{data.current?.validAt}</dd>
        {data.aqi.status === 'available' && <><dt>Periode indeks UTC</dt><dd>{data.aqi.periodFrom} — {data.aqi.periodTo} · 24/24 sampel</dd><dt>Metode</dt><dd>{data.aqi.method} · {data.aqi.breakpointVersion}</dd></>}
      </dl><p className="data-version">Versi data: {response!.meta.dataVersion}</p></details>
      <details className="air-values"><summary>Daftar data per jam ({samples.length})</summary><div className="air-table-scroll"><table><caption>PM2.5 model CAMS, µg/m³; waktu WIB</caption><thead><tr><th scope="col">Waktu</th><th scope="col">Jenis</th><th scope="col">µg/m³</th></tr></thead><tbody>{samples.map(sample => <tr key={sample.validAt}><th scope="row">{formatWib(sample.validAt)}</th><td>{sample.validAt < data.current!.validAt ? 'Riwayat' : sample.validAt === data.current!.validAt ? 'Kini' : 'Prakiraan'}</td><td>{sample.pm25UgM3 === null ? 'Tidak tersedia' : sample.pm25UgM3.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</td></tr>)}</tbody></table></div></details>
    </>}
    {response && response.meta.issues.length > 0 && <details className="air-issues"><summary>Keterbatasan data</summary><ul>{response.meta.issues.map((issue, index) => <li key={index}>{issue.detail}</li>)}</ul></details>}
    <p className="air-attribution">Data: <a href="https://open-meteo.com/en/docs/air-quality-api">Open-Meteo</a> dan <a href="https://atmosphere.copernicus.eu/">Copernicus Atmosphere Monitoring Service (CAMS)</a>. Riwayat berasal dari model/arsip prakiraan, bukan pengukuran stasiun.</p>
  </section>;
}
