import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { parseOpenMeteo } from '../src/lib/providers/open-meteo';
import { AirRepository } from '../src/lib/storage/air-repository';
import { FileObjectStore } from '../src/lib/storage/object-store';
import { AirService } from '../src/lib/services/air';
const evidence = resolve('research/2026-10-28-open-meteo');
const provenance = JSON.parse(await readFile(join(evidence, 'provenance.json'), 'utf8')) as { evaluationTime: string; sourceUrl: string; sha256: string; location: { lat: number; lon: number } };
const body = await readFile(join(evidence, 'response.json'));
if (createHash('sha256').update(body).digest('hex') !== provenance.sha256) throw new Error('Evidence checksum mismatch.');
const now = new Date(provenance.evaluationTime), location = provenance.location;
const normalized = parseOpenMeteo(JSON.parse(body.toString()), location, now);
const folder = await mkdtemp(join(tmpdir(), 'lentera-m3-real-replay-'));
try {
  let adapterCalls = 0;
  const service = new AirService(new AirRepository(new FileObjectStore(folder)), async () => { adapterCalls++; return normalized; }, () => now);
  const first = await service.get(location), cached = await service.get(location);
  const report = {
    checkedAt: new Date().toISOString(), evidenceEvaluationTime: provenance.evaluationTime,
    scope: 'Historical real response captured via curl, replayed through parser, temporary disk cache and AirService. Not live application-runtime fetching, production limiter, browser or scientific validation.',
    evidence: 'research/2026-10-28-open-meteo/response.json', upstream: provenance.sourceUrl, fixedExampleLocation: location,
    responseSha256: provenance.sha256, receivedSamples: normalized.series.length, nonNullSamples: normalized.series.filter(sample => sample.pm25UgM3 !== null).length,
    runAt: normalized.runAt, projectionState: first.meta.state, currentPresent: first.data?.current !== null && first.data !== null,
    historyCount: first.data?.history.length ?? 0, forecastCount: first.data?.forecast.length ?? 0, indexAvailable: first.data?.aqi.status === 'available',
    adapterCallsForTwoServiceRequests: adapterCalls, cacheReusedVersion: first.meta.dataVersion === cached.meta.dataVersion,
    passed: first.meta.state === 'ok' && adapterCalls === 1 && first.meta.dataVersion === cached.meta.dataVersion,
  };
  await writeFile('docs/verification/M3-open-meteo-replay.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, samples: report.receivedSamples, state: report.projectionState, report: 'docs/verification/M3-open-meteo-replay.json' }));
  if (!report.passed) process.exitCode = 1;
} finally { await rm(folder, { recursive: true, force: true }); }
