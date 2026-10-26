/**
 * Phase 59.0.11 — live Offers vs verification-snapshot freshness + TradingStatus eligibility.
 * Mocks ≠ live FXCM. Never enables mutation or places orders.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  evaluateLiveOfferQuoteFreshness,
  evaluateVerificationQuoteFreshness,
  interpretOffersTradingStatus,
} from "../../../../ai/forex-ai/automated-trading/quote-freshness.ts";
import { normalizeFcOfferQuote } from "../../../../ai/market-data/forexconnect/live-candle-sync.ts";
import { resolveFcFeedStreamState } from "../../../../ai/market-data/forexconnect/stream-state.ts";
import { getDisabledBrokerMutationAdapter } from "../../../../ai/forex-ai/automated-trading/broker-intent/mutation-stub.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 59.0.11 TradingStatus eligibility", () => {
  it("fail-closes on C/CLOSED/unknown and opens only on O/OPEN", () => {
    expect(interpretOffersTradingStatus("C")).toMatchObject({
      code: "TRADING_STATUS_CLOSED",
      tradable: false,
    });
    expect(interpretOffersTradingStatus("CLOSED")).toMatchObject({
      code: "TRADING_STATUS_CLOSED",
      tradable: false,
    });
    expect(interpretOffersTradingStatus(null)).toMatchObject({
      code: "TRADING_STATUS_UNKNOWN",
      tradable: false,
    });
    expect(interpretOffersTradingStatus("Z")).toMatchObject({
      code: "TRADING_STATUS_UNKNOWN",
      tradable: false,
    });
    expect(interpretOffersTradingStatus("O")).toMatchObject({
      code: "TRADING_STATUS_OPEN",
      tradable: true,
    });
  });
});

describe("Phase 59.0.11 live vs heartbeat vs snapshot", () => {
  it("stream helper: recent receipt without price change is not LIVE", () => {
    expect(
      resolveFcFeedStreamState({
        priceChangeAgeMs: 60_000,
        receiptAgeMs: 200,
        updateCount: 10,
        staleMs: 15_000,
      }),
    ).toBe("NO_RECENT_MARKET_UPDATES");
    expect(
      resolveFcFeedStreamState({
        priceChangeAgeMs: 500,
        receiptAgeMs: 200,
        updateCount: 10,
        staleMs: 15_000,
      }),
    ).toBe("LIVE");
  });

  it("live evaluator: heartbeat-only never orderPathMarketReady", () => {
    const hb = evaluateLiveOfferQuoteFreshness({
      instrument: "XAU/USD",
      bid: 4011.85,
      ask: 4012.15,
      streamState: "NO_RECENT_MARKET_UPDATES",
      priceChangeAgeMs: 45_000,
      receiptAgeMs: 80,
      updateCount: 12,
      tradingStatus: "O",
      nowMs: Date.parse("2026-10-26T23:24:00.000Z"),
      staleMs: 15_000,
    });
    expect(hb.fresh).toBe(false);
    expect(hb.reasonCode).toBe("HEARTBEAT_ONLY_NO_PRICE_CHANGE");
    expect(hb.orderPathMarketReady).toBe(false);
    expect(hb.orderPathBlockerCode).toBe("LIVE_HEARTBEAT_ONLY");
  });

  it("live evaluator: LIVE_FRESH + TradingStatus C keeps order path blocked", () => {
    const closed = evaluateLiveOfferQuoteFreshness({
      instrument: "XAU/USD",
      bid: 4011.85,
      ask: 4012.15,
      streamState: "LIVE",
      priceChangeAgeMs: 400,
      receiptAgeMs: 400,
      updateCount: 50,
      tradingStatus: "C",
      nowMs: Date.parse("2026-10-26T23:24:00.000Z"),
      staleMs: 15_000,
    });
    expect(closed.fresh).toBe(true);
    expect(closed.reasonCode).toBe("LIVE_FRESH");
    expect(closed.tradingEligibility.tradable).toBe(false);
    expect(closed.orderPathMarketReady).toBe(false);
    expect(closed.orderPathBlockerCode).toBe("TRADING_STATUS_CLOSED");
  });

  it("live evaluator: LIVE_FRESH + O yields orderPathMarketReady without claiming broker acceptance", () => {
    const open = evaluateLiveOfferQuoteFreshness({
      instrument: "XAU/USD",
      bid: 4011.85,
      ask: 4012.15,
      streamState: "LIVE",
      priceChangeAgeMs: 400,
      receiptAgeMs: 400,
      updateCount: 50,
      tradingStatus: "O",
      nowMs: Date.parse("2026-10-26T23:24:00.000Z"),
      staleMs: 15_000,
    });
    expect(open.fresh).toBe(true);
    expect(open.orderPathMarketReady).toBe(true);
    expect(open.orderPathBlockerCode).toBeNull();
  });

  it("aged verification snapshot stays stale even when a parallel live feed would be fresh", () => {
    const verifiedAt = "2026-10-26T22:13:33.986Z";
    const nowMs = Date.parse("2026-10-26T23:24:14.000Z");
    const snap = evaluateVerificationQuoteFreshness(
      {
        verifiedAtUtc: verifiedAt,
        instrument: { symbol: "XAU/USD" },
        market: {
          bid: 4016.05,
          ask: 4016.35,
          feedStatus: "LIVE",
          priceChangeAgeMs: 90,
          receiptAgeMs: 90,
          updateCount: 1,
          sourceTimestampMs: 1793052813895,
          receivedAtMs: 1793052813895,
        },
      } as never,
      { nowMs, expectedInstrument: "XAU/USD", staleMs: 15_000 },
    );
    expect(snap.fresh).toBe(false);
    expect(snap.reasonCode).toBe("QUOTE_AGE_EXCEEDED");
    expect(snap.effectivePriceChangeAgeMs).toBeGreaterThan(15_000);
  });

  it("normalizeFcOfferQuote preserves tradingStatus from sidecar", () => {
    const n = normalizeFcOfferQuote({
      providerSymbol: "XAU/USD",
      canonicalSymbol: "XAUUSD",
      bid: 4011.85,
      ask: 4012.15,
      receivedAtMs: 1793057054444,
      eventSource: "offers-table-diff",
      tradingStatus: "O",
      offerId: "4001",
    });
    expect(n?.tradingStatus).toBe("O");
    expect(n?.bid).toBe(4011.85);
  });
});

describe("Phase 59.0.11 safety + sidecar overlay source gates", () => {
  it("DisabledBrokerMutationAdapter remains ordinary AT path", () => {
    const denied = getDisabledBrokerMutationAdapter().submit({});
    expect(denied).toMatchObject({
      ok: false,
      code: "EXECUTION_FORBIDDEN",
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    });
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("evaluateLiveOfferQuoteFreshness");
    expect(service).toContain("DisabledBrokerMutationAdapter");
    expect(service).toMatch(/placesOrders:\s*false/);
  });

  it("sidecar instruments_payload overlays live quotes without inventing TradingStatus", () => {
    const py = read("services/forexconnect-sidecar/server.py");
    expect(py).toContain("liveQuoteOverlay");
    expect(py).toContain("liveQuoteOverlayCount");
    expect(py).toContain('"tradingStatus": str(trading_status)');
    expect(py).toContain("Phase 59.0.11");
    expect(py).toContain("never invent O/C");
  });
});
