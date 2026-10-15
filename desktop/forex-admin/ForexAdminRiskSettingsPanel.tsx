/**
 * Phase 45/47B/47C — Compact Forex Admin risk / position-sizing settings.
 * FXCM account snapshot is read-only; provider values are not silently persisted as manual.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { forexRiskApi } from "./api";

type RiskSettings = {
  riskBudgetMode: "percentage" | "fixed";
  riskPercent: number;
  riskFixedAmount: number | null;
  riskBasis: "manual_balance" | "manual_equity";
  manualBalance: number | null;
  manualEquity: number | null;
  accountCurrency: string;
  minRewardRiskRatio: number;
  calculationMode: "risk_budget_first" | "size_first";
  proposedSize: number | null;
  conversionMaxAgeMs: number;
  requireMarginForEligibility: boolean;
  accountDataSource: "manual" | "forexconnect";
  selectedForexConnectAccountId: string | null;
};

type AccountSnapshot = {
  ok: boolean;
  code: string;
  environment: string | null;
  environmentLabel: string | null;
  accountId: string | null;
  accountIdMasked: string | null;
  accountNameMasked: string | null;
  accountCurrency: string | null;
  balance: number | null;
  equity: number | null;
  usedMargin: number | null;
  usableMargin: number | null;
  source: string;
  fetchedAt: string | null;
  isFresh: boolean;
  ageMs?: number | null;
  maxAgeMs?: number;
  missingFields: string[];
  accounts: Array<{
    accountId: string;
    accountIdMasked: string | null;
    accountCurrency: string | null;
    balance: number | null;
    equity: number | null;
  }>;
  connectionStatus: string | null;
  message: string;
};

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "unavailable";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtAge(ageMs: number | null | undefined): string {
  if (ageMs == null || !Number.isFinite(ageMs)) return "age n/a";
  if (ageMs < 1000) return `${Math.round(ageMs)} ms old`;
  if (ageMs < 60_000) return `${(ageMs / 1000).toFixed(0)}s old`;
  return `${(ageMs / 60_000).toFixed(1)}m old`;
}

function isEmptyManual(s: RiskSettings): boolean {
  return !s.accountCurrency
    && s.manualBalance == null
    && s.manualEquity == null;
}

export function ForexAdminRiskSettingsPanel() {
  const [settings, setSettings] = useState<RiskSettings | null>(null);
  const [draft, setDraft] = useState<RiskSettings | null>(null);
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [snapBusy, setSnapBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snapError, setSnapError] = useState<string | null>(null);
  const mounted = useRef(true);
  const migratedRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadSnapshot = useCallback(async (accountId?: string | null) => {
    setSnapBusy(true);
    setSnapError(null);
    try {
      const res = await forexRiskApi.accountSnapshot(
        accountId === undefined ? undefined : { accountId: accountId ?? undefined },
      );
      if (!mounted.current) return;
      setSnapshot(res.snapshot as AccountSnapshot);
    } catch (err) {
      if (!mounted.current) return;
      setSnapError(err instanceof Error ? err.message : "Failed to load FXCM account snapshot.");
      // Keep prior snapshot on failure — never replace with fabricated defaults.
    } finally {
      if (mounted.current) setSnapBusy(false);
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await forexRiskApi.settings();
      if (!mounted.current) return;
      let next = res.settings as RiskSettings;
      // Phase 47C — empty manual configs prefer FXCM as active source (preference only).
      if (
        !migratedRef.current
        && next.accountDataSource === "manual"
        && isEmptyManual(next)
      ) {
        migratedRef.current = true;
        try {
          const updated = await forexRiskApi.updateSettings({ accountDataSource: "forexconnect" });
          next = updated.settings as RiskSettings;
          setMessage("Account data source set to FXCM account (live snapshot).");
        } catch {
          next = { ...next, accountDataSource: "forexconnect" };
        }
      }
      setSettings(next);
      setDraft(next);
      void loadSnapshot(next.selectedForexConnectAccountId);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to load risk settings.");
    }
  }, [loadSnapshot]);

  useEffect(() => {
    void load();
  }, [load]);

  // Bounded polling while FXCM source is active — not instantaneous; shows age explicitly.
  useEffect(() => {
    if (!draft || draft.accountDataSource !== "forexconnect") return;
    const timer = window.setInterval(() => {
      void loadSnapshot(draft.selectedForexConnectAccountId);
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [draft?.accountDataSource, draft?.selectedForexConnectAccountId, loadSnapshot]);

  // Invalidate displayed snapshot when environment/account preference changes after save.
  useEffect(() => {
    if (!settings) return;
    void loadSnapshot(settings.selectedForexConnectAccountId);
  }, [settings?.selectedForexConnectAccountId, settings?.accountDataSource, loadSnapshot]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await forexRiskApi.updateSettings(draft);
      setSettings(res.settings as RiskSettings);
      setDraft(res.settings as RiskSettings);
      setMessage(res.changed?.length ? `Saved ${res.changed.length} change(s).` : "No changes.");
      void loadSnapshot((res.settings as RiskSettings).selectedForexConnectAccountId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!draft) {
    return (
      <section className="fxa-card fxa-risk-settings" data-forex-admin-risk-settings>
        <h2>Position sizing &amp; risk</h2>
        <p className="fxa-muted">{error || "Loading risk settings…"}</p>
      </section>
    );
  }

  const set = <K extends keyof RiskSettings>(key: K, value: RiskSettings[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const fxcmMode = draft.accountDataSource === "forexconnect";
  const fxcmComplete = Boolean(
    snapshot
    && snapshot.isFresh
    && snapshot.code === "OK"
    && snapshot.accountCurrency
    && (snapshot.balance != null || snapshot.equity != null),
  );
  const snapTone = snapBusy
    ? "refreshing"
    : !snapshot
      ? "idle"
      : snapshot.code === "DISCONNECTED"
        ? "error"
        : !snapshot.isFresh || snapshot.code === "STALE"
          ? "stale"
          : snapshot.code === "INCOMPLETE"
            || snapshot.missingFields?.includes("accountCurrency")
            ? "incomplete"
            : snapshot.code === "OK"
              ? "ok"
              : "warn";

  return (
    <section className="fxa-card fxa-risk-settings" data-forex-admin-risk-settings>
      <h2>Position sizing &amp; risk</h2>
      <p className="fxa-muted">
        Deterministic sizing for Phase 44 plans. FXCM account data is read-only and never invents
        balances. Does not place orders.
      </p>

      <div className="fxa-risk-account" data-fxcm-account-snapshot data-snap-tone={snapTone}>
        <div className="fxa-risk-account-head">
          <strong>FXCM account data</strong>
          <button
            type="button"
            className="fxa-btn-secondary"
            disabled={snapBusy || busy}
            onClick={() => void loadSnapshot(draft.selectedForexConnectAccountId)}
          >
            {snapBusy ? "Refreshing…" : "Refresh FXCM Account Data"}
          </button>
        </div>
        {snapshot ? (
          <ul className="fxa-risk-account-list">
            <li>
              <span className="fxa-muted">Status</span>{" "}
              {snapshot.connectionStatus ?? "—"} · {snapshot.code}
              {snapBusy
                ? " · refreshing"
                : snapshot.isFresh && snapshot.code === "OK"
                  ? " · fresh"
                  : snapshot.code === "INCOMPLETE"
                    ? " · incomplete"
                    : " · stale/unavailable"}
            </li>
            <li>
              <span className="fxa-muted">Environment</span>{" "}
              {snapshot.environmentLabel ?? snapshot.environment ?? "—"}
              {" · "}
              <span className="fxa-muted">Account</span>{" "}
              {snapshot.accountIdMasked ?? snapshot.accountNameMasked ?? "not selected"}
            </li>
            <li>
              <span className="fxa-muted">Currency</span>{" "}
              {snapshot.accountCurrency ?? "unavailable"}
              {" · "}
              <span className="fxa-muted">Balance</span> {fmtMoney(snapshot.balance)}
              {" · "}
              <span className="fxa-muted">Equity</span> {fmtMoney(snapshot.equity)}
            </li>
            <li>
              <span className="fxa-muted">Used margin</span> {fmtMoney(snapshot.usedMargin)}
              {" · "}
              <span className="fxa-muted">Usable margin</span> {fmtMoney(snapshot.usableMargin)}
            </li>
            <li>
              <span className="fxa-muted">Source</span> {snapshot.source}
              {snapshot.fetchedAt ? ` · last update ${snapshot.fetchedAt}` : ""}
              {" · "}
              {fmtAge(snapshot.ageMs)}
              {snapshot.maxAgeMs != null ? ` (fresh ≤ ${(snapshot.maxAgeMs / 1000).toFixed(0)}s)` : ""}
            </li>
            {snapshot.missingFields?.length ? (
              <li className="fxa-error" role="alert">
                Missing: {snapshot.missingFields.join(", ")}
                {snapshot.missingFields.includes("accountCurrency")
                  ? " — BASE_CRNCY was not returned by ForexConnect for this session."
                  : ""}
              </li>
            ) : null}
            <li className="fxa-muted">{snapshot.message}</li>
          </ul>
        ) : (
          <p className="fxa-muted">{snapBusy ? "Loading FXCM account snapshot…" : "No account snapshot yet."}</p>
        )}
        {snapError ? <p className="fxa-error" role="alert">{snapError}</p> : null}
        {snapshot && snapshot.accounts.length > 1 ? (
          <label className="fxa-risk-account-select">
            Select account
            <select
              value={draft.selectedForexConnectAccountId ?? ""}
              onChange={(e) => {
                const id = e.target.value || null;
                set("selectedForexConnectAccountId", id);
                void loadSnapshot(id);
              }}
              aria-label="Select ForexConnect account"
            >
              <option value="">Choose account…</option>
              {snapshot.accounts.map((a) => (
                <option key={a.accountId} value={a.accountId}>
                  {a.accountIdMasked ?? a.accountId}
                  {a.accountCurrency ? ` · ${a.accountCurrency}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="fxa-risk-grid">
        <label>
          Account data source
          <select
            value={draft.accountDataSource}
            onChange={(e) => set("accountDataSource", e.target.value as RiskSettings["accountDataSource"])}
            aria-label="Account data source"
            data-account-data-source={draft.accountDataSource}
          >
            <option value="forexconnect">FXCM account (live snapshot)</option>
            <option value="manual">Manual override</option>
          </select>
        </label>
        <label>
          Risk basis
          <select
            value={draft.riskBasis}
            onChange={(e) => set("riskBasis", e.target.value as RiskSettings["riskBasis"])}
            aria-label="Risk basis"
          >
            <option value="manual_balance">
              {fxcmMode ? "FXCM balance" : "Manual balance"}
            </option>
            <option value="manual_equity">
              {fxcmMode ? "FXCM equity" : "Manual equity"}
            </option>
          </select>
        </label>

        {fxcmMode ? (
          <>
            <div className="fxa-risk-readonly" data-fxcm-readonly-fields="true">
              <span className="fxa-muted">Account currency (FXCM, read-only)</span>
              <strong>{snapshot?.accountCurrency ?? "unavailable"}</strong>
            </div>
            <div className="fxa-risk-readonly">
              <span className="fxa-muted">Balance (FXCM, read-only)</span>
              <strong>{fmtMoney(snapshot?.balance)}</strong>
            </div>
            <div className="fxa-risk-readonly">
              <span className="fxa-muted">Equity (FXCM, read-only)</span>
              <strong>{fmtMoney(snapshot?.equity)}</strong>
            </div>
            {!fxcmComplete ? (
              <p className="fxa-error" role="alert" style={{ gridColumn: "1 / -1" }}>
                FXCM source is active but the snapshot is not complete/fresh — risk sizing stays
                ineligible until currency and balance/equity are verified. Manual values are not used
                as a fallback.
              </p>
            ) : (
              <p className="fxa-muted" style={{ gridColumn: "1 / -1" }}>
                FXCM live snapshot is the authoritative risk source for analysis calculations.
                Saving stores the source preference only — not a frozen balance copy.
              </p>
            )}
          </>
        ) : (
          <>
            <label>
              Account currency
              <input
                value={draft.accountCurrency}
                onChange={(e) => set("accountCurrency", e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="USD"
                aria-label="Account currency"
              />
            </label>
            <label>
              Manual balance
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.manualBalance ?? ""}
                onChange={(e) => set("manualBalance", e.target.value === "" ? null : Number(e.target.value))}
                aria-label="Manual balance"
              />
            </label>
            <label>
              Manual equity
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.manualEquity ?? ""}
                onChange={(e) => set("manualEquity", e.target.value === "" ? null : Number(e.target.value))}
                aria-label="Manual equity"
              />
            </label>
            <p className="fxa-muted" style={{ gridColumn: "1 / -1" }}>
              Manual override mode uses only the fields above. The FXCM snapshot card remains for
              comparison and is not mixed into calculations.
            </p>
          </>
        )}

        <label>
          Budget mode
          <select
            value={draft.riskBudgetMode}
            onChange={(e) => set("riskBudgetMode", e.target.value as RiskSettings["riskBudgetMode"])}
            aria-label="Risk budget mode"
          >
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </label>
        <label>
          Risk %
          <input
            type="number"
            min={0.01}
            max={100}
            step="0.01"
            value={draft.riskPercent}
            onChange={(e) => set("riskPercent", Number(e.target.value))}
            aria-label="Risk percent"
          />
        </label>
        <label>
          Fixed risk amount
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.riskFixedAmount ?? ""}
            onChange={(e) => set("riskFixedAmount", e.target.value === "" ? null : Number(e.target.value))}
            aria-label="Fixed risk amount"
          />
        </label>
        <label>
          Min R:R
          <input
            type="number"
            min={0}
            step="0.1"
            value={draft.minRewardRiskRatio}
            onChange={(e) => set("minRewardRiskRatio", Number(e.target.value))}
            aria-label="Minimum reward to risk"
          />
        </label>
        <label>
          Calculation mode
          <select
            value={draft.calculationMode}
            onChange={(e) => set("calculationMode", e.target.value as RiskSettings["calculationMode"])}
            aria-label="Calculation mode"
          >
            <option value="risk_budget_first">Risk-budget first</option>
            <option value="size_first">Size first</option>
          </select>
        </label>
        <label>
          Proposed size (size-first)
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.proposedSize ?? ""}
            onChange={(e) => set("proposedSize", e.target.value === "" ? null : Number(e.target.value))}
            aria-label="Proposed size"
          />
        </label>
        <label>
          Conversion / snapshot max age (ms)
          <input
            type="number"
            min={1000}
            step={1000}
            value={draft.conversionMaxAgeMs}
            onChange={(e) => set("conversionMaxAgeMs", Number(e.target.value))}
            aria-label="Conversion max age"
          />
        </label>
        <label className="fxa-risk-check">
          <input
            type="checkbox"
            checked={draft.requireMarginForEligibility}
            onChange={(e) => set("requireMarginForEligibility", e.target.checked)}
          />
          Require verified margin for eligibility
        </label>
      </div>
      <div className="fxa-openai-actions">
        <button type="button" className="fxa-btn" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save risk settings"}
        </button>
        <button type="button" className="fxa-btn-secondary" disabled={busy} onClick={() => void load()}>
          Reload
        </button>
      </div>
      {message ? <p className="fxa-muted" role="status">{message}</p> : null}
      {error ? <p className="fxa-error" role="alert">{error}</p> : null}
      {settings ? (
        <p className="fxa-muted">
          Active: {settings.calculationMode} · {settings.riskBudgetMode}
          {" · "}
          {settings.accountDataSource === "forexconnect" ? "FXCM account" : "manual"}
          {fxcmMode
            ? (fxcmComplete
              ? ` · ${snapshot?.accountCurrency ?? ""}`
              : " · FXCM incomplete/stale")
            : (settings.accountCurrency ? ` · ${settings.accountCurrency}` : " · currency unset")}
        </p>
      ) : null}
    </section>
  );
}
