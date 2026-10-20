/**
 * Phase 51.1 / 52 — Automated Trading UI (isolation + verification).
 * Configuration and read-only verification only — never places broker orders.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import type { SelectedMarket } from "./market-data/selected-market";

const FOREX_ADMIN_TOKEN_STORAGE_KEY = "kwizera.admin.apiToken";
const BANNER = "AUTOMATED EXECUTION NOT IMPLEMENTED — PHASE 54";

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
    capitalAllocationPercent?: number | null;
    capitalAllocationBudget?: number | null;
    capitalAllocationBudgetStatus?: "COMPUTED" | "UNAVAILABLE" | "UNSET";
    capitalAllocationCurrency?: string | null;
    verifiedEquity?: number | null;
  };
  blockers: string[];
  explanation: string;
  verification: Verification | null;
  readiness: Readiness | null;
  quoteFreshness?: {
    fresh: boolean;
    reasonCode: string;
    thresholdMs: number;
    verificationAgeMs: number | null;
    effectivePriceChangeAgeMs: number | null;
    effectiveReceiptAgeMs: number | null;
    snapshotFingerprint: string | null;
    evaluatedAtUtc: string;
    sourceTimestampMs: number | null;
    receivedAtMs: number | null;
  } | null;
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
  const [monitor, setMonitor] = useState<{
    supportedTimeframes?: string[];
    unsupportedNote?: string;
    requiresBrowserOpen?: boolean;
    persistsAcrossVpsReboot?: string;
    config?: {
      enabled?: boolean;
      instrument?: string;
      timeframe?: string;
      environment?: string;
      configEpoch?: number;
    } | null;
    health?: {
      workerState?: string;
      workerActive?: boolean;
      lastQuoteChangeAtUtc?: string | null;
      lastCandleUpdateAtUtc?: string | null;
      lastScreenshotAtUtc?: string | null;
      lastAnalysisAtUtc?: string | null;
      nextScheduledAnalysisAtUtc?: string | null;
      lastError?: string | null;
      lastBlockerCode?: string | null;
      quoteFresh?: boolean | null;
      freshnessReasonCode?: string | null;
      freshnessThresholdMs?: number | null;
      verificationAgeMs?: number | null;
      effectivePriceChangeAgeMs?: number | null;
      analysisInFlight?: boolean;
      lastAnalysisId?: string | null;
      lastScreenshotImageHash?: string | null;
    };
  } | null>(null);
  const [monitorTf, setMonitorTf] = useState("15m");
  const [monitorBusy, setMonitorBusy] = useState(false);
  const [chartObjectUrl, setChartObjectUrl] = useState<string | null>(null);
  const [decisionStatus, setDecisionStatus] = useState<{
    phase?: string;
    policy?: {
      confidenceThresholdEnabled?: boolean;
      minDirectionalConfidencePct?: number;
    };
    latest?: Record<string, unknown> | null;
    historyCount?: number;
    note?: string;
  } | null>(null);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [simRiskStatus, setSimRiskStatus] = useState<{
    phase?: string;
    policy?: { riskBudgetMode?: string; riskPercent?: number | null; note?: string };
    allowlist?: string[];
    latest?: Record<string, unknown> | null;
    historyCount?: number;
    note?: string;
    simulationOnly?: boolean;
  } | null>(null);
  const [simDraftEntry, setSimDraftEntry] = useState("");
  const [simDraftSl, setSimDraftSl] = useState("");
  const [simDraftTp, setSimDraftTp] = useState("");
  const [simDraftPerOrderAlloc, setSimDraftPerOrderAlloc] = useState("");
  const [capitalAllocDraft, setCapitalAllocDraft] = useState("");
  const [simRiskBusy, setSimRiskBusy] = useState(false);
  const seq = useRef(0);

  const shellInstrument = fcInstrumentFromMarket(props.selectedMarket ?? null);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setBusy(true);
    setError(null);
    try {
      const [stRes, auRes, oaRes, histRes, monRes, decRes, simRes] = await Promise.all([
        fetch("/api/forex/automated-trading/status", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/audit?limit=12", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/openai/status", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/openai/history?limit=6", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/monitor/status", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/decision/status", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/simulation-risk/status", { headers: adminHeaders(token) }),
      ]);
      const stJson = await stRes.json() as {
        ok?: boolean;
        status?: PublicStatus;
        error?: { message?: string; code?: string };
      };
      const auJson = await auRes.json() as { ok?: boolean; events?: AuditEvent[] };
      const oaJson = await oaRes.json() as { ok?: boolean; openai?: typeof openaiStatus };
      const histJson = await histRes.json() as { ok?: boolean; history?: Array<Record<string, unknown>> };
      const monJson = await monRes.json() as { ok?: boolean; monitor?: typeof monitor };
      const decJson = await decRes.json() as { ok?: boolean; decision?: typeof decisionStatus };
      const simJson = await simRes.json() as { ok?: boolean; simulationRisk?: typeof simRiskStatus };
      if (n !== seq.current) return;
      if (!stRes.ok || !stJson.ok || !stJson.status) {
        setStatus(null);
        setError(stJson.error?.message || stJson.error?.code || `Status ${stRes.status}`);
        return;
      }
      setStatus(stJson.status);
      {
        const pct = stJson.status.controls.capitalAllocationPercent;
        setCapitalAllocDraft(pct == null || pct === undefined ? "" : String(pct));
      }
      setAudit(Array.isArray(auJson.events) ? auJson.events : []);
      if (oaRes.ok && oaJson.ok && oaJson.openai) setOpenaiStatus(oaJson.openai);
      if (histRes.ok && histJson.ok && Array.isArray(histJson.history)) {
        setAnalysisHistory(histJson.history);
      }
      if (monRes.ok && monJson.ok && monJson.monitor) {
        setMonitor(monJson.monitor);
        if (monJson.monitor.config?.timeframe) setMonitorTf(String(monJson.monitor.config.timeframe));
      }
      if (decRes.ok && decJson.ok && decJson.decision) setDecisionStatus(decJson.decision);
      if (simRes.ok && simJson.ok && simJson.simulationRisk) setSimRiskStatus(simJson.simulationRisk);
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

  useEffect(() => {
    const latest = openaiStatus?.latest as { analysisId?: string; chartImage?: { available?: boolean } } | null;
    const id = latest?.analysisId;
    if (!id || !latest?.chartImage?.available || !token.trim()) {
      setChartObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const res = await fetch(
          `/api/forex/automated-trading/monitor/chart-image/${encodeURIComponent(id)}`,
          { headers: adminHeaders(token) },
        );
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setChartObjectUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
      } catch {
        /* ignore chart load errors */
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [openaiStatus?.latest, token]);

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

  const patchControls = async (patch: Record<string, boolean | number | null>) => {
    if (!status) return;
    await postJson("/api/forex/automated-trading/controls", {
      environment: status.selectedEnvironment,
      expectedEnvironmentEpoch: status.environmentEpoch,
      patch,
    });
  };

  const saveCapitalAllocationPercent = async () => {
    if (!status) return;
    const raw = capitalAllocDraft.trim();
    if (raw === "") {
      await patchControls({ capitalAllocationPercent: null });
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      setError("Strategy capital allocation % must be a finite number from 1 to 100.");
      return;
    }
    await patchControls({ capitalAllocationPercent: n });
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
    if (!status || analysisBusy || monitorBusy) return;
    setAnalysisBusy(true);
    setError(null);
    try {
      const instrument =
        shellInstrument
        ?? status.selectedEnvState?.selectedInstrument
        ?? status.verification?.instrument.symbol
        ?? monitor?.config?.instrument
        ?? null;
      const res = await fetch("/api/forex/automated-trading/monitor/analyze-now", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify({
          environment: status.selectedEnvironment,
          expectedEnvironmentEpoch: status.environmentEpoch,
          instrument: instrument || undefined,
          timeframe: monitorTf,
        }),
      });
      const data = await res.json() as {
        ok?: boolean;
        analysisId?: string;
        status?: PublicStatus;
        monitor?: typeof monitor;
        error?: { message?: string; code?: string };
      };
      if (data.status) setStatus(data.status);
      if (data.monitor) setMonitor(data.monitor);
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

  const evaluateDecision = async () => {
    if (!status || decisionBusy) return;
    setDecisionBusy(true);
    setError(null);
    try {
      const latest = openaiStatus?.latest as { analysisId?: string } | null;
      const res = await fetch("/api/forex/automated-trading/decision/evaluate", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify({
          analysisId: latest?.analysisId,
          expectedEnvironmentEpoch: status.environmentEpoch,
        }),
      });
      const data = await res.json() as {
        ok?: boolean;
        decision?: Record<string, unknown>;
        status?: PublicStatus;
        error?: { message?: string; code?: string };
      };
      if (data.status) setStatus(data.status);
      if (data.decision) {
        setDecisionStatus((prev) => ({
          ...(prev ?? {}),
          latest: data.decision ?? null,
        }));
      }
      if (!res.ok || !data.ok) {
        setError(data.error?.message || data.error?.code || `Decision failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision evaluation failed");
    } finally {
      setDecisionBusy(false);
    }
  };

  const validateSimDraft = async () => {
    if (!status || simRiskBusy) return;
    setSimRiskBusy(true);
    setError(null);
    try {
      const latestDecision = decisionStatus?.latest as {
        decisionId?: string;
        direction?: "BUY" | "SELL" | null;
        instrument?: string | null;
      } | null;
      const instrument =
        latestDecision?.instrument
        || status.selectedEnvState?.selectedInstrument
        || "XAU/USD";
      const res = await fetch("/api/forex/automated-trading/simulation-risk/validate", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify({
          expectedEnvironmentEpoch: status.environmentEpoch,
          decisionId: latestDecision?.decisionId,
          instrument,
          direction: latestDecision?.direction ?? undefined,
          entryPrice: simDraftEntry.trim() ? Number(simDraftEntry) : undefined,
          stopLoss: simDraftSl.trim() ? Number(simDraftSl) : undefined,
          takeProfit: simDraftTp.trim() ? Number(simDraftTp) : undefined,
          requestedPerOrderAllocation: simDraftPerOrderAlloc.trim()
            ? Number(simDraftPerOrderAlloc)
            : undefined,
        }),
      });
      const data = await res.json() as {
        ok?: boolean;
        draft?: Record<string, unknown>;
        status?: PublicStatus;
        error?: { message?: string; code?: string };
      };
      if (data.status) setStatus(data.status);
      if (data.draft) {
        setSimRiskStatus((prev) => ({
          ...(prev ?? {}),
          latest: data.draft ?? null,
        }));
      }
      if (!res.ok || !data.ok) {
        setError(data.error?.message || data.error?.code || `Simulation draft failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation draft validation failed");
    } finally {
      setSimRiskBusy(false);
    }
  };

  const startMonitoring = async () => {
    if (!status || monitorBusy) return;
    setMonitorBusy(true);
    setError(null);
    try {
      const instrument =
        shellInstrument
        ?? status.selectedEnvState?.selectedInstrument
        ?? status.verification?.instrument.symbol
        ?? null;
      const res = await fetch("/api/forex/automated-trading/monitor/start", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify({
          environment: status.selectedEnvironment,
          expectedEnvironmentEpoch: status.environmentEpoch,
          instrument: instrument || undefined,
          timeframe: monitorTf,
        }),
      });
      const data = await res.json() as {
        ok?: boolean;
        status?: PublicStatus;
        monitor?: typeof monitor;
        error?: { message?: string; code?: string };
      };
      if (data.status) setStatus(data.status);
      if (data.monitor) setMonitor(data.monitor);
      if (!res.ok || !data.ok) {
        setError(data.error?.message || data.error?.code || `Start failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start monitoring failed");
    } finally {
      setMonitorBusy(false);
    }
  };

  const stopMonitoring = async () => {
    if (!status || monitorBusy) return;
    setMonitorBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/forex/automated-trading/monitor/stop", {
        method: "POST",
        headers: adminHeaders(token),
        body: "{}",
      });
      const data = await res.json() as {
        ok?: boolean;
        status?: PublicStatus;
        monitor?: typeof monitor;
        error?: { message?: string; code?: string };
      };
      if (data.status) setStatus(data.status);
      if (data.monitor) setMonitor(data.monitor);
      if (!res.ok || !data.ok) {
        setError(data.error?.message || data.error?.code || `Stop failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stop monitoring failed");
    } finally {
      setMonitorBusy(false);
    }
  };

  const applyMonitorConfig = async () => {
    if (!status || monitorBusy) return;
    setMonitorBusy(true);
    setError(null);
    try {
      const instrument =
        shellInstrument
        ?? status.selectedEnvState?.selectedInstrument
        ?? status.verification?.instrument.symbol
        ?? monitor?.config?.instrument
        ?? null;
      const res = await fetch("/api/forex/automated-trading/monitor/change", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify({
          environment: status.selectedEnvironment,
          expectedEnvironmentEpoch: status.environmentEpoch,
          instrument: instrument || undefined,
          timeframe: monitorTf,
        }),
      });
      const data = await res.json() as {
        ok?: boolean;
        status?: PublicStatus;
        monitor?: typeof monitor;
        error?: { message?: string; code?: string };
      };
      if (data.status) setStatus(data.status);
      if (data.monitor) setMonitor(data.monitor);
      if (!res.ok || !data.ok) {
        setError(data.error?.message || data.error?.code || `Change failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Change monitoring config failed");
    } finally {
      setMonitorBusy(false);
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

          <section className="fx-auto-trading-panel" aria-label="Live monitoring" data-fx-at-monitor="true">
            <div className="fx-auto-trading-panel-head">
              <h2 className="fx-auto-trading-h2">Live FXCM monitoring</h2>
              <div className="fx-auto-env-actions">
                <button
                  type="button"
                  className="fx-capture-button"
                  disabled={busy || monitorBusy || !status || Boolean(monitor?.config?.enabled)}
                  onClick={() => void startMonitoring()}
                  data-fx-at-monitor-start="true"
                >
                  {monitorBusy ? "…" : "Start"}
                </button>
                <button
                  type="button"
                  className="fx-capture-button"
                  disabled={busy || monitorBusy || !status || !monitor?.config?.enabled}
                  onClick={() => void stopMonitoring()}
                  data-fx-at-monitor-stop="true"
                >
                  Stop
                </button>
              </div>
            </div>
            <p className="fx-auto-trading-hint">
              Server-side worker — continues after you leave this page. Not a browser screenshot session.
              {" "}Chart image required for OpenAI. Confidence: NOT CALIBRATED. H2 unsupported on ForexConnect mappings.
            </p>
            <div className="fx-auto-monitor-controls">
              <label className="fx-auto-trading-hint" htmlFor="fx-at-monitor-tf">
                Timeframe
                <select
                  id="fx-at-monitor-tf"
                  className="fx-auto-monitor-select"
                  value={monitorTf}
                  onChange={(e) => setMonitorTf(e.target.value)}
                  data-fx-at-monitor-tf="true"
                >
                  {(monitor?.supportedTimeframes ?? ["5m", "15m", "30m", "1h"]).map((tf) => (
                    <option key={tf} value={tf}>{tf}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="fx-capture-button"
                disabled={busy || monitorBusy || !status || !monitor?.config?.enabled}
                onClick={() => void applyMonitorConfig()}
                data-fx-at-monitor-change="true"
              >
                Apply change
              </button>
            </div>
            <dl className="fx-auto-config-grid">
              <div>
                <dt>Worker</dt>
                <dd>
                  <ForexStatusBadge tone={statusTone(String(monitor?.health?.workerState ?? "STOPPED"))}>
                    {monitor?.health?.workerState ?? "STOPPED"}
                  </ForexStatusBadge>
                </dd>
              </div>
              <div>
                <dt>Instrument</dt>
                <dd>{monitor?.config?.instrument ?? shellInstrument ?? status?.selectedEnvState?.selectedInstrument ?? "—"}</dd>
              </div>
              <div>
                <dt>Last quote change</dt>
                <dd>{monitor?.health?.lastQuoteChangeAtUtc ?? "—"}</dd>
              </div>
              <div>
                <dt>Last candle</dt>
                <dd>{monitor?.health?.lastCandleUpdateAtUtc ?? "—"}</dd>
              </div>
              <div>
                <dt>Last chart</dt>
                <dd>{monitor?.health?.lastScreenshotAtUtc ?? "—"}</dd>
              </div>
              <div>
                <dt>Last OpenAI</dt>
                <dd>{monitor?.health?.lastAnalysisAtUtc ?? "—"}</dd>
              </div>
              <div>
                <dt>Next scheduled</dt>
                <dd>{monitor?.health?.nextScheduledAnalysisAtUtc ?? "—"}</dd>
              </div>
              <div>
                <dt>Quote fresh</dt>
                <dd>{monitor?.health?.quoteFresh == null ? "—" : monitor.health.quoteFresh ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt>Freshness reason</dt>
                <dd>{monitor?.health?.freshnessReasonCode ?? status?.quoteFreshness?.reasonCode ?? "—"}</dd>
              </div>
              <div>
                <dt>Verification age</dt>
                <dd>
                  {monitor?.health?.verificationAgeMs != null
                    ? `${monitor.health.verificationAgeMs}ms`
                    : status?.quoteFreshness?.verificationAgeMs != null
                      ? `${status.quoteFreshness.verificationAgeMs}ms`
                      : "—"}
                </dd>
              </div>
              <div>
                <dt>Freshness threshold</dt>
                <dd>
                  {monitor?.health?.freshnessThresholdMs != null
                    ? `${monitor.health.freshnessThresholdMs}ms`
                    : status?.quoteFreshness?.thresholdMs != null
                      ? `${status.quoteFreshness.thresholdMs}ms`
                      : "—"}
                </dd>
              </div>
            </dl>
            {monitor?.health?.lastError ? (
              <p className="fx-auto-trading-error" role="alert">{monitor.health.lastBlockerCode}: {monitor.health.lastError}</p>
            ) : null}
          </section>

          <section className="fx-auto-trading-panel" aria-label="Technical analysis" data-fx-at-openai-ta="true">
            <div className="fx-auto-trading-panel-head">
              <h2 className="fx-auto-trading-h2">Technical analysis (OpenAI)</h2>
              <button
                type="button"
                className="fx-capture-button"
                disabled={busy || analysisBusy || monitorBusy || !status}
                onClick={() => void runOpenAiAnalysis()}
                data-fx-at-run-openai="true"
              >
                {analysisBusy ? "Analyzing…" : "Run Analysis Now"}
              </button>
            </div>
            <p className="fx-auto-trading-hint">
              Independent AT engine with server-rendered chart image when available. Deliberate or candle-close scheduled. Confidence: NOT CALIBRATED.
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
                analysisId?: string;
                lifecycle?: string;
                direction?: "BUY" | "SELL" | null;
                directionalConfidencePct?: number | null;
                directionalConfidenceNote?: string;
                forecastHorizon?: string | null;
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
                liveLabeled?: boolean;
                trigger?: string;
                primaryTimeframe?: string | null;
                chartImage?: {
                  available?: boolean;
                  imageHash?: string | null;
                  includedInOpenAiRequest?: boolean;
                  note?: string;
                } | null;
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
                return <p className="fx-auto-trading-hint">No AT OpenAI analysis yet. Start monitoring or run analysis after Verify.</p>;
              }
              const chartId = latest.analysisId;
              return (
                <div className="fx-auto-ta-result" data-fx-at-openai-result="true">
                  {latest.chartImage?.available && chartObjectUrl ? (
                    <img
                      className="fx-auto-ta-chart"
                      src={chartObjectUrl}
                      alt={`Server chart ${latest.instrument ?? ""} ${latest.primaryTimeframe ?? ""}`}
                      data-fx-at-chart-image="true"
                    />
                  ) : latest.chartImage?.available && chartId ? (
                    <p className="fx-auto-trading-hint">Chart image stored (id {chartId.slice(0, 8)}…) — loading…</p>
                  ) : null}
                  <div className="fx-auto-binary-dir" data-fx-at-binary-direction="true">
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">Direction</span>
                      <ForexStatusBadge
                        tone={
                          latest.direction === "BUY"
                            ? "online"
                            : latest.direction === "SELL"
                              ? "offline"
                              : "future"
                        }
                      >
                        {latest.direction ?? "—"}
                      </ForexStatusBadge>
                    </div>
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">Est. confidence</span>
                      <span className="fx-auto-binary-pct">
                        {latest.directionalConfidencePct != null
                          ? `${latest.directionalConfidencePct}%`
                          : "—"}
                      </span>
                    </div>
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">Label</span>
                      <span>{latest.confidenceLabel ?? "NOT CALIBRATED"}</span>
                    </div>
                  </div>
                  <p className="fx-auto-trading-hint">
                    {latest.directionalConfidenceNote
                      ?? "Estimated directional confidence — NOT CALIBRATED"}
                    {" · "}Forecast only — not an order.
                  </p>
                  <div className="fx-auto-trading-summary fx-auto-verify-grid">
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">Status</span>
                      <ForexStatusBadge tone={statusTone(String(latest.lifecycle ?? ""))}>
                        {latest.lifecycle ?? "—"}
                      </ForexStatusBadge>
                    </div>
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">Trigger</span>
                      <span>{latest.trigger ?? "—"}</span>
                    </div>
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">TF</span>
                      <span>{latest.primaryTimeframe ?? "—"}</span>
                    </div>
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">Horizon</span>
                      <span className="fx-auto-summary-value">{latest.forecastHorizon ?? "—"}</span>
                    </div>
                    <div className="fx-auto-summary-cell">
                      <span className="fx-ai-label">LIVE label</span>
                      <span>{latest.liveLabeled ? "LIVE" : "not LIVE"}</span>
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
                      <span className="fx-ai-label">Image in OpenAI</span>
                      <span data-fx-at-image-included="true">
                        {latest.chartImage?.includedInOpenAiRequest ? "yes" : "no"}
                      </span>
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
                        {h.direction ? String(h.direction) : String(h.directionalBias ?? "—")}
                        {h.directionalConfidencePct != null ? ` ${String(h.directionalConfidencePct)}%` : ""}
                        {" · "}{String(h.lifecycle ?? "")}
                        {h.primaryTimeframe ? ` · ${String(h.primaryTimeframe)}` : ""}
                        {h.inputFingerprint ? ` · fp ${String(h.inputFingerprint).slice(0, 8)}` : ""}
                        {h.chartImage && typeof h.chartImage === "object" && (h.chartImage as { imageHash?: string | null }).imageHash
                          ? ` · img ${(h.chartImage as { imageHash: string }).imageHash.slice(0, 8)}`
                          : ""}
                        {h.modelUsed ? ` · ${String(h.modelUsed)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section className="fx-auto-trading-panel" aria-label="Trading decision" data-fx-at-decision="true">
            <div className="fx-auto-trading-panel-head">
              <h2 className="fx-auto-trading-h2">Trading decision</h2>
              <button
                type="button"
                className="fx-btn fx-btn--secondary"
                disabled={busy || decisionBusy || !status}
                onClick={() => void evaluateDecision()}
                data-fx-at-decision-evaluate="true"
              >
                {decisionBusy ? "Evaluating…" : "Validate signal"}
              </button>
            </div>
            <p className="fx-auto-trading-hint">
              Read-only validation of the latest BUY/SELL analysis. Never places orders.
              Confidence remains NOT CALIBRATED.
            </p>
            <dl className="fx-auto-config-grid">
              <div>
                <dt>Threshold policy</dt>
                <dd data-fx-at-decision-threshold="true">
                  {decisionStatus?.policy?.confidenceThresholdEnabled
                    ? `enabled ≥ ${decisionStatus.policy.minDirectionalConfidencePct ?? "—"}%`
                    : "disabled (default)"}
                </dd>
              </div>
              <div>
                <dt>History</dt>
                <dd>{decisionStatus?.historyCount ?? 0}</dd>
              </div>
            </dl>
            {(() => {
              const d = (decisionStatus?.latest ?? null) as null | {
                decisionStatus?: string;
                direction?: "BUY" | "SELL" | null;
                instrument?: string | null;
                timeframe?: string | null;
                forecastHorizon?: string | null;
                sourceAnalysisId?: string | null;
                sourceEvidenceFingerprint?: string | null;
                sourceCreatedAtUtc?: string | null;
                directionalConfidencePct?: number | null;
                directionalConfidenceNote?: string;
                decidedAtUtc?: string;
                rejectionReasons?: string[];
                blockers?: Array<{ code?: string; message?: string }>;
                checks?: Array<{ code?: string; status?: string; message?: string }>;
                freshness?: {
                  quoteFresh?: boolean | null;
                  feedStatus?: string | null;
                  analysisAgeMs?: number | null;
                };
                chartImage?: {
                  applicable?: boolean;
                  includedInOpenAiRequest?: boolean | null;
                };
                acceptsForExecution?: boolean;
              };
              if (!d) {
                return (
                  <p className="fx-auto-trading-hint">
                    No decision yet. Run Validate signal after a BUY/SELL analysis.
                  </p>
                );
              }
              return (
                <div className="fx-auto-ta-result" data-fx-at-decision-result="true">
                  <div className="fx-auto-binary-dir">
                    <div>
                      <span className="fx-auto-trading-hint">Decision</span>
                      <strong
                        data-fx-at-decision-status={d.decisionStatus ?? "—"}
                        style={{
                          color:
                            d.decisionStatus === "ACCEPTED_FOR_REVIEW"
                              ? "var(--fx-accent, #3d9a6a)"
                              : undefined,
                        }}
                      >
                        {d.decisionStatus ?? "—"}
                      </strong>
                    </div>
                    <div>
                      <span className="fx-auto-trading-hint">Source direction</span>
                      <strong data-fx-at-decision-direction={d.direction ?? "none"}>
                        {d.direction ?? "—"}
                      </strong>
                    </div>
                    <div>
                      <span className="fx-auto-trading-hint">Confidence</span>
                      <strong className="fx-auto-binary-pct">
                        {d.directionalConfidencePct != null
                          ? `${d.directionalConfidencePct}%`
                          : "—"}
                      </strong>
                    </div>
                  </div>
                  <p className="fx-auto-trading-hint">
                    {d.directionalConfidenceNote
                      ?? "Estimated directional confidence — NOT CALIBRATED"}
                  </p>
                  <dl className="fx-auto-config-grid">
                    <div>
                      <dt>Instrument / TF</dt>
                      <dd>{d.instrument ?? "—"} · {d.timeframe ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Source analysis</dt>
                      <dd data-fx-at-decision-source-id="true">
                        {d.sourceAnalysisId ? d.sourceAnalysisId.slice(0, 12) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Source time</dt>
                      <dd>{d.sourceCreatedAtUtc ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Decided</dt>
                      <dd>{d.decidedAtUtc ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Fingerprint</dt>
                      <dd>
                        {d.sourceEvidenceFingerprint
                          ? d.sourceEvidenceFingerprint.slice(0, 12)
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Quote fresh</dt>
                      <dd>
                        {d.freshness?.quoteFresh == null
                          ? "—"
                          : d.freshness.quoteFresh
                            ? "yes"
                            : "no"}
                        {d.freshness?.feedStatus ? ` · ${d.freshness.feedStatus}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>Image in OpenAI</dt>
                      <dd>
                        {d.chartImage?.applicable
                          ? (d.chartImage.includedInOpenAiRequest ? "yes" : "no")
                          : "n/a"}
                      </dd>
                    </div>
                    <div>
                      <dt>Accepts execution</dt>
                      <dd data-fx-at-decision-exec="false">never</dd>
                    </div>
                  </dl>
                  {d.forecastHorizon ? (
                    <p className="fx-auto-trading-hint">Horizon: {d.forecastHorizon}</p>
                  ) : null}
                  {Array.isArray(d.rejectionReasons) && d.rejectionReasons.length > 0 ? (
                    <ul className="fx-auto-gates" data-fx-at-decision-rejections="true">
                      {d.rejectionReasons.slice(0, 8).map((r, i) => (
                        <li key={`rej-${i}`} data-ok="false">{r}</li>
                      ))}
                    </ul>
                  ) : null}
                  {Array.isArray(d.checks) && d.checks.length > 0 ? (
                    <>
                      <h3 className="fx-auto-trading-h3">Validation checks</h3>
                      <ul className="fx-auto-gates" data-fx-at-decision-checks="true">
                        {d.checks.slice(0, 16).map((c, i) => (
                          <li
                            key={`${c.code ?? "c"}-${i}`}
                            data-ok={c.status === "PASS" ? "true" : c.status === "FAIL" ? "false" : "skip"}
                          >
                            [{c.status}] {c.code}: {c.message}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              );
            })()}
          </section>

          <section
            className="fx-auto-trading-panel"
            aria-label="Simulation draft validation"
            data-fx-at-sim-risk="true"
          >
            <div className="fx-auto-trading-panel-head">
              <h2 className="fx-auto-trading-h2">Simulation draft</h2>
              <button
                type="button"
                className="fx-btn fx-btn--secondary"
                disabled={busy || simRiskBusy || !status}
                onClick={() => void validateSimDraft()}
                data-fx-at-sim-validate="true"
              >
                {simRiskBusy ? "Validating…" : "Validate draft"}
              </button>
            </div>
            <p className="fx-auto-trading-hint" data-fx-at-sim-banner="true">
              Phase 56.2.3 simulation-only. XAU/USD allowlist. Never places orders.
              Strategy capital 1–100% of equity is a budget ceiling. Per-order max estimated SL loss = 25% of that order’s allocation.
            </p>
            <dl className="fx-auto-config-grid">
              <div>
                <dt>Allowlist</dt>
                <dd data-fx-at-sim-allowlist="true">
                  {(simRiskStatus?.allowlist ?? ["XAU/USD", "XAUUSD"]).join(" · ")}
                </dd>
              </div>
              <div>
                <dt>Risk policy</dt>
                <dd data-fx-at-sim-policy="true">
                  {simRiskStatus?.policy?.riskBudgetMode ?? "UNDECIDED"}
                  {simRiskStatus?.policy?.riskPercent != null
                    ? ` · ${simRiskStatus.policy.riskPercent}%`
                    : " · no %"}
                </dd>
              </div>
              <div>
                <dt>History</dt>
                <dd>{simRiskStatus?.historyCount ?? 0}</dd>
              </div>
            </dl>
            <div className="fx-auto-token-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              <label>
                Entry
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={simDraftEntry}
                  onChange={(e) => setSimDraftEntry(e.target.value)}
                  placeholder="mid if blank"
                  data-fx-at-sim-entry="true"
                  disabled={busy || simRiskBusy}
                />
              </label>
              <label>
                SL
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={simDraftSl}
                  onChange={(e) => setSimDraftSl(e.target.value)}
                  data-fx-at-sim-sl="true"
                  disabled={busy || simRiskBusy}
                />
              </label>
              <label>
                TP
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={simDraftTp}
                  onChange={(e) => setSimDraftTp(e.target.value)}
                  data-fx-at-sim-tp="true"
                  disabled={busy || simRiskBusy}
                />
              </label>
              <label>
                Per-order allocation
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={simDraftPerOrderAlloc}
                  onChange={(e) => setSimDraftPerOrderAlloc(e.target.value)}
                  placeholder="from remaining budget"
                  data-fx-at-sim-per-order-alloc="true"
                  disabled={busy || simRiskBusy}
                />
              </label>
            </div>
            {(() => {
              const d = (simRiskStatus?.latest ?? null) as null | {
                overallStatus?: string;
                structuralOk?: boolean;
                direction?: "BUY" | "SELL" | null;
                instrument?: string;
                entryPrice?: number | null;
                stopLoss?: number | null;
                takeProfit?: number | null;
                proposedQuantity?: number | null;
                proposedQuantityNote?: string | null;
                riskBudgetStatus?: string;
                accountStatus?: string;
                quantityContractStatus?: string;
                marginStatus?: string;
                quoteFreshnessStatus?: string;
                explanations?: string[];
                reasons?: Array<{ code?: string; message?: string }>;
                simulationOnly?: boolean;
                placesOrders?: boolean;
                acceptsForExecution?: boolean;
                capitalBudgetAnalysis?: {
                  capitalAllocationPercent?: number | null;
                  capitalAllocationBudget?: number | null;
                  reservedActive?: number;
                  remainingBudget?: number | null;
                  perOrderAllocation?: number | null;
                  perOrderLossLimit?: number | null;
                  perOrderLossLimitPass?: boolean | null;
                  status?: string;
                  note?: string;
                };
                rewardRiskAnalysis?: {
                  estimatedStopLossRisk?: number | null;
                  targetReward3R?: number | null;
                  estimatedNetTargetStatus?: string;
                };
              };
              if (!d) {
                return (
                  <p className="fx-auto-trading-hint">
                    Enter SL, TP, and per-order allocation, then Validate draft. Uses latest decision direction when present.
                  </p>
                );
              }
              return (
                <div className="fx-auto-ta-result" data-fx-at-sim-result="true">
                  <div className="fx-auto-binary-dir">
                    <div>
                      <span className="fx-auto-trading-hint">Status</span>
                      <strong data-fx-at-sim-status={d.overallStatus ?? "—"}>
                        {d.overallStatus ?? "—"}
                      </strong>
                    </div>
                    <div>
                      <span className="fx-auto-trading-hint">Direction</span>
                      <strong>{d.direction ?? "—"}</strong>
                    </div>
                    <div>
                      <span className="fx-auto-trading-hint">Structural</span>
                      <strong>{d.structuralOk ? "ok" : "no"}</strong>
                    </div>
                  </div>
                  <dl className="fx-auto-config-grid">
                    <div>
                      <dt>Instrument</dt>
                      <dd>{d.instrument ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Entry / SL / TP</dt>
                      <dd>
                        {d.entryPrice ?? "—"} / {d.stopLoss ?? "—"} / {d.takeProfit ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Proposed qty</dt>
                      <dd data-fx-at-sim-qty="true">
                        {d.proposedQuantity != null ? d.proposedQuantity : "withheld"}
                      </dd>
                    </div>
                    <div>
                      <dt>Risk / account / contract</dt>
                      <dd>
                        {d.riskBudgetStatus ?? "—"} · {d.accountStatus ?? "—"} ·{" "}
                        {d.quantityContractStatus ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Quote / margin</dt>
                      <dd>
                        {d.quoteFreshnessStatus ?? "—"} · {d.marginStatus ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Per-order allocation / 25% limit</dt>
                      <dd data-fx-at-sim-capital="true">
                        {d.capitalBudgetAnalysis?.perOrderAllocation != null
                          ? d.capitalBudgetAnalysis.perOrderAllocation
                          : "Blocked / Unverified"}
                        {" · limit "}
                        {d.capitalBudgetAnalysis?.perOrderLossLimit != null
                          ? d.capitalBudgetAnalysis.perOrderLossLimit
                          : "—"}
                        {" · "}
                        {d.capitalBudgetAnalysis?.perOrderLossLimitPass == null
                          ? (d.capitalBudgetAnalysis?.status ?? "—")
                          : d.capitalBudgetAnalysis.perOrderLossLimitPass
                            ? "loss-limit PASS"
                            : "loss-limit FAIL"}
                      </dd>
                    </div>
                    <div>
                      <dt>Est. SL risk / 3R</dt>
                      <dd>
                        {d.rewardRiskAnalysis?.estimatedStopLossRisk != null
                          ? d.rewardRiskAnalysis.estimatedStopLossRisk
                          : "Unavailable"}
                        {" · 3R "}
                        {d.rewardRiskAnalysis?.targetReward3R != null
                          ? d.rewardRiskAnalysis.targetReward3R
                          : "Unavailable"}
                      </dd>
                    </div>
                    <div>
                      <dt>Execution</dt>
                      <dd data-fx-at-sim-exec="false">
                        simulationOnly={String(d.simulationOnly !== false)} · placesOrders=
                        {String(d.placesOrders === true)} · acceptsForExecution=
                        {String(d.acceptsForExecution === true)}
                      </dd>
                    </div>
                  </dl>
                  {d.proposedQuantityNote ? (
                    <p className="fx-auto-trading-hint">{d.proposedQuantityNote}</p>
                  ) : null}
                  {Array.isArray(d.explanations) && d.explanations.length > 0 ? (
                    <ul className="fx-auto-gates" data-fx-at-sim-reasons="true">
                      {d.explanations.slice(0, 10).map((r, i) => (
                        <li key={`sim-ex-${i}`} data-ok="false">{r}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })()}
          </section>

          <section
            className="fx-auto-trading-panel"
            aria-label="Capital Allocation and Risk Limits"
            data-fx-at-capital="true"
          >
            <div className="fx-auto-trading-panel-head">
              <h2 className="fx-auto-trading-h2">Capital Allocation &amp; Risk Limits</h2>
              <p className="fx-auto-trading-hint">
                Overall strategy budget from verified equity (1–100%). Not margin. Not the amount spent on every order.
                Per-order max estimated SL loss = 25% of that order’s allocation. Saving never enables execution.
              </p>
            </div>
            <div className="fx-auto-token-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "end" }}>
              <label>
                Strategy allocation %
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={100}
                  step={1}
                  value={capitalAllocDraft}
                  onChange={(e) => setCapitalAllocDraft(e.target.value)}
                  placeholder="unset"
                  data-fx-at-capital-pct="true"
                  disabled={busy || !token.trim()}
                />
              </label>
              <button
                type="button"
                className="fx-btn fx-btn--secondary"
                disabled={busy || !token.trim()}
                onClick={() => void saveCapitalAllocationPercent()}
                data-fx-at-capital-save="true"
              >
                Save allocation %
              </button>
            </div>
            <dl className="fx-auto-config-grid" data-fx-at-capital-summary="true">
              <div>
                <dt>Verified equity</dt>
                <dd data-fx-at-capital-equity="true">
                  {status.controls.verifiedEquity != null
                    ? `${fmtNum(status.controls.verifiedEquity, 2)}${status.controls.capitalAllocationCurrency ? ` ${status.controls.capitalAllocationCurrency}` : ""}`
                    : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Strategy capital budget</dt>
                <dd data-fx-at-capital-budget="true">
                  {status.controls.capitalAllocationBudgetStatus === "COMPUTED"
                    && status.controls.capitalAllocationBudget != null
                    ? `${fmtNum(status.controls.capitalAllocationBudget, 2)}${status.controls.capitalAllocationCurrency ? ` ${status.controls.capitalAllocationCurrency}` : ""}`
                    : status.controls.capitalAllocationBudgetStatus === "UNSET"
                      ? "Unset"
                      : "Unavailable / Unverified"}
                </dd>
              </div>
              <div>
                <dt>Selected %</dt>
                <dd>
                  {status.controls.capitalAllocationPercent != null
                    ? `${status.controls.capitalAllocationPercent}%`
                    : "Unset"}
                </dd>
              </div>
              <div>
                <dt>Per-order loss limit rule</dt>
                <dd>25% of that order’s allocation (estimated SL risk)</dd>
              </div>
            </dl>
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
                <dd>disabled (Phase 54)</dd>
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
