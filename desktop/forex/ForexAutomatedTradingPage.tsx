/**
 * Phase 51 / 51.1 — Automated Trading foundation UI (DEMO/LIVE isolation).
 * Configuration only — does not place, modify, or close broker orders.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ForexStatusBadge } from "./components/ForexStatusBadge";

const FOREX_ADMIN_TOKEN_STORAGE_KEY = "kwizera.admin.apiToken";
const BANNER = "AUTOMATED EXECUTION NOT IMPLEMENTED — PHASE 51";

type Env = "DEMO" | "LIVE";

type PublicStatus = {
  moduleStatus: "INITIALIZING" | "READY" | "BLOCKED" | "ERROR";
  selectedEnvironment: Env;
  environmentEpoch: number;
  configVersion: number;
  banner: string;
  broker: {
    connectionStatus: string;
    activeSessionEnvironment: Env | null;
    sessionMatchesSelection: boolean | null;
    accountIdMasked: string | null;
    openPositionsCount: number | null;
    lastStatusAtUtc: string | null;
    credentialsConfigured: boolean;
    usernameHint: string | null;
    accountVerified: boolean;
  };
  controls: {
    masterEnable: boolean;
    automaticEntry: "DISABLED";
    positionManagement: "NOT_ACTIVE";
    emergencyEntryLock: boolean;
    automatedExecutionEnabled: false;
  };
  blockers: string[];
  explanation: string;
  updatedAtUtc: string;
  placesOrders: false;
};

type AuditEvent = {
  id: string;
  atUtc: string;
  action: string;
  environment: Env | null;
  ok: boolean;
  code: string | null;
  detail: string;
};

function readAdminToken(): string {
  try {
    return sessionStorage.getItem(FOREX_ADMIN_TOKEN_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function writeAdminToken(token: string) {
  try {
    const trimmed = token.trim();
    if (trimmed) sessionStorage.setItem(FOREX_ADMIN_TOKEN_STORAGE_KEY, trimmed);
    else sessionStorage.removeItem(FOREX_ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function adminHeaders(token: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-kwizera-admin-token": token,
  };
}

function statusTone(s: string): "live" | "future" | "offline" {
  if (s === "READY" || s === "CONNECTED") return "live";
  if (s === "BLOCKED" || s === "MISMATCH" || s === "ERROR") return "offline";
  return "future";
}

/** Drop blockers already shown as the top banner. */
function actionableBlockers(blockers: string[], banner: string): string[] {
  const bannerNorm = banner.trim().toUpperCase();
  return blockers.filter((b) => {
    const t = b.trim().toUpperCase();
    return t !== bannerNorm && !t.startsWith("AUTOMATED EXECUTION NOT IMPLEMENTED");
  });
}

