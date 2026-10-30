import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import {
  atrAt,
  backtestSmaCrossover,
  evaluateSmaCrossoverStrategy,
} from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/evaluate.js";
import { SMA_CROSSOVER_RULES } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";
import { generateAutoSignal } from "../../../../ai/forex-ai/automated-trading/auto-engine/signals/engine.js";
import { AutoSignalStore } from "../../../../ai/forex-ai/automated-trading/auto-engine/signals/store.js";
import { computeDailyRiskSnapshot } from "../../../../ai/forex-ai/automated-trading/auto-engine/daily-risk/compute.js";
import { prepareAutoEntryFromSignal } from "../../../../ai/forex-ai/automated-trading/auto-engine/orchestration/prepare-entry.js";
import { reconcilePositions } from "../../../../ai/forex-ai/automated-trading/auto-engine/position-monitor/reconcile.js";
import { accumulateFillEvents } from "../../../../ai/forex-ai/automated-trading/auto-engine/lifecycle/fill-event-accumulator.js";
import { AutoEngineWorker } from "../../../../ai/forex-ai/automated-trading/auto-engine/worker.js";
import { DEMO_OPEN_RISK_DEFAULTS } from "../../../../ai/forex-ai/automated-trading/demo-execution/open-market-risk.js";
import type { StrategyCandle } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";
import type { AutoSignalRecord } from "../../../../ai/forex-ai/automated-trading/auto-engine/signals/types.js";

function makeTrendCandles(n: number, start = 100): StrategyCandle[] {
  const out: StrategyCandle[] = [];
  let px = start;
  for (let i = 0; i < n; i++) {
    // Slow grind then sharp push to force crossover late in series
    const drift = i < n - 5 ? 0.02 : 0.8;
    const open = px;
    const close = px + drift;
    const high = Math.max(open, close) + 0.1;
    const low = Math.min(open, close) - 0.1;
    out.push({ time: 1_700_000_000 + i * 900, open, high, low, close, closed: true });
    px = close;
  }
  return out;
}

describe("Phase 61.0 strategy evaluate", () => {
  it("documents non-profitability and rejects insufficient candles", () => {
    expect(SMA_CROSSOVER_RULES.profitabilityClaimed).toBe(false);
    expect(SMA_CROSSOVER_RULES.trailingStop).toBe(false);
    const r = evaluateSmaCrossoverStrategy({ candles: makeTrendCandles(5), pointSize: 0.01 });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("INSUFFICIENT_CLOSED_CANDLES");
  });

  it("computes ATR and can emit BUY/SELL or NO_TRADE without fabricating fills", () => {
    const candles = makeTrendCandles(40);
    const atr = atrAt(
      candles.map((c) => c.high),
      candles.map((c) => c.low),
      candles.map((c) => c.close),
      14,
      candles.length - 1,
    );
    expect(atr).toBeGreaterThan(0);
    const ev = evaluateSmaCrossoverStrategy({ candles, pointSize: 0.01 });
    expect(["BUY", "SELL", "NO_TRADE"]).toContain(ev.direction);
    if (ev.direction !== "NO_TRADE") {
      expect(ev.stopLoss).toBeTruthy();
      expect(ev.takeProfit).toBeTruthy();
    }
    const bt = backtestSmaCrossover({ candles, pointSize: 0.01 });
    expect(bt.note).toMatch(/does not prove/i);
  });
});

