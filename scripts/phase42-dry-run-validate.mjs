/**
 * Phase 4.2 local dry-run validation against saved DEMO 15m candles.
 * Read-only. Does not mutate broker state.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Use tsx register via dynamic import of .ts through next line — run with: npx tsx scripts/phase42-dry-run-validate.mjs
// Prefer importing compiled-path aliases via tsx:
const evaluateMod = await import("../ai/forex-ai/automated-trading/auto-engine/strategy/evaluate.ts");
const rulesMod = await import("../ai/forex-ai/automated-trading/auto-engine/strategy/rules.ts");
const engineMod = await import("../ai/forex-ai/automated-trading/auto-engine/signals/engine.ts");
const storeMod = await import("../ai/forex-ai/automated-trading/auto-engine/signals/store.ts");
const reconcileMod = await import("../ai/forex-ai/automated-trading/auto-engine/position-monitor/reconcile.ts");
const dailyMod = await import("../ai/forex-ai/automated-trading/auto-engine/daily-risk/compute.ts");
const prepareMod = await import("../ai/forex-ai/automated-trading/auto-engine/orchestration/prepare-entry.ts");

const { evaluateSmaCrossoverStrategy, atrAt, backtestSmaCrossover } = evaluateMod;
const { SMA_CROSSOVER_RULES } = rulesMod;
const { generateAutoSignal } = engineMod;
const { AutoSignalStore } = storeMod;
const { reconcilePositions } = reconcileMod;
const { computeDailyRiskSnapshot } = dailyMod;
const { prepareAutoEntryFromSignal } = prepareMod;

const candlePath = path.join(process.env.TEMP || os.tmpdir(), "kw-xau-15m.json");
const candleText = fs.readFileSync(candlePath, "utf8").replace(/^\uFEFF/, "");
const raw = JSON.parse(candleText);
const candles = (raw.candles || []).map((c) => ({
  time: c.time,
  open: c.open,
  high: c.high,
  low: c.low,
  close: c.close,
  closed: c.closed !== false,
}));

const closed = candles.filter((c) => c.closed !== false);
console.log(
  JSON.stringify(
    {
      candleCount: candles.length,
      closedCount: closed.length,
      lastClosed: closed.slice(-1)[0],
      environment: raw.environment,
      timeframe: raw.timeframe,
      strategyId: SMA_CROSSOVER_RULES.strategyId,
    },
    null,
    2,
  ),
);

const pointSize = 0.01;
const ev = evaluateSmaCrossoverStrategy({ candles, pointSize });
console.log(
  "EVAL",
  JSON.stringify(
    {
      ok: ev.ok,
      direction: ev.direction,
      code: ev.code,
      entry: ev.entryPrice,
      sl: ev.stopLoss,
      tp: ev.takeProfit,
      atr: ev.atr,
      fast: ev.fastSma,
      slow: ev.slowSma,
      conf: ev.confidencePct,
      closedSec: ev.closedCandleOpenSec,
    },
    null,
    2,
  ),
);

const closes = closed.map((c) => c.close);
const highs = closed.map((c) => c.high);
const lows = closed.map((c) => c.low);
const i = closed.length - 1;
function sma(vals, len, end) {
  let s = 0;
  for (let k = end - len + 1; k <= end; k++) s += vals[k];
  return s / len;
}
const fastIndep = sma(closes, 9, i);
const slowIndep = sma(closes, 21, i);
const atrIndep = atrAt(highs, lows, closes, 14, i);
console.log(
  "INDEP",
  JSON.stringify({
    fastIndep,
    slowIndep,
    atrIndep,
    fastMatch: Math.abs((ev.fastSma ?? NaN) - fastIndep) < 1e-12,
    slowMatch: Math.abs((ev.slowSma ?? NaN) - slowIndep) < 1e-12,
    atrMatch: Math.abs((ev.atr ?? NaN) - (atrIndep ?? NaN)) < 1e-12,
  }),
);

if (ev.direction === "BUY" || ev.direction === "SELL") {
  const stopDist = Math.abs(ev.entryPrice - ev.stopLoss);
  const tpDist = Math.abs(ev.takeProfit - ev.entryPrice);
  const expectedStop = Math.max(ev.atr * 1.5, pointSize * 50);
  console.log(
    "GEOMETRY",
    JSON.stringify({
      stopDist,
      expectedStop,
      tpDist,
      r: tpDist / stopDist,
      stopOk: Math.abs(stopDist - expectedStop) < 1e-9,
      tpIs2R: Math.abs(tpDist / stopDist - 2) < 1e-9,
    }),
  );
}

const replay = backtestSmaCrossover({ candles: closed, pointSize });
console.log(
  "REPLAY",
  JSON.stringify({
    signalCount: replay.signals.length,
    last3: replay.signals.slice(-3),
    note: replay.note,
  }),
);

// Multi-window dry ticks: evaluate last N closed windows without fabricating direction
const windows = [];
for (const end of [closed.length, Math.max(23, closed.length - 5), Math.max(23, closed.length - 10)]) {
  const slice = closed.slice(0, end);
  const w = evaluateSmaCrossoverStrategy({ candles: slice, pointSize });
  windows.push({
    end,
    direction: w.direction,
    code: w.code,
    fast: w.fastSma,
    slow: w.slowSma,
    atr: w.atr,
  });
}
console.log("WINDOWS", JSON.stringify(windows, null, 2));

const storePath = path.join(os.tmpdir(), "kw-phase42-signals.json");
try {
  fs.unlinkSync(storePath);
} catch {
  /* ignore */
}
const store = new AutoSignalStore(storePath);
const nowMs = Date.now();

