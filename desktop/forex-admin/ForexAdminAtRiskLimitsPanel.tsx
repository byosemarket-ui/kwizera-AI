/**
 * Stage 4 — AT instrument risk limits (spread/slippage).
 * Propose ≠ approve. Never invents thresholds. No execution controls.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { atOwnerAuthApi, atRiskPolicyApi } from "./api";
import {
  getForexOwnerToken,
  maskForexOwnerToken,
  saveForexOwnerToken,
} from "../forex/admin-access/forex-owner-token";

const INSTRUMENTS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"] as const;
/** KWIZERA AI STUDIO → FOREX → AUTOMATED TRADING — active phase (XAU only). */
const ACTIVE_PHASE_INSTRUMENTS = new Set<string>(["XAU/USD"]);

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
  const [instrument, setInstrument] = useState<(typeof INSTRUMENTS)[number]>("XAU/USD");
  const [kind, setKind] = useState<Kind>("spread");
  const [draftValue, setDraftValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ownerStatus, setOwnerStatus] = useState<Record<string, unknown> | null>(null);
  const [ownerTokenDraft, setOwnerTokenDraft] = useState("");
  const [ownerMasked, setOwnerMasked] = useState<string | null>(maskForexOwnerToken(getForexOwnerToken()));
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
      const [pol, hist, owner] = await Promise.all([
        atRiskPolicyApi.get(),
        atRiskPolicyApi.history(30),
        atOwnerAuthApi.status().catch(() => null),
      ]);
      if (!mounted.current) return;
      setDoc(pol.riskPolicy as unknown as PolicyDoc);
      setHistory(hist.history || []);
      setOwnerStatus((owner as { owner?: Record<string, unknown> } | null)?.owner
        || (pol as { ownerAuthorization?: Record<string, unknown> }).ownerAuthorization
        || null);
      setOwnerMasked(maskForexOwnerToken(getForexOwnerToken()));
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
      const ownerAction = action === "approve" || action === "reject"
        || action === "rollback" || action === "clear";
      if (ownerAction && !getForexOwnerToken()) {
        throw new Error(
          "Owner-only action. Enter the server KWIZERA_OWNER_API_TOKEN in the Owner session field first "
          + "(distinct from the Admin token).",
        );
      }
      const res = await atRiskPolicyApi.mutate(body, { ownerAction });
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
      <h2>AT risk limits (Stage 4 / 7.2)</h2>
      <p className="fxa-muted">
        Instrument-specific absolute spread/slippage limits for Automated Trading precheck.
        Forex Admin may propose. Approve / reject / rollback / clear require system-owner token.
        Pending values are not active. Units: absolute price (same scale as bid/ask).
        Slippage is measured vs executable-side price (entry_vs_executable). No invented thresholds.
        No order submission. Does not enable Execution Master.
        {" "}
        Active phase: <strong>XAU/USD only</strong> — EUR/GBP/JPY remain in the catalog as OUT_OF_SCOPE.
      </p>
      <dl className="fxa-dl">
        <dt>Owner capability</dt>
        <dd>
          configured={String(ownerStatus?.ownerConfigured ?? "—")}; distinct=
          {String(ownerStatus?.ownerDistinctFromAdmin ?? "—")}; principal=
          {String(ownerStatus?.principalId ?? "—")}
        </dd>
        <dt>Permission model</dt>
        <dd>Admin: propose · Owner: approve/reject/rollback/clear</dd>
        <dt>Owner session token</dt>
        <dd>
          {ownerMasked ? `present (${ownerMasked})` : "not set in this browser tab"}
          <div className="fxa-row" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <input
              type="password"
              autoComplete="off"
              value={ownerTokenDraft}
              onChange={(e) => setOwnerTokenDraft(e.target.value)}
              placeholder="KWIZERA_OWNER_API_TOKEN (session only)"
              style={{ minWidth: 220 }}
              disabled={busy}
            />
            <button
              type="button"
              className="fxa-btn-secondary"
              disabled={busy}
              onClick={() => {
                const r = saveForexOwnerToken(ownerTokenDraft);
                setOwnerMasked(r.masked);
                setOwnerTokenDraft("");
                setMessage(r.ok ? "Owner session token saved for this tab." : "Failed to save owner token.");
              }}
            >
              Save owner token
            </button>
            <button
              type="button"
              className="fxa-btn-secondary"
              disabled={busy}
              onClick={() => {
                saveForexOwnerToken("");
                setOwnerMasked(null);
                setMessage("Owner session token cleared.");
              }}
            >
              Clear owner token
            </button>
          </div>
        </dd>
      </dl>

      <div className="fxa-row" style={{ gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <label>
          Instrument{" "}
          <select
            value={instrument}
            onChange={(e) => setInstrument(e.target.value as (typeof INSTRUMENTS)[number])}
            disabled={busy}
          >
            {INSTRUMENTS.map((i) => (
              <option key={i} value={i}>
                {i}{ACTIVE_PHASE_INSTRUMENTS.has(i) ? " · ACTIVE" : " · OUT_OF_SCOPE"}
              </option>
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
            title="Owner-only"
          >
            Owner approve…
          </button>
          <button
            type="button"
            className="fxa-btn-secondary"
            disabled={busy || slot?.approvalState !== "PENDING_APPROVAL"}
            onClick={() => void runAction("reject", { reason: "Rejected by system owner from Forex Admin UI." })}
            title="Owner-only"
          >
            Owner reject
          </button>
          <button
            type="button"
            className="fxa-btn-secondary"
            disabled={busy || !(slot?.history && slot.history.length > 0)}
            onClick={() => {
              if (!window.confirm(`Roll back ${kind} for ${instrument} to previous approved value?`)) return;
              void runAction("rollback");
            }}
            title="Owner-only"
          >
            Owner rollback
          </button>
          <button
            type="button"
            className="fxa-btn-secondary"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Clear active and proposed ${kind} for ${instrument}?`)) return;
              void runAction("clear");
            }}
            title="Owner-only"
          >
            Owner clear
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
