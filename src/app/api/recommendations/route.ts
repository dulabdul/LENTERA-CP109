import { InvalidAirQuery } from '@/lib/services/air';
import { createAirRuntime } from '@/lib/services/air-runtime';
import { parseRecommendationQuery, serveRecommendations, unavailableRecommendations } from '@/lib/services/recommendations';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 75;
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request: Request) {
  let query;
  try { query = parseRecommendationQuery(new URL(request.url).searchParams); }
  catch (error) {
    if (!(error instanceof InvalidAirQuery)) throw error;
    return Response.json({ error: { code: 'invalid-query', detail: 'Pilih satu lokasi Indonesia dan kelompok pengguna yang valid.' } }, { status: 400, headers });
  }
  try {
    const services = createAirRuntime();
    if (services) {
      const limit = await services.consume(request, new Date());
      if (!limit.allowed) return Response.json({ error: { code: 'rate-limit', detail: 'Terlalu banyak permintaan. Coba lagi setelah jeda.' } }, { status: 429, headers: { ...headers, 'Retry-After': String(limit.retryAfter) } });
      const response = await serveRecommendations(services.service, query.location, query.audience);
      return Response.json(response, { status: response.meta.state === 'unavailable' ? 503 : 200, headers });
    }
  } catch { /* Provider, storage and configuration errors never expose credentials or raw responses. */ }
  return Response.json(unavailableRecommendations(query.location, query.audience, new Date()), { status: 503, headers });
}
