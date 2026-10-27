import type { AqiCategory, AqiEstimate, HourPm25 } from "./contracts";
import { HOUR_MS, POLICY } from "./policy";
import { currentHour, parseUtc } from "./time";

export const PM25_BREAKPOINTS: ReadonlyArray<{ lo10: number; hi10: number; indexLo: number; indexHi: number; category: AqiCategory }> = [
  { lo10: 0, hi10: 90, indexLo: 0, indexHi: 50, category: "good" },
  { lo10: 91, hi10: 354, indexLo: 51, indexHi: 100, category: "moderate" },
  { lo10: 355, hi10: 554, indexLo: 101, indexHi: 150, category: "sensitive" },
  { lo10: 555, hi10: 1254, indexLo: 151, indexHi: 200, category: "unhealthy" },
  { lo10: 1255, hi10: 2254, indexLo: 201, indexHi: 300, category: "very_unhealthy" },
  { lo10: 2255, hi10: 3254, indexLo: 301, indexHi: 500, category: "hazardous" },
];

// Sum decimal inputs as rationals, avoiding binary floating-point transitions
// such as a mathematically exact 9.1 becoming 9.099999... after averaging.
function decimalRational(value: number): { numerator: bigint; denominator: bigint } {
  const [mantissa = "0", exponent = "0"] = value.toString().toLowerCase().split("e");
  const [integer = "0", fraction = ""] = mantissa.split(".");
  const power = Number(exponent) - fraction.length;
  const digits = BigInt(integer + fraction);
  return power >= 0
    ? { numerator: digits * 10n ** BigInt(power), denominator: 1n }
    : { numerator: digits, denominator: 10n ** BigInt(-power) };
}

export function estimateAqi(series: HourPm25[], now: Date): AqiEstimate {
  const end = currentHour(now);
  const start = end - (POLICY.INDEX_WINDOW_SAMPLES - 1) * HOUR_MS;
  const byHour = new Map<number, number>();
  for (const sample of series) {
    let time: number;
    try { time = parseUtc(sample.validAt); } catch { return { status: "unavailable", reason: "invalid-time" }; }
    if (time < start || time > end) continue;
    if (time % HOUR_MS !== 0 || byHour.has(time)) return { status: "unavailable", reason: "duplicate-or-invalid-hour" };
    if (sample.pm25UgM3 === null || !Number.isFinite(sample.pm25UgM3) || sample.pm25UgM3 < 0) return { status: "unavailable", reason: "invalid-pm25" };
    byHour.set(time, sample.pm25UgM3);
  }
  if (byHour.size !== POLICY.INDEX_WINDOW_SAMPLES) return { status: "unavailable", reason: "missing-hour" };
  const values = [...byHour.values()].map(decimalRational);
  const denominator = values.reduce((largest, value) => value.denominator > largest ? value.denominator : largest, 1n);
  const numerator = values.reduce((sum, value) => sum + value.numerator * (denominator / value.denominator), 0n);
  const meanDenominator = denominator * BigInt(POLICY.INDEX_WINDOW_SAMPLES);
  const concentration10Big = numerator * 10n / meanDenominator;
  // Number division remains bounded because each input was finite/nonnegative.
  const mean24hUgM3 = [...byHour.values()].reduce((sum, value) => sum + value / POLICY.INDEX_WINDOW_SAMPLES, 0);
  const truncatedUgM3 = Number(concentration10Big / 10n) + Number(concentration10Big % 10n) / 10;
  const base = {
    status: "available" as const, method: POLICY.INDEX_METHOD, breakpointVersion: POLICY.BREAKPOINT_VERSION,
    mean24hUgM3, truncatedUgM3, periodFrom: new Date(start).toISOString(), periodTo: new Date(end).toISOString(), sampleCount: 24 as const,
  };
  if (concentration10Big > 3254n) return { ...base, value: null, category: "hazardous", beyondScale: true };
  const concentration10 = Number(concentration10Big);
  const breakpoint = PM25_BREAKPOINTS.find(value => concentration10 >= value.lo10 && concentration10 <= value.hi10);
  if (!breakpoint) return { status: "unavailable", reason: "invalid-pm25" };
  const index = Math.round((breakpoint.indexHi - breakpoint.indexLo) * (concentration10 - breakpoint.lo10) / (breakpoint.hi10 - breakpoint.lo10) + breakpoint.indexLo);
  return { ...base, value: index, category: breakpoint.category, beyondScale: false };
}
