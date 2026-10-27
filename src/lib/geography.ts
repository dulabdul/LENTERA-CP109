import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import country from "@/data/indonesia.json";
import places from "@/data/places.json";
import manifest from "@/data/geography-manifest.json";
import { locationSchema, type Location } from "./contracts";

export const indonesia = country as unknown as FeatureCollection<Polygon | MultiPolygon>;
export const geographyManifest = manifest;
export function pointInIndonesia(location: Location): boolean {
  const valid = locationSchema.safeParse(location);
  return valid.success && indonesia.features.some(feature => booleanPointInPolygon([valid.data.lon, valid.data.lat], feature));
}
const fold = (value: string) => value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("id");
export function searchPlaces(query: string) {
  const normalized = fold(query.trim());
  if (normalized.length < 2) return [];
  return places.filter(place => fold(`${place.name} ${place.region}`).includes(normalized)).slice(0, 10);
}

export function indonesiaPreviewPaths(): string[] {
  const project = ([lon = 0, lat = 0]: number[]) => `${((lon - 94.5) / 47 * 1000).toFixed(1)},${((6.5 - lat) / 17.7 * 390).toFixed(1)}`;
  return indonesia.features.flatMap(feature => {
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    return polygons.map(rings => rings.map(ring => {
      // Simplification applies only to this contextual illustration, never the service boundary mask.
      const sampled = ring.filter((_, index) => index % 6 === 0 || index === ring.length - 1);
      return sampled.length >= 3 ? `M${sampled.map(project).join("L")}Z` : "";
    }).join(" "));
  }).filter(Boolean);
}
