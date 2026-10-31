/**
 * Phase 4.13 — VPS / operator READ-ONLY verify:
 * ForexConnect stream status + strategy dry-run (SIMULATED only).
 *
 * - Loads KWIZERA_ADMIN_API_TOKEN via load-operator-env (never prints it).
 * - Never places orders, creates grants, or enables armed_execute.
 * - Distinguishes CONNECTED vs Offers listener vs price-change events.
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
    phase: "4.13",
    base,
    tokenPresent: Boolean(token),
    tokenLength: token ? token.length : 0,
    evidence: {},
    blockers: [],
  };

  const dep = await getJson("/api/deployment");
  report.evidence.deployment = dep.body;
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
    diagnostics: stream.body?.diagnostics ?? null,
  };

  if (!token) {
    report.blockers.push("ADMIN_TOKEN_MISSING");
    report.evidence.strategyDryRun = { skipped: true, reason: "ADMIN_TOKEN_MISSING" };
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(2);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const st = await getJson("/api/forex/automated-trading/status", { headers });
  const backendInstrument = st.body?.status?.selectedEnvState?.selectedInstrument ?? null;
  report.evidence.atStatus = {
    http: st.status,
    selectedEnvironment: st.body?.status?.selectedEnvironment ?? null,
    selectedInstrument: backendInstrument,
    placesOrders: st.body?.status?.placesOrders ?? st.body?.placesOrders ?? null,
  };
  if (st.status === 403) {
    report.blockers.push("ADMIN_FORBIDDEN");
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(3);
  }

  const instrument = backendInstrument;
  if (!instrument) {
    report.blockers.push("NO_MARKET_SELECTED");
    report.evidence.strategyDryRun = { skipped: true, reason: "NO_MARKET_SELECTED" };
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(4);
  }

  const dry = await getJson("/api/forex/automated-trading/strategy-dry-run", {
    method: "POST",
    headers,
    body: JSON.stringify({
      instrument,
      timeframe: "1h",
      includeDeterministicFixtureLifecycle: true,
    }),
  });
  report.evidence.strategyDryRun = {
    http: dry.status,
    ok: dry.body?.ok ?? false,
    mutatesBroker: dry.body?.mutatesBroker ?? dry.body?.dryRun?.mutatesBroker ?? null,
    acknowledgementLabel: dry.body?.acknowledgementLabel ?? dry.body?.dryRun?.acknowledgementLabel ?? null,
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
    candles: dry.body?.dryRun?.candleDiagnostics ?? null,
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
    steps: Array.isArray(dry.body?.dryRun?.steps)
      ? dry.body.dryRun.steps.map((s) => ({ step: s.step, code: s.code, ok: s.ok }))
      : null,
  };

  if (dry.body?.mutatesBroker === true || dry.body?.dryRun?.mutatesBroker === true) {
    report.blockers.push("MUTATES_BROKER_TRUE_UNEXPECTED");
  }

  const genuine = Boolean(dry.body?.feedSnapshot?.realDemoQuotesObserved);
  report.evidence.labels = {
    marketSelection: backendInstrument ? "BACKEND_INSTRUMENT_PRESENT" : "NO_MARKET_SELECTED",
    feed: genuine ? "LIVE_READ_ONLY_VERIFIED_PRICE_CHANGE" : "LIVE_READ_ONLY_VERIFIED_SESSION_ONLY",
    strategy: dry.body?.dryRun?.strategy ? "DRY_RUN_VERIFIED" : "BLOCKED",
    dryRunLifecycle: dry.body?.ok ? "DRY_RUN_VERIFIED" : "BLOCKED",
  };

  console.log(JSON.stringify(redact(report), null, 2));
  process.exit(report.blockers.length ? 1 : 0);
}

main().catch((err) => {
  console.error(JSON.stringify({
    phase: "4.13",
    ok: false,
    error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
  }));
  process.exit(1);
});
