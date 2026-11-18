/**
 * Phase 5B.2 Step 2 — quote quality tests.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifQuoteQuality,
  MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS,
  MIF_QI_MISSING_BID,
  MIF_QI_MISSING_ASK,
  MIF_QI_INVALID_BID,
  MIF_QI_CROSSED_QUOTE,
  MIF_QI_QUOTE_MISSING,
  MIF_QI_QUOTE_FRESH,
  MIF_QI_QUOTE_DELAYED,
  MIF_QI_QUOTE_STALE,
  MIF_QI_QUOTE_FRESHNESS_UNKNOWN,
  MIF_QI_CLOCK_DOMAINS_INCOMPARABLE,
  MIF_QI_TIMEBASE_UNCERTAIN,
  type MifCanonicalQuote,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import {
  MIF_MARKET_DATA_CONTRACT_ID,
  MIF_MARKET_DATA_CONTRACT_VERSION,
  MIF_PROVIDER_ID,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function quote(over: Partial<MifCanonicalQuote> = {}): MifCanonicalQuote {
  return {
    contractId: MIF_MARKET_DATA_CONTRACT_ID,
    contractVersion: MIF_MARKET_DATA_CONTRACT_VERSION,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: "XAUUSD",
    bid: 2000,
    ask: 2000.5,
    last: null,
    spread: 0.5,
    spreadPoints: null,
    brokerSpreadPoints: null,
    tickVolume: null,
    realVolume: null,
    quoteTimestampSec: 1_700_000_000,
    quoteTimestampMs: 1_700_000_000_000,
    receivedAt: "2023-11-14T22:13:20.000Z",
    availableAt: "2023-11-14T22:13:20.000Z",
    availabilityStatus: "KNOWN",
    timebase: "BROKER_SERVER",
    timezoneOffsetSec: null,
    status: "LIVE",
    sourceDialect: "hfm.canonical-quote",
    sourceProvenance: "test",
    validation: { status: "ok", errors: [], warnings: [] },
    instrument: null,
    digits: 2,
    point: 0.01,
    tickSize: 0.01,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    ...over,
  };
}

describe("Phase 5B.2 Step2 — quote integrity", () => {
  it("accepts valid bid/ask and computes spread", () => {
    const r = assessMifQuoteQuality({
      quote: quote(),
      providerSymbol: "XAUUSD",
      requireQuote: true,
      freshnessProfile: null,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
      nowSec: 1_700_000_010,
    });
    expect(r.computedSpread).toBe(0.5);
    expect(r.blockingCodes.length).toBe(0);
    expect(r.doesNotApproveAiReasoning).toBe(true);
    expect(r.placesOrders).toBe(false);
  });

  it("rejects missing/invalid/crossed quotes", () => {
    expect(
      assessMifQuoteQuality({
        quote: quote({ bid: null }),
        providerSymbol: "XAUUSD",
        requireQuote: true,
      }).findings.some((f) => f.code === MIF_QI_MISSING_BID),
    ).toBe(true);

    expect(
      assessMifQuoteQuality({
        quote: quote({ ask: null }),
        providerSymbol: "XAUUSD",
        requireQuote: true,
      }).findings.some((f) => f.code === MIF_QI_MISSING_ASK),
    ).toBe(true);

    expect(
      assessMifQuoteQuality({
        quote: quote({ bid: Number.NaN }),
        providerSymbol: "XAUUSD",
        requireQuote: true,
      }).status,
    ).toBe("BLOCKED");
    expect(
      assessMifQuoteQuality({
        quote: quote({ bid: Number.NaN }),
        providerSymbol: "XAUUSD",
        requireQuote: true,
      }).findings.some((f) => f.code === MIF_QI_INVALID_BID),
    ).toBe(true);

    const crossed = assessMifQuoteQuality({
      quote: quote({ bid: 10, ask: 9, spread: -1 }),
      providerSymbol: "XAUUSD",
      requireQuote: true,
    });
    expect(crossed.findings.some((f) => f.code === MIF_QI_CROSSED_QUOTE)).toBe(true);
    expect(crossed.status).toBe("BLOCKED");
  });

  it("allows zero spread; candle-only consumer does not require quote", () => {
    const zero = assessMifQuoteQuality({
      quote: quote({ bid: 1.1, ask: 1.1, spread: 0 }),
      providerSymbol: "XAUUSD",
      requireQuote: false,
      freshnessProfile: null,
    });
    expect(zero.computedSpread).toBe(0);
    expect(zero.status === "VALID" || zero.status === "WARNING").toBe(true);

    const none = assessMifQuoteQuality({
      quote: null,
      providerSymbol: "XAUUSD",
      requireQuote: false,
    });
    expect(none.quotePresent).toBe(false);
    expect(none.findings.some((f) => f.code === MIF_QI_QUOTE_MISSING)).toBe(false);
    expect(none.status).toBe("VALID");

    const required = assessMifQuoteQuality({
      quote: null,
      providerSymbol: "XAUUSD",
      requireQuote: true,
    });
    expect(required.status).toBe("BLOCKED");
    expect(required.findings.some((f) => f.code === MIF_QI_QUOTE_MISSING)).toBe(true);
  });
});

describe("Phase 5B.2 Step2 — quote freshness & timebase", () => {
  it("unknown freshness without profile or comparable clocks", () => {
    const noProfile = assessMifQuoteQuality({
      quote: quote({ timebase: "UTC" }),
      providerSymbol: "XAUUSD",
      requireQuote: true,
      freshnessProfile: null,
      nowSec: 1_700_000_005,
    });
    expect(noProfile.freshness).toBe("UNKNOWN");

    const brokerNoHeuristic = assessMifQuoteQuality({
      quote: quote({ timebase: "BROKER_SERVER", timezoneOffsetSec: null }),
      providerSymbol: "XAUUSD",
      requireQuote: true,
      freshnessProfile: {
        profileId: "strict",
        profileVersion: "1",
        liveMaxAgeSec: 15,
        staleMaxAgeSec: 180,
        allowBrokerServerVsWallClockHeuristic: false,
      },
      nowSec: 1_700_000_005,
    });
    expect(brokerNoHeuristic.freshness).toBe("UNKNOWN");
    expect(
      brokerNoHeuristic.findings.some(
        (f) =>
          f.code === MIF_QI_CLOCK_DOMAINS_INCOMPARABLE ||
          f.code === MIF_QI_QUOTE_FRESHNESS_UNKNOWN,
      ),
    ).toBe(true);
  });

  it("UNKNOWN timebase never claims LIVE/FRESH", () => {
    const r = assessMifQuoteQuality({
      quote: quote({ timebase: "UNKNOWN" }),
      providerSymbol: "XAUUSD",
      requireQuote: true,
      freshnessProfile: MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS,
      nowSec: 1_700_000_001,
    });
    expect(r.freshness).toBe("UNKNOWN");
    expect(r.findings.some((f) => f.code === MIF_QI_TIMEBASE_UNCERTAIN)).toBe(true);
    expect(r.findings.some((f) => f.code === MIF_QI_QUOTE_FRESH)).toBe(false);
  });

  it("hfm-analysis profile classifies fresh/delayed/stale via named heuristic", () => {
    const fresh = assessMifQuoteQuality({
      quote: quote({ quoteTimestampSec: 1_700_000_000 }),
      providerSymbol: "XAUUSD",
      requireQuote: true,
      freshnessProfile: MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS,
      nowSec: 1_700_000_010,
    });
    expect(fresh.freshness).toBe("FRESH");
    expect(fresh.findings.some((f) => f.code === MIF_QI_QUOTE_FRESH)).toBe(true);

    const delayed = assessMifQuoteQuality({
      quote: quote({ quoteTimestampSec: 1_700_000_000 }),
      providerSymbol: "XAUUSD",
      requireQuote: true,
      freshnessProfile: MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS,
      nowSec: 1_700_000_060,
    });
    expect(delayed.freshness).toBe("DELAYED");
    expect(delayed.findings.some((f) => f.code === MIF_QI_QUOTE_DELAYED)).toBe(true);

    const stale = assessMifQuoteQuality({
      quote: quote({ quoteTimestampSec: 1_700_000_000 }),
      providerSymbol: "XAUUSD",
      requireQuote: true,
      freshnessProfile: MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS,
      nowSec: 1_700_000_200,
    });
    expect(stale.freshness).toBe("STALE");
    expect(stale.status).toBe("DEGRADED");
    expect(stale.findings.some((f) => f.code === MIF_QI_QUOTE_STALE)).toBe(true);
  });

  it("UTC same-domain comparison works without heuristic", () => {
    const r = assessMifQuoteQuality({
      quote: quote({ timebase: "UTC", quoteTimestampSec: 1_700_000_000 }),
      providerSymbol: "XAUUSD",
      requireQuote: true,
      freshnessProfile: {
        profileId: "utc-only",
        profileVersion: "1",
        liveMaxAgeSec: 15,
        staleMaxAgeSec: 180,
        allowBrokerServerVsWallClockHeuristic: false,
      },
      nowSec: 1_700_000_005,
    });
    expect(r.freshness).toBe("FRESH");
  });

  it("deterministic identity ignores wall-clock assessment time", () => {
    const q = quote();
    const a = assessMifQuoteQuality({
      quote: q,
      providerSymbol: "XAUUSD",
      requireQuote: true,
      freshnessProfile: MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS,
      nowSec: 1_700_000_010,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const b = assessMifQuoteQuality({
      quote: q,
      providerSymbol: "XAUUSD",
      requireQuote: true,
      freshnessProfile: MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS,
      nowSec: 1_700_000_999,
      assessmentTimestamp: "2025-01-01T00:00:00.000Z",
    });
    expect(a.inputIdentity).toBe(b.inputIdentity);

    const c = assessMifQuoteQuality({
      quote: quote({ bid: 2001 }),
      providerSymbol: "XAUUSD",
      requireQuote: true,
      freshnessProfile: MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS,
      nowSec: 1_700_000_010,
    });
    expect(c.inputIdentity).not.toBe(a.inputIdentity);
  });
});
