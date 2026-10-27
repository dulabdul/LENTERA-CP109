import { z } from "zod";
import { POLICY } from "./policy";

export const isoUtcSchema = z.iso.datetime({ offset: false });
export const dataStateSchema = z.enum(["ok", "stale", "partial", "unavailable"]);
export const audienceSchema = z.enum(["general", "sensitive", "outdoor"]);
export const viirsSourceSchema = z.enum(POLICY.HOTSPOT_SOURCES);
export const aqiCategorySchema = z.enum(["good", "moderate", "sensitive", "unhealthy", "very_unhealthy", "hazardous"]);
export const locationSchema = z.object({ lat: z.number().finite().min(-90).max(90), lon: z.number().finite().min(-180).max(180) }).strict();

export const issueCodeSchema = z.enum([
  "not-configured", "not-implemented", "upstream-error", "invalid-response", "missing-source",
  "missing-hour", "incomplete-forecast", "expired", "fallback", "old-model", "invalid-time",
]);
export const dataIssueSchema = z.object({ code: issueCodeSchema, source: z.string().nullable(), detail: z.string() }).strict();
export const dataMetaSchema = z.object({
  schemaVersion: z.literal(POLICY.SCHEMA_VERSION),
  state: dataStateSchema,
  issues: z.array(dataIssueSchema),
  evaluatedAt: isoUtcSchema,
  fetchedAt: isoUtcSchema.nullable(),
  lastAttemptAt: isoUtcSchema.nullable(),
  validUntil: isoUtcSchema.nullable(),
  dataVersion: z.string().min(1).nullable(),
}).strict().superRefine((meta, ctx) => {
  if (meta.state !== "unavailable" && (!meta.fetchedAt || !meta.dataVersion)) {
    ctx.addIssue({ code: "custom", message: "Payload status requires fetchedAt and dataVersion" });
  }
  if (meta.fetchedAt && Date.parse(meta.fetchedAt) > Date.parse(meta.evaluatedAt)) {
    ctx.addIssue({ code: "custom", message: "Fetch time cannot be in the future" });
  }
  if (meta.state === "ok" && (!meta.validUntil || Date.parse(meta.validUntil) <= Date.parse(meta.evaluatedAt))) {
    ctx.addIssue({ code: "custom", message: "ok must have a future expiry" });
  }
});

export const hotspotRecordSchema = z.object({
  id: z.string().min(1), source: viirsSourceSchema,
  satellite: z.enum(["S-NPP", "NOAA-20", "NOAA-21"]),
  longitude: z.number().finite().min(-180).max(180), latitude: z.number().finite().min(-90).max(90),
  acquiredAt: isoUtcSchema, confidenceRaw: z.enum(["l", "n", "h"]),
  confidence: z.enum(["low", "nominal", "high"]),
  brightnessKelvin: z.number().finite().nonnegative().nullable(), frpMw: z.number().finite().nonnegative().nullable(),
}).strict().superRefine((record, ctx) => {
  const satellites = { VIIRS_SNPP_NRT: "S-NPP", VIIRS_NOAA20_NRT: "NOAA-20", VIIRS_NOAA21_NRT: "NOAA-21" } as const;
  const confidence = { l: "low", n: "nominal", h: "high" } as const;
  if (satellites[record.source] !== record.satellite || confidence[record.confidenceRaw] !== record.confidence) {
    ctx.addIssue({ code: "custom", message: "Source/satellite or raw/normalized confidence mismatch" });
  }
});

export const hourPm25Schema = z.object({
  validAt: isoUtcSchema, pm25UgM3: z.number().finite().nonnegative().nullable(),
}).strict();

export const aqiEstimateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unavailable"), reason: z.string().min(1) }).strict(),
  z.object({
    status: z.literal("available"), method: z.literal(POLICY.INDEX_METHOD),
    breakpointVersion: z.literal(POLICY.BREAKPOINT_VERSION), mean24hUgM3: z.number().finite().nonnegative(),
    truncatedUgM3: z.number().finite().nonnegative(), periodFrom: isoUtcSchema, periodTo: isoUtcSchema,
    sampleCount: z.literal(24), value: z.number().int().min(0).max(500).nullable(),
    category: aqiCategorySchema, beyondScale: z.boolean(),
  }).strict().superRefine((value, ctx) => {
    if (value.beyondScale !== (value.value === null) || (value.beyondScale && value.category !== "hazardous")) {
      ctx.addIssue({ code: "custom", message: "Invalid beyond-scale representation" });
    }
  }),
]);

