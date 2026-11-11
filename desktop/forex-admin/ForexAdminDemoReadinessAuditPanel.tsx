/**
 * Stage 7.1 — DEMO execution readiness audit panel (read-only).
 * Never submits orders or issues grants.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { atDemoReadinessAuditApi } from "./api";

type Finding = {
  category: string;
  status: string;
  code: string;
  message: string;
  evidenceSource: string;
  evidenceKind: string;
  evidenceTimestampUtc: string;
  remediation: string;
};

export function ForexAdminDemoReadinessAuditPanel() {
  const [audit, setAudit] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      const res = await atDemoReadinessAuditApi.run();
      if (!mounted.current) return;
      setAudit((res as { audit?: Record<string, unknown> }).audit || null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to load Stage 7.1 audit.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = (audit?.categories || {}) as Record<string, string>;
  const findings = (audit?.findings || []) as Finding[];
  const controls = (audit?.controlsObserved || {}) as Record<string, unknown>;
  const instruments = (audit?.instrumentPolicies || []) as Array<Record<string, unknown>>;

  return (
    <section className="fxa-card" data-forex-admin-demo-readiness-audit>
      <div className="fxa-row" style={{ justifyContent: "space-between" }}>
        <h2>DEMO execution readiness audit (Stage 7.1)</h2>
        <button type="button" className="fxa-btn" disabled={busy} onClick={() => void load()}>
          Refresh audit
        </button>
      </div>
      <p className="fxa-muted">
        Read-only audit. Does not submit orders, issue grants, enable Execution Master, or clear
        Emergency Lock. READY_FOR_EXECUTION is intentionally absent.
      </p>
      {error ? <p className="fxa-error">{error}</p> : null}

      <dl className="fxa-dl">
        <dt>Overall</dt>
        <dd>{String(audit?.overallState ?? "—")}</dd>
        <dt>Safety stamps</dt>
        <dd>
          placesOrders={String(audit?.placesOrders ?? false)}; mutatesBroker=
          {String(audit?.mutatesBroker ?? false)}; mutationInvoked=
          {String(audit?.mutationInvoked ?? false)}
        </dd>
        <dt>Execution Master / Emergency Lock / Grant</dt>
        <dd>
          {String(controls.executionMasterEnabled ?? "—")} / {String(controls.emergencyEntryLock ?? "—")} /{" "}
          activeGrant={String(controls.activeGrantPresent ?? "—")}
        </dd>
        <dt>Environment</dt>
        <dd>{String(controls.selectedEnvironment ?? "—")}</dd>
      </dl>

      <h3>Category statuses</h3>
      <ul className="fxa-list">
        {Object.keys(categories).length === 0 ? (
          <li className="fxa-muted">No audit loaded.</li>
        ) : (
          Object.entries(categories).map(([k, v]) => (
            <li key={k}>
              <code>{k}</code>: <strong>{v}</strong>
            </li>
          ))
        )}
      </ul>

      <h3>Instrument policies</h3>
      {instruments.length === 0 ? (
        <p className="fxa-muted">No instrument policy rows.</p>
      ) : (
        <ul className="fxa-list">
          {instruments.map((row) => {
            const spread = (row.spread || {}) as Record<string, unknown>;
            const slip = (row.slippage || {}) as Record<string, unknown>;
            return (
              <li key={String(row.instrument)}>
                <code>{String(row.instrument)}</code>
                {String(row.instrument) === "XAU/USD"
                  ? " — eligibility=DYNAMIC_PER_TRADE"
                  : " — eligibility=legacy-ceiling"}
                {" · "}spread {String(spread.status)}/{String(spread.approvalState)}
                {" "}legacyMax={String(spread.maxSpreadAbsolute)} consumed=
                {String(spread.consumedByStage57)}; slippage {String(slip.status)}/
                {String(slip.approvalState)} max={String(slip.maxSlippageAbsolute)} consumed=
                {String(slip.consumedByStage57)}
              </li>
            );
          })}
        </ul>
      )}

      <h3>Findings</h3>
      {findings.length === 0 ? (
        <p className="fxa-muted">No findings.</p>
      ) : (
        <ul className="fxa-list">
          {findings.map((f, i) => (
            <li key={`${f.code}-${i}`}>
              <code>{f.status}</code> <code>{f.code}</code> [{f.category}] — {f.message}
              <br />
              <span className="fxa-muted">
                evidence={f.evidenceKind}/{f.evidenceSource}; remediation={f.remediation}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