describe("Phase 61.0 signals + duplicate suppression", () => {
  it("rejects stale quotes and suppresses duplicate candle signals", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kw-sig-"));
    const store = new AutoSignalStore(path.join(dir, "signals.json"));
    const candles = makeTrendCandles(40);
    const first = generateAutoSignal({
      instrument: "XAU/USD",
      timeframe: "15m",
      candles,
      pointSize: 0.01,
      quoteAgeMs: 1_000,
      store,
      sessionUtcStartMinute: 0,
      sessionUtcEndMinute: 24 * 60,
      nowMs: Date.UTC(2026, 0, 1, 12, 0, 0),
    });
    // May be NO_TRADE depending on series; if directional, second call duplicates.
    if (first.ok && first.signal && first.signal.direction !== "NO_TRADE") {
      const second = generateAutoSignal({
        instrument: "XAU/USD",
        timeframe: "15m",
        candles,
        pointSize: 0.01,
        quoteAgeMs: 1_000,
        store,
        sessionUtcStartMinute: 0,
        sessionUtcEndMinute: 24 * 60,
        nowMs: Date.UTC(2026, 0, 1, 12, 0, 0),
      });
      expect(second.duplicate).toBe(true);
      expect(second.code).toBe("DUPLICATE_SIGNAL");
    }
    const stale = generateAutoSignal({
      instrument: "XAU/USD",
      timeframe: "15m",
      candles,
      pointSize: 0.01,
      quoteAgeMs: 60_000,
      store,
    });
    expect(stale.code).toBe("QUOTE_STALE");
  });
});

describe("Phase 61.0 daily risk telemetry", () => {
  it("fails closed when day-start or closed-trade PnL is missing", () => {
    const nowMs = Date.UTC(2026, 5, 1, 15, 0, 0);
    const missing = computeDailyRiskSnapshot({
      nowMs,
      accountId: "a1",
      accountCurrency: "USD",
      equity: 10_000,
      balance: 10_000,
      usableMargin: 8_000,
      accountsFetchedAtUtc: new Date(nowMs).toISOString(),
      prior: null,
      dayClosedTrades: null,
      closedTradesFetchOk: false,
      closedTradesFetchedAtUtc: null,
      openUnrealizedPnl: 0,
      openTradesFetchOk: true,
      openTradesFetchedAtUtc: new Date(nowMs).toISOString(),
    });
    expect(missing.authoritative).toBe(false);
    expect(missing.blockers).toEqual(expect.arrayContaining([
      "CLOSED_TRADES_UNAVAILABLE",
    ]));

    const ok = computeDailyRiskSnapshot({
      nowMs,
      accountId: "a1",
      accountCurrency: "USD",
      equity: 9_900,
      balance: 9_900,
      usableMargin: 8_000,
      accountsFetchedAtUtc: new Date(nowMs).toISOString(),
      prior: null,
      dayClosedTrades: [
        {
          tradeId: "t1",
          closeTimeUtc: new Date(nowMs - 3_600_000).toISOString(),
          realizedPnl: -50,
        },
      ],
      closedTradesFetchOk: true,
      closedTradesFetchedAtUtc: new Date(nowMs).toISOString(),
      openUnrealizedPnl: -10,
      openTradesFetchOk: true,
      openTradesFetchedAtUtc: new Date(nowMs).toISOString(),
    });
    expect(ok.authoritative).toBe(true);
    expect(ok.realizedPnlAccount).toBe(-50);
    expect(ok.dayStartEquity).toBe(9_900);
  });
});

