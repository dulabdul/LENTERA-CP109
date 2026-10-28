import { describe, it, expect } from 'vitest';
import { createSceneStyle, streetSource, satelliteSource, terrainSource, SCENE_PRESETS, cameraDataBounds, regionalCameraBounds } from '../src/lib/map-scene';
import { POLICY } from '../src/lib/policy';
describe('VIEW-A scene contracts', () => {
  it('keeps globe projection independent from real DEM terrain and camera bounds', () => {
    expect(SCENE_PRESETS.globe.terrain).toBe(false); expect(SCENE_PRESETS.terrain.terrain).toBe(true); expect(SCENE_PRESETS.terrain.pitch).toBeGreaterThan(0);
    expect(regionalCameraBounds('flat')).not.toBeNull(); expect(regionalCameraBounds('globe')).toBeNull();
    const source=terrainSource(); expect(source.type).toBe('raster-dem'); expect(source.encoding).toBe('terrarium'); expect(source.attribution).toContain('attribution');
  });
  it('starts on street map only, loads no satellite/DEM until requested and preserves public key encoding', () => {
    const style=createSceneStyle(); expect(Object.values(style.sources).map(s=>s.type)).toEqual(['raster','raster']); expect(JSON.stringify(style)).not.toContain('World_Imagery'); expect(JSON.stringify(style)).not.toContain('terrarium');
    expect(streetSource('synthetic & key').tiles?.[0]).toContain('synthetic%20%26%20key'); expect(streetSource().attribution).toContain('Esri'); expect(satelliteSource().tiles?.[0]).toContain('/tile/{z}/{y}/{x}');
  });
  it('clips camera rectangles to existing coverage without expanding the dataset', () => {
    expect(cameraDataBounds([-180,-90,180,90])).toEqual([...POLICY.INDONESIA_FETCH_BBOX]);
    expect(cameraDataBounds([100,-5,120,3])).toEqual([100,-5,120,3]);
    expect(cameraDataBounds([460,-5,480,3])).toEqual([100,-5,120,3]);
    expect(cameraDataBounds([170,-20,-170,20])).toEqual([180,90,180,90]);
    expect(cameraDataBounds([-270,-5,-210,3])).toEqual([94.5,-5,141.5,3]);
    expect(cameraDataBounds([NaN,0,110,10])).toBeNull();
    expect(cameraDataBounds([90,30,150,50])).toEqual([180,90,180,90]);
  });
});
