import { describe, expect, it } from "vitest";
import { evaluateActions } from "@/lib/actions";
import { estimateAqi } from "@/lib/aqi";
import { dataMetaSchema, hotspotRecordSchema, sourceResponseSchema, locationSchema, audienceSchema } from "@/lib/contracts";
import { evaluateFreshness } from "@/lib/freshness";
import { readEnvironment } from "@/lib/env";
import { SYNTHETIC_NOW, syntheticPm25 } from "../fixtures/provider-scenarios";

const meta = evaluateFreshness({ kind: "air", now: SYNTHETIC_NOW, fetchedAt: "2026-10-27T13:00:00Z", dataVersion: "synthetic-v1", hasPayload: true });
const input = { now: SYNTHETIC_NOW, meta, location: { lat: .51, lon: 101.45 }, audience: "general" as const, aqi: estimateAqi(syntheticPm25(22), SYNTHETIC_NOW) };

describe("action rules and public contract invariants", () => {
  for (const concentration of [0, 10, 40, 70, 150, 250, 400]) {
    it.each(["general", "sensitive", "outdoor"] as const)(`emits traceable, bounded advice for ${concentration} and %s`, audience => {
      const result = evaluateActions({ ...input, audience, aqi: estimateAqi(syntheticPm25(concentration), SYNTHETIC_NOW) });
      expect(result.mode).toBe("targeted");
      expect(result.basisDataVersion).toBe(meta.dataVersion);
      expect(result.ruleId).toContain(audience);
      expect(result.sourceUrls[0]).toMatch(/^https:\/\/www.airnow.gov\//);
      expect(result.validUntil).toBe("2026-10-27T14:00:00.000Z");
    });
  }
  it.each(["stale", "partial", "unavailable"] as const)("suppresses targeted advice for %s", state => expect(evaluateActions({ ...input, meta: { ...meta, state } }).mode).toBe("limited"));
  it("suppresses missing index and expired period", () => {
    expect(evaluateActions({ ...input, aqi: { status: "unavailable", reason: "missing-hour" } }).mode).toBe("limited");
    expect(evaluateActions({ ...input, now: new Date("2026-10-27T14:00:00Z") }).mode).toBe("limited");
  });
  it("rejects data advertised as ok after its deadline", () => {
    expect(dataMetaSchema.safeParse({ ...meta, evaluatedAt: meta.validUntil }).success).toBe(false);
  });
  it("rejects null payload disguised as a successful source", () => {
    expect(sourceResponseSchema(locationSchema).safeParse({ meta, data: null }).success).toBe(false);
    expect(sourceResponseSchema(locationSchema).safeParse({ meta: { ...meta, state: "unavailable" }, data: input.location }).success).toBe(false);
  });
  it("rejects unknown audience and falsely normalized confidence", () => {
    expect(audienceSchema.safeParse("any").success).toBe(false);
    expect(hotspotRecordSchema.safeParse({ id: "synthetic", source: "VIIRS_SNPP_NRT", satellite: "NOAA-20", longitude: 101.45, latitude: .51, acquiredAt: "2026-10-27T13:00:00Z", confidenceRaw: "h", confidence: "nominal", brightnessKelvin: null, frpMw: null }).success).toBe(false);
  });
  it("allows absent provider access without claiming connectivity", () => {
    expect(readEnvironment({}).readiness).toMatchObject({ firms: "not-configured", r2: "not-configured", rateLimiter: "not-configured" });
    expect(() => readEnvironment({ R2_BUCKET: "synthetic-only" })).toThrow();
    expect(() => readEnvironment({ R2_ENDPOINT: "http://user:secret@invalid.test" })).toThrow();
  });
});
