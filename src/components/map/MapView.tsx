'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GeoJSONSource, Map as LibreMap, Marker as LibreMarker } from 'maplibre-gl';
import type { DataState, HotspotPayload, Location } from '@/lib/contracts';
import { formatWib, type ViewBounds } from '@/lib/hotspot-view';
import { indonesia } from '@/lib/geography';
import { cameraDataBounds, createSceneStyle } from '@/lib/map-scene';
import { isSceneSource } from '@/lib/map-scene-controller';
import { useMapScene } from './useMapScene';
import { MapSceneSettings } from './MapSceneSettings';
import { MapCameraControls, fitDataRegion } from './MapCameraControls';
import { MapWorkspacePanel } from './MapWorkspacePanel';
import { MapRegionLayers } from './MapRegionLayers';
import { HotspotEmphasis } from './HotspotEmphasis';
import { MapHexagons } from './MapHexagons';
import type { HexProperties, HexResolution } from '@/lib/hotspot-hexagons';
import { useAirField } from '@/components/air-field/useAirField';
import { MapAirField, AirFieldControls, AirFieldLegend, selectFieldFrame } from '@/components/air-field/MapAirField';
interface Props { data: HotspotPayload['features']; location: Location|null; reset: number; onBounds:(bounds:ViewBounds)=>void; onDetection:(id:string)=>void; onLocation:(location:Location)=>void; selectedId?:string|null; hexData?:HotspotPayload['features']; dataState?:DataState; periodLabel?:string; searchControls?:ReactNode; filterControls?:ReactNode; sourceStatus?:ReactNode }
const empty={type:'FeatureCollection' as const,features:[]};
export function MapView(props: Props) {
  const container=useRef<HTMLDivElement>(null),map=useRef<LibreMap|null>(null),marker=useRef<LibreMarker|null>(null);
  const latest=useRef(props),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0);
  const apiKey=process.env.NEXT_PUBLIC_CARTO_API_KEY;
  const [readyMap,setReadyMap]=useState<LibreMap|null>(null);
  const scene=useMapScene(readyMap);
  const [mode,setMode]=useState<'heatmap'|'points'|'hexagons'>('heatmap'),[resolution,setResolution]=useState<HexResolution>(5),[selectedCellId,setSelectedCellId]=useState<string|null>(null);
  const [selectedCell,setSelectedCell]=useState<HexProperties|null>(null);
  const [showField,setShowField]=useState(false),[fieldTime,setFieldTime]=useState(''),[fieldOpacity,setFieldOpacity]=useState(0.6),[fieldRenderFailed,setFieldRenderFailed]=useState(false);
  const airField=useAirField(showField),fieldFrame=selectFieldFrame(airField,fieldTime);
  useEffect(()=>{latest.current=props;});
  useEffect(()=>{
    let disposed=false,instance:LibreMap|null=null;
    setError(null);
    void import('maplibre-gl').then(lib=>{
      if(disposed||!container.current)return;
      lib.setWorkerUrl('/maplibre-gl-worker.mjs');
      const style=createSceneStyle(apiKey);
      instance=new lib.Map({container:container.current,style,bounds:[[94.5,-11.2],[141.5,6.5]],fitBoundsOptions:{padding:25},maxBounds:[[90,-18],[148,15]],attributionControl:{compact:true},renderWorldCopies:false});map.current=instance;
      instance.getCanvas().setAttribute('aria-label','Peta hotspot. Gunakan daftar deteksi dan pencarian lokasi sebagai alternatif keyboard.');
      const current=instance;
      let lastBounds:string|null=null;
      const reportBounds=()=>{const b=current.getBounds(),dataBounds=cameraDataBounds([b.getWest(),b.getSouth(),b.getEast(),b.getNorth()]);if(!dataBounds)return;const key=dataBounds.map(v=>v.toFixed(5)).join(',');if(lastBounds===key)return;lastBounds=key;latest.current.onBounds(dataBounds);};
      current.once('style.load',()=>{
        if(disposed)return;
        current.addSource('country',{type:'geojson',data:indonesia,attribution:'Batas indikatif © Natural Earth (public domain)'});
        current.addLayer({id:'country-fill',type:'fill',source:'country',layout:{visibility:'none'},paint:{'fill-color':'#273d36','fill-opacity':0.8}});
        current.addLayer({id:'country-line',type:'line',source:'country',paint:{'line-color':'#7f9b80','line-width':1}});
        current.addSource('hotspots-raw',{type:'geojson',data:{type:'FeatureCollection',features:latest.current.data}});
        current.addSource('hotspots',{type:'geojson',data:{type:'FeatureCollection',features:latest.current.data},cluster:true,clusterRadius:40,clusterMaxZoom:10});
        current.addLayer({id:'hotspot-heatmap',type:'heatmap',source:'hotspots-raw',maxzoom:10,paint:{'heatmap-weight':['match',['get','confidence'],'high',1.0,'nominal',0.65,0.35],'heatmap-intensity':['interpolate',['linear'],['zoom'],3,0.9,8,2.5],'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(0,0,0,0)',0.15,'rgba(254,240,138,0.45)',0.35,'rgba(249,115,22,0.72)',0.65,'rgba(239,68,68,0.88)',1.0,'rgba(185,28,28,0.98)'],'heatmap-radius':['interpolate',['linear'],['zoom'],3,10,5,18,8,30],'heatmap-opacity':['interpolate',['linear'],['zoom'],5,0.85,7,0.60,8,0.25,9,0]}});
        current.addLayer({id:'clusters',type:'circle',source:'hotspots',filter:['has','point_count'],paint:{'circle-color':['step',['get','point_count'],'#f59e0b',25,'#f97316',100,'#ef4444',500,'#b91c1c'],'circle-radius':['step',['get','point_count'],16,25,20,100,26,500,32],'circle-stroke-color':'#450a0a','circle-stroke-width':2,'circle-opacity':['interpolate',['linear'],['zoom'],3,0.25,5,0.65,7,1.0],'circle-stroke-opacity':['interpolate',['linear'],['zoom'],3,0.25,5,0.65,7,1.0]}});
        current.addLayer({id:'detections',type:'circle',source:'hotspots',filter:['!',['has','point_count']],paint:{'circle-color':['match',['get','confidence'],'high','#ff3e24','low','#ffc83b','#ff9e1b'],'circle-radius':['interpolate',['linear'],['zoom'],4,3.5,8,5.5,12,7.5],'circle-stroke-width':1.3,'circle-stroke-color':'#090d12'}});
        current.on('click',async event=>{
          const cluster=current.queryRenderedFeatures(event.point,{layers:['clusters']})[0];
          if(cluster){const source=current.getSource('hotspots') as GeoJSONSource;try{const zoom=await source.getClusterExpansionZoom(Number(cluster.properties?.cluster_id));if(!disposed&&cluster.geometry.type==='Point')current.easeTo({center:cluster.geometry.coordinates as [number,number],zoom,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:300});}catch{}return;}
          const detection=current.queryRenderedFeatures(event.point,{layers:['detections']})[0];
          if(detection){latest.current.onDetection(String(detection.properties?.id));return;}
          const cell=current.getLayer('hotspot-hex-fill')?current.queryRenderedFeatures(event.point,{layers:['hotspot-hex-fill']})[0]:null;
          if(cell){setSelectedCellId(String(cell.properties?.id));return;}
          latest.current.onLocation({lat:event.lngLat.lat,lon:event.lngLat.lng});
        });
        reportBounds();setReadyMap(current);
      });
      current.on('moveend',reportBounds);
      current.on('error',(e)=>{if(isSceneSource((e as {sourceId?:string}).sourceId))return;console.error('MAP_INTERNAL_ERROR:', e?.error ?? e);if(!disposed)setError('Peta dasar atau WebGL mengalami gangguan. Pencarian, daftar deteksi, dan panel data tetap tersedia.');});
      current.on('webglcontextlost',()=>{if(!disposed)setError('WebGL terputus. Gunakan daftar deteksi atau coba muat peta lagi.');});
      // Selection marker is driven by the chosen air location, never a historical hotspot click.
      const updateMarker=()=>{
        const location=latest.current.location;
        if(!location){marker.current?.remove();marker.current=null;return;}
        if(!marker.current)marker.current=new lib.Marker({color:'#c6d3b4',opacityWhenCovered:0}).setLngLat([location.lon,location.lat]).addTo(current);
        else {
          const previous=marker.current.getLngLat();
          if(previous.lng!==location.lon||previous.lat!==location.lat)marker.current.setLngLat([location.lon,location.lat]);
        }
      };
      current.on('idle',updateMarker);
    }).catch(()=>{if(!disposed)setError('Peta tidak dapat dimuat. Gunakan pencarian dan daftar deteksi di bawah.');});
    return()=>{disposed=true;setReadyMap(null);marker.current?.remove();marker.current=null;instance?.remove();map.current=null;};
  },[apiKey,retry]);
  useEffect(()=>{
    const source=map.current?.getSource('hotspots') as GeoJSONSource|undefined;
    const rawSource=map.current?.getSource('hotspots-raw') as GeoJSONSource|undefined;
    const payload={ ...empty,features:props.data };
    void source?.setData(payload).catch(()=>setError('Lapisan deteksi gagal diperbarui. Gunakan daftar deteksi.'));
    void rawSource?.setData(payload).catch(()=>{});
  },[props.data]);
  useEffect(()=>{
    const location=props.location,current=map.current;if(!location||!current)return;
    current.easeTo({center:[location.lon,location.lat],zoom:Math.max(current.getZoom(),7),duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:400});
  },[props.location]);
  useEffect(()=>{if(props.reset&&map.current)fitDataRegion(map.current);},[props.reset]);
  // Presentation only: keep the existing map instance in sync with responsive panels.
  useEffect(()=>{
    const element=container.current;
    if(!element||typeof ResizeObserver==='undefined')return;
    let frame=0;
    const observer=new ResizeObserver(()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>map.current?.resize());
    });
    observer.observe(element);
    return()=>{observer.disconnect();cancelAnimationFrame(frame);};
  },[]);
  return <section className="map-frame" aria-label="Peta deteksi hotspot"><HotspotEmphasis map={readyMap} selected={props.data.find(feature=>feature.properties.id===props.selectedId)??null}/><MapWorkspacePanel search={props.searchControls} pinned={<MapSceneSettings scene={scene} ready={!!readyMap} allowTerrain/>}><details open><summary>Lapisan wilayah</summary><MapRegionLayers map={readyMap}/></details><details><summary>Visualisasi hotspot</summary><MapHexagons map={readyMap} features={props.hexData??props.data} state={props.dataState??'unavailable'} period={props.periodLabel??''} mode={mode} onMode={setMode} resolution={resolution} onResolution={setResolution} selectedId={selectedCellId} onSelection={setSelectedCell}/></details><details><summary>Kualitas udara model</summary><AirFieldControls enabled={showField} onEnabled={setShowField} resource={airField} selectedAt={fieldTime} onTime={setFieldTime} opacity={fieldOpacity} onOpacity={setFieldOpacity} renderFailed={fieldRenderFailed}/></details><details open><summary>Filter deteksi</summary>{props.filterControls}</details><details><summary>Status & sumber data</summary>{props.sourceStatus}</details></MapWorkspacePanel><MapAirField map={readyMap} enabled={showField} snapshot={airField.response?.data??null} frame={fieldFrame} opacity={fieldOpacity} onError={setFieldRenderFailed}/>{selectedCell&&<aside className="hex-selection-summary" aria-live="polite"><strong>{selectedCell.count.toLocaleString('id-ID')} deteksi dalam sel H3</strong><span>{selectedCell.id} · {props.periodLabel}</span><span>{formatWib(selectedCell.firstAt)} — {formatWib(selectedCell.lastAt)}</span><button type="button" onClick={()=>setSelectedCellId(null)}>Tutup detail sel</button></aside>}<div className="map-viewport"><MapCameraControls map={readyMap}/><AirFieldLegend enabled={showField} resource={airField} frame={fieldFrame} renderFailed={fieldRenderFailed}/><div ref={container} className="map-canvas" />{error&&<div className="map-error" role="status"><p>{error}</p><button onClick={()=>setRetry(value=>value+1)}>Muat ulang peta</button></div>}</div><div className="map-legend" role="region" aria-label="Legenda peta hotspot">{mode==='heatmap'&&<div className="legend-group legend-heat"><span className="legend-label">Sebaran Panas</span><span className="legend-heat-ramp" aria-hidden="true"/><span className="legend-hint">Rendah → Padat</span></div>}<div className="legend-group"><span className="legend-label">Titik Panas</span><span className="legend-item legend-low"><span className="legend-dot" aria-hidden="true"/> Rendah</span><span className="legend-item legend-nominal"><span className="legend-dot" aria-hidden="true"/> Nominal</span><span className="legend-item legend-high"><span className="legend-dot" aria-hidden="true"/> Tinggi</span></div><div className="legend-group legend-clusters"><span className="legend-label">Kluster</span><span className="legend-cluster-item cluster-small"><span className="cluster-badge">&lt;25</span></span><span className="legend-cluster-item cluster-medium"><span className="cluster-badge">25-100</span></span><span className="legend-cluster-item cluster-large"><span className="cluster-badge">&gt;100</span></span><span className="legend-hint">Klik untuk perbesar</span></div></div><p className="map-attribution">Batas: <a href="https://www.naturalearthdata.com/">Natural Earth</a> · <a href="/data/provinces-LICENSE.md">Provinsi CC BY 4.0</a> · {scene.basemap==='satellite'?<a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer">Imagery © Esri & penyedia citra</a>:scene.streetFailed?'Batas lokal indikatif':apiKey?<><a href="https://www.openstreetmap.org/copyright">© OSM</a> · <a href="https://carto.com/attribution/">© CARTO</a></>:<a href="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer">© Esri, HERE, Garmin, OSM</a>}{scene.viewMode==='terrain'&&<> · <a href="https://registry.opendata.aws/terrain-tiles/">Elevasi Mapzen / AWS</a></>}</p></section>;
}
