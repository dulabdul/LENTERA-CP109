import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HotspotInsightPill } from '../src/components/map/HotspotInsightPill';

describe('HotspotInsightPill component tests', () => {
  it('renders loading state correctly', () => {
    const html = renderToString(
      <HotspotInsightPill
        totalCount={null}
        periodLabel="24 jam"
        topProvinces={[]}
        latestDetectionAt={null}
        dataState="unavailable"
        loading={true}
      />
    );
    expect(html).toContain('Memuat snapshot satelit NASA…');
    expect(html).toContain('pulse-yellow');
  });

  it('renders unavailable state gracefully when data is null', () => {
    const html = renderToString(
      <HotspotInsightPill
        totalCount={null}
        periodLabel="24 jam"
        topProvinces={[]}
        latestDetectionAt={null}
        dataState="unavailable"
        loading={false}
      />
    );
    expect(html).toContain('Data snapshot operasional belum tersedia');
    expect(html).toContain('pulse-gray');
  });

  it('renders active metric, top provinces, and satellite timestamp', () => {
    const html = renderToString(
      <HotspotInsightPill
        totalCount={2554}
        periodLabel="24 jam"
        topProvinces={[
          { id: '62', name: 'Kalimantan Tengah', count: 646 },
          { id: '16', name: 'Sumatera Selatan', count: 312 },
        ]}
        latestDetectionAt="2026-10-28T02:00:00Z"
        dataState="ok"
      />
    );
    expect(html).toContain('2.554 Titik Panas Aktif');
    expect(html).toContain('(24 jam)');
    expect(html).toContain('pulse-red');
    expect(html).toContain('Kalimantan Tengah');
    expect(html).toContain('646 titik');
    expect(html).toContain('Sumatera Selatan');
    expect(html).toContain('312 titik');
    expect(html).toContain('Satelit:');
    expect(html).toContain('WIB');
  });
});
