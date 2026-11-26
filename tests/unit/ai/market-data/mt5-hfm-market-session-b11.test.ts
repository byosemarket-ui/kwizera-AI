/**
 * STEP 1B.1 — market session awareness + closed-market timestamp protection.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  classifyHfmMarketSession,
  brokerDayOfWeekFromBrokerTime,
  brokerSecondsFromMidnight,
  isWithinTradeWindows,
} from "../../../../ai/market-data/mt5-hfm/market-session";
import {
  deriveHfmBrokerUtcOffset,
  normalizeHfmQuoteTimestamps,
  resetHfmTrustedBrokerUtcOffsetForTests,
  getHfmTrustedBrokerUtcOffset,
  noteTrustedOpenSessionBrokerUtcOffset,
} from "../../../../ai/market-data/mt5-hfm/quote-timestamp";
import { validateHfmRawQuote } from "../../../../ai/market-data/mt5-hfm/quote-validation";
import type { HfmCatalogInstrument } from "../../../../ai/market-data/mt5-hfm/catalog-types";
import type { HfmSessionSummary } from "../../../../ai/market-data/mt5-hfm/catalog-types";

const receivedAt = "2026-01-01T12:00:00.000Z";
const receivedAtSec = Math.floor(Date.parse(receivedAt) / 1000);

/** Build a broker-domain epoch for a chosen UTC weekday + TOD (numeric fields only). */
function brokerEpoch(opts: {
  /** JS getUTCDay(): 0=Sun … 6=Sat */
  utcDay: number;
  hour: number;
  minute?: number;
  base?: number;
}): number {
  // 2024-01-07 was Sunday UTC. Add days.
  const base = opts.base ?? Date.UTC(2024, 0, 7, 0, 0, 0) / 1000;
  return base + opts.utcDay * 86400 + opts.hour * 3600 + (opts.minute ?? 0) * 60;
}

function forexSessions(): HfmSessionSummary {
  // Sun closed; Mon–Fri 00:00–24:00 style full day; Sat closed.
  const days: Record<string, { tradeFrom: number; tradeTo: number; tradeWindows: { fromSec: number; toSec: number }[] }> =
    {};
  for (let d = 0; d <= 6; d++) {
    if (d >= 1 && d <= 5) {
      days[String(d)] = {
        tradeFrom: 0,
        tradeTo: 86400,
        tradeWindows: [{ fromSec: 0, toSec: 86400 }],
      };
    } else {
      days[String(d)] = { tradeFrom: 0, tradeTo: 0, tradeWindows: [] };
    }
  }
  return {
    tradeSessionDays: 5,
    quoteSessionDays: 5,
    days,
    ...days,
  };
}

function breakSessions(): HfmSessionSummary {
  // Monday only 08:00–12:00 and 13:00–17:00 (lunch break).
  const mon = {
    tradeFrom: 8 * 3600,
    tradeTo: 17 * 3600,
    tradeWindows: [
      { fromSec: 8 * 3600, toSec: 12 * 3600 },
      { fromSec: 13 * 3600, toSec: 17 * 3600 },
    ],
  };
  const empty = { tradeFrom: 0, tradeTo: 0, tradeWindows: [] as { fromSec: number; toSec: number }[] };
  const days: Record<string, typeof mon | typeof empty> = {};
  for (let d = 0; d <= 6; d++) days[String(d)] = d === 1 ? mon : empty;
  return { tradeSessionDays: 1, quoteSessionDays: 1, days, ...days };
}

const catalogWithSessions = new Map<string, HfmCatalogInstrument>([
  [
    "EURUSD",
    {
      symbol: "EURUSD",
      digits: 5,
      point: 0.00001,
      tickSize: 0.00001,
      catalogVersion: "t",
      sessions: forexSessions(),
    } as HfmCatalogInstrument,
  ],
]);

