/**
 * Phase 32 — Full Forex live integration consistency tests.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildForexMarketState, toForexAiMarketState } from "../../../../ai/forex-market-state/index.ts";
import { buildMarketSnapshotFromCompact } from "../../../../ai/forex-memory/from-analysis.ts";
import { marketIdentityKey } from "../../../../ai/market-data/providers/identity.ts";
import {
  identitiesAgree,
  identityFromSelectedMarket,
  marketsAreDistinct,
} from "../../../../desktop/forex/market-data/cross-module-consistency.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const candles = [
  { time: 1_700_000_000, open: 1.08, high: 1.09, low: 1.07, close: 1.085, volume: 0, closed: true },
  { time: 1_700_000_900, open: 1.085, high: 1.09, low: 1.08, close: 1.087, volume: 0, closed: false },
];

describe("Forex Phase 32 — end-to-end integration", () => {
  it("provider identity survives Market State → AI → Memory", () => {
    const fxcmMs = buildForexMarketState({
      symbol: "EUR/USD",
      timeframe: "15m",
      candles,
      connection: "LIVE",
      provider: "FXCM",
      marketType: "FOREX",
      displaySymbol: "EUR/USD",
      providerSymbol: "EUR/USD",
      lastMarketUpdateMs: Date.now(),
    });
    expect(fxcmMs.provider).toBe("FXCM");
    expect(fxcmMs.dataSource).toBe("fxcm-mid");

    const ai = toForexAiMarketState(fxcmMs);
    expect(ai.exchange).toBe("FXCM");
    expect(ai.dataSource).toBe("fxcm-mid");

    const mem = buildMarketSnapshotFromCompact({
      symbol: ai.symbol,
      timeframe: ai.timeframe,
      price: ai.price,
      trend: ai.trend,
      momentum: ai.momentum,
      volatility: ai.volatility,
      rsi: ai.indicators.rsi,
      structure: null,
      timestamp: ai.timestamp,
      dataQuality: "LIVE",
      provider: "FXCM",
      marketType: "FOREX",
      displaySymbol: "EUR/USD",
    });
    expect(mem.exchange).toBe("FXCM");
    expect(mem.source).toBe("fxcm-mid");
    expect(mem.provider).toBe("FXCM");
  });

  it("Binance EURUSDC never collides with FXCM EURUSD", () => {
    expect(marketsAreDistinct(
      { provider: "BINANCE", symbol: "EURUSDC" },
      { provider: "FXCM", symbol: "EUR/USD" },
    )).toBe(true);
    expect(marketIdentityKey({
      provider: "BINANCE",
      marketType: "CRYPTO",
      symbol: "EURUSDC",
    })).not.toBe(marketIdentityKey({
      provider: "FXCM",
      marketType: "FOREX",
      symbol: "EURUSD",
    }));
  });

  it("cross-module identity agrees for same selection", () => {
    const a = identityFromSelectedMarket({
      venue: "binance-spot",
      symbol: "BTCUSDT",
      displaySymbol: "BTC/USDT",
      provider: "BINANCE",
    }, "15m");
    const b = identityFromSelectedMarket({
      venue: "binance-spot",
      symbol: "BTCUSDT",
      displaySymbol: "BTC/USDT",
      provider: "BINANCE",
    }, "15m");
    expect(identitiesAgree(a, b)).toBe(true);
    const fx = identityFromSelectedMarket({
      venue: "fxcm",
      symbol: "EUR/USD",
      displaySymbol: "EUR/USD",
      provider: "FXCM",
    }, "15m");
    expect(identitiesAgree(a, fx)).toBe(false);
  });

  it("AI/orchestrator/API/UI pass provider and refuse silent fallback", () => {
    const orch = read("ai/forex-ai/orchestrator.ts");
    expect(orch).toContain("getMarketDataService");
    expect(orch).toContain("resolveProvider");
    expect(orch).toMatch(/never silently|No silent|does not match the requested provider/i);

    const api = read("dev/server/forex-ai-api.ts");
    expect(api).toContain("provider");
    expect(api).toContain('toUpperCase() === "FXCM"');
    expect(api).toContain("provider,");

    const aiPage = read("desktop/forex/ForexAiAnalysisPage.tsx");
    expect(aiPage).toContain("provider");
    expect(aiPage).toContain("FXCM");
    expect(aiPage).toContain("data-ai-provider");

    const dash = read("desktop/forex/ForexDashboard.tsx");
    expect(dash).toContain("data-ms-provider");
    expect(dash).toContain("fxcmSelected");

    const admin = read("desktop/forex-admin/ForexAdminPages.tsx");
    expect(admin).toContain("data-forex-admin-unified-providers");
    expect(admin).toContain("unifiedStatus");
  });

  it("no fake market data / no trading execution in Phase 32 paths", () => {
    const orch = read("ai/forex-ai/orchestrator.ts");
    expect(orch).not.toMatch(/Math\.random/);
    expect(orch).not.toMatch(/fakePrice|mockCandles|simulatedPrice/);

    const dash = read("desktop/forex/ForexDashboard.tsx");
    expect(dash).toMatch(/No fake prices|no fake/i);

    const consistency = read("desktop/forex/market-data/cross-module-consistency.ts");
    expect(consistency).toContain("marketsAreDistinct");
    expect(consistency).not.toMatch(/Math\.random/);
  });

  it("watchlist and selected-market retain provider identity", () => {
    const watch = read("desktop/forex/market-data/session-watchlist.ts");
    expect(watch).toContain("kwizera-forex-watchlist-v2");
    expect(watch).toContain("provider");

    const modulePage = read("desktop/forex/ForexModulePage.tsx");
    expect(modulePage).toContain("data-watchlist-provider");
    expect(modulePage).toContain("removeSessionWatchlistSymbol(entry.symbol, entryProvider)");

    const bar = read("desktop/forex/SelectedMarketBar.tsx");
    expect(bar).toContain("Browse Markets");
    expect(bar).toContain("data-selected-provider");
  });
});
