import { projectAir } from '@/lib/air-series';
import { InvalidAirQuery, parseAirQuery } from '@/lib/services/air';
import { createAirRuntime } from '@/lib/services/air-runtime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 75;
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request: Request) {
  let location;
  try { location = parseAirQuery(new URL(request.url).searchParams); }
  catch (error) {
    if (!(error instanceof InvalidAirQuery)) throw error;
    return Response.json({ error: { code: 'invalid-query', detail: 'Masukkan satu lokasi dengan koordinat valid di Indonesia.' } }, { status: 400, headers });
  }
  const now = new Date();
  try {
    const services = createAirRuntime();
    if (services) {
      const limit = await services.consume(request, now);
      if (!limit.allowed) return Response.json({ error: { code: 'rate-limit', detail: 'Terlalu banyak permintaan. Coba lagi setelah jeda.' } }, { status: 429, headers: { ...headers, 'Retry-After': String(limit.retryAfter) } });
      const response = await services.service.get(location);
      return Response.json(response, { status: response.meta.state === 'unavailable' ? 503 : 200, headers });
    }
  } catch { /* Return a safe source-shaped response; no provider URL, key or raw storage exception. */ }
  return Response.json(projectAir(null, location, now, { issues: [{ code: 'not-configured', source: 'air', detail: 'Sumber udara, penyimpanan, atau pembatas permintaan belum tersedia.' }] }), { status: 503, headers });
}
