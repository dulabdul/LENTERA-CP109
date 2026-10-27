import type { AqiEstimate } from '@/lib/contracts';
import { aqiLabels } from '@/lib/air-view';
export function AqiBadge({ aqi }: { aqi: AqiEstimate }) {
  return <section className="aqi-estimate" aria-label="Estimasi indeks PM2.5">
    <h3>Estimasi US AQI PM2.5 <span>— rerata model 24 jam</span></h3>
    {aqi.status === 'unavailable' ? <p className="field-help">Indeks belum tersedia. Diperlukan 24 sampel jam yang valid.</p> : <>
      <p className={`aqi-badge aqi-${aqi.category}`}><strong>{aqi.beyondScale ? '>500' : aqi.value}</strong><span>{aqiLabels[aqi.category]}</span></p>
      <p className="field-help">Rerata 24 jam: {aqi.mean24hUgM3.toLocaleString('id-ID', { maximumFractionDigits: 2 })} µg/m³.</p>
      {aqi.beyondScale && <p className="field-help">Konsentrasi melewati skala indeks; angka tidak diekstrapolasi.</p>}
    </>}
    <p className="field-help">Estimasi dari model, bukan ISPU resmi, NowCast, atau hasil sensor di rumah.</p>
  </section>;
}
