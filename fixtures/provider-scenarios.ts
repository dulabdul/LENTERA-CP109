import type { HourPm25 } from "../src/lib/contracts";
import { HOUR_MS } from "../src/lib/policy";
import { currentHour } from "../src/lib/time";

export const SYNTHETIC_NOW = new Date("2026-10-27T13:30:00.000Z");
export function syntheticPm25(value: number | null, now = SYNTHETIC_NOW): HourPm25[] {
  const end = currentHour(now);
  return Array.from({ length: 24 }, (_, index) => ({ validAt: new Date(end - (23 - index) * HOUR_MS).toISOString(), pm25UgM3: value }));
}
export const syntheticViirsCsv = "latitude,longitude,bright_ti4,acq_date,acq_time,satellite,confidence,frp\n0.51,101.45,330.2,2026-10-27,1300,N,n,2.5\n";
export const syntheticEmptyCsv = "latitude,longitude,bright_ti4,acq_date,acq_time,satellite,confidence,frp\n";
export const syntheticInvalidCsv = "Invalid MAP_KEY.";
