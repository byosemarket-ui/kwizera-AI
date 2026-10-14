/**
 * Phase 45 — Compact Forex Admin risk / position-sizing settings.
 */
import { useCallback, useEffect, useState } from "react";
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
};

export function ForexAdminRiskSettingsPanel() {
  const [settings, setSettings] = useState<RiskSettings | null>(null);
  const [draft, setDraft] = useState<RiskSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await forexRiskApi.settings();
      setSettings(res.settings);
      setDraft(res.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load risk settings.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <section className="fxa-card fxa-risk-settings" data-forex-admin-risk-settings>
      <h2>Position sizing &amp; risk</h2>
      <p className="fxa-muted">
        Deterministic sizing for Phase 44 plans. Manual balance/equity until account feeds are verified.
        Never invents contract specs. Does not place orders.
      </p>
      <div className="fxa-risk-grid">
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
          Risk basis
          <select
            value={draft.riskBasis}
            onChange={(e) => set("riskBasis", e.target.value as RiskSettings["riskBasis"])}
            aria-label="Risk basis"
          >
            <option value="manual_balance">Manual balance</option>
            <option value="manual_equity">Manual equity</option>
          </select>
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
          Conversion max age (ms)
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
          {settings.accountCurrency ? ` · ${settings.accountCurrency}` : " · currency unset"}
        </p>
      ) : null}
    </section>
  );
}