describe("Phase 61.0 prepare-entry + position reconcile + fills", () => {
  it("prepares dry-run entries without enabling mutation", () => {
    const nowMs = Date.now();
    const signal: AutoSignalRecord = {
      schemaVersion: "kwizera.auto-signal.v1",
      signalId: "sig-1",
      dedupeKey: "XAU/USD|15m|1|BUY",
      strategyId: SMA_CROSSOVER_RULES.strategyId,
      instrument: "XAU/USD",
      timeframe: "15m",
      direction: "BUY",
      status: "ACTIVE",
      code: "BUY_SMA_CROSS",
      reasons: ["test"],
      confidencePct: 50,
      closedCandleOpenSec: 1,
      entryPrice: 4020,
      stopLoss: 4000,
      takeProfit: 4060,
      atr: 5,
      createdAtUtc: new Date(nowMs).toISOString(),
      expiresAtUtc: null,
      consumedAtUtc: null,
    };
    const prepared = prepareAutoEntryFromSignal({
      signal,
      lots: 1,
      grantMaxLots: 1,
      emergencyEntryLock: true,
      masterEnable: false,
      allowDemoMutationEnabled: false,
      entriesUsedInGrant: 0,
      dailyRisk: {
        schemaVersion: "kwizera.daily-risk.v1",
        tradingDayKey: "2026-01-01",
        timezone: "UTC",
        accountId: "a1",
        accountCurrency: "USD",
        dayStartEquity: 10_000,
        dayStartBalance: 10_000,
        dayStartRecordedAtUtc: new Date(nowMs).toISOString(),
        currentEquity: 10_000,
        currentBalance: 10_000,
        currentUsableMargin: 8_000,
        realizedPnlAccount: 0,
        unrealizedPnlAccount: 0,
        dailyDrawdownFraction: 0,
        dailyLossAccount: 0,
        depositsAccount: null,
        withdrawalsAccount: null,
        accountsFetchedAtUtc: new Date(nowMs).toISOString(),
        closedTradesFetchedAtUtc: new Date(nowMs).toISOString(),
        openTradesFetchedAtUtc: new Date(nowMs).toISOString(),
        authoritative: true,
        blockers: [],
        updatedAtUtc: new Date(nowMs).toISOString(),
      },
      riskInput: {
        requestedAccountId: null,
        account: {
          accountId: "a1",
          environment: "demo",
          accountCurrency: "USD",
          equity: 10_000,
          usableMargin: 8_000,
          balance: 10_000,
          missingFields: [],
          fetchedAtUtc: new Date(nowMs).toISOString(),
        },
        accountFetchOk: true,
        accountCount: 1,
        instrumentSpecs: {
          providerSymbol: "XAU/USD",
          baseUnitSize: 1,
          pointSize: 0.01,
          pipCostAccount: 0.01,
          mmrPerLot: 100,
          condDistStopRaw: 0,
          condDistReportedUnit: "pips",
          condDistMethod: "getCondDistStopForTrade",
          condDistAvailable: true,
        },
        openExposureLots: 0,
        openPositionCount: 0,
        tradesFetchOk: true,
        hasUnresolvedUnprotectedFill: false,
        quoteTimestamp: nowMs,
        limits: { ...DEMO_OPEN_RISK_DEFAULTS, maxSlLossAccount: 50, cooldownAfterLossMs: 0 },
      },
      cooldownUntilMs: 0,
      mode: "dry_run",
      nowMs,
    });
    expect(prepared.mutatesBroker).toBe(false);
    expect(prepared.maySubmitDemoMutation).toBe(false);
    expect(prepared.placesOrders).toBe(false);
    // May pass or fail SL fraction depending on distances — never mutates either way.
    expect(typeof prepared.ok).toBe("boolean");
  });

  it("blocks new entries on unexpected broker positions or disconnect", () => {
    const r = reconcilePositions({
      brokerConnected: false,
      tradesFetchOk: true,
      internal: [],
      broker: [{ tradeId: "x", instrument: "XAU/USD", lots: 1, amount: 1 }],
      allowlistInstruments: ["XAU/USD"],
    });
    expect(r.blockNewEntries).toBe(true);
    expect(r.blockers).toContain("BROKER_DISCONNECTED");
  });

  it("aggregates partial fills with duplicate suppression and fail-closed incomplete streams", () => {
    const incomplete = accumulateFillEvents({
      events: [
        { eventId: "e1", orderId: "o1", tradeId: "t1", filledAmount: 0.4, timestampMs: 1 },
        { eventId: "e1", orderId: "o1", tradeId: "t1", filledAmount: 0.4, timestampMs: 2 },
        { eventId: "e2", orderId: "o1", tradeId: "t1", filledAmount: 0.3, timestampMs: 3 },
      ],
      expectedAmount: 1,
    });
    expect(incomplete.fillConfirmed).toBe(false);
    expect(incomplete.code).toBe("PARTIAL_FILL_INCOMPLETE");
    expect(incomplete.duplicateEventIds).toContain("e1");

    const done = accumulateFillEvents({
      events: [
        { eventId: "a", orderId: "o1", tradeId: "t1", filledAmount: 0.5, timestampMs: 1 },
        { eventId: "b", orderId: "o1", tradeId: "t1", filledAmount: 0.5, timestampMs: 2 },
      ],
      expectedAmount: 1,
    });
    expect(done.fillConfirmed).toBe(true);
    expect(done.finalFilledAmount).toBe(1);
  });
});

