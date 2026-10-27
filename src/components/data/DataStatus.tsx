import type { DataState } from "@/lib/contracts";

const labels: Record<DataState, string> = { ok: "Data tersedia", partial: "Cakupan sebagian", stale: "Data lama", unavailable: "Data belum tersedia" };
export function DataStatus({ state, children }: { state: DataState; children?: React.ReactNode }) {
  return <div className={`data-status state-${state}`}><span className="status-label"><span aria-hidden="true">●</span> {labels[state]}</span>{children && <span>{children}</span>}</div>;
}
