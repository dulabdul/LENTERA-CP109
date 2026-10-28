import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import manifest from '@/data/provinces-manifest.json';
export const provinceManifest = manifest;
export type ProvinceProperties = { id: string; KODE_PROV: string; PROVINSI: string };
export type Provinces = FeatureCollection<Polygon | MultiPolygon, ProvinceProperties>;
export function parseProvinces(raw: unknown): Provinces {
  const data = raw as Provinces;
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length !== manifest.featureCount) throw Error('Invalid province coverage');
  const ids = new Set<string>(), names = new Set<string>();
  for (const feature of data.features) {
    const properties = feature.properties;
    if (feature.type !== 'Feature' || !manifest.catalog.some(p => p.id === properties?.id && p.name === properties?.PROVINSI) || ids.has(properties.id) || names.has(properties.PROVINSI)) throw Error('Invalid province identity');
    ids.add(properties.id); names.add(properties.PROVINSI);
    if (!['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) throw Error('Invalid province geometry');
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    if (!polygons.length) throw Error('Empty province geometry');
    for (const rings of polygons) {
      if (!rings.length) throw Error('Missing polygon rings');
      for (const ring of rings) {
        if (ring.length < 4 || ring[0]![0] !== ring.at(-1)![0] || ring[0]![1] !== ring.at(-1)![1]) throw Error('Unclosed province ring');
        for (const point of ring) if (point.length !== 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || point[0]! < 94 || point[0]! > 142 || point[1]! < -12 || point[1]! > 7) throw Error('Invalid province coordinate');
      }
    }
  }
  return data;
}

export type ProvinceHotspotSummary = { id: string; name: string; count: number };

export function summarizeTopProvinces(
  features: Array<{ geometry?: { coordinates?: number[] } }>,
  limit = 2
): ProvinceHotspotSummary[] {
  if (!features || features.length === 0) return [];
  const counts: Record<string, number> = {};
  for (const feature of features) {
    const coords = feature?.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const [lon, lat] = coords;
    if (typeof lon !== 'number' || typeof lat !== 'number') continue;
    const candidates = manifest.catalog.filter(p => {
      const [minLon, minLat, maxLon, maxLat] = p.bounds;
      return minLon !== undefined && maxLon !== undefined && minLat !== undefined && maxLat !== undefined &&
        lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
    });
    if (candidates.length === 1 && candidates[0]) {
      counts[candidates[0].id] = (counts[candidates[0].id] || 0) + 1;
    } else if (candidates.length > 1 && candidates[0]) {
      let closest = candidates[0];
      let minDistance = Infinity;
      for (const cand of candidates) {
        const [cLon, cLat] = cand.label;
        if (cLon === undefined || cLat === undefined) continue;
        const dLon = cLon - lon;
        const dLat = cLat - lat;
        const dist = dLon * dLon + dLat * dLat;
        if (dist < minDistance) {
          minDistance = dist;
          closest = cand;
        }
      }
      counts[closest.id] = (counts[closest.id] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([id, count]) => {
      const p = manifest.catalog.find(prov => prov.id === id);
      return { id, name: p?.name ?? id, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

