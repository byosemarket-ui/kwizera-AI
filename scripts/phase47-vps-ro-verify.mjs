/**
 * Phase 4.7 — DEMO read-only + dry-run functional verification.
 *
 * Intended to run:
 * - On the VPS against http://127.0.0.1:5173 with KWIZERA_ADMIN_API_TOKEN from process/.env
 * - Or locally after load-operator-env / explicit env
 *
 * NEVER prints tokens, passwords, or raw account IDs.
 * NEVER enables mutation, grants, armed_execute, or continuous scheduling.
 * NEVER submits broker orders.
 */

import fs from "node:fs";
import path from "node:path";
import { loadOperatorEnv, parseDotEnvText } from "./lib/load-operator-env.mjs";

const operatorLoad = loadOperatorEnv();

function loadTokenFromDotEnvFiles(candidates) {
  if (String(process.env.KWIZERA_ADMIN_API_TOKEN ?? "").trim()) {
    return { source: "process.env", present: true };
  }
  for (const filePath of candidates) {
    if (!filePath || !fs.existsSync(filePath)) continue;
    let text = "";
    try {
      text = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }
    const parsed = parseDotEnvText(text);
    const token = String(parsed.KWIZERA_ADMIN_API_TOKEN ?? "").trim();
    if (!token) continue;
    process.env.KWIZERA_ADMIN_API_TOKEN = token;
    if (parsed.KWIZERA_PROD_BASE && !String(process.env.KWIZERA_PROD_BASE ?? "").trim()) {
      process.env.KWIZERA_PROD_BASE = parsed.KWIZERA_PROD_BASE;
    }
    return { source: path.basename(filePath), present: true };
  }
  return { source: null, present: false };
}

const envLoad = loadTokenFromDotEnvFiles([
  process.env.KWIZERA_VPS_ENV_FILE,
  "/opt/kwizera-ai/.env",
  path.resolve(process.cwd(), ".env"),
].filter(Boolean));

const base = String(process.env.KWIZERA_PROD_BASE ?? "http://127.0.0.1:5173").replace(/\/$/, "");
const token = String(process.env.KWIZERA_ADMIN_API_TOKEN ?? "").trim();

function maskId(v) {
  const s = String(v ?? "");
  if (!s) return null;
  if (s.includes("•") || s.includes("*")) return s;
  if (s.length <= 4) return "••••";
  return `${s.slice(0, 2)}••••${s.slice(-2)}`;
}

