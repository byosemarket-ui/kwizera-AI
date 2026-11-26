/**
 * STEP 1B / B1 — UTC timestamp normalization unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  deriveHfmBrokerUtcOffset,
  normalizeHfmQuoteTimestamps,
} from "../../../../ai/market-data/mt5-hfm/quote-timestamp";
import { validateHfmRawQuote } from "../../../../ai/market-data/mt5-hfm/quote-validation";
import { mifQuoteFromHfmCanonical } from "../../../../ai/market-data/mt5-hfm/mif/canonical/quote";
import type { HfmCatalogInstrument } from "../../../../ai/market-data/mt5-hfm/catalog-types";

const receivedAt = "2026-01-01T12:00:00.000Z";
const receivedAtSec = Math.floor(Date.parse(receivedAt) / 1000); // 1767273600

const catalog = new Map<string, HfmCatalogInstrument>([
  [
    "EURUSD",
    {
      symbol: "EURUSD",
      digits: 5,
      point: 0.00001,
      tickSize: 0.00001,
      catalogVersion: "t",
    } as HfmCatalogInstrument,
  ],
]);

describe("B1 deriveHfmBrokerUtcOffset", () => {
  it("derives UTC+2 (+7200) from brokerTime - gmtTime", () => {
    const r = deriveHfmBrokerUtcOffset({
      brokerTime: receivedAtSec + 7200,
      gmtTime: receivedAtSec,
    });
    expect(r.brokerUtcOffsetSec).toBe(7200);
    expect(r.status).toBe("NORMALIZED");
    expect(r.reason).toBeNull();
  });

  it("derives UTC+3 (+10800)", () => {
    const r = deriveHfmBrokerUtcOffset({
      brokerTime: receivedAtSec + 10800,
      gmtTime: receivedAtSec,
    });
    expect(r.brokerUtcOffsetSec).toBe(10800);
    expect(r.status).toBe("NORMALIZED");
  });

  it("derives UTC+0", () => {
    const r = deriveHfmBrokerUtcOffset({
      brokerTime: receivedAtSec,
      gmtTime: receivedAtSec,
    });
    expect(r.brokerUtcOffsetSec).toBe(0);
    expect(r.status).toBe("NORMALIZED");
  });

  it("handles offset change between snapshots (DST-like)", () => {
    const winter = deriveHfmBrokerUtcOffset({
      brokerTime: 1_700_000_000 + 7200,
      gmtTime: 1_700_000_000,
    });
    const summer = deriveHfmBrokerUtcOffset({
      brokerTime: 1_715_000_000 + 10800,
      gmtTime: 1_715_000_000,
    });
    expect(winter.brokerUtcOffsetSec).toBe(7200);
    expect(summer.brokerUtcOffsetSec).toBe(10800);
    expect(winter.status).toBe("NORMALIZED");
    expect(summer.status).toBe("NORMALIZED");
  });

  it("marks missing gmtTime UNAVAILABLE", () => {
    const r = deriveHfmBrokerUtcOffset({ brokerTime: receivedAtSec + 7200, gmtTime: null });
    expect(r.brokerUtcOffsetSec).toBeNull();
    expect(r.status).toBe("UNAVAILABLE");
    expect(r.reason).toBe("MISSING_GMT_TIME");
  });

  it("marks missing brokerTime UNAVAILABLE", () => {
    const r = deriveHfmBrokerUtcOffset({ brokerTime: null, gmtTime: receivedAtSec });
    expect(r.brokerUtcOffsetSec).toBeNull();
    expect(r.status).toBe("UNAVAILABLE");
    expect(r.reason).toBe("MISSING_BROKER_TIME");
  });

  it("rejects absurd offsets beyond ±14h as UNRELIABLE", () => {
    const r = deriveHfmBrokerUtcOffset({
      brokerTime: receivedAtSec + 20 * 3600,
      gmtTime: receivedAtSec,
    });
    expect(r.brokerUtcOffsetSec).toBeNull();
    expect(r.status).toBe("UNRELIABLE");
    expect(r.reason).toBe("OFFSET_ABS_EXCEEDS_14H");
  });

  it("marks non-quarter-hour offsets PARTIAL but still returns offset", () => {
    const r = deriveHfmBrokerUtcOffset({
      brokerTime: receivedAtSec + 7333,
      gmtTime: receivedAtSec,
    });
    expect(r.brokerUtcOffsetSec).toBe(7333);
    expect(r.status).toBe("PARTIAL");
    expect(r.reason).toBe("OFFSET_NOT_QUARTER_HOUR_ALIGNED");
  });
});

describe("B1 normalizeHfmQuoteTimestamps", () => {
  it("converts broker tick to UTC using derived offset (same instant)", () => {
    const brokerTick = receivedAtSec + 7200;
    const r = normalizeHfmQuoteTimestamps({
      quoteTimestampSec: brokerTick,
      quoteTimestampMs: brokerTick * 1000 + 123,
      brokerUtcOffsetSec: 7200,
      offsetStatus: "NORMALIZED",
      offsetReason: null,
      acquisitionMethod: "SymbolInfoTick",
      receivedAtUtcSec: receivedAtSec,
    });
    expect(r.quoteTimestamp).toBe(brokerTick);
    expect(r.quoteTimestampUtc).toBe(receivedAtSec);
    expect(r.quoteTimestampUtcMs).toBe(receivedAtSec * 1000 + 123);
    expect(r.brokerUtcOffsetSec).toBe(7200);
    expect(r.clockSkewSec).toBe(7200);
    expect(r.timestampSource).toBe("mt5_tick");
    expect(r.timestampNormalizationStatus).toBe("NORMALIZED");
  });

  it("does not fabricate UTC when offset unavailable", () => {
    const r = normalizeHfmQuoteTimestamps({
      quoteTimestampSec: receivedAtSec + 7200,
      quoteTimestampMs: null,
      brokerUtcOffsetSec: null,
      offsetStatus: "UNAVAILABLE",
      offsetReason: "MISSING_GMT_TIME",
      acquisitionMethod: "SymbolInfoTick",
      receivedAtUtcSec: receivedAtSec,
    });
    expect(r.quoteTimestampUtc).toBeNull();
    expect(r.quoteTimestampUtcMs).toBeNull();
    expect(r.timestampNormalizationStatus).toBe("UNAVAILABLE");
    expect(r.clockSkewSec).toBe(7200);
  });

  it("does not fabricate UTC when offset unreliable", () => {
    const r = normalizeHfmQuoteTimestamps({
      quoteTimestampSec: receivedAtSec + 20 * 3600,
      quoteTimestampMs: null,
      brokerUtcOffsetSec: null,
      offsetStatus: "UNRELIABLE",
      offsetReason: "OFFSET_ABS_EXCEEDS_14H",
      acquisitionMethod: "SymbolInfoDouble",
      receivedAtUtcSec: receivedAtSec,
    });
    expect(r.quoteTimestampUtc).toBeNull();
    expect(r.timestampSource).toBe("mt5_symbol_time");
    expect(r.timestampNormalizationStatus).toBe("UNRELIABLE");
  });

  it("keeps ms and seconds domains consistent", () => {
    const brokerTick = receivedAtSec + 10800;
    const r = normalizeHfmQuoteTimestamps({
      quoteTimestampSec: brokerTick,
      quoteTimestampMs: brokerTick * 1000,
      brokerUtcOffsetSec: 10800,
      offsetStatus: "NORMALIZED",
      offsetReason: null,
      acquisitionMethod: "SymbolInfoTick",
      receivedAtUtcSec: receivedAtSec,
    });
    expect(r.quoteTimestampUtc).toBe(receivedAtSec);
    expect(r.quoteTimestampUtcMs).toBe(receivedAtSec * 1000);
    expect(Math.floor((r.quoteTimestampUtcMs ?? 0) / 1000)).toBe(r.quoteTimestampUtc);
  });
});

describe("B1 validateHfmRawQuote timestamp contract", () => {
  it("preserves broker timestamp and emits UTC fields when clocks provided", () => {
    const tickTime = receivedAtSec + 7200;
    const { accepted, quote } = validateHfmRawQuote(
      {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.10017,
        tickTime,
        tickTimeMs: tickTime * 1000 + 50,
        digits: 5,
        point: 0.00001,
        acquisitionMethod: "SymbolInfoTick",
      },
      {
        receivedAt,
        server: "HFMarketsGlobal-Demo",
        sequence: 9,
        catalogBySymbol: catalog,
        requireCatalogMatch: true,
        brokerTime: receivedAtSec + 7200,
        gmtTime: receivedAtSec,
      },
    );
    expect(accepted).toBe(true);
    expect(quote.quoteTimestamp).toBe(tickTime);
    expect(quote.quoteTimestampUtc).toBe(receivedAtSec);
    expect(quote.quoteTimestampUtcMs).toBe(receivedAtSec * 1000 + 50);
    expect(quote.brokerUtcOffsetSec).toBe(7200);
    expect(quote.receivedAtUtc).toBe(receivedAt);
    expect(quote.receivedAt).toBe(receivedAt);
    expect(quote.clockSkewSec).toBe(7200);
    expect(quote.timestampSource).toBe("mt5_tick");
    expect(quote.timestampNormalizationStatus).toBe("NORMALIZED");
    expect(quote.timestampNormalizationReason).toBeNull();
    // With trusted offset, raw aheadness is explained — do not warn BROKER_TIME_AHEAD.
    expect(quote.validation.warnings).not.toContain("BROKER_TIME_AHEAD_OF_UTC");
    // Spread unchanged.
    expect(quote.spread).toBe(0.00017);
    expect(quote.spreadPoints).toBe(17);
  });

  it("keeps BROKER_TIME_AHEAD_OF_UTC when offset unavailable", () => {
    const tickTime = receivedAtSec + 7200;
    const { accepted, quote } = validateHfmRawQuote(
      { symbol: "EURUSD", bid: 1.1, ask: 1.1001, tickTime },
      {
        receivedAt,
        server: null,
        sequence: 1,
        catalogBySymbol: catalog,
        requireCatalogMatch: true,
      },
    );
    expect(accepted).toBe(true);
    expect(quote.quoteTimestampUtc).toBeNull();
    expect(quote.timestampNormalizationStatus).toBe("UNAVAILABLE");
    expect(quote.validation.warnings).toContain("BROKER_TIME_AHEAD_OF_UTC");
  });

  it("hard-rejects absurd future even after normalization attempt", () => {
    const tickTime = receivedAtSec + 48 * 3600;
    const { accepted, quote } = validateHfmRawQuote(
      { symbol: "EURUSD", bid: 1.1, ask: 1.1001, tickTime },
      {
        receivedAt,
        server: null,
        sequence: 1,
        catalogBySymbol: catalog,
        requireCatalogMatch: true,
        brokerTime: receivedAtSec + 7200,
        gmtTime: receivedAtSec,
      },
    );
    // Normalized UTC = tick - 7200 = received + 48h - 2h = still ~46h ahead → reject.
    expect(accepted).toBe(false);
    expect(quote.validation.errors).toContain("FUTURE_TIMESTAMP");
  });

  it("maps derived offset into MIF timezoneOffsetSec without inventing timebase UTC", () => {
    const tickTime = receivedAtSec + 7200;
    const { quote } = validateHfmRawQuote(
      { symbol: "EURUSD", bid: 1.1, ask: 1.1001, tickTime, acquisitionMethod: "SymbolInfoTick" },
      {
        receivedAt,
        server: null,
        sequence: 1,
        catalogBySymbol: catalog,
        requireCatalogMatch: true,
        brokerTime: receivedAtSec + 7200,
        gmtTime: receivedAtSec,
      },
    );
    const mif = mifQuoteFromHfmCanonical(quote);
    expect(mif.timebase).toBe("BROKER_SERVER");
    expect(mif.timezoneOffsetSec).toBe(7200);
    expect(mif.quoteTimestampSec).toBe(tickTime);
  });
});
