import type {
  MifDetectionEvidenceRef,
  MifOpportunityCandidate,
} from "../../opportunity-detection/types.js";
import type { MifOpportunityRankingRun, MifRankedOpportunity } from "../../opportunity-ranking/types.js";
import type { MifProbabilityBundle } from "../../probability-intelligence/types.js";
import type { MifProductionIntegrationResult } from "../../production-integration/types.js";
import type {
  MifEvidenceFamily,
  MifStrategyEligibilityResult,
} from "../../strategy-intelligence/types.js";
import { MIF_STRATEGY_INTELLIGENCE_ENGINE_ID, MIF_STRATEGY_INTELLIGENCE_ENGINE_VERSION } from "../../strategy-intelligence/contracts.js";
import type {
  MifEvidenceConfidenceType,
  MifEvidenceType,
  MifUnifiedMarketEvidence,
} from "../types.js";
import { buildUnifiedEvidence, mapBuySellToDirection } from "./common.js";

function mapEvidenceFamilyToType(family: MifEvidenceFamily): MifEvidenceType {
  switch (family) {
    case "MARKET_STRUCTURE":
    case "RANGE_STRUCTURE":
      return "MARKET_STRUCTURE";
    case "MARKET_REGIME":
    case "VOLATILITY":
      return "MARKET_REGIME";
    case "MULTI_TIMEFRAME_RELATIONSHIP":
      return "MTF_RELATIONSHIP";
    case "FIBONACCI":
      return "FIBONACCI";
    case "GEOMETRIC_PATTERN":
      return "CHART_PATTERN";
    case "HARMONIC_PATTERN":
      return "HARMONIC_PATTERN";
    case "SUPPORT_RESISTANCE":
      return "SUPPORT_RESISTANCE";
    case "LIQUIDITY_REFERENCE":
      return "LIQUIDITY_REFERENCE";
    case "PRICE_DISPLACEMENT":
      return "PRICE_DISPLACEMENT";
    case "MOMENTUM":
      return "MOMENTUM";
    case "DATA_QUALITY":
      return "DATA_QUALITY";
    case "CANDLE_CONFIRMATION":
    default:
      return "OTHER";
  }
}

/**
 * Phase 01 — preserve OD catalog evidenceIds (tc.regime, etc.) in the unified
 * package so scenario/candidate citations remain groundable for Charts AI.
 * ABSENT refs are included intentionally (missing ≠ negative).
 */
export function adaptDetectionEvidenceRefToEvidence(
  ref: MifDetectionEvidenceRef,
  opts: {
    providerSymbol: string;
    observedAt: string;
    analysisId?: string | null;
    runId?: string | null;
    snapshotId?: string | null;
  },
): MifUnifiedMarketEvidence {
  const evidenceId = String(ref.evidenceId || "").trim();
  return buildUnifiedEvidence({
    sourceEngine: ref.sourceEngine ?? "mif-production-evidence-ref",
    engineVersion: ref.sourceContractVersion ?? "1.0.0",
    evidenceType: mapEvidenceFamilyToType(ref.family),
    providerSymbol: opts.providerSymbol,
    timeframe: ref.timeframe,
    direction: "NEUTRAL",
    eventTime: ref.assessmentTimestamp ?? opts.observedAt,
    observedAt: opts.observedAt,
    candleStatus: ref.candleState,
    warnings: ref.notes ? [ref.notes] : [],
    limitations: [
      "productionEvidenceRef",
      "presenceIsNotDirectionalBias",
      "ABSENT_means_missing_or_insufficient_not_bearish_or_bullish",
    ],
    levels: (ref.levels ?? []).map((lv) => ({
      id: lv.id,
      kind: lv.kind,
      price: lv.price,
      side: lv.side,
      note: lv.note,
    })),
    measurements: [
      { id: "family", name: "family", value: ref.family, unit: null, note: null },
      { id: "presence", name: "presence", value: ref.presence, unit: null, note: null },
      {
        id: "qualityStatus",
        name: "qualityStatus",
        value: ref.qualityStatus,
        unit: null,
        note: null,
      },
      {
        id: "timeframeRole",
        name: "timeframeRole",
        value: ref.timeframeRole,
        unit: null,
        note: null,
      },
      // Prefer structured engine numerics (RSI/ROC/ATR/levels provenance) after presence meta.
      ...(ref.measurements ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        value: m.value,
        unit: m.unit,
        note: m.note,
      })),
    ],
    score: {
      confidenceType: "ENGINE_SPECIFIC",
      value: null,
      scale: `presence=${ref.presence};quality=${ref.qualityStatus}`,
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: ref.qualityStatus,
      definition:
        "Production evidence presence/quality — ABSENT means missing/insufficient, not opposing direction",
    },
    analysisId: opts.analysisId ?? null,
    runId: opts.runId ?? null,
    snapshotId: opts.snapshotId ?? null,
    snapshotIdSourceVerified: opts.snapshotId != null,
    sourceAssessmentId: ref.sourceAssessmentId,
    sourceInputIdentity: ref.sourceInputIdentity,
    sourceContractId: ref.sourceContractId,
    sourceContractVersion: ref.sourceContractVersion,
    evidenceIdOverride: evidenceId || null,
    fingerprintSource: {
      kind: "production-evidence-ref",
      evidenceId,
      family: ref.family,
      presence: ref.presence,
      qualityStatus: ref.qualityStatus,
      sourceAssessmentId: ref.sourceAssessmentId,
    },
  });
}

