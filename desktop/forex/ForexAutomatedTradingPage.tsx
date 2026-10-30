/**
 * Phase 51.1 / 52 / 60.0.14 — Automated Trading UI (isolation + verification).
 * Configuration and read-only verification only — never places broker orders.
 * Admin auth uses the shared Forex Admin Access service.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ForexAdminAccessLink } from "./admin-access/ForexAdminAccessCard";
import { buildForexAdminHeaders } from "./admin-access/forex-admin-token";
import { useForexAdminToken } from "./admin-access/use-forex-admin-token";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import { formatBrokerExecutionBadgeLabel } from "./broker-execution-label";
import type { SelectedMarket } from "./market-data/selected-market";

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

type OperationalStatus = {
  code: string;
  label: string;
  reasonCode: string | null;
  executionStatusLabel: "EXECUTION_FORBIDDEN";
  executionReadiness: "BLOCKED";
  brokerExecution: "DISABLED";
  placesOrders: false;
  acceptsForExecution: false;
};

type PublicStatus = {
  moduleStatus: "INITIALIZING" | "READY" | "BLOCKED" | "ERROR";
  /** Phase 57.4 — monitoring/ops badge (not broker execution). */
  operationalStatus?: OperationalStatus;
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
  quantitySemantics?: {
    summaryStatus?: string;
    quantityUnit?: string;
    quantityUnitValue?: string;
    quantityUnitAmbiguous?: boolean;
    minStopDistance?: string;
    minStopDistanceVerified?: boolean;
    monetaryRiskAllowed?: boolean;
    notes?: string[];
  } | null;
  exposureReconciliation?: {
    authoritative?: boolean;
    status?: string;
    confirmedZeroExposure?: boolean;
    openPositionsCount?: number | null;
    pendingOrdersCount?: number | null;
    note?: string;
    ordersCapability?: string | null;
    tradesCapability?: string | null;
  } | null;
  /** Phase 56.2.7 — simulation draft data-readiness summary. */
  simulationDataReadiness?: {
    overall?: string;
    readyForSimulationDraft?: boolean;
    placesOrders?: false;
    acceptsForExecution?: false;
    notReady?: Array<{ id?: string; status?: string; reason?: string | null }>;
    evaluatedAtUtc?: string;
  } | null;
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

/** Headers for approved Forex AT API paths via the shared admin token service. */
function adminHeaders(_token?: string): HeadersInit {
  return buildForexAdminHeaders("/api/forex/automated-trading/status", {
    includeJsonContentType: true,
  });
}

