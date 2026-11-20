/**
 * Phase 5E Step 1 — stable deterministic ranking across scored candidates.
 *
 * Tie-break order:
 * 1. Eligibility / quality status (eligible before restricted before insufficient before blocked)
 * 2. Higher valid analytical score
 * 3. Stronger evidence completeness component
 * 4. More recent assessment timestamp
 * 5. Stable candidate ID
 *
 * BLOCKED/INVALID never outrank eligible candidates via component spikes.
 * Incompatible mixes (optional): same-instrument ranking is default comparison policy.
 */
import { randomUUID } from "node:crypto";
import type { MifOpportunityCandidate, MifDetectionEvidenceRef } from "../opportunity-detection/types.js";
import {
  MIF_OPPORTUNITY_RANKING_CONTRACT_ID,
  MIF_OPPORTUNITY_RANKING_CONTRACT_VERSION,
  MIF_OPPORTUNITY_RANKING_ENGINE_ID,
  MIF_OPPORTUNITY_RANKING_ENGINE_VERSION,
} from "./contracts.js";
import { resolveRankingPolicy } from "./policies.js";
import { rankingInputIdentity, scoreOpportunityCandidate } from "./score-candidate.js";
import type {
  MifOpportunityRankingRun,
  MifRankedOpportunity,
  MifRankingEligibility,
  MifRankingPolicy,
} from "./types.js";

const ELIGIBILITY_RANK: Record<MifRankingEligibility, number> = {
  ELIGIBLE_FOR_RANK: 0,
  RESTRICTED_PARTIAL: 1,
  INSUFFICIENT_EVIDENCE: 2,
  INCOMPATIBLE_COMPARISON: 3,
  BLOCKED: 4,
  INVALID: 5,
};

export interface RankOpportunitiesInput {
  candidates: readonly MifOpportunityCandidate[];
  evidence: readonly MifDetectionEvidenceRef[];
  dataQualityStatus: string;
  mtfRelation?: string | null;
  regimeStructure?: string | null;
  regimeDirection?: string | null;
  analysisRunId?: string | null;
  rankingRunId?: string | null;
  providerSymbol?: string | null;
  primaryTimeframe?: string | null;
  strategyFilter?: string | null;
  /** When true, reject mixing multiple symbols into one ordered list. */
  requireSameInstrument?: boolean;
  policy?: Partial<MifRankingPolicy> | null;
  rankedAt?: string;
  lifecycleByCandidateId?: ReadonlyMap<string, string> | Record<string, string> | null;
}

function completenessOf(r: MifRankedOpportunity): number {
  const c = r.componentScores.find((x) => x.componentId === "EVIDENCE_COMPLETENESS");
  return c?.score ?? -1;
}

function compareRanked(a: MifRankedOpportunity, b: MifRankedOpportunity): number {
  const ea = ELIGIBILITY_RANK[a.rankingEligibility] ?? 99;
  const eb = ELIGIBILITY_RANK[b.rankingEligibility] ?? 99;
  if (ea !== eb) return ea - eb;

  // Within same eligibility: higher score first (nulls last)
  if (a.overallScore == null && b.overallScore != null) return 1;
  if (a.overallScore != null && b.overallScore == null) return -1;
  if (a.overallScore != null && b.overallScore != null && a.overallScore !== b.overallScore) {
    return b.overallScore - a.overallScore;
  }

  const ca = completenessOf(a);
  const cb = completenessOf(b);
  if (ca !== cb) return cb - ca;

  const ta = a.assessmentTimestamp;
  const tb = b.assessmentTimestamp;
  if (ta !== tb) return tb.localeCompare(ta);

  return a.candidateId.localeCompare(b.candidateId);
}

/**
 * Score and rank candidates. Pure / deterministic for identical inputs + policy.
 */
