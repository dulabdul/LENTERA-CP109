import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, readdir, stat, rmdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
export interface StoredObject { body: Buffer; etag: string }
export interface ObjectInfo { key: string; modifiedAt: string }
export interface ObjectStore {
  get(key: string): Promise<StoredObject | null>;
  put(key: string, body: Buffer, expectedEtag?: string | null): Promise<void>;
  list(prefix: string): Promise<ObjectInfo[]>;
  delete(key: string, expectedEtag?: string): Promise<void>;
}
export class StoreConflict extends Error { constructor() { super("Object store write conflict; retry in a new serialized run."); } }
const safeKey = (key: string) => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(key) || key.split('/').some(part => part === '..' || part === '.')) throw new Error("Invalid object key");
  return key;
};
export class FileObjectStore implements ObjectStore {
  constructor(private readonly root: string) {}
  async get(key: string): Promise<StoredObject | null> {
    try { const body = await readFile(join(this.root, safeKey(key))); return { body, etag: createHash('sha256').update(body).digest('hex') }; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw new Error("Local snapshot read failed."); }
  }
  async put(key: string, body: Buffer, expectedEtag?: string | null) {
    const path = join(this.root, safeKey(key)); await mkdir(dirname(path), { recursive: true });
    const lock = path + '.lock', temporary = path + '.' + randomUUID() + '.tmp';
    try { await mkdir(lock); } catch { throw new StoreConflict(); }
    try {
      if (expectedEtag !== undefined && (await this.get(key))?.etag !== (expectedEtag ?? undefined)) throw new StoreConflict();
      await writeFile(temporary, body, { flag: 'wx', mode: 0o600 }); await rename(temporary, path);
    } finally { await unlink(temporary).catch(() => {}); await rmdir(lock); }
  }
  async list(prefix: string) {
    safeKey(prefix); const entries: ObjectInfo[] = [];
    const visit = async (local: string) => {
      let children; try { children = await readdir(join(this.root, local), { withFileTypes: true }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
      for (const child of children) {
        const key = local ? `${local}/${child.name}` : child.name;
        if (child.isSymbolicLink() || child.name.endsWith('.lock') || child.name.endsWith('.tmp')) continue;
        if (child.isDirectory()) await visit(key);
        else if (key.startsWith(prefix)) entries.push({ key, modifiedAt: (await stat(join(this.root, key))).mtime.toISOString() });
      }
    };
    await visit(prefix.slice(0, prefix.lastIndexOf('/'))); return entries;
  }
  async delete(key: string, expectedEtag?: string) {
    const path = join(this.root, safeKey(key));
    if (expectedEtag === undefined) { await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; }); return; }
    try { await mkdir(path + '.lock'); } catch { throw new StoreConflict(); }
    try {
      if ((await this.get(key))?.etag !== expectedEtag) throw new StoreConflict();
      await unlink(path);
    } finally { await rmdir(path + '.lock'); }
  }
}
export class R2ObjectStore implements ObjectStore {
  constructor(private readonly client: S3Client, private readonly bucket: string) {}
  async get(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: safeKey(key) }));
      if (!result.Body || !result.ETag) throw new Error();
      if ((result.ContentLength ?? 0) > 64 * 1024 * 1024) throw new Error();
      return { body: Buffer.from(await result.Body.transformToByteArray()), etag: result.ETag };
    } catch (error) {
      const info = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (info.name === 'NoSuchKey' || info.$metadata?.httpStatusCode === 404) return null;
      throw new Error("R2 snapshot read failed.");
    }
  }
  async put(key: string, body: Buffer, expectedEtag?: string | null) {
    try { await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: safeKey(key), Body: body, ContentType: key.endsWith('.gz') ? 'application/gzip' : 'application/json', ...(expectedEtag === null ? { IfNoneMatch: '*' } : expectedEtag === undefined ? {} : { IfMatch: expectedEtag }) })); }
    catch (error) {
      const code = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (code === 409 || code === 412) throw new StoreConflict(); throw new Error("R2 snapshot write failed.");
    }
  }
  async list(prefix: string) {
    const objects: ObjectInfo[] = []; let token: string | undefined;
    do {
      const result = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: safeKey(prefix), ContinuationToken: token }));
      for (const object of result.Contents ?? []) if (object.Key && object.LastModified) objects.push({ key: object.Key, modifiedAt: object.LastModified.toISOString() });
      token = result.IsTruncated ? result.NextContinuationToken : undefined;
      if (result.IsTruncated && !token) throw new Error("Incomplete R2 listing.");
    } while (token);
    return objects;
  }
  async delete(key: string, expectedEtag?: string) {
    if (expectedEtag !== undefined) throw new Error('Conditional R2 deletion is not verified; configure lifecycle retention before production cleanup.');
    try { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: safeKey(key) })); }
    catch (error) {
      const code = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (code === 409 || code === 412) throw new StoreConflict();
      throw new Error('R2 snapshot deletion failed.');
    }
  }
}
