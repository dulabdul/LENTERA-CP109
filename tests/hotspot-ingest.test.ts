import { describe, expect, it } from "vitest";
import { syntheticEmptyCsv, syntheticInvalidCsv, syntheticViirsCsv, SYNTHETIC_NOW } from "../fixtures/provider-scenarios";
import { buildFirmsUrl, createFirmsFetcher, parseFirmsCsv, type FirmsBatch } from "../src/lib/providers/firms";
import { collectHotspots } from "../src/lib/services/hotspot-ingest";
const batch: FirmsBatch = { source: "VIIRS_SNPP_NRT", startDate: "2026-10-25", days: 3 };
const parse = (text: string) => parseFirmsCsv(text, batch);
const csvFor = (source: FirmsBatch["source"], body = syntheticViirsCsv) => body.replace(/,N,/g, `,${source === "VIIRS_SNPP_NRT" ? "N" : source === "VIIRS_NOAA20_NRT" ? "N20" : "N21"},`);

describe("NASA CSV normalization (all detections synthetic)", () => {
  it("converts UTC HHMM and VIIRS categories without inventing nullable measurements", () => {
    const record = parse(syntheticViirsCsv).records[0]!;
    expect(record).toMatchObject({ acquiredAt: "2026-10-27T13:00:00.000Z", satellite: "S-NPP", confidence: "nominal", brightnessKelvin: 330.2, frpMw: 2.5 });
    expect(parse(syntheticViirsCsv.replace("330.2", "").replace("2.5", "")).records[0]).toMatchObject({ brightnessKelvin: null, frpMw: null });
    expect(parse(syntheticViirsCsv.replace("1300", "1")).records[0]!.acquiredAt).toBe("2026-10-27T00:01:00.000Z");
  });
  it("distinguishes valid zero from error bodies", () => {
    expect(parse(syntheticEmptyCsv)).toEqual({ records: [], invalidRows: 0 });
    expect(() => parse(syntheticInvalidCsv)).toThrow("tidak valid");
    expect(() => parse("<html>Error</html>")).toThrow();
  });
  it("accepts BOM, CRLF, quoting and harmless extra columns", () => {
    expect(parse('\uFEFF' + syntheticViirsCsv.replace(/\n/g, '\r\n').replace('0.51', '"0.51"')).records).toHaveLength(1);
    expect(parse(syntheticViirsCsv.replace('frp\n', 'frp,note\n').replace('2.5\n','2.5,"a,b ""c"""\n')).records).toHaveLength(1);
  });
  it.each(["confidence,confidence", 'latitude,longitude\n', syntheticViirsCsv.replace('0.51', '"0.51'), syntheticViirsCsv.replace('0.51','"0.51"x')])("rejects invalid headers or malformed quoting", input => expect(() => parse(input)).toThrow());
  it.each([
    ["1300", "2460"], ["2026-10-27", "2026-02-30"], [",n,", ",medium,"], ["0.51", "NaN"], ["0.51", "91"],
    ["101.45", "Infinity"], ["330.2", "-1"], ["2.5", "-1"], [",N,", ",N20,"],
  ])("rejects invalid material fields %s -> %s", (from, to) => expect(() => parse(syntheticViirsCsv.replace(from, to))).toThrow());
  it("retains valid rows and counts rejected rows", () => {
    const bad = syntheticViirsCsv.split('\n')[1]!.replace(',n,',',unknown,');
    expect(parse(syntheticViirsCsv + bad + '\n')).toMatchObject({ records: [{ confidence: "nominal" }], invalidRows: 1 });
  });
  it("invalidates the entire response on outside-calendar dates, including mixed rows", () => {
    expect(() => parse(syntheticViirsCsv + syntheticViirsCsv.split('\n')[1]!.replace('2026-10-27','2026-10-20'))).toThrow();
  });
  it("creates stable IDs for numeric equivalents but keeps satellite/time differences", () => {
    const id = parse(syntheticViirsCsv).records[0]!.id;
    expect(parse(syntheticViirsCsv.replace('101.45','101.45000')).records[0]!.id).toBe(id);
    expect(parse(syntheticViirsCsv.replace('1300','1301')).records[0]!.id).not.toBe(id);
    expect(parseFirmsCsv(csvFor('VIIRS_NOAA20_NRT'), { ...batch, source: 'VIIRS_NOAA20_NRT' }).records[0]!.id).not.toBe(id);
  });
});

