import { useCallback, useEffect, useState } from "react";
import { fetchHfmReasonHistory, fetchHfmReasonById } from "../api";
import { parseHfmAnalysisRecord } from "./parse-hfm-analysis-result";

interface HistoryRow {
  analysisId: string;
  createdAt: string | null;
  symbol: string | null;
  action: string;
  decisionStatus: string | null;
  completeness: string | null;
  groundingStatus: string | null;
  snapshotId: string | null;
  selectedScenarioId: string | null;
  status: string | null;
  errorCode: string | null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function toRow(item: Record<string, unknown>): HistoryRow {
  const view = parseHfmAnalysisRecord(item);
  const lineage = asRecord(item.lineage);
  return {
    analysisId: str(item.analysisId) ?? "—",
    createdAt: str(item.createdAt) ?? str(item.completedAt),
    symbol: view?.symbol ?? str(item.symbol),
    action: view?.action ?? "NONE",
    decisionStatus: view?.decisionStatus ?? null,
    completeness: view?.completeness ?? null,
    groundingStatus: view?.groundingStatus ?? str(lineage?.groundingStatus),
    snapshotId: view?.snapshotId ?? str(item.snapshotId),
    selectedScenarioId: view?.selectedScenarioId ?? str(lineage?.selectedScenarioId),
    status: str(item.status),
    errorCode: str(item.errorCode),
  };
}

export function HfmAnalysisHistory(props: {
  symbol: string;
  onSelect: (analysis: Record<string, unknown>) => void;
  onLoadSymbolOnChart: (symbol: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [rawById, setRawById] = useState<Record<string, Record<string, unknown>>>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const body = await fetchHfmReasonHistory({ symbol: props.symbol, limit: 20 });
      const items = Array.isArray(body.items) ? body.items : [];
      const map: Record<string, Record<string, unknown>> = {};
      const next: HistoryRow[] = [];
      for (const item of items) {
        const rec = asRecord(item);
        if (!rec) continue;
        const row = toRow(rec);
        next.push(row);
        map[row.analysisId] = rec;
      }
      setRows(next);
      setRawById(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [props.symbol]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const onPick = async (id: string) => {
    setSelectedId(id);
    let raw = rawById[id];
    if (!raw) {
      const body = await fetchHfmReasonById(id);
      raw = asRecord(body.analysis) ?? undefined;
    }
    if (raw) props.onSelect(raw);
  };

  return (
    <section className="hap-history" data-analysis-history="true">
      <button type="button" className="hap-btn" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide analysis history" : "Show analysis history"}
      </button>
      {open ? (
        <div className="hap-history-panel">
          <p className="hap-empty">
            View-only by default. Chart symbol does not change until you choose Load symbol on chart.
          </p>
          {error ? <p className="hap-error">{error}</p> : null}
          <div className="hap-history-table-wrap">
            <table className="hap-history-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Symbol</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Complete</th>
                  <th>Grounding</th>
                  <th>Snapshot</th>
                  <th>Scenario</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.analysisId} data-selected={selectedId === r.analysisId ? "true" : "false"}>
                    <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</td>
                    <td>{r.symbol ?? "—"}</td>
                    <td>{r.action}</td>
                    <td>{r.decisionStatus ?? r.status ?? "—"}</td>
                    <td>{r.completeness ?? "—"}</td>
                    <td>{r.groundingStatus ?? "—"}</td>
                    <td className="hap-mono">{(r.snapshotId ?? "—").slice(0, 8)}</td>
                    <td className="hap-mono">{(r.selectedScenarioId ?? "—").slice(0, 10)}</td>
                    <td>
                      <button type="button" className="hap-btn" onClick={() => void onPick(r.analysisId)}>
                        View
                      </button>
                      {r.symbol ? (
                        <button
                          type="button"
                          className="hap-btn"
                          data-load-symbol-on-chart="true"
                          onClick={() => props.onLoadSymbolOnChart(r.symbol!)}
                        >
                          Load symbol on chart
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={9} className="hap-empty">No history for {props.symbol}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
