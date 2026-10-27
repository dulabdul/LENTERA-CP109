import { createOperationalHotspotRepository } from "@/lib/storage/runtime";
import { hotspotCacheControl, InvalidHotspotQuery, parseHotspotQuery, serveHotspots } from "@/lib/services/hotspots";
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  let query;
  try { query = parseHotspotQuery(new URL(request.url).searchParams); }
  catch (error) {
    if (!(error instanceof InvalidHotspotQuery)) throw error;
    return Response.json({ error: { code: 'invalid-query', detail: 'Parameter hotspot tidak valid.' } }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const now = new Date();
  let response;
  try { response = await serveHotspots(createOperationalHotspotRepository(), query, now); }
  catch { response = await serveHotspots(null, query, now); }
  return Response.json(response, { status: response.meta.state === 'unavailable' ? 503 : 200, headers: { 'Cache-Control': hotspotCacheControl(response.meta, now), 'X-Content-Type-Options': 'nosniff' } });
}
