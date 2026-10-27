'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { airLocationKey, airView } from '@/lib/air-view';
import { fetchLocationData, locationServerTime, LocationRateLimited, type ReceivedAir, type ReceivedRecommendation } from '@/lib/location-data';
import type { Audience, Location } from '@/lib/contracts';
export function useAirData(location: Location | null, offline: boolean, audience: Audience = 'general') {
  const key = location ? airLocationKey(location) : null, actionKey = key ? `${key}:${audience}` : null;
  const [saved, setSaved] = useState<(ReceivedAir & { key: string }) | null>(null);
  const [savedAction, setSavedAction] = useState<(ReceivedRecommendation & { key: string }) | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null), [failureKey, setFailureKey] = useState<string | null>(null);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null), [actionFailureKey, setActionFailureKey] = useState<string | null>(null);
  const [retry, setRetry] = useState(0), [clock, setClock] = useState(() => performance.now()), [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(0);
  useEffect(() => {
    if (!key || !actionKey || !location) return;
    let disposed = false, fetching = false, controller: AbortController | null = null, timer: number | undefined;
    const selected = location;
    const refresh = async () => {
      if (fetching || performance.now() < cooldownRef.current) return;
      fetching = true; let receivedAir = false;
      controller?.abort(); const active = new AbortController(); controller = active;
      setLoadingKey(key); setActionLoadingKey(actionKey);
      try {
        const result = await fetchLocationData({ location: selected, audience, signal: AbortSignal.any([active.signal, AbortSignal.timeout(75_000)]), onAir: air => {
          if (disposed || active.signal.aborted) return;
          receivedAir = true; setSaved({ key, ...air }); setFailureKey(null); setLoadingKey(null); setClock(performance.now());
        } });
        if (disposed || active.signal.aborted) return;
        setSavedAction({ key: actionKey, ...result.recommendation }); setActionFailureKey(null); setClock(performance.now());
      } catch (error) {
        if (!disposed && !active.signal.aborted) {
          if (!receivedAir) setFailureKey(key);
          setActionFailureKey(actionKey);
          if (error instanceof LocationRateLimited) { const until = performance.now() + error.seconds * 1000; cooldownRef.current = until; setCooldown(until); }
          setClock(performance.now());
        }
      } finally {
        fetching = false;
        if (!disposed && !active.signal.aborted) { setLoadingKey(current => current === key ? null : current); setActionLoadingKey(current => current === actionKey ? null : current); }
      }
    };
    const tick = () => { setClock(performance.now()); if (!document.hidden && navigator.onLine) void refresh(); };
    const schedule = () => { timer = window.setTimeout(() => { tick(); schedule(); }, 60_000 - Date.now() % 60_000 + 10); };
    if (navigator.onLine) void refresh(); else { setFailureKey(key); setActionFailureKey(actionKey); }
    schedule(); document.addEventListener('visibilitychange', tick); window.addEventListener('online', tick);
    return () => { disposed = true; controller?.abort(); window.clearTimeout(timer); document.removeEventListener('visibilitychange', tick); window.removeEventListener('online', tick); };
    // Exact coordinates + audience identify this request; changing either aborts the old cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, audience, retry]);
  useEffect(() => { setClock(performance.now()); }, [offline]);
  const selectedAir = saved?.key === key ? saved : null, selectedAction = savedAction?.key === actionKey ? savedAction : null;
  const serverNow = useMemo(() => locationServerTime(selectedAir, selectedAction, clock), [selectedAir, selectedAction, clock]);
  const response = useMemo(() => selectedAir ? airView(selectedAir.response, serverNow, offline, failureKey === key) : null, [selectedAir, serverNow, offline, failureKey, key]);
  useEffect(() => {
    if (!selectedAction) return;
    const remaining = Date.parse(selectedAction.response.result.validUntil) - serverNow.getTime();
    if (remaining <= 0) return;
    const expiryTimer = window.setTimeout(() => setClock(performance.now()), remaining + 5);
    return () => window.clearTimeout(expiryTimer);
  }, [selectedAction, serverNow]);
  const refresh = useCallback(() => { if (performance.now() >= cooldownRef.current) setRetry(value => value + 1); }, []);
  return { response, loading: key !== null && loadingKey === key, failed: key !== null && failureKey === key, refresh,
    retryAfter: Math.max(0, Math.ceil((cooldown - clock) / 1000)), recommendation: selectedAction?.response ?? null,
    actionLoading: actionKey !== null && actionLoadingKey === actionKey, actionFailed: actionKey !== null && actionFailureKey === actionKey, serverNow };
}
export type AirResource = ReturnType<typeof useAirData>;
