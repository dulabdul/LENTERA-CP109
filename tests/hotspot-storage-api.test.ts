import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { SYNTHETIC_NOW } from '../fixtures/provider-scenarios';
import { collectHotspots } from '../src/lib/services/hotspot-ingest';
import { hotspotCacheControl, parseHotspotQuery, serveHotspots } from '../src/lib/services/hotspots';
import { HotspotRepository } from '../src/lib/storage/hotspot-repository';
import { FileObjectStore, StoreConflict, type ObjectStore, type StoredObject } from '../src/lib/storage/object-store';
import type { IngestResult } from '../src/lib/services/hotspot-ingest';
import { HOUR_MS, MINUTE_MS } from '../src/lib/policy';
import { parseFirmsCsv } from '../src/lib/providers/firms';
import { syntheticViirsCsv, syntheticEmptyCsv } from '../fixtures/provider-scenarios';

class MemoryStore implements ObjectStore {
  objects = new Map<string, StoredObject>(); dates = new Map<string,string>(); serial = 0; failKey: string | null = null;
  async get(key: string) { return this.objects.get(key) ?? null; }
  async put(key: string, body: Buffer, expectedEtag?: string | null) {
    if (key === this.failKey) throw new Error('synthetic interrupted write');
    if (expectedEtag !== undefined && (this.objects.get(key)?.etag ?? null) !== expectedEtag) throw new StoreConflict();
    this.objects.set(key, { body, etag: String(++this.serial) }); this.dates.set(key,SYNTHETIC_NOW.toISOString());
  }
  async list(prefix: string) { return [...this.objects.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key,modifiedAt:this.dates.get(key)!})); }
  async delete(key: string) { this.objects.delete(key); }
}
const query = (value='range=7d') => parseHotspotQuery(new URLSearchParams(value));
const complete = () => collectHotspots(SYNTHETIC_NOW, async batch => {
  const symbol = batch.source === 'VIIRS_SNPP_NRT' ? 'N' : batch.source === 'VIIRS_NOAA20_NRT' ? 'N20' : 'N21';
  return parseFirmsCsv(batch.startDate === '2026-10-25' ? syntheticViirsCsv.replace(',N,',`,${symbol},`) : syntheticEmptyCsv,batch);
});
const empty = () => collectHotspots(SYNTHETIC_NOW,async()=>({records:[],invalidRows:0}));
async function publish(repo: HotspotRepository, result: IngestResult, now=SYNTHETIC_NOW) { const token=await repo.begin(now); return repo.finish(token,result,now,true); }
const folders: string[] = [];
afterEach(async()=>{for(const folder of folders.splice(0)) await rm(folder,{recursive:true,force:true});});

