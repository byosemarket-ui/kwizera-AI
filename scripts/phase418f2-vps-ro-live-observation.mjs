/**
 * Phase 4.18F.2.1 — VPS READ-ONLY live ForexConnect observation while market is open.
 *
 * Multi-sample observation: distinguishes CONNECTED / SUBSCRIBED / SNAPSHOT vs genuine
 * bid/ask changes. Never prints tokens. Never places orders / grants / armed_execute.
 * Does not call OpenAI (that is F.2.6).
 */
import { existsSync, readFileSync } from "node:fs";
import { loadOperatorEnv } from "./lib/load-operator-env.mjs";

const base = String(process.env.KWIZERA_PROD_BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const expectSha = String(process.env.KWIZERA_EXPECT_SHA || "").trim() || null;
const observeSeconds = Math.max(30, Math.min(300, Number(process.env.KWIZERA_OBSERVE_SECONDS || 90) || 90));
const sampleMs = Math.max(1000, Math.min(15000, Number(process.env.KWIZERA_SAMPLE_MS || 3000) || 3000));
const focusOverride = String(process.env.KWIZERA_FOCUS_INSTRUMENT || "").trim() || null;

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
  return { status: res.status, body, at: new Date().toISOString() };
}

function classifyInstrument(sample, prev, subscribed, sessionConnected) {
  if (!sessionConnected) return "DISCONNECTED";
  if (!subscribed) return "SUBSCRIPTION_FAILURE";
  if (!sample || !(Number(sample.bid) > 0)) return "SNAPSHOT_AVAILABLE"; // subscribed but no quote yet → waiting
  const ts = String(sample.tradingStatus ?? "").toUpperCase();
  if (ts === "C" || ts === "CLOSED" || ts.includes("CLOSE")) return "MARKET_CLOSED";
  if (prev && Number(prev.bid) === Number(sample.bid) && Number(prev.ask) === Number(sample.ask)) {
    return "SNAPSHOT_AVAILABLE";
  }
  if (prev && (Number(prev.bid) !== Number(sample.bid) || Number(prev.ask) !== Number(sample.ask))) {
    return "GENUINE_PRICE_CHANGES_RECEIVED";
  }
  return "SNAPSHOT_AVAILABLE";
}

