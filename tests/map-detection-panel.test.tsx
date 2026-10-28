// Unit event-wiring and SSR checks; not a DOM/browser interaction test.
import { Children, isValidElement, type ReactNode, type KeyboardEvent } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DetectionPanelFrame, MapDetectionPanel } from '../src/components/map/MapDetectionPanel';
type NodeProps = { children?: ReactNode; id?: string; 'aria-label'?: string; onClick?: () => void };
function button(node: ReactNode, name: string): NodeProps | null {
  if (!isValidElement(node)) return null;
  const props=node.props as NodeProps;
  if(node.type==='button' && (props.id===name || props['aria-label']===name)) return props;
  for(const child of Children.toArray(props.children)){const found=button(child,name);if(found)return found;}
  return null;
}
function frame(open: boolean, onClose=vi.fn(), onToggle=vi.fn()) {
  return DetectionPanelFrame({open,count:null,onClose,onToggle,children:<p>Data belum tersedia; bukan angka nol.</p>});
}
describe('Daftar Deteksi explicit close regression',()=>{
 it('always exposes a working close action when open, even without a selected detection or data',()=>{
  const close=vi.fn(),toggle=vi.fn(),tree=frame(true,close,toggle);
  button(tree,'Tutup panel Daftar Deteksi')!.onClick!();
  expect(close).toHaveBeenCalledTimes(1);expect(toggle).not.toHaveBeenCalled();
  const html=renderToString(tree);expect(html).toContain('aria-expanded="true"');expect(html).toContain('data-open="true"');
 });
 it('keeps its opener and mounted alternative data after collapse, and can be opened again',()=>{
  const open=vi.fn(),tree=frame(false,vi.fn(),open),html=renderToString(tree);
  expect(button(tree,'Tutup panel Daftar Deteksi')).toBeNull();button(tree,'workspace-detection-toggle')!.onClick!();expect(open).toHaveBeenCalledTimes(1);
  expect(html).toContain('aria-expanded="false"');expect(html).toContain('id="workspace-detection-body"');expect(html).toContain('hidden=""');expect(html).toContain('Data belum tersedia; bukan angka nol.');
 });
 it('uses Escape inside the open panel without swallowing unrelated keys or closed-panel input',()=>{
  const close=vi.fn(),tree=frame(true,close),event={key:'Escape',preventDefault:vi.fn(),stopPropagation:vi.fn()} as unknown as KeyboardEvent<HTMLElement>;
  tree.props.onKeyDown(event);expect(close).toHaveBeenCalledTimes(1);expect(event.preventDefault).toHaveBeenCalled();expect(event.stopPropagation).toHaveBeenCalled();
  tree.props.onKeyDown({...event,key:'ArrowDown'});frame(false,close).props.onKeyDown(event);expect(close).toHaveBeenCalledTimes(1);
 });
 it('uses explicit state from the first render, opening a selected item without native details layout',()=>{
  const selected=renderToString(<MapDetectionPanel selectedId="synthetic-test-detection" count={null}><p>Isolated test content</p></MapDetectionPanel>);
  const idle=renderToString(<MapDetectionPanel selectedId={null} count={null}><p>Isolated test content</p></MapDetectionPanel>);
  expect(selected).toContain('Tutup panel Daftar Deteksi');expect(selected).not.toContain('<details');expect(idle).toContain('aria-expanded="false"');
 });
 it('toggles open/close through header toggle button',()=>{
  const onToggle=vi.fn(),openTree=frame(true,vi.fn(),onToggle);
  button(openTree,'workspace-detection-toggle')!.onClick!();
  expect(onToggle).toHaveBeenCalledTimes(1);
 });
});
