'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
export function MapWorkspacePanel({ search, pinned, children }: { search?: ReactNode; pinned?: ReactNode; children: ReactNode }) {
  const [expanded, setExpanded] = useState(true), toggle = useRef<HTMLButtonElement>(null), body = useRef<HTMLDivElement>(null), searchHost = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 900px)');
    const sync = () => { if (body.current?.contains(document.activeElement) || searchHost.current?.contains(document.activeElement)) toggle.current?.focus(); setExpanded(query.matches); };
    sync(); query.addEventListener('change', sync);
    const onClean = () => {
      if (body.current?.contains(document.activeElement) || searchHost.current?.contains(document.activeElement)) toggle.current?.focus();
      setExpanded(false);
    };
    const onShortcut = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('a[href="#map-frame"]')) onClean();
    };
    window.addEventListener('lentera:clean-map', onClean);
    document.addEventListener('click', onShortcut);
    return () => {
      query.removeEventListener('change', sync);
      window.removeEventListener('lentera:clean-map', onClean);
      document.removeEventListener('click', onShortcut);
    };
  }, []);
  return <aside className="workspace-layer-panel" data-expanded={expanded} aria-label="Kontrol peta">
    <div className="workspace-panel-heading"><div><span className="eyebrow">LENTERA / PEMANTAUAN</span><h2>Jelajahi peta</h2></div><button ref={toggle} type="button" aria-expanded={expanded} aria-controls="workspace-layer-body workspace-search-slot workspace-pinned-slot" onClick={() => { if (body.current?.contains(document.activeElement) || searchHost.current?.contains(document.activeElement)) toggle.current?.focus(); setExpanded(v => !v); }}>{expanded ? 'Ciutkan' : 'Lapisan & filter'}<span aria-hidden="true"> {expanded ? '−' : '+'}</span></button></div>
    <div ref={searchHost} id="workspace-search-slot" className="workspace-search-slot" hidden={!expanded}>{search}</div>
    <div id="workspace-pinned-slot" className="workspace-pinned-slot" hidden={!expanded}>{pinned}</div>
    <div ref={body} id="workspace-layer-body" className="workspace-panel-body" hidden={!expanded}>{children}</div>
  </aside>;
}
