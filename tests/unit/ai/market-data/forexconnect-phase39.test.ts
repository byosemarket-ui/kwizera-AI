/**
 * Phase 39 — ForexConnect live-market honesty: seeds ≠ LIVE, snapshot prefers live series,
 * quote freshness follows session streamState, genuine eventSource preserved.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  isGenuineFcOfferEventSource,
  normalizeFcOfferQuote,
} from "../../../../ai/market-data/forexconnect/live-candle-sync.ts";
import { resolveFcWaitingStreamState } from "../../../../ai/market-data/forexconnect/stream-state.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 39 ForexConnect live audit contracts", () => {
  it("does not treat historical-only or zero updateCount as LIVE stream health", () => {
    expect(resolveFcWaitingStreamState("LIVE", 0)).toBe("SUBSCRIBED_WAITING");
    expect(resolveFcWaitingStreamState("MARKET_INACTIVE", 0)).toBe("MARKET_INACTIVE");
    expect(isGenuineFcOfferEventSource(undefined)).toBe(false);
    expect(isGenuineFcOfferEventSource("seed")).toBe(false);
    expect(isGenuineFcOfferEventSource("offers-callback")).toBe(true);
    expect(isGenuineFcOfferEventSource("offers-table-diff")).toBe(true);
  });

  it("preserves sidecar eventSource and receipt timestamps through quote normalization", () => {
    const seeded = normalizeFcOfferQuote({
      providerSymbol: "EUR/USD",
      canonicalSymbol: "EURUSD",
      bid: 1.1,
      ask: 1.1001,
      receivedAtMs: 1_700_000_000_000,
    });
    expect(seeded?.eventSource).toBeNull();
    expect(seeded?.receivedAtMs).toBe(1_700_000_000_000);

    const live = normalizeFcOfferQuote({
      providerSymbol: "EUR/USD",
      canonicalSymbol: "EURUSD",
      bid: 1.101,
      ask: 1.1012,
      receivedAt: "2026-10-12T09:00:00.000Z",
      eventSource: "offers-callback",
      sourceTimestampMs: 1_760_256_000_000,
    });
    expect(live?.eventSource).toBe("offers-callback");
    expect(live?.sourceTimestampMs).toBe(1_760_256_000_000);
    expect(live?.receivedAtMs).toBe(Date.parse("2026-10-12T09:00:00.000Z"));
  });

  it("live service bootstraps from genuine peer-LIVE Offers without inventing ticks", () => {
    const live = read("ai/market-data/forexconnect/live-service.ts");
    expect(live).toContain("bootstrapFromLivePeer");
    expect(live).toContain("isGenuineFcOfferEventSource");
    expect(live).toContain("getLatestQuoteState");
    expect(live).not.toMatch(/\binvent(?:Ticks|Prices|Candles)\b/);
    expect(live).not.toMatch(/\bfake(?:Tick|Quote|Candle)\s*\(/);
  });

  it("MarketDataService snapshot prefers ForexConnect live series and DEMO/LIVE environment", () => {
    const svc = read("ai/market-data/providers/market-data-service.ts");
    expect(svc).toContain('providerId === "FXCM" || providerId === "FOREXCONNECT"');
    expect(svc).toContain("getLiveCandleSeries");
    expect(svc).toContain('providerId === "FOREXCONNECT"');
    expect(svc).toContain("getLatestQuoteState");
    expect(svc).toContain("getBridge().getConfig().environment");
    // Must not hard-label every FC quote LIVE.
    expect(svc).toMatch(/const isLive = streamState === "LIVE" && state\.updateCount > 0/);
  });

  it("sidecar stream status exposes latency limitation when provider event time is unavailable", () => {
    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).toContain("providerEventTimestampAvailable");
    expect(sidecar).toContain("sidecarReceiptAgeMs");
    expect(sidecar).toContain('require_change and prev is not None');
    expect(sidecar).toContain('stream_state = "MARKET_INACTIVE"');
  });

  it("frontend Charts continue to request ForexConnect mode=live", () => {
    const hook = read("desktop/forex/market-data/use-unified-candles.ts");
    expect(hook).toContain('nextProvider === "FXCM" || nextProvider === "FOREXCONNECT" ? "live"');
    expect(hook).toContain('mode: "live"');
  });
});