// Force a directional series only for duplicate/stale regression, separate from live eval above
function makeTrendCandles(n, start = 100) {
  const out = [];
  let px = start;
  for (let j = 0; j < n; j++) {
    const drift = j < n - 5 ? 0.02 : 0.8;
    const open = px;
    const close = px + drift;
    out.push({
      time: 1_700_000_000 + j * 900,
      open,
      high: Math.max(open, close) + 0.1,
      low: Math.min(open, close) - 0.1,
      close,
      closed: true,
    });
    px = close;
  }
  return out;
}

const trend = makeTrendCandles(40);
const sig1 = generateAutoSignal({
  instrument: "XAU/USD",
  timeframe: "15m",
  candles: trend,
  pointSize,
  quoteAgeMs: 500,
  store,
  sessionUtcStartMinute: 0,
  sessionUtcEndMinute: 24 * 60,
  nowMs,
});
const sig2 = generateAutoSignal({
  instrument: "XAU/USD",
  timeframe: "15m",
  candles: trend,
  pointSize,
  quoteAgeMs: 500,
  store,
  sessionUtcStartMinute: 0,
  sessionUtcEndMinute: 24 * 60,
  nowMs,
});
const stale = generateAutoSignal({
  instrument: "XAU/USD",
  timeframe: "15m",
  candles,
  pointSize,
  quoteAgeMs: 60_000,
  store,
  sessionUtcStartMinute: 0,
  sessionUtcEndMinute: 24 * 60,
  nowMs,
});
const liveSig = generateAutoSignal({
  instrument: "XAU/USD",
  timeframe: "15m",
  candles,
  pointSize,
  quoteAgeMs: 500,
  store: new AutoSignalStore(path.join(os.tmpdir(), "kw-phase42-live-sig.json")),
  sessionUtcStartMinute: 0,
  sessionUtcEndMinute: 24 * 60,
  nowMs,
});
const invalid = evaluateSmaCrossoverStrategy({ candles: candles.slice(0, 5), pointSize: null });
console.log(
  "SIGNALS",
  JSON.stringify(
    {
      live: { ok: liveSig.ok, code: liveSig.code, dir: liveSig.signal?.direction, places: liveSig.placesOrders },
      trendFirst: {
        ok: sig1.ok,
        code: sig1.code,
        dir: sig1.signal?.direction,
        places: sig1.placesOrders,
      },
      trendDup: { ok: sig2.ok, code: sig2.code, dup: sig2.duplicate },
      stale: stale.code,
      invalid: { ok: invalid.ok, code: invalid.code },
    },
    null,
    2,
  ),
);

if (sig1.ok && sig1.signal && sig1.signal.direction !== "NO_TRADE") {
  const prep = prepareAutoEntryFromSignal({
    signal: sig1.signal,
    lots: 0.01,
    grantMaxLots: 0.01,
    riskInput: {
      instrument: "XAU/USD",
      direction: sig1.signal.direction,
      lots: 0.01,
      stopLoss: sig1.signal.stopLoss,
      takeProfit: sig1.signal.takeProfit,
      entryPrice: sig1.signal.entryPrice,
      requireProtective: true,
      equity: 10_000,
      balance: 10_000,
      usableMargin: 8_000,
      accountCurrency: "USD",
      openPositionsCount: 0,
      openExposureLots: 0,
      dayRealizedPnlAccount: null,
      dayStartEquity: null,
      grantMaxLots: 0.01,
      nowMs,
    },
    dailyRisk: {
      authoritative: false,
      blockers: ["TEST"],
      dayKeyUtc: "x",
      dayStartEquity: null,
      currentEquity: null,
      realizedDailyPnl: null,
      unrealizedDailyPnl: null,
      dailyDrawdown: null,
      accountCurrency: null,
      dataFresh: false,
    },
    emergencyEntryLock: true,
    masterEnable: false,
    allowDemoMutationEnabled: false,
    entriesUsedInGrant: 0,
    cooldownUntilMs: null,
    mode: "dry_run",
    nowMs,
  });
  console.log(
    "PREPARE",
    JSON.stringify(
      {
        ok: prep.ok,
        code: prep.code,
        places: prep.placesOrders,
        accepts: prep.acceptsForExecution,
        mode: prep.mode,
      },
      null,
      2,
    ),
  );
}

