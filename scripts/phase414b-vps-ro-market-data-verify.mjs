/**
 * Phase 4.14B — VPS / operator READ-ONLY market-data + pipeline verify.
 *
 * - Loads KWIZERA_ADMIN_API_TOKEN via load-operator-env (never prints it).
 * - Never places orders, creates grants, or enables armed_execute.
 * - Distinguishes CONNECTED vs subscription vs snapshot vs genuine price change.
 * - Reports candle quality + pipeline stages; does not invent LIVE from history.
 */
import { existsSync, readFileSync } from "node:fs";
import { loadOperatorEnv } from "./lib/load-operator-env.mjs";

const base = String(process.env.KWIZERA_PROD_BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const expectSha = String(process.env.KWIZERA_EXPECT_SHA || "").trim() || null;

loadOperatorEnv();
let token = String(process.env.KWIZERA_ADMIN_API_TOKEN || "").trim();
for (const p of [process.env.KWIZERA_VPS_ENV_FILE, "/opt/kwizera-ai/.env"].filter(Boolean)) {
  if (token || !p || !existsSync(p)) continue;
  try {
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*KWIZERA_ADMIN_API_TOKEN\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (v) token = v;
    }
  } catch {
    /* ignore */
  }
}

function redact(obj) {
  return JSON.parse(JSON.stringify(obj, (k, v) => {
    if (/token|password|secret|authorization/i.test(String(k))) return "[REDACTED]";
    return v;
  }));
}

async function getJson(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { parseError: true, textLength: text.length };
  }
  return { status: res.status, body };
}

