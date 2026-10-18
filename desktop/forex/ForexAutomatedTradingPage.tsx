/**
 * Phase 51 — Automated Trading foundation UI (DEMO/LIVE isolation).
 * Does not place, modify, or close broker orders.
 */
import { useCallback, useEffect, useRef, useState } from "react";
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

  return (
    <section className="fx-auto-trading" data-forex-page="automated-trading" aria-label="Automated Trading">
      <header className="fx-auto-trading-header">
        <div>
          <h1 className="fx-page-title">Automated Trading</h1>
          <p className="fx-page-desc">
            DEMO/LIVE isolation foundation. Configuration only — no broker order submission in Phase 51.
          </p>
        </div>
        <button type="button" className="fx-capture-button" onClick={() => void load()} disabled={busy}>
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <p className="fx-auto-trading-banner" role="status" data-fx-execution-banner="true">
        {status?.banner ?? BANNER}
      </p>

      <div className="fx-auto-trading-token">
        <label className="fx-ai-label" htmlFor="fx-at-admin-token">
          Admin API token (session only — {FOREX_ADMIN_TOKEN_STORAGE_KEY})
        </label>
        <div className="fx-auto-trading-token-row">
          <input
            id="fx-at-admin-token"
            type="password"
            autoComplete="off"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            placeholder="Required when KWIZERA_ADMIN_AUTH_MODE requires a token"
          />
          <button type="button" className="fx-capture-button" onClick={saveToken}>
            Save token
          </button>
        </div>
      </div>

      {error ? <p className="fx-capture-status is-error" role="alert">{error}</p> : null}

      {status ? (
        <>
          <section className="fx-auto-trading-card" aria-label="Trading overview">
            <h2 className="fx-ai-guided-title">Overview</h2>
            <div className="fx-auto-trading-grid">
              <div>
                <span className="fx-ai-label">Module</span>{" "}
                <ForexStatusBadge tone={statusTone(status.moduleStatus)}>{status.moduleStatus}</ForexStatusBadge>
              </div>
              <div>
                <span className="fx-ai-label">Environment</span>{" "}
                <span
                  className={`fx-auto-env-pill ${status.selectedEnvironment === "LIVE" ? "is-live" : "is-demo"}`}
                  data-fx-selected-env={status.selectedEnvironment}
                >
                  {status.selectedEnvironment}
                </span>
              </div>
              <div>
                <span className="fx-ai-label">Broker</span>{" "}
                <ForexStatusBadge tone={statusTone(status.broker.connectionStatus)}>
                  {status.broker.connectionStatus}
                </ForexStatusBadge>
                {status.broker.activeSessionEnvironment
                  ? ` · session ${status.broker.activeSessionEnvironment}`
                  : ""}
              </div>
              <div>
                <span className="fx-ai-label">Account</span>{" "}
                {status.broker.accountIdMasked ?? "unverified"}
                {status.broker.accountVerified ? " · verified" : " · not verified"}
              </div>
              <div>
                <span className="fx-ai-label">Automatic entry</span> DISABLED
              </div>
              <div>
                <span className="fx-ai-label">Open positions</span>{" "}
                {status.broker.openPositionsCount == null
                  ? "unavailable"
                  : status.broker.openPositionsCount}
              </div>
              <div>
                <span className="fx-ai-label">Updated</span>{" "}
                {status.broker.lastStatusAtUtc ?? status.updatedAtUtc}
              </div>
            </div>
            <p className="fx-ai-muted">{status.explanation}</p>
            {status.blockers.length > 0 ? (
              <ul className="fx-ai-local-list fx-auto-trading-blockers">
                {status.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="fx-auto-trading-card" aria-label="Environment selector">
            <h2 className="fx-ai-guided-title">Environment</h2>
            <p className="fx-ai-muted">
              Switching updates server selection only. It does not change the ForexConnect session by itself.
              Epoch {status.environmentEpoch} · config v{status.configVersion}
            </p>
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
                >
                  {env}
                  {status.selectedEnvironment === env ? " · selected" : ""}
                </button>
              ))}
            </div>
            {pendingEnv ? (
              <div className="fx-auto-env-confirm" role="dialog" aria-label="Confirm environment switch">
                <p>
                  Confirm switch to <strong>{pendingEnv}</strong>?
                  {pendingEnv === "LIVE"
                    ? " LIVE execution remains disabled in Phase 51."
                    : ""}
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
          </section>

          <section className="fx-auto-trading-card" aria-label="Trading controls">
            <h2 className="fx-ai-guided-title">Controls</h2>
            <p className="fx-ai-muted">
              These flags configure the future workflow only. They do not activate trading or send orders.
            </p>
            <div className="fx-auto-controls">
              <label className="fx-auto-control-row">
                <input
                  type="checkbox"
                  checked={status.controls.masterEnable}
                  disabled={busy}
                  onChange={(e) => void patchControls({ masterEnable: e.target.checked })}
                />
                <span>Master automated-trading enable</span>
                <strong>{status.controls.masterEnable ? "ON (config only)" : "OFF"}</strong>
              </label>
              <div className="fx-auto-control-row">
                <span>Automatic entry</span>
                <strong>DISABLED</strong>
              </div>
              <div className="fx-auto-control-row">
                <span>Position management</span>
                <strong>NOT ACTIVE</strong>
              </div>
              <label className="fx-auto-control-row">
                <input
                  type="checkbox"
                  checked={status.controls.emergencyEntryLock}
                  disabled={busy}
                  onChange={(e) => void setLock(e.target.checked)}
                />
                <span>Emergency entry lock</span>
                <strong>{status.controls.emergencyEntryLock ? "ON" : "OFF"}</strong>
              </label>
              <p className="fx-ai-muted">
                Emergency lock blocks future automated entries when ON. It does not close existing broker positions.
              </p>
            </div>
          </section>

          <section className="fx-auto-trading-card" aria-label="Configuration and status">
            <h2 className="fx-ai-guided-title">Configuration</h2>
            <dl className="fx-capture-meta-grid">
              <div>
                <dt>Selected environment</dt>
                <dd>{status.selectedEnvironment}</dd>
              </div>
              <div>
                <dt>Config version</dt>
                <dd>{status.configVersion}</dd>
              </div>
              <div>
                <dt>Credentials configured</dt>
                <dd>{status.broker.credentialsConfigured ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt>Username hint</dt>
                <dd>{status.broker.usernameHint ?? "—"}</dd>
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
          </section>

          <section className="fx-auto-trading-card" aria-label="Recent audit events">
            <h2 className="fx-ai-guided-title">Recent audit</h2>
            {audit.length === 0 ? (
              <p className="fx-ai-muted">No audit events yet.</p>
            ) : (
              <ul className="fx-ai-local-list">
                {audit.map((e) => (
                  <li key={e.id}>
                    <span className="fx-ai-muted">{e.atUtc}</span>
                    {" · "}
                    {e.action}
                    {e.environment ? ` · ${e.environment}` : ""}
                    {e.ok ? "" : ` · ${e.code ?? "failed"}`}
                    {" — "}
                    {e.detail}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        !error && <p className="fx-ai-muted">{busy ? "Loading status…" : "Status unavailable."}</p>
      )}
    </section>
  );
}