describe('persistent snapshot publication and recovery',()=>{
  it('restores immutable gzip data from disk through a new repository instance',async()=>{
    const root=await mkdtemp(join(tmpdir(),'lentera-synthetic-'));folders.push(root);
    const store=new FileObjectStore(root), repo=new HotspotRepository(store,true);
    const id=await publish(repo,await complete());
    const restored=await new HotspotRepository(new FileObjectStore(root),true).read();
    expect(restored.snapshotId).toBe(id); expect(restored.snapshot?.payload.summary.detectionsCount).toBe(3);
    expect(restored.latestAttemptFailed).toBe(false);
    expect((await store.list('hotspots/snapshots/'))).toHaveLength(1);
    await expect(store.put('hotspots/current.json',Buffer.from('bad'),null)).rejects.toBeInstanceOf(StoreConflict);
  });
  it('reuses identical immutable content idempotently',async()=>{
    const store=new MemoryStore(),repo=new HotspotRepository(store,true), result=await complete();
    expect(await publish(repo,result)).toBe(await publish(repo,result));
    expect(await store.list('hotspots/snapshots/')).toHaveLength(1);
  });
  it('keeps current snapshot on total upstream failure and records a stale fallback',async()=>{
    const store=new MemoryStore(),repo=new HotspotRepository(store,true);
    const id=await publish(repo,await complete());
    const failed=await collectHotspots(SYNTHETIC_NOW,async()=>{throw new Error();});
    expect(await publish(repo,failed)).toBeNull();
    const attempt=JSON.parse((await store.get('jobs/hotspots/latest-attempt.json'))!.body.toString());
    expect(attempt.batches.filter((batch:{status:string})=>batch.status==='failed')).toHaveLength(6);
    expect(attempt.issues.some((issue:{code:string})=>issue.code==='missing-source')).toBe(true);
    expect((await repo.read()).snapshotId).toBe(id);
    const response=await serveHotspots(repo,query(),SYNTHETIC_NOW);
    expect(response.meta).toMatchObject({state:'stale',dataVersion:id});
    expect(response.meta.issues.some(issue=>issue.code==='upstream-error')).toBe(true);
  });
  it('marks a started-but-interrupted run stale without replacing current',async()=>{
    const repo=new HotspotRepository(new MemoryStore(),true); await publish(repo,await empty()); await repo.begin(SYNTHETIC_NOW);
    const response=await serveHotspots(repo,query(),SYNTHETIC_NOW);
    expect(response.meta.state).toBe('stale'); expect(response.data?.summary.detectionsCount).toBe(0);
  });
  it('failed pointer write leaves previous snapshot usable and latest run unfinished',async()=>{
    const store=new MemoryStore(),repo=new HotspotRepository(store,true);const id=await publish(repo,await complete());
    const token=await repo.begin(SYNTHETIC_NOW);store.failKey='hotspots/current.json';
    await expect(repo.finish(token,await empty(),SYNTHETIC_NOW,true)).rejects.toThrow();
    expect((await repo.read()).snapshotId).toBe(id);expect((await repo.read()).latestAttemptFailed).toBe(true);
  });
  it('rejects an obsolete writer token and does not let it replace a newer run',async()=>{
    const repo=new HotspotRepository(new MemoryStore(),true);const older=await repo.begin(SYNTHETIC_NOW),newer=await repo.begin(SYNTHETIC_NOW);
    await expect(repo.finish(older,await complete(),SYNTHETIC_NOW,true)).rejects.toBeInstanceOf(StoreConflict);
    await repo.finish(newer,await empty(),SYNTHETIC_NOW,true);expect((await repo.read()).snapshot?.payload.summary.detectionsCount).toBe(0);
  });
  it.each(['pointer','payload'])('recovers a corrupt current %s using verified fallback',async mode=>{
    const store=new MemoryStore(),repo=new HotspotRepository(store,true);const old=await publish(repo,await complete());const latest=await publish(repo,await empty());
    await store.put(mode==='pointer'?'hotspots/current.json':`hotspots/snapshots/${latest}.json.gz`,Buffer.from('corrupt'));
    const recovered=await repo.read();expect(recovered.snapshotId).toBe(old);expect(recovered.latestAttemptFailed).toBe(true);expect(recovered.issues).not.toHaveLength(0);
  });
  it('keeps a valid fallback during a new publication after current corruption',async()=>{
    const store=new MemoryStore(),repo=new HotspotRepository(store,true);const old=await publish(repo,await complete());await publish(repo,await empty());
    await store.put('hotspots/current.json',Buffer.from('corrupt'));
    await publish(repo,await empty());
    expect(JSON.parse((await store.get('hotspots/last-good.json'))!.body.toString()).snapshotId).toBe(old);
  });
  it('fails closed on cold start and corrupt attempt metadata',async()=>{
    const store=new MemoryStore(),repo=new HotspotRepository(store,true);
    expect((await serveHotspots(repo,query(),SYNTHETIC_NOW))).toMatchObject({meta:{state:'unavailable'},data:null});
    await publish(repo,await complete());await store.put('jobs/hotspots/latest-attempt.json',Buffer.from('{}'));
    expect((await serveHotspots(repo,query(),SYNTHETIC_NOW)).meta.state).toBe('stale');
  });
  it('does not serve synthetic snapshots from an operational repository',async()=>{
    const store=new MemoryStore(),fixture=new HotspotRepository(store,true);await publish(fixture,await complete());
    expect((await new HotspotRepository(store).read()).snapshot).toBeNull();
    const operational=new HotspotRepository(new MemoryStore());const token=await operational.begin(SYNTHETIC_NOW);
    await expect(operational.finish(token,await complete(),SYNTHETIC_NOW,true)).rejects.toThrow('Synthetic');
  });
  it('prunes old unreferenced snapshots/logs but retains both pointer targets',async()=>{
    const store=new MemoryStore(),repo=new HotspotRepository(store,true);const id=await publish(repo,await complete());const second=await publish(repo,await empty());
    const orphan='hotspots/snapshots/'+'f'.repeat(64)+'.json.gz';await store.put(orphan,gzipSync('synthetic orphan'));
    await store.put('jobs/hotspots/runs/synthetic-orphan.json',Buffer.from('{}'));
    const deleted=await repo.prune(new Date(SYNTHETIC_NOW.getTime()+31*24*HOUR_MS));
    expect(deleted).toContain(orphan);expect(deleted).toContain('jobs/hotspots/runs/synthetic-orphan.json');
    expect(await store.get(`hotspots/snapshots/${id}.json.gz`)).not.toBeNull();expect(await store.get(`hotspots/snapshots/${second}.json.gz`)).not.toBeNull();
    const latest=JSON.parse((await store.get('jobs/hotspots/latest-attempt.json'))!.body.toString());expect(await store.get(`jobs/hotspots/runs/${latest.runId}.json`)).not.toBeNull();
  });
  it('does not prune when a pointer is corrupt',async()=>{
    const store=new MemoryStore(),repo=new HotspotRepository(store,true);await publish(repo,await complete());await store.put('hotspots/current.json',Buffer.from('corrupt'));
    await expect(repo.prune(new Date(SYNTHETIC_NOW.getTime()+31*24*HOUR_MS))).rejects.toThrow();expect(await store.list('hotspots/snapshots/')).toHaveLength(1);
  });
});