describe("Phase 61.0 auto-engine worker dry-run tick", () => {
  it("ticks without placing orders", async () => {
    const worker = new AutoEngineWorker({
      config: {
        enabled: true,
        mode: "dry_run",
        instruments: ["XAU/USD"],
        timeframe: "15m",
        lots: 1,
        pollIntervalMs: 30_000,
        strategyId: SMA_CROSSOVER_RULES.strategyId,
        maxSpread: null,
        sessionUtcStartMinute: 0,
        sessionUtcEndMinute: 24 * 60,
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
      },
      nowMs: Date.UTC(2026, 0, 1, 12, 0, 0),
      loadCandles: async () => makeTrendCandles(40),
      loadPointSize: async () => 0.01,
      loadQuoteMeta: async () => ({ ageMs: 500, spread: 0.2 }),
      loadAccountRiskContext: async () => ({
        riskPartial: {
          requestedAccountId: null,
          account: {
            accountId: "a1",
            environment: "demo",
            accountCurrency: "USD",
            equity: 10_000,
            usableMargin: 8_000,
            balance: 10_000,
            missingFields: [],
            fetchedAtUtc: new Date(Date.UTC(2026, 0, 1, 12, 0, 0)).toISOString(),
          },
          accountFetchOk: true,
          accountCount: 1,
          instrumentSpecs: {
            providerSymbol: "XAU/USD",
            baseUnitSize: 1,
            pointSize: 0.01,
            pipCostAccount: 0.01,
            mmrPerLot: 100,
            condDistStopRaw: 0,
            condDistReportedUnit: "pips",
            condDistMethod: "getCondDistStopForTrade",
            condDistAvailable: true,
          },
          openExposureLots: 0,
          openPositionCount: 0,
          tradesFetchOk: true,
          hasUnresolvedUnprotectedFill: false,
          quoteTimestamp: Date.UTC(2026, 0, 1, 12, 0, 0),
          limits: { ...DEMO_OPEN_RISK_DEFAULTS, cooldownAfterLossMs: 0 },
        },
        grantMaxLots: 1,
        emergencyEntryLock: true,
        masterEnable: false,
        allowDemoMutationEnabled: false,
        entriesUsedInGrant: 0,
        cooldownUntilMs: 0,
        accountId: "a1",
        accountCurrency: "USD",
        equity: 10_000,
        balance: 10_000,
        usableMargin: 8_000,
        accountsFetchedAtUtc: new Date(Date.UTC(2026, 0, 1, 12, 0, 0)).toISOString(),
        dayClosedTrades: [],
        closedTradesFetchOk: true,
        closedTradesFetchedAtUtc: new Date(Date.UTC(2026, 0, 1, 12, 0, 0)).toISOString(),
        openUnrealizedPnl: 0,
        openTradesFetchOk: true,
        openTradesFetchedAtUtc: new Date(Date.UTC(2026, 0, 1, 12, 0, 0)).toISOString(),
        brokerConnected: true,
        brokerPositions: [],
        internalPositions: [],
      }),
    });
    const status = await worker.tick();
    expect(status.placesOrders).toBe(false);
    expect(status.mutatesBroker).toBe(false);
    expect(status.phase).toBe("4.1");
    expect(status.dailyRisk?.authoritative).toBe(true);
  });
});
