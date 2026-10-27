import { airResponseSchema, type AirResponse } from './air-series';
import { recommendationResponseSchema, type RecommendationResponse } from './action-contracts';
import type { Audience, Location } from './contracts';
import { airLocationKey, matchingAirLocation } from './air-view';
import { recommendationsAgree } from './recommendation-view';
export class LocationRateLimited extends Error {
  constructor(public readonly seconds: number) { super('Permintaan dibatasi.'); }
}
export interface ReceivedAir { response: AirResponse; startedAt: number }
export interface ReceivedRecommendation { response: RecommendationResponse; startedAt: number }
export function locationServerTime(air: ReceivedAir | null, recommendation: ReceivedRecommendation | null, monotonicNow: number): Date {
  const airNow = air ? Date.parse(air.response.meta.evaluatedAt) + Math.max(0, monotonicNow - air.startedAt) : 0;
  const actionNow = recommendation ? Date.parse(recommendation.response.result.createdAt) + Math.max(0, monotonicNow - recommendation.startedAt) : 0;
  // Count elapsed time from request start, conservatively including network/IO instead of extending validity on arrival.
  return new Date(Math.max(airNow, actionNow));
}
export async function fetchLocationData(options: {
  location: Location; audience: Audience; signal: AbortSignal; fetch?: typeof fetch; clock?: () => number;
  onAir?: (value: ReceivedAir) => void;
}): Promise<{ air: ReceivedAir; recommendation: ReceivedRecommendation }> {
  const request = options.fetch ?? fetch, clock = options.clock ?? (() => performance.now());
  const coordinates = new URLSearchParams({ lat: String(options.location.lat), lon: String(options.location.lon) });
  async function read(url: string) {
    options.signal.throwIfAborted();
    const response = await request(url, { signal: options.signal, cache: 'no-store' });
    options.signal.throwIfAborted();
    if (response.status === 429) {
      const seconds = Number(response.headers.get('retry-after'));
      throw new LocationRateLimited(Number.isFinite(seconds) && seconds >= 1 && seconds <= 3600 ? seconds : 60);
    }
    if (response.status !== 200 && response.status !== 503) throw new Error('Location source response invalid.');
    const raw: unknown = await response.json(); options.signal.throwIfAborted(); return raw;
  }
  async function readAir(): Promise<ReceivedAir> {
    const startedAt = clock(), response = airResponseSchema.parse(await read(`/api/air?${coordinates}`));
    if (!matchingAirLocation(response, options.location)) throw new Error('Air response location mismatch.');
    options.signal.throwIfAborted();
    const received = { response, startedAt }; options.onAir?.(received); return received;
  }
  let air = await readAir();
  const startedAt = clock(), query = new URLSearchParams(coordinates); query.set('audience', options.audience);
  const recommendation = recommendationResponseSchema.parse(await read(`/api/recommendations?${query}`));
  if (recommendation.result.audience !== options.audience || airLocationKey(recommendation.result.location) !== airLocationKey(options.location)) throw new Error('Recommendation selection mismatch.');
  if (!recommendationsAgree(air.response, recommendation, options.location, options.audience)) air = await readAir();
  options.signal.throwIfAborted();
  return { air, recommendation: { response: recommendation, startedAt } };
}
