import { ACTION_SOURCE, audienceLabels } from '@/lib/action-catalog';
import type { RecommendationResponse } from '@/lib/action-contracts';
import type { Audience } from '@/lib/contracts';
import { formatWib } from '@/lib/hotspot-view';
import type { RecommendationView } from '@/lib/recommendation-view';
import { AudienceSelector } from './AudienceSelector';
export function ActionPanel({ view, response, audience, onAudienceChange, onRefresh, loading, retryAfter }: {
  view: RecommendationView; response: RecommendationResponse | null; audience: Audience; onAudienceChange: (value: Audience) => void;
  onRefresh: () => void; loading: boolean; retryAfter: number;
}) {
  const result = view.result;
  return <section id="action-panel" className="action-panel" aria-labelledby="action-panel-heading">
    <p className="eyebrow">TINDAKAN MASYARAKAT</p><h2 id="action-panel-heading">Tindakan untuk lokasi ini</h2>
    <p className="field-help">Untuk jam kini. Pilihan riwayat atau prakiraan udara tidak mengubah waktu panduan ini.</p>
    <AudienceSelector value={audience} onChange={onAudienceChange}/>
    <div className={`action-content action-${view.mode}`} aria-live="polite"><p className="action-mode">{view.mode === 'targeted' ? `Panduan berdasarkan model · ${audienceLabels[audience]}` : 'Panduan terbatas'}</p><p>{view.reason}</p>
      {result ? <ul>{result.messages.map((message, index) => <li key={index}>{message}</li>)}</ul> : <p>Periksa waktu dan sumber data. Gunakan pedoman umum sambil menunggu informasi yang memadai.</p>}
    </div>
    {result && <><p className="field-help">Untuk: {formatWib(result.forTime)}<br/>Berlaku sampai: {formatWib(result.validUntil)}</p><details className="action-basis"><summary>Alasan, sumber, dan versi</summary><dl>
      <dt>Dasar indeks</dt><dd>{result.basis.beyondScale ? '>500' : result.basis.value} · estimasi US AQI PM2.5 dari rerata model 24 jam</dd>
      <dt>Rerata model</dt><dd>{result.basis.mean24hUgM3.toLocaleString('id-ID', { maximumFractionDigits: 2 })} µg/m³</dd>
      <dt>Periode input UTC</dt><dd>{result.basis.periodFrom} — {result.basis.periodTo} · {result.basis.sampleCount}/24 sampel</dd>
      <dt>Metode</dt><dd>{result.basis.method} · {result.basis.breakpointVersion}</dd>
      <dt>Lokasi</dt><dd>{result.location.lat.toFixed(4)}, {result.location.lon.toFixed(4)}</dd>
      <dt>Aturan</dt><dd>{result.ruleId} · {result.ruleVersion}</dd>
      <dt>Batas berlaku UTC</dt><dd>{result.validUntil}</dd>
    </dl><p className="data-version">Versi data dasar: {result.basisDataVersion}</p></details></>}
    {!result && response?.result.mode === 'limited' && <details className="action-basis"><summary>Informasi keterbatasan</summary><p>{response.result.ruleId} · {response.result.ruleVersion}</p><p>Dievaluasi: {formatWib(response.result.createdAt)}</p><ul>{response.meta.issues.map((issue, index) => <li key={index}>{issue.detail}</li>)}</ul></details>}
    {retryAfter > 0 && <p className="field-help">Permintaan dibatasi. Coba lagi dalam {retryAfter} detik.</p>}
    <button onClick={onRefresh} disabled={loading || retryAfter > 0}>{loading ? 'Menyamakan data…' : 'Perbarui udara & panduan'}</button>
    <p className="action-source">Adaptasi pedoman <a href={ACTION_SOURCE}>AirNow: polusi partikel ↗</a>. Informasi model bukan keputusan evakuasi atau konfirmasi sumber asap.</p>
    <a href="/sumber-data">Sumber dan metode ↗</a>
  </section>;
}
