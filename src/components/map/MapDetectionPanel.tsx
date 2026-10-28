'use client';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
interface FrameProps {
  open: boolean; count: number | null; children: ReactNode;
  onToggle: () => void; onClose: () => void;
  rootRef?: RefObject<HTMLElement | null>; triggerRef?: RefObject<HTMLButtonElement | null>; bodyRef?: RefObject<HTMLDivElement | null>;
}
// Pure presentation lets close/keyboard wiring be checked without a WebGL host.
export function DetectionPanelFrame({ open, count, children, onToggle, onClose, rootRef, triggerRef, bodyRef }: FrameProps) {
  return <section ref={rootRef} className="workspace-detection-panel" data-open={open} aria-label="Panel Daftar Deteksi" onKeyDown={event => {
    if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
  }}>
    <header className="workspace-detection-header">
      <h2><button ref={triggerRef} id="workspace-detection-toggle" type="button" aria-expanded={open} aria-controls="workspace-detection-body" onClick={onToggle}>
        <span><strong>Daftar Deteksi</strong><small>{count === null ? 'Belum tersedia' : `${count.toLocaleString('id-ID')} dalam tampilan`}</small></span><span aria-hidden="true">{open ? '−' : '+'}</span>
      </button></h2>
      {open && <button className="workspace-detection-close" type="button" aria-label="Tutup panel Daftar Deteksi" onClick={onClose}><span aria-hidden="true">×</span> Tutup</button>}
    </header>
    <div ref={bodyRef} id="workspace-detection-body" className="workspace-detection-body" hidden={!open}>{children}</div>
  </section>;
}
export function MapDetectionPanel({ selectedId, count, onCloseSelection, children }: { selectedId: string | null; count: number | null; onCloseSelection?: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(() => Boolean(selectedId));
  const root = useRef<HTMLElement>(null), trigger = useRef<HTMLButtonElement>(null), body = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selectedId) setOpen(true); }, [selectedId]);
  useEffect(() => {
    if (!open || !selectedId) return;
    const frame = requestAnimationFrame(() => {
      if (!body.current || body.current.hidden) return;
      const detail = body.current.querySelector<HTMLElement>('.detection-detail');
      if (detail) { detail.focus({ preventScroll: true }); body.current.scrollTop = Math.max(0, detail.offsetTop - 12); }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, selectedId]);
  useEffect(() => {
    const workspace = root.current?.closest('.map-workspace');
    let frame = 0;
    const reveal = () => {
      setOpen(true); cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { if (!body.current?.hidden) body.current?.querySelector<HTMLElement>('#detection-heading')?.focus({ preventScroll: true }); });
    };
    const onHash = () => { if (window.location.hash === '#detection-list' || window.location.hash === '#detection-heading') reveal(); };
    const onShortcut = (event: Event) => {
      const click = event as MouseEvent;
      if (click.defaultPrevented || click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
      const anchor = click.target instanceof Element ? click.target.closest('a[href]') : null;
      const href = anchor?.getAttribute('href');
      if (href === '#detection-list') {
        event.preventDefault();
        setOpen(current => {
          if (current) {
            if (selectedId) onCloseSelection?.();
            trigger.current?.focus({ preventScroll: true });
            return false;
          } else {
            reveal();
            return true;
          }
        });
      } else if (href === '#map-frame' || href === '#location-panel') {
        setOpen(false);
        if (selectedId) onCloseSelection?.();
      }
    };
    const onClean = () => {
      setOpen(false);
      if (selectedId) onCloseSelection?.();
    };
    onHash();
    workspace?.addEventListener('click', onShortcut);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('lentera:clean-map', onClean);
    return () => {
      cancelAnimationFrame(frame);
      workspace?.removeEventListener('click', onShortcut);
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('lentera:clean-map', onClean);
    };
  }, [selectedId, onCloseSelection]);
  useEffect(() => {
    const link = root.current?.closest('.map-workspace')?.querySelector('a[href="#detection-list"]');
    if (link) link.setAttribute('aria-expanded', String(open));
  }, [open]);
  const close = () => {
    setOpen(false);
    if (selectedId) onCloseSelection?.();
    trigger.current?.focus({ preventScroll: true });
  };
  return <DetectionPanelFrame open={open} count={count} rootRef={root} triggerRef={trigger} bodyRef={body} onToggle={() => { if (open) close(); else setOpen(true); }} onClose={close}>{children}</DetectionPanelFrame>;
}
