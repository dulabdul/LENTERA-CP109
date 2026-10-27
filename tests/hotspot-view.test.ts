import { describe,expect,it } from 'vitest';
import { displayedHotspotState,formatWib,parseLocationInput,visibleDetections } from '../src/lib/hotspot-view';
import { evaluateFreshness } from '../src/lib/freshness';
import { SYNTHETIC_NOW } from '../fixtures/provider-scenarios';
import { HOUR_MS,MINUTE_MS } from '../src/lib/policy';
import type { HotspotPayload } from '../src/lib/contracts';
const meta=evaluateFreshness({kind:'hotspots',now:SYNTHETIC_NOW,hasPayload:true,fetchedAt:SYNTHETIC_NOW.toISOString(),dataVersion:'synthetic'});
describe('monitoring presentation semantics',()=>{
  it.each(['-2.21,113.92',' -2.21, 113.9200 '])('accepts selected Indonesian coordinates %s',text=>expect(parseLocationInput(text)).toEqual({lat:-2.21,lon:113.92}));
  it.each(['NaN,113.92','Infinity,113.92',',113.92','-2.21,','91,113.92','3.14,101.69','Pekanbaru','-2.21,113.92,5'])('rejects invalid or foreign coordinates %s',text=>expect(parseLocationInput(text)).toBeNull());
  it('downgrades fresh status on expiry, offline or refresh failure without promoting server stale/partial',()=>{
    expect(displayedHotspotState(meta,SYNTHETIC_NOW,false,false)).toBe('ok');
    expect(displayedHotspotState(meta,SYNTHETIC_NOW,true,false)).toBe('stale');
    expect(displayedHotspotState(meta,SYNTHETIC_NOW,false,true)).toBe('stale');
    expect(displayedHotspotState({...meta,state:'partial'},SYNTHETIC_NOW,false,false)).toBe('partial');
    expect(displayedHotspotState({...meta,state:'stale'},SYNTHETIC_NOW,false,false)).toBe('stale');
    expect(displayedHotspotState(meta,new Date(SYNTHETIC_NOW.getTime()+90*MINUTE_MS),false,false)).toBe('stale');
    expect(displayedHotspotState(meta,new Date(SYNTHETIC_NOW.getTime()+24*HOUR_MS),false,false)).toBe('unavailable');
  });
  it('uses identical point sets for viewport counts, pagination input and map time filter',()=>{
    const feature=(id:string,lat:number,lon:number,acquiredAt:string)=>({type:'Feature' as const,geometry:{type:'Point' as const,coordinates:[lon,lat] as [number,number]},properties:{id,source:'VIIRS_SNPP_NRT' as const,satellite:'S-NPP' as const,acquiredAt,confidenceRaw:'n' as const,confidence:'nominal' as const,brightnessKelvin:null,frpMw:null}});
    const data={features:[feature('in',0.51,101.45,SYNTHETIC_NOW.toISOString()),feature('outside',-2.21,113.92,SYNTHETIC_NOW.toISOString()),feature('left',0.51,101.45,new Date(SYNTHETIC_NOW.getTime()-24*HOUR_MS).toISOString())]} as HotspotPayload;
    expect(visibleDetections(data,[100,0,102,1],SYNTHETIC_NOW,24).map(f=>f.properties.id)).toEqual(['in']);
    expect(visibleDetections(data,null,SYNTHETIC_NOW,24)).toHaveLength(2);
    expect(visibleDetections(null,null,SYNTHETIC_NOW,24)).toEqual([]);
  });
  it('labels WIB explicitly, retaining UTC values for separate source details',()=>{
    expect(formatWib('2026-10-27T13:30:00.000Z')).toContain('20.30');expect(formatWib('2026-10-27T13:30:00.000Z')).toContain('WIB');expect(formatWib(null)).toBe('Belum tersedia');
  });
});
