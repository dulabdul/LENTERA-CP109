import { describe, expect, it } from "vitest";
import { calendarBatches, parseUtc, withinWindow } from "@/lib/time";
import { evaluateFreshness } from "@/lib/freshness";
import { SYNTHETIC_NOW } from "../fixtures/provider-scenarios";

describe("time and data freshness", () => {
  it.each([24, 48, 168] as const)("applies exclusive start/inclusive end for %s hours", hours => {
    const left = new Date(SYNTHETIC_NOW.getTime() - hours * 3_600_000);
    expect(withinWindow(left.toISOString(), SYNTHETIC_NOW, hours)).toBe(false);
    expect(withinWindow(new Date(left.getTime()+1).toISOString(), SYNTHETIC_NOW, hours)).toBe(true);
    expect(withinWindow(SYNTHETIC_NOW.toISOString(), SYNTHETIC_NOW, hours)).toBe(true);
    expect(withinWindow(new Date(SYNTHETIC_NOW.getTime()+1).toISOString(), SYNTHETIC_NOW, hours)).toBe(false);
  });
  it("covers eight UTC dates and splits at five days", () => {
    expect(calendarBatches(SYNTHETIC_NOW)).toEqual([{ startDate: "2026-10-20", days: 5 }, { startDate: "2026-10-25", days: 3 }]);
  });
  it("handles a year boundary and rejects calendar/timezone ambiguity", () => {
    expect(calendarBatches(new Date("2027-01-01T00:00:00Z"), 24)).toEqual([{ startDate: "2026-12-31", days: 2 }]);
    expect(() => parseUtc("2026-02-30T13:00:00Z")).toThrow();
    expect(() => parseUtc("2026-10-27T13:00:00+07:00")).toThrow();
  });
  const basis = { kind: "hotspots" as const, now: SYNTHETIC_NOW, fetchedAt: "2026-10-27T13:00:00Z", dataVersion: "synthetic-v1", hasPayload: true };
  it("does not infer source failure just because there are no detections", () => expect(evaluateFreshness(basis).state).toBe("ok"));
  it("changes state exactly at freshness and maximum age thresholds", () => {
    expect(evaluateFreshness({ ...basis, fetchedAt: "2026-10-27T12:00:00Z" }).state).toBe("stale");
    expect(evaluateFreshness({ ...basis, fetchedAt: "2026-10-26T13:30:00Z" }).state).toBe("unavailable");
  });
  it("keeps partial coverage separate from fallback and unavailable", () => {
    const issues = [{ code: "missing-source" as const, source: "VIIRS_NOAA21_NRT", detail: "Synthetic missing source" }];
    expect(evaluateFreshness({ ...basis, issues }).state).toBe("partial");
    expect(evaluateFreshness({ ...basis, issues, latestAttemptFailed: true }).state).toBe("stale");
    expect(evaluateFreshness({ ...basis, hasPayload: false }).state).toBe("unavailable");
  });
  it("applies air cache/model deadlines without inventing a model run", () => {
    expect(evaluateFreshness({ ...basis, kind: "air", runAt: null }).state).toBe("ok");
    expect(evaluateFreshness({ ...basis, kind: "air", fetchedAt: "2026-10-27T12:30:00Z" }).state).toBe("stale");
    expect(evaluateFreshness({ ...basis, kind: "air", runAt: "2026-10-26T01:30:00Z" }).state).toBe("stale");
    expect(evaluateFreshness({ ...basis, kind: "air", fetchedAt: "2026-10-27T07:30:00Z" }).state).toBe("unavailable");
    expect(evaluateFreshness({ ...basis, kind: "air", hasCurrentSample: false }).state).toBe("unavailable");
  });
  it("rejects a future fetch timestamp", () => expect(evaluateFreshness({ ...basis, fetchedAt: "2026-10-28T00:00:00Z" }).state).toBe("unavailable"));
});
