/**
 * Phase 2 — Unified Market Evidence contract, adapters, dedupe, B10 dialect notes.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_PROVIDER_ID,
  MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_ID,
  MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_VERSION,
  MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_ID,
  assessMifDataIntegrity,
  baseCanonicalCandle,
  adaptDataIntegrityToEvidence,
  adaptUnifiedDialectLimitationsToEvidence,
  adaptOpportunityCandidateToEvidence,
  buildUnifiedEvidence,
  assembleMarketEvidencePackage,
  validateUnifiedMarketEvidence,
  validateMarketEvidencePackage,
  classifyEvidencePair,
  dedupeAndRelateEvidence,
  type MifCanonicalCandle,
  type MifOpportunityCandidate,
  type MifUnifiedMarketEvidence,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;

function candle(i: number): MifCanonicalCandle {
  const openTimeSec = T0 + i * 3600;
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: "H1",
    openTimeSec,
    closeTimeSec: openTimeSec + 3600,
    open: 2000 + i,
    high: 2001 + i,
    low: 1999 + i,
    close: 2000.5 + i,
    tickVolume: 10,
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

function baseEvidence(
  over: Partial<MifUnifiedMarketEvidence> & {
    fingerprint: string;
    direction?: MifUnifiedMarketEvidence["direction"];
    evidenceType?: MifUnifiedMarketEvidence["evidenceType"];
    timeframe?: string | null;
    snapshotId?: string | null;
  },
): MifUnifiedMarketEvidence {
  return buildUnifiedEvidence({
    sourceEngine: over.sourceEngine ?? "test-engine",
    engineVersion: over.engineVersion ?? "1.0.0",
    evidenceType: over.evidenceType ?? "OTHER",
    providerSymbol: over.providerSymbol ?? "XAUUSD",
    timeframe: over.timeframe === undefined ? "H1" : over.timeframe,
    direction: over.direction ?? "NEUTRAL",
    eventTime: "2024-01-15T12:00:00.000Z",
    observedAt: "2024-01-15T12:00:00.000Z",
    candleStatus: over.candleStatus ?? "CLOSED",
    warnings: over.warnings ?? [],
    limitations: over.limitations ?? [],
    supportingEvidenceIds: over.supportingEvidenceIds,
    conflictingEvidenceIds: over.conflictingEvidenceIds,
    score: over.score ?? {
      confidenceType: "NONE",
      value: null,
      scale: null,
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "test",
    },
    snapshotId: over.snapshotId ?? null,
    snapshotIdSourceVerified: over.snapshotId != null,
    fingerprintSource: { fp: over.fingerprint },
  });
}

describe("Phase 2 — unified evidence contract validation", () => {
  it("accepts valid evidence and rejects wrong provider / setup-as-win-prob", () => {
    const ok = baseEvidence({ fingerprint: "v1" });
    expect(validateUnifiedMarketEvidence(ok).ok).toBe(true);
    expect(ok.contractId).toBe(MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_ID);
    expect(ok.contractVersion).toBe(MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_VERSION);
    expect(ok.providerId).toBe(MIF_PROVIDER_ID);

    const badProvider = { ...ok, providerId: "FXCM" as typeof ok.providerId };
    expect(validateUnifiedMarketEvidence(badProvider).ok).toBe(false);

    // buildUnifiedEvidence asserts valid items — forge after build for negative validation.
    const forged = {
      ...ok,
      score: {
        confidenceType: "SETUP_QUALITY" as const,
        value: 70,
        scale: "0-100",
        isWinProbability: true,
        isCalibratedPrediction: false,
        calibrationStatus: "UNCALIBRATED",
        reliabilityStatus: null,
        definition: "bad",
      },
    };
    const vr = validateUnifiedMarketEvidence(forged);
    expect(vr.ok).toBe(false);
    expect(vr.errors).toContain("SETUP_QUALITY_CANNOT_BE_WIN_PROBABILITY");
  });

  it("preserves null probability semantics and unknown confidence rejection", () => {
    const item = baseEvidence({
      fingerprint: "null-prob",
      score: {
        confidenceType: "TRADE_OUTCOME_PROBABILITY",
        value: null,
        scale: "empirical",
        isWinProbability: true,
        isCalibratedPrediction: false,
        calibrationStatus: "UNCALIBRATED",
        reliabilityStatus: "LOW_RELIABILITY",
        definition: "null probability allowed",
      },
    });
    expect(item.score.value).toBeNull();
    expect(item.score.isCalibratedPrediction).toBe(false);
    expect(validateUnifiedMarketEvidence(item).ok).toBe(true);

    const forged = {
      ...item,
      score: { ...item.score, confidenceType: "NOT_A_REAL_TYPE" as never },
    };
    expect(validateUnifiedMarketEvidence(forged).errors).toContain("UNKNOWN_CONFIDENCE_TYPE");
  });

  it("serializes and deserializes without losing provenance", () => {
    const item = baseEvidence({
      fingerprint: "ser",
      snapshotId: "snap-A",
    });
    const round = JSON.parse(JSON.stringify(item)) as MifUnifiedMarketEvidence;
    expect(validateUnifiedMarketEvidence(round).ok).toBe(true);
    expect(round.provenance.snapshotId).toBe("snap-A");
    expect(round.provenance.snapshotIdSourceVerified).toBe(true);
    expect(round.provenance.sourceFingerprint).toBe(item.provenance.sourceFingerprint);
  });
});

describe("Phase 2 — adapters", () => {
  it("maps data integrity assessment with provenance", () => {
    const series = Array.from({ length: 40 }, (_, i) => candle(i));
    const assessment = assessMifDataIntegrity({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    const ev = adaptDataIntegrityToEvidence(assessment, {
      analysisId: "a1",
      runId: "r1",
      snapshotId: "s1",
    });
    expect(ev.evidenceType).toBe("DATA_QUALITY");
    expect(ev.score.confidenceType).toBe("DATA_CONFIDENCE");
    expect(ev.score.isWinProbability).toBe(false);
    expect(ev.provenance.sourceAssessmentId).toBe(assessment.assessmentId);
    expect(ev.provenance.snapshotIdSourceVerified).toBe(true);
    expect(ev.providerSymbol).toBe("XAUUSD");
    expect(ev.timeframe).toBe("H1");
  });

  it("documents B10 unified dialect limitations without inventing volume", () => {
    const ev = adaptUnifiedDialectLimitationsToEvidence({
      providerSymbol: "EURUSD",
      timeframe: "H1",
      sourceDialect: "unified.candle",
      volumeType: "unknown_collapsed",
      timebase: "UNKNOWN",
      observedAt: "2024-01-15T12:00:00.000Z",
      candleCount: 120,
    });
    expect(ev.evidenceType).toBe("DIALECT_LIMITATION");
    expect(ev.warnings.some((w) => w.includes("B10"))).toBe(true);
    expect(ev.limitations.some((l) => l.includes("Prefer hfm.historical-bar"))).toBe(true);
    expect(ev.measurements.find((m) => m.name === "volumeType")?.value).toBe(
      "unknown_collapsed",
    );
    expect(ev.measurements.find((m) => m.name === "timebase")?.value).toBe("UNKNOWN");
    expect(ev.score.confidenceType).toBe("NONE");
  });

  it("maps opportunity candidate supporting/conflicting refs and never marks win probability", () => {
    const candidate = {
      contractId: "kwizera.mif.opportunity-candidate.v1",
      contractVersion: "1.0.0",
      candidateId: "cand-xyz",
      strategyId: "BREAKOUT",
      detectorId: "breakout-detector",
      detectorVersion: "1.0.0",
      strategyDefinitionVersion: "1.0.0",
      policyVersion: "1.0.0",
      providerId: MIF_PROVIDER_ID,
      providerSymbol: "XAUUSD",
      instrument: null,
      direction: "BUY",
      timeframeRoles: ["PRIMARY_DIRECTION"],
      assessmentTimestamp: "2024-01-15T12:00:00.000Z",
      status: "DETECTED",
      thesis: "breakout thesis",
      rationale: "rationale",
      supportingEvidenceIds: ["ev-a"],
      conflictingEvidenceIds: ["ev-b"],
      requiredConfirmations: ["closed beyond"],
      invalidationConditions: ["failed breakout"],
      knownLimitations: ["analytical only"],
      quality: null,
      regimeAssessmentId: null,
      mtfAssessmentId: null,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalCandidateOnly: true,
      notExecutable: true,
    } as unknown as MifOpportunityCandidate;

    const ev = adaptOpportunityCandidateToEvidence(candidate, { snapshotId: "snap-1" });
    expect(ev.direction).toBe("BULLISH");
    expect(ev.supportingEvidenceIds).toContain("ev-a");
    expect(ev.conflictingEvidenceIds).toContain("ev-b");
    expect(ev.score.isWinProbability).toBe(false);
    expect(ev.provenance.sourceCandidateId).toBe("cand-xyz");
  });
});

describe("Phase 2 — dedupe and conflicts", () => {
  it("drops exact duplicates deterministically and preserves conflicts", () => {
    const a = baseEvidence({ fingerprint: "same", direction: "BULLISH", evidenceType: "MARKET_STRUCTURE" });
    const b = baseEvidence({ fingerprint: "same", direction: "BULLISH", evidenceType: "MARKET_STRUCTURE" });
    const c = baseEvidence({
      fingerprint: "bear",
      direction: "BEARISH",
      evidenceType: "MARKET_STRUCTURE",
    });
    const { items, relations, droppedDuplicateCount } = dedupeAndRelateEvidence([c, b, a]);
    expect(droppedDuplicateCount).toBe(1);
    expect(items.length).toBe(2);
    expect(relations.some((r) => r.kind === "EXACT_DUPLICATE")).toBe(true);
    expect(relations.some((r) => r.kind === "CONFLICTING")).toBe(true);
    // Deterministic ordering
    const again = dedupeAndRelateEvidence([a, c, b]);
    expect(again.items.map((i) => i.evidenceId)).toEqual(items.map((i) => i.evidenceId));
  });

  it("keeps same measurements across different snapshots distinct", () => {
    const s1 = baseEvidence({ fingerprint: "lvl", snapshotId: "snap-1" });
    const s2 = baseEvidence({ fingerprint: "lvl", snapshotId: "snap-2" });
    expect(classifyEvidencePair(s1, s2)).not.toBe("EXACT_DUPLICATE");
    const { items, droppedDuplicateCount } = dedupeAndRelateEvidence([s1, s2]);
    expect(droppedDuplicateCount).toBe(0);
    expect(items.length).toBe(2);
  });

  it("keeps different timeframes distinct", () => {
    const h1 = baseEvidence({ fingerprint: "x", timeframe: "H1" });
    const h4 = baseEvidence({ fingerprint: "x", timeframe: "H4" });
    const { items } = dedupeAndRelateEvidence([h1, h4]);
    expect(items.length).toBe(2);
  });

  it("assembles a validated package with package contract", () => {
    const pkg = assembleMarketEvidencePackage({
      providerSymbol: "XAUUSD",
      analysisId: "an-1",
      runId: "run-1",
      snapshotId: "snap-1",
      snapshotIdSourceVerified: true,
      items: [
        baseEvidence({ fingerprint: "p1", direction: "BULLISH" }),
        baseEvidence({ fingerprint: "p2", direction: "BEARISH" }),
      ],
    });
    expect(pkg.contractId).toBe(MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_ID);
    expect(validateMarketEvidencePackage(pkg).ok).toBe(true);
    expect(pkg.providerId).toBe(MIF_PROVIDER_ID);
    expect(pkg.relations.some((r) => r.kind === "CONFLICTING")).toBe(true);
    expect(pkg.placesOrders).toBe(false);
  });
});
