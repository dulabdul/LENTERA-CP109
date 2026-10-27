import "server-only";
import { z } from "zod";
import { hotspotPayloadSchema, sourceResponseSchema, viirsSourceSchema, type HotspotPayload } from "../contracts";
import { evaluateFreshness } from "../freshness";
import { POLICY } from "../policy";
import { withinWindow } from "../time";
import type { HotspotRepository } from "../storage/hotspot-repository";
const querySchema = z.object({ range: z.enum(['24h','48h','7d']).default('24h'), source: viirsSourceSchema.optional(), confidence: z.enum(['low','nominal','high']).optional(), bbox: z.string().optional() }).strict();
export class InvalidHotspotQuery extends Error { constructor() { super('Parameter hotspot tidak valid.'); } }
export function parseHotspotQuery(params: URLSearchParams) {
  if ([...params.keys()].some(key => params.getAll(key).length !== 1) || params.toString().length > 512) throw new InvalidHotspotQuery();
  const parsed = querySchema.safeParse(Object.fromEntries(params)); if (!parsed.success) throw new InvalidHotspotQuery();
  let bbox: [number, number, number, number] = [...POLICY.INDONESIA_FETCH_BBOX];
  if (parsed.data.bbox !== undefined) {
    const cells = parsed.data.bbox.split(',');
    if (cells.length !== 4 || cells.some(cell => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cell))) throw new InvalidHotspotQuery();
    const values = cells.map(Number) as typeof bbox;
    const [w,s,e,n] = values, [minW,minS,maxE,maxN] = POLICY.INDONESIA_FETCH_BBOX;
    if (values.some(value => !Number.isFinite(value)) || w >= e || s >= n || w < minW || s < minS || e > maxE || n > maxN) throw new InvalidHotspotQuery();
    bbox = values;
  }
  return { ...parsed.data, bbox, areaFiltered: parsed.data.bbox !== undefined, hours: ({ '24h':24, '48h':48, '7d':168 } as const)[parsed.data.range] };
}
export type HotspotQuery = ReturnType<typeof parseHotspotQuery>;
export async function serveHotspots(repository: HotspotRepository | null, query: HotspotQuery, now = new Date()) {
  const stored = repository ? await repository.read() : null;
  const snapshot = stored?.snapshot ?? null;
  const meta = evaluateFreshness({ kind: 'hotspots', now, hasPayload: !!snapshot, fetchedAt: snapshot?.fetchedAt ?? null, dataVersion: stored?.snapshotId ?? null, latestAttemptFailed: stored?.latestAttemptFailed, lastAttemptAt: stored?.lastAttemptAt, issues: [...(snapshot?.issues ?? []), ...(stored?.issues ?? []), ...(!snapshot ? [{ code: repository ? 'upstream-error' as const : 'not-configured' as const, source: 'hotspots', detail: 'Snapshot hotspot operasional belum tersedia.' }] : [])] });
  let data: HotspotPayload | null = null;
  if (snapshot && meta.state !== 'unavailable') {
    const [w,s,e,n] = query.bbox;
    const features = snapshot.payload.features.filter(feature => {
      const { properties: p, geometry: { coordinates: [lon, lat] } } = feature;
      return withinWindow(p.acquiredAt, now, query.hours) && (!query.source || p.source === query.source) && (!query.confidence || p.confidence === query.confidence) && lon >= w && lon <= e && lat >= s && lat <= n;
    });
    data = { ...snapshot.payload, features, summary: { detectionsCount: features.length, areaLabel: query.areaFiltered ? 'Area tampilan dalam Indonesia — batas indikatif Natural Earth' : 'Indonesia — batas indikatif Natural Earth' } };
  }
  return sourceResponseSchema(hotspotPayloadSchema).parse({ meta, data });
}
export function hotspotCacheControl(meta: { state: string; validUntil: string | null }, now: Date) {
  const remaining = meta.validUntil ? Math.floor((Date.parse(meta.validUntil) - now.getTime()) / 1000) : 0;
  return meta.state === 'ok' && remaining > 0 ? `public, max-age=0, s-maxage=${Math.min(60,remaining)}` : 'no-store';
}
