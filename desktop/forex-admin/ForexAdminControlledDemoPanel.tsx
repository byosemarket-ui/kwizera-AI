/**
 * Stage 7 — Controlled DEMO execution readiness panel.
 * No broker submit button. Grant issue requires explicit confirm of order details.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { atControlledDemoApi } from "./api";

type Status = Record<string, unknown>;

export function ForexAdminControlledDemoPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [readiness, setReadiness] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
      const [st, rd] = await Promise.all([
        atControlledDemoApi.status(),
        atControlledDemoApi.readiness({}),
      ]);
      if (!mounted.current) return;
      setStatus(st);
      setReadiness((rd as { readiness?: Status }).readiness || null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to load Stage 7 status.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const snap = (readiness?.snapshot || null) as Record<string, unknown> | null;
  const blockers = (readiness?.blockers || []) as Array<{ code: string; message: string }>;
  const controls = (status?.controlsObserved || {}) as Record<string, unknown>;

  const revokeGrant = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await atControlledDemoApi.revokeGrant({});
      if (!mounted.current) return;
      setMessage(res.ok ? "Active grant revoked." : String((res as { message?: string }).message || "Revoke failed"));
      await load();
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Revoke failed.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [load]);

  return (
    <section className="fxa-card" data-forex-admin-controlled-demo>
      <div className="fxa-row" style={{ justifyContent: "space-between" }}>
        <h2>Controlled DEMO execution (Stage 7)</h2>
        <div className="fxa-row">
          <button type="button" className="fxa-btn" disabled={busy} onClick={() => void load()}>
            Refresh readiness
          </button>
          <button type="button" className="fxa-btn" disabled={busy} onClick={() => void revokeGrant()}>
            Revoke grant
          </button>
        </div>
      </div>
      <p className="fxa-muted">
        Readiness and one-time grant review only. Broker mutation remains DISABLED. No submit-order
        control. Execution Master must stay OFF and Emergency Lock ON for this stage.
      </p>
      {error ? <p className="fxa-error">{error}</p> : null}
      {message ? <p className="fxa-muted">{message}</p> : null}

      <dl className="fxa-dl">
        <dt>Display state</dt>
        <dd>{String(readiness?.displayState ?? status?.displayState ?? "—")}</dd>
        <dt>Submission enabled</dt>
        <dd>{String(status?.submissionEnabled ?? false)}</dd>
        <dt>Environment</dt>
        <dd>{String(controls.selectedEnvironment ?? "—")}</dd>
        <dt>Execution Master</dt>
        <dd>{String(controls.executionMasterEnabled ?? false)}</dd>
        <dt>Emergency Lock</dt>
        <dd>{String(controls.emergencyEntryLock ?? "—")}</dd>
        <dt>Trading enabled</dt>
        <dd>{String(controls.tradingEnabled ?? false)}</dd>
        <dt>Technical / Controls / Auth</dt>
        <dd>
          {String(readiness?.technicalPass ?? "—")} / {String(readiness?.controlsPass ?? "—")} /{" "}
          {String(readiness?.authorizationPass ?? "—")}
        </dd>
        <dt>Safety stamps</dt>
        <dd>
          placesOrders={String(status?.placesOrders ?? false)}; mutatesBroker=
          {String(status?.mutatesBroker ?? false)}; executionAuthorized=
          {String(status?.executionAuthorized ?? false)}
        </dd>
      </dl>

      {snap ? (
        <div className="fxa-card" style={{ marginTop: "0.75rem" }}>
          <h3>Canonical proposal snapshot</h3>
          <dl className="fxa-dl">
            <dt>Proposal / version</dt>
            <dd>
              {String(snap.proposalId)} / {String(snap.proposalVersion)}
            </dd>
            <dt>Instrument / side</dt>
            <dd>
              {String(snap.instrument)} {String(snap.direction)}
            </dd>
            <dt>Allocation / risk</dt>
            <dd>
              {String(snap.capitalAllocation)} / modeled {String(snap.modeledMonetaryRisk)} / R:R{" "}
              {String(snap.rewardToRisk)}
            </dd>
            <dt>Entry / SL / TP</dt>
            <dd>
              {String(snap.entryPrice)} / {String(snap.stopLoss)} / {String(snap.takeProfit)}
            </dd>
            <dt>Quantity / TIF</dt>
            <dd>
              {String(snap.quantity)} / {String(snap.timeInForce)}
            </dd>
            <dt>Account</dt>
            <dd>{String(snap.accountIdMasked)}</dd>
          </dl>
          <p className="fxa-muted">
            Grant issuance requires API confirm=true with exact echoed fields. This UI does not
            auto-issue grants or submit broker requests.
          </p>
        </div>
      ) : null}

      <h3 style={{ marginTop: "1rem" }}>Blockers</h3>
      {blockers.length === 0 ? (
        <p className="fxa-muted">No blockers on latest readiness (or not evaluated).</p>
      ) : (
        <ul className="fxa-list">
          {blockers.map((b, i) => (
            <li key={`${b.code}-${i}`}>
              <code>{b.code}</code> — {b.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
