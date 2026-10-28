import { airChartSegments } from '@/lib/air-view';
import type { HourPm25 } from '@/lib/contracts';
import { formatWib } from '@/lib/hotspot-view';
export function AirChart({ history, current, forecast }: { history: HourPm25[]; current: HourPm25; forecast: HourPm25[] }) {
  const series = [...history, current, ...forecast], segments = airChartSegments(series);
  const minimumTime = Date.parse(series[0]!.validAt), maximumTime = Date.parse(series.at(-1)!.validAt);
  const maximumValue = Math.max(1, ...series.map(sample => sample.pm25UgM3 ?? 0));
  const x = (time: number) => 30 + (time - minimumTime) / Math.max(1, maximumTime - minimumTime) * 260;
  const y = (value: number) => 115 - value / maximumValue * 90;
  const currentX = x(Date.parse(current.validAt));
  return <figure className="air-chart"><figcaption>PM2.5 model · µg/m³<br/><span>Riwayat dan prakiraan; celah menunjukkan data hilang.</span></figcaption>
    <svg viewBox="0 0 320 150" role="img" aria-label="Grafik konsentrasi PM2.5 model. Nilai per jam tersedia pada daftar data di bawah.">
      <rect x={currentX} y="15" width={Math.max(0, 290 - currentX)} height="100" fill="var(--accent-cyan)" opacity="0.06"/>
      <path d="M30 15V115H290" fill="none" stroke="var(--border-control)"/>
      <text x="26" y="20" textAnchor="end">{maximumValue.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</text><text x="26" y="118" textAnchor="end">0</text>
      {segments.map((segment, index) => <g key={index}><polyline points={segment.map(point => `${x(point.at)},${y(point.value)}`).join(' ')} fill="none" stroke="var(--accent-cyan)" strokeWidth="2"/>{segment.length === 1 && <circle cx={x(segment[0]!.at)} cy={y(segment[0]!.value)} r="2" fill="var(--accent-cyan)"/>}</g>)}
      <path d={`M${currentX} 15V115`} stroke="var(--text-secondary)" strokeDasharray="3 3"/><text x={currentX} y="138" textAnchor="middle">Jam kini</text>
    </svg>
    <p>{formatWib(series[0]!.validAt)} — {formatWib(series.at(-1)!.validAt)}</p>
  </figure>;
}
