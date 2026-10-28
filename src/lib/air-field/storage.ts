import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { z } from 'zod';
import { FIELD_POLICY, fieldSnapshotSchema, projectField, type FieldSnapshot } from './contracts';
import { FileObjectStore, StoreConflict, type ObjectStore } from '../storage/object-store';
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const encode = (v: unknown) => Buffer.from(JSON.stringify(v));
const pointerSchema = z.object({ version: z.string().regex(/^[a-f0-9]{64}$/), checksum: z.string().regex(/^[a-f0-9]{64}$/), fetchedAt: z.iso.datetime() }).strict();
const leaseSchema = z.object({ token: z.string().uuid(), startedAt: z.iso.datetime(), leaseUntil: z.iso.datetime(), status: z.enum(['running','published','failed']) }).strict();
export interface FieldLease { token: string; etag: string; startedAt: string }
export class AirFieldRepository {
  constructor(readonly store: ObjectStore) {}
  async publish(snapshot: FieldSnapshot) {
    fieldSnapshotSchema.parse(snapshot); if (snapshot.synthetic) throw Error('Synthetic fields must not be published operationally');
    const raw = encode(snapshot); if (raw.length > FIELD_POLICY.maxBytes) throw Error('Field too large');
    const version = hash(raw), compressed = gzipSync(raw), previous = await this.store.get('air-field/current.json');
    if (previous && Date.parse(pointerSchema.parse(JSON.parse(previous.body.toString())).fetchedAt) >= Date.parse(snapshot.fetchedAt)) throw new StoreConflict();
    const immutableKey = `air-field/snapshots/${version}.json.gz`;
    if (!await this.store.get(immutableKey)) await this.store.put(immutableKey, compressed, null);
    await this.store.put('air-field/current.json', encode({ version, checksum: hash(compressed), fetchedAt: snapshot.fetchedAt }), previous?.etag ?? null);
    return version;
  }
  async read(now: Date) {
    try {
      const pointer = await this.store.get('air-field/current.json'); if (!pointer) return projectField(null, null, now);
      const p = pointerSchema.parse(JSON.parse(pointer.body.toString())), object = await this.store.get(`air-field/snapshots/${p.version}.json.gz`);
      if (!object || object.body.length > FIELD_POLICY.maxBytes || hash(object.body) !== p.checksum) throw Error();
      const raw = gunzipSync(object.body, { maxOutputLength: FIELD_POLICY.maxBytes }); if (hash(raw) !== p.version) throw Error();
      const snapshot = fieldSnapshotSchema.parse(JSON.parse(raw.toString())); if (snapshot.fetchedAt !== p.fetchedAt) throw Error();
      let failed = false, lastAttemptAt: string | null = null;
      const attempt = await this.store.get('air-field/lease.json');
      if (attempt) { const a = leaseSchema.parse(JSON.parse(attempt.body.toString())); lastAttemptAt = a.startedAt; failed = a.status !== 'published' && Date.parse(a.startedAt) >= Date.parse(snapshot.startedAt); }
      return projectField(snapshot, p.version, now, failed, lastAttemptAt);
    } catch { return projectField(null, null, now); }
  }
  async claim(now: Date): Promise<FieldLease | null> {
    const previous = await this.store.get('air-field/lease.json');
    if (previous) { const lease = leaseSchema.parse(JSON.parse(previous.body.toString())); if (lease.status === 'running' && Date.parse(lease.leaseUntil) > now.getTime()) return null; }
    const value = { token: randomUUID(), startedAt: now.toISOString(), leaseUntil: new Date(now.getTime() + 20 * 60_000).toISOString(), status: 'running' };
    try { await this.store.put('air-field/lease.json', encode(value), previous?.etag ?? null); } catch (error) { if (error instanceof StoreConflict) return null; throw error; }
    const stored = await this.store.get('air-field/lease.json');
    return stored && JSON.parse(stored.body.toString()).token === value.token ? { token: value.token, etag: stored.etag, startedAt: value.startedAt } : null;
  }
  async assertLease(lease: FieldLease, now: Date) {
    const object = await this.store.get('air-field/lease.json');
    if (!object || object.etag !== lease.etag) throw new StoreConflict();
    const value = leaseSchema.parse(JSON.parse(object.body.toString()));
    if (value.token !== lease.token || value.status !== 'running' || Date.parse(value.leaseUntil) <= now.getTime()) throw new StoreConflict();
    return value;
  }
  async finish(lease: FieldLease, snapshot: FieldSnapshot | null, now: Date) {
    const previous = await this.assertLease(lease, now);
    if (snapshot && snapshot.startedAt !== lease.startedAt) throw Error('Snapshot lease mismatch');
    const version = snapshot ? await this.publish(snapshot) : null;
    await this.store.put('air-field/lease.json', encode({ ...previous, status: snapshot ? 'published' : 'failed' }), lease.etag);
    return version;
  }
}
export async function reserveFieldBudget(store: ObjectStore, now: Date, units: number, dailyLimit: number) {
  if (!Number.isSafeInteger(units) || units < 1 || !Number.isSafeInteger(dailyLimit) || dailyLimit < units || dailyLimit > 8000) throw Error('Invalid field budget');
  const key = `air-field/budget/${now.toISOString().slice(0, 10)}.json`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const previous = await store.get(key), used = previous ? z.object({ used: z.number().int().nonnegative() }).strict().parse(JSON.parse(previous.body.toString())).used : 0;
    if (used + units > dailyLimit) throw Error('Daily coordinate budget exhausted');
    try { await store.put(key, encode({ used: used + units }), previous?.etag ?? null); return; } catch (error) { if (!(error instanceof StoreConflict)) throw error; }
  }
  throw Error('Field budget busy; try another run');
}

// Local development cleanup only. R2 uses separately verified lifecycle rules.
export async function pruneLocalAirField(store: ObjectStore, now: Date) {
  if (!(store instanceof FileObjectStore)) return { skipped: true, deleted: 0 };
  const cutoff = now.getTime() - 48 * 3_600_000; let deleted = 0;
  const pointer = await store.get('air-field/current.json');
  if (!pointer) return { skipped: false, deleted };
  pointerSchema.parse(JSON.parse(pointer.body.toString())); // Invalid pointer aborts cleanup.
  for (const item of await store.list('air-field/')) {
    if (Date.parse(item.modifiedAt) >= cutoff || !/^air-field\/(snapshots\/[a-f0-9]{64}\.json\.gz|budget\/\d{4}-\d{2}-\d{2}\.json)$/.test(item.key)) continue;
    const current = await store.get('air-field/current.json');
    if (!current) throw Error('Missing pointer during retention');
    const active = pointerSchema.parse(JSON.parse(current.body.toString()));
    if (item.key === `air-field/snapshots/${active.version}.json.gz`) continue;
    const object = await store.get(item.key); if (!object) continue;
    try { await store.delete(item.key, object.etag); deleted++; } catch (error) { if (!(error instanceof StoreConflict)) throw error; }
  }
  return { skipped: false, deleted };
}