export function ForexAutomatedTradingPage() {
  const [token, setToken] = useState(readAdminToken);
  const [tokenDraft, setTokenDraft] = useState(token);
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingEnv, setPendingEnv] = useState<Env | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setBusy(true);
    setError(null);
    try {
      const [stRes, auRes] = await Promise.all([
        fetch("/api/forex/automated-trading/status", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/audit?limit=12", { headers: adminHeaders(token) }),
      ]);
      const stJson = await stRes.json() as {
        ok?: boolean;
        status?: PublicStatus;
        error?: { message?: string; code?: string };
      };
      const auJson = await auRes.json() as { ok?: boolean; events?: AuditEvent[]; error?: { message?: string } };
      if (n !== seq.current) return;
      if (!stRes.ok || !stJson.ok || !stJson.status) {
        setStatus(null);
        setError(stJson.error?.message || stJson.error?.code || `Status ${stRes.status}`);
        return;
      }
      setStatus(stJson.status);
      setAudit(Array.isArray(auJson.events) ? auJson.events : []);
    } catch (err) {
      if (n !== seq.current) return;
      setError(err instanceof Error ? err.message : "Failed to load Automated Trading status");
    } finally {
      if (n === seq.current) setBusy(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveToken = () => {
    writeAdminToken(tokenDraft);
    setToken(tokenDraft.trim());
  };

  const postJson = async (path: string, body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify(body),
      });
      const data = await res.json() as {
        ok?: boolean;
        status?: PublicStatus;
        error?: { message?: string; code?: string };
      };
      if (!res.ok || !data.ok || !data.status) {
        setError(data.error?.message || data.error?.code || `Request failed (${res.status})`);
        if (data.status) setStatus(data.status);
        return;
      }
      setStatus(data.status);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
      setPendingEnv(null);
    }
  };

  const confirmSwitch = async () => {
    if (!status || !pendingEnv) return;
    await postJson("/api/forex/automated-trading/environment", {
      environment: pendingEnv,
      confirm: true,
      expectedCurrentEnvironment: status.selectedEnvironment,
      expectedEnvironmentEpoch: status.environmentEpoch,
    });
  };

  const patchControls = async (patch: Record<string, boolean>) => {
    if (!status) return;
    await postJson("/api/forex/automated-trading/controls", {
      environment: status.selectedEnvironment,
      expectedEnvironmentEpoch: status.environmentEpoch,
      patch,
    });
  };

  const setLock = async (locked: boolean) => {
    if (!status) return;
    await postJson("/api/forex/automated-trading/emergency-lock", {
      environment: status.selectedEnvironment,
      locked,
      expectedEnvironmentEpoch: status.environmentEpoch,
    });
  };

  const blockers = useMemo(
    () => (status ? actionableBlockers(status.blockers, status.banner || BANNER) : []),
    [status],
  );

  const authState = token ? "Authorized (session)" : "Not authorized";

  return (
    <section className="fx-auto-trading" data-forex-page="automated-trading" aria-label="Automated Trading">
      <header className="fx-auto-trading-header">
        <div className="fx-auto-trading-title-block">
          <div className="fx-auto-trading-title-row">
            <h1 className="fx-page-title">Automated Trading</h1>
            {status ? (
              <ForexStatusBadge tone={statusTone(status.moduleStatus)}>{status.moduleStatus}</ForexStatusBadge>
            ) : (
              <ForexStatusBadge tone="future">{busy ? "LOADING" : "IDLE"}</ForexStatusBadge>
            )}
          </div>
          <p className="fx-auto-trading-subtitle">FXCM ForexConnect automation</p>
        </div>
        <button type="button" className="fx-capture-button" onClick={() => void load()} disabled={busy}>
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <p className="fx-auto-trading-banner" role="status" data-fx-execution-banner="true">
        {status?.banner ?? BANNER}
      </p>

      <details className="fx-auto-trading-auth" data-fx-at-admin-auth="true">
        <summary className="fx-auto-trading-auth-summary">
          <span>Admin authorization</span>
          <span className="fx-auto-trading-auth-state" data-fx-at-auth-state={token ? "ready" : "missing"}>
            {authState}
          </span>
        </summary>
        <div className="fx-auto-trading-auth-body">
          <label className="fx-ai-label" htmlFor="fx-at-admin-token">
            Admin API token (session only)
          </label>
          <div className="fx-auto-trading-token-row">
            <input
              id="fx-at-admin-token"
              type="password"
              autoComplete="off"
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              placeholder="KWIZERA_ADMIN_API_TOKEN"
              aria-describedby="fx-at-auth-hint"
            />
            <button type="button" className="fx-capture-button" onClick={saveToken}>
              Save token
            </button>
          </div>
          <p id="fx-at-auth-hint" className="fx-auto-trading-hint">
            Session-only. Not written to localStorage, URLs, or logs.
          </p>
        </div>
      </details>

      {error ? <p className="fx-capture-status is-error" role="alert">{error}</p> : null}

      {status ? (
        <>
          <section className="fx-auto-trading-panel" aria-label="Account and environment">
            <div className="fx-auto-trading-summary" data-fx-at-summary="true">
              <div className="fx-auto-summary-cell">
                <span className="fx-ai-label">Environment</span>
                <span
                  className={`fx-auto-env-pill ${status.selectedEnvironment === "LIVE" ? "is-live" : "is-demo"}`}
                  data-fx-selected-env={status.selectedEnvironment}
                >
                  {status.selectedEnvironment}
                </span>
              </div>
              <div className="fx-auto-summary-cell">
                <span className="fx-ai-label">Broker</span>
                <span className="fx-auto-summary-value">
                  <ForexStatusBadge tone={statusTone(status.broker.connectionStatus)}>
                    {status.broker.connectionStatus}
                  </ForexStatusBadge>
                  {status.broker.activeSessionEnvironment
                    ? ` · session ${status.broker.activeSessionEnvironment}`
                    : ""}
                </span>
              </div>
              <div className="fx-auto-summary-cell">
                <span className="fx-ai-label">Account</span>
                <span className="fx-auto-summary-value" data-fx-at-account-masked="true">
                  {status.broker.accountIdMasked ?? "—"}
                </span>
              </div>
              <div className="fx-auto-summary-cell">
                <span className="fx-ai-label">Verified</span>
                <span className="fx-auto-summary-value" data-fx-at-account-verified={status.broker.accountVerified ? "yes" : "no"}>
                  {status.broker.accountVerified ? "yes" : "no"}
                </span>
              </div>
              <div className="fx-auto-summary-cell">
                <span className="fx-ai-label">Positions</span>
                <span className="fx-auto-summary-value">
                  {status.broker.openPositionsCount == null ? "—" : status.broker.openPositionsCount}
                </span>
              </div>
            </div>

            <div className="fx-auto-env-bar" aria-label="Environment selector">
              <span className="fx-ai-label">Switch</span>
              <div className="fx-auto-env-actions">
                {(["DEMO", "LIVE"] as const).map((env) => (
                  <button
                    key={env}
                    type="button"
                    className={`fx-auto-env-btn ${env === "LIVE" ? "is-live" : "is-demo"} ${
                      status.selectedEnvironment === env ? "is-selected" : ""
                    }`}
                    disabled={busy || pendingEnv !== null}
                    onClick={() => setPendingEnv(env)}
                    aria-pressed={status.selectedEnvironment === env}
                  >
                    {env}
                  </button>
                ))}
              </div>
              <span className="fx-auto-trading-meta">
                epoch {status.environmentEpoch} · v{status.configVersion}
              </span>
            </div>

            {pendingEnv ? (
              <div className="fx-auto-env-confirm" role="dialog" aria-label="Confirm environment switch">
                <p>
                  Confirm switch to <strong>{pendingEnv}</strong>?
                  {pendingEnv === "LIVE" ? " LIVE execution remains disabled in Phase 51." : ""}
                  {" "}Does not change the ForexConnect session by itself.
                </p>
                <div className="fx-auto-trading-token-row">
                  <button type="button" className="fx-capture-button" disabled={busy} onClick={() => void confirmSwitch()}>
                    Confirm {pendingEnv}
                  </button>
                  <button type="button" className="fx-studio-link" disabled={busy} onClick={() => setPendingEnv(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {blockers.length > 0 ? (
              <ul className="fx-auto-trading-blockers" aria-label="Execution blockers">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="fx-auto-trading-panel" aria-label="Trading controls">
            <div className="fx-auto-trading-panel-head">
              <h2 className="fx-auto-trading-h2">Controls</h2>
              <p className="fx-auto-trading-hint">
                Configuration only — cannot submit broker orders.
              </p>
            </div>
            <div className="fx-auto-controls">
              <label className="fx-auto-control-row">
                <input
                  type="checkbox"
                  checked={status.controls.masterEnable}
                  disabled={busy}
                  onChange={(e) => void patchControls({ masterEnable: e.target.checked })}
                />
                <span>Master enable</span>
                <strong data-fx-at-master={status.controls.masterEnable ? "on" : "off"}>
                  {status.controls.masterEnable ? "ON (config)" : "OFF"}
                </strong>
              </label>
              <div className="fx-auto-control-row">
                <span className="fx-auto-control-spacer" aria-hidden="true" />
                <span>Automatic entry</span>
                <strong data-fx-at-auto-entry="disabled">DISABLED</strong>
              </div>
              <div className="fx-auto-control-row">
                <span className="fx-auto-control-spacer" aria-hidden="true" />
                <span>Position management</span>
                <strong data-fx-at-pos-mgmt="not-active">NOT ACTIVE</strong>
              </div>
              <label className="fx-auto-control-row">
                <input
                  type="checkbox"
                  checked={status.controls.emergencyEntryLock}
                  disabled={busy}
                  onChange={(e) => void setLock(e.target.checked)}
                />
                <span>Emergency entry lock</span>
                <strong data-fx-at-entry-lock={status.controls.emergencyEntryLock ? "on" : "off"}>
                  {status.controls.emergencyEntryLock ? "ON" : "OFF"}
                </strong>
              </label>
            </div>
            <p className="fx-auto-trading-hint">
              Lock blocks future automated entries only — does not close positions.
            </p>
          </section>

          <section className="fx-auto-trading-panel" aria-label="Configuration and audit">
            <div className="fx-auto-trading-panel-head">
              <h2 className="fx-auto-trading-h2">Configuration</h2>
            </div>
            <dl className="fx-auto-config-grid">
              <div>
                <dt>Environment</dt>
                <dd>{status.selectedEnvironment}</dd>
              </div>
              <div>
                <dt>Config version</dt>
                <dd>{status.configVersion}</dd>
              </div>
              <div>
                <dt>Credentials</dt>
                <dd>{status.broker.credentialsConfigured ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt>Account verified</dt>
                <dd>{status.broker.accountVerified ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt>Automated execution</dt>
                <dd>disabled (Phase 51)</dd>
              </div>
            </dl>

            <h3 className="fx-auto-trading-h3">Recent audit</h3>
            {audit.length === 0 ? (
              <p className="fx-auto-trading-hint">No audit events yet.</p>
            ) : (
              <ul className="fx-auto-audit-list">
                {audit.slice(0, 8).map((e) => (
                  <li key={e.id}>
                    <time dateTime={e.atUtc}>{e.atUtc.slice(11, 19)}Z</time>
                    <span>
                      {e.action}
                      {e.environment ? ` · ${e.environment}` : ""}
                      {e.ok ? "" : ` · ${e.code ?? "failed"}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        !error && <p className="fx-auto-trading-hint">{busy ? "Loading status…" : "Status unavailable."}</p>
      )}
    </section>
  );
}
