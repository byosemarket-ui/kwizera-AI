/**
 * Closure remediation: HFM catalog session authority + source-backed entry/target.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifDataIntegrity,
  attachSourceBackedLevelConditions,
  createHfmCatalogSessionAuthority,
  normalizeHfmCatalogSessions,
  extractLevelsFromCandidateNotes,
  MIF_QI_NO_AUTHORITATIVE_SESSION_CALENDAR,
  MIF_QI_CONFIRMED_MISSING,
  MIF_QI_UNKNOWN_SESSION_GAP,
  baseCanonicalCandle,
  type MifCanonicalCandle,
  type MifDetectionEvidenceRef,
  type MifOpportunityDetectionContext,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

/** Monday 2024-01-01 12:00 UTC epoch used as broker-server-like opens. */
const MON_NOON = Date.UTC(2024, 0, 1, 12, 0, 0) / 1000; // Monday
const SAT_NOON = Date.UTC(2024, 0, 6, 12, 0, 0) / 1000; // Saturday
const STEP = 3600;

function candle(openTimeSec: number): MifCanonicalCandle {
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: "H1",
    openTimeSec,
    closeTimeSec: openTimeSec + STEP,
    open: 2000,
    high: 2001,
    low: 1999,
    close: 2000.5,
    tickVolume: null,
    realVolume: null,
    collapsedVolume: null,
    volumeType: "none",
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

/** Flattened catalog shape matching live HFM XAUUSD (index-0 style). */
const XAU_SESSIONS = {
  "0": { tradeFrom: 0, tradeTo: 0, quoteFrom: 0, quoteTo: 0 },
  "1": { tradeFrom: 3900, tradeTo: 86400, quoteFrom: 3600, quoteTo: 86400 },
  "2": { tradeFrom: 3720, tradeTo: 86400, quoteFrom: 3600, quoteTo: 86400 },
  "3": { tradeFrom: 3720, tradeTo: 86400, quoteFrom: 3600, quoteTo: 86400 },
  "4": { tradeFrom: 3720, tradeTo: 86400, quoteFrom: 3600, quoteTo: 86400 },
  "5": { tradeFrom: 3720, tradeTo: 86280, quoteFrom: 3600, quoteTo: 86400 },
  "6": { tradeFrom: 0, tradeTo: 0, quoteFrom: 0, quoteTo: 0 },
  tradeSessionDays: 7,
  quoteSessionDays: 7,
};

function evidence(over: Partial<MifDetectionEvidenceRef> & { evidenceId: string; family: MifDetectionEvidenceRef["family"]; notes: string }): MifDetectionEvidenceRef {
  return {
    presence: "PRESENT",
    sourceEngine: "test",
    sourceContractId: null,
    sourceContractVersion: null,
    sourcePolicyVersion: null,
    sourceAssessmentId: null,
    sourceInputIdentity: null,
    timeframe: "H1",
    timeframeRole: "INTERMEDIATE",
    assessmentTimestamp: "2024-06-01T00:00:00.000Z",
    qualityStatus: "VALID",
    candleState: "CLOSED",
    ...over,
  };
}

describe("Closure — HFM session authority", () => {
  it("normalizes flattened catalog sessions and treats 0=0 as closed", () => {
    const n = normalizeHfmCatalogSessions("XAUUSD", XAU_SESSIONS);
    expect(n).not.toBeNull();
    expect(n!.hasTradeSchedule).toBe(true);
    expect(n!.closedDays).toEqual(expect.arrayContaining([0, 6]));
    expect(n!.tradeSessionDays).toBe(5);
  });

  it("isExpectedOpen false on Saturday, true mid-week trade hours", () => {
    const auth = createHfmCatalogSessionAuthority({
      providerSymbol: "XAUUSD",
      sessions: XAU_SESSIONS,
      catalogVersion: "test",
    });
    expect(auth).not.toBeNull();
    expect(auth!.isExpectedOpen("XAUUSD", "H1", SAT_NOON)).toBe(false);
    expect(auth!.isExpectedOpen("XAUUSD", "H1", MON_NOON)).toBe(true);
    // Monday 00:00 is before tradeFrom=3900 → not expected
    const monMidnight = Date.UTC(2024, 0, 1, 0, 0, 0) / 1000;
    expect(auth!.isExpectedOpen("XAUUSD", "H1", monMidnight)).toBe(false);
  });

  it("weekend gap is not UNKNOWN_SESSION_GAP when authority marks weekend closed", () => {
    // Saturday noon → Sunday noon: all opens closed by weekly schedule.
    const sat = SAT_NOON;
    const sun = Date.UTC(2024, 0, 7, 12, 0, 0) / 1000;
    const auth = createHfmCatalogSessionAuthority({
      providerSymbol: "XAUUSD",
      sessions: XAU_SESSIONS,
    });
    const r = assessMifDataIntegrity({
      candles: [candle(sat), candle(sun)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      expectedIntervalAuthority: auth,
    });
    expect(r.findings.some((f) => f.code === MIF_QI_NO_AUTHORITATIVE_SESSION_CALENDAR)).toBe(false);
    expect(r.findings.some((f) => f.code === MIF_QI_UNKNOWN_SESSION_GAP)).toBe(false);
    expect(r.findings.some((f) => f.code === MIF_QI_CONFIRMED_MISSING)).toBe(false);
    expect(r.gapCounters.unknownSessionGapCount).toBe(0);
    expect(r.gapCounters.confirmedMissingCount).toBe(0);
  });

  it("mid-week missing bar becomes CONFIRMED_MISSING with authority", () => {
    const auth = createHfmCatalogSessionAuthority({
      providerSymbol: "XAUUSD",
      sessions: XAU_SESSIONS,
    });
    const r = assessMifDataIntegrity({
      candles: [candle(MON_NOON), candle(MON_NOON + 2 * STEP)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      expectedIntervalAuthority: auth,
    });
    expect(r.findings.some((f) => f.code === MIF_QI_CONFIRMED_MISSING)).toBe(true);
    expect(r.findings.some((f) => f.code === MIF_QI_NO_AUTHORITATIVE_SESSION_CALENDAR)).toBe(false);
  });

  it("missing/empty sessions keep NO_AUTHORITATIVE_SESSION_CALENDAR", () => {
    expect(createHfmCatalogSessionAuthority({ providerSymbol: "XAUUSD", sessions: null })).toBeNull();
    const r = assessMifDataIntegrity({
      candles: [candle(MON_NOON), candle(MON_NOON + STEP)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.findings.some((f) => f.code === MIF_QI_NO_AUTHORITATIVE_SESSION_CALENDAR)).toBe(true);
  });

  it("accepts multi-index tradeWindows arrays", () => {
    const sessions = {
      "0": {
        tradeFrom: 72000,
        tradeTo: 86400,
        quoteFrom: 72000,
        quoteTo: 86400,
        tradeWindows: [{ fromSec: 72000, toSec: 86400 }],
      },
      "1": {
        tradeFrom: 0,
        tradeTo: 86400,
        quoteFrom: 0,
        quoteTo: 86400,
        tradeWindows: [{ fromSec: 0, toSec: 86400 }],
      },
      "6": { tradeFrom: 0, tradeTo: 0, quoteFrom: 0, quoteTo: 0, tradeWindows: [] },
      tradeSessionDays: 2,
      quoteSessionDays: 2,
    };
    const auth = createHfmCatalogSessionAuthority({
      providerSymbol: "XAUUSD",
      sessions,
    });
    expect(auth).not.toBeNull();
    const sunEve = Date.UTC(2024, 0, 7, 21, 0, 0) / 1000; // Sunday 21:00
    expect(auth!.isExpectedOpen("XAUUSD", "H1", sunEve)).toBe(true);
  });
});

describe("Closure — source-backed entry/target by strategy", () => {
  function ctx(ev: MifDetectionEvidenceRef[]): MifOpportunityDetectionContext {
    return {
      evidence: ev,
      providerSymbol: "XAUUSD",
      assessmentTimestamp: "2024-06-01T00:00:00.000Z",
      availableTimeframeRoles: ["INTERMEDIATE"],
      instrument: null,
      regime: null,
      mtfRelationships: null,
    } as unknown as MifOpportunityDetectionContext;
  }

  it("RANGE attaches entry/target/invalidation from rangeHigh/rangeLow", () => {
    const leveled = attachSourceBackedLevelConditions({
      context: ctx([
        evidence({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes: "rangeHigh=3600; rangeLow=3500",
        }),
      ]),
      strategyId: "RANGE",
      supportingEvidenceIds: ["rg.range"],
      invalidationConditions: ["rg.range_break"],
      knownLimitations: [],
      direction: "BUY",
    });
    const lv = extractLevelsFromCandidateNotes({
      invalidationConditions: leveled.invalidationConditions,
    });
    expect(lv.entryPrice).toBe(3500);
    expect(lv.targetPrice).toBe(3600);
    expect(lv.invalidationPrice).toBe(3500);
    expect(lv.targetSide).toBe("ABOVE");
    expect(lv.invalidationSide).toBe("BELOW");
  });

  it("TREND_CONTINUATION attaches entry+target from support/resistance mids", () => {
    const leveled = attachSourceBackedLevelConditions({
      context: ctx([
        evidence({
          evidenceId: "tc.structure",
          family: "MARKET_STRUCTURE",
          notes: "bias=BEARISH; price=3594.92",
        }),
        evidence({
          evidenceId: "sr.primary",
          family: "SUPPORT_RESISTANCE",
          notes: "mid=3550; supportMid=3514.2; resistanceMid=3590; kind=RESISTANCE",
        }),
      ]),
      strategyId: "TREND_CONTINUATION",
      supportingEvidenceIds: ["tc.structure"],
      invalidationConditions: ["tc.structure_break"],
      knownLimitations: [],
      direction: "SELL",
    });
    const lv = extractLevelsFromCandidateNotes({
      invalidationConditions: leveled.invalidationConditions,
    });
    expect(lv.invalidationPrice).toBe(3594.92);
    expect(lv.entryPrice).toBe(3590);
    expect(lv.targetPrice).toBe(3514.2);
    expect(lv.targetSide).toBe("BELOW");
  });

  it("does not invent target when opposing SR absent", () => {
    const leveled = attachSourceBackedLevelConditions({
      context: ctx([
        evidence({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "mid=3514.2; kind=SUPPORT",
        }),
      ]),
      strategyId: "BREAKOUT",
      supportingEvidenceIds: ["bo.boundary"],
      invalidationConditions: ["bo.failed_breakout"],
      knownLimitations: [],
      direction: "BUY",
    });
    const lv = extractLevelsFromCandidateNotes({
      invalidationConditions: leveled.invalidationConditions,
    });
    expect(lv.invalidationPrice).toBe(3514.2);
    expect(lv.entryPrice).toBe(3514.2);
    expect(lv.targetPrice).toBeNull();
  });

  it("rejects non-finite / narrative-only prices", () => {
    const leveled = attachSourceBackedLevelConditions({
      context: ctx([
        evidence({
          evidenceId: "tc.structure",
          family: "MARKET_STRUCTURE",
          notes: "price=around 3600; mid=NaN",
        }),
      ]),
      strategyId: "TREND_CONTINUATION",
      supportingEvidenceIds: ["tc.structure"],
      invalidationConditions: ["tc.structure_break"],
      knownLimitations: [],
      direction: "BUY",
    });
    const lv = extractLevelsFromCandidateNotes({
      invalidationConditions: leveled.invalidationConditions,
    });
    expect(lv.invalidationPrice).toBeNull();
    expect(lv.entryPrice).toBeNull();
    expect(lv.targetPrice).toBeNull();
  });
});
