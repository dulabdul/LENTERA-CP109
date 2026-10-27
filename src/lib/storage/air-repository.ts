import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { z } from 'zod';
import { airCacheKey, airCacheRecordSchema, type AirCacheRecord, type AirSeries } from '../air-series';
import { dataIssueSchema, isoUtcSchema, type DataIssue, type Location } from '../contracts';
import { HOUR_MS, POLICY } from '../policy';
import { StoreConflict, type ObjectStore } from './object-store';
const hash = (body: Buffer) => createHash('sha256').update(body).digest('hex');
const encode = (value: unknown) => Buffer.from(JSON.stringify(value));
const attemptSchema = z.object({ token: z.string().uuid(), startedAt: isoUtcSchema, finishedAt: isoUtcSchema.nullable(), leaseUntil: isoUtcSchema, retryAt: isoUtcSchema,
  status: z.enum(['running', 'published', 'failed']), issues: z.array(dataIssueSchema) }).strict();
const envelopeSchema = z.object({ checksum: z.string().regex(/^[a-f0-9]{64}$/), record: airCacheRecordSchema }).strict();
export interface CachedAir { record: AirCacheRecord | null; issues: DataIssue[]; failed: boolean; lastAttemptAt: string | null; retryAt: string | null }
export interface AirLease { location: Location; token: string; attemptEtag: string; cacheEtag: string | null }
export function airDataVersion(content: AirSeries) { return hash(encode(content)); }
export class AirRepository {
  constructor(private readonly store: ObjectStore) {}
  async read(location: Location): Promise<CachedAir> {
    const key = airCacheKey(location), issues: DataIssue[] = [];
    let record: AirCacheRecord | null = null;
    let attempt: z.infer<typeof attemptSchema> | null = null;
    try {
      const object = await this.store.get(`air/cache/${key}.json.gz`);
      if (object) {
        const envelope = envelopeSchema.parse(JSON.parse(gunzipSync(object.body, { maxOutputLength: 1024 * 1024 }).toString()));
        if (hash(encode(envelope.record)) !== envelope.checksum || airDataVersion(envelope.record.content) !== envelope.record.dataVersion || airCacheKey(envelope.record.content.queryLocation) !== key) throw new Error();
        record = envelope.record;
      }
    } catch { issues.push({ code: 'invalid-response', source: 'air', detail: 'Cache seri udara tidak dapat diverifikasi.' }); }
    try {
      const object = await this.store.get(`air/attempts/${key}.json`);
      if (object) attempt = attemptSchema.parse(JSON.parse(object.body.toString()));
      if (attempt?.status === 'failed') issues.push(...attempt.issues);
    } catch { issues.push({ code: 'invalid-response', source: 'air', detail: 'Metadata pengambilan udara tidak dapat diverifikasi.' }); }
    return { record, issues, failed: issues.length > 0 || !attempt || attempt.status !== 'published', lastAttemptAt: attempt?.startedAt ?? null, retryAt: attempt?.status === 'running' ? attempt.leaseUntil : attempt?.status === 'failed' ? attempt.retryAt : null };
  }
  async claim(location: Location, now: Date): Promise<AirLease | null> {
    const key = airCacheKey(location), cache = await this.store.get(`air/cache/${key}.json.gz`), previous = await this.store.get(`air/attempts/${key}.json`);
    if (previous) {
      let raw: unknown;
      try { raw = JSON.parse(previous.body.toString()); } catch { raw = null; }
      const parsed = attemptSchema.safeParse(raw);
      if (parsed.success && ((parsed.data.status === 'running' && Date.parse(parsed.data.leaseUntil) > now.getTime()) || (parsed.data.status === 'failed' && Date.parse(parsed.data.retryAt) > now.getTime()))) return null;
    }
    const token = randomUUID();
    const attempt = { token, startedAt: now.toISOString(), finishedAt: null, leaseUntil: new Date(now.getTime() + 70_000).toISOString(), retryAt: now.toISOString(), status: 'running', issues: [] };
    try { await this.store.put(`air/attempts/${key}.json`, encode(attempt), previous?.etag ?? null); }
    catch (error) { if (error instanceof StoreConflict) return null; throw error; }
    const stored = await this.store.get(`air/attempts/${key}.json`);
    if (!stored || JSON.parse(stored.body.toString()).token !== token) return null;
    return { location, token, attemptEtag: stored.etag, cacheEtag: cache?.etag ?? null };
  }
  async finish(lease: AirLease, content: AirSeries | null, now: Date, issues: DataIssue[] = [], retryAfterMs = 60_000) {
    const key = airCacheKey(lease.location), current = await this.store.get(`air/attempts/${key}.json`);
    if (!current || current.etag !== lease.attemptEtag) throw new StoreConflict();
    const previous = attemptSchema.parse(JSON.parse(current.body.toString()));
    if (previous.token !== lease.token || Date.parse(previous.leaseUntil) <= now.getTime()) throw new StoreConflict();
    if (content) {
      const record = airCacheRecordSchema.parse({ schemaVersion: '1.0', fetchedAt: now.toISOString(), dataVersion: airDataVersion(content), content });
      if (airCacheKey(content.queryLocation) !== key || (content.runAt && Date.parse(content.runAt) > now.getTime())) throw new Error('Invalid cache provenance.');
      await this.store.put(`air/cache/${key}.json.gz`, gzipSync(encode({ checksum: hash(encode(record)), record })), lease.cacheEtag);
    }
    await this.store.put(`air/attempts/${key}.json`, encode({ ...previous, status: content ? 'published' : 'failed', finishedAt: now.toISOString(), issues,
      retryAt: new Date(now.getTime() + Math.max(60_000, retryAfterMs)).toISOString() }), lease.attemptEtag);
  }
  async prune(now: Date) {
    let removed = 0;
    for (const prefix of ['air/cache/', 'air/attempts/']) {
      for (const item of await this.store.list(prefix)) {
        if (Date.parse(item.modifiedAt) > now.getTime() - POLICY.AIR_CACHE_RETENTION_HOURS * HOUR_MS) continue;
        const object = await this.store.get(item.key); if (!object) continue;
        if (prefix === 'air/cache/') {
          const envelope = envelopeSchema.parse(JSON.parse(gunzipSync(object.body, { maxOutputLength: 1024 * 1024 }).toString()));
          if (Date.parse(envelope.record.fetchedAt) > now.getTime() - POLICY.AIR_CACHE_RETENTION_HOURS * HOUR_MS) continue;
        } else {
          const attempt = attemptSchema.parse(JSON.parse(object.body.toString()));
          if (Date.parse(attempt.leaseUntil) > now.getTime() || Date.parse(attempt.startedAt) > now.getTime() - POLICY.AIR_CACHE_RETENTION_HOURS * HOUR_MS) continue;
        }
        try { await this.store.delete(item.key, object.etag); removed++; } catch (error) { if (!(error instanceof StoreConflict)) throw error; }
      }
    }
    return removed;
  }
}
