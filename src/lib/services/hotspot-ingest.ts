import "server-only";
import { hotspotPayloadSchema, type DataIssue, type HotspotPayload, type HotspotRecord } from "../contracts";
import { geographyManifest, pointInIndonesia } from "../geography";
import { HOUR_MS, POLICY } from "../policy";
import { FirmsError, type FirmsBatch } from "../providers/firms";
import { calendarBatches, withinWindow } from "../time";

export interface BatchResult extends FirmsBatch { status: "complete" | "partial" | "failed"; invalidRows: number; recordsCount: number }
export interface IngestResult { payload: HotspotPayload | null; issues: DataIssue[]; batches: BatchResult[] }
export async function collectHotspots(now: Date, fetchBatch: (batch: FirmsBatch) => Promise<{ records: HotspotRecord[]; invalidRows: number }>): Promise<IngestResult> {
  const batches: BatchResult[] = [], issues: DataIssue[] = [], unique = new Map<string, HotspotRecord>();
  for (const source of POLICY.HOTSPOT_SOURCES) {
    for (const dates of calendarBatches(now)) {
      const batch = { source, ...dates };
      try {
        const result = await fetchBatch(batch);
        if (result.records.some(record => Date.parse(record.acquiredAt) > now.getTime())) throw new FirmsError("invalid-response");
        batches.push({ ...batch, status: result.invalidRows ? "partial" : "complete", invalidRows: result.invalidRows, recordsCount: result.records.length });
        if (result.invalidRows) issues.push({ code: "invalid-response", source, detail: `${batch.startDate}: ${result.invalidRows} baris tidak valid dikeluarkan.` });
        for (const record of result.records) {
          if (withinWindow(record.acquiredAt, now, 168) && pointInIndonesia({ lat: record.latitude, lon: record.longitude })) unique.set(record.id, record);
        }
      } catch (error) {
        batches.push({ ...batch, status: "failed", invalidRows: 0, recordsCount: 0 });
        issues.push({ code: error instanceof FirmsError ? error.code : "upstream-error", source, detail: `${batch.startDate}: batch ${batch.days} hari tidak tersedia.` });
      }
    }
  }
  const completedSources = POLICY.HOTSPOT_SOURCES.filter(source => batches.filter(batch => batch.source === source).every(batch => batch.status === "complete"));
  const missingSources = POLICY.HOTSPOT_SOURCES.filter(source => !completedSources.includes(source));
  for (const source of missingSources) issues.push({ code: "missing-source", source, detail: "Cakupan sumber/tanggal belum lengkap; lihat provenance batch." });
  if (batches.every(batch => batch.status === "failed")) return { payload: null, issues, batches };
  const records = [...unique.values()].sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt) || a.id.localeCompare(b.id));
  const payload = hotspotPayloadSchema.parse({
    type: "FeatureCollection", features: records.map(({ longitude, latitude, ...properties }) => ({ type: "Feature", geometry: { type: "Point", coordinates: [longitude, latitude] }, properties })),
    coverage: { requestedFrom: new Date(now.getTime() - POLICY.HOTSPOT_WINDOW_HOURS * HOUR_MS).toISOString(), requestedTo: now.toISOString(), asOf: now.toISOString(), completedSources, missingSources, boundaryVersion: `natural-earth-${geographyManifest.country.version}:${geographyManifest.country.outputSha256}`, latestDetectionAt: records.at(-1)?.acquiredAt ?? null },
    summary: { detectionsCount: records.length, areaLabel: "Indonesia — batas indikatif Natural Earth" },
  });
  return { payload, issues, batches };
}