async function main() {
  const report = {
    phase: "4.14B",
    base,
    tokenPresent: Boolean(token),
    tokenLength: token ? token.length : 0,
    evidence: {},
    blockers: [],
    labels: {},
  };

  const dep = await getJson("/api/deployment");
  report.evidence.deployment = {
    deployedCommit: dep.body?.deployedCommit ?? null,
    health: dep.body?.health ?? dep.body?.ok ?? null,
  };
  if (expectSha && dep.body?.deployedCommit && !String(dep.body.deployedCommit).startsWith(expectSha.slice(0, 7))) {
    report.blockers.push(`SHA_MISMATCH expected ${expectSha} got ${dep.body.deployedCommit}`);
  }

  const fc = await getJson("/api/forex/providers/forexconnect/status");
  report.evidence.forexconnect = {
    status: fc.body?.status ?? null,
    environment: fc.body?.environment ?? null,
    trading: fc.body?.trading ?? null,
    offersListenerActive: fc.body?.offersListenerActive ?? null,
    subscriptionCount: fc.body?.subscriptionCount ?? null,
    subscriptions: fc.body?.subscriptions ?? null,
    streamUpdateCount: fc.body?.streamUpdateCount ?? null,
    lastQuoteAt: fc.body?.lastQuoteAt ?? null,
    liveConfigured: fc.body?.profiles?.profiles?.live?.configured ?? null,
  };
  if (fc.body?.profiles?.profiles?.live?.configured) {
    report.blockers.push("LIVE_CREDENTIALS_CONFIGURED_UNEXPECTED");
  }

  const stream = await getJson("/api/forex/providers/forexconnect/stream/status");
  report.evidence.stream = {
    http: stream.status,
    sessionStatus: stream.body?.sessionStatus ?? stream.body?.status ?? null,
    streamState: stream.body?.streamState ?? null,
    offersListenerActive: stream.body?.offersListenerActive ?? null,
    subscriptions: stream.body?.subscriptions ?? null,
    updateCount: stream.body?.updateCount ?? stream.body?.streamUpdateCount ?? null,
    lastQuoteAt: stream.body?.lastQuoteAt ?? null,
    lastReceiptAt: stream.body?.lastReceiptAt ?? null,
    pollChanges: stream.body?.diagnostics?.pollChanges ?? stream.body?.pollChanges ?? null,
    callbackAccepted: stream.body?.diagnostics?.callbackAccepted ?? null,
  };

  if (!token) {
    report.blockers.push("ADMIN_TOKEN_MISSING");
    report.labels.MARKET_SELECTION_VERIFIED = "BLOCKED";
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(2);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const st = await getJson("/api/forex/automated-trading/status", { headers });
  const status = st.body?.status ?? st.body ?? {};
  const backendInstrument = status?.selectedEnvState?.selectedInstrument
    ?? status?.selectedInstrument
    ?? null;
  report.evidence.atStatus = {
    http: st.status,
    selectedEnvironment: status?.selectedEnvironment ?? null,
    selectedInstrument: backendInstrument,
    placesOrders: status?.placesOrders ?? false,
    feedPipelineState: status?.feedStatusBreakdown?.pipelineState ?? null,
    feedPrimaryGap: status?.feedStatusBreakdown?.primaryGap ?? null,
    feedUpdateCount: status?.feedStatusBreakdown?.updateCount ?? null,
    pipelineStages: Array.isArray(status?.pipelineStages)
      ? status.pipelineStages.map((s) => ({
        id: s.id,
        verdict: s.verdict,
        code: s.code,
      }))
      : null,
    quantityCompatible001: status?.pipelineStatus?.quantityCompatibility?.compatible001Lot ?? null,
  };
  if (st.status === 403) {
    report.blockers.push("ADMIN_FORBIDDEN");
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(3);
  }

  if (!backendInstrument) {
    report.blockers.push("NO_MARKET_SELECTED");
    report.labels.MARKET_SELECTION_VERIFIED = "BLOCKED";
    report.evidence.strategyDryRun = { skipped: true, reason: "NO_MARKET_SELECTED" };
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(4);
  }
  report.labels.MARKET_SELECTION_VERIFIED = "BACKEND_INSTRUMENT_PRESENT";

  const dry = await getJson("/api/forex/automated-trading/strategy-dry-run", {
    method: "POST",
    headers,
    body: JSON.stringify({
      instrument: backendInstrument,
      timeframe: "1h",
      includeDeterministicFixtureLifecycle: true,
    }),
  });

  const breakdown = dry.body?.feedSnapshot?.breakdown ?? null;
  const updateCount = Number(breakdown?.updateCount ?? stream.body?.updateCount ?? 0) || 0;
  const genuine = Boolean(dry.body?.feedSnapshot?.realDemoQuotesObserved) && updateCount > 0;
  const marketClosed = breakdown?.marketClosed === true
    || breakdown?.pipelineState === "MARKET_CLOSED"
    || dry.body?.feedSnapshot?.reasonCode === "MARKET_CLOSED";

  report.evidence.strategyDryRun = {
    http: dry.status,
    ok: dry.body?.ok ?? false,
    mutatesBroker: dry.body?.mutatesBroker ?? dry.body?.dryRun?.mutatesBroker ?? null,
    acknowledgementLabel: dry.body?.dryRun?.acknowledgementLabel ?? null,
    usedDeterministicFixture: dry.body?.dryRun?.usedDeterministicFixture ?? null,
    strategy: dry.body?.dryRun?.strategy
      ? {
        code: dry.body.dryRun.strategy.code,
        direction: dry.body.dryRun.strategy.direction,
        fastSma: dry.body.dryRun.strategy.fastSma,
        slowSma: dry.body.dryRun.strategy.slowSma,
        atr: dry.body.dryRun.strategy.atr,
        closedCandleOpenSec: dry.body.dryRun.strategy.closedCandleOpenSec,
        reasons: (dry.body.dryRun.strategy.reasons || []).slice(0, 3),
      }
      : null,
    candleQuality: dry.body?.candleQuality
      ? {
        returnedBars: dry.body.candleQuality.returnedBars,
        closedBars: dry.body.candleQuality.closedBars,
        formingBars: dry.body.candleQuality.formingBars,
        duplicateCount: dry.body.candleQuality.duplicateCount,
        outOfOrderCount: dry.body.candleQuality.outOfOrderCount,
        invalidOhlcCount: dry.body.candleQuality.invalidOhlcCount,
        strategyReady: dry.body.candleQuality.strategyReady,
        blockers: (dry.body.candleQuality.blockers || []).slice(0, 6),
        source: dry.body.candleQuality.source,
      }
      : null,
    feed: dry.body?.feedSnapshot
      ? {
        bid: dry.body.feedSnapshot.bid,
        ask: dry.body.feedSnapshot.ask,
        feedStatus: dry.body.feedSnapshot.feedStatus,
        tradingStatus: dry.body.feedSnapshot.tradingStatus,
        quoteFresh: dry.body.feedSnapshot.quoteFresh,
        reasonCode: dry.body.feedSnapshot.reasonCode,
        realDemoQuotesObserved: dry.body.feedSnapshot.realDemoQuotesObserved,
        breakdown,
      }
      : null,
  };

  if (dry.body?.mutatesBroker === true || dry.body?.dryRun?.mutatesBroker === true) {
    report.blockers.push("MUTATES_BROKER_TRUE_UNEXPECTED");
  }

  const subCount = Number(report.evidence.forexconnect.subscriptionCount ?? 0) || 0;
  report.labels.SUBSCRIPTION_VERIFIED = subCount > 0 || breakdown?.instrumentSubscribed
    ? "OBSERVED"
    : "NOT_VERIFIED";
  report.labels.SNAPSHOT_VERIFIED = breakdown?.firstQuoteReceived ? "OBSERVED" : "NOT_VERIFIED";
  report.labels.LIVE_PRICE_CHANGE_VERIFIED = genuine
    ? "VERIFIED"
    : (marketClosed ? "BLOCKED_MARKET_CLOSED" : "BLOCKED_NO_GENUINE_PRICE_CHANGE");
  report.labels.HISTORICAL_DATA_VERIFIED = dry.body?.candleQuality?.returnedBars > 0
    ? "OBSERVED"
    : "NOT_VERIFIED";
  report.labels.CANDLE_QUALITY_VERIFIED = dry.body?.candleQuality?.strategyReady
    ? "VERIFIED"
    : (dry.body?.candleQuality ? "BLOCKED" : "NOT_VERIFIED");
  report.labels.STRATEGY_ANALYSIS_VERIFIED = dry.body?.dryRun?.strategy ? "VERIFIED" : "BLOCKED";
  report.labels.SIMULATED_DRY_RUN_VERIFIED = dry.body?.ok ? "VERIFIED" : "BLOCKED";
  report.labels.QUANTITY_COMPATIBILITY_VERIFIED =
    status?.pipelineStatus?.quantityCompatibility?.compatible001Lot === true
      ? "VERIFIED"
      : (status?.pipelineStatus?.quantityCompatibility?.compatible001Lot === false
        ? "BLOCKED_NO_COMPATIBLE_INSTRUMENT_FOR_OWNER_LIMIT"
        : "NOT_VERIFIED");
  report.labels.MARGIN_VERIFIED = "NOT_VERIFIED";
  report.labels.DEMO_EXECUTION_AUTHORIZED = "BLOCKED";
  report.labels.DEMO_ORDER_SUBMITTED = "BLOCKED";
  report.labels.DEMO_FILL_CONFIRMED = "BLOCKED";
  report.labels.SL_TP_CONFIRMED = "BLOCKED";
  report.labels.PNL_VERIFIED = "BLOCKED";
  report.labels.CONTINUOUS_WORKER_VERIFIED = "NOT_VERIFIED";

  if (marketClosed) {
    report.blockers.push("MARKET_CLOSED_REPEAT_LIVE_CHECKS_WHEN_OPEN");
  } else if (!genuine) {
    report.blockers.push("NO_GENUINE_PRICE_CHANGE_OBSERVED");
  }

  console.log(JSON.stringify(redact(report), null, 2));
  process.exit(report.blockers.some((b) =>
    b === "SHA_MISMATCH"
    || b === "LIVE_CREDENTIALS_CONFIGURED_UNEXPECTED"
    || b === "MUTATES_BROKER_TRUE_UNEXPECTED"
    || b === "ADMIN_FORBIDDEN"
  ) ? 1 : 0);
}

main().catch((err) => {
  console.error(JSON.stringify({
    phase: "4.14B",
    ok: false,
    error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
  }));
  process.exit(1);
});