export function rankOpportunityCandidates(
  input: RankOpportunitiesInput,
): MifOpportunityRankingRun {
  const policy = resolveRankingPolicy(input.policy);
  const startedAt = input.rankedAt ?? new Date().toISOString();
  const rankingRunId = input.rankingRunId || `rank:${randomUUID()}`;

  let candidates = [...input.candidates];
  if (input.strategyFilter) {
    candidates = candidates.filter((c) => c.strategyId === input.strategyFilter);
  }
  if (input.providerSymbol) {
    const sym = input.providerSymbol.toUpperCase();
    candidates = candidates.filter((c) => c.providerSymbol.toUpperCase() === sym);
  }

  const symbols = new Set(candidates.map((c) => c.providerSymbol.toUpperCase()));
  const incompatible =
    (input.requireSameInstrument !== false) && symbols.size > 1;

  const lifecycleMap: ReadonlyMap<string, string> = input.lifecycleByCandidateId
    ? input.lifecycleByCandidateId instanceof Map
      ? input.lifecycleByCandidateId
      : new Map(Object.entries(input.lifecycleByCandidateId))
    : new Map();

  const scored: MifRankedOpportunity[] = candidates.map((cand) => {
    const base = scoreOpportunityCandidate({
      candidate: cand,
      evidence: input.evidence,
      dataQualityStatus: input.dataQualityStatus,
      mtfRelation: input.mtfRelation,
      regimeStructure: input.regimeStructure,
      regimeDirection: input.regimeDirection,
      analysisRunId: input.analysisRunId,
      rankingRunId,
      primaryTimeframe: input.primaryTimeframe,
      lifecycleState: lifecycleMap.get(cand.candidateId) ?? null,
      policy,
      rankedAt: startedAt,
    });
    if (incompatible) {
      return {
        ...base,
        rankingEligibility: "INCOMPATIBLE_COMPARISON",
        reliableRank: false,
        overallScore: null,
        scoreBand: "BLOCKED",
        rankPosition: null,
        qualityRestrictions: [
          ...base.qualityRestrictions,
          "mixed_instruments_require_explicit_comparison_policy",
        ],
        rankingExplanation:
          "Incompatible comparison: multiple instruments in one ranking run without override",
      };
    }
    return base;
  });

  const ordered = [...scored].sort(compareRanked);

  // Assign rank positions only to reliable ranks; others keep null position but stay in list
  let nextRank = 1;
  const rankings: MifRankedOpportunity[] = ordered.map((r) => {
    if (!r.reliableRank || r.overallScore == null) {
      return {
        ...r,
        rankPosition: null,
        rankingExplanation: [
          `eligibility=${r.rankingEligibility}`,
          `score=${r.overallScore ?? "null"}`,
          `band=${r.scoreBand}`,
          "not assigned ordinary reliable rank position",
        ].join("; "),
      };
    }
    const pos = nextRank++;
    return {
      ...r,
      rankPosition: pos,
      rankingExplanation: [
        `rank=${pos}`,
        `eligibility=${r.rankingEligibility}`,
        `score=${r.overallScore}`,
        `band=${r.scoreBand}`,
        "tieBreak=eligibility>score>completeness>timestamp>candidateId",
      ].join("; "),
    };
  });

  const inputIdentity = rankingInputIdentity({
    candidateIds: candidates.map((c) => c.candidateId).sort(),
    evidenceIds: input.evidence.map((e) => e.evidenceId).sort(),
    dataQualityStatus: input.dataQualityStatus,
    mtfRelation: input.mtfRelation ?? null,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    engineVersion: MIF_OPPORTUNITY_RANKING_ENGINE_VERSION,
    strategyFilter: input.strategyFilter ?? null,
    providerSymbol: input.providerSymbol ?? null,
  });

  const blockedCount = rankings.filter(
    (r) => r.rankingEligibility === "BLOCKED" || r.rankingEligibility === "INVALID",
  ).length;
  const insufficientCount = rankings.filter(
    (r) => r.rankingEligibility === "INSUFFICIENT_EVIDENCE",
  ).length;
  const rankedCount = rankings.filter((r) => r.rankPosition != null).length;

  return {
    contractId: MIF_OPPORTUNITY_RANKING_CONTRACT_ID,
    contractVersion: MIF_OPPORTUNITY_RANKING_CONTRACT_VERSION,
    schemaVersion: "1.0.0",
    rankingRunId,
    analysisRunId: input.analysisRunId ?? null,
    providerId: "HFM_MT5",
    providerSymbol: input.providerSymbol ?? (symbols.size === 1 ? [...symbols][0]! : null),
    primaryTimeframe: input.primaryTimeframe ?? null,
    strategyFilter: input.strategyFilter ?? null,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    engineId: MIF_OPPORTUNITY_RANKING_ENGINE_ID,
    engineVersion: MIF_OPPORTUNITY_RANKING_ENGINE_VERSION,
    inputIdentity,
    startedAt,
    completedAt: new Date().toISOString(),
    candidateCount: candidates.length,
    rankedCount,
    blockedCount,
    insufficientCount,
    rankings,
    comparisonPolicy: incompatible
      ? "REJECT_MIXED_INSTRUMENTS"
      : "SAME_INSTRUMENT_STABLE_TIEBREAK",
    reproducibility: {
      identicalInputsYieldEquivalentOutputs: true,
      policyVersionRecorded: true,
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    isWinProbability: false,
    isExecutionApproval: false,
    executionReadiness: false,
    doesNotApproveAiReasoning: true,
    analyticalRankingOnly: true,
    notExecutable: true,
  };
}
