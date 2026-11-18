/**
 * Phase 5B.2 Step 3 — Phase 2 shadow bridge tests (observational only).
 */
import { describe, it, expect } from "vitest";
import {
  comparePhase2Shadow,
  attachUnifiedOverallToShadow,
  assessMifDataIntegrity,
  assessMifQuoteQuality,
  MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS,
  baseCanonicalCandle,
  type MifCanonicalCandle,
  type MifCanonicalQuote,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import {
  MIF_MARKET_DATA_CONTRACT_ID,
  MIF_MARKET_DATA_CONTRACT_VERSION,
  MIF_PROVIDER_ID,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import type { HfmAnalysisDataQualityReport, HfmAnalysisSyncReport } from "../../../../ai/market-data/mt5-hfm/analysis/types";

function candle(openTimeSec: number): MifCanonicalCandle {
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: "H1",
    openTimeSec,
    closeTimeSec: openTimeSec + 3600,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    tickVolume: 1,
    realVolume: null,
    collapsedVolume: null,
    volumeType: "tick",
    spread: null,
    candleState: "CLOSED",
    priceBasis: "bid",
    timebase: "BROKER_SERVER",
    timezoneOffsetSec: null,
    brokerTimestampSec: openTimeSec,
    receivedAt: null,
    availableAt: null,
    availabilityStatus: "KNOWN",
    sourceDialect: "hfm.historical-bar",
    sourceProvenance: "test",
    sourceMode: "HISTORICAL",
    sourceDataQuality: "ok",
    validation: { status: "ok", errors: [], warnings: [] },
    instrument: null,
  });
}

function quote(): MifCanonicalQuote {
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
    quoteTimestampMs: null,
    receivedAt: "2023-11-14T22:13:20.000Z",
    availableAt: null,
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
  };
}

function phase2Valid(): HfmAnalysisDataQualityReport {
  return {
    status: "VALID",
    errors: [],
    warnings: [],
    approvedForAiReasoning: true,
    policyNote: "test",
  };
}

describe("Phase 5B.2 Step3 — Phase 2 shadow bridge", () => {
  it("preserves Phase 2 statuses and never mutates AI approval", () => {
    const p2 = phase2Valid();
    const integrity = assessMifDataIntegrity({
      candles: [candle(1_700_000_000)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const q = assessMifQuoteQuality({
      quote: quote(),
      providerSymbol: "XAUUSD",
      requireQuote: true,
      freshnessProfile: MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS,
      nowSec: 1_700_000_010,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const shadow = comparePhase2Shadow({
      dataIntegrity: integrity,
      quote: q,
      multiTimeframe: null,
      phase2Quality: p2,
      phase2SourceIdentity: "snap-hash-test",
      providerSymbol: "XAUUSD",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(shadow.phase2Status).toBe("VALID");
    expect(shadow.phase2ApprovedForAiReasoning).toBe(true);
    expect(shadow.phase2ApprovedForAiReasoningUnchanged).toBe(true);
    expect(shadow.doesNotMutatePhase2).toBe(true);
    expect(shadow.doesNotApproveAiReasoning).toBe(true);
    expect(p2.approvedForAiReasoning).toBe(true);
    expect(p2.status).toBe("VALID");
    expect(shadow.dimensions.length).toBeGreaterThanOrEqual(5);
  });

  it("marks gaps as mif_additional_evidence when Phase 2 gap ratio inert", () => {
    const integrity = assessMifDataIntegrity({
      candles: [candle(1_700_000_000), candle(1_700_000_000 + 7200)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    const shadow = comparePhase2Shadow({
      dataIntegrity: integrity,
      quote: null,
      multiTimeframe: null,
      phase2Quality: phase2Valid(),
      providerSymbol: "XAUUSD",
    });
    const gaps = shadow.dimensions.find((d) => d.dimension === "gaps");
    expect(gaps?.outcome === "mif_additional_evidence" || gaps?.outcome === "compatible_different").toBe(
      true,
    );
  });

  it("flags incomparable quote freshness when MIF freshness UNKNOWN", () => {
    const q = assessMifQuoteQuality({
      quote: { ...quote(), timebase: "UNKNOWN" },
      providerSymbol: "XAUUSD",
      requireQuote: true,
      freshnessProfile: MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS,
      nowSec: 1_700_000_010,
    });
    expect(q.freshness).toBe("UNKNOWN");
    const shadow = comparePhase2Shadow({
      dataIntegrity: null,
      quote: q,
      multiTimeframe: null,
      phase2Quality: phase2Valid(),
      providerSymbol: "XAUUSD",
    });
    const dim = shadow.dimensions.find((d) => d.dimension === "quote_freshness");
    expect(dim?.outcome).toBe("incomparable");
  });

  it("detects overall genuine disagreement without mutating Phase 2", () => {
    const p2 = phase2Valid();
    const shadow = comparePhase2Shadow({
      dataIntegrity: null,
      quote: null,
      multiTimeframe: null,
      phase2Quality: p2,
      providerSymbol: "XAUUSD",
    });
    const withOverall = attachUnifiedOverallToShadow(shadow, p2, "BLOCKED");
    const overall = withOverall.dimensions.find((d) => d.dimension === "overall_interpretation");
    expect(overall?.outcome).toBe("genuine_disagreement");
    expect(withOverall.hasGenuineDisagreement).toBe(true);
    expect(p2.status).toBe("VALID");
    expect(p2.approvedForAiReasoning).toBe(true);
  });

  it("reports phase2 sync-only as phase2_additional_evidence", () => {
    const sync: HfmAnalysisSyncReport = {
      status: "VALID",
      symbol: "XAUUSD",
      timeframesPresent: ["H1", "M15"],
      timeframesMissing: [],
      latestQuoteTimestamp: null,
      latestCandleByTf: { H1: 1, M15: 1 },
      warnings: [],
      errors: [],
    };
    const shadow = comparePhase2Shadow({
      dataIntegrity: null,
      quote: null,
      multiTimeframe: null,
      phase2Quality: phase2Valid(),
      phase2Sync: sync,
      providerSymbol: "XAUUSD",
    });
    const dim = shadow.dimensions.find((d) => d.dimension === "synchronization");
    expect(dim?.outcome).toBe("phase2_additional_evidence");
  });

  it("deterministic shadow identity ignores wall-clock", () => {
    const integrity = assessMifDataIntegrity({
      candles: [candle(1_700_000_000)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const p2 = phase2Valid();
    const a = comparePhase2Shadow({
      dataIntegrity: integrity,
      quote: null,
      multiTimeframe: null,
      phase2Quality: p2,
      providerSymbol: "XAUUSD",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const b = comparePhase2Shadow({
      dataIntegrity: integrity,
      quote: null,
      multiTimeframe: null,
      phase2Quality: p2,
      providerSymbol: "XAUUSD",
      assessmentTimestamp: "2025-01-01T00:00:00.000Z",
    });
    expect(a.inputIdentity).toBe(b.inputIdentity);
  });
});
