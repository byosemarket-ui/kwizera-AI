/**
 * Phase 5B.1 — MIF three-dialect adapter unit tests (HFM_MT5 only).
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { HfmHistoricalBar } from "../../../../ai/market-data/mt5-hfm/historical-engine";
import type { HfmFormingCandle } from "../../../../ai/market-data/mt5-hfm/live-candle-engine";
import type { UnifiedCandle, UnifiedCandleSeries } from "../../../../ai/market-data/providers/contracts";
import {
  MIF_MARKET_DATA_CONTRACT_ID,
  MIF_MARKET_DATA_CONTRACT_VERSION,
  MIF_PROVIDER_ID,
  adaptHfmFormingCandle,
  adaptHfmHistoricalBar,
  adaptUnifiedHfmHistoricalCandle,
  adaptUnifiedHfmHistoricalSeries,
  deriveCloseTimeSec,
  resolveTimeframeDurationSec,
  classifyVolumeType,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function histBar(over: Partial<HfmHistoricalBar> = {}): HfmHistoricalBar {
  return {
    time: 1_700_000_000,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    tickVolume: 12,
    realVolume: null,
    spread: 0.02,
    validationStatus: "ok",
    provenance: "native",
    ...over,
  };
}

function forming(over: Partial<HfmFormingCandle> = {}): HfmFormingCandle {
  return {
    provider: "HFM_MT5",
    symbol: "XAUUSD",
    timeframe: "M5",
    time: 1_700_000_300,
    open: 200,
    high: 201,
    low: 199.5,
    close: 200.2,
    tickVolume: 7,
    closed: false,
    priceBasis: "bid",
    lastTickTime: 1_700_000_350,
    receiveTimestamp: "2024-01-01T00:05:50.000Z",
    ...over,
  };
}

function unified(over: Partial<UnifiedCandle> = {}): UnifiedCandle {
  return {
    provider: "HFM_MT5",
    marketType: "FOREX",
    providerSymbol: "EURUSD",
    canonicalSymbol: "EURUSD",
    displaySymbol: "EURUSD",
    timeframe: "1h",
    time: 1_700_001_000,
    open: 1.1,
    high: 1.2,
    low: 1.05,
    close: 1.15,
    volume: 42,
    isClosed: true,
    source: "HFM_MT5",
    sourceMode: "HISTORICAL",
    dataQuality: "VALID",
    ...over,
  };
}

describe("Phase 5B.1 MIF — volume semantics", () => {
  it("tick only", () => {
    expect(classifyVolumeType(10, null)).toBe("tick");
    const r = adaptHfmHistoricalBar({
      bar: histBar({ tickVolume: 10, realVolume: null }),
      symbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.tickVolume).toBe(10);
    expect(r.value.realVolume).toBeNull();
    expect(r.value.collapsedVolume).toBeNull();
    expect(r.value.volumeType).toBe("tick");
  });

  it("real only", () => {
    expect(classifyVolumeType(null, 3)).toBe("real");
    const r = adaptHfmHistoricalBar({
      bar: histBar({ tickVolume: null, realVolume: 3 }),
      symbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.tickVolume).toBeNull();
    expect(r.value.realVolume).toBe(3);
    expect(r.value.collapsedVolume).toBeNull();
    expect(r.value.volumeType).toBe("real");
  });

  it("both tick and real remain independently accessible", () => {
    expect(classifyVolumeType(10, 3)).toBe("tick_and_real");
    const r = adaptHfmHistoricalBar({
      bar: histBar({ tickVolume: 10, realVolume: 3 }),
      symbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.tickVolume).toBe(10);
    expect(r.value.realVolume).toBe(3);
    expect(r.value.collapsedVolume).toBeNull();
    expect(r.value.volumeType).toBe("tick_and_real");
  });

  it("neither stays null (never zero)", () => {
    expect(classifyVolumeType(null, null)).toBe("none");
    const r = adaptHfmHistoricalBar({
      bar: histBar({ tickVolume: null, realVolume: null }),
      symbol: "EURUSD",
      timeframe: "M15",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.tickVolume).toBeNull();
    expect(r.value.realVolume).toBeNull();
    expect(r.value.collapsedVolume).toBeNull();
    expect(r.value.volumeType).toBe("none");
  });

  it("unified collapsed volume is unknown_collapsed without fake tick/real", () => {
    const r = adaptUnifiedHfmHistoricalCandle(unified({ volume: 9 }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.volumeType).toBe("unknown_collapsed");
    expect(r.value.collapsedVolume).toBe(9);
    expect(r.value.tickVolume).toBeNull();
    expect(r.value.realVolume).toBeNull();
  });
});

describe("Phase 5B.1 MIF — timeframe / closeTime mapping", () => {
  it("maps MT5 fixed durations and exclusive close bound", () => {
    const cases: Array<[string, number]> = [
      ["M1", 60],
      ["M5", 300],
      ["M15", 900],
      ["M30", 1800],
      ["H1", 3600],
      ["H2", 7200],
      ["H3", 10800],
      ["H4", 14400],
      ["H6", 21600],
      ["H12", 43200],
      ["D1", 86400],
      ["W1", 604800],
    ];
    const open = 1_700_000_000;
    for (const [tf, sec] of cases) {
      expect(resolveTimeframeDurationSec(tf)).toBe(sec);
      expect(deriveCloseTimeSec(open, tf)).toBe(open + sec);
    }
  });

  it("maps Unified CanonicalTimeframeId labels including 1h", () => {
    const open = 1_700_001_000;
    expect(resolveTimeframeDurationSec("1m")).toBe(60);
    expect(resolveTimeframeDurationSec("5m")).toBe(300);
    expect(resolveTimeframeDurationSec("15m")).toBe(900);
    expect(resolveTimeframeDurationSec("30m")).toBe(1800);
    expect(resolveTimeframeDurationSec("1h")).toBe(3600);
    expect(resolveTimeframeDurationSec("4h")).toBe(14400);
    expect(resolveTimeframeDurationSec("1d")).toBe(86400);
    expect(resolveTimeframeDurationSec("1w")).toBe(604800);
    expect(deriveCloseTimeSec(open, "1h")).toBe(open + 3600);
    const r = adaptUnifiedHfmHistoricalCandle(unified({ timeframe: "1h", time: open }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.closeTimeSec).toBe(open + 3600);
    expect(r.value.openTimeSec).toBe(open);
  });

  it("does not fabricate closeTime for MN1 or unknown labels", () => {
    expect(resolveTimeframeDurationSec("MN1")).toBeNull();
    expect(deriveCloseTimeSec(1_700_000_000, "MN1")).toBeNull();
    expect(resolveTimeframeDurationSec("weird")).toBeNull();
    expect(deriveCloseTimeSec(1_700_000_000, "weird")).toBeNull();
  });
});

describe("Phase 5B.1 MIF — historical adapter", () => {
  it("maps OHLC, spread, provenance; broker timebase unknown offset", () => {
    const result = adaptHfmHistoricalBar({
      bar: histBar({ spread: 0.01 }),
      symbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const c = result.value;
    expect(c.contractId).toBe(MIF_MARKET_DATA_CONTRACT_ID);
    expect(c.contractVersion).toBe(MIF_MARKET_DATA_CONTRACT_VERSION);
    expect(c.providerId).toBe(MIF_PROVIDER_ID);
    expect(c.spread).toBe(0.01);
    expect(c.candleState).toBe("CLOSED");
    expect(c.sourceProvenance).toBe("native");
    expect(c.timebase).toBe("BROKER_SERVER");
    expect(c.timezoneOffsetSec).toBeNull();
    expect(c.receivedAt).toBeNull();
    expect(c.availabilityStatus).toBe("UNKNOWN");
    expect(c.placesOrders).toBe(false);
  });

  it("rejects invalid OHLC", () => {
    const result = adaptHfmHistoricalBar({
      bar: histBar({ high: 90, low: 100 }),
      symbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_OHLC");
  });
});

describe("Phase 5B.1 MIF — live forming adapter", () => {
  it("always FORMING with bid basis and receive timestamps", () => {
    const result = adaptHfmFormingCandle({ candle: forming() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.candleState).toBe("FORMING");
    expect(result.value.priceBasis).toBe("bid");
    expect(result.value.tickVolume).toBe(7);
    expect(result.value.receivedAt).toBe("2024-01-01T00:05:50.000Z");
    expect(result.value.availableAt).toBe("2024-01-01T00:05:50.000Z");
    expect(result.value.availabilityStatus).toBe("KNOWN");
    expect(result.value.claimsLiveSubscription).toBe(false);
  });

  it("rejects when closed is not false", () => {
    const bad = forming() as HfmFormingCandle & { closed: true };
    bad.closed = true;
    const result = adaptHfmFormingCandle({ candle: bad });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UNSUPPORTED_SOURCE_SEMANTICS");
  });

  it("keeps availability UNKNOWN when receiveTimestamp missing", () => {
    const result = adaptHfmFormingCandle({
      candle: forming({ receiveTimestamp: "" }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.receivedAt).toBeNull();
    expect(result.value.availabilityStatus).toBe("UNKNOWN");
  });
});

describe("Phase 5B.1 MIF — unified HFM historical adapter", () => {
  it("rejects non-HFM providers and live/open tips", () => {
    for (const provider of ["BINANCE", "FXCM", "FOREXCONNECT"] as const) {
      const result = adaptUnifiedHfmHistoricalCandle(
        unified({ provider, source: provider }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("UNSUPPORTED_PROVIDER");
    }
    const live = adaptUnifiedHfmHistoricalCandle(unified({ sourceMode: "LIVE" }));
    expect(live.ok).toBe(false);
    if (!live.ok) expect(live.error.code).toBe("LIVE_SUBSCRIPTION_UNSUPPORTED");
    const open = adaptUnifiedHfmHistoricalCandle(unified({ isClosed: false }));
    expect(open.ok).toBe(false);
    if (!open.ok) expect(open.error.code).toBe("UNSUPPORTED_SOURCE_SEMANTICS");
  });

  it("series ignores forming; timebase UNKNOWN; no UTC assumption", () => {
    const r = adaptUnifiedHfmHistoricalCandle(unified());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.timebase).toBe("UNKNOWN");
    expect(r.value.timezoneOffsetSec).toBeNull();

    const series: UnifiedCandleSeries = {
      identity: {
        provider: "HFM_MT5",
        marketType: "FOREX",
        providerSymbol: "EURUSD",
        canonicalSymbol: "EURUSD",
        displaySymbol: "EURUSD",
        environment: "demo",
      },
      timeframe: "1h",
      source: "HFM_MT5",
      sourceMode: "HISTORICAL",
      connectionState: "CONNECTED",
      dataQuality: "VALID",
      candles: [unified(), unified({ time: 1_700_004_600 })],
      forming: unified({ isClosed: false, time: 1_700_008_200 }),
      count: 2,
      lastQuoteAt: null,
      updatedAt: new Date().toISOString(),
      note: "test",
      errorCode: null,
      errorMessage: null,
    };
    const s = adaptUnifiedHfmHistoricalSeries(series);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.value.candles.length).toBe(2);
    expect(s.value.claimsLiveSubscription).toBe(false);
    expect(s.value.note).toMatch(/forming ignored/i);
  });
});

describe("Phase 5B.1 MIF — cross-adapter / safety markers", () => {
  it("contract version and safety flags are consistent descriptive metadata", () => {
    const a = adaptHfmHistoricalBar({ bar: histBar(), symbol: "XAUUSD", timeframe: "H1" });
    const b = adaptHfmFormingCandle({ candle: forming() });
    const c = adaptUnifiedHfmHistoricalCandle(unified());
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (!(a.ok && b.ok && c.ok)) return;
    for (const v of [a.value, b.value, c.value]) {
      expect(v.contractId).toBe(MIF_MARKET_DATA_CONTRACT_ID);
      expect(v.providerId).toBe(MIF_PROVIDER_ID);
      expect(v.placesOrders).toBe(false);
      expect(v.mutatesBroker).toBe(false);
      expect(v.acceptsForExecution).toBe(false);
      expect(v.claimsLiveSubscription).toBe(false);
    }
    expect(b.value.candleState).toBe("FORMING");
  });

  it("does not wire Analyze Now / Phase 2 reasoning; snapshot hash constant unchanged", async () => {
    const idx = await fs.readFile(
      path.join(process.cwd(), "ai/market-data/mt5-hfm/mif/index.ts"),
      "utf8",
    );
    expect(idx).not.toMatch(/runHfmAiReasoning|prepareHfmAnalysisContext|auto-analysis|MarketDataProviderRegistry/);
    const types = await fs.readFile(
      path.join(process.cwd(), "ai/market-data/mt5-hfm/mif/canonical/types.ts"),
      "utf8",
    );
    expect(types).toMatch(/NOT a security enforcement boundary/i);
    const snap = await fs.readFile(
      path.join(process.cwd(), "ai/market-data/mt5-hfm/analysis/constants.ts"),
      "utf8",
    );
    expect(snap).toContain("hfm-analysis-snapshot-v1");
  });
});
