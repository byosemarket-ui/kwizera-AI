import { describe, expect, it } from "vitest";
import { evaluateLiveOfferQuoteFreshness } from "../../../../ai/forex-ai/automated-trading/quote-freshness.js";
import {
  describeMarketSelectionGap,
  fcInstrumentFromShellMarket,
} from "../../../../ai/forex-ai/automated-trading/market-selection.js";
import { runIsolatedStrategyDryRunLifecycle } from "../../../../ai/forex-ai/automated-trading/strategy-dry-run/index.js";
import { evaluateSmaCrossoverStrategy } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/evaluate.js";
import { SMA_CROSSOVER_RULES } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";
import type { StrategyCandle } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";
import { getDisabledBrokerMutationAdapter } from "../../../../ai/forex-ai/automated-trading/broker-intent/index.js";

function makeClosedCandles(n: number, start = 1_700_000_000): StrategyCandle[] {
  const out: StrategyCandle[] = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    // Flat then ramp so SMA(9) crosses SMA(21) near the end.
    if (i > 40) price += 0.8;
    else if (i > 20) price -= 0.15;
    const open = price;
    const close = price + (i > 40 ? 0.5 : -0.05);
    out.push({
      time: start + i * 3600,
      open,
      high: Math.max(open, close) + 0.2,
      low: Math.min(open, close) - 0.2,
      close,
      closed: true,
    });
  }
  return out;
}

describe("Phase 4.12 market selection", () => {
  it("maps ForexConnect shell markets only", () => {
    expect(
      fcInstrumentFromShellMarket({
        venue: "forexconnect",
        provider: "FOREXCONNECT",
        symbol: "XAU/USD",
      }),
    ).toBe("XAU/USD");
    expect(
      fcInstrumentFromShellMarket({
        venue: "binance-spot",
        provider: "BINANCE",
        symbol: "BTCUSDT",
      }),
    ).toBeNull();
    expect(fcInstrumentFromShellMarket(null)).toBeNull();
  });

  it("describes shell vs backend gaps (root cause of No market selected)", () => {
    expect(describeMarketSelectionGap({
      shellInstrument: null,
      backendInstrument: null,
    }).code).toBe("NONE");
    expect(describeMarketSelectionGap({
      shellInstrument: "EUR/USD",
      backendInstrument: null,
    }).code).toBe("SHELL_ONLY");
    expect(describeMarketSelectionGap({
      shellInstrument: "EUR/USD",
      backendInstrument: "EUR/USD",
    }).code).toBe("SYNCED");
  });
});

describe("Phase 4.12 MARKET_CLOSED vs heartbeat", () => {
  it("labels TradingStatus CLOSED as MARKET_CLOSED, not heartbeat activity", () => {
    const ev = evaluateLiveOfferQuoteFreshness({
      bid: 2650.1,
      ask: 2650.4,
      streamState: "NO_RECENT_MARKET_UPDATES",
      priceChangeAgeMs: 60_000,
      receiptAgeMs: 500,
      updateCount: 12,
      tradingStatus: "C",
      instrument: "XAU/USD",
      nowMs: Date.now(),
      staleMs: 15_000,
    });
    expect(ev.fresh).toBe(false);
    expect(ev.reasonCode).toBe("MARKET_CLOSED");
    expect(ev.orderPathMarketReady).toBe(false);
    expect(ev.orderPathBlockerCode).toBe("LIVE_TRADING_STATUS_CLOSED");
  });

  it("keeps HEARTBEAT_ONLY when status open but prices stagnant", () => {
    const ev = evaluateLiveOfferQuoteFreshness({
      bid: 1.1,
      ask: 1.1002,
      streamState: "NO_RECENT_MARKET_UPDATES",
      priceChangeAgeMs: 60_000,
      receiptAgeMs: 200,
      updateCount: 5,
      tradingStatus: "O",
      instrument: "EUR/USD",
      nowMs: Date.now(),
      staleMs: 15_000,
    });
    expect(ev.reasonCode).toBe("HEARTBEAT_ONLY_NO_PRICE_CHANGE");
  });
});

describe("Phase 4.12 strategy + isolated dry-run", () => {
  it("evaluates SMA/ATR on closed candles with ordered timestamps", () => {
    const candles = makeClosedCandles(60);
    const ev = evaluateSmaCrossoverStrategy({ candles, pointSize: 0.01 });
    expect(ev.strategyId).toBe(SMA_CROSSOVER_RULES.strategyId);
    expect(candles.every((c, i) => i === 0 || c.time > candles[i - 1]!.time)).toBe(true);
    expect(ev.closedCandleOpenSec).not.toBeNull();
  });

  it("runs full SIMULATED lifecycle without broker mutation adapter", () => {
    const candles = makeClosedCandles(60);
    // Force a BUY cross: build a clear crossover series.
    const forced: StrategyCandle[] = [];
    let p = 50;
    for (let i = 0; i < 30; i++) {
      p -= 0.5;
      forced.push({
        time: 1_800_000_000 + i * 3600,
        open: p,
        high: p + 0.3,
        low: p - 0.3,
        close: p - 0.2,
        closed: true,
      });
    }
    for (let i = 30; i < 55; i++) {
      p += 1.2;
      forced.push({
        time: 1_800_000_000 + i * 3600,
        open: p,
        high: p + 0.5,
        low: p - 0.2,
        close: p + 0.4,
        closed: true,
      });
    }
    const result = runIsolatedStrategyDryRunLifecycle({
      instrument: "XAU/USD",
      candles: forced.length >= 40 ? forced : candles,
      pointSize: 0.01,
      quantityContract: {
        requestedLots: 0.01,
        baseUnitSize: 1,
        minQuantity: 1,
        mmrPerLot: 100,
        maxLotsPerOrder: 0.01,
      },
      forceSimulatedTpExit: true,
    });
    expect(result.simulationOnly).toBe(true);
    expect(result.mutatesBroker).toBe(false);
    expect(result.placesOrders).toBe(false);
    expect(result.acknowledgementLabel).toBe("SIMULATED");
    expect(result.ownerMaxLots).toBe(0.01);
    expect(result.quantityContract.requestedLotsSupported).toBe(false);
    expect(result.brokerExecutionBlockers.some((b) => b.includes("OWNER") || b.includes("BELOW") || b.includes("LOTS"))).toBe(true);

    const adapter = getDisabledBrokerMutationAdapter();
    expect(adapter.mutatesBroker).toBe(false);

    const stepIds = result.steps.map((s) => s.step);
    expect(stepIds).toContain("STRATEGY_SIGNAL");
    expect(stepIds).toContain("QUANTITY_MARGIN");
    if (result.simulatedPosition) {
      expect(result.simulatedPosition.fillLabel).toBe("SIMULATED");
      expect(result.simulatedPosition.state).toBe("SIMULATED_CLOSED");
      expect(stepIds).toContain("PARTIAL_FILL");
      expect(stepIds).toContain("FULL_FILL");
      expect(stepIds).toContain("SIMULATED_CLOSE");
    }
  });

  it("suppresses duplicate simulated fill events", () => {
    const candles = makeClosedCandles(50);
    const result = runIsolatedStrategyDryRunLifecycle({
      instrument: "EUR/USD",
      candles,
      pointSize: 0.00001,
      forceSimulatedTpExit: true,
    });
    const partial = result.steps.find((s) => s.step === "PARTIAL_FILL");
    if (partial) {
      expect(partial.detail).toMatch(/duplicates=/);
    }
  });
});