describe('hotspot API semantics without network/listener',()=>{
  it.each(['range=all','bbox=94,-11,142,7','bbox=100,2,99,3','bbox=100,,101,2','bbox=NaN,0,110,2','confidence=n','source=MODIS_NRT','range=24h&range=48h','unknown=1'])('rejects invalid query %s',value=>expect(()=>query(value)).toThrow());
  it('applies time/source/confidence/bbox consistently and preserves snapshot coverage',async()=>{
    const repo=new HotspotRepository(new MemoryStore(),true);await publish(repo,await complete());
    const response=await serveHotspots(repo,query('range=24h&source=VIIRS_NOAA20_NRT&confidence=nominal&bbox=100,0,102,1'),SYNTHETIC_NOW);
    expect(response.data?.summary.detectionsCount).toBe(1);expect(response.meta.state).toBe('ok');
    expect(response.data?.coverage.asOf).toBe(SYNTHETIC_NOW.toISOString());
    const zero=await serveHotspots(repo,query('confidence=high'),SYNTHETIC_NOW);expect(zero.data?.summary.detectionsCount).toBe(0);expect(zero.meta.state).toBe('ok');
    const later=await serveHotspots(repo,query('range=24h'),new Date(SYNTHETIC_NOW.getTime()+23.75*HOUR_MS));expect(later.data?.summary.detectionsCount).toBe(0);expect(later.meta.state).toBe('stale');
  });
  it('enforces exact fresh/fallback deadlines and never refreshes asOf on reads',async()=>{
    const repo=new HotspotRepository(new MemoryStore(),true);await publish(repo,await complete());
    for(const [offset,state] of [[90*MINUTE_MS-1,'ok'],[90*MINUTE_MS,'stale'],[24*HOUR_MS-1,'stale'],[24*HOUR_MS,'unavailable']] as const){
      const response=await serveHotspots(repo,query(),new Date(SYNTHETIC_NOW.getTime()+offset));expect(response.meta.state).toBe(state);
      if(state==='unavailable')expect(response.data).toBeNull();else expect(response.data?.coverage.asOf).toBe(SYNTHETIC_NOW.toISOString());
    }
  });
  it('reports partial source coverage while retaining available detections',async()=>{
    const result=await complete();result.payload!.coverage.completedSources.pop();result.payload!.coverage.missingSources.push('VIIRS_NOAA21_NRT');result.issues.push({code:'missing-source',source:'VIIRS_NOAA21_NRT',detail:'Synthetic failure'});
    const repo=new HotspotRepository(new MemoryStore(),true);await publish(repo,result);
    expect((await serveHotspots(repo,query(),SYNTHETIC_NOW)).meta.state).toBe('partial');
  });
  it('caps CDN TTL at expiry, disables caching degraded or unavailable data',()=>{
    const deadline=new Date(SYNTHETIC_NOW.getTime()+10_000).toISOString();
    expect(hotspotCacheControl({state:'ok',validUntil:deadline},SYNTHETIC_NOW)).toBe('public, max-age=0, s-maxage=10');
    expect(hotspotCacheControl({state:'ok',validUntil:new Date(SYNTHETIC_NOW.getTime()+90_000).toISOString()},SYNTHETIC_NOW)).toContain('s-maxage=60');
    for(const state of ['partial','stale','unavailable'])expect(hotspotCacheControl({state,validUntil:deadline},SYNTHETIC_NOW)).toBe('no-store');
  });
});