describe("B1.1 market session classification", () => {
  it("marks MT5 disconnected separately from market closed", () => {
    const r = classifyHfmMarketSession({
      terminalRunning: false,
      brokerTime: receivedAtSec + 7200,
      gmtTime: receivedAtSec,
      sessions: forexSessions(),
    });
    expect(r.state).toBe("MT5_DISCONNECTED");
    expect(r.brokerClockFrozen).toBe(false);
  });

  it("marks feed unavailable separately", () => {
    const r = classifyHfmMarketSession({
      terminalRunning: true,
      feedAvailable: false,
      brokerTime: receivedAtSec + 7200,
      gmtTime: receivedAtSec,
    });
    expect(r.state).toBe("FEED_UNAVAILABLE");
  });

  it("detects broker clock freeze as MARKET_CLOSED", () => {
    const r = classifyHfmMarketSession({
      terminalRunning: true,
      brokerTime: receivedAtSec,
      gmtTime: receivedAtSec + 7200,
      sessions: forexSessions(),
    });
    expect(r.state).toBe("MARKET_CLOSED");
    expect(r.reason).toBe("BROKER_CLOCK_FROZEN");
    expect(r.brokerClockFrozen).toBe(true);
  });

  it("classifies weekend (no trade windows) as MARKET_CLOSED", () => {
    const bt = brokerEpoch({ utcDay: 0, hour: 12 }); // Sunday
    const r = classifyHfmMarketSession({
      terminalRunning: true,
      brokerTime: bt,
      gmtTime: bt - 7200,
      sessions: forexSessions(),
    });
    expect(brokerDayOfWeekFromBrokerTime(bt)).toBe(0);
    expect(r.state).toBe("MARKET_CLOSED");
    expect(r.reason).toBe("NO_TRADE_WINDOWS_FOR_DAY");
  });

  it("classifies Saturday closed schedule", () => {
    const bt = brokerEpoch({ utcDay: 6, hour: 10 });
    const r = classifyHfmMarketSession({
      terminalRunning: true,
      brokerTime: bt,
      gmtTime: bt - 7200,
      sessions: forexSessions(),
    });
    expect(r.state).toBe("MARKET_CLOSED");
  });

  it("classifies weekday open window as MARKET_OPEN", () => {
    const bt = brokerEpoch({ utcDay: 1, hour: 14 }); // Monday
    const r = classifyHfmMarketSession({
      terminalRunning: true,
      brokerTime: bt,
      gmtTime: bt - 7200,
      sessions: forexSessions(),
    });
    expect(r.state).toBe("MARKET_OPEN");
    expect(r.brokerClockFrozen).toBe(false);
  });

  it("classifies daily trading break", () => {
    const bt = brokerEpoch({ utcDay: 1, hour: 12, minute: 30 }); // Mon lunch
    expect(brokerSecondsFromMidnight(bt)).toBe(12 * 3600 + 30 * 60);
    const r = classifyHfmMarketSession({
      terminalRunning: true,
      brokerTime: bt,
      gmtTime: bt - 7200,
      sessions: breakSessions(),
    });
    expect(r.state).toBe("TRADING_BREAK");
    expect(isWithinTradeWindows(12 * 3600 + 30 * 60, breakSessions().days!["1"]!.tradeWindows!)).toBe(
      false,
    );
  });

  it("marks holiday when hint provided", () => {
    const bt = brokerEpoch({ utcDay: 1, hour: 10 });
    const r = classifyHfmMarketSession({
      terminalRunning: true,
      brokerTime: bt,
      gmtTime: bt - 7200,
      sessions: forexSessions(),
      holidayHint: true,
    });
    expect(r.state).toBe("MARKET_HOLIDAY");
  });

  it("quiet market with advancing clocks stays OPEN (not closed)", () => {
    const bt = brokerEpoch({ utcDay: 2, hour: 3 });
    const r = classifyHfmMarketSession({
      terminalRunning: true,
      brokerTime: bt,
      gmtTime: bt - 7200,
      sessions: forexSessions(),
    });
    expect(r.state).toBe("MARKET_OPEN");
  });

  it("SESSION_UNKNOWN when clocks missing", () => {
    const r = classifyHfmMarketSession({
      terminalRunning: true,
      brokerTime: null,
      gmtTime: null,
      sessions: null,
    });
    expect(r.state).toBe("SESSION_UNKNOWN");
  });
});

