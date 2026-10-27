import 'server-only';
import { audienceSchema, type Audience, type Location } from '../contracts';
import { airResponseSchema, projectAir, type AirResponse } from '../air-series';
import { airLocationKey, airView } from '../air-view';
import { evaluateActions } from '../actions';
import { recommendationResponseSchema } from '../action-contracts';
import { InvalidAirQuery, parseAirQuery, type AirService } from './air';
import { currentHour } from '../time';
export function parseRecommendationQuery(params: URLSearchParams): { location: Location; audience: Audience } {
  if (params.toString().length > 320 || [...params.keys()].some(key => !['lat', 'lon', 'audience'].includes(key) || params.getAll(key).length !== 1)) throw new InvalidAirQuery();
  const audience = audienceSchema.safeParse(params.get('audience') ?? 'general');
  if (!audience.success) throw new InvalidAirQuery();
  const coordinates = new URLSearchParams(params); coordinates.delete('audience');
  return { location: parseAirQuery(coordinates), audience: audience.data };
}
export function recommendationsFromAir(raw: AirResponse, location: Location, audience: Audience, now: Date) {
  const air = airResponseSchema.parse(raw);
  if (air.data && airLocationKey(air.data.requestedLocation) !== airLocationKey(location)) throw new Error('Air source location mismatch.');
  const decisionTime = new Date(Math.max(now.getTime(), Date.parse(air.meta.evaluatedAt)));
  // Re-evaluate the server-owned series if the hour changed during IO. Browser indices are never inputs.
  const current = air.data ? airView(air, decisionTime, false, false) : { ...air, meta: { ...air.meta, evaluatedAt: decisionTime.toISOString() } };
  return recommendationResponseSchema.parse({ meta: current.meta, result: evaluateActions({ now: decisionTime, meta: current.meta,
    aqi: current.data?.aqi ?? { status: 'unavailable', reason: 'no-current-source' }, location, audience }) });
}
export async function serveRecommendations(service: AirService, location: Location, audience: Audience, clock = () => new Date()) {
  let air = await service.get(location), now = clock();
  if (currentHour(now) !== currentHour(new Date(air.meta.evaluatedAt))) {
    // One bounded cache read restores the full forecast horizon after crossing an hour during IO.
    air = await service.get(location, now); now = clock();
  }
  return recommendationsFromAir(air, location, audience, now);
}
export function unavailableRecommendations(location: Location, audience: Audience, now: Date) {
  return recommendationsFromAir(projectAir(null, location, now, { issues: [{ code: 'not-configured', source: 'air', detail: 'Sumber udara atau pembatas permintaan belum tersedia.' }] }), location, audience, now);
}
