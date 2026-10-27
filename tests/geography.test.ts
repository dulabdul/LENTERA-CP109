import { describe, expect, it } from "vitest";
import { pointInIndonesia, searchPlaces, geographyManifest } from "@/lib/geography";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

describe("provenance and indicative service geography", () => {
  it.each([[106.8456,-6.2088], [101.45,.51], [113.92,-2.21], [115.2126,-8.6705], [140.7,-2.6]])("includes a known land point %s %s", (lon,lat) => expect(pointInIndonesia({ lon: lon!, lat: lat! })).toBe(true));
  it.each([[103.8198,1.3521], [101.6869,3.139], [120.9842,14.5995]])("excludes a foreign point %s %s", (lon,lat) => expect(pointInIndonesia({ lon: lon!, lat: lat! })).toBe(false));
  it("does not treat the whole Indonesia bounding box as the country", () => expect(pointInIndonesia({ lon: 100, lat: -10 })).toBe(false));
  it("validates coordinates and searches local gazetteer", () => {
    expect(pointInIndonesia({ lat: NaN, lon: 101 })).toBe(false);
    expect(searchPlaces("pekanbaru").length).toBeGreaterThan(0);
    expect(searchPlaces("PEKANBARU")[0]?.name.toLowerCase()).toContain("pekanbaru");
    expect(searchPlaces("p")).toEqual([]);
  });
  it("matches the imported data checksums", () => {
    for (const source of [geographyManifest.country, geographyManifest.places]) {
      const hash = createHash("sha256").update(readFileSync(`src/data/${source.output}`)).digest("hex");
      expect(hash).toBe(source.outputSha256);
    }
    expect(geographyManifest.country.version).toBe("5.1.1");
    expect(geographyManifest.places.version).toBe("5.1.2");
  });
});
