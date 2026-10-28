'use client';
import type { ProvinceHotspotSummary } from '@/lib/map-provinces';
import { formatWib } from '@/lib/hotspot-view';

export interface HotspotInsightPillProps {
  totalCount: number | null;
  periodLabel: string;
  topProvinces: ProvinceHotspotSummary[];
  latestDetectionAt: string | null;
  dataState: 'ok' | 'stale' | 'partial' | 'unavailable';
  loading?: boolean;
}

export function HotspotInsightPill({
  totalCount,
  periodLabel,
  topProvinces,
  latestDetectionAt,
  dataState,
  loading = false,
}: HotspotInsightPillProps) {
  if (loading && totalCount === null) {
    return (
      <aside className="hotspot-insight-pill insight-loading" aria-label="Ringkasan cepat hotspot" aria-live="polite">
        <span className="insight-pulse-indicator pulse-yellow" aria-hidden="true" />
        <span className="insight-metric">Memuat snapshot satelit NASA…</span>
      </aside>
    );
  }

  if (totalCount === null || dataState === 'unavailable') {
    return (
      <aside className="hotspot-insight-pill insight-unavailable" aria-label="Ringkasan cepat hotspot" aria-live="polite">
        <span className="insight-pulse-indicator pulse-gray" aria-hidden="true" />
        <span className="insight-metric">Data snapshot operasional belum tersedia</span>
        <span className="insight-divider" aria-hidden="true">·</span>
        <span className="insight-meta">NASA FIRMS VIIRS</span>
      </aside>
    );
  }

  return (
    <aside className="hotspot-insight-pill" aria-label="Ringkasan cepat titik panas" aria-live="polite">
      <div className="insight-primary">
        <span className="insight-pulse-indicator pulse-red" aria-hidden="true" />
        <strong className="insight-metric">{`${totalCount.toLocaleString('id-ID')} Titik Panas Aktif`}</strong>
        <span className="insight-period">{`(${periodLabel})`}</span>
      </div>
      {topProvinces.length > 0 && (
        <>
          <span className="insight-divider" aria-hidden="true">·</span>
          <div className="insight-provinces">
            <span className="insight-label">Terbanyak:</span>
            {topProvinces.map((prov, i) => (
              <span key={prov.id} className="insight-province-item">
                {i > 0 && <span className="insight-subdivider"> · </span>}
                <strong>{prov.name}</strong> <span className="insight-count">{`(${prov.count.toLocaleString('id-ID')} titik)`}</span>
              </span>
            ))}
          </div>
        </>
      )}
      {latestDetectionAt && (
        <>
          <span className="insight-divider" aria-hidden="true">·</span>
          <div className="insight-update">
            <span className="insight-label">Satelit:</span>
            <span className="insight-time">{formatWib(latestDetectionAt)}</span>
          </div>
        </>
      )}
    </aside>
  );
}