function operationalTone(code: string | undefined): "live" | "future" | "offline" {
  if (code === "MONITORING_ACTIVE") return "live";
  if (
    code === "MONITORING_OFF"
    || code === "MONITORING_STARTING"
    || code === "MONITORING_STOPPING"
    || code === "INITIALIZING"
  ) {
    return "future";
  }
  return "offline";
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
  const { token, snapshot: adminSnap } = useForexAdminToken();
  const authGenRef = useRef(adminSnap.generation);
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
  /** Phase 56.2.4 — sole manual simulation input: order allocation USD. */
  const [simOrderAlloc, setSimOrderAlloc] = useState("");
  const [capitalAllocDraft, setCapitalAllocDraft] = useState("");
  const [simRiskBusy, setSimRiskBusy] = useState(false);
  /** Phase 56.4.3 — draft history + simulation lifecycle (never broker positions). */
  const [simDraftHistory, setSimDraftHistory] = useState<Array<Record<string, unknown>>>([]);
  const [simLifecycle, setSimLifecycle] = useState<{
    openCount?: number;
    closedCount?: number;
    positions?: Array<Record<string, unknown>>;
    autoReentryEnabled?: false;
    placesOrders?: false;
    acceptsForExecution?: false;
    simulationOnly?: true;
    note?: string;
  } | null>(null);
  const [simLifeBusy, setSimLifeBusy] = useState(false);
  /** Phase 57.1/57.2 — server-authoritative automation START/STOP (monitoring ≠ execution). */
  const [automation, setAutomation] = useState<{
    stateVersion?: number;
    requestedMode?: "ON" | "OFF";
    lifecycle?: string;
    reasonCode?: string;
    reasonMessage?: string | null;
    lastChangedAtUtc?: string;
    automationRequested?: boolean;
    marketMonitoring?: string;
    brokerExecution?: "DISABLED";
    executionReadiness?: "BLOCKED";
    executionStatusLabel?: "EXECUTION_FORBIDDEN";
    recoveryStatus?: string;
    entryGenerationEnabled?: false;
    placesOrders?: false;
    acceptsForExecution?: false;
    note?: string;
  } | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);

  /** Phase 57.0 — broker-intent architecture status (never execution). */
  const [brokerIntent, setBrokerIntent] = useState<{
    phase?: string;
    banner?: string;
    intentCount?: number;
    latest?: {
      intentId?: string;
      state?: string;
      instrument?: string;
      protectiveStatus?: string;
      placesOrders?: false;
      acceptsForExecution?: false;
      executionDisabled?: true;
      rejections?: Array<{ code?: string; message?: string }>;
    } | null;
    capabilities?: { tradingEnabled?: false; placesOrders?: false; mutatesBroker?: false };
    placesOrders?: false;
    acceptsForExecution?: false;
    mutatesBroker?: false;
    executionDisabled?: true;
    note?: string;
  } | null>(null);
  /** Phase 58.1 / 59.0.12F — DEMO lifecycle readiness (not a broker success claim). */
  const [demoLifecycle, setDemoLifecycle] = useState<{
    mayAttemptDemoMutation?: boolean;
    blockers?: string[];
    blockerCategories?: Record<string, string[]>;
    primaryBlocker?: string | null;
    ownerActionChecklist?: string[];
    environment?: string | null;
    connected?: boolean;
    activeGrantCount?: number;
    mutationEnvEnabled?: boolean;
    sidecarMutationEnvEnabled?: boolean;
    nodeMutationEnvEnabled?: boolean;
    nodeMutationSecretConfigured?: boolean;
    sidecarMutationSecretConfigured?: boolean;
    mutationSecretConfigured?: boolean;
    grantCoverage?: {
      ok?: boolean;
      activeGrantCount?: number;
      coveringGrantCount?: number;
      requestedInstrument?: string | null;
      requestedLots?: number | null;
      blockers?: string[];
    } | null;
    liveLocked?: boolean;
    protectiveSurfaceDocumented?: boolean;
    authErrorCode?: string | null;
    phase?: string | null;
  } | null>(null);
  const [demoGrantBusy, setDemoGrantBusy] = useState(false);
  const [demoQuoteProbe, setDemoQuoteProbe] = useState<string | null>(null);
  /** Phase 4.3 — auto-engine status (submit only when armed_execute gates pass). */
  const [autoEngine, setAutoEngine] = useState<{
    mode?: string;
    strategyId?: string;
    instruments?: string[];
    timeframe?: string;
    lots?: number | null;
    continuousEnabled?: boolean;
    submitAuthorized?: boolean;
    workerLockHeld?: boolean;
    lastTickAtUtc?: string | null;
    lastPrepareCode?: string | null;
    lastSubmitCode?: string | null;
    positionReconcileCode?: string | null;
    blockNewEntries?: boolean;
    placesOrders?: false;
    mutatesBroker?: false;
    note?: string;
    dailyRiskAuthoritative?: boolean | null;
    dailyRealizedPnl?: number | null;
    dailyUnrealizedPnl?: number | null;
    accountCurrency?: string | null;
    lastSignalDirection?: string | null;
    lastSignalCode?: string | null;
  } | null>(null);
  const seq = useRef(0);

  const shellInstrument = fcInstrumentFromMarket(props.selectedMarket ?? null);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setBusy(true);
    setError(null);
    try {
      const [stRes, auRes, oaRes, histRes, monRes, decRes, simRes, draftHistRes, lifeRes, biRes, autoRes, demoRes] = await Promise.all([
        fetch("/api/forex/automated-trading/status", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/audit?limit=12", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/openai/status", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/openai/history?limit=6", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/monitor/status", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/decision/status", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/simulation-risk/status", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/simulation-risk/history?limit=8", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/simulation-lifecycle/status", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/broker-intent/status", { headers: adminHeaders(token) }),
        fetch("/api/forex/automated-trading/automation/status", { headers: adminHeaders(token) }),
        fetch(
          `/api/forex/automated-trading/demo-lifecycle/readiness?${new URLSearchParams({
            instrument: shellInstrument
              || "XAU/USD",
            lots: "1",
          }).toString()}`,
          { headers: adminHeaders(token) },
        ),
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
      const draftHistJson = await draftHistRes.json() as {
        ok?: boolean;
        history?: Array<Record<string, unknown>>;
      };
      const lifeJson = await lifeRes.json() as {
        ok?: boolean;
        lifecycle?: typeof simLifecycle;
      };
      const biJson = await biRes.json() as {
        ok?: boolean;
        brokerIntent?: typeof brokerIntent;
      };
      const autoJson = await autoRes.json() as {
        ok?: boolean;
        automation?: typeof automation;
      };
      const demoJson = await demoRes.json() as {
        ok?: boolean;
        phase?: string;
        mayAttemptDemoMutation?: boolean;
        blockers?: string[];
        blockerCategories?: Record<string, unknown>;
        primaryBlocker?: string | null;
        ownerActionChecklist?: string[];
        environment?: string | null;
        connected?: boolean;
        activeGrantCount?: number;
        mutationEnvEnabled?: boolean;
        sidecarMutationEnvEnabled?: boolean;
        nodeMutationEnvEnabled?: boolean;
        nodeMutationSecretConfigured?: boolean;
        sidecarMutationSecretConfigured?: boolean;
        mutationSecretConfigured?: boolean;
        grantCoverage?: Record<string, unknown> | null;
        liveLocked?: boolean;
        protectiveSurfaceDocumented?: boolean;
        error?: { code?: string; message?: string };
      };
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
      if (draftHistRes.ok && draftHistJson.ok && Array.isArray(draftHistJson.history)) {
        setSimDraftHistory(draftHistJson.history);
      }
      if (lifeRes.ok && lifeJson.ok && lifeJson.lifecycle) setSimLifecycle(lifeJson.lifecycle);
      if (biRes.ok && biJson.ok && biJson.brokerIntent) setBrokerIntent(biJson.brokerIntent);
      if (autoRes.ok && autoJson.ok && autoJson.automation) setAutomation(autoJson.automation);
      if (demoRes.ok && demoJson) {
        const cats = demoJson.blockerCategories && typeof demoJson.blockerCategories === "object"
          ? Object.fromEntries(
            Object.entries(demoJson.blockerCategories as Record<string, unknown>).map(([k, v]) => [
              k,
              Array.isArray(v) ? v.map(String) : [],
            ]),
          )
          : undefined;
        const gc = demoJson.grantCoverage && typeof demoJson.grantCoverage === "object"
          ? demoJson.grantCoverage as Record<string, unknown>
          : null;
        setDemoLifecycle({
          mayAttemptDemoMutation: Boolean(demoJson.mayAttemptDemoMutation),
          blockers: Array.isArray(demoJson.blockers) ? demoJson.blockers.map(String) : [],
          blockerCategories: cats,
          primaryBlocker: demoJson.primaryBlocker != null ? String(demoJson.primaryBlocker) : null,
          ownerActionChecklist: Array.isArray(demoJson.ownerActionChecklist)
            ? demoJson.ownerActionChecklist.map(String)
            : [],
          environment: demoJson.environment ?? null,
          connected: Boolean(demoJson.connected),
          activeGrantCount: Number(demoJson.activeGrantCount ?? 0),
          mutationEnvEnabled: Boolean(demoJson.mutationEnvEnabled),
          sidecarMutationEnvEnabled: Boolean(demoJson.sidecarMutationEnvEnabled),
          nodeMutationEnvEnabled: Boolean(demoJson.nodeMutationEnvEnabled),
          nodeMutationSecretConfigured: Boolean(demoJson.nodeMutationSecretConfigured),
          sidecarMutationSecretConfigured: Boolean(demoJson.sidecarMutationSecretConfigured),
          mutationSecretConfigured: Boolean(demoJson.mutationSecretConfigured),
          grantCoverage: gc
            ? {
              ok: Boolean(gc.ok),
              activeGrantCount: Number(gc.activeGrantCount ?? 0),
              coveringGrantCount: Number(gc.coveringGrantCount ?? 0),
              requestedInstrument: gc.requestedInstrument == null ? null : String(gc.requestedInstrument),
              requestedLots: gc.requestedLots == null ? null : Number(gc.requestedLots),
              blockers: Array.isArray(gc.blockers) ? gc.blockers.map(String) : [],
            }
            : null,
          liveLocked: demoJson.liveLocked !== false,
          protectiveSurfaceDocumented: demoJson.protectiveSurfaceDocumented !== false,
          authErrorCode: null,
          phase: demoJson.phase != null ? String(demoJson.phase) : null,
        });
      } else if (demoRes.status === 403) {
        setDemoLifecycle({
          mayAttemptDemoMutation: false,
          blockers: ["ADMIN_AUTHORIZATION_REQUIRED"],
          ownerActionChecklist: [
            "Configure Admin API token under Forex → Admin Access.",
            "Token must match KWIZERA_ADMIN_API_TOKEN on the server — never commit or log it.",
          ],
          authErrorCode: demoJson?.error?.code ?? "ADMIN_FORBIDDEN",
          liveLocked: true,
        });
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

  useEffect(() => {
    if (authGenRef.current === adminSnap.generation) return;
    authGenRef.current = adminSnap.generation;
    setStatus(null);
    setAudit([]);
    setError(null);
    void load();
  }, [adminSnap.generation, load]);

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
      // Phase 56.2.8 — project TF ids only (`1m`), never ForexConnect period aliases (`m1`).
      timeframe: props.timeframe || monitorTf || "1m",
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
    const rawAlloc = simOrderAlloc.trim();
    if (!rawAlloc) {
      setError("Order Allocation (USD) is required.");
      return;
    }
    const allocN = Number(rawAlloc);
    if (!Number.isFinite(allocN) || allocN <= 0) {
      setError("Order Allocation must be a finite amount greater than zero.");
      return;
    }
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
      // Simplified workflow: only order allocation is user-supplied.
      // Entry / SL / TP / quantity are derived server-side from quote + analysis levels.
      const res = await fetch("/api/forex/automated-trading/simulation-risk/validate", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify({
          expectedEnvironmentEpoch: status.environmentEpoch,
          decisionId: latestDecision?.decisionId,
          instrument,
          direction: latestDecision?.direction ?? undefined,
          requestedPerOrderAllocation: allocN,
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

  /** Reopen a saved draft and revalidate against current LIVE quote/budget (never opens a position). */
  const reopenSimDraft = async (draftId?: string | null) => {
    if (!status || simRiskBusy) return;
    setSimRiskBusy(true);
    setError(null);
    try {
      const rawAlloc = simOrderAlloc.trim();
      const allocN = rawAlloc ? Number(rawAlloc) : NaN;
      const res = await fetch("/api/forex/automated-trading/simulation-risk/reopen", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify({
          draftId: draftId || undefined,
          expectedEnvironmentEpoch: status.environmentEpoch,
          requestedPerOrderAllocation:
            Number.isFinite(allocN) && allocN > 0 ? allocN : undefined,
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
        const alloc = (data.draft as { capitalBudgetAnalysis?: { perOrderAllocation?: number | null } })
          .capitalBudgetAnalysis?.perOrderAllocation;
        if (alloc != null && Number.isFinite(alloc)) setSimOrderAlloc(String(alloc));
      }
      if (!res.ok || !data.ok) {
        setError(data.error?.message || data.error?.code || `Reopen draft failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reopen draft failed");
    } finally {
      setSimRiskBusy(false);
    }
  };

  const openSimulatedPositionUi = async () => {
    if (!status || simLifeBusy) return;
    setSimLifeBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/forex/automated-trading/simulation-lifecycle/open", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify({}),
      });
      const data = await res.json() as {
        ok?: boolean;
        position?: Record<string, unknown>;
        status?: PublicStatus;
        error?: { message?: string; code?: string };
      };
      if (data.status) setStatus(data.status);
      if (!res.ok || !data.ok) {
        setError(data.error?.message || data.error?.code || `Simulated open failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulated open failed");
    } finally {
      setSimLifeBusy(false);
    }
  };

  const monitorSimulatedPositionUi = async (positionId: string) => {
    if (!positionId || simLifeBusy) return;
    setSimLifeBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/forex/automated-trading/simulation-lifecycle/monitor", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify({ positionId }),
      });
      const data = await res.json() as {
        ok?: boolean;
        status?: PublicStatus;
        error?: { message?: string; code?: string };
      };
      if (data.status) setStatus(data.status);
      if (!res.ok || !data.ok) {
        setError(data.error?.message || data.error?.code || `Simulated monitor failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulated monitor failed");
    } finally {
      setSimLifeBusy(false);
    }
  };

  const closeSimulatedPositionUi = async (positionId: string) => {
    if (!positionId || simLifeBusy) return;
    setSimLifeBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/forex/automated-trading/simulation-lifecycle/close", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify({ positionId }),
      });
      const data = await res.json() as {
        ok?: boolean;
        status?: PublicStatus;
        error?: { message?: string; code?: string };
      };
      if (data.status) setStatus(data.status);
      if (!res.ok || !data.ok) {
        setError(data.error?.message || data.error?.code || `Simulated close failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulated close failed");
    } finally {
      setSimLifeBusy(false);
    }
  };

  /** Phase 57.1 — START AUTO (server-authoritative; never broker execution). */
  const startAutomationUi = async () => {
    if (autoBusy) return;
    const ok = window.confirm(
      "START AUTO will request server-side market monitoring and analysis.\n\nBroker order execution remains DISABLED.\nMaster Trading stays OFF. Emergency Entry Lock stays ON.\n\nContinue?",
    );
    if (!ok) return;
    setAutoBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/forex/automated-trading/automation/start", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify({
          expectedStateVersion: automation?.stateVersion,
          timeframe: monitorTf,
        }),
      });
      const data = await res.json() as {
        ok?: boolean;
        message?: string;
        code?: string;
        automation?: typeof automation;
        status?: PublicStatus;
        monitor?: typeof monitor;
        error?: { message?: string; code?: string };
      };
      if (data.automation) setAutomation(data.automation);
      if (data.status) setStatus(data.status);
      if (data.monitor) setMonitor(data.monitor);
      if (!res.ok || !data.ok) {
        setError(data.message || data.error?.message || data.code || `START AUTO failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "START AUTO failed");
    } finally {
      setAutoBusy(false);
    }
  };

  const stopAutomationUi = async () => {
    if (autoBusy) return;
    setAutoBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/forex/automated-trading/automation/stop", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify({ expectedStateVersion: automation?.stateVersion }),
      });
      const data = await res.json() as {
        ok?: boolean;
        message?: string;
        automation?: typeof automation;
        status?: PublicStatus;
        monitor?: typeof monitor;
        error?: { message?: string };
      };
      if (data.automation) setAutomation(data.automation);
      if (data.status) setStatus(data.status);
      if (data.monitor) setMonitor(data.monitor);
      if (!res.ok || !data.ok) {
        setError(data.message || data.error?.message || `STOP AUTO failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "STOP AUTO failed");
    } finally {
      setAutoBusy(false);
    }
  };

  /** Phase 56.4.6 — Admin controlled sim inject (never broker). */
  const controlledSimInjectUi = async (
    positionId: string,
    mode: "sl_cross" | "sl_approach" | "stale",
  ) => {
    if (!positionId || simLifeBusy) return;
    setSimLifeBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/forex/automated-trading/simulation-lifecycle/controlled-inject", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify({ positionId, mode }),
      });
      const data = await res.json() as {
        ok?: boolean;
        status?: PublicStatus;
        error?: { message?: string; code?: string };
      };
      if (data.status) setStatus(data.status);
      if (!res.ok || !data.ok) {
        setError(data.error?.message || data.error?.code || `Controlled inject failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Controlled inject failed");
    } finally {
      setSimLifeBusy(false);
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
  const authState = token ? "Token configured (this browser)" : "Not authorized";
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
            {status?.operationalStatus ? (
              <span data-fx-at-operational-badge="true" title={`Execution: ${status.operationalStatus.executionStatusLabel}`}>
                <ForexStatusBadge tone={operationalTone(status.operationalStatus.code)}>
                  {status.operationalStatus.label}
                </ForexStatusBadge>
              </span>
            ) : status ? (
              <span
                data-fx-at-execution-module-badge="true"
                title={`Technical: moduleStatus=${status.moduleStatus}; execution remains EXECUTION_FORBIDDEN`}
              >
                <ForexStatusBadge tone="offline">
                  {formatBrokerExecutionBadgeLabel("EXECUTION_FORBIDDEN")}
                </ForexStatusBadge>
              </span>
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

      <section
        className="fx-auto-trading-panel"
        data-fx-at-automation-control="true"
        aria-label="Automated trading master START STOP control"
      >
        <h2 className="fx-auto-trading-panel-title">Automation control</h2>
        <div className="fx-auto-trading-token-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
          <button
            type="button"
            className="fx-capture-button"
            data-fx-at-automation-start="true"
            disabled={busy || autoBusy || !token}
            onClick={() => void startAutomationUi()}
            aria-label="Start auto market monitoring"
          >
            {autoBusy ? "Working…" : "START AUTO"}
          </button>
          <button
            type="button"
            className="fx-btn fx-btn--ghost"
            data-fx-at-automation-stop="true"
            disabled={busy || autoBusy || !token}
            onClick={() => void stopAutomationUi()}
            aria-label="Stop auto market monitoring"
          >
            STOP AUTO
          </button>
          <span data-fx-at-monitoring-lifecycle="true">
            <ForexStatusBadge
              tone={
                automation?.lifecycle === "MONITORING"
                  ? "live"
                  : automation?.lifecycle === "BLOCKED" || automation?.lifecycle === "ERROR"
                    ? "offline"
                    : "future"
              }
            >
              {`Monitoring: ${automation?.lifecycle ?? "OFF"}`}
            </ForexStatusBadge>
          </span>
          <span
            data-fx-at-execution-status="true"
            title={`Technical code: ${automation?.executionStatusLabel ?? status?.operationalStatus?.executionStatusLabel ?? "EXECUTION_FORBIDDEN"}`}
          >
            <ForexStatusBadge tone="offline">
              {formatBrokerExecutionBadgeLabel(
                automation?.executionStatusLabel
                  ?? status?.operationalStatus?.executionStatusLabel
                  ?? "EXECUTION_FORBIDDEN",
              )}
            </ForexStatusBadge>
          </span>
        </div>
        <ul className="fx-auto-trading-hint" style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem" }}>
          <li>
            Requested: <strong>{automation?.requestedMode ?? "OFF"}</strong>
            {" · "}
            Monitoring lifecycle: <strong>{automation?.lifecycle ?? "OFF"}</strong>
            {" · "}
            v{automation?.stateVersion ?? "—"}
          </li>
          <li>
            Market monitoring: <strong>{automation?.marketMonitoring ?? "INACTIVE"}</strong>
            {" · "}
            Recovery: <strong data-fx-at-recovery-status="true">{automation?.recoveryStatus ?? "IDLE"}</strong>
          </li>
          <li data-fx-at-execution-detail="true">
            Broker execution: <strong>{automation?.brokerExecution ?? "DISABLED"}</strong>
            {" · "}
            Code: <strong data-fx-at-execution-code="true">{automation?.executionStatusLabel ?? "EXECUTION_FORBIDDEN"}</strong>
            {" · "}
            Execution readiness: <strong>{automation?.executionReadiness ?? "BLOCKED"}</strong>
          </li>
          <li>
            Entry generation: OFF · placesOrders={String(automation?.placesOrders ?? false)} ·
            acceptsForExecution={String(automation?.acceptsForExecution ?? false)}
          </li>
          {automation?.reasonCode && automation.reasonCode !== "NONE" ? (
            <li data-fx-at-automation-reason-code="true">
              Reason code: <strong>{automation.reasonCode}</strong>
            </li>
          ) : null}
          {automation?.reasonMessage ? (
            <li data-fx-at-automation-reason="true">{automation.reasonMessage}</li>
          ) : null}
          <li data-fx-at-market-data-status="true">
            Market data:{" "}
            <strong>
              {status?.quoteFreshness?.fresh === true
                ? "LIVE"
                : status?.quoteFreshness?.fresh === false
                  ? `NOT_FRESH (${status.quoteFreshness.reasonCode})`
                  : "UNKNOWN"}
            </strong>
            {monitor?.health?.feedStatus ? ` · feed ${monitor.health.feedStatus}` : ""}
            {status?.quoteFreshness?.evaluatedAtUtc
              ? ` · evaluated ${status.quoteFreshness.evaluatedAtUtc}`
              : ""}
          </li>
          <li>
            Monitor worker: {monitor?.health?.workerState ?? "—"}
            {monitor?.health?.workerActive ? " (active)" : ""}
            {monitor?.health?.freshnessReasonCode
              ? ` · health ${monitor.health.freshnessReasonCode}`
              : ""}
            {monitor?.health?.lastQuoteChangeAtUtc
              ? ` · last quote change ${monitor.health.lastQuoteChangeAtUtc}`
              : ""}
          </li>
          <li>
            Emergency lock: {status?.controls.emergencyEntryLock ? "ON" : "OFF"} · Master enable:{" "}
            {status?.controls.masterEnable ? "ON" : "OFF"} (must stay OFF for broker safety)
          </li>
        </ul>
      </section>

      <section
        className="fx-auto-trading-panel"
        data-fx-at-broker-intent="true"
        aria-label="Broker intent architecture status"
      >
        <h2 className="fx-auto-trading-panel-title">Broker intent (Phase 57.0)</h2>
        <p className="fx-auto-trading-hint" data-fx-at-broker-intent-banner="true">
          {brokerIntent?.banner
            ?? "BROKER INTENT ARCHITECTURE ONLY — EXECUTION REMAINS FORBIDDEN"}
        </p>
        <ul className="fx-auto-trading-hint" style={{ margin: "0.35rem 0 0", paddingLeft: "1.1rem" }}>
          <li>Simulation ≠ DEMO broker execution ≠ LIVE</li>
          <li>
            placesOrders={String(brokerIntent?.placesOrders ?? false)} · acceptsForExecution=
            {String(brokerIntent?.acceptsForExecution ?? false)} · mutatesBroker=
            {String(brokerIntent?.mutatesBroker ?? false)} · executionDisabled=
            {String(brokerIntent?.executionDisabled ?? true)}
          </li>
          <li>
            Intents: {brokerIntent?.intentCount ?? 0}
            {brokerIntent?.latest?.state
              ? ` · latest state=${brokerIntent.latest.state} · protection=${brokerIntent.latest.protectiveStatus ?? "UNVERIFIED"}`
              : " · no prepared intent"}
          </li>
          <li>No one-click execution. Authorization required for any future DEMO phase.</li>
        </ul>
      </section>

      <section
        className="fx-auto-trading-panel"
        data-fx-at-auto-engine="true"
        aria-label="Automated DEMO engine dry-run status"
      >
        <h2 className="fx-auto-trading-panel-title">Auto-engine (Phase 4.3)</h2>
        <p className="fx-auto-trading-hint">
          {autoEngine?.note
            ?? "Signal → risk prepare loop. DEMO submit only when armed_execute gates pass. LIVE locked."}
        </p>
        <ul className="fx-auto-trading-hint" style={{ margin: "0.35rem 0 0", paddingLeft: "1.1rem" }}>
          <li>
            Mode: {autoEngine?.mode ?? "—"} · strategy={autoEngine?.strategyId ?? "—"} · tf=
            {autoEngine?.timeframe ?? "—"} · lots={autoEngine?.lots ?? "—"}
          </li>
          <li>
            Instruments: {(autoEngine?.instruments ?? []).join(", ") || "—"} · blockNewEntries=
            {String(autoEngine?.blockNewEntries ?? true)} · reconcile=
            {autoEngine?.positionReconcileCode ?? "—"}
          </li>
          <li>
            Continuous={String(autoEngine?.continuousEnabled ?? false)} · lockHeld=
            {String(autoEngine?.workerLockHeld ?? false)} · submitAuthorized=
            {String(autoEngine?.submitAuthorized ?? false)}
          </li>
          <li>
            Last signal: {autoEngine?.lastSignalDirection ?? "—"}
            {autoEngine?.lastSignalCode ? ` (${autoEngine.lastSignalCode})` : ""} · prepare=
            {autoEngine?.lastPrepareCode ?? "—"} · submit={autoEngine?.lastSubmitCode ?? "—"}
          </li>
          <li>
            Daily risk authoritative: {String(autoEngine?.dailyRiskAuthoritative ?? false)}
            {autoEngine?.accountCurrency ? ` · ccy=${autoEngine.accountCurrency}` : ""}
            {autoEngine?.dailyRealizedPnl != null
              ? ` · day realized=${autoEngine.dailyRealizedPnl}`
              : ""}
            {autoEngine?.dailyUnrealizedPnl != null
              ? ` · unrealized=${autoEngine.dailyUnrealizedPnl}`
              : ""}
          </li>
          <li>
            placesOrders={String(autoEngine?.placesOrders ?? false)} · mutatesBroker=
            {String(autoEngine?.mutatesBroker ?? false)} · lastTick=
            {autoEngine?.lastTickAtUtc ?? "—"}
          </li>
        </ul>
        <button
          type="button"
          className="fx-auto-trading-btn"
          data-fx-at-auto-engine-refresh="true"
          disabled={busy || !token}
          onClick={() => {
            void (async () => {
              try {
                const res = await fetch("/api/forex/automated-trading/auto-engine/status", {
                  headers: adminHeaders(token),
                });
                const json = await res.json() as {
                  ok?: boolean;
                  engine?: Record<string, unknown>;
                  dailyRisk?: Record<string, unknown> | null;
                };
                if (!res.ok || !json.ok) return;
                const eng = json.engine ?? {};
                const daily = (eng.dailyRisk as Record<string, unknown> | null | undefined)
                  ?? json.dailyRisk
                  ?? null;
                const lastSignal = eng.lastSignal as Record<string, unknown> | null | undefined;
                setAutoEngine({
                  mode: eng.mode == null ? undefined : String(eng.mode),
                  strategyId: eng.strategyId == null ? undefined : String(eng.strategyId),
                  instruments: Array.isArray(eng.instruments) ? eng.instruments.map(String) : [],
                  timeframe: eng.timeframe == null ? undefined : String(eng.timeframe),
                  lots: Number.isFinite(Number(eng.lots)) ? Number(eng.lots) : null,
                  continuousEnabled: eng.continuousEnabled === true,
                  submitAuthorized: eng.submitAuthorized === true,
                  workerLockHeld: eng.workerLockHeld === true,
                  lastTickAtUtc: eng.lastTickAtUtc == null ? null : String(eng.lastTickAtUtc),
                  lastPrepareCode: eng.lastPrepareCode == null ? null : String(eng.lastPrepareCode),
                  lastSubmitCode: eng.lastSubmitCode == null ? null : String(eng.lastSubmitCode),
                  positionReconcileCode: eng.positionReconcileCode == null
                    ? null
                    : String(eng.positionReconcileCode),
                  blockNewEntries: eng.blockNewEntries !== false,
                  placesOrders: false,
                  mutatesBroker: false,
                  note: eng.note == null ? undefined : String(eng.note),
                  dailyRiskAuthoritative: daily ? Boolean(daily.authoritative) : null,
                  dailyRealizedPnl: daily && Number.isFinite(Number(daily.realizedPnlAccount))
                    ? Number(daily.realizedPnlAccount)
                    : null,
                  dailyUnrealizedPnl: daily && Number.isFinite(Number(daily.unrealizedPnlAccount))
                    ? Number(daily.unrealizedPnlAccount)
                    : null,
                  accountCurrency: daily?.accountCurrency == null
                    ? null
                    : String(daily.accountCurrency),
                  lastSignalDirection: lastSignal?.direction == null
                    ? null
                    : String(lastSignal.direction),
                  lastSignalCode: lastSignal?.code == null ? null : String(lastSignal.code),
                });
              } catch {
                /* keep prior */
              }
            })();
          }}
        >
          Refresh auto-engine status
        </button>
      </section>

      <section
        className="fx-auto-trading-panel"
        data-fx-at-demo-lifecycle="true"
        aria-label="DEMO execution certification readiness"
      >
        <h2 className="fx-auto-trading-panel-title">
          DEMO lifecycle readiness ({demoLifecycle?.phase ?? "Phase 59.0.12F"})
        </h2>
        <p className="fx-auto-trading-hint">
          Grant-scoped DEMO path: open/protect/cancel/partial-close. LIVE locked. placesOrders remains false.
          Readiness is not broker success. Mutation stays fail-closed until owner config + grant.
          Secret values are never shown — presence booleans only; Node/sidecar equality is verified at mutation time.
        </p>
        <ul className="fx-auto-trading-hint" style={{ margin: "0.35rem 0 0", paddingLeft: "1.1rem" }}>
          <li>
            May attempt DEMO mutation:{" "}
            {demoLifecycle?.mayAttemptDemoMutation ? "YES (all gates)" : "NO"}
            {demoLifecycle?.authErrorCode ? ` · auth=${demoLifecycle.authErrorCode}` : ""}
          </li>
          <li>
            Primary blocker:{" "}
            {demoLifecycle?.primaryBlocker
              || (demoLifecycle?.mayAttemptDemoMutation ? "(none)" : "(not reported)")}
          </li>
          <li>
            Session: {demoLifecycle?.connected ? "CONNECTED" : "not connected"} · env=
            {demoLifecycle?.environment ?? "unknown"} · LIVE locked=
            {String(demoLifecycle?.liveLocked ?? true)}
          </li>
          <li>
            Mutation flags: node=
            {demoLifecycle?.nodeMutationEnvEnabled ? "ON" : "OFF"} · sidecar=
            {demoLifecycle?.sidecarMutationEnvEnabled ? "ON" : "OFF"} · combined=
            {demoLifecycle?.mutationEnvEnabled ? "ON" : "OFF"}
          </li>
          <li>
            Mutation secrets configured: node=
            {demoLifecycle?.nodeMutationSecretConfigured ? "YES" : "NO"} · sidecar=
            {demoLifecycle?.sidecarMutationSecretConfigured ? "YES" : "NO"} · both=
            {demoLifecycle?.mutationSecretConfigured ? "YES" : "NO"}
            {" "}(presence only — equality checked on submit, never displayed)
          </li>
          <li>
            Grant coverage: active=
            {demoLifecycle?.grantCoverage?.activeGrantCount
              ?? demoLifecycle?.activeGrantCount
              ?? 0}
            {" · covering="}
            {demoLifecycle?.grantCoverage?.coveringGrantCount ?? 0}
            {" · scope="}
            {demoLifecycle?.grantCoverage?.requestedInstrument ?? "—"}
            {demoLifecycle?.grantCoverage?.requestedLots != null
              ? ` @ ${demoLifecycle.grantCoverage.requestedLots} lot(s)`
              : ""}
            {" · ok="}
            {String(demoLifecycle?.grantCoverage?.ok ?? false)}
            {(demoLifecycle?.grantCoverage?.blockers && demoLifecycle.grantCoverage.blockers.length)
              ? ` · grant blockers=${demoLifecycle.grantCoverage.blockers.join(",")}`
              : ""}
          </li>
          <li>
            Protective surface:{" "}
            {demoLifecycle?.protectiveSurfaceDocumented === false
              ? "UNVERIFIED"
              : "RATE_STOP/RATE_LIMIT + STOP/LIMIT+TRADE_ID · cancel/partial documented"}
          </li>
          <li>
            Blockers:{" "}
            {(demoLifecycle?.blockers && demoLifecycle.blockers.length)
              ? demoLifecycle.blockers.join(", ")
              : "(none reported)"}
          </li>
          {demoLifecycle?.blockerCategories
            ? (
              <li>
                Categories:{" "}
                {(["OWNER_CONFIG", "GRANT_AUTHORIZATION", "SESSION", "MARKET", "SDK", "UNKNOWN"] as const)
                  .map((k) => {
                    const list = demoLifecycle.blockerCategories?.[k] ?? [];
                    return list.length ? `${k}=[${list.join(",")}]` : null;
                  })
                  .filter(Boolean)
                  .join(" · ") || "(empty)"}
              </li>
            )
            : null}
          {(demoLifecycle?.ownerActionChecklist && demoLifecycle.ownerActionChecklist.length > 0) ? (
            <li>
              Owner actions: {demoLifecycle.ownerActionChecklist.join(" | ")}
            </li>
          ) : null}
        </ul>
        <div className="fx-auto-trading-hint" style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          <button
            type="button"
            className="fx-auto-trading-btn"
            disabled={!token || demoGrantBusy}
            onClick={() => {
              void (async () => {
                if (!token) return;
                setDemoGrantBusy(true);
                try {
                  // Prefer AT-selected / verified instrument — never default to an unrelated pair.
                  const instrument =
                    shellInstrument
                    || status?.selectedEnvState?.selectedInstrument
                    || "XAU/USD";
                  const res = await fetch("/api/forex/automated-trading/demo-lifecycle/grant", {
                    method: "POST",
                    headers: adminHeaders(token),
                    body: JSON.stringify({
                      ttlMs: 15 * 60_000,
                      maxLots: 1,
                      instrumentAllowlist: [instrument],
                    }),
                  });
                  const json = await res.json() as { ok?: boolean; error?: { message?: string }; grant?: { grantId?: string } };
                  setDemoQuoteProbe(
                    res.ok && json.ok
                      ? `Grant created ${json.grant?.grantId ?? ""} (does not enable mutation).`
                      : `Grant failed: ${json.error?.message || res.status}`,
                  );
                  await load();
                } catch (err) {
                  setDemoQuoteProbe(err instanceof Error ? err.message : "Grant failed");
                } finally {
                  setDemoGrantBusy(false);
                }
              })();
            }}
          >
            Create short DEMO grant
          </button>
          <button
            type="button"
            className="fx-auto-trading-btn"
            disabled={!token || demoGrantBusy}
            onClick={() => {
              void (async () => {
                if (!token) return;
                setDemoGrantBusy(true);
                try {
                  const instrument =
                    shellInstrument
                    || status?.selectedEnvState?.selectedInstrument
                    || "XAU/USD";
                  const res = await fetch("/api/forex/automated-trading/demo-lifecycle/quote-probe", {
                    method: "POST",
                    headers: adminHeaders(token),
                    body: JSON.stringify({ instrument }),
                  });
                  const json = await res.json() as {
                    ok?: boolean;
                    quote?: { bid?: number; ask?: number; quotePresent?: boolean };
                    error?: { message?: string };
                  };
                  setDemoQuoteProbe(
                    res.ok && json.ok
                      ? `Quote ${instrument}: bid=${json.quote?.bid ?? "?"} ask=${json.quote?.ask ?? "?"} present=${String(json.quote?.quotePresent)}`
                      : `Quote probe failed: ${json.error?.message || res.status}`,
                  );
                } catch (err) {
                  setDemoQuoteProbe(err instanceof Error ? err.message : "Quote probe failed");
                } finally {
                  setDemoGrantBusy(false);
                }
              })();
            }}
          >
            Probe offer quote
          </button>
        </div>
        {demoQuoteProbe ? (
          <p className="fx-auto-trading-hint" style={{ marginTop: "0.35rem" }}>{demoQuoteProbe}</p>
        ) : null}
      </section>

      <div className="fx-auto-trading-auth" data-fx-at-admin-auth="true" data-fx-at-auth-state={token ? "ready" : "missing"}>
        <p className="fx-auto-trading-hint" style={{ marginBottom: "0.35rem" }}>
          Admin authorization: <strong>{authState}</strong>
        </p>
        <ForexAdminAccessLink
          reason={
            token
              ? "Token managed centrally. Open Admin Access to update or clear."
              : "Admin API token required for protected Automated Trading reads."
          }
        />
      </div>

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
            className="fx-auto-trading-panel fx-auto-sim-draft"
            aria-label="Simulation draft validation"
            data-fx-at-sim-risk="true"
          >
            <div className="fx-auto-trading-panel-head fx-auto-sim-actions">
              <h2 className="fx-auto-trading-h2">Simulation draft</h2>
              <div className="fx-auto-sim-action-btns">
                <button
                  type="button"
                  className="fx-btn fx-btn--secondary"
                  disabled={busy || simRiskBusy || !status || !simOrderAlloc.trim()}
                  onClick={() => void validateSimDraft()}
                  data-fx-at-sim-validate="true"
                >
                  {simRiskBusy ? "Validating…" : "Validate draft"}
                </button>
                <button
                  type="button"
                  className="fx-btn fx-btn--ghost"
                  disabled={busy || simRiskBusy || !status || !simRiskStatus?.latest}
                  onClick={() => void reopenSimDraft(
                    String((simRiskStatus?.latest as { draftId?: string } | null)?.draftId ?? "") || null,
                  )}
                  data-fx-at-sim-reopen="true"
                  title="Revalidate saved draft against current LIVE quote and budget"
                >
                  Reopen &amp; revalidate
                </button>
                <button
                  type="button"
                  className="fx-btn fx-btn--secondary"
                  disabled={
                    busy
                    || simLifeBusy
                    || !status
                    || (simRiskStatus?.latest as { overallStatus?: string } | null)?.overallStatus
                      !== "VALIDATION_PASSED"
                  }
                  onClick={() => void openSimulatedPositionUi()}
                  data-fx-at-sim-open="true"
                  title="Open a simulated position from VALIDATION_PASSED draft — never a broker order"
                >
                  {simLifeBusy ? "Working…" : "Open simulated position"}
                </button>
              </div>
            </div>
            <p className="fx-auto-trading-hint" data-fx-at-sim-banner="true">
              Simulation-only. Enter Order Allocation only — Entry, SL, TP (3R), and quantity are derived from
              verified quote and analysis levels when available. Never places orders. Max estimated SL loss = 25% of this order’s allocation.
            </p>
            <div className="fx-auto-sim-alloc-row">
              <label className="fx-auto-sim-alloc-label" htmlFor="fx-at-sim-order-alloc">
                Order Allocation (USD)
              </label>
              <input
                id="fx-at-sim-order-alloc"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={simOrderAlloc}
                onChange={(e) => setSimOrderAlloc(e.target.value)}
                placeholder="e.g. 100"
                data-fx-at-sim-order-alloc="true"
                data-fx-at-sim-per-order-alloc="true"
                disabled={busy || simRiskBusy}
                className="fx-auto-sim-alloc-input"
              />
              <p className="fx-auto-trading-hint fx-auto-sim-alloc-hint">
                Capital assigned to this proposed order (not broker margin). Strategy % is set separately below.
              </p>
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
                simulationOnly?: boolean;
                placesOrders?: boolean;
                acceptsForExecution?: boolean;
                capitalBudgetAnalysis?: {
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
                  estimatedRequiredMargin?: number | null;
                  estimatedRequiredMarginStatus?: string;
                };
              };
              const latestDecision = decisionStatus?.latest as {
                direction?: "BUY" | "SELL" | null;
              } | null;
              const qtyUnit =
                status?.quantitySemantics?.quantityUnitValue
                ?? status?.quantitySemantics?.quantityUnit
                ?? null;
              const cell = (
                label: string,
                value: ReactNode,
                opts?: { testId?: string; blocked?: boolean },
              ) => (
                <div className="fx-auto-sim-cell" key={label}>
                  <span className="fx-auto-sim-cell-label">{label}</span>
                  <span
                    className={`fx-auto-sim-cell-value${opts?.blocked ? " is-blocked" : ""}`}
                    data-fx-at-sim-cell={opts?.testId ?? label}
                  >
                    {value}
                  </span>
                </div>
              );
              const unavailable = (reason?: string) => (
                <span className="fx-auto-sim-unavailable">
                  {reason ? `Unavailable — ${reason}` : "Unavailable"}
                </span>
              );
              const money = (n: number | null | undefined) =>
                n != null && Number.isFinite(n) ? fmtNum(n, 2) : null;

              if (!d) {
                return (
                  <div className="fx-auto-sim-derived" data-fx-at-sim-result="empty">
                    <dl className="fx-auto-sim-grid">
                      {cell(
                        "Direction",
                        latestDecision?.direction
                          ?? unavailable("no analysis/decision"),
                      )}
                      {cell("Entry", unavailable("validate to derive"))}
                      {cell("Stop Loss", unavailable("needs analysis support/resistance"))}
                      {cell("Take Profit (3R)", unavailable("needs verified SL distance"))}
                      {cell(
                        "Order Allocation",
                        simOrderAlloc.trim() ? `${simOrderAlloc.trim()} USD` : unavailable("enter amount"),
                        { testId: "order-alloc" },
                      )}
                      {cell("Proposed Quantity", unavailable("needs units + SL"))}
                      {cell("Required Margin", unavailable("needs quantity"))}
                      {cell(
                        "Free Margin",
                        status?.verification?.account?.usableMargin != null
                          ? fmtNum(status.verification.account.usableMargin, 2)
                          : unavailable("account"),
                      )}
                      {cell("Estimated SL Loss", unavailable("needs quantity"))}
                      {cell(
                        "Max Allowed SL Loss",
                        (() => {
                          const n = Number(simOrderAlloc);
                          return Number.isFinite(n) && n > 0
                            ? `${fmtNum(n * 0.25, 2)} (25% of allocation)`
                            : unavailable("enter allocation");
                        })(),
                      )}
                      {cell(
                        "Remaining Strategy Budget",
                        status?.controls.capitalAllocationBudgetStatus === "COMPUTED"
                          && status.controls.capitalAllocationBudget != null
                          ? fmtNum(status.controls.capitalAllocationBudget, 2)
                          : unavailable("strategy % / equity"),
                      )}
                      {cell(
                        "Validation Status",
                        "Not validated yet",
                        { testId: "status" },
                      )}
                      {cell(
                        "Quote Freshness",
                        status?.quoteFreshness?.reasonCode
                          ?? monitor?.health?.freshnessReasonCode
                          ?? unavailable("no quote"),
                      )}
                      {cell(
                        "Min-Stop / CondDist",
                        status?.quantitySemantics?.minStopDistanceVerified
                          ? "Account-attested (validate for detail)"
                          : unavailable("CondDist / Enhanced Execution"),
                      )}
                      {cell(
                        "Currency Conversion",
                        status?.verification?.account?.accountCurrency
                          ? (String(status.verification.account.accountCurrency).toUpperCase() === "USD"
                            ? "USD account — identity (no FX rate)"
                            : unavailable("non-USD rate required"))
                          : unavailable("account currency"),
                      )}
                      {cell(
                        "Data Readiness",
                        status?.simulationDataReadiness?.overall
                          ? `${status.simulationDataReadiness.overall}`
                            + (status.simulationDataReadiness.readyForSimulationDraft
                              ? " — draft sizing gates OK (execution still forbidden)"
                              : ` — ${(status.simulationDataReadiness.notReady?.length ?? 0)} gate(s) not READY`)
                          : unavailable("status"),
                        { testId: "data-readiness" },
                      )}
                    </dl>
                    <p className="fx-auto-trading-hint">
                      Enter Order Allocation and Validate draft. Entry/SL/TP are not typed manually in this workflow.
                    </p>
                  </div>
                );
              }

              const blocked =
                d.overallStatus === "BLOCKED"
                || d.overallStatus === "REJECTED_LOCAL"
                || d.overallStatus === "FAILED";
              return (
                <div className="fx-auto-sim-derived" data-fx-at-sim-result="true">
                  <dl className="fx-auto-sim-grid">
                    {cell(
                      "Validation Status",
                      <strong data-fx-at-sim-status={d.overallStatus ?? "—"}>
                        {d.overallStatus ?? "—"}
                      </strong>,
                      { testId: "status", blocked },
                    )}
                    {cell("Direction", d.direction ?? unavailable("missing"))}
                    {cell(
                      "Entry",
                      d.entryPrice != null ? String(d.entryPrice) : unavailable("not derived"),
                      { testId: "entry" },
                    )}
                    {cell(
                      "Stop Loss",
                      d.stopLoss != null ? String(d.stopLoss) : unavailable("not derived"),
                      { testId: "sl" },
                    )}
                    {cell(
                      "Take Profit (3R)",
                      d.takeProfit != null ? String(d.takeProfit) : unavailable("not derived"),
                      { testId: "tp" },
                    )}
                    {cell(
                      "Order Allocation",
                      money(d.capitalBudgetAnalysis?.perOrderAllocation) != null
                        ? `${money(d.capitalBudgetAnalysis?.perOrderAllocation)} USD`
                        : unavailable(d.capitalBudgetAnalysis?.note ?? "blocked"),
                      { testId: "order-alloc" },
                    )}
                    {cell(
                      "Proposed Quantity",
                      d.proposedQuantity != null
                        ? `${d.proposedQuantity}${qtyUnit ? ` ${qtyUnit}` : ""}`
                        : unavailable("withheld"),
                      { testId: "qty" },
                    )}
                    {cell(
                      "Required Margin",
                      d.rewardRiskAnalysis?.estimatedRequiredMarginStatus === "COMPUTED"
                      && d.rewardRiskAnalysis.estimatedRequiredMargin != null
                        ? fmtNum(d.rewardRiskAnalysis.estimatedRequiredMargin, 2)
                        : unavailable("not verified"),
                    )}
                    {cell(
                      "Free Margin",
                      status?.verification?.account?.usableMargin != null
                        ? fmtNum(status.verification.account.usableMargin, 2)
                        : unavailable("account"),
                    )}
                    {cell(
                      "Estimated SL Loss",
                      money(d.rewardRiskAnalysis?.estimatedStopLossRisk) ?? unavailable("units/qty"),
                    )}
                    {cell(
                      "Max Allowed SL Loss",
                      money(d.capitalBudgetAnalysis?.perOrderLossLimit) != null
                        ? `${money(d.capitalBudgetAnalysis?.perOrderLossLimit)} (25% of order allocation)`
                        : unavailable("allocation"),
                    )}
                    {cell(
                      "Remaining Strategy Budget",
                      money(d.capitalBudgetAnalysis?.remainingBudget)
                        ?? money(d.capitalBudgetAnalysis?.capitalAllocationBudget)
                        ?? unavailable("strategy budget"),
                    )}
                    {cell(
                      "Quote / Exposure",
                      `${d.quoteFreshnessStatus ?? "—"} · ${status?.exposureReconciliation?.authoritative
                        ? (status.exposureReconciliation.confirmedZeroExposure
                          ? "exposure empty"
                          : "exposure present")
                        : "exposure unavailable"}`,
                    )}
                    {cell(
                      "Min-Stop / CondDist",
                      (() => {
                        const checks = (d as { checks?: Array<{ code?: string; status?: string; message?: string }> })
                          .checks;
                        const hit = checks?.find((c) =>
                          c.code === "MIN_STOP_DISTANCE" || c.code === "MIN_STOP_DISTANCE_UNVERIFIED"
                        );
                        if (hit?.status === "PASS") return hit.message ?? "PASS";
                        if (hit?.status === "FAIL") return hit.message ?? "FAIL";
                        return unavailable(hit?.message ?? "unverified");
                      })(),
                    )}
                    {cell(
                      "Currency Conversion",
                      status?.verification?.account?.accountCurrency
                        ? (String(status.verification.account.accountCurrency).toUpperCase() === "USD"
                          ? "USD account — identity"
                          : unavailable("non-USD conversion rate required"))
                        : unavailable("account currency"),
                    )}
                    {cell(
                      "Data Readiness",
                      status?.simulationDataReadiness?.overall
                        ? `${status.simulationDataReadiness.overall}`
                          + (status.simulationDataReadiness.readyForSimulationDraft
                            ? " — draft sizing gates OK (execution still forbidden)"
                            : ` — ${(status.simulationDataReadiness.notReady?.length ?? 0)} gate(s) not READY`)
                        : unavailable("status"),
                      { testId: "data-readiness" },
                    )}
                  </dl>
                  <p className="fx-auto-trading-hint" data-fx-at-sim-exec="false">
                    simulationOnly={String(d.simulationOnly !== false)} · placesOrders=
                    {String(d.placesOrders === true)} · acceptsForExecution=
                    {String(d.acceptsForExecution === true)}
                  </p>
                  {d.proposedQuantityNote ? (
                    <p className="fx-auto-trading-hint">{d.proposedQuantityNote}</p>
                  ) : null}
                  {Array.isArray(d.explanations) && d.explanations.length > 0 ? (
                    <ul className="fx-auto-gates fx-auto-sim-reasons" data-fx-at-sim-reasons="true">
                      {d.explanations.slice(0, 8).map((r, i) => (
                        <li key={`sim-ex-${i}`} data-ok="false">{r}</li>
                      ))}
                    </ul>
                  ) : null}
                  {(d as { revalidatedOnLoad?: boolean }).revalidatedOnLoad ? (
                    <p className="fx-auto-trading-hint" data-fx-at-sim-revalidated="true">
                      Revalidated on load against current quote and budget — prior VALIDATION_PASSED was not trusted.
                    </p>
                  ) : null}
                </div>
              );
            })()}
            <div className="fx-auto-sim-history" data-fx-at-sim-draft-history="true">
              <h3 className="fx-auto-trading-h3">Saved simulation drafts</h3>
              {simDraftHistory.length === 0 ? (
                <p className="fx-auto-trading-hint" data-fx-at-sim-draft-history-empty="true">
                  No persisted drafts yet. Validate a draft to save one.
                </p>
              ) : (
                <ul className="fx-auto-sim-history-list">
                  {simDraftHistory.slice(0, 8).map((h) => {
                    const id = String(h.draftId ?? "");
                    const st = String(h.overallStatus ?? "—");
                    const dir = String(h.direction ?? "—");
                    const inst = String(h.instrument ?? "—");
                    const when = String(h.validatedAtUtc ?? h.createdAtUtc ?? "").slice(0, 19);
                    return (
                      <li key={id || when} className="fx-auto-sim-history-item">
                        <span className="fx-auto-sim-history-meta">
                          <strong data-fx-at-sim-hist-status={st}>{st}</strong>
                          {" · "}
                          {dir} {inst}
                          {when ? ` · ${when}Z` : ""}
                        </span>
                        <button
                          type="button"
                          className="fx-btn fx-btn--ghost fx-btn--compact"
                          disabled={busy || simRiskBusy || !id}
                          onClick={() => void reopenSimDraft(id)}
                          data-fx-at-sim-hist-reopen={id}
                        >
                          Reopen
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section
            className="fx-auto-trading-panel fx-auto-sim-lifecycle"
            aria-label="Simulated positions"
            data-fx-at-sim-lifecycle="true"
          >
            <div className="fx-auto-trading-panel-head">
              <h2 className="fx-auto-trading-h2">Simulated positions</h2>
              <p className="fx-auto-trading-hint" data-fx-at-sim-life-banner="true">
                Simulation only — never broker orders. Auto re-entry disabled.
                {" "}
                open={simLifecycle?.openCount ?? 0} · closed={simLifecycle?.closedCount ?? 0}
                {" · "}placesOrders=false · acceptsForExecution=false
              </p>
            </div>
            {!simLifecycle || !Array.isArray(simLifecycle.positions) || simLifecycle.positions.length === 0 ? (
              <p className="fx-auto-trading-hint" data-fx-at-sim-life-empty="true">
                No simulated positions. Validate a draft to VALIDATION_PASSED, then Open simulated position.
              </p>
            ) : (
              <ul className="fx-auto-sim-life-list">
                {simLifecycle.positions.slice(0, 12).map((p) => {
                  const id = String(p.simulationPositionId ?? "");
                  const state = String(p.state ?? "—");
                  const dir = String(p.direction ?? "—");
                  const inst = String(p.instrument ?? "—");
                  const entry = p.entryPrice != null ? String(p.entryPrice) : "—";
                  const sl = p.stopLoss != null ? String(p.stopLoss) : "—";
                  const tp = p.takeProfit != null ? String(p.takeProfit) : "—";
                  const qty = p.quantity != null ? String(p.quantity) : "—";
                  const quoteAt = p.latestQuoteAtUtc
                    ? String(p.latestQuoteAtUtc).slice(0, 19)
                    : "UNKNOWN";
                  const pnl = p.unrealizedPnl;
                  const realized = p.realizedPnl;
                  const pnlLabel =
                    state === "SIMULATED_CLOSED"
                      ? (realized != null && Number.isFinite(Number(realized))
                        ? `realized ${fmtNum(Number(realized), 2)}`
                        : "realized UNKNOWN")
                      : (pnl != null && Number.isFinite(Number(pnl))
                        ? `unrealized ${fmtNum(Number(pnl), 2)}`
                        : "P/L UNKNOWN");
                  const monitoringBlocked = state === "STALE_INTERRUPTED";
                  const isClosed = state === "SIMULATED_CLOSED";
                  const isOpen =
                    state === "SIMULATED_OPEN"
                    || state === "MONITORING"
                    || state === "STALE_INTERRUPTED"
                    || state === "EXIT_TRIGGERED";
                  return (
                    <li
                      key={id}
                      className="fx-auto-sim-life-card"
                      data-fx-at-sim-pos={id}
                      data-fx-at-sim-pos-state={state}
                    >
                      <div className="fx-auto-sim-life-card-head">
                        <strong data-fx-at-sim-pos-id={id}>{id || "sim_?"}</strong>
                        <span
                          className={`fx-auto-sim-life-state${monitoringBlocked ? " is-blocked" : ""}`}
                          data-fx-at-sim-pos-status={state}
                        >
                          {state}
                          {monitoringBlocked ? " — monitoring blocked (stale/unavailable quote)" : ""}
                        </span>
                      </div>
                      <dl className="fx-auto-sim-grid fx-auto-sim-life-grid">
                        <div className="fx-auto-sim-cell">
                          <span className="fx-auto-sim-cell-label">Instrument / dir</span>
                          <span className="fx-auto-sim-cell-value">{inst} {dir}</span>
                        </div>
                        <div className="fx-auto-sim-cell">
                          <span className="fx-auto-sim-cell-label">Entry / qty</span>
                          <span className="fx-auto-sim-cell-value">{entry} / {qty}</span>
                        </div>
                        <div className="fx-auto-sim-cell">
                          <span className="fx-auto-sim-cell-label">SL / TP</span>
                          <span className="fx-auto-sim-cell-value">{sl} / {tp}</span>
                        </div>
                        <div className="fx-auto-sim-cell">
                          <span className="fx-auto-sim-cell-label">Quote / P/L</span>
                          <span className="fx-auto-sim-cell-value">
                            {quoteAt} · {pnlLabel}
                          </span>
                        </div>
                        {isClosed && p.exitReason ? (
                          <div className="fx-auto-sim-cell">
                            <span className="fx-auto-sim-cell-label">Exit</span>
                            <span className="fx-auto-sim-cell-value" data-fx-at-sim-exit-reason={String(p.exitReason)}>
                              {String(p.exitReason)}
                              {p.exitPrice != null ? ` @ ${String(p.exitPrice)}` : ""}
                              {p.achievedR != null && Number.isFinite(Number(p.achievedR))
                                ? ` · R ${fmtNum(Number(p.achievedR), 2)}`
                                : ""}
                              {p.exitQuoteSnapshotId
                                ? ` · q ${String(p.exitQuoteSnapshotId).slice(0, 12)}…`
                                : ""}
                            </span>
                          </div>
                        ) : null}
                        {monitoringBlocked ? (
                          <div className="fx-auto-sim-cell">
                            <span className="fx-auto-sim-cell-label">Monitor</span>
                            <span className="fx-auto-sim-cell-value" data-fx-at-sim-monitor-blocked="true">
                              BLOCKED — no fill invented; P/L UNKNOWN until LIVE fresh quote
                            </span>
                          </div>
                        ) : null}
                      </dl>
                      <div className="fx-auto-sim-life-actions">
                        {isOpen ? (
                          <>
                            <button
                              type="button"
                              className="fx-btn fx-btn--secondary fx-btn--compact"
                              disabled={busy || simLifeBusy || !id}
                              onClick={() => void monitorSimulatedPositionUi(id)}
                              data-fx-at-sim-monitor={id}
                            >
                              Refresh monitor
                            </button>
                            <button
                              type="button"
                              className="fx-btn fx-btn--ghost fx-btn--compact"
                              disabled={busy || simLifeBusy || !id}
                              onClick={() => void closeSimulatedPositionUi(id)}
                              data-fx-at-sim-close={id}
                            >
                              Simulated close
                            </button>
                            <button
                              type="button"
                              className="fx-btn fx-btn--ghost fx-btn--compact"
                              disabled={busy || simLifeBusy || !id}
                              onClick={() => void controlledSimInjectUi(id, "sl_cross")}
                              data-fx-at-sim-controlled-sl={id}
                              title="Simulation-only: inject a fresh quote that crosses Stop Loss. Never a broker order."
                            >
                              Controlled SL (sim)
                            </button>
                            <button
                              type="button"
                              className="fx-btn fx-btn--ghost fx-btn--compact"
                              disabled={busy || simLifeBusy || !id}
                              onClick={() => void controlledSimInjectUi(id, "stale")}
                              data-fx-at-sim-controlled-stale={id}
                              title="Simulation-only: inject a stale quote (no fill)."
                            >
                              Controlled stale
                            </button>
                          </>
                        ) : (
                          <span className="fx-auto-trading-hint">Closed — simulation only (not a broker fill).</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
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
              <div>
                <dt>XAU quantity unit</dt>
                <dd data-fx-at-qty-unit="true">
                  {status.quantitySemantics?.quantityUnit
                    ? `${status.quantitySemantics.quantityUnitValue ?? "—"} (${status.quantitySemantics.quantityUnit})`
                    : "Unverified"}
                </dd>
              </div>
              <div>
                <dt>Min-stop verification</dt>
                <dd data-fx-at-min-stop="true">
                  {status.quantitySemantics?.minStopDistanceVerified
                    ? "Verified"
                    : status.quantitySemantics?.minStopDistance
                      ? `${status.quantitySemantics.minStopDistance} (not account-attested)`
                      : "Unverified"}
                </dd>
              </div>
              <div>
                <dt>Exposure reconciliation</dt>
                <dd data-fx-at-exposure="true">
                  {status.exposureReconciliation?.authoritative
                    ? status.exposureReconciliation.confirmedZeroExposure
                      ? "Authoritative · confirmed zero (NO_ORDERS + NO_TRADES)"
                      : `Authoritative · positions=${status.exposureReconciliation.openPositionsCount ?? "—"} pending=${status.exposureReconciliation.pendingOrdersCount ?? "—"}`
                    : status.exposureReconciliation?.status
                      ? `Unavailable / ${status.exposureReconciliation.status}`
                      : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Monetary SL risk calc</dt>
                <dd data-fx-at-monetary-risk="true">
                  {status.quantitySemantics?.monetaryRiskAllowed
                    ? "Allowed when quantity + SL geometry verified"
                    : "Blocked — units/min-stop incomplete"}
                </dd>
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
