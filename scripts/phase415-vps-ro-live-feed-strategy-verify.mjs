/**
 * Phase 4.15 — VPS READ-ONLY live feed + production strategy dry-run verify.
 * Focus: one explicit instrument end-to-end (no silent XAU default).
 * Never prints tokens; never places orders / grants / armed_execute.
 */
import { existsSync, readFileSync } from "node:fs";
import { loadOperatorEnv } from "./lib/load-operator-env.mjs";

const base = String(process.env.KWIZERA_PROD_BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const expectSha = String(process.env.KWIZERA_EXPECT_SHA || "").trim() || null;
const focusInstrument = String(process.env.KWIZERA_FOCUS_INSTRUMENT || "EUR/USD").trim();
const focusTimeframe = String(process.env.KWIZERA_FOCUS_TIMEFRAME || "15m").trim() || "15m";

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

function norm(s) {
  return String(s ?? "").replace(/\s+/g, "").toUpperCase();
}

async function getJson(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init.headers || {}) },
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

function auditCandles(body) {
  const candles = Array.isArray(body?.candles) ? body.candles : [];
  let duplicateCount = 0;
  let outOfOrderCount = 0;
  let invalidOhlcCount = 0;
  let closedBars = 0;
  let formingBars = 0;
  const seen = new Set();
  let prev = null;
  for (const c of candles) {
    const t = Number(c.time);
    if (seen.has(t)) duplicateCount += 1;
    else seen.add(t);
    if (prev != null && t < prev) outOfOrderCount += 1;
    prev = t;
    const o = Number(c.open);
    const h = Number(c.high);
    const l = Number(c.low);
    const cl = Number(c.close);
    if (!(h >= l && h >= o && h >= cl && l <= o && l <= cl && [o, h, l, cl].every(Number.isFinite))) {
      invalidOhlcCount += 1;
    }
    if (c.closed === false) formingBars += 1;
    else closedBars += 1;
  }
  return {
    provider: body?.provider ?? null,
    symbol: body?.providerSymbol ?? null,
    timeframe: body?.timeframe ?? null,
    priceBasis: body?.priceBasis ?? null,
    returnedBars: candles.length,
    closedBars,
    formingBars,
    duplicateCount,
    outOfOrderCount,
    invalidOhlcCount,
    earliest: candles[0]?.time ?? null,
    latest: candles[candles.length - 1]?.time ?? null,
    strategyReady: closedBars >= 23 && duplicateCount === 0 && outOfOrderCount === 0 && invalidOhlcCount === 0,
  };
}

