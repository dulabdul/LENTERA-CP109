'use client';
import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as LibreMap, Marker as LibreMarker, StyleSpecification } from 'maplibre-gl';
import type { HotspotPayload, Location } from '@/lib/contracts';
import type { ViewBounds } from '@/lib/hotspot-view';
import { indonesia } from '@/lib/geography';
import { POLICY } from '@/lib/policy';
interface Props { data: HotspotPayload['features']; location: Location|null; reset: number; onBounds:(bounds:ViewBounds)=>void; onDetection:(id:string)=>void; onLocation:(location:Location)=>void }
const empty={type:'FeatureCollection' as const,features:[]};
export function MapView(props: Props) {
  const container=useRef<HTMLDivElement>(null),map=useRef<LibreMap|null>(null),marker=useRef<LibreMarker|null>(null);
  const latest=useRef(props),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0);
  const apiKey=process.env.NEXT_PUBLIC_CARTO_API_KEY;
  useEffect(()=>{latest.current=props;});
  useEffect(()=>{
    let disposed=false,instance:LibreMap|null=null;
    setError(null);
    void import('maplibre-gl').then(lib=>{
      if(disposed||!container.current)return;
      const style:StyleSpecification={version:8,sources:apiKey?{carto:{type:'raster',tiles:[`https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${encodeURIComponent(apiKey)}`],tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attribution/">CARTO</a>'}}:{},layers:[{id:'background',type:'background',paint:{'background-color':'#101923'}},...(apiKey?[{id:'basemap',type:'raster' as const,source:'carto'}]:[])]};
      instance=new lib.Map({container:container.current,style,bounds:[[94.5,-11.2],[141.5,6.5]],fitBoundsOptions:{padding:25},maxBounds:[[90,-18],[148,15]],attributionControl:{compact:false},renderWorldCopies:false});map.current=instance;
      instance.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
      instance.getCanvas().setAttribute('aria-label','Peta hotspot. Gunakan daftar deteksi dan pencarian lokasi sebagai alternatif keyboard.');
      const current=instance;
      const reportBounds=()=>{const b=current.getBounds();latest.current.onBounds([b.getWest(),b.getSouth(),b.getEast(),b.getNorth()]);};
      current.on('load',()=>{
        if(disposed)return;
        current.addSource('country',{type:'geojson',data:indonesia,attribution:'Batas indikatif © Natural Earth (public domain)'});
        if(!apiKey)current.addLayer({id:'country-fill',type:'fill',source:'country',paint:{'fill-color':'#273d36','fill-opacity':0.8}});
        current.addLayer({id:'country-line',type:'line',source:'country',paint:{'line-color':'#7f9b80','line-width':1}});
        current.addSource('hotspots',{type:'geojson',data:{type:'FeatureCollection',features:latest.current.data},cluster:true,clusterRadius:40,clusterMaxZoom:10});
        current.addLayer({id:'clusters',type:'circle',source:'hotspots',filter:['has','point_count'],paint:{'circle-color':'#ff9e1b','circle-radius':['step',['get','point_count'],17,100,23,1000,30],'circle-stroke-color':'#090d12','circle-stroke-width':2}});
        current.addLayer({id:'detections',type:'circle',source:'hotspots',filter:['!',['has','point_count']],paint:{'circle-color':['match',['get','confidence'],'high','#ff3e24','low','#ffc83b','#ff9e1b'],'circle-radius':5,'circle-stroke-width':1,'circle-stroke-color':'#090d12'}});
        current.on('click',async event=>{
          const cluster=current.queryRenderedFeatures(event.point,{layers:['clusters']})[0];
          if(cluster){const source=current.getSource('hotspots') as GeoJSONSource;try{const zoom=await source.getClusterExpansionZoom(Number(cluster.properties?.cluster_id));if(!disposed&&cluster.geometry.type==='Point')current.easeTo({center:cluster.geometry.coordinates as [number,number],zoom,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:300});}catch{}return;}
          const detection=current.queryRenderedFeatures(event.point,{layers:['detections']})[0];
          if(detection){latest.current.onDetection(String(detection.properties?.id));return;}
          latest.current.onLocation({lat:event.lngLat.lat,lon:event.lngLat.lng});
        });
        reportBounds();
      });
      current.on('moveend',reportBounds);
      current.on('error',()=>{if(!disposed)setError('Peta dasar atau WebGL mengalami gangguan. Pencarian, daftar deteksi, dan panel data tetap tersedia.');});
      current.on('webglcontextlost',()=>{if(!disposed)setError('WebGL terputus. Gunakan daftar deteksi atau coba muat peta lagi.');});
      // Selection marker is driven by the chosen air location, never a historical hotspot click.
      const updateMarker=()=>{
        const location=latest.current.location;
        if(!location){marker.current?.remove();marker.current=null;return;}
        if(!marker.current)marker.current=new lib.Marker({color:'#c6d3b4'}).setLngLat([location.lon,location.lat]).addTo(current);
        else {
          const previous=marker.current.getLngLat();
          if(previous.lng!==location.lon||previous.lat!==location.lat)marker.current.setLngLat([location.lon,location.lat]);
        }
      };
      current.on('idle',updateMarker);
    }).catch(()=>{if(!disposed)setError('Peta tidak dapat dimuat. Gunakan pencarian dan daftar deteksi di bawah.');});
    return()=>{disposed=true;marker.current?.remove();marker.current=null;instance?.remove();map.current=null;};
  },[apiKey,retry]);
  useEffect(()=>{const source=map.current?.getSource('hotspots') as GeoJSONSource|undefined;void source?.setData({ ...empty,features:props.data }).catch(()=>setError('Lapisan deteksi gagal diperbarui. Gunakan daftar deteksi.'));},[props.data]);
  useEffect(()=>{
    const location=props.location,current=map.current;if(!location||!current)return;
    current.easeTo({center:[location.lon,location.lat],zoom:Math.max(current.getZoom(),7),duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:400});
  },[props.location]);
  useEffect(()=>{if(props.reset)map.current?.fitBounds([[POLICY.INDONESIA_FETCH_BBOX[0],POLICY.INDONESIA_FETCH_BBOX[1]],[POLICY.INDONESIA_FETCH_BBOX[2],POLICY.INDONESIA_FETCH_BBOX[3]]],{padding:25,duration:0});},[props.reset]);
  return <section className="map-frame" aria-label="Peta deteksi hotspot"><div ref={container} className="map-canvas" />{!apiKey&&<p className="map-notice">Peta dasar belum tersedia. Batas indikatif Natural Earth tetap ditampilkan.</p>}{error&&<div className="map-error" role="status"><p>{error}</p><button onClick={()=>setRetry(value=>value+1)}>Muat ulang peta</button></div>}<p className="map-legend"><span>● Rendah</span><span>● Nominal</span><span>● Tinggi</span><span>Lingkaran besar: kelompok deteksi, klik untuk memperbesar.</span></p><p className="map-attribution">Batas indikatif: <a href="https://www.naturalearthdata.com/">Natural Earth</a>{apiKey&&<> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · © <a href="https://carto.com/attribution/">CARTO</a></>}</p></section>;
}
