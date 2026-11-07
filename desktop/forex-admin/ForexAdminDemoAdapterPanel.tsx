/**
 * Stage 6 — FXCM DEMO adapter readiness (read-only / dry-run).
 * No submit-order button. No Emergency Lock bypass. No broker mutation controls.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { atDemoAdapterApi } from "./api";

type AdapterStatus = {
  stage?: string;
  submissionMode?: string;
  readinessCategory?: string;
  executionMasterEnabled?: boolean;
  placesOrders?: boolean;
  acceptsForExecution?: boolean;
  mutatesBroker?: boolean;
  executionAuthorized?: boolean;
  brokerSubmissionImplemented?: boolean;
  controlsObserved?: Record<string, unknown>;
  latestAttempt?: Record<string, unknown> | null;
  note?: string;
};

export function ForexAdminDemoAdapterPanel() {
  const [status, setStatus] = useState<AdapterStatus | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dryMsg, setDryMsg] = useState<string | null>(null);
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
      const [st, hist] = await Promise.all([
        atDemoAdapterApi.status(),
        atDemoAdapterApi.history(20),
      ]);
      if (!mounted.current) return;
      setStatus(st as AdapterStatus);
      setHistory((hist.attempts || []) as Array<Record<string, unknown>>);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to load DEMO adapter status.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runDryRun = useCallback(async () => {
    setBusy(true);
    setDryMsg(null);
    setError(null);
    try {
      const res = await atDemoAdapterApi.dryRun({});
      if (!mounted.current) return;
      const attempt = (res as { dryRun?: { attempt?: Record<string, unknown>; note?: string } }).dryRun;
      setDryMsg(
        attempt?.note
        || (res as { note?: string }).note
        || "Dry-run completed (non-submitting).",
      );
      await load();
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Dry-run failed.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [load]);

  const controls = status?.controlsObserved || {};

  return (
    <section className="fxa-card" data-forex-admin-demo-adapter>
      <div className="fxa-row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2>DEMO execution adapter</h2>
        <div className="fxa-row">
          <button type="button" className="fxa-btn" onClick={() => void load()} disabled={busy}>
            Refresh
          </button>
          <button type="button" className="fxa-btn" onClick={() => void runDryRun()} disabled={busy}>
            Dry-run (no mutation)
          </button>
        </div>
      </div>
      <p className="fxa-muted">
        Stage 6 FXCM DEMO adapter boundary — submission mode DISABLED. Constructs and validates a
        TRUE_MARKET_OPEN payload from Stage 5 proposals. Does not submit, modify, cancel, or close
        broker positions. No active submit control.
      </p>
      {error ? <p className="fxa-error">{error}</p> : null}
      {dryMsg ? <p className="fxa-muted">{dryMsg}</p> : null}

      <dl className="fxa-dl">
        <dt>Submission mode</dt>
        <dd>{status?.submissionMode ?? "—"}</dd>
        <dt>Readiness</dt>
        <dd>{status?.readinessCategory ?? "—"}</dd>
        <dt>Environment</dt>
        <dd>{String(controls.selectedEnvironment ?? "—")}</dd>
        <dt>Execution Master</dt>
        <dd>{String(controls.executionMasterEnabled ?? false)}</dd>
        <dt>Emergency Lock</dt>
        <dd>{String(controls.emergencyEntryLock ?? "—")}</dd>
        <dt>Trading / masterEnable</dt>
        <dd>{String(controls.masterEnable ?? false)}</dd>
        <dt>Automatic entry</dt>
        <dd>{String(controls.automaticEntry ?? false)}</dd>
        <dt>Safety stamps</dt>
        <dd>
          placesOrders={String(status?.placesOrders ?? false)}; acceptsForExecution=
          {String(status?.acceptsForExecution ?? false)}; mutatesBroker=
          {String(status?.mutatesBroker ?? false)}; executionAuthorized=
          {String(status?.executionAuthorized ?? false)}
        </dd>
        <dt>Broker submission implemented</dt>
        <dd>{String(status?.brokerSubmissionImplemented ?? false)}</dd>
      </dl>

      {status?.latestAttempt ? (
        <div className="fxa-card" style={{ marginTop: "0.75rem" }}>
          <h3>Latest attempt</h3>
          <dl className="fxa-dl">
            <dt>Attempt ID</dt>
            <dd>{String(status.latestAttempt.executionAttemptId ?? "—")}</dd>
            <dt>Proposal</dt>
            <dd>{String(status.latestAttempt.proposalId ?? "—")}</dd>
            <dt>State</dt>
            <dd>{String(status.latestAttempt.state ?? "—")}</dd>
            <dt>Ack verified</dt>
            <dd>
              {String(
                (status.latestAttempt.acknowledgement as { verifiedBrokerAcceptance?: boolean } | undefined)
                  ?.verifiedBrokerAcceptance ?? false,
              )}
            </dd>
            <dt>Mutation invoked</dt>
            <dd>{String(status.latestAttempt.mutationInvoked ?? false)}</dd>
          </dl>
        </div>
      ) : null}

      <h3 style={{ marginTop: "1rem" }}>History</h3>
      <div className="fxa-table-wrap">
        <table className="fxa-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Proposal</th>
              <th>Category</th>
              <th>State</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className="fxa-muted">No adapter attempts yet.</td>
              </tr>
            ) : (
              history.map((row) => (
                <tr key={String(row.executionAttemptId)}>
                  <td>{String(row.createdAtUtc ?? "—")}</td>
                  <td>{String(row.proposalId ?? "—")}</td>
                  <td>{String(row.readinessCategory ?? "—")}</td>
                  <td>{String(row.state ?? "—")}</td>
                  <td>{String(row.submissionMode ?? "—")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
