'use client';
import { useEffect, useMemo, useState } from 'react';
import { airFieldResponseSchema, projectField, type AirFieldResponse } from '@/lib/air-field/contracts';
export function useAirField(enabled: boolean) {
  const [stored, setStored] = useState<{ response: AirFieldResponse; receivedAt: number } | null>(null), [loading, setLoading] = useState(false), [failed, setFailed] = useState(false);
  const [offline, setOffline] = useState(false), [retry, setRetry] = useState(0), [tick, setTick] = useState(0);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine); update(); window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false, controller: AbortController | null = null;
    const refresh = async () => {
      setTick(n => n + 1); if (!navigator.onLine || document.hidden) return;
      controller?.abort(); const active = new AbortController(); controller = active; setLoading(true);
      try {
        const response = await fetch('/api/air-field', { cache: 'no-store', signal: AbortSignal.any([active.signal, AbortSignal.timeout(20_000)]) });
        if (response.status !== 200 && response.status !== 503) throw Error();
        const reader = response.body?.getReader(); if (!reader) throw Error();
        const chunks: Uint8Array[] = []; let size = 0;
        try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 4 * 1024 * 1024) throw Error(); chunks.push(part.value); } } finally { await reader.cancel().catch(() => {}); }
        const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        const body = airFieldResponseSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
        if (!disposed && !active.signal.aborted) { setStored({ response: body, receivedAt: performance.now() }); setFailed(false); }
      } catch { if (!disposed && !active.signal.aborted) setFailed(true); }
      finally { if (!disposed && !active.signal.aborted) setLoading(false); }
    };
    void refresh(); const timer = window.setInterval(() => { void refresh(); }, 60_000);
    const resume = () => { void refresh(); }; document.addEventListener('visibilitychange', resume); window.addEventListener('online', resume);
    return () => { disposed = true; controller?.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); };
  }, [enabled, retry]);
  const projection = useMemo(() => {
  const now = new Date(stored ? Date.parse(stored.response.meta.evaluatedAt) + Math.max(0, performance.now() - stored.receivedAt) : 0);
  const response = stored ? projectField(stored.response.data, stored.response.meta.dataVersion, now, failed || offline || stored.response.meta.state === 'stale', stored.response.meta.lastAttemptAt) : null;
  return { response, now };
  }, [stored, failed, offline, tick]);
  useEffect(() => {
    if (!enabled || !stored) return;
    const now = projection.now.getTime(), fetched = Date.parse(stored.response.meta.fetchedAt ?? "");
    const deadlines = [Math.floor(now / 3_600_000) * 3_600_000 + 3_600_000, fetched + 12 * 3_600_000, fetched + 24 * 3_600_000 + 1].filter(t => Number.isFinite(t) && t > now);
    const timer = window.setTimeout(() => setTick(n => n + 1), Math.max(1, Math.min(...deadlines) - now + 1));
    return () => window.clearTimeout(timer);
  }, [enabled, stored, projection.now]);
  return { ...projection, loading, failed, offline, refresh: () => setRetry(n => n + 1) };
}
export type AirFieldResource = ReturnType<typeof useAirField>;