describe("FIRMS HTTP adapter with injected network", () => {
  it("uses exact bbox/source/date and five-day limits", () => {
    expect(buildFirmsUrl('synthetic_key', batch)).toBe('https://firms.modaps.eosdis.nasa.gov/api/area/csv/synthetic_key/VIIRS_SNPP_NRT/94.5,-11.2,141.5,6.5/3/2026-10-25');
    expect(() => buildFirmsUrl('synthetic', { ...batch, days: 6 })).toThrow();
  });
  it("retries once and honors Retry-After for temporary failures", async () => {
    const waits: number[] = []; let calls = 0;
    const fetcher = createFirmsFetcher('synthetic', { fetch: async () => ++calls === 1 ? new Response('', { status: 429, headers: { 'retry-after': '2' } }) : new Response(syntheticEmptyCsv), sleep: async ms => { waits.push(ms); } });
    expect((await fetcher(batch)).records).toHaveLength(0);
    expect(calls).toBe(2); expect(waits).toEqual([2000]);
  });
  it("defers long Retry-After, does not retry permanent or malformed responses, redacts failures", async () => {
    for (const response of [new Response('', { status: 429, headers: { 'retry-after': '120' } }), new Response('secret upstream text', { status: 403 }), new Response('Invalid secret MAP_KEY')]) {
      let calls = 0;
      await expect(createFirmsFetcher('synthetic', { fetch: async () => { calls++; return response; } })(batch)).rejects.not.toThrow('secret');
      expect(calls).toBe(1);
    }
  });
  it("retries network failures at most twice without exposing URL/key", async () => {
    let calls = 0;
    await expect(createFirmsFetcher('synthetic_key', { fetch: async () => { calls++; throw new Error('secret url'); }, sleep: async () => {} })(batch)).rejects.toThrow('Pengambilan NASA FIRMS gagal.');
    expect(calls).toBe(2);
  });
});

describe("seven-day national snapshot collection", () => {
  const mockBatch = async (request: FirmsBatch) => parseFirmsCsv(request.startDate === '2026-10-25' ? csvFor(request.source) : syntheticEmptyCsv, request);
  it("covers eight calendar dates in six requests, preserves cross-satellite detections", async () => {
    const result = await collectHotspots(SYNTHETIC_NOW, mockBatch);
    expect(result.batches.map(b => b.days)).toEqual([5,3,5,3,5,3]);
    expect(result.payload?.summary.detectionsCount).toBe(3);
    expect(result.payload?.coverage.completedSources).toHaveLength(3);
    expect(result.issues).toEqual([]);
    expect(result.payload?.coverage.boundaryVersion).toContain('natural-earth-5.1.1:');
  });
  it("deduplicates identical rows and masks foreign points within fetch bbox", async () => {
    const result = await collectHotspots(SYNTHETIC_NOW, async request => {
      const parsed = await mockBatch(request);
      return { ...parsed, records: parsed.records.flatMap(record => [record, record, { ...record, id: record.id+'foreign', latitude: 3.14, longitude: 101.69 }]) };
    });
    expect(result.payload?.summary.detectionsCount).toBe(3);
  });
  it("marks missing calendar batches and invalid rows partial, never complete zero", async () => {
    const result = await collectHotspots(SYNTHETIC_NOW, async request => {
      if (request.source === 'VIIRS_NOAA20_NRT') throw new Error('private token');
      const parsed = await mockBatch(request); return { ...parsed, invalidRows: 1 };
    });
    expect(result.payload?.coverage.completedSources).toEqual([]);
    expect(result.payload?.coverage.missingSources).toHaveLength(3);
    expect(result.issues.some(issue => issue.code === 'invalid-response')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private token');
  });
  it("does not create a replacement snapshot if all batches fail", async () => {
    expect((await collectHotspots(SYNTHETIC_NOW, async () => { throw new Error(); })).payload).toBeNull();
  });
  it("accepts a complete zero and excludes left boundary while including right boundary", async () => {
    expect((await collectHotspots(SYNTHETIC_NOW, async () => ({ records: [], invalidRows: 0 }))).payload?.summary.detectionsCount).toBe(0);
    const result = await collectHotspots(SYNTHETIC_NOW, async request => {
      const parsed = await mockBatch(request);
      return { ...parsed, records: parsed.records.flatMap(record => [{ ...record, acquiredAt: '2026-10-20T13:30:00.000Z', id: record.id+'left' }, { ...record, acquiredAt: SYNTHETIC_NOW.toISOString(), id: record.id+'right' }]) };
    });
    expect(result.payload?.summary.detectionsCount).toBe(3);
  });
  it("rejects future detections without refreshing them into a fresh dataset", async () => {
    const result = await collectHotspots(SYNTHETIC_NOW, async request => {
      const parsed = await mockBatch(request);
      return { ...parsed, records: parsed.records.map(record => ({ ...record, acquiredAt: '2026-10-27T14:00:00.000Z' })) };
    });
    expect(result.payload?.coverage.missingSources).toHaveLength(3);
  });
});
