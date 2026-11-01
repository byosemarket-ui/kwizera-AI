/**
 * Phase 4.14B — Market selection, feed pipeline, candle quality, stages (mock tests).
 * These are software-contract tests, not broker-backed verification.
 */
import { describe, expect, it } from "vitest";
import {
  describeMarketSelectionGap,
  resolveAtOperatingInstrument,
  fcInstrumentFromShellMarket,
  forexConnectShellMarketFromSymbol,
} from "../../../../ai/forex-ai/automated-trading/market-selection.js";
import { buildFeedStatusBreakdown } from "../../../../ai/forex-ai/automated-trading/feed-status-breakdown.js";
import { auditCandleQuality } from "../../../../ai/forex-ai/automated-trading/candle-quality.js";
import { buildAtPipelineStages } from "../../../../ai/forex-ai/automated-trading/pipeline-stages.js";
import { validateAtQuoteInstrumentForSubscribe } from "../../../../ai/forex-ai/automated-trading/validate-at-quote-instrument.js";
import { assessForexConnectInstrumentSupport } from "../../../../ai/forex-ai/automated-trading/instrument-support-registry.js";
import { evaluateBrokerIntentPreflight } from "../../../../ai/forex-ai/automated-trading/broker-intent/preflight.js";
import { loadAutoEngineConfig } from "../../../../ai/forex-ai/automated-trading/auto-engine/config.js";
import { evaluateSmaCrossoverStrategy } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/evaluate.js";
import type { StrategyCandle } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";
import type { ForexConnectInstrument } from "../../../../ai/market-data/forexconnect/types.js";

function catalog(...symbols: string[]): ForexConnectInstrument[] {
  return symbols.map((s) => ({
    providerSymbol: s,
    canonicalSymbol: s.replace("/", ""),
    displaySymbol: s,
    marketType: s.startsWith("XAU") ? "METAL" : "FX",
  })) as ForexConnectInstrument[];
}

function closedBars(n: number, base = 100): StrategyCandle[] {
  const out: StrategyCandle[] = [];
  for (let i = 0; i < n; i++) {
    // Flat closes — no SMA crossover (phase413 fixture pattern).
    const c = base;
    out.push({
      time: 1_900_000_000 + i * 3600,
      open: c,
      high: c + 0.1,
      low: c - 0.1,
      close: c,
      closed: true,
    });
  }
  return out;
}

describe("Phase 4.14B market selection (mock)", () => {
  it("selects XAU/USD, EUR/USD, and another FC instrument without silent substitution", () => {
    for (const sym of ["XAU/USD", "EUR/USD", "GBP/USD"] as const) {
      const shell = forexConnectShellMarketFromSymbol(sym);
      expect(fcInstrumentFromShellMarket(shell)).toBe(sym);
      expect(resolveAtOperatingInstrument({
        shellInstrument: sym,
        backendInstrument: sym,
      }).instrument).toBe(sym);
    }
  });

  it("rejects Binance shell mapping into ForexConnect AT", () => {
    expect(fcInstrumentFromShellMarket({
      venue: "binance",
      provider: "BINANCE",
      symbol: "BTCUSDT",
    })).toBeNull();
  });

  it("reports NO_MARKET_SELECTED, MISMATCH, BACKEND_ONLY, SHELL_ONLY", () => {
    expect(describeMarketSelectionGap({
      shellInstrument: null,
      backendInstrument: null,
    }).code).toBe("NO_MARKET_SELECTED");
    expect(describeMarketSelectionGap({
      shellInstrument: "EUR/USD",
      backendInstrument: "XAU/USD",
    }).code).toBe("MISMATCH");
    expect(describeMarketSelectionGap({
      shellInstrument: null,
      backendInstrument: "XAU/USD",
    }).code).toBe("BACKEND_ONLY");
    expect(describeMarketSelectionGap({
      shellInstrument: "EUR/USD",
      backendInstrument: null,
    }).code).toBe("SHELL_ONLY");
  });

  it("missing provider/symbol does not invent XAU/USD", () => {
    expect(fcInstrumentFromShellMarket({ venue: "forexconnect", provider: "FOREXCONNECT", symbol: "" }))
      .toBeNull();
    expect(resolveAtOperatingInstrument({
      shellInstrument: null,
      backendInstrument: null,
    }).instrument).toBeNull();
  });
});