const MAX_RANKED_ITEMS = 24;

export function adaptStrategyEligibilityToEvidence(
  result: MifStrategyEligibilityResult,
  opts: {
    providerSymbol: string;
    observedAt: string;
    analysisId?: string | null;
    runId?: string | null;
    snapshotId?: string | null;
    timeframe?: string | null;
  },
): MifUnifiedMarketEvidence {
  return buildUnifiedEvidence({
    sourceEngine: MIF_STRATEGY_INTELLIGENCE_ENGINE_ID,
    engineVersion: MIF_STRATEGY_INTELLIGENCE_ENGINE_VERSION,
    evidenceType: "STRATEGY_ELIGIBILITY",
    providerSymbol: opts.providerSymbol,
    timeframe: opts.timeframe ?? null,
    direction: "NEUTRAL",
    eventTime: opts.observedAt,
    observedAt: opts.observedAt,
    candleStatus: null,
    warnings: result.warnings.slice(0, 40),
    limitations: [
      "Strategy eligibility — detection gate only",
      "doesNotCreateOpportunities",
    ],
    measurements: [
      { id: "strategyId", name: "strategyId", value: result.strategyId, unit: null, note: null },
      { id: "status", name: "status", value: result.status, unit: null, note: null },
      {
        id: "satisfiedCount",
        name: "satisfiedCount",
        value: result.satisfied.length,
        unit: null,
        note: null,
      },
      {
        id: "missingCount",
        name: "missingCount",
        value: result.missing.length,
        unit: null,
        note: null,
      },
      {
        id: "failedCount",
        name: "failedCount",
        value: result.failed.length,
        unit: null,
        note: null,
      },
    ],
    score: {
      confidenceType: "ENGINE_SPECIFIC",
      value: null,
      scale: `status=${result.status}`,
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Eligibility status — not a win probability",
    },
    analysisId: opts.analysisId ?? null,
    runId: opts.runId ?? null,
    snapshotId: opts.snapshotId ?? null,
    snapshotIdSourceVerified: opts.snapshotId != null,
    sourceAssessmentId: null,
    sourceInputIdentity: null,
    sourceContractId: result.contractId,
    sourceContractVersion: result.contractVersion,
    fingerprintSource: {
      kind: "strategy-eligibility",
      strategyId: result.strategyId,
      status: result.status,
      reasonCodes: result.reasonCodes,
    },
  });
}

export function adaptOpportunityCandidateToEvidence(
  candidate: MifOpportunityCandidate,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  const direction = mapBuySellToDirection(candidate.direction);
  return buildUnifiedEvidence({
    sourceEngine: candidate.detectorId,
    engineVersion: candidate.detectorVersion,
    evidenceType: "OPPORTUNITY_CANDIDATE",
    providerSymbol: candidate.providerSymbol,
    timeframe: null,
    instrument: candidate.instrument,
    direction,
    eventTime: candidate.assessmentTimestamp,
    observedAt: candidate.assessmentTimestamp,
    candleStatus: null,
    warnings: candidate.knownLimitations.slice(0, 40),
    limitations: [...candidate.knownLimitations, "analyticalCandidateOnly", "notExecutable"],
    measurements: [
      { id: "candidateId", name: "candidateId", value: candidate.candidateId, unit: null, note: null },
      { id: "strategyId", name: "strategyId", value: candidate.strategyId, unit: null, note: null },
      { id: "status", name: "status", value: candidate.status, unit: null, note: null },
      { id: "thesis", name: "thesis", value: candidate.thesis.slice(0, 200), unit: null, note: null },
    ],
    supportingEvidenceIds: [...candidate.supportingEvidenceIds],
    conflictingEvidenceIds: [...candidate.conflictingEvidenceIds],
    score: {
      confidenceType: "ENGINE_SPECIFIC",
      value: candidate.quality?.score ?? null,
      scale: candidate.quality?.definition ?? "setup quality components",
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Candidate explainable quality — not a win probability",
    },
    analysisId: opts?.analysisId ?? null,
    runId: opts?.runId ?? null,
    snapshotId: opts?.snapshotId ?? null,
    snapshotIdSourceVerified: opts?.snapshotId != null,
    sourceAssessmentId: candidate.mtfAssessmentId ?? candidate.regimeAssessmentId,
    sourceInputIdentity: null,
    sourceContractId: candidate.contractId,
    sourceContractVersion: candidate.contractVersion,
    sourceCandidateId: candidate.candidateId,
    fingerprintSource: {
      kind: "opportunity-candidate",
      candidateId: candidate.candidateId,
      strategyId: candidate.strategyId,
      status: candidate.status,
      direction: candidate.direction,
    },
  });
}

