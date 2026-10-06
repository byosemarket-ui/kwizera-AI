import { describe, expect, it } from "vitest";
import { toDisplaySymbol } from "../../../ai/market-data/binance/adapter.ts";
import { allowDevelopmentMarketData, LIVE_MARKET_UNAVAILABLE, LIVE_PRICE_UNAVAILABLE } from "../../../desktop/forex/market-data/allow-development-market-data.ts";
import { fetchMarketSeries } from "../../../desktop/forex/chart/market-data.ts";
import { generateDevelopmentCandles } from "../../../desktop/forex/chart/development-provider.ts";
import { defaultSelectedMarket, parseSelectedMarket } from "../../../desktop/forex/market-data/selected-market.ts";
import { marketOverviewQuotes, quoteStatusLabel } from "../../../desktop/forex/dashboard-data.ts";

describe("Forex Phase 11 data integrity", () => {
  it("keeps development candle helpers gated for tests and never invents a default market", () => {
    expect(allowDevelopmentMarketData()).toBe(true);
    expect(generateDevelopmentCandles("EUR/USD", "1h").length).toBeGreaterThan(0);
    expect(defaultSelectedMarket()).toBeNull();
    expect(LIVE_MARKET_UNAVAILABLE.length).toBeGreaterThan(0);
    expect(LIVE_PRICE_UNAVAILABLE.length).toBeGreaterThan(0);
  });

  it("maps Binance symbols without collapsing quote assets to USD", () => {
    expect(toDisplaySymbol("EURUSDC")).toBe("EUR/USDC");
    expect(parseSelectedMarket("EURUSDC")?.displaySymbol).toBe("EUR/USDC");
    expect(parseSelectedMarket("EUR/USD")?.venue).toBe("unsupported");
    expect(parseSelectedMarket("EURUSD")?.venue).toBe("unsupported");
    expect(parseSelectedMarket("BTCUSDT")?.venue).toBe("binance-spot");
    expect(parseSelectedMarket("BTCUSDT")?.displaySymbol).toBe("BTC/USDT");
  });

  it("keeps market overview quotes empty of fabricated numbers", () => {
    for (const quote of marketOverviewQuotes()) {
      expect(quote.price).toBeNull();
      expect(quote.change).toBeNull();
      expect(quote.changePercent).toBeNull();
      expect(quote.volume).toBeNull();
      expect(quote.spread).toBeNull();
      expect(quote.high).toBeNull();
      expect(quote.low).toBeNull();
      expect(quote.status).toBe("not-connected");
      expect(quoteStatusLabel(quote.status)).toBe("Not connected");
    }
  });

  it("serves development series only through the gated loader under Vitest", () => {
    const ready = fetchMarketSeries("EUR/USD", "1h");
    expect(ready.state).toBe("ready");
    expect(ready.series?.kind).toBe("development");
  });
});
