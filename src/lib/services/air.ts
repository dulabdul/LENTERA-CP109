import 'server-only';
import { airBucket, airCacheKey, projectAir, type AirResponse, type AirSeries } from '../air-series';
import { locationSchema, type Location } from '../contracts';
import { pointInIndonesia } from '../geography';
import { MINUTE_MS, POLICY } from '../policy';
import { AirProviderError } from '../providers/open-meteo';
import { currentHour } from '../time';
import { AirRepository, type CachedAir } from '../storage/air-repository';
export class InvalidAirQuery extends Error { constructor() { super('Koordinat lokasi tidak valid.'); } }
export function parseAirQuery(params: URLSearchParams): Location {
  if (params.toString().length > 256 || [...params.keys()].some(key => !['lat', 'lon'].includes(key) || params.getAll(key).length !== 1)) throw new InvalidAirQuery();
  const lat = params.get('lat'), lon = params.get('lon');
  if (!lat || !lon || ![lat, lon].every(value => /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))) throw new InvalidAirQuery();
  const parsed = locationSchema.safeParse({ lat: Number(lat), lon: Number(lon) });
  if (!parsed.success || !pointInIndonesia(parsed.data)) throw new InvalidAirQuery();
  return parsed.data;
}
export class AirService {
  private readonly inFlight = new Map<string, Promise<CachedAir>>();
  constructor(private readonly repository: AirRepository, private readonly fetchSeries: (location: Location, now: Date) => Promise<AirSeries>, private readonly clock = () => new Date()) {}
  async get(location: Location, now = this.clock()): Promise<AirResponse> {
    if (!pointInIndonesia(location)) throw new InvalidAirQuery();
    const query = airBucket(location), key = airCacheKey(query);
    let cached = await this.repository.read(query);
    const age = cached.record ? now.getTime() - Date.parse(cached.record.fetchedAt) : Infinity;
    const current = cached.record?.content.series.find(sample => Date.parse(sample.validAt) === currentHour(now));
    const recentAttempt = cached.lastAttemptAt && now.getTime() - Date.parse(cached.lastAttemptAt) < MINUTE_MS;
    const needsRefresh = !cached.record || age < 0 || age >= POLICY.AIR_CACHE_MINUTES * MINUTE_MS || ((!current || current.pm25UgM3 === null) && !recentAttempt) || cached.failed;
    if (needsRefresh && (!cached.retryAt || Date.parse(cached.retryAt) <= now.getTime())) {
      let pending = this.inFlight.get(key);
      if (!pending) {
        pending = this.refresh(query, now); this.inFlight.set(key, pending);
        void pending.finally(() => { if (this.inFlight.get(key) === pending) this.inFlight.delete(key); }).catch(() => {});
      }
      cached = await pending;
    }
    // Projection always uses the latest clock after IO; it never freezes the first request's hour.
    const evaluatedAt = new Date(Math.max(now.getTime(), this.clock().getTime()));
    return projectAir(cached.record, location, evaluatedAt, { lastAttemptAt: cached.lastAttemptAt, failed: cached.failed, issues: cached.issues });
  }
  private async refresh(location: Location, now: Date): Promise<CachedAir> {
    let lease;
    try { lease = await this.repository.claim(location, now); }
    catch { return { ...(await this.repository.read(location)), failed: true, issues: [{ code: 'upstream-error', source: 'air', detail: 'Cache/pengambilan udara belum dapat diperbarui.' }] }; }
    if (!lease) return this.repository.read(location);
    try {
      const content = await this.fetchSeries(location, now);
      await this.repository.finish(lease, content, new Date(Math.max(now.getTime(), this.clock().getTime())));
    } catch (error) {
      const issues = [{ code: error instanceof AirProviderError ? error.code : 'upstream-error' as const, source: 'air', detail: 'Pengambilan terbaru gagal; data terakhir hanya ditampilkan selama masih dalam batas umur.' }];
      try { await this.repository.finish(lease, null, new Date(Math.max(now.getTime(), this.clock().getTime())), issues, error instanceof AirProviderError ? error.retryAfterMs : 60_000); } catch { /* An expired/replaced lease cannot overwrite newer metadata. */ }
    }
    return this.repository.read(location);
  }
}