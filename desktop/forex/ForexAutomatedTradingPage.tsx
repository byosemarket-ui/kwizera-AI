/**
 * Phase 51.1 / 52 — Automated Trading UI (isolation + verification).
 * Configuration and read-only verification only — never places broker orders.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import type { SelectedMarket } from "./market-data/selected-market";

const FOREX_ADMIN_TOKEN_STORAGE_KEY = "kwizera.admin.apiToken";
const BANNER = "AUTOMATED EXECUTION NOT IMPLEMENTED — PHASE 53";

type Env = "DEMO" | "LIVE";

type Readiness = {
  environmentVerified: boolean;
  accountIdentityVerified: boolean;
  accountMetadataSufficient: boolean;
  instrumentMetadataVerified: boolean;
  marketDataHealthVerified: boolean;
  riskEngineVerified: false;
  executionImplemented: false;
  readyForFutureAnalysis: boolean;
  readyForTrading: false;
};

type Verification = {
  identityStatus: string;
  environmentSelected: Env;
  environmentConnected: Env | null;
  environmentMatches: boolean | null;
  connectionStatus: string;
  environmentEpoch: number;
  account: {
    accountIdMasked: string | null;
    accountCurrency: string | null;
    balance: number | null;
    equity: number | null;
    equityDerived: boolean;
    usedMargin: number | null;
    usableMargin: number | null;
    isFresh: boolean;
    fetchedAtUtc: string | null;
    fields: Record<string, boolean>;
  };
  instrument: {
    symbol: string | null;
    displaySymbol: string | null;
    level: string;
    contractVerified: boolean;
    pointSize: number | null;
    quantityStep: number | null;
  };
  market: {
    bid: number | null;
    ask: number | null;
    spread: number | null;
    feedStatus: string;
    priceChangeAgeMs: number | null;
    marketSession: string;
  };
  readiness: Readiness;
  blockers: Array<{ code: string; message: string }>;
  verifiedAtUtc: string;
};

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
  verification: Verification | null;
  readiness: Readiness | null;
  selectedEnvState?: { selectedInstrument?: string | null };
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
  if (s === "READY" || s === "CONNECTED" || s === "LIVE" || s === "ACCOUNT_VERIFIED") return "live";
  if (
    s === "BLOCKED"
    || s === "MISMATCH"
    || s === "ERROR"
    || s === "ENVIRONMENT_MISMATCH"
    || s === "STALE"
    || s === "CONNECTION_FAILED"
  ) {
    return "offline";
  }
  return "future";
}

function gateLabel(ok: boolean): string {
  return ok ? "PASS" : "FAIL";
}

function actionableBlockers(blockers: string[], banner: string): string[] {
  const bannerNorm = banner.trim().toUpperCase();
  return blockers.filter((b) => {
    const t = b.trim().toUpperCase();
    return t !== bannerNorm && !t.startsWith("AUTOMATED EXECUTION NOT IMPLEMENTED");
  });
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function fcInstrumentFromMarket(market: SelectedMarket | null): string | null {
  if (!market) return null;
  if (market.venue === "forexconnect" || market.provider === "FOREXCONNECT") {
    return market.symbol;
  }
  return null;
}

export function ForexAutomatedTradingPage(props: {
  selectedMarket?: SelectedMarket | null;
  timeframe?: string;
}) {
  const [token, setToken] = useState(readAdminToken);
  const [tokenDraft, setTokenDraft] = useState(token);
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingEnv, setPendingEnv] = useState<Env | null>(null);
  const [openaiStatus, setOpenaiStatus] = useState<{
    provider: "OPENAI";
    modelConfigured: string | null;
    apiKeyConfigured: boolean;
    latest: Record<string, unknown> | null;
    historyCount: number;
    inFlight: boolean;
  } | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<Array<Record<string, unknown>>>([]);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const seq = useRef(0);

  const shellInstrument = fcInstrumentFromMarket(props.selectedMarket ?? null);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setBusy(true);
    setError(null);
    try {
      const [stRes, auRes, oaRes, histRes] = await Promise.all([
        fetch("/api/forex/automated-trading/status", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/audit?limit=12", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/openai/status", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/openai/history?limit=6", { headers: adminHeaders(token) }),
      ]);
      const stJson = await stRes.json() as {
        ok?: boolean;
        status?: PublicStatus;
        error?: { message?: string; code?: string };
      };
      const auJson = await auRes.json() as { ok?: boolean; events?: AuditEvent[] };
      const oaJson = await oaRes.json() as { ok?: boolean; openai?: typeof openaiStatus };
      const histJson = await histRes.json() as { ok?: boolean; history?: Array<Record<string, unknown>> };
      if (n !== seq.current) return;
      if (!stRes.ok || !stJson.ok || !stJson.status) {
        setStatus(null);
        setError(stJson.error?.message || stJson.error?.code || `Status ${stRes.status}`);
        return;
      }
      setStatus(stJson.status);
      setAudit(Array.isArray(auJson.events) ? auJson.events : []);
      if (oaRes.ok && oaJson.ok && oaJson.openai) setOpenaiStatus(oaJson.openai);
      if (histRes.ok && histJson.ok && Array.isArray(histJson.history)) {
        setAnalysisHistory(histJson.history);
      }
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
        return data;
      }
      setStatus(data.status);
      await load();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      return null;
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

  const runVerify = async () => {
    if (!status) return;
    const instrument =
      shellInstrument
      ?? status.selectedEnvState?.selectedInstrument
      ?? status.verification?.instrument.symbol
      ?? null;
    await postJson("/api/forex/automated-trading/verify", {
      environment: status.selectedEnvironment,
      expectedEnvironmentEpoch: status.environmentEpoch,
      instrument: instrument || undefined,
      timeframe: props.timeframe || "m1",
    });
  };

  const runOpenAiAnalysis = async () => {
    if (!status || analysisBusy) return;
    setAnalysisBusy(true);
    setError(null);
    try {
      const instrument =
        shellInstrument
        ?? status.selectedEnvState?.selectedInstrument
        ?? status.verification?.instrument.symbol
        ?? null;
      const res = await fetch("/api/forex/automated-trading/openai/analyze", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify({
          environment: status.selectedEnvironment,
          expectedEnvironmentEpoch: status.environmentEpoch,
          instrument: instrument || undefined,
        }),
      });
      const data = await res.json() as {
        ok?: boolean;
        analysis?: Record<string, unknown>;
        status?: PublicStatus;
        error?: { message?: string; code?: string };
      };
      if (data.status) setStatus(data.status);
      if (!res.ok || !data.ok) {
        setError(data.error?.message || data.error?.code || `Analysis failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "OpenAI analysis failed");
    } finally {
      setAnalysisBusy(false);
    }
  };

  const blockers = useMemo(
    () => (status ? actionableBlockers(status.blockers, status.banner || BANNER) : []),
    [status],
  );

  const verification = status?.verification ?? null;
  const readiness = status?.readiness ?? verification?.readiness ?? null;
  const authState = token ? "Authorized (session)" : "Not authorized";
  const selectedInstrument =
    shellInstrument
    ?? status?.selectedEnvState?.selectedInstrument
    ?? verification?.instrument.symbol
    ?? null;

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
        <div className="fx-auto-trading-header-actions">
          <button type="button" className="fx-capture-button" onClick={() => void runVerify()} disabled={busy || !status}>
            {busy ? "Working…" : "Verify"}
          </button>
          <button type="button" className="fx-capture-button" onClick={() => void load()} disabled={busy}>
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
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
                </span>
              </div>
              <div className="fx-auto-summary-cell">
                <span className="fx-ai-label">Account</span>
                <span className="fx-auto-summary-value" data-fx-at-account-masked="true">
                  {verification?.account.accountIdMasked
                    ?? status.broker.accountIdMasked
                    ?? "—"}
                </span>
              </div>
              <div className="fx-auto-summary-cell">
                <span className="fx-ai-label">Verified</span>
                <span data-fx-at-account-verified={status.broker.accountVerified ? "yes" : "no"}>
                  {status.broker.accountVerified ? "yes" : "no"}
                </span>
              </div>
              <div className="fx-auto-summary-cell">
                <span className="fx-ai-label">Instrument</span>
                <span className="fx-auto-summary-value">{selectedInstrument ?? "—"}</span>
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
                  {pendingEnv === "LIVE" ? " LIVE execution remains disabled." : ""}
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
          </section>

          <section className="fx-auto-trading-panel" aria-label="Verification" data-fx-at-verification="true">
            <div className="fx-auto-trading-panel-head">
              <h2 className="fx-auto-trading-h2">Account & market verification</h2>
              <p className="fx-auto-trading-hint">
                Read-only. Connected ≠ verified. LIVE quotes require recent Bid/Ask changes.
              </p>
            </div>

            {readiness ? (
              <ul className="fx-auto-gates" data-fx-at-readiness="true">
                <li data-ok={readiness.environmentVerified}>{gateLabel(readiness.environmentVerified)} Environment</li>
                <li data-ok={readiness.accountIdentityVerified}>{gateLabel(readiness.accountIdentityVerified)} Account identity</li>
                <li data-ok={readiness.accountMetadataSufficient}>{gateLabel(readiness.accountMetadataSufficient)} Account metadata</li>
                <li data-ok={readiness.instrumentMetadataVerified}>{gateLabel(readiness.instrumentMetadataVerified)} Instrument metadata</li>
                <li data-ok={readiness.marketDataHealthVerified}>{gateLabel(readiness.marketDataHealthVerified)} Market data</li>
                <li data-ok={false}>FAIL Risk engine (not implemented)</li>
                <li data-ok={false}>FAIL Execution (not implemented)</li>
                <li data-ok={readiness.readyForFutureAnalysis}>
                  {gateLabel(readiness.readyForFutureAnalysis)} Ready for future analysis
                </li>
              </ul>
            ) : (
              <p className="fx-auto-trading-hint">Run Verify to populate readiness gates.</p>
            )}

            {verification ? (
              <>
                <div className="fx-auto-trading-summary fx-auto-verify-grid">
                  <div className="fx-auto-summary-cell">
                    <span className="fx-ai-label">Identity</span>
                    <ForexStatusBadge tone={statusTone(verification.identityStatus)}>
                      {verification.identityStatus}
                    </ForexStatusBadge>
                  </div>
                  <div className="fx-auto-summary-cell">
                    <span className="fx-ai-label">Currency</span>
                    <span>{verification.account.accountCurrency ?? "unavailable"}</span>
                  </div>
                  <div className="fx-auto-summary-cell">
                    <span className="fx-ai-label">Balance</span>
                    <span>{verification.account.fields.balance ? fmtNum(verification.account.balance) : "unavailable"}</span>
                  </div>
                  <div className="fx-auto-summary-cell">
                    <span className="fx-ai-label">Equity</span>
                    <span>
                      {verification.account.equity != null
                        ? `${fmtNum(verification.account.equity)}${verification.account.equityDerived ? " (derived)" : ""}`
                        : "unavailable"}
                    </span>
                  </div>
                  <div className="fx-auto-summary-cell">
                    <span className="fx-ai-label">Used / usable</span>
                    <span>
                      {verification.account.fields.usedMargin ? fmtNum(verification.account.usedMargin) : "—"}
                      {" / "}
                      {verification.account.fields.usableMargin ? fmtNum(verification.account.usableMargin) : "—"}
                    </span>
                  </div>
                  <div className="fx-auto-summary-cell">
                    <span className="fx-ai-label">Instrument</span>
                    <span>
                      {verification.instrument.displaySymbol ?? "—"} · {verification.instrument.level}
                    </span>
                  </div>
                  <div className="fx-auto-summary-cell">
                    <span className="fx-ai-label">Bid / Ask</span>
                    <span>
                      {verification.market.bid != null && verification.market.ask != null
                        ? `${fmtNum(verification.market.bid, 5)} / ${fmtNum(verification.market.ask, 5)}`
                        : "—"}
                    </span>
                  </div>
                  <div className="fx-auto-summary-cell">
                    <span className="fx-ai-label">Spread</span>
                    <span>{verification.market.spread != null ? fmtNum(verification.market.spread, 5) : "—"}</span>
                  </div>
                  <div className="fx-auto-summary-cell">
                    <span className="fx-ai-label">Feed</span>
                    <ForexStatusBadge tone={statusTone(verification.market.feedStatus)}>
                      {verification.market.feedStatus}
                    </ForexStatusBadge>
                  </div>
                  <div className="fx-auto-summary-cell">
                    <span className="fx-ai-label">Price age</span>
                    <span>
                      {verification.market.priceChangeAgeMs != null
                        ? `${Math.round(verification.market.priceChangeAgeMs / 1000)}s`
                        : "—"}
                    </span>
                  </div>
                  <div className="fx-auto-summary-cell">
                    <span className="fx-ai-label">Last verify</span>
                    <span>{verification.verifiedAtUtc}</span>
                  </div>
                </div>
                {verification.blockers.length > 0 ? (
                  <ul className="fx-auto-trading-blockers" aria-label="Verification blockers">
                    {verification.blockers
                      .filter((b) => b.code !== "EXECUTION_NOT_IMPLEMENTED" && b.code !== "RISK_ENGINE_NOT_IMPLEMENTED")
                      .slice(0, 8)
                      .map((b) => (
                        <li key={`${b.code}:${b.message}`}>{b.code}: {b.message}</li>
                      ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="fx-auto-trading-hint">
                {shellInstrument
                  ? `Shell market ${shellInstrument} will be used on Verify.`
                  : "Select a ForexConnect instrument in Markets, then Verify."}
              </p>
            )}

            {blockers.length > 0 ? (
              <ul className="fx-auto-trading-blockers" aria-label="Execution blockers">
                {blockers.slice(0, 6).map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="fx-auto-trading-panel" aria-label="Technical analysis" data-fx-at-openai-ta="true">
            <div className="fx-auto-trading-panel-head">
              <h2 className="fx-auto-trading-h2">Technical analysis (OpenAI)</h2>
              <button
                type="button"
                className="fx-capture-button"
                disabled={busy || analysisBusy || !status}
                onClick={() => void runOpenAiAnalysis()}
                data-fx-at-run-openai="true"
              >
                {analysisBusy ? "Analyzing…" : "Run OpenAI Analysis"}
              </button>
            </div>
            <p className="fx-auto-trading-hint">
              Independent AT engine — not Forex AI Analysis history. Deliberate run only. Confidence: NOT CALIBRATED.
            </p>
            <dl className="fx-auto-config-grid">
              <div>
                <dt>Provider</dt>
                <dd>OpenAI</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{openaiStatus?.modelConfigured ?? "—"}</dd>
              </div>
              <div>
                <dt>API key</dt>
                <dd>{openaiStatus?.apiKeyConfigured ? "configured" : "missing"}</dd>
              </div>
              <div>
                <dt>In flight</dt>
                <dd>{openaiStatus?.inFlight || analysisBusy ? "yes" : "no"}</dd>
              </div>
            </dl>
            {(() => {
              const latest = (openaiStatus?.latest ?? null) as null | {
                lifecycle?: string;
                directionalBias?: string;
                trendState?: string;
                mtfAgreement?: string;
                explanation?: string;
                inputFingerprint?: string;
                modelUsed?: string | null;
                createdAtUtc?: string;
                dataQuality?: string;
                confidenceLabel?: string;
                historicalOnly?: boolean;
                keyEvidence?: string[];
                counterEvidence?: string[];
                supportLevels?: Array<{ price: number | null; provenance: string | null; verifiedAgainstSnapshot: boolean }>;
                resistanceLevels?: Array<{ price: number | null; provenance: string | null; verifiedAgainstSnapshot: boolean }>;
                scenarios?: Array<{ id: string; summary: string; confirmationConditions?: string[]; invalidationConditions?: string[] }>;
                limitations?: string[];
                blockers?: Array<{ code: string; message: string }>;
                instrument?: string;
                environment?: string;
              };
              if (!latest) {
                return <p className="fx-auto-trading-hint">No AT OpenAI analysis yet. Verify market context, then run analysis.</p>;
              }
              return (
                <div className="fx-auto-ta-result" data-fx-at-openai-result="true">
                  <div className="fx-auto-trading-summary fx-auto-verify-grid">
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">Status</span>
                      <ForexStatusBadge tone={statusTone(String(latest.lifecycle ?? ""))}>
                        {latest.lifecycle ?? "—"}
                      </ForexStatusBadge>
                    </div>
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">Bias</span>
                      <span>{latest.directionalBias ?? "—"}</span>
                    </div>
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">Trend</span>
                      <span>{latest.trendState ?? "—"}</span>
                    </div>
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">MTF</span>
                      <span>{latest.mtfAgreement ?? "—"}</span>
                    </div>
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">Model used</span>
                      <span>{latest.modelUsed ?? openaiStatus?.modelConfigured ?? "—"}</span>
                    </div>
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">Fingerprint</span>
                      <span className="fx-auto-summary-value">{latest.inputFingerprint ?? "—"}</span>
                    </div>
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">Data quality</span>
                      <span>{latest.dataQuality ?? "—"}{latest.historicalOnly ? " · historical-only" : ""}</span>
                    </div>
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">Confidence</span>
                      <span>{latest.confidenceLabel ?? "NOT CALIBRATED"}</span>
                    </div>
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">When</span>
                      <span>{latest.createdAtUtc ?? "—"}</span>
                    </div>
                  </div>
                  {latest.explanation ? <p className="fx-auto-trading-hint">{latest.explanation}</p> : null}
                  {latest.keyEvidence && latest.keyEvidence.length > 0 ? (
                    <ul className="fx-auto-trading-blockers" aria-label="Key evidence">
                      {latest.keyEvidence.slice(0, 5).map((e) => <li key={e}>+ {e}</li>)}
                    </ul>
                  ) : null}
                  {latest.counterEvidence && latest.counterEvidence.length > 0 ? (
                    <ul className="fx-auto-trading-blockers" aria-label="Counter evidence">
                      {latest.counterEvidence.slice(0, 4).map((e) => <li key={e}>− {e}</li>)}
                    </ul>
                  ) : null}
                  {(latest.supportLevels?.length || latest.resistanceLevels?.length) ? (
                    <ul className="fx-auto-trading-blockers" aria-label="Levels">
                      {(latest.supportLevels ?? []).filter((l) => l.verifiedAgainstSnapshot && l.price != null).slice(0, 3).map((l) => (
                        <li key={`s-${l.price}`}>S {l.price} · {l.provenance ?? "snapshot"}</li>
                      ))}
                      {(latest.resistanceLevels ?? []).filter((l) => l.verifiedAgainstSnapshot && l.price != null).slice(0, 3).map((l) => (
                        <li key={`r-${l.price}`}>R {l.price} · {l.provenance ?? "snapshot"}</li>
                      ))}
                    </ul>
                  ) : null}
                  {latest.scenarios?.slice(0, 2).map((sc) => (
                    <div key={sc.id} className="fx-auto-ta-scenario">
                      <strong>{sc.id}</strong>
                      <p className="fx-auto-trading-hint">{sc.summary}</p>
                    </div>
                  ))}
                  {latest.blockers && latest.blockers.length > 0 ? (
                    <ul className="fx-auto-trading-blockers" aria-label="Analysis blockers">
                      {latest.blockers
                        .filter((b) => b.code !== "EXECUTION_NOT_IMPLEMENTED" && b.code !== "RISK_NOT_IMPLEMENTED")
                        .slice(0, 5)
                        .map((b) => <li key={`${b.code}:${b.message}`}>{b.code}: {b.message}</li>)}
                    </ul>
                  ) : null}
                </div>
              );
            })()}
            {analysisHistory.length > 0 ? (
              <>
                <h3 className="fx-auto-trading-h3">AT analysis history</h3>
                <ul className="fx-auto-audit-list">
                  {analysisHistory.slice(0, 6).map((h) => (
                    <li key={String(h.analysisId)}>
                      <time dateTime={String(h.createdAtUtc ?? "")}>
                        {String(h.createdAtUtc ?? "").slice(11, 19)}Z
                      </time>
                      <span>
                        {String(h.directionalBias ?? "—")} · {String(h.lifecycle ?? "")}
                        {h.modelUsed ? ` · ${String(h.modelUsed)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section className="fx-auto-trading-panel" aria-label="Trading controls">
            <div className="fx-auto-trading-panel-head">
              <h2 className="fx-auto-trading-h2">Controls</h2>
              <p className="fx-auto-trading-hint">Configuration only — cannot submit broker orders.</p>
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
                <dd>disabled (Phase 53)</dd>
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
