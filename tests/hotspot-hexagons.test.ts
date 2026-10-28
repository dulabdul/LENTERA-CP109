import { describe, it, expect } from 'vitest';
import { buildHotspotHexagons, hexAreaKm2, type HexInput } from '../src/lib/hotspot-hexagons';
const point = (id: string, lat = -2.21, lon = 113.92): HexInput => ({ geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { id, acquiredAt: '2026-10-27T10:00:00Z' } });
describe('MAP-D H3 counts with existing filtered detections', () => {
  it('conserves counts, groups nearby points, preserves closed GeoJSON lon/lat rings', () => {
    const features = [point('a'), point('b'), point('c', -6.2, 106.8)], result = buildHotspotHexagons(features, 5, 'ok')!;
    expect(result.features.reduce((n, f) => n + f.properties.count, 0)).toBe(3); expect(result.features).toHaveLength(2);
    for (const f of result.features) { const ring = f.geometry.coordinates[0]!; expect(ring[0]).toEqual(ring.at(-1)); expect(ring[0]![0]).toBeGreaterThan(100); }
    expect(buildHotspotHexagons([...features].reverse(), 5, 'ok')).toEqual(result);
  });
  it('does not manufacture cells/zeros when unavailable or empty with limited coverage', () => {
    expect(buildHotspotHexagons([point('a')], 5, 'unavailable')).toBeNull(); expect(buildHotspotHexagons([], 5, 'partial')!.features).toEqual([]);
  });
  it('recomputes from exactly the supplied viewport/filter set and resolution', () => {
    const all = Array.from({ length: 200 }, (_, i) => point(String(i), -2 + i * 0.001, 114 + i * 0.001));
    for (const res of [4, 5, 6] as const) expect(buildHotspotHexagons(all.slice(25, 61), res, 'stale')!.features.reduce((n, f) => n + f.properties.count, 0)).toBe(36);
    expect(hexAreaKm2(4)).toBeGreaterThan(hexAreaKm2(6));
  });
  it('rejects invalid coordinates/duplicates and unsupported resolutions', () => {
    expect(() => buildHotspotHexagons([point('a', 500)], 5, 'ok')).toThrow(); expect(() => buildHotspotHexagons([point('a'), point('a')], 5, 'ok')).toThrow(); expect(() => buildHotspotHexagons([], 10 as 5, 'ok')).toThrow();
  });
});
