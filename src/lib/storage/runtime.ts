import "server-only";
import { resolve } from "node:path";
import { readEnvironment } from "../env";
import { createR2Client } from "./r2";
import { FileObjectStore, R2ObjectStore } from "./object-store";
import { HotspotRepository } from "./hotspot-repository";
export function createOperationalHotspotStore() {
  const { server } = readEnvironment();
  if (server.R2_ENDPOINT) { const { client, bucket } = createR2Client(); return new R2ObjectStore(client, bucket); }
  // Local disk is a development adapter, not durable storage on ephemeral production hosts.
  if (process.env.NODE_ENV !== 'production') return new FileObjectStore(resolve('.data/hotspots'));
  return null;
}
export function createOperationalHotspotRepository() {
  const store = createOperationalHotspotStore(); return store ? new HotspotRepository(store) : null;
}
