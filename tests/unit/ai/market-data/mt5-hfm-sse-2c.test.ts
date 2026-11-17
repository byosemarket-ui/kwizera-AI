import { describe, expect, it, beforeEach } from "vitest";
import {
  assertHfmSseEnvelope,
  buildEnvelope,
  MT5_HFM_SSE_SCHEMA_VERSION,
  MT5_HFM_BROKER_ID,
} from "../../../../ai/market-data/mt5-hfm/event-contract";
import {
  freshnessFromQuoteStatus,
  resetHfmSseDistributionForTests,
  resolveHfmSseReplay,
  recordHfmSsePublished,
  shouldDistributeQuoteEvent,
  getHfmSseDistributionMetrics,
} from "../../../../ai/market-data/mt5-hfm/sse-distribution";

describe("HFM STEP 2C event contract", () => {
  it("builds schemaVersion envelope and rejects wrong provider", () => {
    const env = buildEnvelope(
      "quote",
      { symbol: "EURUSD", bid: 1.1, ask: 1.1002, subtype: "quote.updated" },
      {
        eventId: "e1",
        seq: 1,
        serverReceivedAt: "2026-11-17T10:00:00Z",
        freshness: "LIVE",
      },
    );
    expect(env.schemaVersion).toBe(MT5_HFM_SSE_SCHEMA_VERSION);
    expect(env.broker).toBe(MT5_HFM_BROKER_ID);
    expect(env.occurredAt).toBeTruthy();
    expect(assertHfmSseEnvelope(env).ok).toBe(true);
    expect(assertHfmSseEnvelope({ ...env, broker: "FXCM" }).ok).toBe(false);
    expect(assertHfmSseEnvelope({ ...env, environment: "live" }).errors).toContain("ENVIRONMENT_MISMATCH");
  });
});

describe("HFM STEP 2C distribution gate", () => {
  beforeEach(() => {
    resetHfmSseDistributionForTests();
  });

  it("rejects invalid and wrong-provider quotes", () => {
    expect(
      shouldDistributeQuoteEvent({
        provider: "HFM_MT5",
        environment: "demo",
        bid: 1.1,
        ask: 1.1001,
        status: "LIVE",
      }).ok,
    ).toBe(true);
    expect(
      shouldDistributeQuoteEvent({
        provider: "FXCM",
        environment: "demo",
        bid: 1.1,
        ask: 1.1001,
        status: "LIVE",
      }).reason,
    ).toBe("PROVIDER_MISMATCH");
    expect(
      shouldDistributeQuoteEvent({
        provider: "HFM_MT5",
        environment: "demo",
        bid: 1.2,
        ask: 1.1,
        status: "LIVE",
      }).ok,
    ).toBe(false);
    expect(
      shouldDistributeQuoteEvent({
        provider: "HFM_MT5",
        environment: "demo",
        bid: 1.1,
        ask: 1.1001,
        status: "INVALID",
      }).reason,
    ).toBe("INVALID_QUOTE");
  });

  it("never maps stale LKG status to LIVE", () => {
    expect(freshnessFromQuoteStatus("STALE", "LIVE")).toBe("STALE");
    expect(freshnessFromQuoteStatus("MARKET_CLOSED", "LIVE")).toBe("MARKET_CLOSED");
    expect(freshnessFromQuoteStatus("NO_QUOTE", "LIVE")).toBe("WAITING_FOR_DATA");
    expect(freshnessFromQuoteStatus("LIVE", "MARKET_CLOSED")).toBe("MARKET_CLOSED");
  });

  it("replays retained Last-Event-ID or falls back to snapshot", () => {
    const a = buildEnvelope("heartbeat", { n: 1 }, {
      eventId: "id-a",
      serverReceivedAt: "2026-11-17T10:00:00Z",
      freshness: "LIVE",
    });
    const b = buildEnvelope("heartbeat", { n: 2 }, {
      eventId: "id-b",
      serverReceivedAt: "2026-11-17T10:00:01Z",
      freshness: "LIVE",
    });
    recordHfmSsePublished(a, 10);
    recordHfmSsePublished(b, 10);
    const hit = resolveHfmSseReplay("id-a");
    expect(hit.mode).toBe("replay");
    expect(hit.envelopes.map((e) => e.eventId)).toEqual(["id-b"]);
    const miss = resolveHfmSseReplay("missing");
    expect(miss.mode).toBe("snapshot_fallback");
    expect(getHfmSseDistributionMetrics().replayMisses).toBeGreaterThanOrEqual(1);
  });
});
