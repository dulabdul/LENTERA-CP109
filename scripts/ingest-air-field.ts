import { spawn } from 'node:child_process';
import { readEnvironment } from '../src/lib/env';
import { FIELD_POLICY } from '../src/lib/air-field/contracts';
import { buildAirField } from '../src/lib/air-field/provider';
import { createAirFieldRepository } from '../src/lib/air-field/runtime';
import { pruneLocalAirField, reserveFieldBudget } from '../src/lib/air-field/storage';
const args = process.argv.slice(2), live = args.includes('--live'), useCurl = args.includes('--curl');
const budgetIndex = args.indexOf('--daily-budget'), budget = budgetIndex >= 0 ? Number(args[budgetIndex + 1]) : 2000;
if (!Number.isInteger(budget) || budget < 931 || budget > 8000 || (process.env.NODE_ENV === 'production' && budgetIndex < 0)) throw Error('Specify daily coordinate budget 931..8000; production requires explicit --daily-budget.');
const grid = { west: FIELD_POLICY.west, south: FIELD_POLICY.south, east: FIELD_POLICY.east, north: FIELD_POLICY.north, step: FIELD_POLICY.step, nx: FIELD_POLICY.nx, ny: FIELD_POLICY.ny };
if (!live) { console.log(JSON.stringify({ mode: 'dry-run', grid, coordinates: 931, dailyCoordinateBudget: budget, horizonHours: 24, source: 'Open-Meteo/CAMS global', next: 'Add --live to acquire real data; --curl is an optional HTTPS transport. No scheduled activation.' })); }
else {
 try {
  const repository = createAirFieldRepository(); if (!repository) throw Error('Persistent field storage is required in production');
  const started = new Date(), lease = await repository.claim(started); if (!lease) throw Error('Another field job owns the live lease');
  const { server } = readEnvironment();
  const request = async (url: string): Promise<unknown> => {
    if (!useCurl) {
      const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30_000) });
      if (!response.ok) { await response.body?.cancel(); throw Error('Field upstream request failed'); }
      const reader = response.body?.getReader(); if (!reader) throw Error('Missing upstream body');
      const chunks: Uint8Array[] = []; let size = 0;
      try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 1024 * 1024) throw Error('Field batch response too large'); chunks.push(part.value); } } finally { await reader.cancel().catch(() => {}); }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    // The URL/key is passed on stdin, never in argv, logs or checkpoints.
    return new Promise((resolve, reject) => {
      const child = spawn('curl', ['--config', '-', '--fail', '--silent', '--max-time', '30', '--max-filesize', '1048576', '--proto', '=https'], { stdio: ['pipe', 'pipe', 'pipe'] });
      const chunks: Buffer[] = []; let size = 0, settled = false;
      const fail = () => { if (!settled) { settled = true; reject(Error('Field HTTPS transport failed')); } };
      child.stdout.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 1024 * 1024) { child.kill(); fail(); } else chunks.push(chunk); });
      child.stderr.resume(); child.on('error', fail); child.stdin.on('error', fail);
      child.on('close', code => { if (settled) return; if (code !== 0) { fail(); return; } try { const result = JSON.parse(Buffer.concat(chunks).toString('utf8')); settled = true; resolve(result); } catch { fail(); } });
      child.stdin.end(`url = "${url.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"\n`);
    });
  };
  try {
    const snapshot = await buildAirField({ grid, now: started, baseUrl: server.OPEN_METEO_BASE_URL, key: server.OPEN_METEO_API_KEY, request,
      reserve: async units => { if (Date.now() - started.getTime() > 15 * 60_000) throw Error('Field job deadline exceeded'); await repository.assertLease(lease, new Date()); await reserveFieldBudget(repository.store, new Date(), units, budget); },
      finishedAt: () => new Date(), progress: (completed, total) => { if (completed % 100 === 0 || completed === total) console.log(JSON.stringify({ phase: 'sample-grid', completed, total })); } });
    const version = await repository.finish(lease, snapshot, new Date());
    const retention = await pruneLocalAirField(repository.store, new Date()).catch(() => ({ failed: true }));
    console.log(JSON.stringify({ retention, status: 'published', version, coordinates: snapshot.modelLocations.length, currentValid: snapshot.frames[0]!.values.filter(v => v !== null).length, frames: snapshot.frames.length, fetchedAt: snapshot.fetchedAt, synthetic: snapshot.synthetic }));
  } catch {
    await repository.finish(lease, null, new Date()).catch(() => {});
    console.error('Field ingestion failed; previous snapshot retained. Check budget/provider/transport; no credential diagnostics are logged.'); process.exitCode = 1;
  }
 } catch {
   console.error('Field job could not initialize storage or obtain a lease. Verify the selected runtime configuration; no upstream sampling was started.'); process.exitCode = 1;
 }
}
