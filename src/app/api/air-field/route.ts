import { createAirFieldRepository } from '@/lib/air-field/runtime';
import { projectField } from '@/lib/air-field/contracts';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const now = new Date();
  if ([...new URL(request.url).searchParams].length) return Response.json({ error: 'Endpoint grid tidak menerima parameter lokasi.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  try {
    const repository = createAirFieldRepository();
    const result = repository ? await repository.read(now) : projectField(null, null, now);
    const remaining = result.meta.validUntil ? Math.max(0, Math.floor((Date.parse(result.meta.validUntil) - now.getTime()) / 1000)) : 0;
    const cache = result.data ? `public, max-age=${Math.min(60, remaining)}, s-maxage=${Math.min(60, remaining)}` : 'no-store';
    return Response.json(result, { status: result.data ? 200 : 503, headers: { 'Cache-Control': cache } });
  } catch { return Response.json(projectField(null, null, now), { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