export const airPayloadSchema = z.object({
  requestedLocation: locationSchema, queryLocation: locationSchema, modelGridLocation: locationSchema,
  source: z.literal("open-meteo-cams-global"), runAt: isoUtcSchema.nullable(),
  current: hourPm25Schema.nullable(), history: z.array(hourPm25Schema), forecast: z.array(hourPm25Schema),
  aqi: aqiEstimateSchema,
}).strict();

export function sourceResponseSchema<T extends z.ZodType>(payload: T) {
  return z.object({ meta: dataMetaSchema, data: payload.nullable() }).strict().superRefine((raw, ctx) => {
    const response = raw as unknown as { meta: DataMeta; data: unknown };
    if (response.meta.state === "unavailable" ? response.data !== null : response.data === null || response.data === undefined) {
      ctx.addIssue({ code: "custom", message: "Unavailable requires null data; other states require a payload" });
    }
  });
}

export type DataState = z.infer<typeof dataStateSchema>;
export type Audience = z.infer<typeof audienceSchema>;
export type AqiCategory = z.infer<typeof aqiCategorySchema>;
export type DataMeta = z.infer<typeof dataMetaSchema>;
export type DataIssue = z.infer<typeof dataIssueSchema>;
export type HotspotRecord = z.infer<typeof hotspotRecordSchema>;
export type HourPm25 = z.infer<typeof hourPm25Schema>;
export type AqiEstimate = z.infer<typeof aqiEstimateSchema>;
export type AirPayload = z.infer<typeof airPayloadSchema>;
export type Location = z.infer<typeof locationSchema>;

export const hotspotFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]) }).strict(),
  properties: z.object(hotspotRecordSchema.shape).omit({ longitude: true, latitude: true }).strict(),
}).strict().superRefine((feature, ctx) => {
  if (!hotspotRecordSchema.safeParse({ ...feature.properties, longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1] }).success) {
    ctx.addIssue({ code: "custom", message: "Invalid hotspot feature properties" });
  }
});
export const hotspotCoverageSchema = z.object({
  requestedFrom: isoUtcSchema, requestedTo: isoUtcSchema, asOf: isoUtcSchema,
  completedSources: z.array(viirsSourceSchema), missingSources: z.array(viirsSourceSchema),
  boundaryVersion: z.string().min(1), latestDetectionAt: isoUtcSchema.nullable(),
}).strict().superRefine((value, ctx) => {
  const sources = [...value.completedSources, ...value.missingSources];
  if (sources.length !== POLICY.HOTSPOT_SOURCES.length || new Set(sources).size !== sources.length || Date.parse(value.requestedFrom) >= Date.parse(value.requestedTo) || value.asOf !== value.requestedTo) {
    ctx.addIssue({ code: "custom", message: "Invalid hotspot coverage partition or interval" });
  }
});
export const hotspotPayloadSchema = z.object({
  type: z.literal("FeatureCollection"), features: z.array(hotspotFeatureSchema), coverage: hotspotCoverageSchema,
  summary: z.object({ detectionsCount: z.number().int().nonnegative(), areaLabel: z.string().min(1) }).strict(),
}).strict().superRefine((value, ctx) => {
  const ids = value.features.map(feature => feature.properties.id);
  const times = value.features.map(feature => Date.parse(feature.properties.acquiredAt));
  const latest = times.length ? new Date(times.reduce((max, time) => Math.max(max, time), -Infinity)).toISOString() : null;
  const coverageLatest = value.coverage.latestDetectionAt;
  if (ids.length !== new Set(ids).size || value.summary.detectionsCount !== ids.length || (latest && (!coverageLatest || Date.parse(coverageLatest) < Date.parse(latest))) || (coverageLatest && (Date.parse(coverageLatest) <= Date.parse(value.coverage.requestedFrom) || Date.parse(coverageLatest) > Date.parse(value.coverage.requestedTo))) || times.some(time => time <= Date.parse(value.coverage.requestedFrom) || time > Date.parse(value.coverage.requestedTo))) {
    ctx.addIssue({ code: "custom", message: "Hotspot count, timestamps or identities inconsistent" });
  }
});
export type ViirsSource = z.infer<typeof viirsSourceSchema>;
export type HotspotPayload = z.infer<typeof hotspotPayloadSchema>;
