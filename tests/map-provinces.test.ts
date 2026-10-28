import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseProvinces, provinceManifest } from '../src/lib/map-provinces';
const bytes = readFileSync('public/data/provinces.geojson'), raw = () => JSON.parse(bytes.toString());
describe('MAP-B province dataset provenance and geometry', () => {
  it('keeps 38 unique publisher shape ids and matching actual-data checksum', () => {
    const data = parseProvinces(raw()); expect(data.features).toHaveLength(38);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(provinceManifest.sha256);
    expect(data.features.filter(f => /papua/i.test(f.properties.PROVINSI))).toHaveLength(6);
    expect(provinceManifest.indicative).toBe(true); expect(provinceManifest.surveyDate).toBeNull();
  });
  it('rejects empty/duplicate/corrupt coverage instead of treating it as authoritative geometry', () => {
    const missing = raw(); missing.features.pop(); expect(() => parseProvinces(missing)).toThrow();
    const duplicate = raw(); duplicate.features[1] = duplicate.features[0]; expect(() => parseProvinces(duplicate)).toThrow();
    const invalid = raw(); invalid.features[0].geometry.coordinates = []; expect(() => parseProvinces(invalid)).toThrow();
  });
  it('does not silently accept changed coordinates or unclosed rings', () => {
    const data = raw(), geometry = data.features[0].geometry;
    const ring = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0]; ring[0][0] = 500;
    expect(() => parseProvinces(data)).toThrow();
  });
  it('summarizes top provinces from coordinates correctly', async () => {
    const { summarizeTopProvinces } = await import('../src/lib/map-provinces');
    expect(summarizeTopProvinces([])).toEqual([]);
    // Mock features in Palangkaraya (Kalteng ~ [113.92, -2.21]) and Palembang (Sumsel ~ [104.75, -2.99])
    const features = [
      { geometry: { coordinates: [113.92, -2.21] } },
      { geometry: { coordinates: [113.95, -2.20] } },
      { geometry: { coordinates: [113.90, -2.25] } },
      { geometry: { coordinates: [104.75, -2.99] } },
      { geometry: { coordinates: [104.70, -2.95] } },
    ];
    const top = summarizeTopProvinces(features, 2);
    expect(top).toHaveLength(2);
    expect(top[0]?.name).toBe('Kalimantan Tengah');
    expect(top[0]?.count).toBe(3);
    expect(top[1]?.name).toBe('Sumatera Selatan');
    expect(top[1]?.count).toBe(2);
  });
});
