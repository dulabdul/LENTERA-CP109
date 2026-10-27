import 'server-only';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { z } from 'zod';
import { POLICY } from '../policy';
import { StoreConflict, type ObjectStore } from '../storage/object-store';
export class LimiterUnavailable extends Error { constructor() { super('Pembatas permintaan belum tersedia.'); } }
export class UpstreamBudgetExceeded extends Error { constructor() { super('Batas pengambilan data udara tercapai.'); } }
const windowSchema = z.object({ acceptedAt: z.array(z.number().int().nonnegative()).max(POLICY.API_REQUESTS_PER_MINUTE) }).strict();
const budgetSchema = z.object({ count: z.number().int().nonnegative() }).strict();
const encode = (value: unknown) => Buffer.from(JSON.stringify(value));
function canonicalIp(value: string): string | null {
  const version = isIP(value); if (!version) return null;
  if (version === 4) return value;
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  if (canonical.startsWith('::ffff:')) {
    const parts = canonical.slice(7).split(':').map(part => parseInt(part, 16));
    if (parts.length === 2) return `${parts[0]! >> 8}.${parts[0]! & 255}.${parts[1]! >> 8}.${parts[1]! & 255}`;
  }
  return canonical;
}
export function requestLimitIdentity(request: Request, vercel: boolean, production: boolean): string {
  // Only trust platform-populated headers on the configured platform, never generic forwarded headers.
  if (vercel) {
    const value = request.headers.get('x-vercel-forwarded-for')?.trim();
    const ip = value ? canonicalIp(value) : null;
    if (!ip) throw new LimiterUnavailable();
    return ip;
  }
  if (production) throw new LimiterUnavailable();
  return 'development-shared';
}
export class AirRequestLimiter {
  constructor(private readonly store: ObjectStore, private readonly secret: string) {
    if (secret.length < 32) throw new LimiterUnavailable();
  }
  async consume(identity: string, now: Date): Promise<{ allowed: boolean; retryAfter: number }> {
    const digest = createHmac('sha256', this.secret).update(identity).digest('hex');
    const key = `limits/air-actions/${digest}.json`;
    for (let attempt = 0; attempt < 10; attempt++) {
      const object = await this.store.get(key);
      const parsed = object ? windowSchema.safeParse(JSON.parse(object.body.toString())) : null;
      if (object && (!parsed?.success || parsed.data.acceptedAt.some(time => time > now.getTime()))) throw new LimiterUnavailable();
      const times = parsed?.success ? parsed.data.acceptedAt.filter(time => time > now.getTime() - 60_000).sort((a, b) => a - b) : [];
      if (times.length >= POLICY.API_REQUESTS_PER_MINUTE) return { allowed: false, retryAfter: Math.max(1, Math.ceil((times[0]! + 60_000 - now.getTime()) / 1000)) };
      try { await this.store.put(key, encode({ acceptedAt: [...times, now.getTime()] }), object?.etag ?? null); return { allowed: true, retryAfter: 0 }; }
      catch (error) {
        if (!(error instanceof StoreConflict)) throw new LimiterUnavailable();
        await new Promise(resolve => setTimeout(resolve, 2 * (attempt + 1)));
      }
    }
    throw new LimiterUnavailable();
  }
}
export class AirUpstreamBudget {
  constructor(private readonly store: ObjectStore, private readonly maximum: number) {
    if (!Number.isInteger(maximum) || maximum < 1) throw new LimiterUnavailable();
  }
  async consume(now: Date) {
    const key = `limits/upstream/${now.toISOString().slice(0, 10)}.json`;
    for (let attempt = 0; attempt < 10; attempt++) {
      const object = await this.store.get(key);
      const parsed = object ? budgetSchema.safeParse(JSON.parse(object.body.toString())) : null;
      if (object && !parsed?.success) throw new LimiterUnavailable();
      const count = parsed?.success ? parsed.data.count : 0;
      if (count >= this.maximum) throw new UpstreamBudgetExceeded();
      try { await this.store.put(key, encode({ count: count + 1 }), object?.etag ?? null); return; }
      catch (error) { if (!(error instanceof StoreConflict)) throw new LimiterUnavailable(); await new Promise(resolve => setTimeout(resolve, 2 * (attempt + 1))); }
    }
    throw new LimiterUnavailable();
  }
}

export async function pruneAirLimits(store: ObjectStore, now: Date) {
  let removed = 0;
  for (const item of await store.list('limits/')) {
    if (Date.parse(item.modifiedAt) > now.getTime() - 24 * 3_600_000) continue;
    const object = await store.get(item.key); if (!object) continue;
    if (item.key.startsWith('limits/air-actions/')) {
      const state = windowSchema.parse(JSON.parse(object.body.toString()));
      if (state.acceptedAt.some(time => time > now.getTime() - 24 * 3_600_000)) continue;
    } else if (item.key.startsWith('limits/upstream/')) {
      const day = item.key.match(/\/(\d{4}-\d{2}-\d{2})\.json$/)?.[1];
      if (!day || Date.parse(`${day}T00:00:00Z`) > now.getTime() - 48 * 3_600_000) continue;
    } else continue;
    try { await store.delete(item.key, object.etag); removed++; } catch (error) { if (!(error instanceof StoreConflict)) throw error; }
  }
  return removed;
}
