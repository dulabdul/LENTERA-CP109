import 'server-only';
import { resolve } from 'node:path';
import { readEnvironment } from '../env';
import { createAirFetcher } from '../providers/open-meteo';
import { AirRepository } from '../storage/air-repository';
import { FileObjectStore, R2ObjectStore } from '../storage/object-store';
import { createR2Client } from '../storage/r2';
import { AirService } from './air';
import { AirRequestLimiter, AirUpstreamBudget, requestLimitIdentity } from './air-limits';
export interface AirRuntime { service: AirService; consume: (request: Request, now: Date) => Promise<{ allowed: boolean; retryAfter: number }> }
let sharedRuntime: AirRuntime | null = null;
export function createAirStore() {
  const { server } = readEnvironment();
  if (server.R2_ENDPOINT) { const { client, bucket } = createR2Client(); return new R2ObjectStore(client, bucket); }
  return process.env.NODE_ENV !== 'production' ? new FileObjectStore(resolve('.data/air')) : null;
}
export function createAirRuntime(): AirRuntime | null {
  if (sharedRuntime) return sharedRuntime;
  const { server } = readEnvironment();
  const production = process.env.NODE_ENV === 'production', vercel = process.env.VERCEL === '1';
  // A configured string alone is not a working hosting limiter. Unknown production wiring fails closed.
  if (production && (server.RATE_LIMIT_PROVIDER !== 'persistent' || !server.RATE_LIMIT_SECRET || !server.AIR_UPSTREAM_REQUESTS_PER_DAY || !vercel)) return null;
  const store = createAirStore(); if (!store) return null;
  const limiter = new AirRequestLimiter(store, server.RATE_LIMIT_SECRET ?? 'lentera-development-shared-limiter-only');
  const budget = new AirUpstreamBudget(store, server.AIR_UPSTREAM_REQUESTS_PER_DAY ?? 100);
  const repository = new AirRepository(store);
  const fetcher = createAirFetcher({ baseUrl: server.OPEN_METEO_BASE_URL, key: server.OPEN_METEO_API_KEY, beforeRequest: () => budget.consume(new Date()) });
  sharedRuntime = { service: new AirService(repository, fetcher), consume: (request, now) => limiter.consume(requestLimitIdentity(request, vercel, production), now) };
  return sharedRuntime;
}