async function main() {
  const report = {
    phase: "4.15",
    base,
    focusInstrument,
    focusTimeframe,
    tokenPresent: Boolean(token),
    evidence: {},
    blockers: [],
    labels: {},
  };

  const dep = await getJson("/api/deployment");
  report.evidence.deployment = {
    deployedCommit: dep.body?.deployedCommit ?? null,
    result: dep.body?.result ?? null,
    verifiedLive: dep.body?.verifiedLive ?? null,
  };
  if (expectSha && dep.body?.deployedCommit
    && !String(dep.body.deployedCommit).startsWith(expectSha.slice(0, 7))) {
    report.blockers.push(`SHA_MISMATCH expected ${expectSha} got ${dep.body.deployedCommit}`);
  }

  const fc = await getJson("/api/forex/providers/forexconnect/status");
  report.evidence.forexconnect = {
    status: fc.body?.status ?? null,
    environment: fc.body?.environment ?? null,
    trading: fc.body?.trading ?? null,
    liveConfigured: fc.body?.profiles?.profiles?.live?.configured ?? null,
    demoConfigured: fc.body?.profiles?.profiles?.demo?.configured ?? null,
    subscriptions: fc.body?.subscriptions ?? null,
    subscriptionCount: fc.body?.subscriptionCount ?? null,
    offersListenerActive: fc.body?.offersListenerActive ?? null,
    streamUpdateCount: fc.body?.streamUpdateCount ?? null,
    lastQuoteAt: fc.body?.lastQuoteAt ?? null,
  };
  if (fc.body?.profiles?.profiles?.live?.configured) {
    report.blockers.push("LIVE_CREDENTIALS_CONFIGURED_UNEXPECTED");
  }
  if (String(fc.body?.trading ?? "").toUpperCase() !== "DISABLED") {
    report.blockers.push("TRADING_NOT_DISABLED");
  }

  const stream = await getJson("/api/forex/providers/forexconnect/stream/status");
  const d = stream.body?.diagnostics ?? {};
  report.evidence.stream = {
    sessionStatus: stream.body?.sessionStatus ?? null,
    streamState: stream.body?.streamState ?? null,
    offersListenerActive: stream.body?.offersListenerActive ?? null,
    subscriptions: stream.body?.subscriptions ?? null,
    updateCount: stream.body?.updateCount ?? null,
    lastQuoteAt: stream.body?.lastQuoteAt ?? null,
    lastReceiptAt: stream.body?.lastReceiptAt ?? null,
    offersSnapshotCount: stream.body?.offersSnapshotCount ?? null,
    pollCycles: d.pollCycles ?? null,
    pollChanges: d.pollChanges ?? null,
    callbackInvocations: d.callbackInvocations ?? null,
    callbackAccepted: d.callbackAccepted ?? null,
    callbackFiltered: d.callbackFiltered ?? null,
    lifecycleState: stream.body?.lifecycle?.lifecycleState ?? null,
  };

  const quotes = await getJson("/api/forex/providers/forexconnect/quotes");
  const focusQuote = Array.isArray(quotes.body?.quotes)
    ? quotes.body.quotes.find((q) => norm(q.providerSymbol) === norm(focusInstrument))
    : null;
  report.evidence.focusQuote = focusQuote
    ? {
      provider: focusQuote.provider,
      providerSymbol: focusQuote.providerSymbol,
      bid: focusQuote.bid,
      ask: focusQuote.ask,
      spread: Number.isFinite(focusQuote.ask) && Number.isFinite(focusQuote.bid)
        ? focusQuote.ask - focusQuote.bid
        : null,
      tradingStatus: focusQuote.tradingStatus,
      eventSource: focusQuote.eventSource,
      sourceTimestampMs: focusQuote.sourceTimestampMs,
      receivedAtMs: focusQuote.receivedAtMs,
    }
    : null;

  const subList = Array.isArray(stream.body?.subscriptions) ? stream.body.subscriptions : [];
  const subscribed = subList.some((s) => norm(s) === norm(focusInstrument));
  report.labels.SUBSCRIPTION_VERIFIED = subscribed ? "VERIFIED" : "BLOCKED";
  if (!subscribed) report.blockers.push(`FOCUS_INSTRUMENT_NOT_SUBSCRIBED:${focusInstrument}`);

  report.labels.SNAPSHOT_VERIFIED = focusQuote
    && Number(focusQuote.bid) > 0
    && Number(focusQuote.ask) >= Number(focusQuote.bid)
    ? "VERIFIED"
    : "BLOCKED";

  const updateCount = Number(stream.body?.updateCount ?? 0) || 0;
  const pollChanges = Number(d.pollChanges ?? 0) || 0;
  const callbackAccepted = Number(d.callbackAccepted ?? 0) || 0;
  const genuine = updateCount > 0 && (pollChanges > 0 || callbackAccepted > 0) && Boolean(stream.body?.lastQuoteAt);
  report.labels.LIVE_PRICE_CHANGE_VERIFIED = genuine
    ? "VERIFIED"
    : (String(stream.body?.streamState ?? "").includes("INACTIVE")
      || String(stream.body?.streamState ?? "") === "NO_RECENT_MARKET_UPDATES"
      ? "BLOCKED_NO_RECENT_OR_INACTIVE"
      : "BLOCKED_NO_GENUINE_PRICE_CHANGE");
  if (!genuine) {
    report.blockers.push("NO_SUSTAINED_GENUINE_PRICE_CHANGE");
  }

  const histPrimary = await getJson(
    `/api/forex/providers/forexconnect/candles?symbol=${encodeURIComponent(focusInstrument)}&timeframe=${encodeURIComponent(focusTimeframe)}&limit=120`,
  );
  const histAlt = await getJson(
    `/api/forex/providers/forexconnect/candles?symbol=${encodeURIComponent(focusInstrument)}&timeframe=1h&limit=40`,
  );
  report.evidence.history = {
    primary: auditCandles(histPrimary.body),
    alternate: auditCandles(histAlt.body),
  };
  report.labels.HISTORICAL_DATA_VERIFIED =
    report.evidence.history.primary.returnedBars > 0
    && norm(report.evidence.history.primary.symbol) === norm(focusInstrument)
      ? "VERIFIED"
      : "BLOCKED";
  report.labels.CANDLE_QUALITY_VERIFIED = report.evidence.history.primary.strategyReady
    ? "VERIFIED"
    : "BLOCKED";

  if (!token) {
    report.blockers.push("ADMIN_TOKEN_MISSING");
    report.labels.MARKET_SELECTION_VERIFIED = "NOT_VERIFIED_ADMIN";
    report.labels.PRODUCTION_STRATEGY_DRY_RUN_VERIFIED = "BLOCKED_ADMIN_TOKEN_MISSING";
    report.labels.WORKER_MONITORING_VERIFIED = "NOT_VERIFIED_ADMIN";
    report.labels.CONTINUOUS_WORKER_VERIFIED = "NOT_VERIFIED";
    report.labels.QUOTE_TRANSPORT_VERIFIED = genuine && report.labels.SNAPSHOT_VERIFIED === "VERIFIED"
      ? "PARTIAL_PUBLIC_PATH"
      : "NOT_VERIFIED";
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(report.blockers.some((b) => b.startsWith("SHA_") || b.includes("LIVE_")) ? 1 : 0);
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
    backendInstrument,
    feedPipelineState: status?.feedStatusBreakdown?.pipelineState ?? null,
    pipelineStages: Array.isArray(status?.pipelineStages)
      ? status.pipelineStages.map((s) => ({ id: s.id, verdict: s.verdict, code: s.code }))
      : null,
    placesOrders: status?.placesOrders ?? false,
    masterEnable: status?.controls?.masterEnable ?? null,
    emergencyEntryLock: status?.controls?.emergencyEntryLock ?? null,
  };

  if (st.status === 403) {
    report.blockers.push("ADMIN_FORBIDDEN");
    report.labels.PRODUCTION_STRATEGY_DRY_RUN_VERIFIED = "BLOCKED_ADMIN_FORBIDDEN";
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(3);
  }

  if (!backendInstrument) {
    report.blockers.push("NO_MARKET_SELECTED");
    report.labels.MARKET_SELECTION_VERIFIED = "BLOCKED";
  } else if (norm(backendInstrument) !== norm(focusInstrument)) {
    report.blockers.push(
      `INSTRUMENT_MISMATCH backend=${backendInstrument} focus=${focusInstrument}`,
    );
    report.labels.MARKET_SELECTION_VERIFIED = "BLOCKED_MISMATCH";
  } else {
    report.labels.MARKET_SELECTION_VERIFIED = "VERIFIED";
  }

  // Stop dry-run on mismatch per phase instructions.
  if (report.labels.MARKET_SELECTION_VERIFIED !== "VERIFIED") {
    report.labels.PRODUCTION_STRATEGY_DRY_RUN_VERIFIED = "BLOCKED_SELECTION";
    report.evidence.strategyDryRun = { skipped: true, reason: report.labels.MARKET_SELECTION_VERIFIED };
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(4);
  }

  // Ensure focus instrument is selected + subscribed (idempotent).
  const setInst = await getJson("/api/forex/automated-trading/instrument", {
    method: "POST",
    headers,
    body: JSON.stringify({
      environment: status?.selectedEnvironment ?? "DEMO",
      instrument: focusInstrument,
      expectedEnvironmentEpoch: status?.environmentEpoch,
      timeframe: focusTimeframe,
    }),
  });
  report.evidence.setInstrument = {
    http: setInst.status,
    ok: setInst.body?.ok ?? false,
    subscription: setInst.body?.subscription
      ? {
        confirmed: setInst.body.subscription.confirmed,
        code: setInst.body.subscription.code,
        message: setInst.body.subscription.message,
      }
      : null,
  };

  const dry = await getJson("/api/forex/automated-trading/strategy-dry-run", {
    method: "POST",
    headers,
    body: JSON.stringify({
      instrument: focusInstrument,
      timeframe: focusTimeframe,
      includeDeterministicFixtureLifecycle: false,
    }),
  });

  const dryInstrument = dry.body?.feedSnapshot?.instrument
    ?? dry.body?.dryRun?.instrument
    ?? null;
  report.evidence.strategyDryRun = {
    http: dry.status,
    ok: dry.body?.ok ?? false,
    mutatesBroker: dry.body?.mutatesBroker ?? dry.body?.dryRun?.mutatesBroker ?? null,
    usedDeterministicFixture: dry.body?.dryRun?.usedDeterministicFixture ?? null,
    instrument: dryInstrument,
    strategy: dry.body?.dryRun?.strategy
      ? {
        code: dry.body.dryRun.strategy.code,
        direction: dry.body.dryRun.strategy.direction,
        strategyId: dry.body.dryRun.strategy.strategyId,
        fastSma: dry.body.dryRun.strategy.fastSma,
        slowSma: dry.body.dryRun.strategy.slowSma,
        atr: dry.body.dryRun.strategy.atr,
        closedCandleOpenSec: dry.body.dryRun.strategy.closedCandleOpenSec,
        reasons: (dry.body.dryRun.strategy.reasons || []).slice(0, 4),
      }
      : null,
    candleQuality: dry.body?.candleQuality ?? null,
    feed: dry.body?.feedSnapshot
      ? {
        bid: dry.body.feedSnapshot.bid,
        ask: dry.body.feedSnapshot.ask,
        feedStatus: dry.body.feedSnapshot.feedStatus,
        tradingStatus: dry.body.feedSnapshot.tradingStatus,
        quoteFresh: dry.body.feedSnapshot.quoteFresh,
        reasonCode: dry.body.feedSnapshot.reasonCode,
        realDemoQuotesObserved: dry.body.feedSnapshot.realDemoQuotesObserved,
        breakdown: dry.body.feedSnapshot.breakdown ?? null,
      }
      : null,
  };

  if (dry.body?.mutatesBroker === true || dry.body?.dryRun?.mutatesBroker === true) {
    report.blockers.push("MUTATES_BROKER_TRUE_UNEXPECTED");
  }
  if (dry.body?.dryRun?.usedDeterministicFixture === true) {
    report.blockers.push("FIXTURE_USED_IN_PRODUCTION_VERIFY");
  }
  if (dryInstrument && norm(dryInstrument) !== norm(focusInstrument)) {
    report.blockers.push(`DRY_RUN_INSTRUMENT_MISMATCH:${dryInstrument}`);
  }

  report.labels.PRODUCTION_STRATEGY_DRY_RUN_VERIFIED =
    dry.body?.ok && norm(dryInstrument) === norm(focusInstrument) && dry.body?.dryRun?.usedDeterministicFixture !== true
      ? "VERIFIED"
      : "BLOCKED";

  report.labels.QUOTE_TRANSPORT_VERIFIED = genuine
    && report.labels.SNAPSHOT_VERIFIED === "VERIFIED"
    && dry.body?.feedSnapshot?.breakdown
      ? "VERIFIED"
      : (report.labels.SNAPSHOT_VERIFIED === "VERIFIED" ? "PARTIAL" : "NOT_VERIFIED");

  const mon = status?.automation ?? status?.monitor ?? null;
  report.evidence.worker = {
    lifecycle: mon?.lifecycle ?? status?.pipelineStatus?.phase ?? null,
    recoveryStatus: mon?.recoveryStatus ?? null,
    marketMonitoring: mon?.marketMonitoring ?? null,
    note: "Admin status fields only; continuous ticks require repeated observation.",
  };
  report.labels.WORKER_MONITORING_VERIFIED = mon ? "PARTIAL" : "NOT_VERIFIED";
  report.labels.CONTINUOUS_WORKER_VERIFIED = "NOT_VERIFIED";

  console.log(JSON.stringify(redact(report), null, 2));
  const hardFail = report.blockers.some((b) =>
    b.startsWith("SHA_")
    || b.includes("LIVE_CREDENTIALS")
    || b.includes("MUTATES_BROKER")
    || b === "ADMIN_FORBIDDEN"
    || b === "FIXTURE_USED_IN_PRODUCTION_VERIFY"
  );
  process.exit(hardFail ? 1 : 0);
}

main().catch((err) => {
  console.error(JSON.stringify({
    phase: "4.15",
    ok: false,
    error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
  }));
  process.exit(1);
});