describe("Phase 4.14B quote allowlist / registry (mock)", () => {
  it("allows catalog EUR/USD for quotes; execution still blocked", () => {
    const v = validateAtQuoteInstrumentForSubscribe({
      symbol: "EUR/USD",
      catalogOk: true,
      instruments: catalog("XAU/USD", "EUR/USD"),
    });
    expect(v.ok).toBe(true);
    const a = assessForexConnectInstrumentSupport({
      symbol: "EUR/USD",
      catalogOk: true,
      catalogHasSymbol: true,
    });
    expect(a.quoteSupported).toBe(true);
    expect(a.executionSupported).toBe(false);
    expect(a.executionBlocked).toBe(true);
  });
});

describe("Phase 4.14B feed pipeline states (mock)", () => {
  it("snapshot without price change is SNAPSHOT_ONLY / NO_PRICE_CHANGE, not LIVE", () => {
    const b = buildFeedStatusBreakdown({
      brokerConnected: true,
      offersListenerActive: true,
      instrumentSubscribed: true,
      instrument: "XAU/USD",
      subscriptionSymbols: ["XAU/USD"],
      updateCount: 0,
      lastQuoteAtMs: null,
      lastPriceChangeAtMs: null,
      lastReceiptAtMs: Date.now(),
      bid: 2650,
      ask: 2650.5,
      streamState: "CONNECTED",
      tradingStatus: "O",
      quoteFreshReasonCode: "NO_PRICE_CHANGE",
      pollCycles: 5,
      pollChanges: 0,
      hasSnapshot: true,
    });
    expect(b.pipelineState).not.toBe("LIVE");
    expect(["SNAPSHOT_ONLY", "NO_PRICE_CHANGE", "HEARTBEAT_ONLY"]).toContain(b.pipelineState);
    expect(b.freshPriceChangeReceived).toBe(false);
  });

  it("MARKET_CLOSED when TradingStatus C and no updates", () => {
    const b = buildFeedStatusBreakdown({
      brokerConnected: true,
      offersListenerActive: true,
      instrumentSubscribed: true,
      instrument: "EUR/USD",
      updateCount: 0,
      lastQuoteAtMs: null,
      lastPriceChangeAtMs: null,
      lastReceiptAtMs: Date.now(),
      bid: 1.1,
      ask: 1.1002,
      streamState: "MARKET_INACTIVE",
      tradingStatus: "C",
      quoteFreshReasonCode: "MARKET_CLOSED",
      hasSnapshot: true,
    });
    expect(b.pipelineState).toBe("MARKET_CLOSED");
    expect(b.marketClosed).toBe(true);
  });

  it("LIVE only with genuine price-change evidence", () => {
    const b = buildFeedStatusBreakdown({
      brokerConnected: true,
      offersListenerActive: true,
      instrumentSubscribed: true,
      instrument: "XAU/USD",
      updateCount: 3,
      lastQuoteAtMs: Date.now() - 1_000,
      lastPriceChangeAtMs: Date.now() - 1_000,
      lastReceiptAtMs: Date.now() - 500,
      bid: 2651,
      ask: 2651.4,
      streamState: "LIVE",
      tradingStatus: "O",
      quoteFreshReasonCode: "LIVE_FRESH",
      hasSnapshot: true,
    });
    expect(b.pipelineState).toBe("LIVE");
    expect(b.freshPriceChangeReceived).toBe(true);
  });
});

describe("Phase 4.14B candle quality (mock)", () => {
  it("marks strategy ready with ≥23 valid closed bars", () => {
    const r = auditCandleQuality({
      candles: closedBars(30),
      instrument: "EUR/USD",
      timeframe: "1h",
      source: "mock_test_fixture",
      requestedBars: 30,
      strategyClosedBarsRequired: 23,
    });
    expect(r.strategyReady).toBe(true);
    expect(r.closedBars).toBe(30);
    expect(r.invalidOhlcCount).toBe(0);
  });

  it("detects duplicates, out-of-order, invalid OHLC, insufficient", () => {
    const bad = [
      { time: 10, open: 1, high: 1.1, low: 0.9, close: 1, closed: true },
      { time: 10, open: 1, high: 1.1, low: 0.9, close: 1, closed: true },
      { time: 5, open: 1, high: 0.5, low: 0.9, close: 1, closed: true },
    ];
    const r = auditCandleQuality({
      candles: bad,
      instrument: "XAU/USD",
      source: "mock_test_fixture",
      strategyClosedBarsRequired: 23,
    });
    expect(r.duplicateCount).toBeGreaterThan(0);
    expect(r.outOfOrderCount).toBeGreaterThan(0);
    expect(r.invalidOhlcCount).toBeGreaterThan(0);
    expect(r.strategyReady).toBe(false);
    expect(r.blockers).toContain("INSUFFICIENT_CLOSED_CANDLES");
  });
});

