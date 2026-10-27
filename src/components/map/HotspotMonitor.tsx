'use client';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { DataStatus } from '@/components/data/DataStatus';
import { MapView } from './MapView';
import { LocationPanels } from '@/components/air/LocationPanels';
import { hotspotPayloadSchema, sourceResponseSchema, type Location } from '@/lib/contracts';
import { pointInIndonesia, searchPlaces } from '@/lib/geography';
import { confidenceLabel, displayedHotspotState, formatWib, parseLocationInput, visibleDetections, type ViewBounds } from '@/lib/hotspot-view';
import { POLICY } from '@/lib/policy';
const responseSchema=sourceResponseSchema(hotspotPayloadSchema);
type ResponseData=ReturnType<typeof responseSchema.parse>;
export function HotspotMonitor() {
  const [range,setRange]=useState('24h'),[source,setSource]=useState(''),[confidence,setConfidence]=useState('');
  const [stored,setStored]=useState<{key:string;response:ResponseData}|null>(null),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  const [now,setNow]=useState(()=>new Date()),[offline,setOffline]=useState(false),[bounds,setBounds]=useState<ViewBounds|null>(null),[reset,setReset]=useState(0);
  const [search,setSearch]=useState(''),[location,setLocation]=useState<(Location&{label:string})|null>(null),[locationError,setLocationError]=useState('');
  const [selectedId,setSelectedId]=useState<string|null>(null),[page,setPage]=useState(0),[showPanel,setShowPanel]=useState(true);
  const detailRef=useRef<HTMLElement>(null), previousSelection=useRef<string|null>(null);
  const query=useMemo(()=>{const params=new URLSearchParams({range});if(source)params.set('source',source);if(confidence)params.set('confidence',confidence);return params.toString();},[range,source,confidence]);
  useEffect(()=>{
    let controller:AbortController|null=null,disposed=false;
    const refresh=async()=>{
      controller?.abort();const active=new AbortController();controller=active;setLoading(true);
      try {
        const raw=await fetch(`/api/hotspots?${query}`,{signal:AbortSignal.any([active.signal,AbortSignal.timeout(20_000)]),cache:'no-store'});
        const response=responseSchema.parse(await raw.json());
        if(disposed||active.signal.aborted)return;
        setStored({key:query,response});setFailed(false);setNow(new Date());
      } catch {if(!disposed&&!active.signal.aborted)setFailed(true);}
      finally {if(!disposed&&!active.signal.aborted)setLoading(false);}
    };
    const tick=()=>{setNow(new Date());if(!document.hidden&&navigator.onLine)void refresh();};
    void refresh();const timer=window.setInterval(tick,60_000);document.addEventListener('visibilitychange',tick);window.addEventListener('online',tick);
    return()=>{disposed=true;controller?.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',tick);window.removeEventListener('online',tick);};
  },[query,retry]);
  useEffect(()=>{const update=()=>{setOffline(!navigator.onLine);setNow(new Date());};update();window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
  useEffect(()=>{setSelectedId(null);setPage(0);},[query]);
  useEffect(()=>{setPage(0);},[bounds]);
  const response=stored?.key===query?stored.response:null;
  const state=response?displayedHotspotState(response.meta,now,offline,failed):'unavailable';
  const data=state==='unavailable'?null:response?.data??null;
  const hours=range==='24h'?24:range==='48h'?48:168;
  const mapFeatures=useMemo(()=>visibleDetections(data,null,now,hours),[data,now,hours]);
  const visible=useMemo(()=>visibleDetections(data,bounds,now,hours).sort((a,b)=>b.properties.acquiredAt.localeCompare(a.properties.acquiredAt)),[data,bounds,now,hours]);
  const pageCount=Math.max(1,Math.ceil(visible.length/25)),activePage=Math.min(page,pageCount-1);
  const selected=mapFeatures.find(feature=>feature.properties.id===selectedId)??null;
  useEffect(()=>{if(selectedId&&previousSelection.current!==selectedId){detailRef.current?.focus();previousSelection.current=selectedId;}},[selectedId]);
  const chooseLocation=(value:Location,label='Koordinat pilihan')=>{
    if(!pointInIndonesia(value)){setLocationError('Pilih koordinat di dalam batas indikatif Indonesia.');return;}
    setLocation({...value,label});setLocationError('');setShowPanel(true);
  };
  const submitLocation=(event:FormEvent)=>{event.preventDefault();const value=parseLocationInput(search);if(value)chooseLocation(value);else setLocationError('Pilih hasil pencarian atau masukkan lintang, bujur di Indonesia, misalnya -2.21, 113.92.');};
  const places=searchPlaces(search);
  return <>
    <div className="monitor-intro"><div><p className="eyebrow">PANTAU LOKASI</p><h1 className="page-title">Satu lokasi.<br/><em>Informasi untuk bertindak.</em></h1></div><p>Telusuri deteksi panas satelit dan pilih lokasi untuk melihat informasi udara. Deteksi hotspot belum mengonfirmasi kebakaran di lapangan.</p></div>
    {offline&&<p className="notice" role="status">Perangkat sedang offline. Data yang sudah dimuat ditandai sesuai umurnya; pemuatan ulang tanpa internet belum didukung.</p>}
    <form className="location-search" onSubmit={submitLocation}>
      <label htmlFor="location-search">Cari tempat atau masukkan lintang, bujur</label>
      <div className="input-row"><input id="location-search" value={search} onChange={event=>{setSearch(event.target.value);setLocationError('');}} placeholder="Nama tempat atau -2.21, 113.92" autoComplete="off"/><button type="submit">Pilih koordinat</button></div>
      {places.length>0&&<ul className="search-results" aria-label="Hasil pencarian tempat">{places.map(place=><li key={place.id}><button type="button" onClick={()=>{chooseLocation({lat:place.lat,lon:place.lon},place.name);setSearch('');}}>{place.name} <span>{place.region}</span></button></li>)}</ul>}
      {locationError&&<p role="alert" className="notice">{locationError}</p>}
      <p className="field-help">Gazetteer Natural Earth; bukan daftar desa lengkap. Tidak menggunakan GPS otomatis.</p>
    </form>
    <div className="hotspot-toolbar"><fieldset><legend>Periode deteksi</legend><div className="segmented">{['24h','48h','7d'].map(value=><button key={value} type="button" aria-pressed={range===value} onClick={()=>setRange(value)}>{value==='7d'?'7 hari':value.replace('h',' jam')}</button>)}</div></fieldset><label>Satelit<select value={source} onChange={event=>setSource(event.target.value)}><option value="">Semua VIIRS</option>{POLICY.HOTSPOT_SOURCES.map(value=><option key={value} value={value}>{value.replace('VIIRS_','').replace('_NRT','')}</option>)}</select></label><label>Keyakinan deteksi<select value={confidence} onChange={event=>setConfidence(event.target.value)}><option value="">Semua kategori</option>{(['low','nominal','high']as const).map(value=><option key={value} value={value}>{confidenceLabel[value]}</option>)}</select></label><button type="button" onClick={()=>{setReset(value=>value+1);setBounds(null);}}>Reset peta</button><a className="control-link" href="#detection-list">Lihat daftar ↓</a></div>
    <nav className="mobile-section-nav" aria-label="Pindah cepat antar bagian">
      <a href="#map-frame" className="mobile-nav-btn">Peta Hotspot</a>
      <a href="#location-panel" className="mobile-nav-btn" onClick={() => setShowPanel(true)}>Udara & Tindakan</a>
      <a href="#detection-list" className="mobile-nav-btn">Daftar Deteksi</a>
    </nav>
    <section className="hotspot-source" aria-label="Status sumber hotspot" aria-live="polite"><p className="source-label">NASA FIRMS · VIIRS</p><DataStatus state={state}>{loading?'Memperbarui data hotspot…':failed?'Pembaruan gagal. Coba lagi atau periksa koneksi.':'NASA FIRMS · VIIRS · waktu pengamatan satelit'}</DataStatus><button onClick={()=>setRetry(value=>value+1)} disabled={loading}>{loading?'Memuat…':'Coba lagi'}</button></section>
    <div className="monitor-layout live-monitor"><div id="map-frame"><MapView data={mapFeatures} location={location} reset={reset} onBounds={setBounds} onDetection={setSelectedId} onLocation={chooseLocation}/><div className="coverage-details"><p><strong>{data?`${visible.length.toLocaleString('id-ID')} deteksi hotspot dalam tampilan`:'Jumlah deteksi belum tersedia'}</strong> · {range==='7d'?'7 hari bergerak':range.replace('h',' jam bergerak')}</p><p>Diambil: {formatWib(response?.meta.fetchedAt??null)} · Deteksi terakhir pada snapshot: {formatWib(data?.coverage.latestDetectionAt??null)}</p>{data&&<p>Snapshot dievaluasi: {formatWib(data.coverage.asOf)} · {data.coverage.completedSources.length}/3 sumber lengkap. {data.coverage.missingSources.length>0&&'Cakupan sebagian; angka nol tidak menyatakan nihil deteksi nasional.'}</p>}<details><summary>Cakupan dan waktu UTC</summary><p>Interval bergerak: batas awal eksklusif, batas akhir inklusif. Peta, daftar, dan ringkasan memakai filter yang sama.</p>{data&&<p>Batas: {data.coverage.boundaryVersion}<br/>asOf UTC: {data.coverage.asOf}<br/>Deteksi terakhir UTC: {data.coverage.latestDetectionAt??'Tidak ada pada snapshot'}</p>}<ul>{response?.meta.issues.map((issue,index)=><li key={index}>{issue.detail}</li>)}</ul></details></div></div><aside className="monitor-aside"><button className="panel-toggle" aria-expanded={showPanel} aria-controls="location-panel" onClick={()=>setShowPanel(value=>!value)}>{showPanel?'Sembunyikan':'Tampilkan'} panel lokasi</button><div id="location-panel" hidden={!showPanel}><p className="eyebrow">LOKASI PILIHAN</p><h2>{location?.label??'Pilih lokasi Anda'}</h2>{location&&<p className="coordinates">{location.lat.toFixed(4)}, {location.lon.toFixed(4)}</p>}<hr/><LocationPanels key={location ? `${location.lat},${location.lon}` : "no-location"} location={location} offline={offline}/></div></aside></div>
    <section id="detection-list" className="detection-section" aria-labelledby="detection-heading"><div className="section-heading"><div><p className="eyebrow">ALTERNATIF PETA</p><h2 id="detection-heading" tabIndex={-1}>Daftar deteksi</h2></div><p>{data?`${visible.length} hasil sesuai tampilan dan filter`:'Menunggu snapshot operasional'}</p></div>{!data?<p className="notice">Data belum tersedia. Sumber yang gagal tidak dianggap sebagai nol deteksi.</p>:visible.length===0?<p className="notice">Tidak ada deteksi tercatat pada cakupan ini.{state!=='ok'&&' Cakupan sumber terbatas atau data lama; ini bukan pernyataan kondisi aman.'}</p>:<><ul className="detection-list">{visible.slice(activePage*25,(activePage+1)*25).map(feature=><li key={feature.properties.id}><button onClick={()=>setSelectedId(feature.properties.id)} aria-pressed={selectedId===feature.properties.id}><span><strong>{feature.properties.satellite}</strong><small>{formatWib(feature.properties.acquiredAt)}</small></span><span>{feature.geometry.coordinates[1].toFixed(4)}, {feature.geometry.coordinates[0].toFixed(4)}</span><span className={`confidence confidence-${feature.properties.confidence}`}>{confidenceLabel[feature.properties.confidence]}</span><span aria-hidden="true">↗</span></button></li>)}</ul><div className="pagination"><button disabled={activePage===0} onClick={()=>setPage(activePage-1)}>Sebelumnya</button><span>Halaman {activePage+1} / {pageCount}</span><button disabled={activePage+1>=pageCount} onClick={()=>setPage(activePage+1)}>Berikutnya</button></div></>}
    {selected&&<section ref={detailRef} tabIndex={-1} className="detection-detail" aria-label="Detail deteksi terpilih"><div className="section-heading"><h3>Deteksi {selected.properties.satellite}</h3><button onClick={()=>{setSelectedId(null);previousSelection.current=null;document.getElementById('detection-heading')?.focus();}}>Tutup detail</button></div><dl><dt>Waktu akuisisi</dt><dd>{formatWib(selected.properties.acquiredAt)}<br/>{selected.properties.acquiredAt} (UTC)</dd><dt>Keyakinan deteksi</dt><dd>{confidenceLabel[selected.properties.confidence]} ({selected.properties.confidenceRaw})</dd><dt>Suhu kecerahan kanal satelit</dt><dd>{selected.properties.brightnessKelvin===null?'Tidak tersedia':`${selected.properties.brightnessKelvin} K`}</dd><dt>Daya radiasi api (FRP)</dt><dd>{selected.properties.frpMw===null?'Tidak tersedia':`${selected.properties.frpMw} MW`}</dd><dt>Sumber</dt><dd>{selected.properties.source}</dd></dl><p>Suhu kanal satelit bukan suhu api di permukaan. Titik ini belum mengonfirmasi kejadian kebakaran.</p><button onClick={()=>chooseLocation({lat:selected.geometry.coordinates[1],lon:selected.geometry.coordinates[0]},'Lokasi deteksi pilihan')}>Gunakan lokasi ini untuk panel udara</button></section>}</section>
  </>;
}
