import type { DataMeta, HotspotPayload, Location } from './contracts';
import { locationSchema } from './contracts';
import { pointInIndonesia } from './geography';
import { HOUR_MS, POLICY } from './policy';
import { withinWindow } from './time';
export type ViewBounds = [number,number,number,number];
export const confidenceLabel = { low:'Rendah', nominal:'Nominal', high:'Tinggi' } as const;
export function parseLocationInput(text: string): Location | null {
  const cells=text.trim().split(',').map(cell=>cell.trim());
  if(cells.length!==2 || cells.some(cell=>!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cell)))return null;
  const parsed=locationSchema.safeParse({lat:Number(cells[0]),lon:Number(cells[1])});
  return parsed.success && pointInIndonesia(parsed.data)?parsed.data:null;
}
export function visibleDetections(data: HotspotPayload | null, bounds: ViewBounds | null, now: Date, hours:24|48|168) {
  return (data?.features ?? []).filter(feature=>{
    const [lon,lat]=feature.geometry.coordinates;
    return withinWindow(feature.properties.acquiredAt,now,hours) && (!bounds || lon>=bounds[0]&&lon<=bounds[2]&&lat>=bounds[1]&&lat<=bounds[3]);
  });
}
export function displayedHotspotState(meta: DataMeta, now: Date, offline: boolean, refreshFailed: boolean): DataMeta['state'] {
  if(meta.state==='unavailable'||!meta.fetchedAt||now.getTime()-Date.parse(meta.fetchedAt)>=POLICY.HOTSPOT_MAX_FALLBACK_HOURS*HOUR_MS)return 'unavailable';
  if(meta.state==='stale'||offline||refreshFailed||!meta.validUntil||now.getTime()>=Date.parse(meta.validUntil))return 'stale';
  return meta.state;
}
export function formatWib(timestamp: string | null) {
  return timestamp ? new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(timestamp))+' WIB' : 'Belum tersedia';
}
