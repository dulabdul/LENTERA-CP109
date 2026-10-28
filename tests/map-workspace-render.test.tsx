// Structural server-render checks only; these are not browser visual tests.
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HotspotMonitor } from '../src/components/map/HotspotMonitor';

describe('VIEW workspace server rendering and retained alternatives', () => {
  it('keeps one search/filter set, data alternatives and the mounted location workflow', () => {
    const html = renderToString(<HotspotMonitor />);
    expect(html.match(/id="location-search"/g)).toHaveLength(1);
    expect(html).toContain('Periode deteksi');
    expect(html).toContain('Semua VIIRS');
    expect(html).toContain('Keyakinan deteksi');
    expect(html.match(/id="location-panel"/g)).toHaveLength(1);
    expect(html).toContain('id="location-panel" hidden=""');
    expect(html).toContain('id="detection-list"');
    expect(html).toContain('Data belum tersedia');
    expect(html).toContain('tidak dianggap sebagai nol');
  });

  it('exposes real scene/camera buttons disabled until map readiness, not a static geographic mockup', () => {
    const html = renderToString(<HotspotMonitor />);
    for (const name of ['Flat', 'Globe', '3D Terrain', 'Satellite']) expect(html).toContain(name);
    expect(html).toContain('aria-label="Kontrol kamera peta"');
    expect(html).toContain('aria-label="Kembali ke cakupan Indonesia"');
    expect(html).toContain('Menyiapkan peta');
    expect(html).toMatch(/<button[^>]+disabled=""[^>]+aria-pressed="true"[^>]*>Flat/);
    expect(html).toContain('class="map-canvas"');
    expect(html).toContain('aria-label="Kontrol peta"');
  });

  it('renders heatmap visualization selector as default and shows clean map & fullscreen camera options', () => {
    const html = renderToString(<HotspotMonitor />);
    expect(html).toContain('Heatmap sebaran');
    expect(html).toContain('Titik &amp; cluster');
    expect(html).toContain('Hexagon H3');
    expect(html).toMatch(/<button[^>]+aria-pressed="true"[^>]*>Heatmap sebaran<\/button>/);
    expect(html).toContain('Sebaran Panas');
    expect(html).toContain('legend-heat-ramp');
    expect(html).toContain('camera-fullscreen');
    expect(html).toContain('Layar penuh');
    expect(html).toContain('Peta Hotspot');
  });
});
