import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));
const publicDir = join(process.cwd(), "public");

mkdirSync(publicDir, { recursive: true });

copyFileSync(join(dist, "maplibre-gl-worker-dev.mjs"), join(publicDir, "maplibre-gl-worker.mjs"));
copyFileSync(join(dist, "maplibre-gl-shared.mjs"), join(publicDir, "maplibre-gl-shared.mjs"));
console.log("MapLibre worker assets copied to public/");
