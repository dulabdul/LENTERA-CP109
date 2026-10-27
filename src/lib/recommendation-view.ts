import type { RecommendationResponse, TargetedActionResult } from './action-contracts';
import type { AirResponse } from './air-series';
import type { AqiEstimate, Audience, Location } from './contracts';
import { airLocationKey } from './air-view';
import { currentHour } from './time';
type AvailableAqi = Extract<AqiEstimate, { status: 'available' }>;
export function sameIndexBasis(a: AvailableAqi, b: AvailableAqi) {
  return (['method', 'breakpointVersion', 'mean24hUgM3', 'truncatedUgM3', 'periodFrom', 'periodTo', 'sampleCount', 'value', 'category', 'beyondScale'] as const).every(key => a[key] === b[key]);
}
export function recommendationsAgree(air: AirResponse, recommendation: RecommendationResponse, location: Location, audience: Audience): boolean {
  const { result, meta } = recommendation;
  if (airLocationKey(result.location) !== airLocationKey(location) || result.audience !== audience || result.basisDataVersion !== air.meta.dataVersion || meta.dataVersion !== air.meta.dataVersion) return false;
  if (air.data && airLocationKey(air.data.requestedLocation) !== airLocationKey(location)) return false;
  if (result.mode === 'limited') return true;
  return !!air.data?.current && air.data.aqi.status === 'available' && result.forTime === air.data.current.validAt && sameIndexBasis(result.basis, air.data.aqi);
}
export type RecommendationView = { mode: 'limited'; reason: string; result: null } | { mode: 'targeted'; reason: string; result: TargetedActionResult };
export function recommendationView(input: {
  air: AirResponse | null; recommendation: RecommendationResponse | null; location: Location | null; audience: Audience; now: Date;
  offline?: boolean; failed?: boolean; loading?: boolean;
}): RecommendationView {
  const limited = (reason: string): RecommendationView => ({ mode: 'limited', reason, result: null });
  const { air, recommendation, location, audience, now } = input;
  if (!location) return limited('Pilih lokasi untuk membaca panduan berdasarkan informasi udara.');
  if (input.offline) return limited('Perangkat offline. Rekomendasi terarah menunggu pembaruan data.');
  if (input.failed) return limited('Pembaruan belum berhasil. Gunakan pedoman umum sambil menunggu data yang sesuai.');
  if (input.loading) return limited('Sedang menyamakan informasi udara dan panduan untuk lokasi ini.');
  if (!air || !recommendation) return limited('Data dan panduan untuk lokasi ini belum tersedia.');
  if (!recommendationsAgree(air, recommendation, location, audience)) return limited('Versi, lokasi, atau periode panduan belum sesuai dengan panel udara.');
  const result = recommendation.result, nowMs = now.getTime();
  if (!Number.isFinite(nowMs) || Date.parse(result.validUntil) <= nowMs || Date.parse(result.createdAt) > nowMs || Date.parse(result.forTime) !== currentHour(now)) return limited('Panduan sudah kedaluwarsa atau belum sesuai dengan jam kini.');
  if (result.mode === 'limited') return limited(result.reason);
  if (air.meta.state !== 'ok' || recommendation.meta.state !== 'ok' || !air.meta.validUntil || Date.parse(air.meta.validUntil) <= nowMs || !recommendation.meta.validUntil || Date.parse(recommendation.meta.validUntil) <= nowMs) return limited('Data udara belum memenuhi syarat rekomendasi terarah.');
  return { mode: 'targeted', reason: result.reason, result };
}
