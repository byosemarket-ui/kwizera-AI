import { describe, expect, it } from "vitest";
import { formatMoney, formatPrice, freshnessLabel, quoteDirection } from "../../../desktop/forex/hfm-dashboard/format";
import { resolveForexLocation, HFM_MT5_DASHBOARD_PATH } from "../../../desktop/forex/forex-routes";
import type { HfmQuoteState } from "../../../desktop/forex/hfm-dashboard/types";

describe("HFM dashboard Phase 2 helpers", () => {
  it("resolves the dedicated HFM dashboard route", () => {
    const loc = resolveForexLocation(HFM_MT5_DASHBOARD_PATH);
    expect(loc.view).toBe("hfm-mt5-dashboard");
    expect(loc.canonicalPath).toBe(HFM_MT5_DASHBOARD_PATH);
    expect(resolveForexLocation("/forex/hfm/dashboard").view).toBe("hfm-mt5-dashboard");
  });

  it("formats money without inventing values", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(100000, "USD")).toBe("USD 100,000.00");
  });

  it("formats prices with broker digits", () => {
    expect(formatPrice(1.10212, 5)).toBe("1.10212");
    expect(formatPrice(undefined, 5)).toBe("—");
  });

  it("labels freshness for UI", () => {
    expect(freshnessLabel("MARKET_CLOSED")).toBe("MARKET CLOSED");
    expect(freshnessLabel("LIVE")).toBe("LIVE");
  });

  it("derives tick direction only from prior mid", () => {
    const base: HfmQuoteState = {
      symbol: "EURUSD",
      bid: 1.1,
      ask: 1.1002,
      last: null,
      spread: 0.0002,
      digits: 5,
      point: 0.00001,
      tickTime: 1,
      tickVolume: null,
      freshness: "MARKET_CLOSED",
      prevMid: 1.1,
    };
    expect(quoteDirection({ ...base, bid: 1.1001, ask: 1.1003 })).toBe("up");
    expect(quoteDirection({ ...base, bid: 1.0998, ask: 1.1 })).toBe("down");
    expect(quoteDirection({ ...base, prevMid: null })).toBe("flat");
  });
});
