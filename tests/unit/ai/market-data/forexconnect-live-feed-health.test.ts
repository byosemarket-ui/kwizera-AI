/**
 * Hotfix — honest ForexConnect live feed health.
 * LIVE requires a recent bid/ask change; active same-price receipts are
 * NO_RECENT_MARKET_UPDATES; missing receipts are STALE.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  resolveFcFeedStreamState,
  resolveFcWaitingStreamState,
} from "../../../../ai/market-data/forexconnect/stream-state.ts";
import { UNIFIED_CONNECTION_STATES } from "../../../../ai/market-data/providers/contracts.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("ForexConnect live feed health (hotfix)", () => {
  it("classifies LIVE / NO_RECENT_MARKET_UPDATES / STALE honestly", () => {
    expect(resolveFcFeedStreamState({
      priceChangeAgeMs: 1_000,
      receiptAgeMs: 500,
      updateCount: 2,
    })).toBe("LIVE");

    expect(resolveFcFeedStreamState({
      priceChangeAgeMs: 20_000,
      receiptAgeMs: 500,
      updateCount: 2,
    })).toBe("NO_RECENT_MARKET_UPDATES");

    expect(resolveFcFeedStreamState({
      priceChangeAgeMs: 20_000,
      receiptAgeMs: 20_000,
      updateCount: 2,
    })).toBe("STALE");

    expect(resolveFcFeedStreamState({
      priceChangeAgeMs: null,
      receiptAgeMs: 500,
      updateCount: 0,
    })).toBe("MARKET_INACTIVE");

    expect(resolveFcFeedStreamState({
      priceChangeAgeMs: null,
      receiptAgeMs: null,
      updateCount: 0,
    })).toBe("SUBSCRIBED_WAITING");
  });

  it("keeps waiting-state helper for zero-update instruments", () => {
    expect(resolveFcWaitingStreamState("MARKET_INACTIVE", 0)).toBe("MARKET_INACTIVE");
    expect(resolveFcWaitingStreamState("NO_RECENT_MARKET_UPDATES", 0)).toBe("NO_RECENT_MARKET_UPDATES");
    expect(resolveFcWaitingStreamState("LIVE", 0)).toBe("SUBSCRIBED_WAITING");
  });

  it("wires NO_RECENT_MARKET_UPDATES through contracts, sidecar, and chart UI", () => {
    expect(UNIFIED_CONNECTION_STATES).toContain("NO_RECENT_MARKET_UPDATES");

    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).toContain('stream_state = "NO_RECENT_MARKET_UPDATES"');
    expect(sidecar).toContain("lastReceiptAt");
    expect(sidecar).toContain("must not set lastQuoteAt");

    const live = read("ai/market-data/forexconnect/live-service.ts");
    expect(live).toContain("lastPriceChangeAtMs");
    expect(live).toContain("resolveFcFeedStreamState");
    expect(live).toContain("NO_RECENT_MARKET_UPDATES");

    const unify = read("ai/market-data/providers/market-data-service.ts");
    expect(unify).toContain('result.streamState === "NO_RECENT_MARKET_UPDATES" ? "NO_RECENT_MARKET_UPDATES"');

    const chart = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(chart).toContain("NO_RECENT_MARKET_UPDATES · Offers active, bid/ask flat");
    expect(chart).toContain("data-fx-feed-state");
    expect(chart).toContain("price-change age");
  });

  it("preserves Phase 47B/47C account snapshot contracts", () => {
    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).toContain("def accounts_payload");
    expect(sidecar).toContain("BASE_CRNCY");
    expect(sidecar).toContain("currencySource");

    const client = read("ai/market-data/forexconnect/client.ts");
    expect(client).toContain('"/accounts"');
    expect(client).toContain("listAccounts");
  });
});
