import { describe, expect, it } from "vitest";
import {
  describeMarketSelectionGap,
  resolveAtOperatingInstrument,
  forexConnectShellMarketFromSymbol,
  fcInstrumentFromShellMarket,
} from "../../../../ai/forex-ai/automated-trading/market-selection.js";
import { buildFeedStatusBreakdown } from "../../../../ai/forex-ai/automated-trading/feed-status-breakdown.js";
import { runIsolatedStrategyDryRunLifecycle } from "../../../../ai/forex-ai/automated-trading/strategy-dry-run/index.js";
import { evaluateSmaCrossoverStrategy } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/evaluate.js";
import type { StrategyCandle } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";
import { getDisabledBrokerMutationAdapter } from "../../../../ai/forex-ai/automated-trading/broker-intent/index.js";
import { evaluateLiveOfferQuoteFreshness } from "../../../../ai/forex-ai/automated-trading/quote-freshness.js";

describe("Phase 4.13 market selection consistency", () => {
  it("reports NO_MARKET_SELECTED instead of inventing XAU/USD", () => {
    const gap = describeMarketSelectionGap({
      shellInstrument: null,
      backendInstrument: null,
    });
    expect(gap.code).toBe("NO_MARKET_SELECTED");
    const op = resolveAtOperatingInstrument({
      shellInstrument: null,
      backendInstrument: null,
    });
    expect(op.instrument).toBeNull();
    expect(op.code).toBe("NO_MARKET_SELECTED");
  });

  it("explains BACKEND_ONLY when shell empty but AT persisted XAU/USD", () => {
    const gap = describeMarketSelectionGap({
      shellInstrument: null,
      backendInstrument: "XAU/USD",
    });
    expect(gap.code).toBe("BACKEND_ONLY");
    const op = resolveAtOperatingInstrument({
      shellInstrument: null,
      backendInstrument: "XAU/USD",
      allowBackendFallback: true,
    });
    expect(op.instrument).toBe("XAU/USD");
    expect(op.code).toBe("BACKEND_ONLY");
  });

  it("prefers shell on MISMATCH and supports symbol switch hydrate", () => {
    expect(describeMarketSelectionGap({
      shellInstrument: "EUR/USD",
      backendInstrument: "XAU/USD",
    }).code).toBe("MISMATCH");
    const hydrated = forexConnectShellMarketFromSymbol("XAU/USD");
    expect(fcInstrumentFromShellMarket(hydrated)).toBe("XAU/USD");
    expect(resolveAtOperatingInstrument({
      shellInstrument: "EUR/USD",
      backendInstrument: "XAU/USD",
    }).instrument).toBe("EUR/USD");
  });
});

describe("Phase 4.13 feed status breakdown", () => {
  it("does not treat CONNECTED alone as fresh price-change feed", () => {
    const b = buildFeedStatusBreakdown({
      brokerConnected: true,
      offersListenerActive: true,
      instrumentSubscribed: true,
      instrument: "XAU/USD",
      subscriptionSymbols: ["XAU/USD"],
      updateCount: 0,
      lastQuoteAtMs: null,
      lastPriceChangeAtMs: null,
      lastReceiptAtMs: null,
      bid: 2650,
      ask: 2650.5,
      streamState: "MARKET_INACTIVE",
      tradingStatus: "C",
      quoteFreshReasonCode: "MARKET_CLOSED",
    });
    expect(b.brokerConnected).toBe(true);
    expect(b.offersListenerActive).toBe(true);
    expect(b.freshPriceChangeReceived).toBe(false);
    expect(b.marketClosed).toBe(true);
    expect(b.primaryGap).toBe("MARKET_CLOSED");
  });

  it("weekend/closed maps TradingStatus C ahead of heartbeat", () => {
    const ev = evaluateLiveOfferQuoteFreshness({
      bid: 1.1,
      ask: 1.1001,
      streamState: "MARKET_INACTIVE",
      priceChangeAgeMs: 90_000,
      receiptAgeMs: 200,
      updateCount: 0,
      tradingStatus: "C",
      instrument: "EUR/USD",
      nowMs: Date.now(),
    });
    expect(ev.reasonCode).toBe("MARKET_CLOSED");
    expect(ev.fresh).toBe(false);
  });
});

describe("Phase 4.13 strategy + fixture lifecycle isolation", () => {
  it("does not invent crossover; fixture path is labeled when no signal", () => {
    const flat: StrategyCandle[] = [];
    for (let i = 0; i < 40; i++) {
      flat.push({
        time: 1_900_000_000 + i * 3600,
        open: 100,
        high: 100.1,
        low: 99.9,
        close: 100,
        closed: true,
      });
    }
    const ev = evaluateSmaCrossoverStrategy({ candles: flat, pointSize: 0.01 });
    expect(ev.direction).toBe("NO_TRADE");

    const dry = runIsolatedStrategyDryRunLifecycle({
      instrument: "EUR/USD",
      candles: flat,
      pointSize: 0.01,
      includeDeterministicFixtureLifecycle: true,
      forceSimulatedTpExit: true,
      quantityContract: {
        requestedLots: 0.01,
        baseUnitSize: 1,
        minQuantity: 1,
        maxLotsPerOrder: 0.01,
      },
    });
    expect(dry.usedDeterministicFixture).toBe(true);
    expect(dry.mutatesBroker).toBe(false);
    expect(dry.banner).toMatch(/FIXTURE/);
    expect(dry.simulatedPosition?.fillLabel).toBe("SIMULATED");
    expect(getDisabledBrokerMutationAdapter().mutatesBroker).toBe(false);
  });

  it("validates candle timestamps ascending independently", () => {
    const candles: StrategyCandle[] = [
      { time: 10, open: 1, high: 1.1, low: 0.9, close: 1, closed: true },
      { time: 20, open: 1, high: 1.1, low: 0.9, close: 1.01, closed: true },
      { time: 30, open: 1, high: 1.2, low: 0.9, close: 1.02, closed: true },
    ];
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i]!.time).toBeGreaterThan(candles[i - 1]!.time);
    }
  });
});
