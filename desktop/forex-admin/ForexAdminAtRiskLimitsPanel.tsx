/**
 * Stage 4 — AT instrument risk limits (spread/slippage).
 * Propose ≠ approve. Never invents thresholds. No execution controls.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { atRiskPolicyApi } from "./api";

const INSTRUMENTS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"] as const;

type Kind = "spread" | "slippage";

type LimitSlot = {
  maxSpreadAbsolute?: number | null;
  maxSlippageAbsolute?: number | null;
  approvalState?: string;
  status?: string;
  reason?: string | null;
  configVersion?: number;
  approvedAtUtc?: string | null;
  approvedBy?: string | null;
  effectiveAtUtc?: string | null;
  pricePrecision?: number | null;
  proposed?: {
    value: number;
    proposedAtUtc: string;
    proposedBy: string;
    note?: string | null;
  } | null;
  history?: Array<Record<string, unknown>>;
};

type InstrumentPolicy = {
  instrument: string;
  documentedPricePrecision: number | null;
  spread: LimitSlot;
  slippage: LimitSlot;
};

type PolicyDoc = {
  version: number;
  updatedAtUtc: string;
  stage: string;
  instruments: Record<string, InstrumentPolicy>;
};

function activeValue(kind: Kind, slot: LimitSlot | undefined): number | null {
  if (!slot) return null;
  const v = kind === "spread" ? slot.maxSpreadAbsolute : slot.maxSlippageAbsolute;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function stateTone(state: string | undefined): "ok" | "warn" | "danger" | undefined {
  switch (state) {
    case "APPROVED":
      return "ok";
    case "PENDING_APPROVAL":
      return "warn";
    case "REJECTED":
    case "INVALID":
      return "danger";
    default:
      return undefined;
  }
}

export function ForexAdminAtRiskLimitsPanel() {
  const [doc, setDoc] = useState<PolicyDoc | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [instrument, setInstrument] = useState<(typeof INSTRUMENTS)[number]>("EUR/USD");
  const [kind, setKind] = useState<Kind>("spread");
  const [draftValue, setDraftValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [pol, hist] = await Promise.all([
        atRiskPolicyApi.get(),
        atRiskPolicyApi.history(30),
      ]);
      if (!mounted.current) return;
      setDoc(pol.riskPolicy as unknown as PolicyDoc);
      setHistory(hist.history || []);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to load AT risk policy.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const row = useMemo(() => doc?.instruments?.[instrument] ?? null, [doc, instrument]);
  const slot = kind === "spread" ? row?.spread : row?.slippage;

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        instrument,
        kind,
        action,
        expectedVersion: doc?.version ?? undefined,
        actor: "forex-admin-ui",
        ...extra,
      };
      if (action === "propose") {
        const n = Number(draftValue);
        if (!Number.isFinite(n) || !(n > 0)) {
          throw new Error("Enter a finite positive absolute-price value to propose.");
        }
        body.value = n;
      }
      if (action === "approve") {
        body.confirm = true;
      }
      const res = await atRiskPolicyApi.mutate(body);
      if (!mounted.current) return;
      setDoc(res.riskPolicy as unknown as PolicyDoc);
      setMessage(res.note || `Action ${action} succeeded.`);
      setDraftValue("");
      const hist = await atRiskPolicyApi.history(30);
      if (mounted.current) setHistory(hist.history || []);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : `Action ${action} failed.`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function onApprove() {
    const proposed = slot?.proposed?.value;
    const ok = window.confirm(
      `Approve ${kind} limit for ${instrument}?\n\n`
      + `Proposed: ${proposed ?? "n/a"} (absolute price units)\n`
      + `This activates the limit for precheck. It does NOT enable trading or place orders.`,
    );
    if (!ok) return;
    void runAction("approve");
  }

  return (
    <section className="fxa-card" data-forex-admin-at-risk-limits>
      <h2>AT risk limits (Stage 4)</h2>
      <p className="fxa-muted">
        Instrument-specific absolute spread/slippage limits for Automated Trading precheck.
        Propose a value, then approve explicitly. Pending values are not active.
        Units: absolute price (same scale as bid/ask). No invented thresholds. No order submission.
      </p>

      <div className="fxa-row" style={{ gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <label>
          Instrument{" "}
          <select
            value={instrument}
            onChange={(e) => setInstrument(e.target.value as (typeof INSTRUMENTS)[number])}
            disabled={busy}
          >
            {INSTRUMENTS.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </label>
        <label>
          Kind{" "}
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            disabled={busy}
          >
            <option value="spread">Spread</option>
            <option value="slippage">Slippage</option>
          </select>
        </label>
        <button type="button" className="fxa-btn-secondary" onClick={() => void load()} disabled={busy}>
          Refresh
        </button>
      </div>

      {doc && (
        <p className="fxa-muted" style={{ marginTop: 0 }}>
          Document v{doc.version} · updated {doc.updatedAtUtc} · precision guidance{" "}
          {row?.documentedPricePrecision ?? "n/a"} decimals
        </p>
      )}

      <div style={{ overflowX: "auto", marginBottom: 16 }}>
        <table className="fxa-table" style={{ width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Spread active</th>
              <th>Spread state</th>
              <th>Slippage active</th>
              <th>Slippage state</th>
            </tr>
          </thead>
          <tbody>
            {INSTRUMENTS.map((inst) => {
              const r = doc?.instruments?.[inst];
              return (
                <tr key={inst} style={{ cursor: "pointer" }} onClick={() => setInstrument(inst)}>
                  <td><strong>{inst}</strong></td>
                  <td>{activeValue("spread", r?.spread) ?? "—"}</td>
                  <td><span className="fxa-badge" data-tone={stateTone(r?.spread?.approvalState)}>{r?.spread?.approvalState ?? "NOT_CONFIGURED"}</span></td>
                  <td>{activeValue("slippage", r?.slippage) ?? "—"}</td>
                  <td><span className="fxa-badge" data-tone={stateTone(r?.slippage?.approvalState)}>{r?.slippage?.approvalState ?? "NOT_CONFIGURED"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="fxa-card" style={{ boxShadow: "none", border: "1px solid var(--fxa-border, #ddd)" }}>
        <h3 style={{ marginTop: 0 }}>{instrument} · {kind}</h3>
        <p className="fxa-muted">
          Active: <strong>{activeValue(kind, slot) ?? "NOT_CONFIGURED"}</strong>
          {" · "}
          State: <span className="fxa-badge" data-tone={stateTone(slot?.approvalState)}>{slot?.approvalState ?? "NOT_CONFIGURED"}</span>
          {" · "}
          config v{slot?.configVersion ?? 0}
        </p>
        {slot?.approvedBy && (
          <p className="fxa-muted">
            Approved by {slot.approvedBy} at {slot.approvedAtUtc}
            {slot.effectiveAtUtc ? ` · effective ${slot.effectiveAtUtc}` : ""}
          </p>
        )}
        {slot?.proposed && (
          <p>
            Pending proposal: <strong>{slot.proposed.value}</strong> by {slot.proposed.proposedBy} at{" "}
            {slot.proposed.proposedAtUtc}
          </p>
        )}
        {slot?.reason && <p className="fxa-muted">{slot.reason}</p>}

        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            Propose value{" "}
            <input
              type="number"
              step="any"
              min="0"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              disabled={busy}
              placeholder="absolute price"
              style={{ width: 140 }}
            />
          </label>
          <button type="button" className="fxa-btn" disabled={busy} onClick={() => void runAction("propose")}>
            Propose
          </button>
          <button
            type="button"
            className="fxa-btn"
            disabled={busy || slot?.approvalState !== "PENDING_APPROVAL"}
            onClick={onApprove}
          >
            Approve…
          </button>
          <button
            type="button"
            className="fxa-btn-secondary"
            disabled={busy || slot?.approvalState !== "PENDING_APPROVAL"}
            onClick={() => void runAction("reject", { reason: "Rejected from Forex Admin UI." })}
          >
            Reject
          </button>
          <button
            type="button"
            className="fxa-btn-secondary"
            disabled={busy || !(slot?.history && slot.history.length > 0)}
            onClick={() => {
              if (!window.confirm(`Roll back ${kind} for ${instrument} to previous approved value?`)) return;
              void runAction("rollback");
            }}
          >
            Rollback
          </button>
          <button
            type="button"
            className="fxa-btn-secondary"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Clear active and proposed ${kind} for ${instrument}?`)) return;
              void runAction("clear");
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {message && <p className="fxa-muted">{message}</p>}
      {error && <p className="fxa-error">{error}</p>}

      <h3>Recent audit</h3>
      <div style={{ overflowX: "auto", maxHeight: 220 }}>
        <table className="fxa-table" style={{ width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Instrument</th>
              <th>Actor</th>
              <th>Prev → Next</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().slice(0, 20).map((h, idx) => (
              <tr key={`${h.atUtc}-${idx}`}>
                <td>{String(h.atUtc ?? "")}</td>
                <td>{String(h.action ?? "")}</td>
                <td>{String(h.instrument ?? "—")}</td>
                <td>{String(h.actor ?? "")}</td>
                <td>{String(h.previousValue ?? "—")} → {String(h.nextValue ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
