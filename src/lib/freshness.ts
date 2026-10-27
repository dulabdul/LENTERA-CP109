import { dataMetaSchema, type DataIssue, type DataMeta } from "./contracts";
import { HOUR_MS, MINUTE_MS, POLICY } from "./policy";
import { parseUtc } from "./time";

export interface FreshnessInput {
  kind: "hotspots" | "air";
  now: Date;
  fetchedAt: string | null;
  dataVersion: string | null;
  hasPayload: boolean;
  hasCurrentSample?: boolean;
  runAt?: string | null;
  lastAttemptAt?: string | null;
  latestAttemptFailed?: boolean;
  issues?: DataIssue[];
}

export function evaluateFreshness(input: FreshnessInput): DataMeta {
  const now = input.now.getTime();
  if (!Number.isFinite(now)) throw new Error("Invalid evaluation time");
  const issues: DataIssue[] = [...(input.issues ?? [])];
  const add = (code: DataIssue["code"], detail: string) => { issues.push({ code, source: input.kind, detail }); };
  let fetched: number | null = null;
  let run: number | null = null;
  try {
    if (input.fetchedAt) fetched = parseUtc(input.fetchedAt);
    if (input.runAt) run = parseUtc(input.runAt);
    if ((fetched !== null && fetched > now) || (run !== null && run > now)) throw new Error("Future source timestamp");
  } catch { add("invalid-time", "Waktu sumber tidak valid."); }
  const invalidTime = issues.some(issue => issue.code === "invalid-time");
  const unavailable = !input.hasPayload || fetched === null || !input.dataVersion || invalidTime || (input.kind === "air" && input.hasCurrentSample === false);
  const maxAge = (input.kind === "hotspots" ? POLICY.HOTSPOT_MAX_FALLBACK_HOURS : POLICY.AIR_MAX_FALLBACK_HOURS) * HOUR_MS;
  const freshAge = (input.kind === "hotspots" ? POLICY.HOTSPOT_FRESH_MINUTES : POLICY.AIR_CACHE_MINUTES) * MINUTE_MS;
  if (unavailable || (fetched !== null && now - fetched >= maxAge)) {
    if (!unavailable) add("expired", "Data melewati batas umur penayangan.");
    return dataMetaSchema.parse({ schemaVersion: POLICY.SCHEMA_VERSION, state: "unavailable", issues, evaluatedAt: input.now.toISOString(), fetchedAt: invalidTime ? null : input.fetchedAt, lastAttemptAt: input.lastAttemptAt ?? null, validUntil: null, dataVersion: input.dataVersion });
  }
  let deadline = fetched! + freshAge;
  if (input.kind === "air" && run !== null) deadline = Math.min(deadline, run + POLICY.AIR_MAX_KNOWN_MODEL_AGE_HOURS * HOUR_MS);
  const oldModel = run !== null && now - run >= POLICY.AIR_MAX_KNOWN_MODEL_AGE_HOURS * HOUR_MS;
  if (oldModel) add("old-model", "Run model melewati kebijakan kesegaran.");
  if (input.latestAttemptFailed) add("fallback", "Memakai data terakhir setelah pengambilan terbaru gagal.");
  const stale = now >= deadline || !!input.latestAttemptFailed;
  if (now >= deadline && !oldModel) add("expired", "Data melewati batas kesegaran.");
  return dataMetaSchema.parse({
    schemaVersion: POLICY.SCHEMA_VERSION, state: stale ? "stale" : issues.length ? "partial" : "ok", issues,
    evaluatedAt: input.now.toISOString(), fetchedAt: input.fetchedAt, lastAttemptAt: input.lastAttemptAt ?? null,
    validUntil: new Date(deadline).toISOString(), dataVersion: input.dataVersion,
  });
}
