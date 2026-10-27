import { mkdir, rmdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SYNTHETIC_NOW, syntheticEmptyCsv, syntheticViirsCsv } from '../fixtures/provider-scenarios';
import { readEnvironment } from '../src/lib/env';
import { createFirmsFetcher, parseFirmsCsv } from '../src/lib/providers/firms';
import { collectHotspots } from '../src/lib/services/hotspot-ingest';
import { HotspotRepository } from '../src/lib/storage/hotspot-repository';
import { FileObjectStore } from '../src/lib/storage/object-store';
import { createOperationalHotspotStore } from '../src/lib/storage/runtime';
import { parseUtc } from '../src/lib/time';
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--fixture')) throw new Error('Usage: npm run ingest:hotspots -- [--fixture]');
const fixture = args.includes('--fixture');
// Fixture storage is physically isolated and never selected by public API runtime.
const localRoot = resolve(fixture ? '.data/hotspots-fixture' : '.data/hotspots');
await mkdir(localRoot, { recursive: true });
const lock = resolve(localRoot, '.writer-lock');
let locked = false;
try {
  try { await mkdir(lock); locked = true; } catch { throw new Error('Writer already active or interrupted; inspect .writer-lock before retry.'); }
  const store = fixture ? new FileObjectStore(localRoot) : createOperationalHotspotStore();
  if (!store) throw new Error('Operational snapshot storage not configured.');
  const repository = new HotspotRepository(store, fixture);
  const key = fixture ? null : readEnvironment().server.FIRMS_MAP_KEY;
  if (!fixture && !key) throw new Error('NASA FIRMS is not configured.');
  const now = fixture ? SYNTHETIC_NOW : new Date();
  parseUtc(now.toISOString());
  const token = await repository.begin(now);
  const result = await collectHotspots(now, fixture ? async batch => {
    const symbol = batch.source === 'VIIRS_SNPP_NRT' ? 'N' : batch.source === 'VIIRS_NOAA20_NRT' ? 'N20' : 'N21';
    return parseFirmsCsv(batch.startDate === '2026-10-25' ? syntheticViirsCsv.replace(',N,', `,${symbol},`) : syntheticEmptyCsv, batch);
  } : createFirmsFetcher(key!));
  const finishedAt = fixture ? now : new Date();
  const snapshotId = await repository.finish(token, result, finishedAt, fixture);
  let pruned = 0, retention = 'ok';
  if (snapshotId) { try { pruned = (await repository.prune(finishedAt)).length; } catch { retention = 'failed'; } }
  console.log(JSON.stringify({ synthetic: fixture, status: snapshotId ? (result.issues.length ? 'partial' : 'published') : 'failed', snapshotId, detectionsCount: result.payload?.summary.detectionsCount ?? null, batches: result.batches, pruned, retention }));
  if (!snapshotId || retention !== 'ok') process.exitCode = 1;
} catch { console.error('Hotspot ingest failed. Check configuration, writer lock and safe job metadata; provider URLs/credentials are never logged.'); process.exitCode = 1; }
finally { if (locked) await rmdir(lock); }
