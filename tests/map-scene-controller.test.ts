import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Map as LibreMap } from 'maplibre-gl';
import { applyBasemap, applyProjection, observeSceneSource } from '../src/lib/map-scene-controller';
import { SCENE_LAYER, SCENE_SOURCE } from '../src/lib/map-scene';
function fakeMap() {
  const sources=new Set<string>([SCENE_SOURCE.map,SCENE_SOURCE.labels,'hotspots','province-boundaries','air-field-image']),layers=new Set<string>([...Object.values(SCENE_LAYER).filter(v=>v!==SCENE_LAYER.satellite),'country-fill','country-line','clusters','detections','hotspot-hex-fill','air-field-raster']);
  const map={getSource:vi.fn((id:string)=>sources.has(id)?{}:undefined),getLayer:vi.fn((id:string)=>layers.has(id)?{}:undefined),addSource:vi.fn((id:string)=>{sources.add(id);}),addLayer:vi.fn((l:{id:string})=>{layers.add(l.id);}),setLayoutProperty:vi.fn(),setMaxBounds:vi.fn(),setTerrain:vi.fn(),setProjection:vi.fn(),setSky:vi.fn(),easeTo:vi.fn(),getContainer:()=>({clientHeight:700})};
  return { map, asMap:map as unknown as LibreMap,sources,layers };
}
describe('VIEW-C scene adapter preserves the existing map and data layers',()=>{
 it('switches satellite source once and hides only basemap layers; data sources survive',()=>{
  const {map,asMap,sources,layers}=fakeMap();applyBasemap(asMap,'satellite');applyBasemap(asMap,'map');applyBasemap(asMap,'satellite');
  expect(map.addSource).toHaveBeenCalledTimes(1);expect(sources.has('hotspots')).toBe(true);expect(layers.has('hotspot-hex-fill')).toBe(true);expect(layers.has('air-field-raster')).toBe(true);
  expect(map.setLayoutProperty.mock.calls.every(([id])=>[...Object.values(SCENE_LAYER),'country-fill'].includes(id as never))).toBe(true);
 });
 it('can expose indicative land on street failure without deleting detection layers',()=>{
  const {map,asMap}=fakeMap();applyBasemap(asMap,'map',true);expect(map.setLayoutProperty).toHaveBeenCalledWith('country-fill','visibility','visible');expect(map.setLayoutProperty).toHaveBeenCalledWith(SCENE_LAYER.map,'visibility','none');
 });
 it('clears terrain in Flat/Globe and restores flat camera constraints/padding; reduced motion has zero duration',()=>{
  const {map,asMap}=fakeMap();applyProjection(asMap,'globe',false);expect(map.setMaxBounds).toHaveBeenLastCalledWith(null);expect(map.setProjection).toHaveBeenLastCalledWith({type:'globe'});expect(map.setTerrain).toHaveBeenLastCalledWith(null);
  applyProjection(asMap,'flat',true);expect(map.setProjection).toHaveBeenLastCalledWith({type:'mercator'});expect(map.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({pitch:0,duration:0,padding:{top:0,right:0,bottom:0,left:0}}));expect(map.setMaxBounds).toHaveBeenLastCalledWith([[90,-18],[148,15]]);
 });
});

describe('VIEW-D real elevation lifecycle',()=>{
 afterEach(()=>vi.useRealTimers());
 it('loads a real DEM once only in terrain, then detaches terrain in flat mode',()=>{
  const {map,asMap}=fakeMap();applyProjection(asMap,'globe',false);expect(map.addSource).not.toHaveBeenCalled();
  applyProjection(asMap,'terrain',false);applyProjection(asMap,'terrain',false);expect(map.addSource).toHaveBeenCalledTimes(1);expect(map.addSource).toHaveBeenCalledWith(SCENE_SOURCE.terrain,expect.objectContaining({type:'raster-dem',encoding:'terrarium'}));expect(map.setTerrain).toHaveBeenLastCalledWith({source:SCENE_SOURCE.terrain,exaggeration:1});
  applyProjection(asMap,'flat',false);expect(map.setTerrain).toHaveBeenLastCalledWith(null);
 });
 function observerMap() {
  const listeners=new Map<string,Set<(event?:unknown)=>void>>();let loaded=false;
  const map={getSource:()=>({}),isSourceLoaded:()=>loaded,on:(type:string,cb:(e?:unknown)=>void)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type)!.add(cb);},off:(type:string,cb:(e?:unknown)=>void)=>listeners.get(type)?.delete(cb)};
  return {map:map as unknown as LibreMap,load:()=>{loaded=true;},unload:()=>{loaded=false;},emit:(type:string,event?:unknown)=>listeners.get(type)?.forEach(cb=>cb(event)),listeners};
 }
 it('waits for actual source readiness, ignores unrelated errors and releases its listeners',()=>{
  vi.useFakeTimers();const f=observerMap(),ready=vi.fn(),failure=vi.fn(),stop=observeSceneSource(f.map,SCENE_SOURCE.terrain,ready,failure);
  f.emit('error',{sourceId:'hotspots'});expect(failure).not.toHaveBeenCalled();expect(ready).not.toHaveBeenCalled();f.load();f.emit('sourcedata');expect(ready).toHaveBeenCalledTimes(1);stop();vi.advanceTimersByTime(25_000);expect(failure).not.toHaveBeenCalled();expect([...f.listeners.values()].every(set=>set.size===0)).toBe(true);
 });
 it('does not time out a source that already became ready while later panning loads tiles',()=>{
  vi.useFakeTimers();const f=observerMap(),ready=vi.fn(),failure=vi.fn();f.load();const stop=observeSceneSource(f.map,SCENE_SOURCE.map,ready,failure,100);expect(ready).not.toHaveBeenCalled();f.emit('idle');expect(ready).toHaveBeenCalledTimes(1);f.unload();vi.advanceTimersByTime(101);expect(failure).not.toHaveBeenCalled();stop();
 });
 it('reports selected DEM or tile timeout failure once, with no synthetic terrain success',()=>{
  vi.useFakeTimers();const f=observerMap(),failure=vi.fn(),stop=observeSceneSource(f.map,SCENE_SOURCE.terrain,vi.fn(),failure);f.emit('error',{sourceId:SCENE_SOURCE.terrain});f.emit('error',{sourceId:SCENE_SOURCE.terrain});vi.advanceTimersByTime(25_000);expect(failure).toHaveBeenCalledTimes(1);stop();
  const g=observerMap(),timeout=vi.fn(),cleanup=observeSceneSource(g.map,SCENE_SOURCE.map,vi.fn(),timeout,100);vi.advanceTimersByTime(101);expect(timeout).toHaveBeenCalledTimes(1);cleanup();
 });
});
