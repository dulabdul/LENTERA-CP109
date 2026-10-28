// Read-only integration check; does not publish or request upstream data.
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GET } from '../src/app/api/air-field/route';
import { airFieldResponseSchema, currentFieldFrame } from '../src/lib/air-field/contracts';
import { rasterField } from '../src/lib/air-field/raster';
import { readEnvironment } from '../src/lib/env';
const response = await GET(new Request('http://localhost/api/air-field'));
const body = airFieldResponseSchema.parse(await response.json()), snapshot = body.data;
const frame = snapshot ? currentFieldFrame(snapshot, new Date(body.meta.evaluatedAt)) : null;
const raster = snapshot && frame ? rasterField(snapshot.grid, frame) : null;
let paintedPixels = 0; if (raster) for (let i = 3; i < raster.pixels.length; i += 4) if (raster.pixels[i]) paintedPixels++;
const { server } = readEnvironment();
const report = {
  checkedAt: new Date().toISOString(), runtime: server.R2_ENDPOINT ? 'configured-r2' : 'development-local', envFileLoadedByCommand: process.execArgv.some(arg => arg.startsWith('--env-file')),
  transport: 'in-process Route GET; no HTTP socket or browser', source: 'Open-Meteo / CAMS', upstreamRequestsDuringCheck: 0,
  status: response.status, cacheControl: response.headers.get('cache-control'), state: body.meta.state,
  version: body.meta.dataVersion, fetchedAt: body.meta.fetchedAt, startedAt: snapshot?.startedAt ?? null, runAt: snapshot?.runAt ?? null, synthetic: snapshot?.synthetic ?? null,
  grid: snapshot?.grid ?? null, modelLocations: snapshot?.modelLocations.filter(Boolean).length ?? 0, frames: snapshot?.frames.length ?? 0,
  currentValidAt: frame?.validAt ?? null, currentValidSamples: frame?.values.filter(v => v !== null).length ?? 0, currentMissingSamples: frame?.values.filter(v => v === null).length ?? null,
  raster: raster ? { width: raster.width, height: raster.height, paintedPixels, totalPixels: raster.width * raster.height, sha256: createHash('sha256').update(raster.pixels).digest('hex') } : null,
  passed: response.status === 200 && snapshot?.synthetic === false && snapshot.grid.nx * snapshot.grid.ny === 931 && !!frame && paintedPixels > 0,
  limitations: 'Evidence at checkedAt only. Does not establish scientific accuracy, current availability in a different runtime, R2 connectivity when local, map canvas rendering, screenshots or browser responsiveness. Runtime snapshot is intentionally excluded from source archives.'
};
await writeFile('docs/verification/MAP-air-field-live.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2)); if (!report.passed) process.exitCode = 1;
