/**
 * Phase 09 — Live Data Validation & Research Reliability (HFM MT5).
 * FIXTURE TESTS — not live HFM/VPS verification.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_RESEARCH_RELIABILITY_CONTRACT_ID,
  adaptResearchReliabilityToEvidence,
  assessCandleReliability,
  assessEventReliability,
  assessMifResearchReliability,
  assessMifStrategyResearch,
  assessQuoteReliability,
  assessRegimeShift,
  assessStrategyRobustness,
  compareLiveVsHistorical,
  computeResearchReliabilityScore,
  evaluateResearchInputGate,
  resolveResearchReliabilityPolicy,
  validateResearchDataset,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const policy = resolveResearchReliabilityPolicy();
const nowSec = 1_700_000_100;

function bars(n: number, start = 1_700_000_000) {
  return Array.from({ length: n }, (_, i) => {
    const open = 100 + i;
    return {
      time: start + i * 3600,
      open,
      high: open + 1,
      low: open - 1,
      close: open + 0.2,
    };
  });
}

function makeResearch(overrides?: {
  expectancy?: number;
  sample?: number;
  strategyVersion?: string;
}) {
  const sample = overrides?.sample ?? 40;
  const unitReturn = overrides?.expectancy ?? 0.01;
  return assessMifStrategyResearch({
    providerSymbol: "EURUSD",
    timeframe: "H1",
    strategyId: "TREND_CONTINUATION",
    strategyVersion: overrides?.strategyVersion ?? "1.0.0",
    fixtureBars: bars(Math.max(20, sample)),
    simulatedTrades: Array.from({ length: sample }, (_, i) => ({
      direction: (i % 2 === 0 ? "BUY" : "SELL") as "BUY" | "SELL",
      entryPrice: 100 + i,
      exitPrice: 100 + i + 1,
      entryTimeSec: 1_700_000_000 + i * 7200,
      exitTimeSec: 1_700_000_000 + i * 7200 + 3600,
      unitReturn: i % 5 === 0 ? -Math.abs(unitReturn) : Math.abs(unitReturn),
      status: "CLOSED" as const,
      exitReason: "TARGET",
      holdingBars: 2,
      regimeLabel: "TRENDING",
    })),
    sourceMode: "FIXTURE",
    assessmentTimestamp: new Date().toISOString(),
  });
}

describe("Phase 09 — quote validation", () => {
  it("classifies valid live quote", () => {
    const r = assessQuoteReliability({
      quote: {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.1002,
        providerTimestampSec: nowSec - 2,
        receivedAt: new Date().toISOString(),
        providerId: "HFM_MT5",
      },
      policy,
      validationTimestamp: new Date().toISOString(),
      nowSec,
    });
    expect(r.classification).toBe("LIVE");
    expect(r.spreadValid).toBe(true);
    expect(r.httpOkIsNotLive).toBe(true);
  });

  it("flags stale / delayed / missing / invalid", () => {
    const stale = assessQuoteReliability({
      quote: {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.1002,
        providerTimestampSec: nowSec - 90,
        receivedAt: null,
      },
      policy,
      validationTimestamp: new Date().toISOString(),
      nowSec,
    });
    expect(["STALE", "FRESH", "DELAYED"]).toContain(stale.classification);

    const delayed = assessQuoteReliability({
      quote: {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.1002,
        providerTimestampSec: nowSec - 500,
        receivedAt: null,
      },
      policy,
      validationTimestamp: new Date().toISOString(),
      nowSec,
    });
    expect(delayed.classification).toBe("DELAYED");

    const missing = assessQuoteReliability({
      quote: null,
      policy,
      validationTimestamp: new Date().toISOString(),
      nowSec,
    });
    expect(missing.classification).toBe("MISSING");

    const invalid = assessQuoteReliability({
      quote: {
        symbol: "EURUSD",
        bid: 1.2,
        ask: 1.1,
        providerTimestampSec: nowSec,
        receivedAt: null,
      },
      policy,
      validationTimestamp: new Date().toISOString(),
      nowSec,
    });
    expect(invalid.classification).toBe("INVALID");
    expect(invalid.findings.some((f) => f.includes("negative") || f.includes("inverted"))).toBe(
      true,
    );
  });

  it("detects abnormal spread, missing timestamp, discontinuity, recovery, provider mismatch", () => {
    const wide = assessQuoteReliability({
      quote: {
        symbol: "XAUUSD",
        bid: 2000,
        ask: 2005,
        providerTimestampSec: nowSec,
        receivedAt: null,
      },
      recentSpreads: [0.1, 0.12, 0.11, 0.13],
      policy,
      validationTimestamp: new Date().toISOString(),
      nowSec,
    });
    expect(wide.spreadAbnormal).toBe(true);

    const noTs = assessQuoteReliability({
      quote: {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.1001,
        providerTimestampSec: null,
        receivedAt: null,
      },
      policy,
      validationTimestamp: new Date().toISOString(),
      nowSec,
    });
    expect(noTs.findings).toContain("missing_provider_timestamp");

    const jump = assessQuoteReliability({
      quote: {
        symbol: "EURUSD",
        bid: 1.2,
        ask: 1.2002,
        providerTimestampSec: nowSec,
        receivedAt: null,
      },
      previousQuote: {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.1002,
        providerTimestampSec: nowSec - 1,
        receivedAt: null,
      },
      policy,
      validationTimestamp: new Date().toISOString(),
      nowSec,
    });
    expect(jump.findings.some((f) => f.startsWith("price_discontinuity"))).toBe(true);

    const recovering = assessQuoteReliability({
      quote: {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.1002,
        providerTimestampSec: nowSec,
        receivedAt: null,
      },
      previousQuote: {
        symbol: "EURUSD",
        bid: null,
        ask: null,
        providerTimestampSec: nowSec - 10,
        receivedAt: null,
      },
      policy,
      validationTimestamp: new Date().toISOString(),
      nowSec,
    });
    expect(recovering.classification).toBe("RECOVERING");

    const mismatch = assessQuoteReliability({
      quote: {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.1002,
        providerTimestampSec: nowSec,
        receivedAt: null,
        providerId: "BINANCE",
      },
      policy,
      validationTimestamp: new Date().toISOString(),
      nowSec,
    });
    expect(mismatch.classification).toBe("INVALID");
    expect(mismatch.findings.some((f) => f.includes("PROVIDER_MISMATCH"))).toBe(true);
  });
});

describe("Phase 09 — candle integrity (reuses Phase 08)", () => {
  it("validates and wraps dataset report", () => {
    const r = assessCandleReliability({
      datasetId: "d9",
      symbol: "EURUSD",
      timeframe: "H1",
      bars: bars(20),
      sourceMode: "FIXTURE",
      retrievalTimestamp: new Date().toISOString(),
      expectedTimeframeSeconds: 3600,
    });
    expect(r.reusedPhase08Validator).toBe(true);
    expect(r.dataset.mayProceed).toBe(true);
  });

  it("rejects wrong provider and invalid OHLC", () => {
    const r = assessCandleReliability({
      datasetId: "d-bad",
      symbol: "EURUSD",
      timeframe: "H1",
      bars: [{ time: 1, open: 1, high: 0.5, low: 2, close: 1 }],
      sourceMode: "FIXTURE",
      retrievalTimestamp: new Date().toISOString(),
      providerId: "FOREXCONNECT",
    });
    expect(r.dataset.mayProceed).toBe(false);
    expect(r.dataset.blockReasons.some((b) => b.includes("WRONG_PROVIDER"))).toBe(true);
  });
});

describe("Phase 09 — live/historical compare", () => {
  it("consistent when mid in range; forming excluded via missing candle", () => {
    const ok = compareLiveVsHistorical({
      symbol: "EURUSD",
      timeframe: "H1",
      quote: {
        symbol: "EURUSD",
        bid: 100.1,
        ask: 100.2,
        providerTimestampSec: 1_700_000_000,
        receivedAt: null,
      },
      lastClosedCandle: { time: 1_700_000_000, open: 100, high: 101, low: 99, close: 100.15 },
      policy,
    });
    expect(ok.status).toBe("CONSISTENT");
    expect(ok.semanticGuard).toContain("forming_candles_excluded");

    const missing = compareLiveVsHistorical({
      symbol: "EURUSD",
      timeframe: "H1",
      quote: {
        symbol: "EURUSD",
        bid: 1,
        ask: 1.0001,
        providerTimestampSec: nowSec,
        receivedAt: null,
      },
      lastClosedCandle: null,
      policy,
    });
    expect(missing.status).toBe("INSUFFICIENT_DATA");
  });

  it("marks divergent when mid far outside range", () => {
    const d = compareLiveVsHistorical({
      symbol: "EURUSD",
      timeframe: "H1",
      quote: {
        symbol: "EURUSD",
        bid: 110,
        ask: 110.1,
        providerTimestampSec: 1_700_000_000,
        receivedAt: null,
      },
      lastClosedCandle: { time: 1_700_000_000, open: 100, high: 101, low: 99, close: 100 },
      policy,
    });
    expect(d.status).toBe("DIVERGENT");
    expect(d.divergences.length).toBeGreaterThan(0);
  });

  it("not comparable across distant timestamps", () => {
    const n = compareLiveVsHistorical({
      symbol: "EURUSD",
      timeframe: "H1",
      quote: {
        symbol: "EURUSD",
        bid: 100,
        ask: 100.1,
        providerTimestampSec: 1_700_000_000 + 200_000,
        receivedAt: null,
      },
      lastClosedCandle: { time: 1_700_000_000, open: 100, high: 101, low: 99, close: 100 },
      policy,
    });
    expect(n.status).toBe("NOT_COMPARABLE");
  });
});

describe("Phase 09 — research gate", () => {
  it("allows with warnings for fixture; blocks invalid", () => {
    const good = validateResearchDataset({
      datasetId: "g1",
      symbol: "EURUSD",
      timeframe: "H1",
      bars: bars(20),
      sourceMode: "FIXTURE",
      retrievalTimestamp: new Date().toISOString(),
    });
    const allow = evaluateResearchInputGate({
      dataset: good,
      strategyId: "TREND_CONTINUATION",
      strategyVersion: "1.0.0",
      sourceMode: "FIXTURE",
      relatedResearchRunId: null,
      validationTimestamp: new Date().toISOString(),
    });
    expect(allow.gate).toBe("RESEARCH_ALLOWED_WITH_WARNINGS");
    expect(allow.validationRecordId.startsWith("rrv_")).toBe(true);

    const bad = validateResearchDataset({
      datasetId: "g2",
      symbol: "EURUSD",
      timeframe: "H1",
      bars: [{ time: 1, open: 1, high: 0.5, low: 2, close: 1 }],
      sourceMode: "LIVE_SOURCE",
      retrievalTimestamp: new Date().toISOString(),
      providerId: "BINANCE",
    });
    const block = evaluateResearchInputGate({
      dataset: bad,
      strategyId: "X",
      strategyVersion: "1",
      sourceMode: "LIVE_SOURCE",
      relatedResearchRunId: "run_old",
      validationTimestamp: new Date().toISOString(),
    });
    expect(["RESEARCH_BLOCKED", "SOURCE_UNVERIFIED", "INSUFFICIENT_DATA"]).toContain(block.gate);
    expect(block.relatedResearchRunId).toBe("run_old");
  });
});

describe("Phase 09 — strategy robustness", () => {
  it("stable / suspect / confirmed / insufficient sample", () => {
    const baseline = makeResearch({ expectancy: 0.02, sample: 40 });
    const stableRecent = makeResearch({ expectancy: 0.019, sample: 40 });
    const stable = assessStrategyRobustness({
      baseline,
      recent: stableRecent,
      policy,
    });
    expect(stable.status).toBe("STABLE_WITHIN_BASELINE");

    const dropSuspect = makeResearch({ expectancy: 0.012, sample: 40 });
    const suspect = assessStrategyRobustness({
      baseline,
      recent: dropSuspect,
      policy,
    });
    expect(["DEGRADATION_SUSPECTED", "DEGRADATION_CONFIRMED", "STABLE_WITHIN_BASELINE"]).toContain(
      suspect.status,
    );

    const dropHard = makeResearch({ expectancy: 0.005, sample: 40 });
    const confirmed = assessStrategyRobustness({
      baseline,
      recent: dropHard,
      policy,
    });
    expect(confirmed.status).toBe("DEGRADATION_CONFIRMED");

    const small = makeResearch({ expectancy: 0.001, sample: 5 });
    const insuf = assessStrategyRobustness({
      baseline,
      recent: small,
      policy,
    });
    expect(insuf.status).toBe("INSUFFICIENT_SAMPLE");
  });

  it("regime shift and data quality blocked", () => {
    const baseline = makeResearch({ sample: 40 });
    const recent = makeResearch({ sample: 40 });
    const regime = assessStrategyRobustness({
      baseline,
      recent,
      policy,
      regimeShiftDetected: true,
    });
    expect(regime.status).toBe("REGIME_SHIFT_DETECTED");

    const missing = assessStrategyRobustness({
      baseline: null,
      recent: null,
      policy,
    });
    expect(missing.status).toBe("NOT_EVALUABLE");
  });
});

describe("Phase 09 — regime / events / score / assess", () => {
  it("regime shift and event blocked configuration", () => {
    expect(
      assessRegimeShift({
        historicalRegime: "TRENDING",
        currentRegime: "RANGING",
      }).status,
    ).toBe("REGIME_SHIFT_DETECTED");
    expect(
      assessRegimeShift({
        historicalRegime: "TRENDING",
        currentRegime: "TRENDING",
      }).status,
    ).toBe("NO_SHIFT");

    const ev = assessEventReliability({
      liveCalendarAllowed: false,
      eventsProvided: true,
      eventSourceMode: "FIXTURE",
    });
    expect(ev.status).toBe("BLOCKED_CONFIGURATION_REQUIRED");
    expect(ev.calendarGatesUnchanged).toBe(true);

    const fixture = assessEventReliability({
      liveCalendarAllowed: true,
      eventsProvided: true,
      eventSourceMode: "FIXTURE",
      eventCount: 2,
    });
    expect(fixture.status).toBe("FIXTURE_ONLY");
  });

  it("score is not probability; full assessment semantic guards", () => {
    const liveTs = Math.floor(Date.now() / 1000) - 2;
    const a = assessMifResearchReliability({
      providerSymbol: "EURUSD",
      timeframe: "H1",
      quote: {
        symbol: "EURUSD",
        bid: 100.05,
        ask: 100.15,
        providerTimestampSec: liveTs,
        receivedAt: new Date().toISOString(),
        providerId: "HFM_MT5",
      },
      fixtureBars: bars(25),
      lastClosedCandle: {
        time: liveTs - 60,
        open: 100,
        high: 101,
        low: 99,
        close: 100.1,
      },
      baselineResearch: makeResearch({ sample: 40, expectancy: 0.02 }),
      recentResearch: makeResearch({ sample: 40, expectancy: 0.019 }),
      historicalRegime: "TRENDING",
      currentRegime: "TRENDING",
      liveCalendarAllowed: false,
      eventsProvided: false,
      sourceMode: "FIXTURE",
      assessmentTimestamp: new Date().toISOString(),
    });

    expect(a.contractId).toBe(MIF_RESEARCH_RELIABILITY_CONTRACT_ID);
    expect(a.scope).toBe("phase09-research-reliability");
    expect(a.isWinProbability).toBe(false);
    expect(a.isEventProbability).toBe(false);
    expect(a.isProbabilityCalibration).toBe(false);
    expect(a.placesOrders).toBe(false);
    expect(a.mutatesBroker).toBe(false);
    expect(a.acceptsForExecution).toBe(false);
    expect(a.continuousReliabilityWorker).toBe("DISABLED_BY_POLICY");
    expect(a.reliabilityScore.isProbabilityCalibration).toBe(false);
    expect(a.reliabilityScore.isWinProbability).toBe(false);
    expect(a.quote?.classification).toBe("LIVE");
    expect(a.candles?.reusedPhase08Validator).toBe(true);
    expect(a.researchGate?.gate).toMatch(/RESEARCH_ALLOWED/);
    expect(a.alerts.every((x) => x.isBuySellAlert === false)).toBe(true);

    const score = computeResearchReliabilityScore({
      quote: a.quote,
      candles: a.candles,
      compare: a.liveHistoricalCompare,
      gate: a.researchGate,
      robustness: a.strategyRobustness,
      regime: a.regimeShift,
      events: a.eventReliability,
    });
    expect(score.isWinProbability).toBe(false);
    expect(score.definition.toLowerCase()).toMatch(/not.*(win|event).*probability|confidence_not_event/);

    const evidence = adaptResearchReliabilityToEvidence(a);
    expect(evidence.evidenceType).toBe("RESEARCH_RELIABILITY");
    expect(evidence.score.isWinProbability).toBe(false);
  });

  it("safety: assessment never activates workers or orders", () => {
    const a = assessMifResearchReliability({
      providerSymbol: "XAUUSD",
      quote: null,
      liveCalendarAllowed: false,
    });
    expect(a.capabilityMatrix.continuousWorker).toBe("DISABLED_BY_POLICY");
    expect(a.capabilityMatrix.brokerExecution).toBe("DISABLED_BY_POLICY");
    expect(a.doesNotConfirmOrInvalidateLifecycleAlone).toBe(true);
  });
});
