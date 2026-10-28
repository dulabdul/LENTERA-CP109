import 'server-only';
import { resolve } from 'node:path';
import { readEnvironment } from '../env';
import { createR2Client } from '../storage/r2';
import { FileObjectStore, R2ObjectStore } from '../storage/object-store';
import { AirFieldRepository } from './storage';
export function createAirFieldRepository() {
  const { server } = readEnvironment();
  if (server.R2_ENDPOINT) { const { client, bucket } = createR2Client(); return new AirFieldRepository(new R2ObjectStore(client, bucket)); }
  return process.env.NODE_ENV !== 'production' ? new AirFieldRepository(new FileObjectStore(resolve('.data/air-field'))) : null;
}