export function adaptProductionResultToEvidence(
  result: MifProductionIntegrationResult,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  const runId = opts?.runId ?? result.persistence?.runId ?? null;
  const snapshotId = opts?.snapshotId ?? null;
  return buildUnifiedEvidence({
    sourceEngine: result.engineId,
    engineVersion: result.engineVersion,
    evidenceType: "PRODUCTION_PIPELINE",
    providerSymbol: result.providerSymbol,
    timeframe: result.primaryTimeframe,
    direction: "NEUTRAL",
    eventTime: result.processingTimestamp,
    observedAt: result.processingTimestamp,
    candleStatus: null,
    warnings: [...result.warnings].slice(0, 40),
    limitations: [
      "Production pipeline summary — per-TF assessments omitted",
      "analyticalIntegrationOnly",
    ],
    measurements: [
      { id: "requestId", name: "requestId", value: result.requestId, unit: null, note: null },
      { id: "analysisStatus", name: "analysisStatus", value: result.analysisStatus, unit: null, note: null },
      {
        id: "dataQualityStatus",
        name: "dataQualityStatus",
        value: result.dataQualityStatus,
        unit: null,
        note: null,
      },
      {
        id: "candidateCount",
        name: "candidateCount",
        value: result.candidateCount,
        unit: null,
        note: null,
      },
      {
        id: "timeframeSnapshotCount",
        name: "timeframeSnapshotCount",
        value: result.timeframeSnapshots.length,
        unit: null,
        note: null,
      },
      {
        id: "mtfStatus",
        name: "mtfStatus",
        value: result.mtfStatus,
        unit: null,
        note: null,
      },
      ...(result.contextSummary
        ? [
            {
              id: "evidenceCount",
              name: "evidenceCount",
              value: result.contextSummary.evidenceCount,
              unit: null,
              note: null,
            },
          ]
        : []),
    ],
    score: {
      confidenceType: "DATA_CONFIDENCE",
      value: null,
      scale: `analysisStatus=${result.analysisStatus}`,
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Production run status — not a win probability",
    },
    analysisId: opts?.analysisId ?? result.requestId ?? null,
    runId,
    snapshotId,
    snapshotIdSourceVerified: snapshotId != null,
    sourceAssessmentId: null,
    sourceInputIdentity: null,
    sourceContractId: result.contractId,
    sourceContractVersion: result.contractVersion,
    fingerprintSource: {
      kind: "production-pipeline",
      requestId: result.requestId,
      analysisStatus: result.analysisStatus,
      candidateCount: result.candidateCount,
      runId,
    },
  });
}

function adaptSingleRankedOpportunityToEvidence(
  run: MifOpportunityRankingRun,
  ranked: MifRankedOpportunity,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  const direction = mapBuySellToDirection(ranked.direction);
  return buildUnifiedEvidence({
    sourceEngine: ranked.engineId,
    engineVersion: ranked.engineVersion,
    evidenceType: "OPPORTUNITY_RANKING",
    providerSymbol: ranked.providerSymbol,
    timeframe: ranked.primaryTimeframe,
    direction,
    eventTime: ranked.rankedAt,
    observedAt: ranked.rankedAt,
    candleStatus: null,
    warnings: ranked.contradictions.slice(0, 40),
    limitations: [
      ...ranked.qualityRestrictions,
      "rankingScore≠winProbability",
      "isWinProbability=false",
    ],
    measurements: [
      { id: "rankingRunId", name: "rankingRunId", value: run.rankingRunId, unit: null, note: null },
      { id: "candidateId", name: "candidateId", value: ranked.candidateId, unit: null, note: null },
      { id: "scoreBand", name: "scoreBand", value: ranked.scoreBand, unit: null, note: null },
      {
        id: "rankingEligibility",
        name: "rankingEligibility",
        value: ranked.rankingEligibility,
        unit: null,
        note: null,
      },
      {
        id: "rankPosition",
        name: "rankPosition",
        value: ranked.rankPosition,
        unit: null,
        note: null,
      },
      {
        id: "overallScore",
        name: "overallScore",
        value: ranked.overallScore,
        unit: null,
        note: null,
      },
    ],
    score: {
      confidenceType: "SETUP_QUALITY",
      value: ranked.overallScore,
      scale: "0-100 setup quality",
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Analytical setup quality — explicitly not a win probability",
    },
    analysisId: opts?.analysisId ?? run.analysisRunId,
    runId: opts?.runId ?? run.rankingRunId,
    snapshotId: opts?.snapshotId ?? null,
    snapshotIdSourceVerified: opts?.snapshotId != null,
    sourceAssessmentId: null,
    sourceInputIdentity: run.inputIdentity,
    sourceContractId: ranked.contractId,
    sourceContractVersion: ranked.contractVersion,
    sourceCandidateId: ranked.candidateId,
    fingerprintSource: {
      kind: "opportunity-ranking",
      rankingRunId: run.rankingRunId,
      candidateId: ranked.candidateId,
      scoreBand: ranked.scoreBand,
      overallScore: ranked.overallScore,
      isWinProbability: false,
    },
  });
}