const empty = reconcilePositions({
  brokerConnected: true,
  tradesFetchOk: true,
  internal: [],
  broker: [],
  allowlistInstruments: ["XAU/USD"],
});
const unexpected = reconcilePositions({
  brokerConnected: true,
  tradesFetchOk: true,
  internal: [],
  broker: [{ tradeId: "T1", instrument: "XAU/USD", lots: 1, amount: 1 }],
  allowlistInstruments: ["XAU/USD"],
});
const disc = reconcilePositions({
  brokerConnected: false,
  tradesFetchOk: true,
  internal: [],
  broker: [],
  allowlistInstruments: ["XAU/USD"],
});
const missingProt = reconcilePositions({
  brokerConnected: true,
  tradesFetchOk: true,
  internal: [
    {
      lifecycleId: "L1",
      instrument: "XAU/USD",
      tradeId: "T9",
      direction: "BUY",
      lots: 1,
      protectionStatus: "FAILED",
      fillConfirmed: true,
      blocksAdditionalEntries: false,
    },
  ],
  broker: [{ tradeId: "T9", instrument: "XAU/USD", lots: 1, amount: 1 }],
  allowlistInstruments: ["XAU/USD"],
});
const matched = reconcilePositions({
  brokerConnected: true,
  tradesFetchOk: true,
  internal: [
    {
      lifecycleId: "L1",
      instrument: "XAU/USD",
      tradeId: "T9",
      direction: "BUY",
      lots: 1,
      protectionStatus: "CONFIRMED",
      fillConfirmed: true,
      blocksAdditionalEntries: false,
    },
  ],
  broker: [{ tradeId: "T9", instrument: "XAU/USD", lots: 1, amount: 1 }],
  allowlistInstruments: ["XAU/USD"],
});
const missingBroker = reconcilePositions({
  brokerConnected: true,
  tradesFetchOk: true,
  internal: [
    {
      lifecycleId: "L2",
      instrument: "XAU/USD",
      tradeId: "TX",
      direction: "BUY",
      lots: 1,
      protectionStatus: "CONFIRMED",
      fillConfirmed: true,
      blocksAdditionalEntries: false,
    },
  ],
  broker: [],
  allowlistInstruments: ["XAU/USD"],
});
console.log(
  "RECONCILE",
  JSON.stringify(
    {
      empty: { code: empty.code, block: empty.blockNewEntries },
      unexpected: { code: unexpected.code, blockers: unexpected.blockers },
      disc: { code: disc.code, block: disc.blockNewEntries },
      missingProt: { code: missingProt.code, blockers: missingProt.blockers },
      matched: { code: matched.code, block: matched.blockNewEntries },
      missingBroker: { code: missingBroker.code, blockers: missingBroker.blockers },
    },
    null,
    2,
  ),
);

const dailyMissing = computeDailyRiskSnapshot({
  nowMs,
  accountId: "x",
  accountCurrency: "USD",
  equity: 10_000,
  balance: 10_000,
  usableMargin: 8_000,
  accountsFetchedAtUtc: new Date(nowMs).toISOString(),
  prior: null,
  dayClosedTrades: null,
  closedTradesFetchOk: false,
  closedTradesFetchedAtUtc: null,
  openUnrealizedPnl: null,
  openTradesFetchOk: false,
  openTradesFetchedAtUtc: null,
});
console.log(
  "DAILY_MISSING",
  JSON.stringify(
    {
      authoritative: dailyMissing.authoritative,
      blockers: dailyMissing.blockers,
      realized: dailyMissing.realizedDailyPnl,
      unrealized: dailyMissing.unrealizedDailyPnl,
      dayKeyUtc: dailyMissing.dayKeyUtc,
    },
    null,
    2,
  ),
);

void require;
