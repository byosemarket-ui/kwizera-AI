/**
 * Phase 4.4 — production read-only verification.
 * Uses KWIZERA_ADMIN_API_TOKEN from env. Never prints the token or raw account IDs.
 */
const base = process.env.KWIZERA_PROD_BASE ?? "http://162.35.114.19:5173";
const token = String(process.env.KWIZERA_ADMIN_API_TOKEN ?? "").trim();

function maskId(v) {
  const s = String(v ?? "");
  if (!s) return null;
  if (s.includes("•") || s.includes("*")) return s;
  if (s.length <= 4) return "••••";
  return `${s.slice(0, 2)}••••${s.slice(-2)}`;
}

async function req(method, path, body) {
  const headers = { Accept: "application/json" };
  if (token) headers["x-kwizera-admin-token"] = token;
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${base}${path}`, init);
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
  };
}

const out = {
  adminTokenPresent: Boolean(token),
  checks: {},
};

// Public
out.deployment = await req("GET", "/api/deployment");
out.health = await req("GET", "/api/health");
const fc = await req("GET", "/api/forex/providers/forexconnect/status");
out.fc = {
  status: fc.status,
  ok: fc.json?.ok,
  fcStatus: fc.json?.status,
  environment: fc.json?.environment,
  trading: fc.json?.trading,
  sidecarReachable: fc.json?.sidecarReachable,
  liveConfigured: fc.json?.profiles?.profiles?.live?.configured ?? null,
  demoConfigured: fc.json?.profiles?.profiles?.demo?.configured ?? null,
  preferredEnvironment: fc.json?.profiles?.preferredEnvironment ?? null,
  activeEnvironment: fc.json?.profiles?.activeEnvironment ?? null,
  lastQuoteAt: fc.json?.lastQuoteAt ?? null,
};

if (!token) {
  out.checks.admin = "BLOCKED_ADMIN_TOKEN_MISSING";
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

// Warm candles (RO)
await req("GET", "/api/forex/providers/forexconnect/candles?symbol=XAU/USD&timeframe=15m&limit=5");

const brokerRo = await req("GET", "/api/forex/automated-trading/broker-ro-tables");
out.brokerRo = {
  http: brokerRo.status,
  ok: brokerRo.json?.ok,
  placesOrders: brokerRo.json?.placesOrders,
  mutatesBroker: brokerRo.json?.mutatesBroker,
  accountsOk: brokerRo.json?.accounts?.ok,
  accountCount: brokerRo.json?.accounts?.count,
  accountsFetchedAt: brokerRo.json?.accounts?.fetchedAt ?? null,
  accounts: Array.isArray(brokerRo.json?.accounts?.accounts)
    ? brokerRo.json.accounts.accounts.map(pickAccount)
    : null,
  openTradesCount: Array.isArray(brokerRo.json?.openTrades?.trades)
    ? brokerRo.json.openTrades.trades.length
    : (Array.isArray(brokerRo.json?.trades) ? brokerRo.json.trades.length : null),
  openOrdersCount: Array.isArray(brokerRo.json?.openOrders?.orders)
    ? brokerRo.json.openOrders.orders.length
    : null,
  reconciliation: brokerRo.json?.reconciliation
    ? {
      ok: brokerRo.json.reconciliation.ok ?? null,
      blockers: brokerRo.json.reconciliation.blockers ?? brokerRo.json.reconciliation.codes ?? null,
      code: brokerRo.json.reconciliation.code ?? null,
    }
    : null,
};

const engineStatus = await req("GET", "/api/forex/automated-trading/auto-engine/status");
const eng = engineStatus.json?.engine ?? engineStatus.json ?? {};
const daily = eng.dailyRisk ?? engineStatus.json?.dailyRisk ?? null;
out.autoEngineStatus = {
  http: engineStatus.status,
  ok: engineStatus.json?.ok,
  mode: eng.mode,
  strategyId: eng.strategyId,
  timeframe: eng.timeframe,
  lots: eng.lots,
  continuousEnabled: eng.continuousEnabled,
  submitAuthorized: eng.submitAuthorized,
  workerLockHeld: eng.workerLockHeld,
  blockNewEntries: eng.blockNewEntries,
  placesOrders: eng.placesOrders ?? engineStatus.json?.placesOrders,
  acceptsForExecution: eng.acceptsForExecution ?? engineStatus.json?.acceptsForExecution,
  mutatesBroker: eng.mutatesBroker ?? engineStatus.json?.mutatesBroker,
  lastPrepareCode: eng.lastPrepareCode,
  lastSubmitCode: eng.lastSubmitCode,
  positionReconcileCode: eng.positionReconcileCode,
  lastTickAtUtc: eng.lastTickAtUtc,
  lastSignalDirection: eng.lastSignal?.direction ?? null,
  lastSignalCode: eng.lastSignal?.code ?? null,
  dailyRisk: daily
    ? {
      authoritative: daily.authoritative,
      tradingDayKey: daily.tradingDayKey,
      accountCurrency: daily.accountCurrency,
      dayStartEquity: daily.dayStartEquity,
      currentEquity: daily.currentEquity,
      realizedPnlAccount: daily.realizedPnlAccount,
      unrealizedPnlAccount: daily.unrealizedPnlAccount,
      dailyDrawdownFraction: daily.dailyDrawdownFraction,
      dailyLossAccount: daily.dailyLossAccount,
      blockers: daily.blockers,
      updatedAtUtc: daily.updatedAtUtc,
      accountsFetchedAtUtc: daily.accountsFetchedAtUtc,
    }
    : null,
};

const activation = await req("GET", "/api/forex/automated-trading/demo-lifecycle/activation-readiness");
out.activationReadiness = {
  http: activation.status,
  ok: activation.json?.ok,
  readyForOwnerActivationApproval: activation.json?.readyForOwnerActivationApproval,
  blockers: activation.json?.blockers,
  checks: Array.isArray(activation.json?.checks)
    ? activation.json.checks.map((c) => ({ code: c.code, status: c.status, message: c.message }))
    : null,
  evidenceDaily: activation.json?.evidence?.dailyRisk
    ? {
      authoritative: activation.json.evidence.dailyRisk.authoritative,
      blockers: activation.json.evidence.dailyRisk.blockers,
      tradingDayKey: activation.json.evidence.dailyRisk.tradingDayKey,
      accountCurrency: activation.json.evidence.dailyRisk.accountCurrency,
      dayStartEquity: activation.json.evidence.dailyRisk.dayStartEquity,
      currentEquity: activation.json.evidence.dailyRisk.currentEquity,
      realizedPnlAccount: activation.json.evidence.dailyRisk.realizedPnlAccount,
      unrealizedPnlAccount: activation.json.evidence.dailyRisk.unrealizedPnlAccount,
    }
    : null,
  evidenceEngine: activation.json?.evidence?.engine ?? null,
  grantsCount: Array.isArray(activation.json?.evidence?.grants)
    ? activation.json.evidence.grants.length
    : null,
};

const readiness = await req("GET", "/api/forex/automated-trading/demo-lifecycle/readiness");
out.demoLifecycleReadiness = {
  http: readiness.status,
  mayAttemptDemoMutation: readiness.json?.mayAttemptDemoMutation ?? null,
  blockers: readiness.json?.blockers ?? null,
  primaryBlocker: readiness.json?.primaryBlocker ?? null,
  placesOrders: readiness.json?.placesOrders ?? false,
};

const demoStatus = await req("GET", "/api/forex/automated-trading/demo-lifecycle/status");
out.demoLifecycleStatus = {
  http: demoStatus.status,
  placesOrdersGlobal: demoStatus.json?.placesOrdersGlobal,
  activeDemoGrants: Array.isArray(demoStatus.json?.activeDemoGrants)
    ? demoStatus.json.activeDemoGrants.length
    : null,
  lifecycleRecordCount: demoStatus.json?.lifecycleRecordCount ?? null,
  latestLifecycleState: demoStatus.json?.latestLifecycle?.state ?? null,
  persistenceDegraded: demoStatus.json?.persistenceDegraded ?? null,
};

// Dry-run tick only if mode is dry_run / not armed_execute
const mode = eng.mode ?? "unknown";
if (mode === "dry_run" || mode === "off" || mode === "armed_prepare_only") {
  const tick = await req("POST", "/api/forex/automated-trading/auto-engine/tick", {});
  const teng = tick.json?.engine ?? {};
  out.dryRunTick = {
    http: tick.status,
    ok: tick.json?.ok,
    note: tick.json?.note ?? null,
    mode: teng.mode,
    placesOrders: tick.json?.placesOrders ?? teng.placesOrders,
    mutatesBroker: tick.json?.mutatesBroker ?? teng.mutatesBroker,
    acceptsForExecution: tick.json?.acceptsForExecution ?? teng.acceptsForExecution,
    blockNewEntries: teng.blockNewEntries,
    lastPrepareCode: teng.lastPrepareCode,
    lastSubmitCode: teng.lastSubmitCode,
    positionReconcileCode: teng.positionReconcileCode,
    lastSignalDirection: teng.lastSignal?.direction ?? null,
    lastSignalCode: teng.lastSignal?.code ?? null,
    dailyAuthoritative: teng.dailyRisk?.authoritative ?? null,
    dailyBlockers: teng.dailyRisk?.blockers ?? null,
    continuousEnabled: teng.continuousEnabled,
    submitAuthorized: teng.submitAuthorized,
  };
} else {
  out.dryRunTick = { skipped: true, reason: `mode=${mode} — refusing tick to avoid armed path` };
}

console.log(JSON.stringify(out, null, 2));