export function adaptRankingRunToEvidence(
  run: MifOpportunityRankingRun,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence[] {
  return run.rankings
    .slice(0, MAX_RANKED_ITEMS)
    .map((ranked) => adaptSingleRankedOpportunityToEvidence(run, ranked, opts));
}

export function adaptProbabilityBundleToEvidence(
  bundle: MifProbabilityBundle,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  const { probability } = bundle;
  const direction = mapBuySellToDirection(probability.direction);
  const confidenceType: MifEvidenceConfidenceType =
    probability.isWinProbability === true
      ? "TRADE_OUTCOME_PROBABILITY"
      : probability.probability != null
        ? "DIRECTIONAL_PROBABILITY"
        : "ENGINE_SPECIFIC";

  return buildUnifiedEvidence({
    sourceEngine: probability.engineId,
    engineVersion: probability.engineVersion,
    evidenceType: "PROBABILITY_INTELLIGENCE",
    providerSymbol: probability.providerSymbol,
    timeframe: probability.primaryTimeframe,
    direction,
    eventTime: probability.calculatedAt,
    observedAt: probability.calculatedAt,
    candleStatus: null,
    warnings: [...probability.reliabilityNotes, ...probability.limitations].slice(0, 40),
    limitations: [
      ...probability.limitations,
      probability.isHistoricalFrequencyOnly ? "isHistoricalFrequencyOnly" : "forwardClaim",
    ],
    measurements: [
      {
        id: "targetEvent",
        name: "targetEvent",
        value: probability.targetEvent,
        unit: null,
        note: null,
      },
      {
        id: "sampleStatus",
        name: "sampleStatus",
        value: probability.sampleStatus,
        unit: null,
        note: null,
      },
      {
        id: "probability",
        name: "probability",
        value: probability.probability,
        unit: null,
        note: null,
      },
      {
        id: "successCount",
        name: "successCount",
        value: probability.successCount,
        unit: null,
        note: null,
      },
      {
        id: "eligibleResolvedDenominator",
        name: "eligibleResolvedDenominator",
        value: probability.eligibleResolvedDenominator,
        unit: null,
        note: null,
      },
    ],
    score: {
      confidenceType,
      value: probability.probability,
      scale: probability.targetEventDefinition,
      isWinProbability: probability.isWinProbability,
      isCalibratedPrediction: probability.isCalibratedPrediction,
      calibrationStatus: probability.calibrationStatus,
      reliabilityStatus: probability.reliabilityStatus,
      definition: "Probability from empirical cohort — never fabricated",
    },
    analysisId: opts?.analysisId ?? probability.analysisRunId,
    runId: opts?.runId ?? probability.rankingRunId,
    snapshotId: opts?.snapshotId ?? null,
    snapshotIdSourceVerified: opts?.snapshotId != null,
    sourceAssessmentId: probability.assessmentId,
    sourceInputIdentity: probability.inputIdentity,
    sourceContractId: probability.contractId,
    sourceContractVersion: probability.contractVersion,
    sourceCandidateId: probability.candidateId,
    fingerprintSource: {
      kind: "probability-bundle",
      assessmentId: probability.assessmentId,
      candidateId: probability.candidateId,
      targetEvent: probability.targetEvent,
      probability: probability.probability,
      isWinProbability: probability.isWinProbability,
      calibrationStatus: probability.calibrationStatus,
      reliabilityStatus: probability.reliabilityStatus,
    },
  });
}
