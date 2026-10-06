import { describe, expect, it } from "vitest";
import { parseChartSymbol } from "../../../desktop/forex/chart/market-data.ts";
import { toDisplaySymbol } from "../../../ai/market-data/binance/adapter.ts";
import { parseSelectedMarket } from "../../../desktop/forex/market-data/selected-market.ts";

describe("Forex Phase 13 consistency guards", () => {
  it("never invents EUR/USD for Binance compact symbols in chart parsers", () => {
    expect(parseChartSymbol("BTCUSDT")).toBe("BTCUSDT");
    expect(parseChartSymbol("ETHUSDT")).toBe("ETHUSDT");
    expect(parseChartSymbol("EURUSDC")).toBe("EURUSDC");
    expect(parseChartSymbol("EURUSDC")).not.toBe("EUR/USD");
    expect(parseChartSymbol(null)).toBe("");
  });

  it("keeps Binance display identity accurate", () => {
    expect(toDisplaySymbol("BTCUSDT")).toBe("BTC/USDT");
    expect(toDisplaySymbol("ETHUSDT")).toBe("ETH/USDT");
    expect(toDisplaySymbol("BNBUSDT")).toBe("BNB/USDT");
    expect(toDisplaySymbol("SOLUSDT")).toBe("SOL/USDT");
    expect(toDisplaySymbol("EURUSDC")).toBe("EUR/USDC");
    expect(parseSelectedMarket("EURUSDC")?.displaySymbol).toBe("EUR/USDC");
    expect(parseSelectedMarket("EUR/USD")?.venue).toBe("unsupported");
  });
});
