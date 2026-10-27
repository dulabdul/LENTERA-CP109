import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActionPanel } from '../src/components/actions/ActionPanel';
import { AudienceSelector } from '../src/components/actions/AudienceSelector';
import { recommendationView, recommendationsAgree } from '../src/lib/recommendation-view';
import { recommendationsFromAir } from '../src/lib/services/recommendations';
import { projectAir } from '../src/lib/air-series';
import { parseOpenMeteo } from '../src/lib/providers/open-meteo';
import { syntheticAirResponse } from '../fixtures/air-provider';
import { SYNTHETIC_NOW } from '../fixtures/provider-scenarios';
import type { Audience } from '../src/lib/contracts';
const location = { lat: -2.21, lon: 113.92 };
function state(audience: Audience = 'general', value = 22) {
  const air = projectAir({ schemaVersion: '1.0', fetchedAt: SYNTHETIC_NOW.toISOString(), dataVersion: 'a'.repeat(64), content: parseOpenMeteo(syntheticAirResponse(SYNTHETIC_NOW, value), location, SYNTHETIC_NOW) }, location, SYNTHETIC_NOW);
  return { air, recommendation: recommendationsFromAir(air, location, audience, SYNTHETIC_NOW), location, audience, now: SYNTHETIC_NOW };
}
describe('recommendation display must agree with current air', () => {
  it('shows the canonical server messages only with matching metadata and input period', () => {
    const input = state(), view = recommendationView(input); expect(view.mode).toBe('targeted');
    const html = renderToStaticMarkup(<ActionPanel view={view} response={input.recommendation} audience="general" onAudienceChange={() => {}} onRefresh={() => {}} loading={false} retryAfter={0}/>);
    expect(html).toContain('Pantau prakiraan dan perubahan kondisi.'); expect(html).toContain(input.air.meta.dataVersion!); expect(html).toContain('LK-AIR-moderate-general-v1'); expect(html).toContain('Berlaku sampai'); expect(html).toContain('24/24 sampel'); expect(html).toContain('airnow.gov');
  });
  it.each(['offline', 'failed', 'loading'] as const)('suppresses targeted messages while %s', reason => {
    const input = state(), view = recommendationView({ ...input, [reason]: true }); expect(view.mode).toBe('limited'); expect(view.result).toBeNull();
    const html = renderToStaticMarkup(<ActionPanel view={view} response={input.recommendation} audience="general" onAudienceChange={() => {}} onRefresh={() => {}} loading={false} retryAfter={0}/>);
    expect(html).not.toContain('Pantau prakiraan dan perubahan kondisi.'); expect(html).not.toContain('LK-AIR-moderate-general-v1');
  });
  it.each(['version', 'location', 'audience', 'hour', 'category', 'value', 'mean', 'period', 'source-state'] as const)('withholds mismatched %s', kind => {
    const input = state();
    if (kind === 'version') input.air.meta.dataVersion = 'b'.repeat(64);
    if (kind === 'location') input.location = { lat: -2.214, lon: 113.92 };
    if (kind === 'audience') input.audience = 'outdoor';
    if (kind === 'hour') input.now = new Date('2026-10-27T14:00:00Z');
    if (kind === 'source-state') input.air.meta.state = 'partial';
    if (input.recommendation.result.mode === 'targeted') {
      if (kind === 'category') input.recommendation.result.basis.category = 'good';
      if (kind === 'value') input.recommendation.result.basis.value = 0;
      if (kind === 'mean') input.recommendation.result.basis.mean24hUgM3 = 23;
      if (kind === 'period') input.recommendation.result.basis.periodFrom = '2026-10-27T12:00:00Z';
    }
    expect(recommendationView(input).mode).toBe('limited');
  });
  it('expires at the exact source/action deadline and rejects future-created advice', () => {
    const input = state(); input.now = new Date(input.recommendation.result.validUntil); expect(recommendationView(input).mode).toBe('limited');
    input.now = new Date(SYNTHETIC_NOW.getTime() - 1); expect(recommendationView(input).mode).toBe('limited');
  });
  it('shows model beyondScale in trace details but does not fabricate an extrapolated value', () => {
    const input = state('outdoor', 400); const view = recommendationView(input);
    const html = renderToStaticMarkup(<ActionPanel view={view} response={input.recommendation} audience="outdoor" onAudienceChange={() => {}} onRefresh={() => {}} loading={false} retryAfter={0}/>);
    expect(html).toContain('&gt;500'); expect(html).toContain('Aktivitas luar ruang'); expect(html).not.toContain('501');
  });
  it('treats same cache bucket but different precise locations as distinct', () => {
    const input = state(); expect(recommendationsAgree(input.air, input.recommendation, { lat: -2.214, lon: 113.92 }, 'general')).toBe(false);
  });
  it('keeps forecast browsing outside of the action request/basis', () => {
    const input = state(); const future = input.air.data!.forecast.at(-1)!;
    expect(future.validAt).not.toBe(input.recommendation.result.forTime); expect(recommendationView(input).mode).toBe('targeted');
    const html = renderToStaticMarkup(<ActionPanel view={recommendationView(input)} response={input.recommendation} audience="general" onAudienceChange={() => {}} onRefresh={() => {}} loading={false} retryAfter={0}/>);
    expect(html).toContain('Untuk jam kini'); expect(html).toContain('Pilihan riwayat atau prakiraan udara tidak mengubah');
  });
  it('offers a native keyboard-operable radio group with three labeled options', () => {
    const html = renderToStaticMarkup(<AudienceSelector value="sensitive" onChange={() => {}}/>);
    expect(html.match(/type="radio"/g)).toHaveLength(3); expect(html).toContain('name="action-audience"'); expect(html).toContain('checked=""'); expect(html).toContain('<legend>Panduan untuk</legend>'); expect(html).toContain('Masyarakat umum'); expect(html).toContain('Kelompok sensitif'); expect(html).toContain('Aktivitas luar ruang');
  });
});
