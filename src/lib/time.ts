import { HOUR_MS, POLICY } from "./policy";

export function parseUtc(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw new Error("Expected UTC timestamp ending in Z");
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value.slice(0, 10)) throw new Error("Invalid timestamp");
  return ms;
}

export function currentHour(now: Date): number {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid evaluation time");
  return Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
}

export function withinWindow(acquiredAt: string, now: Date, hours: 24 | 48 | 168): boolean {
  const timestamp = parseUtc(acquiredAt);
  return timestamp > now.getTime() - hours * HOUR_MS && timestamp <= now.getTime();
}

export function calendarBatches(now: Date, hours: number = POLICY.HOTSPOT_WINDOW_HOURS) {
  if (!Number.isFinite(now.getTime()) || !Number.isInteger(hours) || hours <= 0) throw new Error("Invalid query interval");
  const start = new Date(now.getTime() - hours * HOUR_MS);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const dates: string[] = [];
  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += 24 * HOUR_MS) dates.push(new Date(cursor).toISOString().slice(0, 10));
  const batches: Array<{ startDate: string; days: number }> = [];
  for (let index = 0; index < dates.length; index += POLICY.FIRMS_MAX_DAYS_PER_QUERY) {
    batches.push({ startDate: dates[index]!, days: Math.min(POLICY.FIRMS_MAX_DAYS_PER_QUERY, dates.length - index) });
  }
  return batches;
}
