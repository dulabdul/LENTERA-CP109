import { z } from 'zod';
import { isoUtcSchema, locationSchema, sourceResponseSchema, type DataState } from '../contracts';
export const FIELD_POLICY = { west: 94, south: -12, east: 142, north: 6, step: 1, nx: 49, ny: 19, freshMs: 12 * 3_600_000, maxAgeMs: 24 * 3_600_000, maxBytes: 4 * 1024 * 1024, batchSize: 10, horizonHours: 24 } as const;
export const fieldGridSchema = z.object({ west: z.number().min(-180).max(180), south: z.number().min(-85).max(85), east: z.number().min(-180).max(180), north: z.number().min(-85).max(85), step: z.number().min(0.25).max(2), nx: z.number().int().min(2).max(97), ny: z.number().int().min(2).max(49) }).strict().superRefine((g, ctx) => {
  if (g.east <= g.west || g.north <= g.south || Math.abs(g.west + (g.nx - 1) * g.step - g.east) > 1e-8 || Math.abs(g.south + (g.ny - 1) * g.step - g.north) > 1e-8) ctx.addIssue({ code: 'custom', message: 'Grid dimensions/bounds/spacing mismatch' });
});
export const fieldFrameSchema = z.object({ validAt: isoUtcSchema, values: z.array(z.number().finite().nonnegative().nullable()).max(4753) }).strict();
export const fieldSnapshotSchema = z.object({
  schemaVersion: z.literal('1.0'), kind: z.literal('pm25-model-grid'), source: z.literal('open-meteo-cams-global'), nativeResolutionDegrees: z.literal(0.4),
  grid: fieldGridSchema, startedAt: isoUtcSchema, fetchedAt: isoUtcSchema, runAt: z.null(), synthetic: z.boolean(),
  modelLocations: z.array(locationSchema.nullable()).max(4753), frames: z.array(fieldFrameSchema).min(1).max(49),
  attribution: z.literal('PM2.5: Open-Meteo / Copernicus CAMS global; model, bukan sensor. Sampling LENTERA, bukan grid native.'),
}).strict().superRefine((s, ctx) => {
  const size = s.grid.nx * s.grid.ny, fetched = Date.parse(s.fetchedAt), started = Date.parse(s.startedAt), times = s.frames.map(f => Date.parse(f.validAt));
  if (started > fetched || fetched - started > 2 * 3_600_000 || s.modelLocations.length !== size || s.frames.some(f => f.values.length !== size) || times.some((t, i) => t % 3_600_000 !== 0 || (i > 0 && t - times[i - 1]! !== 3_600_000)) || times[0]! < Math.floor(started / 3_600_000) * 3_600_000 || times.at(-1)! > Math.floor(started / 3_600_000) * 3_600_000 + 48 * 3_600_000) ctx.addIssue({ code: 'custom', message: 'Field shape/time inconsistent' });
  for (let i = 0; i < size; i++) {
    const location = s.modelLocations[i];
    if (!location) { if (s.frames.some(f => f.values[i] !== null)) ctx.addIssue({ code: 'custom', message: 'A value requires source model location' }); continue; }
    const lat = s.grid.south + Math.floor(i / s.grid.nx) * s.grid.step, lon = s.grid.west + (i % s.grid.nx) * s.grid.step;
    if (Math.abs(location.lat - lat) > 0.5 || Math.abs(location.lon - lon) > 0.5) ctx.addIssue({ code: 'custom', message: 'Source model location outside query tolerance' });
  }
});
export const airFieldResponseSchema = sourceResponseSchema(fieldSnapshotSchema);
export type FieldGrid = z.infer<typeof fieldGridSchema>;
export type FieldSnapshot = z.infer<typeof fieldSnapshotSchema>;
export type FieldFrame = z.infer<typeof fieldFrameSchema>;
export type AirFieldResponse = z.infer<typeof airFieldResponseSchema>;
export function fieldLocations(grid: FieldGrid) { fieldGridSchema.parse(grid); return Array.from({ length: grid.nx * grid.ny }, (_, i) => ({ lat: grid.south + Math.floor(i / grid.nx) * grid.step, lon: grid.west + i % grid.nx * grid.step })); }
export function currentFieldFrame(snapshot: FieldSnapshot, now: Date) { const time = Math.floor(now.getTime() / 3_600_000) * 3_600_000; return snapshot.frames.find(f => Date.parse(f.validAt) === time) ?? null; }
export function projectField(snapshot: FieldSnapshot | null, dataVersion: string | null, now: Date, failed = false, lastAttemptAt: string | null = null): AirFieldResponse {
  const current = snapshot ? currentFieldFrame(snapshot, now) : null, age = snapshot ? now.getTime() - Date.parse(snapshot.fetchedAt) : Infinity;
  let state: DataState = !snapshot || snapshot.synthetic || !dataVersion || age < 0 || age > FIELD_POLICY.maxAgeMs || !current || current.values.every(v => v === null) ? 'unavailable' : failed || age >= FIELD_POLICY.freshMs ? 'stale' : current.values.some(v => v === null) ? 'partial' : 'ok';
  const issues = state === 'unavailable' ? [{ code: 'not-configured' as const, source: 'air-field', detail: 'Grid PM2.5 operasional belum tersedia untuk jam kini, telah melewati batas umur, atau tidak dapat diverifikasi.' }] : state === 'stale' ? [{ code: 'fallback' as const, source: 'air-field', detail: 'Snapshot grid lama/fallback. Periksa waktu pengambilan dan jam model.' }] : state === 'partial' ? [{ code: 'missing-source' as const, source: 'air-field', detail: 'Sebagian sampel grid kosong; area tersebut tidak diwarnai.' }] : [];
  const result = airFieldResponseSchema.parse({ meta: { schemaVersion: '1.0', state, issues, evaluatedAt: now.toISOString(), fetchedAt: snapshot && Date.parse(snapshot.fetchedAt) <= now.getTime() ? snapshot.fetchedAt : null, lastAttemptAt, validUntil: snapshot ? new Date(Date.parse(snapshot.fetchedAt) + (state === 'stale' ? FIELD_POLICY.maxAgeMs : FIELD_POLICY.freshMs)).toISOString() : null, dataVersion }, data: state === 'unavailable' ? null : snapshot });
  return { ...result, data: result.data ? snapshot : null }; // Reuse validated snapshot identity for raster memoization.
}
