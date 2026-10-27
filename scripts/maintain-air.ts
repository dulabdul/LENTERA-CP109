import { createAirStore } from '../src/lib/services/air-runtime';
import { AirRepository } from '../src/lib/storage/air-repository';
import { R2ObjectStore } from '../src/lib/storage/object-store';
import { pruneAirLimits } from '../src/lib/services/air-limits';
try {
  if (process.argv.length > 2) throw new Error('Usage: npm run maintain:air');
  const store = createAirStore();
  if (!store) throw new Error('Air storage is not configured.');
  if (store instanceof R2ObjectStore) {
    console.error('R2 air retention requires configured object lifecycles; conditional mutable-object deletion is not assumed supported. See docs/OPERATIONS.md.');
    process.exitCode = 1;
  } else {
    const now = new Date();
    console.log(JSON.stringify({ removedCacheOrAttemptObjects: await new AirRepository(store).prune(now), removedLimitObjects: await pruneAirLimits(store, now) }));
  }
} catch { console.error('Air maintenance failed. Review configuration and safe retention guidance; no credentials or location history are logged.'); process.exitCode = 1; }
