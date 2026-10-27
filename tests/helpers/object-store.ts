import { createHash } from 'node:crypto';
import { StoreConflict, type ObjectStore, type StoredObject } from '../../src/lib/storage/object-store';
import { SYNTHETIC_NOW } from '../../fixtures/provider-scenarios';
export class TestObjectStore implements ObjectStore {
  objects = new Map<string, StoredObject>();
  modified = new Map<string, string>();
  failWrites = false;
  async get(key: string) { return this.objects.get(key) ?? null; }
  async put(key: string, body: Buffer, expectedEtag?: string | null) {
    if (this.failWrites) throw new Error('synthetic-storage-error-private');
    if (expectedEtag !== undefined && (this.objects.get(key)?.etag ?? null) !== expectedEtag) throw new StoreConflict();
    this.objects.set(key, { body, etag: createHash('sha256').update(body).digest('hex') }); this.modified.set(key, SYNTHETIC_NOW.toISOString());
  }
  async list(prefix: string) { return [...this.objects.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key, modifiedAt: this.modified.get(key)! })); }
  async delete(key: string, expectedEtag?: string) {
    if (expectedEtag !== undefined && this.objects.get(key)?.etag !== expectedEtag) throw new StoreConflict(); this.objects.delete(key);
  }
}