describe("B1.1 closed-market offset protection", () => {
  beforeEach(() => {
    resetHfmTrustedBrokerUtcOffsetForTests();
  });

  it("refuses live offset when broker clock frozen (1h after close)", () => {
    const openBroker = receivedAtSec + 7200;
    const openGmt = receivedAtSec;
    // Establish trusted open offset first.
    const open = deriveHfmBrokerUtcOffset({
      brokerTime: openBroker,
      gmtTime: openGmt,
      brokerClockFrozen: false,
      marketSessionState: "MARKET_OPEN",
    });
    expect(open.trust).toBe("LIVE_OPEN_SESSION");
    expect(open.brokerUtcOffsetSec).toBe(7200);

    // 1h after close: broker frozen, gmt advanced → raw delta would be +3600 (wrong TZ).
    const closed = deriveHfmBrokerUtcOffset({
      brokerTime: openBroker,
      gmtTime: openGmt + 3600,
      brokerClockFrozen: true,
      marketSessionState: "MARKET_CLOSED",
    });
    expect(closed.trust).toBe("TRUSTED_HISTORICAL");
    expect(closed.brokerUtcOffsetSec).toBe(7200);
    expect(closed.reason).toBe("TRUSTED_OFFSET_FROM_OPEN_SESSION_WHILE_CLOSED");
    expect(closed.status).toBe("PARTIAL");
  });

  it("several hours after closure still does not use frozen drift as TZ", () => {
    noteTrustedOpenSessionBrokerUtcOffset({
      offsetSec: 7200,
      observedAtGmtSec: receivedAtSec,
      observedAtBrokerSec: receivedAtSec + 7200,
      status: "NORMALIZED",
    });
    const closed = deriveHfmBrokerUtcOffset({
      brokerTime: receivedAtSec + 7200,
      gmtTime: receivedAtSec + 8 * 3600,
      brokerClockFrozen: true,
      marketSessionState: "MARKET_CLOSED",
    });
    // Raw would be 7200-28800 = -21600; must not return that.
    expect(closed.brokerUtcOffsetSec).toBe(7200);
    expect(closed.trust).toBe("TRUSTED_HISTORICAL");
  });

  it("without trusted offset, frozen clock yields UNAVAILABLE (no fabrication)", () => {
    const closed = deriveHfmBrokerUtcOffset({
      brokerTime: receivedAtSec,
      gmtTime: receivedAtSec + 7200,
      brokerClockFrozen: true,
      marketSessionState: "MARKET_CLOSED",
    });
    expect(closed.brokerUtcOffsetSec).toBeNull();
    expect(closed.status).toBe("UNAVAILABLE");
    expect(closed.reason).toBe("BROKER_CLOCK_FROZEN_OFFSET_UNTRUSTED");
  });

  it("DST transition: reopen with +10800 replaces trusted +7200", () => {
    noteTrustedOpenSessionBrokerUtcOffset({
      offsetSec: 7200,
      observedAtGmtSec: receivedAtSec,
      observedAtBrokerSec: receivedAtSec + 7200,
      status: "NORMALIZED",
    });
    const reopen = deriveHfmBrokerUtcOffset({
      brokerTime: receivedAtSec + 86400 + 10800,
      gmtTime: receivedAtSec + 86400,
      brokerClockFrozen: false,
      marketSessionState: "MARKET_OPEN",
    });
    expect(reopen.brokerUtcOffsetSec).toBe(10800);
    expect(reopen.trust).toBe("LIVE_OPEN_SESSION");
    expect(getHfmTrustedBrokerUtcOffset()?.offsetSec).toBe(10800);
  });

  it("reopen same offset restores LIVE_OPEN_SESSION normalization", () => {
    noteTrustedOpenSessionBrokerUtcOffset({
      offsetSec: 7200,
      observedAtGmtSec: receivedAtSec,
      observedAtBrokerSec: receivedAtSec + 7200,
      status: "NORMALIZED",
    });
    const reopen = deriveHfmBrokerUtcOffset({
      brokerTime: receivedAtSec + 86400 + 7200,
      gmtTime: receivedAtSec + 86400,
      brokerClockFrozen: false,
      marketSessionState: "MARKET_OPEN",
    });
    expect(reopen.brokerUtcOffsetSec).toBe(7200);
    expect(reopen.trust).toBe("LIVE_OPEN_SESSION");
  });

  it("historical trust does not normalize ticks newer than trusted observation", () => {
    noteTrustedOpenSessionBrokerUtcOffset({
      offsetSec: 7200,
      observedAtGmtSec: receivedAtSec,
      observedAtBrokerSec: receivedAtSec + 7200,
      status: "NORMALIZED",
    });
    const r = normalizeHfmQuoteTimestamps({
      quoteTimestampSec: receivedAtSec + 7200 + 10 * 3600,
      quoteTimestampMs: null,
      brokerUtcOffsetSec: 7200,
      offsetStatus: "PARTIAL",
      offsetReason: "TRUSTED_OFFSET_FROM_OPEN_SESSION_WHILE_CLOSED",
      offsetTrust: "TRUSTED_HISTORICAL",
      acquisitionMethod: "SymbolInfoTick",
      receivedAtUtcSec: receivedAtSec + 10 * 3600,
    });
    expect(r.quoteTimestampUtc).toBeNull();
    expect(r.timestampNormalizationReason).toBe("TICK_NEWER_THAN_TRUSTED_OPEN_OFFSET");
  });

  it("historical trust normalizes last open-session tick", () => {
    noteTrustedOpenSessionBrokerUtcOffset({
      offsetSec: 7200,
      observedAtGmtSec: receivedAtSec,
      observedAtBrokerSec: receivedAtSec + 7200,
      status: "NORMALIZED",
    });
    const tick = receivedAtSec + 7200;
    const r = normalizeHfmQuoteTimestamps({
      quoteTimestampSec: tick,
      quoteTimestampMs: tick * 1000,
      brokerUtcOffsetSec: 7200,
      offsetStatus: "PARTIAL",
      offsetReason: "TRUSTED_OFFSET_FROM_OPEN_SESSION_WHILE_CLOSED",
      offsetTrust: "TRUSTED_HISTORICAL",
      acquisitionMethod: "SymbolInfoTick",
      receivedAtUtcSec: receivedAtSec + 3600,
    });
    expect(r.quoteTimestamp).toBe(tick);
    expect(r.quoteTimestampUtc).toBe(receivedAtSec);
    expect(r.clockSkewSec).toBe(tick - (receivedAtSec + 3600));
  });
});

