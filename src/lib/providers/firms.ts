import "server-only";
import { createHash } from "node:crypto";
import { hotspotRecordSchema, type HotspotRecord, type ViirsSource } from "../contracts";
import { HOUR_MS, POLICY } from "../policy";
import { parseUtc } from "../time";

export interface FirmsBatch { source: ViirsSource; startDate: string; days: number }
export class FirmsError extends Error {
  constructor(public readonly code: "upstream-error" | "invalid-response", public readonly retryable = false, public readonly retryAfterMs = 0) {
    super(code === "upstream-error" ? "Pengambilan NASA FIRMS gagal." : "Respons NASA FIRMS tidak valid.");
  }
}
const satellites = { VIIRS_SNPP_NRT: "S-NPP", VIIRS_NOAA20_NRT: "NOAA-20", VIIRS_NOAA21_NRT: "NOAA-21" } as const;
const aliases = { VIIRS_SNPP_NRT: ["N", "S-NPP", "SNPP"], VIIRS_NOAA20_NRT: ["N20", "NOAA-20"], VIIRS_NOAA21_NRT: ["N21", "NOAA-21"] } as const;
export function detectionId(record: Pick<HotspotRecord, "source" | "satellite" | "acquiredAt" | "latitude" | "longitude">) {
  return createHash("sha256").update(JSON.stringify([record.source, record.satellite, record.acquiredAt, record.longitude, record.latitude])).digest("hex");
}
// Strict CSV scanner: escaped quotes, CRLF and quoted fields; malformed quoting fails closed.
function csvRows(text: string): string[][] {
  if (Buffer.byteLength(text) > 40 * 1024 * 1024) throw new FirmsError("invalid-response");
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false, closed = false;
  const input = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
    } else if (ch === ',' || ch === '\n') {
      row.push(field); field = ""; closed = false;
      if (ch === '\n') { if (row.some(cell => cell.trim())) rows.push(row); row = []; }
    } else if (ch === '"' && field === "" && !closed) quoted = true;
    else { if (closed || ch === '"' || ch === '\r') throw new FirmsError("invalid-response"); field += ch; }
  }
  if (quoted) throw new FirmsError("invalid-response");
  row.push(field); if (row.some(cell => cell.trim())) rows.push(row);
  return rows;
}
function numeric(value: string): number {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) throw new Error("Invalid numeric cell");
  const number = Number(value); if (!Number.isFinite(number)) throw new Error("Non-finite cell"); return number;
}
export function parseFirmsCsv(text: string, batch: FirmsBatch): { records: HotspotRecord[]; invalidRows: number } {
  if (!POLICY.HOTSPOT_SOURCES.includes(batch.source) || !Number.isInteger(batch.days) || batch.days < 1 || batch.days > POLICY.FIRMS_MAX_DAYS_PER_QUERY) throw new FirmsError("invalid-response");
  const from = parseUtc(`${batch.startDate}T00:00:00.000Z`), to = from + batch.days * 24 * HOUR_MS;
  const rows = csvRows(text), header = rows.shift()?.map(cell => cell.trim());
  const required = ["latitude", "longitude", "acq_date", "acq_time", "satellite", "confidence"];
  if (!header || new Set(header).size !== header.length || required.some(name => !header.includes(name))) throw new FirmsError("invalid-response");
  const records: HotspotRecord[] = []; let invalidRows = 0;
  for (const cells of rows) {
    const values = Object.fromEntries(header.map((name, index) => [name, cells[index]?.trim() ?? ""]));
    let acquiredAt: string;
    try {
      if (!/^\d{1,4}$/.test(values.acq_time!) || !/^\d{4}-\d{2}-\d{2}$/.test(values.acq_date!)) throw new Error();
      const hhmm = values.acq_time!.padStart(4, "0");
      if (Number(hhmm.slice(0, 2)) > 23 || Number(hhmm.slice(2)) > 59) throw new Error();
      acquiredAt = new Date(parseUtc(`${values.acq_date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00.000Z`)).toISOString();
    } catch { invalidRows++; continue; }
    // A valid timestamp outside requested calendar dates invalidates the entire response (T08).
    if (Date.parse(acquiredAt) < from || Date.parse(acquiredAt) >= to) throw new FirmsError("invalid-response");
    try {
      if (cells.length !== header.length || !(aliases[batch.source] as readonly string[]).includes(values.satellite!)) throw new Error();
      const raw = values.confidence!;
      if (raw !== "l" && raw !== "n" && raw !== "h") throw new Error();
      const optional = (name: string) => !values[name] ? null : numeric(values[name]!);
      const base = {
        source: batch.source, satellite: satellites[batch.source], longitude: numeric(values.longitude!), latitude: numeric(values.latitude!),
        acquiredAt, confidenceRaw: raw, confidence: ({ l: "low", n: "nominal", h: "high" } as const)[raw],
        brightnessKelvin: optional("bright_ti4"), frpMw: optional("frp"),
      };
      records.push(hotspotRecordSchema.parse({ ...base, id: detectionId(base) }));
    } catch { invalidRows++; }
  }
  if (rows.length && !records.length) throw new FirmsError("invalid-response");
  return { records, invalidRows };
}
export function buildFirmsUrl(key: string, batch: FirmsBatch): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(key) || !POLICY.HOTSPOT_SOURCES.includes(batch.source) || batch.days < 1 || batch.days > 5 || !Number.isInteger(batch.days)) throw new FirmsError("invalid-response");
  parseUtc(`${batch.startDate}T00:00:00.000Z`);
  return `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${batch.source}/${POLICY.INDONESIA_FETCH_BBOX.join(",")}/${batch.days}/${batch.startDate}`;
}
export function createFirmsFetcher(key: string, options: { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number } = {}) {
  const request = options.fetch ?? fetch, sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  return async (batch: FirmsBatch) => {
    const url = buildFirmsUrl(key, batch);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await request(url, { signal: AbortSignal.timeout(POLICY.UPSTREAM_TIMEOUT_SECONDS * 1000), redirect: "error", cache: "no-store" });
        if (!response.ok) {
          const header = response.headers.get("retry-after"), now = (options.now ?? Date.now)();
          const delay = header ? (/^\d+$/.test(header) ? Number(header) * 1000 : Math.max(0, Date.parse(header) - now)) : 1000;
          throw new FirmsError("upstream-error", response.status === 429 || response.status >= 500, Number.isFinite(delay) ? delay : 1000);
        }
        const length = Number(response.headers.get("content-length"));
        if (length > 40 * 1024 * 1024) throw new FirmsError("invalid-response");
        const reader = response.body?.getReader(); if (!reader) throw new FirmsError("invalid-response");
        const chunks: Uint8Array[] = []; let bytes = 0;
        try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 40 * 1024 * 1024) throw new FirmsError("invalid-response"); chunks.push(part.value); } }
        finally { await reader.cancel().catch(() => {}); }
        return parseFirmsCsv(Buffer.concat(chunks).toString("utf8"), batch);
      } catch (error) {
        const safe = error instanceof FirmsError ? error : new FirmsError("upstream-error", true, 1000);
        // Long Retry-After is deferred to the next run rather than retrying before the provider permits it.
        if (attempt === 1 || !safe.retryable || safe.retryAfterMs > 20_000) throw safe;
        await sleep(safe.retryAfterMs);
      }
    }
    throw new FirmsError("upstream-error");
  };
}
