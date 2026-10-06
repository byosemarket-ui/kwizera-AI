import { describe, expect, it } from "vitest";
import { idleLiveTickerSnapshot } from "../../../ai/market-data/binance/live-ticker.ts";
import { buildBinanceOverviewEntries, overviewPriceLabel } from "../../../desktop/forex/market-data/binance-overview.ts";
import type { SelectedMarket } from "../../../desktop/forex/market-data/selected-market.ts";

describe("Forex Phase 12 central Binance overview", () => {
  it("builds overview from selected Binance market without traditional FX labels", () => {
    const selected: SelectedMarket = {
      venue: "binance-spot",
      symbol: "BTCUSDT",
      displaySymbol: "BTC/USDT",
    };
    const idle = idleLiveTickerSnapshot();
    const entries = buildBinanceOverviewEntries(selected, idle);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.market.symbol).toBe("BTCUSDT");
    expect(entries[0]?.market.displaySymbol).toBe("BTC/USDT");
    expect(entries[0]?.quote.price).toBeNull();
    expect(entries[0]?.active).toBe(true);
    expect(overviewPriceLabel(entries[0]!.quote)).not.toMatch(/1\.088|EUR\/USD/);
  });

  it("attaches live price only when ticker matches the selected symbol", () => {
    const selected: SelectedMarket = {
      venue: "binance-spot",
      symbol: "ETHUSDT",
      displaySymbol: "ETH/USDT",
    };
    const live = {
      ...idleLiveTickerSnapshot(),
      connectionState: "CONNECTED" as const,
      liveMarketData: true,
      websocketActive: true,
      subscribedSymbol: "ETHUSDT",
      ticker: {
        venue: "binance-spot" as const,
        symbol: "ETHUSDT",
        displaySymbol: "ETH/USDT",
        price: 2500.5,
        eventTimeUtc: 1,
        receivedAtUtc: 1,
        source: "binance-spot-public" as const,
        streamType: "miniTicker" as const,
        open: null,
        high: null,
        low: null,
      },
    };
    const entries = buildBinanceOverviewEntries(selected, live);
    expect(entries[0]?.quote.price).toBe(2500.5);
    expect(entries[0]?.quote.status).toBe("ready");
    expect(entries[0]?.quote.dataSource).toBe("binance-spot-public");
    expect(overviewPriceLabel(entries[0]!.quote)).toContain("2,500");
  });

  it("keeps EURUSDC display identity as EUR/USDC", () => {
    const selected: SelectedMarket = {
      venue: "binance-spot",
      symbol: "EURUSDC",
      displaySymbol: "EUR/USDC",
    };
    const entries = buildBinanceOverviewEntries(selected, idleLiveTickerSnapshot());
    expect(entries[0]?.market.displaySymbol).toBe("EUR/USDC");
    expect(entries[0]?.market.displaySymbol).not.toBe("EUR/USD");
  });
});