describe("Phase 4.14B strategy (mock)", () => {
  it("NO_TRADE on flat series; insufficient closed candles fails closed", () => {
    const flat = closedBars(40, 100);
    expect(evaluateSmaCrossoverStrategy({ candles: flat, pointSize: 0.01 }).direction).toBe("NO_TRADE");
    const short = closedBars(10);
    const ev = evaluateSmaCrossoverStrategy({ candles: short, pointSize: 0.01 });
    expect(ev.direction).toBe("NO_TRADE");
    expect(ev.code).toBe("INSUFFICIENT_CLOSED_CANDLES");
  });
});

describe("Phase 4.14B risk / broker-intent / auto-engine (mock)", () => {
  it("empty instrument is NO_MARKET_SELECTED; never invents XAU", () => {
    const r = evaluateBrokerIntentPreflight({
      idempotencyKey: "k1",
      environment: "DEMO",
      environmentVerified: true,
      accountIdMasked: "••••1234",
      accountStateVerified: true,
      instrument: "",
      direction: "BUY",
      quantity: 0.01,
      quantityUnit: "lots",
      quantityUnitAmbiguous: false,
      contractSizeVerified: false,
      pointSize: null,
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
      quoteFresh: false,
      quotePresent: false,
      strategyAllocationPercent: null,
      perOrderAllocation: null,
      estimatedSlLossAccount: null,
      sourceDraftId: null,
      sourceDecisionId: null,
      masterEnable: false,
      emergencyEntryLock: true,
      placesOrders: false,
      acceptsForExecution: false,
      forexConnectTradingEnabled: false,
      automaticEntryEnabled: false,
      automaticReentryEnabled: false,
      duplicateIdempotencyKey: false,
      exposureReconciliationRequired: false,
      protectionCapabilityVerified: false,
      ownerExecutionAuthorized: false,
      requireProtective: true,
      requireThreeR: true,
    });
    expect(r.preflightPassed).toBe(false);
    expect(r.maySubmitToBroker).toBe(false);
    expect(r.intent.rejections.some((x) => x.code === "NO_MARKET_SELECTED")).toBe(true);
  });

  it("auto-engine instruments default empty when env unset (no silent XAU)", () => {
    const cfg = loadAutoEngineConfig({});
    expect(cfg.instruments).toEqual([]);
  });
});

describe("Phase 4.14B pipeline stages (mock)", () => {
  it("keeps execution BLOCKED while quantity incompatible", () => {
    const stages = buildAtPipelineStages({
      selectionGapCode: "SYNCED",
      provider: "FOREXCONNECT",
      shellInstrument: "XAU/USD",
      backendInstrument: "XAU/USD",
      brokerConnected: true,
      environment: "DEMO",
      feedPipelineState: "SNAPSHOT_ONLY",
      subscriptionConfirmed: true,
      hasSnapshot: true,
      updateCount: 0,
      candleStrategyReady: true,
      closedCandleCount: 40,
      strategySignal: "NO_SIGNAL",
      strategyReady: true,
      strategyRejection: null,
      quantityCompatible001: false,
      marginVerified: false,
      accountPermissionVerified: false,
      executionAuthorized: false,
      placesOrders: false,
      acceptsForExecution: false,
      marketClosed: null,
    });
    const exec = stages.find((s) => s.id === "execution");
    const qty = stages.find((s) => s.id === "quantity");
    const md = stages.find((s) => s.id === "market_data");
    expect(exec?.verdict).toBe("BLOCKED");
    expect(qty?.verdict).toBe("BLOCKED");
    expect(md?.verdict).toBe("WAITING");
    expect(md?.code).not.toBe("LIVE");
  });
});
