/**
 * Phase 04 — compact HFM MT5 opportunity lifecycle view (analytical only).
 * Confirmed ≠ executed trade. No broker order controls.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchHfmOpportunityLifecycleHistory,
  fetchHfmOpportunityLifecycleList,
  fetchHfmOpportunityLifecycleMonitorStatus,
} from "../api";

type FilterKey =
  | "ACTIVE"
  | "CONFIRMED"
  | "INVALIDATED"
  | "EXPIRED"
  | "OUTCOME_EVALUATED"
  | "ALL";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "ACTIVE", label: "Active" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "INVALIDATED", label: "Invalidated" },
  { key: "EXPIRED", label: "Expired" },
  { key: "OUTCOME_EVALUATED", label: "Outcome evaluated" },
  { key: "ALL", label: "All" },
];

function matchesFilter(
  filter: FilterKey,
  row: Record<string, unknown>,
): boolean {
  const life = String(row.lifecycleState || "");
  const semantic = String(row.semanticLifecycleStage || "");
  switch (filter) {
    case "ACTIVE":
      return ["DETECTED", "ACTIVE", "NEEDS_CONFIRMATION", "CONFIRMED"].includes(life);
    case "CONFIRMED":
      return life === "CONFIRMED" || semantic === "CONFIRMED" || semantic === "OUTCOME_PENDING";
    case "INVALIDATED":
      return life === "INVALIDATED" || life === "REJECTED" || life === "INVALID";
    case "EXPIRED":
      return life === "EXPIRED";
    case "OUTCOME_EVALUATED":
      return life === "COMPLETED" || life === "OUTCOME_UNKNOWN" || semantic === "OUTCOME_EVALUATED";
    default:
      return true;
  }
}

export function HfmOpportunityLifecyclePanel(props: {
  symbol: string;
}): JSX.Element {
  const symbol = String(props.symbol || "").trim().toUpperCase() || "XAUUSD";
  const [filter, setFilter] = useState<FilterKey>("ACTIVE");
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [monitor, setMonitor] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listBody, monBody] = await Promise.all([
        fetchHfmOpportunityLifecycleList({ symbol, limit: 40 }),
        fetchHfmOpportunityLifecycleMonitorStatus(),
      ]);
      const rows = Array.isArray(listBody.items)
        ? (listBody.items as Array<Record<string, unknown>>)
        : [];
      setItems(rows);
      setMonitor((monBody.monitor as Record<string, unknown>) ?? null);
      if (rows.length && !selectedId) {
        setSelectedId(String(rows[0]!.candidateId || ""));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [symbol, selectedId]);

  useEffect(() => {
    void load();
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional symbol-driven reload

  useEffect(() => {
    if (!selectedId) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const body = await fetchHfmOpportunityLifecycleHistory(selectedId);
        if (!cancelled) {
          setHistory(Array.isArray(body.history) ? (body.history as Array<Record<string, unknown>>) : []);
        }
      } catch {
        if (!cancelled) setHistory([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const visible = useMemo(
    () => items.filter((row) => matchesFilter(filter, row)),
    [items, filter],
  );

  const selected = visible.find((r) => String(r.candidateId) === selectedId)
    ?? items.find((r) => String(r.candidateId) === selectedId)
    ?? null;

  const levels = (selected?.candidateSnapshot as Record<string, unknown> | undefined) ?? {};
  const notes = String(levels.thesis || selected?.thesis || "");

  return (
    <section
      className="hap-lifecycle"
      data-hfm-lifecycle-panel="true"
      data-not-a-trade="true"
      aria-label="HFM opportunity lifecycle"
    >
      <header className="hap-lifecycle-head">
        <h3>Opportunity lifecycle</h3>
        <p className="hap-lifecycle-note">
          Analytical monitoring only — confirmed is not an executed trade.
        </p>
        <button type="button" disabled={loading} onClick={() => void load()}>
          Refresh
        </button>
      </header>

      <div className="hap-lifecycle-filters" role="tablist" aria-label="Lifecycle filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            data-filter={f.key}
            className={filter === f.key ? "is-active" : undefined}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? <p className="hap-lifecycle-error" data-error="true">{error}</p> : null}

      <div className="hap-lifecycle-monitor" data-monitor-health="true">
        <span>
          Monitor: {String(monitor?.enabled === true ? "enabled" : "disabled")}
        </span>
        <span>
          Health: {String(monitor?.lastEvidenceHealth || monitor?.lastStatus || "n/a")}
        </span>
        <span>
          Last: {String(monitor?.lastCompletedAt || "never")}
        </span>
      </div>

      <div className="hap-lifecycle-body">
        <ul className="hap-lifecycle-list" data-lifecycle-list="true">
          {visible.length === 0 ? (
            <li data-empty="true">{loading ? "Loading…" : "No opportunities in this filter."}</li>
          ) : (
            visible.map((row) => {
              const id = String(row.candidateId || "");
              return (
                <li key={id}>
                  <button
                    type="button"
                    data-candidate-id={id}
                    className={id === selectedId ? "is-selected" : undefined}
                    onClick={() => setSelectedId(id)}
                  >
                    <strong>{String(row.semanticLifecycleStage || row.lifecycleState)}</strong>
                    {" · "}
                    {String(row.direction || "?")}
                    {" · "}
                    {String(row.strategyId || "")}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {selected ? (
          <div className="hap-lifecycle-detail" data-lifecycle-detail="true">
            <dl>
              <div>
                <dt>Lifecycle</dt>
                <dd>{String(selected.lifecycleState)}</dd>
              </div>
              <div>
                <dt>Semantic</dt>
                <dd>{String(selected.semanticLifecycleStage || "—")}</dd>
              </div>
              <div>
                <dt>Symbol</dt>
                <dd>{String(selected.providerSymbol)}</dd>
              </div>
              <div>
                <dt>Direction</dt>
                <dd>{String(selected.direction)}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{String(selected.createdAt)}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{String(selected.updatedAt)}</dd>
              </div>
              <div>
                <dt>Outcome</dt>
                <dd>{String(selected.outcomeKind || "NONE")}</dd>
              </div>
              <div>
                <dt>Evidence refs</dt>
                <dd>
                  {Array.isArray(selected.supportingEvidenceIds)
                    ? (selected.supportingEvidenceIds as string[]).slice(0, 8).join(", ") || "—"
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Run / snapshot</dt>
                <dd>{String(selected.runId || "—")}</dd>
              </div>
            </dl>
            {notes ? <p className="hap-lifecycle-thesis">{notes.slice(0, 280)}</p> : null}
            <p className="hap-lifecycle-disclaimer" data-not-executed="true">
              Market status ≠ lifecycle status ≠ historical outcome. No broker execution.
            </p>
            <h4>Transition history</h4>
            <ol className="hap-lifecycle-history" data-lifecycle-history="true">
              {history.length === 0 ? (
                <li>No transitions yet.</li>
              ) : (
                history.map((ev) => (
                  <li key={String(ev.eventId)}>
                    {String(ev.fromState || "∅")} → {String(ev.toState)}
                    {" · "}
                    {String(ev.reason)}
                    {" · "}
                    {String(ev.observedAt)}
                    {ev.candleStatusUsed
                      ? ` · candle=${String(ev.candleStatusUsed)}/${String(ev.candleTimeframe || "?")}`
                      : ""}
                  </li>
                ))
              )}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
