/**
 * Stage 5 — Per-order risk monitoring (read-only).
 * No submit / modify / close broker order controls.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { atPerOrderRiskApi } from "./api";

type RiskRow = {
  proposalId: string;
  instrument: string | null;
  direction: string | null;
  lifecycle: string;
  displayCategory: string;
  capitalAllocation: number | null;
  operatingRiskPercent: number | null;
  hardMaximumRiskPercent: number | null;
  maximumAllowedMonetaryLoss: number | null;
  plannedMonetaryRisk: number | null;
  actualModeledMonetaryRisk: number | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  expectedMonetaryProfit: number | null;
  actualRewardToRiskRatio: number | null;
  calculatedQuantity: number | null;
  contractSize: number | null;
  marginVerificationStatus: string | null;
  spreadPolicyStatus: string | null;
  slippagePolicyStatus: string | null;
  validationResult: string | null;
  rejectionReasons: Array<{ code: string; message: string }>;
  riskCalculationTimestampUtc: string | null;
  allocationId: string | null;
};

function fmt(n: number | null | undefined, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function categoryTone(cat: string): "ok" | "warn" | "danger" | undefined {
  switch (cat) {
    case "VALIDATED_PROPOSAL":
      return "ok";
    case "WAITING_FOR_DATA":
      return "warn";
    case "INVALID_RISK":
    case "EXPIRED_PROPOSAL":
    case "BLOCKED_PROPOSAL":
      return "danger";
    default:
      return undefined;
  }
}

export function ForexAdminPerOrderRiskPanel() {
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<RiskRow | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await atPerOrderRiskApi.list(40);
      if (!mounted.current) return;
      setRows((res.records || []) as RiskRow[]);
      setNote(res.note || null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to load per-order risk records.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="fxa-card" data-forex-admin-per-order-risk>
      <div className="fxa-row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2>Per-order risk engine</h2>
        <button type="button" className="fxa-btn" onClick={() => void load()} disabled={busy}>
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p className="fxa-muted">
        Stage 5 automated capital allocation, Stop Loss, position size, and 3R Take Profit —
        read-only monitoring. Modeled Stop Loss risk is not a guaranteed realized-loss ceiling.
        No broker submit / modify / close actions.
      </p>
      {note ? <p className="fxa-muted">{note}</p> : null}
      {error ? <p className="fxa-error">{error}</p> : null}

      <div className="fxa-table-wrap">
        <table className="fxa-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Instrument</th>
              <th>Side</th>
              <th>Alloc</th>
              <th>Risk %</th>
              <th>SL risk</th>
              <th>TP / R:R</th>
              <th>Qty</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="fxa-muted">No proposals yet.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.proposalId}
                  onClick={() => setSelected(r)}
                  style={{ cursor: "pointer" }}
                  data-tone={categoryTone(r.displayCategory)}
                >
                  <td>
                    <span className={`fxa-badge${categoryTone(r.displayCategory) ? ` fxa-badge--${categoryTone(r.displayCategory)}` : ""}`}>
                      {r.displayCategory}
                    </span>
                  </td>
                  <td>{r.instrument ?? "—"}</td>
                  <td>{r.direction ?? "—"}</td>
                  <td>{fmt(r.capitalAllocation, 2)}</td>
                  <td>{r.operatingRiskPercent ?? "—"}/{r.hardMaximumRiskPercent ?? "—"}</td>
                  <td>{fmt(r.actualModeledMonetaryRisk, 4)}</td>
                  <td>{fmt(r.expectedMonetaryProfit, 4)} / {fmt(r.actualRewardToRiskRatio, 2)}</td>
                  <td>{fmt(r.calculatedQuantity, 4)}</td>
                  <td>{r.validationResult ?? r.lifecycle}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="fxa-card" style={{ marginTop: "0.75rem" }}>
          <div className="fxa-row" style={{ justifyContent: "space-between" }}>
            <h3>Proposal {selected.proposalId}</h3>
            <button type="button" className="fxa-btn" onClick={() => setSelected(null)}>Close</button>
          </div>
          <dl className="fxa-dl">
            <dt>Allocation ID</dt><dd>{selected.allocationId ?? "—"}</dd>
            <dt>Entry / SL / TP</dt>
            <dd>{fmt(selected.entryPrice)} / {fmt(selected.stopLoss)} / {fmt(selected.takeProfit)}</dd>
            <dt>Max permitted loss</dt><dd>{fmt(selected.maximumAllowedMonetaryLoss, 4)}</dd>
            <dt>Planned monetary risk</dt><dd>{fmt(selected.plannedMonetaryRisk, 4)}</dd>
            <dt>Contract size</dt><dd>{fmt(selected.contractSize, 4)}</dd>
            <dt>Margin</dt><dd>{selected.marginVerificationStatus ?? "—"}</dd>
            <dt>Spread / Slippage policy</dt>
            <dd>{selected.spreadPolicyStatus ?? "—"} / {selected.slippagePolicyStatus ?? "—"}</dd>
            <dt>Calculated at</dt><dd>{selected.riskCalculationTimestampUtc ?? "—"}</dd>
          </dl>
          {selected.rejectionReasons?.length ? (
            <ul className="fxa-list">
              {selected.rejectionReasons.map((x, i) => (
                <li key={`${x.code}-${i}`}>
                  <code>{x.code}</code> — {x.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="fxa-muted">No rejection reasons.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
