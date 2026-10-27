import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { syntheticAirResponse } from '../fixtures/air-provider';
import { SYNTHETIC_NOW } from '../fixtures/provider-scenarios';
import { parseOpenMeteo } from '../src/lib/providers/open-meteo';
import { projectAir } from '../src/lib/air-series';
import { airChartSegments, airView, matchingAirLocation } from '../src/lib/air-view';
import { AqiBadge } from '../src/components/air/AqiBadge';
import { AirChart } from '../src/components/air/AirChart';
import { HOUR_MS } from '../src/lib/policy';
const location = { lat: -2.21, lon: 113.92 };
function response(value = 22) {
  return projectAir({ schemaVersion: '1.0', fetchedAt: SYNTHETIC_NOW.toISOString(), dataVersion: 'a'.repeat(64), content: parseOpenMeteo(syntheticAirResponse(SYNTHETIC_NOW, value), location, SYNTHETIC_NOW) }, location, SYNTHETIC_NOW);
}
describe('air presentation without browser or live upstream', () => {
  it('changes current hour/index using the existing series while preserving fetch/version', () => {
    const first = response(); const next = airView(first, new Date('2026-10-27T14:00:00Z'), false, false);
    expect(next.data?.current?.validAt).toBe('2026-10-27T14:00:00.000Z'); expect(next.data?.aqi).toMatchObject({ periodTo: '2026-10-27T14:00:00.000Z' }); expect(next.meta.dataVersion).toBe(first.meta.dataVersion); expect(next.meta.fetchedAt).toBe(first.meta.fetchedAt);
  });
  it('never promotes server partial/stale while offline and hides expired values', () => {
    const first = response();
    expect(airView(first, SYNTHETIC_NOW, true, false).meta.state).toBe('stale'); expect(airView(first, SYNTHETIC_NOW, false, true).meta.state).toBe('stale');
    expect(airView({ ...first, meta: { ...first.meta, state: 'partial' } }, SYNTHETIC_NOW, false, false).meta.state).toBe('partial');
    expect(airView({ ...first, meta: { ...first.meta, state: 'stale' } }, SYNTHETIC_NOW, false, false).meta.state).toBe('stale');
    expect(airView(first, new Date(SYNTHETIC_NOW.getTime() + 6 * HOUR_MS), false, false)).toMatchObject({ meta: { state: 'unavailable' }, data: null });
  });
  it('rejects a response belonging to a previous precise location', () => {
    expect(matchingAirLocation(response(), location)).toBe(true); expect(matchingAirLocation(response(), { lat: -2.214, lon: 113.92 })).toBe(false);
  });
  it('breaks chart paths on null and absent hours rather than smoothing over gaps', () => {
    const at = (hour: number, value: number | null) => ({ validAt: new Date(SYNTHETIC_NOW.getTime() + hour * HOUR_MS).toISOString(), pm25UgM3: value });
    expect(airChartSegments([at(0, 0), at(1, 1), at(2, null), at(3, 3), at(5, 5)]).map(segment => segment.length)).toEqual([2, 1, 1]);
  });
  it.each([0, 22, 400])('renders precise index labels and zero/beyond-scale semantics for %s', value => {
    const aqi = response(value).data!.aqi;
    const html = renderToStaticMarkup(<AqiBadge aqi={aqi}/>);
    expect(html).toContain('Estimasi US AQI PM2.5'); expect(html).toContain('rerata model 24 jam');
    if (value === 0) expect(html).toContain('<strong>0</strong>');
    if (value === 400) { expect(html).toContain('&gt;500'); expect(html).toContain('Berbahaya'); expect(html).not.toContain('<strong>501</strong>'); }
  });
  it('renders unavailable index as text without a numerical substitute', () => {
    const html = renderToStaticMarkup(<AqiBadge aqi={{ status: 'unavailable', reason: 'missing-hour' }}/>);
    expect(html).toContain('24 sampel'); expect(html).not.toContain('aqi-badge');
  });
  it('renders chart with an accessible explanation and real time coverage', () => {
    const data = response().data!;
    const html = renderToStaticMarkup(<AirChart history={data.history} current={data.current!} forecast={data.forecast}/>);
    expect(html).toContain('role="img"'); expect(html).toContain('data hilang'); expect(html).toContain('WIB');
  });
});
