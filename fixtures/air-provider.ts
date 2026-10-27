// Synthetic Open-Meteo-shaped response for deterministic tests, never operational data.
import { SYNTHETIC_NOW } from './provider-scenarios';
import { HOUR_MS } from '../src/lib/policy';
export function syntheticAirResponse(now = SYNTHETIC_NOW, value: number | null = 22) {
  const start = new Date(now); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - 2);
  return {
    latitude: -2.2, longitude: 114, utc_offset_seconds: 0, timezone: 'GMT', generationtime_ms: 0.5,
    hourly_units: { time: 'unixtime', pm2_5: 'μg/m³' },
    hourly: { time: Array.from({ length: 120 }, (_, index) => (start.getTime() + index * HOUR_MS) / 1000), pm2_5: Array<number | null>(120).fill(value) },
  };
}
