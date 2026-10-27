'use client';
import { useState } from 'react';
import type { Audience, Location } from '@/lib/contracts';
import { recommendationView } from '@/lib/recommendation-view';
import { ActionPanel } from '@/components/actions/ActionPanel';
import { AirPanel } from './AirPanel';
import { useAirData } from './useAirData';
export function LocationPanels({ location, offline }: { location: Location | null; offline: boolean }) {
  const [audience, setAudience] = useState<Audience>('general');
  const resource = useAirData(location, offline, audience);
  const view = recommendationView({ location, audience, offline, air: resource.response, recommendation: resource.recommendation,
    now: resource.serverNow, failed: resource.failed || resource.actionFailed, loading: resource.loading || resource.actionLoading });
  return <><AirPanel location={location} resource={resource}/><hr/><ActionPanel view={view} response={resource.recommendation} audience={audience} onAudienceChange={setAudience}
    onRefresh={resource.refresh} loading={resource.loading || resource.actionLoading} retryAfter={resource.retryAfter}/></>;
}
