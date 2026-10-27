import { describe, expect, it } from "vitest";
import { estimateAqi } from "@/lib/aqi";
import { aqiEstimateSchema } from "@/lib/contracts";
import { syntheticPm25, SYNTHETIC_NOW } from "../fixtures/provider-scenarios";

describe("PM2.5 model index", () => {
  it.each([[0,0], [9,50], [9.1,51], [35.4,100], [35.5,101], [55.4,150], [55.5,151], [125.4,200], [125.5,201], [225.4,300], [225.5,301], [325.4,500], [22,75], [9.09,50]])("concentration %s gives index %s", (value, expected) => {
    const result = estimateAqi(syntheticPm25(value!), SYNTHETIC_NOW);
    expect(aqiEstimateSchema.safeParse(result).success).toBe(true);
    expect(result.status).toBe("available");
    if (result.status === "available") expect(result.value).toBe(expected);
  });
  it("requires every hour rather than replacing missing readings with zero", () => {
    expect(estimateAqi(syntheticPm25(22).slice(1), SYNTHETIC_NOW).status).toBe("unavailable");
    expect(estimateAqi(syntheticPm25(null), SYNTHETIC_NOW).status).toBe("unavailable");
  });
  it.each([-1, NaN, Infinity])("rejects invalid input %s", value => expect(estimateAqi(syntheticPm25(value), SYNTHETIC_NOW).status).toBe("unavailable"));
  it("does not extrapolate beyond 500", () => {
    expect(estimateAqi(syntheticPm25(325.5), SYNTHETIC_NOW)).toMatchObject({ status: "available", value: null, beyondScale: true, category: "hazardous" });
  });
  it("keeps finite large values representable without an invented numeric index", () => {
    const result = estimateAqi(syntheticPm25(Number.MAX_VALUE), SYNTHETIC_NOW);
    expect(aqiEstimateSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({ status: "available", value: null, beyondScale: true });
  });
  it("rejects duplicate hours and updates its required period on hour change", () => {
    const data = syntheticPm25(22);
    expect(estimateAqi([...data, data[0]!], SYNTHETIC_NOW).status).toBe("unavailable");
    expect(estimateAqi(data, new Date("2026-10-27T14:00:00Z")).status).toBe("unavailable");
  });
  it("uses 24-hour mean rather than the instantaneous last sample", () => {
    const data = syntheticPm25(10);
    data[23] = { ...data[23]!, pm25UgM3: 250 };
    const result = estimateAqi(data, SYNTHETIC_NOW);
    expect(result).toMatchObject({ status: "available", mean24hUgM3: 20 });
    if (result.status === "available") expect(result.category).toBe("moderate");
  });
});
