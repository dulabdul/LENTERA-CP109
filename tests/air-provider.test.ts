import { describe, expect, it } from 'vitest';
import { syntheticAirResponse } from '../fixtures/air-provider';
import { SYNTHETIC_NOW } from '../fixtures/provider-scenarios';
import { airBucket, airCacheKey, projectAir, type AirCacheRecord } from '../src/lib/air-series';
import { buildOpenMeteoUrl, createAirFetcher, parseOpenMeteo } from '../src/lib/providers/open-meteo';
import { HOUR_MS } from '../src/lib/policy';
const location = { lat: -2.21, lon: 113.92 };
function record(value = 22): AirCacheRecord {
  return { schemaVersion: '1.0', fetchedAt: SYNTHETIC_NOW.toISOString(), dataVersion: 'a'.repeat(64), content: parseOpenMeteo(syntheticAirResponse(SYNTHETIC_NOW, value), location, SYNTHETIC_NOW) };
}
describe('Open-Meteo adapter with synthetic data', () => {
  it('requests only CAMS global hourly PM2.5, in UTC and with exact history/forecast parameters', () => {
    const url = new URL(buildOpenMeteoUrl('https://air-quality-api.open-meteo.com', location));
    expect(url.pathname).toBe('/v1/air-quality');
    expect(Object.fromEntries(url.searchParams)).toEqual({ latitude: '-2.21', longitude: '113.92', hourly: 'pm2_5', domains: 'cams_global', past_days: '2', forecast_days: '3', timezone: 'GMT', timeformat: 'unixtime' });
  });
  it.each(['http://air-quality-api.open-meteo.com','https://user:secret@air-quality-api.open-meteo.com','https://invalid.test','https://air-quality-api.open-meteo.com:444','https://air-quality-api.open-meteo.com?apikey=secret'])('rejects unsafe or unexpected destination %s', base => expect(() => buildOpenMeteoUrl(base,location)).toThrow());
  it('keeps commercial keys on the customer endpoint only', () => {
    expect(() => buildOpenMeteoUrl('https://air-quality-api.open-meteo.com', location, 'synthetic')).toThrow();
    expect(() => buildOpenMeteoUrl('https://customer-air-quality-api.open-meteo.com', location)).toThrow();
    expect(new URL(buildOpenMeteoUrl('https://customer-air-quality-api.open-meteo.com', location, 'synthetic')).searchParams.get('apikey')).toBe('synthetic');
  });
  it('normalizes units/coordinates and preserves missing run time', () => {
    const data = parseOpenMeteo(syntheticAirResponse(),location,SYNTHETIC_NOW);
    expect(data.series).toHaveLength(120); expect(data.runAt).toBeNull();
    expect(data.queryLocation).toEqual(location); expect(data.modelGridLocation).toEqual({lat:-2.2,lon:114});
    expect(data.series[0]!.pm25UgM3).toBe(22);
  });
  it.each(['unit','offset','duplicate','order','length','date','grid'])('rejects malformed %s instead of accepting fresh invalid data', kind => {
    const raw = syntheticAirResponse();
    if(kind==='unit')raw.hourly_units.pm2_5='mg/m3';
    if(kind==='offset')raw.utc_offset_seconds=3600;
    if(kind==='duplicate')raw.hourly.time[1]=raw.hourly.time[0]!;
    if(kind==='order')raw.hourly.time.reverse();
    if(kind==='length')raw.hourly.pm2_5.pop();
    if(kind==='date')raw.hourly.time[0]!-=24*3600;
    if(kind==='grid')raw.latitude=50;
    expect(()=>parseOpenMeteo(raw,location,SYNTHETIC_NOW)).toThrow('tidak valid');
  });
  it('preserves null and replaces invalid negative values with null plus an issue', () => {
    const raw=syntheticAirResponse(); raw.hourly.pm2_5[0]=null;raw.hourly.pm2_5[1]=-1;
    const data=parseOpenMeteo(raw,location,SYNTHETIC_NOW);
    expect(data.series[0]!.pm25UgM3).toBeNull();expect(data.series[1]!.pm25UgM3).toBeNull();expect(data.issues).toHaveLength(1);
  });
  it('allows actual missing hours for projection to mark incomplete coverage', () => {
    const raw=syntheticAirResponse();raw.hourly.time.splice(1,1);raw.hourly.pm2_5.splice(1,1);
    expect(parseOpenMeteo(raw,location,SYNTHETIC_NOW).series).toHaveLength(119);
  });
  it('retries temporary failures once and accounts for every HTTP attempt', async () => {
    const waits:number[]=[];let calls=0,budget=0;
    const fetcher=createAirFetcher({baseUrl:'https://air-quality-api.open-meteo.com',fetch:async()=>++calls===1?new Response('',{status:429,headers:{'retry-after':'2'}}):Response.json(syntheticAirResponse()),sleep:async ms=>{waits.push(ms);},beforeRequest:async()=>{budget++;}});
    expect((await fetcher(location,SYNTHETIC_NOW)).series).toHaveLength(120);expect(waits).toEqual([2000]);expect(budget).toBe(2);
  });
  it('does not retry permanent/malformed responses or a long Retry-After',async()=>{
    for(const response of [Response.json({error:true}),new Response('not-json'),new Response('',{status:403}),new Response('',{status:429,headers:{'retry-after':'60'}})]){
      let count=0;await expect(createAirFetcher({baseUrl:'https://air-quality-api.open-meteo.com',fetch:async()=>{count++;return response;}})(location,SYNTHETIC_NOW)).rejects.toThrow();expect(count).toBe(1);
    }
  });
  it('redacts network failures and stops when request budget is exhausted',async()=>{
    let calls=0;
    await expect(createAirFetcher({baseUrl:'https://air-quality-api.open-meteo.com',fetch:async()=>{calls++;throw new Error('private-key');},sleep:async()=>{}})(location,SYNTHETIC_NOW)).rejects.toThrow('Pengambilan Open-Meteo gagal.');expect(calls).toBe(2);
    await expect(createAirFetcher({baseUrl:'https://air-quality-api.open-meteo.com',beforeRequest:async()=>{throw new Error('budget');},fetch:async()=>{throw new Error('must not call');}})(location,SYNTHETIC_NOW)).rejects.toThrow('budget');
  });
});
describe('location series projection',()=>{
  it('buckets technical cache coordinates without substituting requested/grid locations',()=>{
    expect(airBucket({lat:-2.214,lon:113.923})).toEqual(location);expect(airCacheKey({lat:-2.214,lon:113.923})).toBe('-2.21_113.92');
    expect(projectAir(record(),{lat:-2.214,lon:113.923},SYNTHETIC_NOW).data).toMatchObject({requestedLocation:{lat:-2.214,lon:113.923},queryLocation:location,modelGridLocation:{lat:-2.2,lon:114}});
  });
  it('separates current PM2.5, last 23 hours, next 48 hours and 24-hour index',()=>{
    const response=projectAir(record(),location,SYNTHETIC_NOW);expect(response.meta.state).toBe('ok');expect(response.data?.current?.pm25UgM3).toBe(22);expect(response.data?.history).toHaveLength(23);expect(response.data?.forecast).toHaveLength(48);expect(response.data?.aqi).toMatchObject({status:'available',value:75,sampleCount:24});
  });
  it('recomputes current hour/index from cached series before TTL expires',()=>{
    const data=record();data.content.series.find(s=>s.validAt==='2026-10-27T14:00:00.000Z')!.pm25UgM3=100;
    const now=new Date('2026-10-27T14:00:00.000Z'),response=projectAir(data,location,now);
    expect(response.meta.state).toBe('ok');expect(response.meta.fetchedAt).toBe(SYNTHETIC_NOW.toISOString());expect(response.data?.current?.pm25UgM3).toBe(100);expect(response.data?.aqi).toMatchObject({periodTo:now.toISOString()});if(response.data?.aqi.status==='available')expect(response.data.aqi.mean24hUgM3).toBeCloseTo(25.25,10);
  });
  it('requires all 24 index samples and does not convert null into zero',()=>{
    const data=record();data.content.series.find(s=>s.validAt==='2026-10-27T12:00:00.000Z')!.pm25UgM3=null;
    const response=projectAir(data,location,SYNTHETIC_NOW);expect(response.meta.state).toBe('partial');expect(response.data?.aqi.status).toBe('unavailable');expect(response.data?.current?.pm25UgM3).toBe(22);
    data.content.series.find(s=>s.validAt==='2026-10-27T13:00:00.000Z')!.pm25UgM3=null;
    expect(projectAir(data,location,SYNTHETIC_NOW)).toMatchObject({meta:{state:'unavailable'},data:null});
  });
  it('labels incomplete forecast and old known model runs',()=>{
    const data=record();data.content.series=data.content.series.slice(0,100);
    expect(projectAir(data,location,SYNTHETIC_NOW).meta.state).toBe('partial');data.content.runAt=new Date(SYNTHETIC_NOW.getTime()-36*HOUR_MS).toISOString();expect(projectAir(data,location,SYNTHETIC_NOW).meta.state).toBe('stale');
  });
  it('enforces exact 60-minute/6-hour boundaries and no hidden values on unavailable',()=>{
    const data=record();
    expect(projectAir(data,location,new Date(SYNTHETIC_NOW.getTime()+HOUR_MS)).meta.state).toBe('stale');
    expect(projectAir(data,location,new Date(SYNTHETIC_NOW.getTime()+6*HOUR_MS))).toMatchObject({meta:{state:'unavailable'},data:null});
    expect(projectAir(null,location,SYNTHETIC_NOW)).toMatchObject({meta:{state:'unavailable'},data:null});
  });
  it('represents beyond-scale AQI as >500 category without extrapolation',()=>expect(projectAir(record(400),location,SYNTHETIC_NOW).data?.aqi).toMatchObject({value:null,beyondScale:true,category:'hazardous'}));
});
