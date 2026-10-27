import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { read } from "shapefile";

const folder = process.argv[2] ?? ".cache/geography";
const target = "src/data";
await mkdir(target, { recursive: true });
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const countries = await read(join(folder, "countries/ne_10m_admin_0_countries.shp"), join(folder, "countries/ne_10m_admin_0_countries.dbf"));
const indonesia = countries.features.filter(feature => feature.properties?.ADM0_A3 === "IDN");
if (indonesia.length !== 1 || !indonesia[0]?.geometry || !["Polygon", "MultiPolygon"].includes(indonesia[0].geometry.type)) throw new Error("Expected exactly one Indonesia polygon feature");
const country = { type: "FeatureCollection", features: indonesia.map(feature => ({ type: "Feature", properties: { id: "IDN", name: "Indonesia", indicative: true }, geometry: feature.geometry })) };
const populated = await read(join(folder, "places/ne_10m_populated_places.shp"), join(folder, "places/ne_10m_populated_places.dbf"));
const places = populated.features.filter(feature => feature.properties?.ADM0_A3 === "IDN").map(feature => {
  if (feature.geometry?.type !== "Point") throw new Error("Expected point gazetteer");
  const [lon, lat] = feature.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Invalid place coordinates");
  return { id: `ne-${feature.properties?.NE_ID}`, name: String(feature.properties?.NAME_EN || feature.properties?.NAME || ""), region: String(feature.properties?.ADM1NAME || ""), lat, lon };
}).sort((a, b) => a.name.localeCompare(b.name, "id"));
if (places.length < 10 || new Set(places.map(place => place.id)).size !== places.length) throw new Error("Incomplete/duplicate Indonesia gazetteer");
const countryText = JSON.stringify(country) + "\n", placesText = JSON.stringify(places, null, 2) + "\n";
await writeFile(join(target, "indonesia.json"), countryText);
await writeFile(join(target, "places.json"), placesText);
const countryVersion = (await readFile(join(folder, "countries/ne_10m_admin_0_countries.VERSION.txt"), "utf8")).trim();
const placeVersion = (await readFile(join(folder, "places/ne_10m_populated_places.VERSION.txt"), "utf8")).trim();
const manifest = {
  generatedAt: new Date().toISOString(), provider: "Natural Earth", license: "Public domain",
  licenseUrl: "https://www.naturalearthdata.com/about/terms-of-use/", scale: "1:10,000,000",
  note: "Batas indikatif yang digeneralisasi; bukan batas hukum atau daftar desa lengkap.",
  transformation: "Select ADM0_A3=IDN. Keep original country geometry; retain only place name/region/coordinates/NE_ID. No geometry simplification or invented coordinates.",
  country: { version: countryVersion, url: "https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_countries.zip", archiveSha256: sha(await readFile(join(folder, "countries.zip"))), output: "indonesia.json", outputSha256: sha(countryText), featureCount: country.features.length },
  places: { version: placeVersion, url: "https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_populated_places.zip", archiveSha256: sha(await readFile(join(folder, "places.zip"))), output: "places.json", outputSha256: sha(placesText), featureCount: places.length },
};
await writeFile(join(target, "geography-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ countryVersion, placeVersion, placeCount: places.length, target }));