async function main() {
  const report = {
    phase: "4.18F.2.2",
    base,
    expectSha,
    observeSeconds,
    sampleMs,
    focusOverride,
    tokenPresent: Boolean(token),
    blockers: [],
    labels: {},
    evidence: {},
    samples: [],
    instrumentOutcomes: {},
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };

  const dep = await getJson("/api/deployment");
  report.evidence.deployment = {
    deployedCommit: dep.body?.deployedCommit ?? null,
    status: dep.body?.status ?? null,
    result: dep.body?.result ?? null,
  };
  if (expectSha && dep.body?.deployedCommit
    && !String(dep.body.deployedCommit).startsWith(expectSha.slice(0, 7))) {
    report.blockers.push(`SHA_MISMATCH expected ${expectSha} got ${dep.body.deployedCommit}`);
  }

  const fc0 = await getJson("/api/forex/providers/forexconnect/status");
  report.evidence.forexconnect = {
    status: fc0.body?.status ?? null,
    environment: fc0.body?.environment ?? null,
    trading: fc0.body?.trading ?? null,
    sidecarReachable: fc0.body?.sidecarReachable ?? null,
    offersListenerActive: fc0.body?.offersListenerActive ?? null,
    subscriptionCount: fc0.body?.subscriptionCount ?? null,
    subscriptions: fc0.body?.subscriptions ?? null,
    liveConfigured: fc0.body?.profiles?.profiles?.live?.configured ?? null,
    demoConfigured: fc0.body?.profiles?.profiles?.demo?.configured ?? null,
  };
  if (fc0.body?.profiles?.profiles?.live?.configured) {
    report.blockers.push("LIVE_CREDENTIALS_CONFIGURED_UNEXPECTED");
  }
  if (String(fc0.body?.trading ?? "").toUpperCase() !== "DISABLED") {
    report.blockers.push("TRADING_NOT_DISABLED");
  }

  let focusInstrument = focusOverride;
  let headers = null;
  if (token) {
    headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const st = await getJson("/api/forex/automated-trading/status", { headers });
    if (st.status === 403) {
      report.blockers.push("ADMIN_FORBIDDEN");
    } else {
      const selected = st.body?.status?.selectedEnvState?.selectedInstrument
        ?? st.body?.status?.selectedInstrument
        ?? null;
      report.evidence.atStatus = {
        http: st.status,
        selectedEnvironment: st.body?.status?.selectedEnvironment ?? null,
        selectedInstrument: selected,
        feedPipelineState: st.body?.status?.feedStatusBreakdown?.pipelineState ?? null,
        placesOrders: st.body?.status?.placesOrders ?? st.body?.placesOrders ?? null,
        masterEnable: st.body?.status?.controls?.masterEnable ?? null,
        emergencyEntryLock: st.body?.status?.controls?.emergencyEntryLock ?? null,
      };
      if (!focusInstrument && selected) focusInstrument = String(selected);
      if (selected && focusInstrument && norm(selected) !== norm(focusInstrument)) {
        // Align subscription to focus for observation (RO instrument select — no orders).
        const setInst = await getJson("/api/forex/automated-trading/instrument", {
          method: "POST",
          headers,
          body: JSON.stringify({
            environment: st.body?.status?.selectedEnvironment ?? "DEMO",
            instrument: focusInstrument,
            expectedEnvironmentEpoch: st.body?.status?.environmentEpoch,
            timeframe: "1m",
          }),
        });
        report.evidence.setInstrument = {
          http: setInst.status,
          ok: setInst.body?.ok ?? false,
          confirmed: setInst.body?.subscription?.confirmed ?? null,
          code: setInst.body?.subscription?.code ?? null,
        };
      }
    }
  } else {
    report.blockers.push("BLOCKED_AUTHENTICATION");
  }

  if (!focusInstrument) {
    const subs = Array.isArray(fc0.body?.subscriptions) ? fc0.body.subscriptions : [];
    focusInstrument = subs[0] || "EUR/USD";
  }
  report.focusInstrument = focusInstrument;

  /** @type {Map<string, {bid:number,ask:number,at:string}>} */
  const lastQuote = new Map();
  /** @type {Record<string, {genuineChanges:number, identicalSamples:number, samples:number, first:object|null, last:object|null, states:string[]}>} */
  const trackers = {};
  const ensure = (sym) => {
    if (!trackers[sym]) {
      trackers[sym] = {
        genuineChanges: 0,
        identicalSamples: 0,
        samples: 0,
        first: null,
        last: null,
        states: [],
      };
    }
    return trackers[sym];
  };

  const deadline = Date.now() + observeSeconds * 1000;
  let sampleIndex = 0;
  let prevUpdateCount = null;
  let prevPollChanges = null;
  let prevCallbackAccepted = null;

  while (Date.now() < deadline) {
    sampleIndex += 1;
    const [stream, quotes, fc] = await Promise.all([
      getJson("/api/forex/providers/forexconnect/stream/status"),
      getJson("/api/forex/providers/forexconnect/quotes"),
      getJson("/api/forex/providers/forexconnect/status"),
    ]);
    const d = stream.body?.diagnostics ?? {};
    const updateCount = Number(stream.body?.updateCount ?? 0) || 0;
    const pollChanges = Number(d.pollChanges ?? 0) || 0;
    const callbackAccepted = Number(d.callbackAccepted ?? 0) || 0;
    const sessionConnected = String(fc.body?.status ?? stream.body?.sessionStatus ?? "").toUpperCase() === "CONNECTED"
      || String(stream.body?.sessionStatus ?? "").toUpperCase() === "CONNECTED";
    const subs = Array.isArray(stream.body?.subscriptions)
      ? stream.body.subscriptions
      : (Array.isArray(fc.body?.subscriptions) ? fc.body.subscriptions : []);
    const quoteRows = Array.isArray(quotes.body?.quotes) ? quotes.body.quotes : [];

    const delta = {
      updateCountDelta: prevUpdateCount == null ? null : updateCount - prevUpdateCount,
      pollChangesDelta: prevPollChanges == null ? null : pollChanges - prevPollChanges,
      callbackAcceptedDelta: prevCallbackAccepted == null ? null : callbackAccepted - prevCallbackAccepted,
    };
    prevUpdateCount = updateCount;
    prevPollChanges = pollChanges;
    prevCallbackAccepted = callbackAccepted;

    const sampleQuotes = [];
    for (const q of quoteRows) {
      const sym = String(q.providerSymbol ?? q.symbol ?? "");
      if (!sym) continue;
      const bid = Number(q.bid);
      const ask = Number(q.ask);
      const row = {
        symbol: sym,
        bid: Number.isFinite(bid) ? bid : null,
        ask: Number.isFinite(ask) ? ask : null,
        mid: Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : null,
        spread: Number.isFinite(bid) && Number.isFinite(ask) ? ask - bid : null,
        tradingStatus: q.tradingStatus ?? null,
        eventSource: q.eventSource ?? null,
        sourceTimestampMs: q.sourceTimestampMs ?? null,
        receivedAtMs: q.receivedAtMs ?? null,
      };
      sampleQuotes.push(row);
      const t = ensure(sym);
      t.samples += 1;
      const prev = lastQuote.get(norm(sym));
      const subscribed = subs.some((s) => norm(s) === norm(sym));
      let eventClass = "INITIAL_SNAPSHOT";
      if (!prev) {
        eventClass = "INITIAL_SNAPSHOT";
        t.first = { ...row, at: stream.at };
      } else if (prev.bid === row.bid && prev.ask === row.ask) {
        eventClass = "IDENTICAL_SNAPSHOT_OR_HEARTBEAT";
        t.identicalSamples += 1;
      } else if (prev.bid !== row.bid && prev.ask !== row.ask) {
        eventClass = "BID_ASK_CHANGE";
        t.genuineChanges += 1;
      } else if (prev.bid !== row.bid) {
        eventClass = "BID_CHANGE";
        t.genuineChanges += 1;
      } else {
        eventClass = "ASK_CHANGE";
        t.genuineChanges += 1;
      }
      const state = classifyInstrument(row, prev, subscribed, sessionConnected);
      if (eventClass.endsWith("_CHANGE")) {
        // upgrade state
      }
      t.states.push(state);
      t.last = {
        ...row,
        at: stream.at,
        eventClass,
        prevBid: prev?.bid ?? null,
        prevAsk: prev?.ask ?? null,
      };
      if (row.bid != null && row.ask != null) {
        lastQuote.set(norm(sym), { bid: row.bid, ask: row.ask, at: stream.at });
      }
    }

    // Focus instrument may be subscribed but missing from quotes briefly.
    const focusRow = sampleQuotes.find((q) => norm(q.symbol) === norm(focusInstrument)) ?? null;
    const focusSubscribed = subs.some((s) => norm(s) === norm(focusInstrument));

    report.samples.push({
      index: sampleIndex,
      at: stream.at,
      sessionStatus: stream.body?.sessionStatus ?? fc.body?.status ?? null,
      streamState: stream.body?.streamState ?? null,
      offersListenerActive: stream.body?.offersListenerActive ?? fc.body?.offersListenerActive ?? null,
      subscriptionCount: subs.length,
      subscriptions: subs,
      updateCount,
      lastQuoteAt: stream.body?.lastQuoteAt ?? null,
      lastReceiptAt: stream.body?.lastReceiptAt ?? null,
      offersSnapshotCount: stream.body?.offersSnapshotCount ?? null,
      diagnostics: {
        pollCycles: d.pollCycles ?? null,
        pollChanges,
        callbackInvocations: d.callbackInvocations ?? null,
        callbackAccepted,
        callbackFiltered: d.callbackFiltered ?? null,
        lastPollChangeAt: d.lastPollChangeAt ?? null,
        lastPollHeartbeatAt: d.lastPollHeartbeatAt ?? null,
      },
      delta,
      focus: focusRow
        ? { ...focusRow, subscribed: focusSubscribed }
        : { symbol: focusInstrument, subscribed: focusSubscribed, missingFromQuotes: true },
      quoteCount: sampleQuotes.length,
    });

    await sleep(sampleMs);
  }

  for (const [sym, t] of Object.entries(trackers)) {
    const genuine = t.genuineChanges > 0;
    const subscribed = (report.samples.at(-1)?.subscriptions ?? []).some((s) => norm(s) === norm(sym));
    let outcome = "WAITING_FOR_GENUINE_MARKET_UPDATES";
    if (genuine) outcome = "LIVE_PRICE_UPDATES_CONFIRMED";
    else if (!subscribed) outcome = "SUBSCRIPTION_FAILURE";
    else if (t.samples > 0 && t.first) outcome = "WAITING_FOR_GENUINE_MARKET_UPDATES";
    else outcome = "SNAPSHOT_AVAILABLE";

    report.instrumentOutcomes[sym] = {
      outcome,
      genuineChanges: t.genuineChanges,
      identicalSamples: t.identicalSamples,
      samples: t.samples,
      first: t.first,
      last: t.last,
      netBidMove: t.first && t.last && t.first.bid != null && t.last.bid != null
        ? t.last.bid - t.first.bid
        : null,
      netAskMove: t.first && t.last && t.first.ask != null && t.last.ask != null
        ? t.last.ask - t.first.ask
        : null,
    };
  }

  const focusOutcome = report.instrumentOutcomes[focusInstrument]
    ?? Object.entries(report.instrumentOutcomes).find(([k]) => norm(k) === norm(focusInstrument))?.[1]
    ?? null;

  const anyGenuine = Object.values(report.instrumentOutcomes).some((o) => o.genuineChanges > 0);
  const focusGenuine = Boolean(focusOutcome?.genuineChanges > 0);
  const lastSample = report.samples.at(-1) ?? null;
  const streamGrew = report.samples.some((s) => (s.delta?.updateCountDelta ?? 0) > 0
    || (s.delta?.pollChangesDelta ?? 0) > 0
    || (s.delta?.callbackAcceptedDelta ?? 0) > 0);

  report.labels.SESSION = lastSample?.sessionStatus
    ? (String(lastSample.sessionStatus).toUpperCase() === "CONNECTED" ? "CONNECTED" : String(lastSample.sessionStatus))
    : "UNKNOWN";
  report.labels.OFFERS_LISTENER = lastSample?.offersListenerActive === true ? "ACTIVE" : "INACTIVE_OR_UNKNOWN";
  report.labels.FOCUS_SUBSCRIBED = lastSample?.focus?.subscribed ? "SUBSCRIBED" : "NOT_SUBSCRIBED";
  report.labels.FOCUS_SNAPSHOT = focusOutcome?.first ? "SNAPSHOT_AVAILABLE" : "NO_SNAPSHOT";
  report.labels.LIVE_OBSERVATION = focusGenuine
    ? "LIVE_PRICE_UPDATES_CONFIRMED"
    : (anyGenuine ? "LIVE_ON_OTHER_INSTRUMENT_ONLY" : "WAITING_FOR_GENUINE_MARKET_UPDATES");
  report.labels.STREAM_COUNTERS_MOVED = streamGrew ? "YES" : "NO";
  report.labels.OPENAI = "NOT_RUN_IN_F2_1";

  // Phase 4.18F.2.2 — probe genuine tick store + movement windows (read-only).
  const tickHealth = await getJson("/api/forex/providers/forexconnect/genuine-ticks/health");
  const tickLatest = await getJson(
    `/api/forex/providers/forexconnect/genuine-ticks/latest?symbol=${encodeURIComponent(focusInstrument)}`,
  );
  const tickWindows = await getJson(
    `/api/forex/providers/forexconnect/genuine-ticks/windows?symbol=${encodeURIComponent(focusInstrument)}`,
  );
  report.evidence.tickCapture = {
    healthHttp: tickHealth.status,
    healthOk: tickHealth.body?.ok ?? false,
    counters: tickHealth.body?.counters ?? null,
    instrumentCount: tickHealth.body?.instrumentCount ?? null,
    placesOrders: tickHealth.body?.placesOrders ?? null,
    mutatesBroker: tickHealth.body?.mutatesBroker ?? null,
    latestHttp: tickLatest.status,
    latest: tickLatest.body?.latest
      ? {
        bid: tickLatest.body.latest.bid,
        ask: tickLatest.body.latest.ask,
        mid: tickLatest.body.latest.mid,
        spread: tickLatest.body.latest.spread,
        eventClass: tickLatest.body.latest.eventClass,
        source: tickLatest.body.latest.source,
        receiptTimestampMs: tickLatest.body.latest.receiptTimestampMs,
        eventTimestampMs: tickLatest.body.latest.eventTimestampMs,
      }
      : null,
    windowsHttp: tickWindows.status,
    windows: Array.isArray(tickWindows.body?.windows)
      ? tickWindows.body.windows.map((w) => ({
        windowId: w.windowId,
        genuineTickCount: w.genuineTickCount,
        direction: w.direction,
        midPriceMovement: w.midPriceMovement,
        status: w.status,
        freshness: w.freshness,
        currentSpread: w.currentSpread,
      }))
      : [],
  };
  const persisted = Number(tickHealth.body?.counters?.accepted ?? 0);
  const windowTicks = (report.evidence.tickCapture.windows || [])
    .reduce((n, w) => n + Number(w.genuineTickCount || 0), 0);
  if (tickHealth.status === 404) {
    report.blockers.push("TICK_CAPTURE_API_MISSING");
  } else if (anyGenuine && persisted <= 0 && windowTicks <= 0) {
    report.blockers.push("GENUINE_QUOTES_SEEN_BUT_TICK_STORE_EMPTY");
  }
  report.labels.TICK_CAPTURE = persisted > 0 || windowTicks > 0
    ? "GENUINE_TICKS_PERSISTED"
    : (anyGenuine ? "WAITING_FOR_TICK_PERSISTENCE" : "WAITING_FOR_GENUINE_MARKET_UPDATES");
  report.labels.MOVEMENT_WINDOWS = windowTicks > 0
    ? "WINDOWS_FROM_GENUINE_TICKS"
    : "NO_GENUINE_TICKS";

  report.evidence.summary = {
    sampleCount: report.samples.length,
    instrumentsTracked: Object.keys(report.instrumentOutcomes).length,
    anyGenuinePriceChanges: anyGenuine,
    focusGenuinePriceChanges: focusGenuine,
    focusOutcome: focusOutcome?.outcome ?? null,
    focusGenuineChanges: focusOutcome?.genuineChanges ?? 0,
    tickAccepted: tickHealth.body?.counters?.accepted ?? null,
    tickFiltered: tickHealth.body?.counters?.filtered ?? null,
    tickPersisted: tickHealth.body?.counters?.persisted ?? null,
    tickDuplicates: tickHealth.body?.counters?.duplicates ?? null,
  };

  report.phase = "4.18F.2.2";

  if (!anyGenuine && !streamGrew) {
    report.blockers.push("NO_GENUINE_PRICE_CHANGES_DURING_OBSERVATION");
  }
  if (report.labels.FOCUS_SUBSCRIBED !== "SUBSCRIBED") {
    report.blockers.push("FOCUS_NOT_SUBSCRIBED");
  }

  // Soft exit: observation success = script ran and produced evidence.
  // Hard fail only on safety / auth / sha issues. Live absence is reported, not faked.
  const hard = report.blockers.filter((b) =>
    b === "LIVE_CREDENTIALS_CONFIGURED_UNEXPECTED"
    || b === "TRADING_NOT_DISABLED"
    || b === "ADMIN_FORBIDDEN"
    || String(b).startsWith("SHA_MISMATCH")
  );

  console.log(JSON.stringify(redact(report), null, 2));
  process.exit(hard.length ? 1 : 0);
}

main().catch((err) => {
  console.error(JSON.stringify({
    phase: "4.18F.2.2",
    ok: false,
    error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
  }));
  process.exit(1);
});
