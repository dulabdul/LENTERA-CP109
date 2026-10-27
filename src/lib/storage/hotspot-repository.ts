import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { z } from "zod";
import { dataIssueSchema, hotspotPayloadSchema, isoUtcSchema, viirsSourceSchema, type DataIssue } from "../contracts";
import { HOUR_MS, POLICY } from "../policy";
import type { IngestResult } from "../services/hotspot-ingest";
import { StoreConflict, type ObjectStore } from "./object-store";
const CURRENT = 'hotspots/current.json', FALLBACK = 'hotspots/last-good.json', ATTEMPT = 'jobs/hotspots/latest-attempt.json';
const pointerSchema = z.object({ schemaVersion: z.literal('1.0'), snapshotId: z.string().regex(/^[a-f0-9]{64}$/), checksum: z.string().regex(/^[a-f0-9]{64}$/), fetchedAt: isoUtcSchema }).strict();
const batchSchema = z.object({ source: viirsSourceSchema, startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), days: z.number().int().min(1).max(5), status: z.enum(['complete','partial','failed']), invalidRows: z.number().int().nonnegative(), recordsCount: z.number().int().nonnegative() }).strict();
export const snapshotSchema = z.object({ schemaVersion: z.literal('1.0'), synthetic: z.boolean(), fetchedAt: isoUtcSchema, payload: hotspotPayloadSchema, issues: z.array(dataIssueSchema), batches: z.array(batchSchema) }).strict().superRefine((snapshot, ctx) => {
  if (Date.parse(snapshot.fetchedAt) < Date.parse(snapshot.payload.coverage.asOf) || (snapshot.payload.coverage.missingSources.length && !snapshot.issues.length)) ctx.addIssue({ code: 'custom', message: 'Invalid snapshot fetch time or coverage issues' });
});
const attemptSchema = z.object({ schemaVersion: z.literal('1.0'), runId: z.string().uuid(), startedAt: isoUtcSchema, finishedAt: isoUtcSchema.nullable(), status: z.enum(['running','failed','published']), snapshotId: z.string().nullable(), batches: z.array(batchSchema), issues: z.array(dataIssueSchema) }).strict();
export type HotspotSnapshot = z.infer<typeof snapshotSchema>;
type Attempt = z.infer<typeof attemptSchema>;
export interface WriterToken { attempt: Attempt; previousEtag: string | null; attemptEtag: string }
export interface RepositoryRead { snapshot: HotspotSnapshot | null; snapshotId: string | null; issues: DataIssue[]; latestAttemptFailed: boolean; lastAttemptAt: string | null }
const encode = (value: unknown) => Buffer.from(JSON.stringify(value));
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const issue = (detail: string): DataIssue => ({ code: 'invalid-response', source: 'hotspots', detail });
export class HotspotRepository {
  constructor(private readonly store: ObjectStore, private readonly allowSynthetic = false) {}
  async begin(now: Date): Promise<WriterToken> {
    const current = await this.store.get(CURRENT), latest = await this.store.get(ATTEMPT);
    const attempt: Attempt = { schemaVersion: '1.0', runId: randomUUID(), startedAt: now.toISOString(), finishedAt: null, status: 'running', snapshotId: null, batches: [], issues: [] };
    await this.store.put(ATTEMPT, encode(attempt), latest?.etag ?? null);
    const stored = await this.store.get(ATTEMPT);
    if (!stored || JSON.parse(stored.body.toString()).runId !== attempt.runId) throw new StoreConflict();
    await this.store.put(`jobs/hotspots/runs/${attempt.runId}.json`, encode(attempt), null);
    return { attempt, previousEtag: current?.etag ?? null, attemptEtag: stored.etag };
  }
  async finish(token: WriterToken, result: IngestResult, fetchedAt: Date, synthetic = false): Promise<string | null> {
    const active = await this.store.get(ATTEMPT);
    if (!active || active.etag !== token.attemptEtag) throw new StoreConflict();
    let snapshotId: string | null = null;
    if (result.payload) {
      const snapshot = snapshotSchema.parse({ schemaVersion: '1.0', synthetic, fetchedAt: fetchedAt.toISOString(), ...result });
      if (synthetic && !this.allowSynthetic) throw new Error('Synthetic snapshots require an isolated fixture repository.');
      const body = encode(snapshot); snapshotId = hash(body);
      const compressed = gzipSync(body), checksum = hash(compressed), key = `hotspots/snapshots/${snapshotId}.json.gz`;
      try { await this.store.put(key, compressed, null); }
      catch (error) { if (!(error instanceof StoreConflict) || hash((await this.store.get(key))?.body ?? Buffer.alloc(0)) !== checksum) throw error; }
      const old = await this.store.get(CURRENT);
      if ((old?.etag ?? null) !== token.previousEtag) throw new StoreConflict();
      // Only a verified previous payload can become a recovery pointer.
      if (old) {
        let verified = false;
        try { await this.loadPointer(old.body); verified = true; } catch { /* Keep the existing fallback when current is corrupt. */ }
        if (verified) {
          const backup = await this.store.get(FALLBACK);
          await this.store.put(FALLBACK, old.body, backup?.etag ?? null);
        }
      }
      const pointer = pointerSchema.parse({ schemaVersion: '1.0', snapshotId, checksum, fetchedAt: snapshot.fetchedAt });
      await this.store.put(CURRENT, encode(pointer), token.previousEtag);
    }
    const attempt: Attempt = { ...token.attempt, finishedAt: fetchedAt.toISOString(), status: snapshotId ? 'published' : 'failed', snapshotId, batches: result.batches, issues: result.issues };
    await this.store.put(`jobs/hotspots/runs/${attempt.runId}.json`, encode(attempt));
    await this.store.put(ATTEMPT, encode(attempt), token.attemptEtag);
    return snapshotId;
  }
  private async loadPointer(body: Buffer) {
    const pointer = pointerSchema.parse(JSON.parse(body.toString()));
    const object = await this.store.get(`hotspots/snapshots/${pointer.snapshotId}.json.gz`);
    if (!object || hash(object.body) !== pointer.checksum) throw new Error('Invalid snapshot checksum');
    const raw = gunzipSync(object.body, { maxOutputLength: 64 * 1024 * 1024 });
    if (hash(raw) !== pointer.snapshotId) throw new Error('Invalid snapshot identity');
    const snapshot = snapshotSchema.parse(JSON.parse(raw.toString()));
    if (snapshot.fetchedAt !== pointer.fetchedAt || (snapshot.synthetic && !this.allowSynthetic)) throw new Error('Invalid snapshot provenance');
    return { snapshot, snapshotId: pointer.snapshotId };
  }
  async read(): Promise<RepositoryRead> {
    const issues: DataIssue[] = []; let attempt: Attempt | null = null, recovered = false;
    try {
      const object = await this.store.get(ATTEMPT);
      if (object) attempt = attemptSchema.parse(JSON.parse(object.body.toString()));
      if (attempt?.status === 'failed') issues.push(...attempt.issues);
    }
    catch { issues.push(issue('Metadata usaha pengambilan tidak dapat diverifikasi.')); }
    for (const key of [CURRENT, FALLBACK]) {
      try {
        const object = await this.store.get(key); if (!object) { if (key === CURRENT) recovered = true; continue; }
        const result = await this.loadPointer(object.body);
        return { ...result, issues, latestAttemptFailed: recovered || issues.length > 0 || !attempt || attempt.status !== 'published' || attempt.snapshotId !== result.snapshotId, lastAttemptAt: attempt?.startedAt ?? null };
      } catch { recovered = true; issues.push(issue('Snapshot/pointer gagal diverifikasi; mencoba salinan terakhir.')); }
    }
    return { snapshot: null, snapshotId: null, issues, latestAttemptFailed: true, lastAttemptAt: attempt?.startedAt ?? null };
  }
  async prune(now: Date) {
    const protectedIds = new Set<string>();
    // Fail closed: never delete snapshots if either pointer cannot be decoded.
    for (const key of [CURRENT, FALLBACK]) {
      const object = await this.store.get(key);
      if (object) protectedIds.add(pointerSchema.parse(JSON.parse(object.body.toString())).snapshotId);
    }
    const deleted: string[] = [];
    for (const object of await this.store.list('hotspots/snapshots/')) {
      const id = object.key.match(/\/([a-f0-9]{64})\.json\.gz$/)?.[1];
      if (id && !protectedIds.has(id) && Date.parse(object.modifiedAt) <= now.getTime() - POLICY.SNAPSHOT_RETENTION_DAYS * 24 * HOUR_MS) { await this.store.delete(object.key); deleted.push(object.key); }
    }
    const latest = await this.store.get(ATTEMPT), latestId = latest ? attemptSchema.parse(JSON.parse(latest.body.toString())).runId : null;
    for (const object of await this.store.list('jobs/hotspots/runs/')) {
      if (!object.key.endsWith(`/${latestId}.json`) && Date.parse(object.modifiedAt) <= now.getTime() - POLICY.JOB_LOG_RETENTION_DAYS * 24 * HOUR_MS) { await this.store.delete(object.key); deleted.push(object.key); }
    }
    return deleted;
  }
}
