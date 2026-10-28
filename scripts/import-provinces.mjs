import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const input=process.argv[2];if(!input)throw Error('Usage: node scripts/import-provinces.mjs downloaded.geojson');
const bytes=await readFile(input),data=JSON.parse(bytes),ids=new Set();
if(data.type!=='FeatureCollection'||data.features?.length!==38)throw Error('Expected 38 province features');
const catalog=[];
for(const f of data.features){
 const id=String(f.properties.id),name=f.properties.PROVINSI;
 if(!/^\d{2}(?:-[A-Z])?$/.test(id)||ids.has(id)||typeof name!=='string'||!name.trim()||!['Polygon','MultiPolygon'].includes(f.geometry?.type))throw Error('Invalid province identity/geometry');ids.add(id);
 let west=180,south=90,east=-180,north=-90,largest=null,largestArea=-1;
 const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
 for(const polygon of polygons){
  for(const ring of polygon){
   if(ring.length<4||JSON.stringify(ring[0])!==JSON.stringify(ring.at(-1)))throw Error('Unclosed province ring');
   for(const c of ring){const [x,y]=c;if(c.length!==2||!Number.isFinite(x)||!Number.isFinite(y)||x<94||x>142||y< -12||y>7)throw Error('Invalid coordinate');west=Math.min(west,x);south=Math.min(south,y);east=Math.max(east,x);north=Math.max(north,y);}
  }
  const ring=polygon[0];let area=0;for(let i=1;i<ring.length;i++)area+=ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1];if(Math.abs(area)>largestArea){largestArea=Math.abs(area);largest=ring;}
 }
 const xs=largest.map(c=>c[0]),ys=largest.map(c=>c[1]);
 catalog.push({id,name,bounds:[west,south,east,north],label:[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2]});
}
await mkdir('public/data',{recursive:true});await writeFile('public/data/provinces.geojson',bytes);
const source='https://github.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces';
const manifest={provider:'Deny Herianto / community dataset',title:'Indonesia GeoJSON & TopoJSON Maps (38 Provinces)',version:'1.0.0',commit:'80aa4a90ac7eef5136eaa2b551b6aa5d198be27d',snapshotDate:'2025-12-18',surveyDate:null,source,downloadUrl:source.replace('github.com','raw.githubusercontent.com')+'/80aa4a90ac7eef5136eaa2b551b6aa5d198be27d/GeoJSON/indonesia-38-provinces.geojson',license:'CC BY 4.0 (dataset publisher declaration)',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',licenseDeclaration:source+'/blob/80aa4a90ac7eef5136eaa2b551b6aa5d198be27d/DATA_LICENSE.md',upstreamLineage:'Not documented by the publisher; not independently established',indicative:true,note:'38 bentuk wilayah dari dataset komunitas 2025; digeneralisasi, bukan batas hukum/otoritatif terkini. Asal survei geometri tidak dijelaskan penerbit.',transformation:'Geometry/properties bytes preserved. Publisher shape ids are internal: KODE_PROV repeats for new Papua shapes and is not used as an official identifier. Catalog derives bounds and label centers from largest polygon bbox; labels are cartographic hints, not administrative capitals.',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,featureCount:38,catalog:catalog.sort((a,b)=>a.name.localeCompare(b.name,'id'))};
await writeFile('src/data/provinces-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({features:38,bytes:bytes.length,sha256:manifest.sha256}));
