/**
 * Phase 5E Step 1 — Opportunity Ranking & Scoring.
 * Fixture-based; live HFM verification is separate on VPS.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  baseCanonicalCandle,
  MIF_PROVIDER_ID,
  MIF_OPPORTUNITY_RANKING_CONTRACT_ID,
  MIF_OPPORTUNITY_CANDIDATE_CONTRACT_ID,
  MIF_OPPORTUNITY_CANDIDATE_CONTRACT_VERSION,
  MIF_POLICY_HFM_OPPORTUNITY_RANKING,
  validateMifRankingPolicy,
  scoreOpportunityCandidate,
  rankOpportunityCandidates,
  runMifHfmOpportunityPipelineFromSeriesPersisted,
  runMifHfmOpportunityPipelineFromSeries,
  __setMifOpportunityStorageForTests,
  MifOpportunityStorage,
  getMifOdWorkerStatus,
  type MifCanonicalCandle,
  type MifOpportunityCandidate,
  type MifDetectionEvidenceRef,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;
const STEP = 3600;

function candle(i: number, close: number): MifCanonicalCandle {
  const openTimeSec = T0 + i * STEP;
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: "H1",
    openTimeSec,
    closeTimeSec: openTimeSec + STEP,
    open: close - 0.1,
    high: close + 0.5,
    low: close - 0.5,
    close,
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

function bars(n = 80) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = 2000 + i * 0.35;
    const bump = i % 7 === 3 ? 1.8 : i % 7 === 6 ? -0.9 : 0;
    const close = c + bump;
    out.push({
      time: T0 + i * 3600,
      open: close - 0.15,
      high: close + 0.4,
      low: close - 0.4,
      close,
      tickVolume: 10,
      realVolume: null,
      spread: 2,
      validationStatus: "ok" as const,
      provenance: "native" as const,
    });
  }
  return out;
}

function ev(partial: Partial<MifDetectionEvidenceRef> & Pick<MifDetectionEvidenceRef, "evidenceId" | "family">): MifDetectionEvidenceRef {
  return {
    presence: "PRESENT",
    sourceEngine: "test",
    sourceContractId: "test.contract",
    sourceContractVersion: "1.0.0",
    sourcePolicyVersion: "1.0.0",
    sourceAssessmentId: partial.sourceAssessmentId ?? `assess:${partial.evidenceId}`,
    sourceInputIdentity: partial.sourceInputIdentity ?? `input:${partial.evidenceId}`,
    timeframe: "H1",
    timeframeRole: "PRIMARY_DIRECTION",
    assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    qualityStatus: "VALID",
    candleState: "CLOSED",
    notes: "",
    ...partial,
  };
}

function candidate(partial: Partial<MifOpportunityCandidate> & { candidateId: string; strategyId: string }): MifOpportunityCandidate {
  return {
    contractId: MIF_OPPORTUNITY_CANDIDATE_CONTRACT_ID,
    contractVersion: MIF_OPPORTUNITY_CANDIDATE_CONTRACT_VERSION,
    detectorId: "test-detector",
    detectorVersion: "1.0.0",
    strategyDefinitionVersion: "1.0.0",
    policyVersion: "1.0.0",
    providerId: MIF_PROVIDER_ID,
    providerSymbol: "XAUUSD",
    instrument: null,
    direction: "BUY",
    timeframeRoles: ["PRIMARY_DIRECTION"],
    assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    status: "DETECTED",
    thesis: "test",
    rationale: "test",
    supportingEvidenceIds: [],
    conflictingEvidenceIds: [],
    requiredConfirmations: [],
    invalidationConditions: [],
    knownLimitations: [],
    quality: null,
    regimeAssessmentId: null,
    mtfAssessmentId: null,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalCandidateOnly: true,
    notExecutable: true,
    ...partial,
  };
}

describe("Phase 5E Step 1 — policy", () => {
  it("validates default weights sum to 1.0", () => {
    const v = validateMifRankingPolicy(MIF_POLICY_HFM_OPPORTUNITY_RANKING);
    expect(v.ok).toBe(true);
  });

  it("rejects invalid weight sums", () => {
    const bad = validateMifRankingPolicy({
      ...MIF_POLICY_HFM_OPPORTUNITY_RANKING,
      weights: { ...MIF_POLICY_HFM_OPPORTUNITY_RANKING.weights, dataQuality: 0.99 },
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors.some((e) => /weights must sum/.test(e))).toBe(true);
  });
});

describe("Phase 5E Step 1 — scoring", () => {
  it("scores deterministically and never claims win probability", () => {
    const evidence = [
      ev({
        evidenceId: "dq",
        family: "DATA_QUALITY",
        notes: "dataQualityStatus=VALID",
      }),
      ev({
        evidenceId: "ms",
        family: "MARKET_STRUCTURE",
        notes: "bias=BULLISH;refSide=BUY_SIDE",
      }),
      ev({
        evidenceId: "pd",
        family: "PRICE_DISPLACEMENT",
        notes: "kind=BULLISH_DISPLACEMENT;direction=UP;confirmed=TRUE;structuralDisplacement=FALSE;closeState=CLOSED",
      }),
      ev({
        evidenceId: "mtf",
        family: "MULTI_TIMEFRAME_RELATIONSHIP",
        notes: "relation=ALIGNMENT",
      }),
      ev({
        evidenceId: "reg",
        family: "MARKET_REGIME",
        notes: "direction=UP;structure=TRENDING",
      }),
    ];
    const c = candidate({
      candidateId: "c-strong",
      strategyId: "TREND_CONTINUATION",
      direction: "BUY",
      supportingEvidenceIds: ["ms", "pd", "mtf", "reg", "dq"],
    });
    const a = scoreOpportunityCandidate({
      candidate: c,
      evidence,
      dataQualityStatus: "VALID",
      mtfRelation: "ALIGNMENT",
      rankingRunId: "rank:test",
      rankedAt: "2024-01-01T00:00:00.000Z",
    });
    const b = scoreOpportunityCandidate({
      candidate: c,
      evidence,
      dataQualityStatus: "VALID",
      mtfRelation: "ALIGNMENT",
      rankingRunId: "rank:test",
      rankedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(a.contractId).toBe(MIF_OPPORTUNITY_RANKING_CONTRACT_ID);
    expect(a.isWinProbability).toBe(false);
    expect(a.executionReadiness).toBe(false);
    expect(a.placesOrders).toBe(false);
    expect(a.overallScore).toBe(b.overallScore);
    expect(a.scoreBand).toBe(b.scoreBand);
    expect(a.overallScore).not.toBeNull();
    expect(a.overallScore!).toBeGreaterThanOrEqual(0);
    expect(a.overallScore!).toBeLessThanOrEqual(100);
  });

  it("does not treat FORMING displacement as confirmed", () => {
    const evidence = [
      ev({
        evidenceId: "pd",
        family: "PRICE_DISPLACEMENT",
        notes: "kind=FORMING;provisional=TRUE;confirmed=FALSE;closeState=FORMING;direction=UP",
        candleState: "FORMING",
        qualityStatus: "WARNING",
      }),
      ev({ evidenceId: "dq", family: "DATA_QUALITY" }),
      ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volatility=HIGH" }),
      ev({ evidenceId: "me.regime", family: "MARKET_REGIME", notes: "direction=UP;structure=TRENDING" }),
    ];
    const c = candidate({
      candidateId: "c-forming",
      strategyId: "MOMENTUM_EXPANSION",
      direction: "BUY",
      supportingEvidenceIds: ["pd", "me.vol", "me.regime"],
      status: "NEEDS_CONFIRMATION",
    });
    const scored = scoreOpportunityCandidate({
      candidate: c,
      evidence,
      dataQualityStatus: "VALID",
      rankingRunId: "rank:forming",
      rankedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(scored.qualityRestrictions.some((r) => /forming|provisional|partial/i.test(r))).toBe(true);
    expect(scored.scoreBand).not.toBe("VERY_STRONG");
  });

  it("blocks on BLOCKED data quality", () => {
    const scored = scoreOpportunityCandidate({
      candidate: candidate({ candidateId: "c-block", strategyId: "RANGE" }),
      evidence: [ev({ evidenceId: "dq", family: "DATA_QUALITY", qualityStatus: "BLOCKED" })],
      dataQualityStatus: "BLOCKED",
      rankingRunId: "rank:block",
      rankedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(scored.rankingEligibility).toBe("BLOCKED");
    expect(scored.scoreBand).toBe("BLOCKED");
    expect(scored.reliableRank).toBe(false);
  });

  it("preserves contradictions with conflict penalty", () => {
    const evidence = [
      ev({ evidenceId: "ms", family: "MARKET_STRUCTURE", notes: "bias=BEARISH" }),
      ev({ evidenceId: "mtf", family: "MULTI_TIMEFRAME_RELATIONSHIP", notes: "relation=CONFLICT" }),
      ev({ evidenceId: "dq", family: "DATA_QUALITY" }),
    ];
    const scored = scoreOpportunityCandidate({
      candidate: candidate({
        candidateId: "c-conflict",
        strategyId: "TREND_CONTINUATION",
        direction: "BUY",
        supportingEvidenceIds: ["ms"],
        conflictingEvidenceIds: ["mtf"],
      }),
      evidence,
      dataQualityStatus: "VALID",
      mtfRelation: "CONFLICT",
      rankingRunId: "rank:conflict",
      rankedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(scored.contradictions.length).toBeGreaterThan(0);
    const penalty = scored.componentScores.find((c) => c.componentId === "CONFLICT_PENALTY");
    expect(penalty?.score).toBeGreaterThan(0);
  });

  it("deduplicates correlated provenance", () => {
    const shared = "assess:same-structure";
    const evidence = [
      ev({
        evidenceId: "ms",
        family: "MARKET_STRUCTURE",
        sourceAssessmentId: shared,
        notes: "bias=BULLISH;refSide=BUY_SIDE",
      }),
      ev({
        evidenceId: "pd",
        family: "PRICE_DISPLACEMENT",
        sourceAssessmentId: shared,
        notes: "kind=BULLISH_DISPLACEMENT;confirmed=TRUE;direction=UP;structuralDisplacement=TRUE",
      }),
      ev({ evidenceId: "dq", family: "DATA_QUALITY" }),
      ev({
        evidenceId: "mtf",
        family: "MULTI_TIMEFRAME_RELATIONSHIP",
        notes: "relation=ALIGNMENT",
      }),
    ];
    // TREND_CONTINUATION requires MARKET_STRUCTURE; PRICE_DISPLACEMENT is optional —
    // both sit in the same correlated family group for double-count prevention.
    const scored = scoreOpportunityCandidate({
      candidate: candidate({
        candidateId: "c-dedupe",
        strategyId: "TREND_CONTINUATION",
        direction: "BUY",
        supportingEvidenceIds: ["ms", "pd", "mtf", "dq"],
      }),
      evidence,
      dataQualityStatus: "VALID",
      mtfRelation: "ALIGNMENT",
      rankingRunId: "rank:dedupe",
      rankedAt: "2024-01-01T00:00:00.000Z",
    });
    const dupes = [...scored.positiveContributions, ...scored.negativeContributions].filter(
      (c) => c.deduplicated,
    );
    expect(dupes.length).toBeGreaterThanOrEqual(1);
    expect(scored.evidenceProvenanceRefs.filter((k) => k.includes("same-structure")).length).toBe(
      1,
    );
  });
});

describe("Phase 5E Step 1 — ranking", () => {
  it("orders by eligibility then score with stable ties", () => {
    const evidence = [
      ev({ evidenceId: "dq", family: "DATA_QUALITY" }),
      ev({
        evidenceId: "mtf",
        family: "MULTI_TIMEFRAME_RELATIONSHIP",
        notes: "relation=ALIGNMENT",
      }),
      ev({
        evidenceId: "ms",
        family: "MARKET_STRUCTURE",
        notes: "bias=BULLISH",
      }),
      ev({
        evidenceId: "reg",
        family: "MARKET_REGIME",
        notes: "direction=UP;structure=TRENDING",
      }),
    ];
    const strong = candidate({
      candidateId: "aaa-strong",
      strategyId: "TREND_CONTINUATION",
      direction: "BUY",
      supportingEvidenceIds: ["ms", "mtf", "reg", "dq"],
      status: "DETECTED",
    });
    const weak = candidate({
      candidateId: "zzz-weak",
      strategyId: "TREND_CONTINUATION",
      direction: "BUY",
      supportingEvidenceIds: [],
      status: "NEEDS_CONFIRMATION",
      knownLimitations: ["limited"],
      requiredConfirmations: ["need-close"],
    });
    const blocked = candidate({
      candidateId: "mmm-invalid",
      strategyId: "TREND_CONTINUATION",
      direction: "BUY",
      status: "INVALID",
    });
    const run = rankOpportunityCandidates({
      candidates: [weak, blocked, strong],
      evidence,
      dataQualityStatus: "VALID",
      mtfRelation: "ALIGNMENT",
      rankingRunId: "rank:order",
      rankedAt: "2024-01-01T00:00:00.000Z",
      providerSymbol: "XAUUSD",
    });
    expect(run.isWinProbability).toBe(false);
    expect(run.rankings[0]!.candidateId).toBe("aaa-strong");
    expect(run.rankings[0]!.rankPosition).toBe(1);
    const inv = run.rankings.find((r) => r.candidateId === "mmm-invalid")!;
    expect(inv.rankingEligibility).toBe("INVALID");
    expect(inv.rankPosition).toBeNull();

    const again = rankOpportunityCandidates({
      candidates: [weak, blocked, strong],
      evidence,
      dataQualityStatus: "VALID",
      mtfRelation: "ALIGNMENT",
      rankingRunId: "rank:order2",
      rankedAt: "2024-01-01T00:00:00.000Z",
      providerSymbol: "XAUUSD",
    });
    expect(again.inputIdentity).toBe(run.inputIdentity);
    expect(again.rankings.map((r) => r.candidateId)).toEqual(
      run.rankings.map((r) => r.candidateId),
    );
  });

  it("rejects mixed instruments under default comparison policy", () => {
    const run = rankOpportunityCandidates({
      candidates: [
        candidate({ candidateId: "a", strategyId: "RANGE", providerSymbol: "XAUUSD" }),
        candidate({ candidateId: "b", strategyId: "RANGE", providerSymbol: "EURUSD" }),
      ],
      evidence: [ev({ evidenceId: "dq", family: "DATA_QUALITY" })],
      dataQualityStatus: "VALID",
      rankingRunId: "rank:mixed",
      rankedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(run.comparisonPolicy).toBe("REJECT_MIXED_INSTRUMENTS");
    expect(run.rankings.every((r) => r.rankingEligibility === "INCOMPATIBLE_COMPARISON")).toBe(
      true,
    );
  });
});

describe("Phase 5E Step 1 — pipeline + persistence", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-5e1-"));
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    __setMifOpportunityStorageForTests(new MifOpportunityStorage(tmp));
  });

  afterEach(() => {
    __setMifOpportunityStorageForTests(null);
    delete process.env.KWIZERA_STORAGE_ROOT;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("integrates ranking into production series pipeline and persists", async () => {
    const r = await runMifHfmOpportunityPipelineFromSeriesPersisted({
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      timeframes: ["H1", "H4"],
      series: [
        { timeframe: "H1", bars: bars(80) },
        { timeframe: "H4", bars: bars(80) },
      ],
      assessmentTimestamp: "2024-06-01T00:00:00.000Z",
      maxCandleAgeSec: null,
    });
    expect(r.providerId).toBe(MIF_PROVIDER_ID);
    expect(r.placesOrders).toBe(false);
    expect(r.ranking).toBeTruthy();
    expect(r.ranking!.isWinProbability).toBe(false);
    expect(r.ranking!.executionReadiness).toBe(false);
    expect(r.persistence?.persisted).toBe(true);
    expect(r.evidenceRefs?.length).toBeGreaterThan(0);

    if (r.persistence?.rankingRunId) {
      const store = new MifOpportunityStorage(tmp);
      const ranking = await store.getRankingRun(r.persistence.rankingRunId);
      expect(ranking?.contractId).toBe(MIF_OPPORTUNITY_RANKING_CONTRACT_ID);
      expect(ranking?.placesOrders).toBe(false);
    }

    const audit = await new MifOpportunityStorage(tmp).auditIntegrity();
    expect(audit.permissionsWritable).toBe(true);
  });

  it("is deterministic across identical pipeline inputs", () => {
    const input = {
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      timeframes: ["H1"],
      series: [{ timeframe: "H1", bars: bars(80) }],
      assessmentTimestamp: "2024-06-01T00:00:00.000Z",
      maxCandleAgeSec: null as number | null,
      requestId: "fixed-req",
    };
    const a = runMifHfmOpportunityPipelineFromSeries(input);
    const b = runMifHfmOpportunityPipelineFromSeries(input);
    expect(a.ranking?.rankedCount).toBe(b.ranking?.rankedCount);
    expect(a._rankingRun?.inputIdentity).toBe(b._rankingRun?.inputIdentity);
    expect(a._rankingRun?.rankings.map((x) => x.candidateId)).toEqual(
      b._rankingRun?.rankings.map((x) => x.candidateId),
    );
  });

  it("worker remains disabled by default", () => {
    expect(getMifOdWorkerStatus().enabled).toBe(false);
  });
});

describe("Phase 5E Step 1 — API surface", () => {
  it("registers ranking routes in admin API source", () => {
    const api = fs.readFileSync(
      path.join(process.cwd(), "dev/server/mt5-hfm-mif-api.ts"),
      "utf8",
    );
    expect(api).toContain("/api/forex/providers/mt5-hfm/mif/ranking");
    expect(api).toContain("rankOpportunityCandidates");
    expect(api).toContain("isWinProbability: false");
  });
});

// silence unused helper in some environments
void candle;
