import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import { R2ObjectStore, StoreConflict } from '../src/lib/storage/object-store';
import { HotspotRepository } from '../src/lib/storage/hotspot-repository';
import { collectHotspots } from '../src/lib/services/hotspot-ingest';
import { createOperationalHotspotRepository } from '../src/lib/storage/runtime';
import { GET } from '../src/app/api/hotspots/route';
import { SYNTHETIC_NOW } from '../fixtures/provider-scenarios';
import type { ObjectStore } from '../src/lib/storage/object-store';
vi.mock('../src/lib/storage/runtime',()=>({ createOperationalHotspotRepository: vi.fn() }));
afterEach(()=>{vi.useRealTimers();vi.resetAllMocks();});
function memory(): ObjectStore {
  const data=new Map<string,Buffer>();
  return {async get(key){const body=data.get(key);return body?{body,etag:createHash('sha256').update(body).digest('hex')}:null;},async put(key,body){data.set(key,body);},async list(){return[];},async delete(key){data.delete(key);}};
}
describe('GET /api/hotspots contract',()=>{
  it('rejects invalid input before accessing storage',async()=>{
    const response=await GET(new Request('http://localhost/api/hotspots?source=MODIS_NRT'));
    expect(response.status).toBe(400);expect(createOperationalHotspotRepository).not.toHaveBeenCalled();expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('returns readable 503 with null data on cold start',async()=>{
    vi.mocked(createOperationalHotspotRepository).mockReturnValue(null);
    const response=await GET(new Request('http://localhost/api/hotspots'));
    expect(response.status).toBe(503);expect(await response.json()).toMatchObject({meta:{state:'unavailable'},data:null});
  });
  it('redacts unexpected store/config errors',async()=>{
    vi.mocked(createOperationalHotspotRepository).mockImplementation(()=>{throw new Error('synthetic-private-key');});
    const response=await GET(new Request('http://localhost/api/hotspots'));
    expect(response.status).toBe(503);expect(await response.text()).not.toContain('synthetic-private-key');
  });
  it('returns complete zero as 200 and downgrades stale source without caching',async()=>{
    const repo=new HotspotRepository(memory(),true);const result=await collectHotspots(SYNTHETIC_NOW,async()=>({records:[],invalidRows:0}));
    await repo.finish(await repo.begin(SYNTHETIC_NOW),result,SYNTHETIC_NOW,true);
    vi.mocked(createOperationalHotspotRepository).mockReturnValue(repo);vi.useFakeTimers();vi.setSystemTime(SYNTHETIC_NOW);
    const fresh=await GET(new Request('http://localhost/api/hotspots'));
    expect(fresh.status).toBe(200);expect(fresh.headers.get('cache-control')).toContain('s-maxage=60');expect(await fresh.json()).toMatchObject({meta:{state:'ok'},data:{summary:{detectionsCount:0}}});
    vi.setSystemTime(new Date(SYNTHETIC_NOW.getTime()+90*60_000));
    const stale=await GET(new Request('http://localhost/api/hotspots'));
    expect(stale.status).toBe(200);expect(stale.headers.get('cache-control')).toBe('no-store');expect(await stale.json()).toMatchObject({meta:{state:'stale'}});
  });
});
describe('R2 protocol adapter (SDK mocked, not a live provider test)',()=>{
  it('maps absence and conditional writes, preserves gzip bytes and explicit bucket',async()=>{
    const send=vi.fn().mockResolvedValueOnce({Body:{transformToByteArray:async()=>new Uint8Array([1,2])},ETag:'"etag"'}).mockRejectedValueOnce({name:'NoSuchKey'}).mockResolvedValue({});
    const store=new R2ObjectStore({send} as unknown as S3Client,'synthetic-bucket');
    expect(await store.get('hotspots/current.json')).toEqual({body:Buffer.from([1,2]),etag:'"etag"'});
    expect(await store.get('hotspots/absent.json')).toBeNull();
    await store.put('hotspots/current.json',Buffer.from('{}'),'"etag"');
    expect(send.mock.calls[2]![0].input).toMatchObject({Bucket:'synthetic-bucket',IfMatch:'"etag"'});
    await store.put('hotspots/snapshots/test.json.gz',Buffer.from([1]),null);
    expect(send.mock.calls[3]![0].input).toMatchObject({IfNoneMatch:'*',ContentType:'application/gzip'});
  });
  it('classifies conditional failures and sanitizes provider errors',async()=>{
    const send=vi.fn().mockRejectedValueOnce({$metadata:{httpStatusCode:412}}).mockRejectedValueOnce(new Error('private provider value'));
    const store=new R2ObjectStore({send} as unknown as S3Client,'synthetic');
    await expect(store.put('hotspots/current.json',Buffer.from('{}'),null)).rejects.toBeInstanceOf(StoreConflict);
    await expect(store.get('hotspots/current.json')).rejects.toThrow('R2 snapshot read failed.');
  });
  it('paginates retention listings',async()=>{
    const send=vi.fn().mockResolvedValueOnce({Contents:[{Key:'hotspots/snapshots/a',LastModified:SYNTHETIC_NOW}],IsTruncated:true,NextContinuationToken:'next'}).mockResolvedValueOnce({Contents:[{Key:'hotspots/snapshots/b',LastModified:SYNTHETIC_NOW}],IsTruncated:false});
    const store=new R2ObjectStore({send} as unknown as S3Client,'synthetic');
    expect(await store.list('hotspots/snapshots/')).toHaveLength(2);expect(send.mock.calls[1]![0].input.ContinuationToken).toBe('next');
  });
});