async function req(method, pathName, body) {
  const headers = { Accept: "application/json" };
  if (token) headers["x-kwizera-admin-token"] = token;
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${base}${pathName}`, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { rawLen: text.length };
  }
  return { status: res.status, json };
}

function pickAccount(a) {
  if (!a || typeof a !== "object") return null;
  return {
    accountIdMasked: a.accountIdMasked ?? maskId(a.accountId) ?? null,
    accountCurrency: a.accountCurrency ?? a.currency ?? null,
    equity: a.equity ?? null,
    balance: a.balance ?? null,
    usableMargin: a.usableMargin ?? null,
    usedMargin: a.usedMargin ?? null,
    dayPl: a.dayPl ?? null,
    grossPl: a.grossPl ?? null,
    environment: a.environment ?? null,
    missingFields: a.missingFields ?? null,
  };
}

function rootCauseFromHttp(status, json) {
  const code = json?.error?.code ?? json?.code ?? null;
  if (status === 403 || status === 401) {
    if (code === "ADMIN_TOKEN_NOT_CONFIGURED") {
      return {
        kind: "Missing configuration",
        detail: "Production server lacks KWIZERA_ADMIN_API_TOKEN",
      };
    }
    if (code === "ADMIN_TOKEN_MISSING" || code === "ADMIN_FORBIDDEN") {
      return {
        kind: "Missing authorization",
        detail: "Request lacked a valid admin token header",
      };
    }
    if (code === "ADMIN_TOKEN_INVALID") {
      return {
        kind: "Missing authorization",
        detail: "Admin token present but did not match server",
      };
    }
    return { kind: "Missing authorization", detail: String(code ?? status) };
  }
  if (status >= 500) return { kind: "Software defect", detail: `HTTP ${status}` };
  return null;
}

const report = {
  phase: "4.7",
  base,
  adminTokenPresent: Boolean(token),
  tokenSource: envLoad.source ?? (operatorLoad.loadedFrom ? "operator.env" : null),
  safety: {
    placesOrdersExpected: false,
    mutatesBrokerExpected: false,
    allowDemoMutation: false,
    armedExecute: false,
    continuousScheduling: false,
  },
  components: {},
};

const deployment = await req("GET", "/api/deployment");
report.deployment = {
  http: deployment.status,
  deployedCommit: deployment.json?.deployedCommit ?? null,
  verifiedLive: deployment.json?.verifiedLive ?? null,
  status: deployment.json?.status ?? null,
};

const health = await req("GET", "/api/health");
report.health = {
  http: health.status,
  ok: health.json?.ok ?? null,
  status: health.json?.status ?? null,
};

const fc = await req("GET", "/api/forex/providers/forexconnect/status");
report.forexConnect = {
  http: fc.status,
  ok: fc.json?.ok ?? null,
  status: fc.json?.status ?? null,
  environment: fc.json?.environment ?? null,
  trading: fc.json?.trading ?? null,
  sidecarReachable: fc.json?.sidecarReachable ?? null,
  liveConfigured: fc.json?.profiles?.profiles?.live?.configured ?? null,
  demoConfigured: fc.json?.profiles?.profiles?.demo?.configured ?? null,
  preferredEnvironment: fc.json?.profiles?.preferredEnvironment ?? null,
  activeEnvironment: fc.json?.profiles?.activeEnvironment ?? null,
  lastQuoteAt: fc.json?.lastQuoteAt ?? null,
};

report.components.liveIsolation = {
  state:
    report.forexConnect.liveConfigured === false
    && report.forexConnect.trading === "DISABLED"
    && String(report.forexConnect.environment ?? "").toLowerCase() === "demo"
      ? "PASS"
      : "FAIL",
  evidence: report.forexConnect,
};

if (!token) {
  report.components.adminAccess = {
    state: "BLOCKED",
    rootCause: "Missing authorization",
    evidence: "KWIZERA_ADMIN_API_TOKEN absent in runner after operator.env and VPS .env candidates",
    repair: "Provision %USERPROFILE%\\.kwizera\\operator.env OR run Phase 4.7 VPS workflow (SSH reads VPS .env)",
    repairType: "authorization",
    testRequired: "Re-run this script; expect adminTokenPresent=true and admin endpoints HTTP 200",
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

report.components.adminAccess = {
  state: "PASS",
  rootCause: null,
  evidence: `token loaded from ${report.tokenSource ?? "process.env"} (value not logged)`,
  repair: null,
  repairType: null,
  testRequired: null,
};

await req("GET", "/api/forex/providers/forexconnect/candles?symbol=XAU/USD&timeframe=15m&limit=5");

const brokerRo = await req("GET", "/api/forex/automated-trading/broker-ro-tables");
const brokerCause = rootCauseFromHttp(brokerRo.status, brokerRo.json);
const accounts = Array.isArray(brokerRo.json?.accounts?.accounts)
  ? brokerRo.json.accounts.accounts.map(pickAccount)
  : null;
const fcStatusNow = String(report.forexConnect.status ?? "").toUpperCase();
const accountsOk = brokerRo.json?.accounts?.ok === true
  && Array.isArray(accounts)
  && accounts.length > 0;
report.components.brokerRoTables = {
  state: brokerRo.status === 200 && brokerRo.json?.ok === true && accountsOk
    ? "ACTIVE"
    : (brokerCause || fcStatusNow !== "CONNECTED" ? "BLOCKED" : "FAIL"),
  http: brokerRo.status,
  ok: brokerRo.json?.ok ?? null,
  placesOrders: brokerRo.json?.placesOrders ?? null,
  mutatesBroker: brokerRo.json?.mutatesBroker ?? null,
  accountsOk: brokerRo.json?.accounts?.ok ?? null,
  accountCount: brokerRo.json?.accounts?.count ?? null,
  accountsFetchedAt: brokerRo.json?.accounts?.fetchedAt ?? null,
  accounts,
  rootCause: !accountsOk && fcStatusNow !== "CONNECTED"
    ? "Broker session disconnected"
    : (!accountsOk ? "Missing data" : brokerCause?.kind ?? null),
  openPositionsCount: Array.isArray(brokerRo.json?.openPositions?.trades)
    ? brokerRo.json.openPositions.trades.length
    : null,
  openOrdersCount: Array.isArray(brokerRo.json?.openWorkingOrders?.orders)
    ? brokerRo.json.openWorkingOrders.orders.length
    : (Array.isArray(brokerRo.json?.openOrders?.orders) ? brokerRo.json.openOrders.orders.length : null),
  reconciliation: brokerRo.json?.reconciliation
    ? {
      ok: brokerRo.json.reconciliation.ok ?? null,
      blockers: brokerRo.json.reconciliation.blockers ?? brokerRo.json.reconciliation.codes ?? null,
      code: brokerRo.json.reconciliation.code ?? null,
    }
    : null,
  evidence: brokerCause?.detail ?? null,
};

const primary = accounts?.[0] ?? null;
const accountBlocked = Boolean(brokerCause) || fcStatusNow !== "CONNECTED" || !accountsOk;
report.components.demoAccountIdentity = {
  state: primary?.accountIdMasked ? "ACTIVE" : (accountBlocked ? "BLOCKED" : "NOT VERIFIED"),
  accountIdMasked: primary?.accountIdMasked ?? null,
  environment: primary?.environment ?? report.forexConnect.environment ?? null,
  rootCause: accountBlocked ? "Broker session disconnected or account rows empty" : null,
};
report.components.accountCurrencyEquityBalance = {
  state: primary && primary.accountCurrency != null && primary.equity != null && primary.balance != null
    ? "ACTIVE"
    : (accountBlocked ? "BLOCKED" : "NOT VERIFIED"),
  accountCurrency: primary?.accountCurrency ?? null,
  equity: primary?.equity ?? null,
  balance: primary?.balance ?? null,
  rootCause: accountBlocked ? "Broker session disconnected or account rows empty" : null,
};
report.components.usableMarginFreshness = {
  state: primary && primary.usableMargin != null && report.components.brokerRoTables.accountsFetchedAt
    ? "ACTIVE"
    : (accountBlocked ? "BLOCKED" : "NOT VERIFIED"),
  usableMargin: primary?.usableMargin ?? null,
  usedMargin: primary?.usedMargin ?? null,
  accountsFetchedAt: report.components.brokerRoTables.accountsFetchedAt,
  missingFields: primary?.missingFields ?? null,
  rootCause: accountBlocked ? "Broker session disconnected or account rows empty" : null,
};

const engineStatus = await req("GET", "/api/forex/automated-trading/auto-engine/status");
const engCause = rootCauseFromHttp(engineStatus.status, engineStatus.json);
const eng = engineStatus.json?.engine ?? {};
const daily = eng.dailyRisk ?? engineStatus.json?.dailyRisk ?? null;
report.components.autoEngineStatus = {
  state: engineStatus.status === 200 && engineStatus.json?.ok === true ? "ACTIVE" : engCause ? "BLOCKED" : "FAIL",
  http: engineStatus.status,
  mode: eng.mode ?? null,
  strategyId: eng.strategyId ?? null,
  timeframe: eng.timeframe ?? null,
  lots: eng.lots ?? null,
  continuousEnabled: eng.continuousEnabled ?? null,
  submitAuthorized: eng.submitAuthorized ?? null,
  workerLockHeld: eng.workerLockHeld ?? null,
  blockNewEntries: eng.blockNewEntries ?? null,
  placesOrders: eng.placesOrders ?? engineStatus.json?.placesOrders ?? null,
  mutatesBroker: eng.mutatesBroker ?? engineStatus.json?.mutatesBroker ?? null,
  lastPrepareCode: eng.lastPrepareCode ?? null,
  lastSubmitCode: eng.lastSubmitCode ?? null,
  positionReconcileCode: eng.positionReconcileCode ?? null,
  lastTickAtUtc: eng.lastTickAtUtc ?? null,
  rootCause: engCause?.kind ?? null,
};

report.components.dailyRiskTelemetry = {
  state: daily?.authoritative === true
    ? "ACTIVE"
    : (daily ? "NOT VERIFIED" : (engCause ? "BLOCKED" : "NOT VERIFIED")),
  authoritative: daily?.authoritative ?? null,
  tradingDayKey: daily?.tradingDayKey ?? null,
  accountCurrency: daily?.accountCurrency ?? null,
  dayStartEquity: daily?.dayStartEquity ?? null,
  currentEquity: daily?.currentEquity ?? null,
  realizedPnlAccount: daily?.realizedPnlAccount ?? null,
  unrealizedPnlAccount: daily?.unrealizedPnlAccount ?? null,
  dailyDrawdownFraction: daily?.dailyDrawdownFraction ?? null,
  dailyLossAccount: daily?.dailyLossAccount ?? null,
  blockers: daily?.blockers ?? null,
  updatedAtUtc: daily?.updatedAtUtc ?? null,
  accountsFetchedAtUtc: daily?.accountsFetchedAtUtc ?? null,
};

const fcDisconnected = String(report.forexConnect.status ?? "").toUpperCase() !== "CONNECTED";
report.components.positionReconciliation = {
  state: report.components.brokerRoTables.reconciliation?.ok === true
    ? "ACTIVE"
    : (brokerCause || fcDisconnected
      ? "BLOCKED"
      : (report.components.brokerRoTables.reconciliation?.ok === false ? "FAIL" : "NOT VERIFIED")),
  reconcile: report.components.brokerRoTables.reconciliation,
  enginePositionReconcileCode: eng.positionReconcileCode ?? null,
  rootCause: fcDisconnected ? "Stale data / broker session disconnected" : brokerCause?.kind ?? null,
};

const atStatus = await req("GET", "/api/forex/automated-trading/status");
const atCause = rootCauseFromHttp(atStatus.status, atStatus.json);
const st = atStatus.json?.status ?? {};
const qty = st.quantitySemantics ?? null;
const qEv = st.simulationDataReadiness?.quantityEvidence
  ?? st.simulationDataReadiness?.evidence?.quantityEvidence
  ?? null;
const condEv = st.simulationDataReadiness?.condDistEvidence ?? null;
const hasSpecs = Boolean(
  qEv?.baseUnitSize != null
  || qEv?.quantityMin != null
  || qEv?.quantityStep != null
  || qEv?.pointSize != null
);
report.components.xauContractSpecs = {
  state: hasSpecs ? "ACTIVE" : (atCause ? "BLOCKED" : "NOT VERIFIED"),
  http: atStatus.status,
  quantitySemantics: qty,
  instrumentSpecs: {
    symbol: "XAU/USD",
    baseUnitSize: qEv?.baseUnitSize ?? null,
    minQuantity: qEv?.quantityMin ?? null,
    quantityStep: qEv?.quantityStep ?? null,
    constraintsStatus: qEv?.constraintsStatus ?? null,
    sizingBlocked: qEv?.sizingBlocked ?? null,
    blockCode: qEv?.blockCode ?? null,
    pointSize: qEv?.pointSize ?? null,
    contractMultiplier: qEv?.contractMultiplier ?? null,
    pipCostAccount: qEv?.pipCostAccount ?? null,
    unit: qEv?.unit ?? null,
    mmrPerLot: st.instrument?.mmrPerLot ?? st.xauInstrument?.mmrPerLot ?? null,
    condDistAvailable: condEv?.available ?? null,
    minStopDistanceVerified: condEv?.minStopDistanceVerified ?? null,
  },
  rootCause: atCause?.kind ?? null,
};

const activation = await req("GET", "/api/forex/automated-trading/demo-lifecycle/activation-readiness");
const actCause = rootCauseFromHttp(activation.status, activation.json);
// HTTP 200 with ok=false means the readiness function ran; not-ready is expected pre-activation.
report.components.activationReadiness = {
  state: activation.status === 200
    ? "ACTIVE"
    : (activation.status >= 500 ? "FAIL" : actCause ? "BLOCKED" : "FAIL"),
  http: activation.status,
  ok: activation.json?.ok ?? null,
  errorCode: activation.json?.error?.code ?? null,
  errorMessage: activation.json?.error?.message ?? null,
  readyForOwnerActivationApproval: activation.json?.readyForOwnerActivationApproval ?? null,
  blockers: activation.json?.blockers ?? null,
  checks: Array.isArray(activation.json?.checks)
    ? activation.json.checks.map((c) => ({ code: c.code, status: c.status, message: c.message }))
    : null,
  evidenceDailyAuthoritative: activation.json?.evidence?.dailyRisk?.authoritative ?? null,
  rootCause: actCause?.kind ?? null,
};

// Prefer refreshed daily risk from activation evidence (it ticks prepare-only).
if (activation.json?.evidence?.dailyRisk) {
  const d = activation.json.evidence.dailyRisk;
  report.components.dailyRiskTelemetry = {
    ...report.components.dailyRiskTelemetry,
    state: d.authoritative === true ? "ACTIVE" : report.components.dailyRiskTelemetry.state,
    authoritative: d.authoritative ?? null,
    tradingDayKey: d.tradingDayKey ?? report.components.dailyRiskTelemetry.tradingDayKey,
    accountCurrency: d.accountCurrency ?? report.components.dailyRiskTelemetry.accountCurrency,
    dayStartEquity: d.dayStartEquity ?? report.components.dailyRiskTelemetry.dayStartEquity,
    currentEquity: d.currentEquity ?? report.components.dailyRiskTelemetry.currentEquity,
    realizedPnlAccount: d.realizedPnlAccount ?? report.components.dailyRiskTelemetry.realizedPnlAccount,
    unrealizedPnlAccount: d.unrealizedPnlAccount ?? report.components.dailyRiskTelemetry.unrealizedPnlAccount,
    blockers: d.blockers ?? report.components.dailyRiskTelemetry.blockers,
  };
}

const tick = await req("POST", "/api/forex/automated-trading/auto-engine/tick", {});
const tickCause = rootCauseFromHttp(tick.status, tick.json);
const teng = tick.json?.engine ?? {};
const dryOk = tick.status === 200
  && tick.json?.ok === true
  && (teng.mode === "dry_run" || String(tick.json?.note ?? "").includes("dry_run"))
  && tick.json?.placesOrders === false
  && tick.json?.mutatesBroker === false
  && (teng.submitAuthorized === false || teng.submitAuthorized == null);
report.components.productionDryRun = {
  state: dryOk ? "ACTIVE" : (tick.status >= 500 ? "FAIL" : tickCause ? "BLOCKED" : "FAIL"),
  http: tick.status,
  ok: tick.json?.ok ?? null,
  errorCode: tick.json?.error?.code ?? tick.json?.code ?? null,
  errorMessage: tick.json?.error?.message ?? tick.json?.message ?? null,
  note: tick.json?.note ?? null,
  mode: teng.mode ?? null,
  placesOrders: tick.json?.placesOrders ?? teng.placesOrders ?? null,
  mutatesBroker: tick.json?.mutatesBroker ?? teng.mutatesBroker ?? null,
  acceptsForExecution: tick.json?.acceptsForExecution ?? teng.acceptsForExecution ?? null,
  submitAuthorized: teng.submitAuthorized ?? null,
  continuousEnabled: teng.continuousEnabled ?? null,
  blockNewEntries: teng.blockNewEntries ?? null,
  lastPrepareCode: teng.lastPrepareCode ?? null,
  lastSubmitCode: teng.lastSubmitCode ?? null,
  positionReconcileCode: teng.positionReconcileCode ?? null,
  lastSignalDirection: teng.lastSignal?.direction ?? null,
  lastSignalCode: teng.lastSignal?.code ?? null,
  dailyAuthoritative: teng.dailyRisk?.authoritative ?? null,
  dailyBlockers: teng.dailyRisk?.blockers ?? null,
  rootCause: tickCause?.kind ?? null,
};

const bus = report.components.xauContractSpecs.instrumentSpecs?.baseUnitSize ?? null;
const minQ = report.components.xauContractSpecs.instrumentSpecs?.minQuantity ?? null;
const step = report.components.xauContractSpecs.instrumentSpecs?.quantityStep ?? null;
const mmr = report.components.xauContractSpecs.instrumentSpecs?.mmrPerLot ?? null;
const usable = report.components.usableMarginFreshness.usableMargin;
const sizingBlocked = report.components.xauContractSpecs.instrumentSpecs?.sizingBlocked;
let lotSupportState = "NOT VERIFIED";
let lotSupportDetail = "Broker specs not present in status response";
if (sizingBlocked === true) {
  lotSupportState = "FAIL";
  lotSupportDetail = String(report.components.xauContractSpecs.instrumentSpecs?.blockCode ?? "SIZING_BLOCKED");
} else if (bus != null || minQ != null || step != null) {
  const lots = 0.01;
  const amount = typeof bus === "number" ? bus * lots : null;
  const marginEst = typeof mmr === "number" ? mmr * lots : null;
  const minOk = minQ == null ? null : lots + 1e-12 >= Number(minQ);
  const stepOk = step == null || Number(step) <= 0
    ? null
    : Math.abs(Math.round(lots / Number(step)) * Number(step) - lots) < 1e-9;
  const marginOk = marginEst == null || usable == null
    ? null
    : Number(usable) >= Number(marginEst);
  if (minOk === false) {
    lotSupportState = "FAIL";
    lotSupportDetail = "0.01 lots below broker minQuantity";
  } else if (stepOk === false) {
    lotSupportState = "FAIL";
    lotSupportDetail = "0.01 lots not aligned to broker quantityStep";
  } else if (marginOk === false) {
    lotSupportState = "FAIL";
    lotSupportDetail = "usable margin below estimated mmr for 0.01 lots";
  } else if (minOk === true || stepOk === true || amount != null) {
    lotSupportState = "ACTIVE";
    lotSupportDetail = marginOk == null
      ? "0.01 lot size aligns with broker min/step; mmrPerLot not exposed for margin estimate"
      : "0.01 lot sizing and margin estimate within usable margin";
  }
}
report.components.lot001Support = {
  state: lotSupportState,
  detail: lotSupportDetail,
  baseUnitSize: bus,
  minQuantity: minQ,
  quantityStep: step,
  mmrPerLot: mmr,
  usableMargin: usable,
  requestedLots: 0.01,
};

report.summary = {
  deployedCommitMatches:
    String(report.deployment.deployedCommit ?? "").startsWith("15c334ca")
    || String(report.deployment.deployedCommit ?? "") === String(process.env.KWIZERA_EXPECT_SHA ?? ""),
  adminAccess: report.components.adminAccess?.state
    ?? (token ? "PASS" : "BLOCKED"),
  readOnlyPassed: [
    report.components.brokerRoTables,
    report.components.demoAccountIdentity,
    report.components.accountCurrencyEquityBalance,
    report.components.usableMarginFreshness,
    report.components.dailyRiskTelemetry,
    report.components.positionReconciliation,
    report.components.xauContractSpecs,
  ].every((c) => c.state === "ACTIVE" || c.state === "PASS"),
  dryRunPassed: report.components.productionDryRun.state === "ACTIVE",
  lot001Supported: report.components.lot001Support.state === "ACTIVE",
  liveIsolated: report.components.liveIsolation.state === "PASS",
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.summary.readOnlyPassed && report.summary.dryRunPassed ? 0 : 2);