describe("B1.1 validateHfmRawQuote session + freeze", () => {
  beforeEach(() => {
    resetHfmTrustedBrokerUtcOffsetForTests();
  });

  it("open market UTC+2 still normalizes and preserves broker timestamp", () => {
    const tick = receivedAtSec + 7200;
    const { accepted, quote } = validateHfmRawQuote(
      {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.10017,
        tickTime: tick,
        digits: 5,
        point: 1e-5,
        acquisitionMethod: "SymbolInfoTick",
      },
      {
        receivedAt,
        server: "HFMarketsGlobal-Demo",
        sequence: 1,
        catalogBySymbol: catalogWithSessions,
        requireCatalogMatch: true,
        brokerTime: tick,
        gmtTime: receivedAtSec,
        terminalRunning: true,
      },
    );
    expect(accepted).toBe(true);
    expect(quote.marketSessionState).toBe("MARKET_OPEN");
    expect(quote.brokerClockFrozen).toBe(false);
    expect(quote.quoteTimestamp).toBe(tick);
    expect(quote.quoteTimestampUtc).toBe(receivedAtSec);
    expect(quote.brokerUtcOffsetSec).toBe(7200);
    expect(quote.spread).toBe(0.00017);
  });

  it("frozen clock after trusted open does not invent drifted offset", () => {
    // Seed open (+7200).
    validateHfmRawQuote(
      { symbol: "EURUSD", bid: 1.1, ask: 1.1001, tickTime: receivedAtSec + 7200 },
      {
        receivedAt,
        server: null,
        sequence: 1,
        catalogBySymbol: catalogWithSessions,
        requireCatalogMatch: true,
        brokerTime: receivedAtSec + 7200,
        gmtTime: receivedAtSec,
        terminalRunning: true,
      },
    );
    // After long closure GMT surpasses frozen broker by >= 3600s (freeze detector).
    // Frozen broker remains at open value; GMT advanced 4h → raw delta would be +7200-14400=-7200.
    const { quote } = validateHfmRawQuote(
      { symbol: "EURUSD", bid: 1.1, ask: 1.1001, tickTime: receivedAtSec + 7200 },
      {
        receivedAt: "2026-01-01T16:00:00.000Z",
        server: null,
        sequence: 2,
        catalogBySymbol: catalogWithSessions,
        requireCatalogMatch: true,
        brokerTime: receivedAtSec + 7200,
        gmtTime: receivedAtSec + 4 * 3600,
        terminalRunning: true,
      },
    );
    expect(quote.brokerClockFrozen).toBe(true);
    expect(quote.marketSessionState).toBe("MARKET_CLOSED");
    expect(quote.status).toBe("MARKET_CLOSED");
    expect(quote.brokerUtcOffsetSec).toBe(7200);
    expect(quote.timestampNormalizationReason).toBe(
      "TRUSTED_OFFSET_FROM_OPEN_SESSION_WHILE_CLOSED",
    );
    // Must not equal frozen drift (-7200).
    expect(quote.brokerUtcOffsetSec).not.toBe(-7200);
  });

  it("terminal down yields ERROR session distinct from MARKET_CLOSED", () => {
    const { quote } = validateHfmRawQuote(
      { symbol: "EURUSD", bid: 1.1, ask: 1.1001, tickTime: receivedAtSec + 7200 },
      {
        receivedAt,
        server: null,
        sequence: 1,
        catalogBySymbol: catalogWithSessions,
        requireCatalogMatch: true,
        brokerTime: receivedAtSec + 7200,
        gmtTime: receivedAtSec,
        terminalRunning: false,
      },
    );
    expect(quote.marketSessionState).toBe("MT5_DISCONNECTED");
    expect(quote.status).toBe("ERROR");
  });
});
