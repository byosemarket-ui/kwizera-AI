/**
 * Phase 5E Step 3 — canonical bounded reasoning context from MIF production outputs.
 * Deterministic. Does not invent evidence, prices, or probabilities.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../quality/stable-identity.js";
import type { MifProductionIntegrationResult } from "../production-integration/types.js";
import type { MifOpportunityCandidate, MifDetectionEvidenceRef } from "../opportunity-detection/types.js";
import type { MifOpportunityRankingRun } from "../opportunity-ranking/types.js";
import type { MifProbabilityBundle } from "../probability-intelligence/types.js";
import { MIF_AI_MARKET_REASONING_CONTEXT_VERSION } from "./contracts.js";
import type { MifAiReasoningContext } from "./types.js";

const MAX_EVIDENCE = 80;
const MAX_CANDIDATES = 20;
const MAX_NOTE = 240;

function clip(s: string, n = MAX_NOTE): string {
  const t = String(s ?? "");
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

export interface BuildAiReasoningContextInput {
  result: MifProductionIntegrationResult;
  rankingRun?: MifOpportunityRankingRun | null;
  probabilityBundle?: MifProbabilityBundle | null;
  focusCandidateId?: string | null;
}

export function buildMifAiReasoningContext(
  input: BuildAiReasoningContextInput,
): MifAiReasoningContext {
  const r = input.result;
  const evidence = (r.evidenceRefs ?? []).slice(0, MAX_EVIDENCE);
  let candidates = (r.detection?.candidates ?? []) as MifOpportunityCandidate[];
  if (input.focusCandidateId) {
    candidates = candidates.filter((c) => c.candidateId === input.focusCandidateId);
  }
  candidates = candidates.slice(0, MAX_CANDIDATES);

  const evidenceSummaries = evidence.map((e: MifDetectionEvidenceRef) => ({
    evidenceId: e.evidenceId,
    family: String(e.family),
    presence: String(e.presence),
    qualityStatus: String(e.qualityStatus),
    candleState: e.candleState ?? null,
    notes: clip(e.notes ?? ""),
  }));

  const availableEvidenceIds = evidenceSummaries.map((e) => e.evidenceId).sort();

  const rankingTop =
    input.rankingRun?.rankings?.slice(0, 20).map((x) => ({
      candidateId: x.candidateId,
      strategyId: String(x.strategyId),
      rankPosition: x.rankPosition,
      overallScore: x.overallScore,
      scoreBand: x.scoreBand,
      rankingEligibility: x.rankingEligibility,
    }))
    ?? r.ranking?.top
    ?? [];

  const bundle = input.probabilityBundle;
  const probRow = r.probabilityIntelligence?.top?.find(
    (t) => !input.focusCandidateId || t.candidateId === input.focusCandidateId,
  );

  const knownLimitations: string[] = [];
  if (r.dataQualityStatus === "WARNING" || r.dataQualityStatus === "DEGRADED") {
    knownLimitations.push(`dataQualityStatus=${r.dataQualityStatus}`);
  }
  if (r.dataQualityStatus === "BLOCKED" || r.dataQualityStatus === "MISSING") {
    knownLimitations.push(`dataQualityBlocked=${r.dataQualityStatus}`);
  }
  if (bundle?.probability.probability == null) {
    knownLimitations.push(
      `probability=${bundle?.probability.sampleStatus ?? probRow?.sampleStatus ?? "null"} (null≠zero)`,
    );
  }
  knownLimitations.push("rankingScore≠probability");
  knownLimitations.push("AI_must_not_invent_prices_or_evidence_ids");

  const contextBase = {
    providerId: "HFM_MT5" as const,
    providerSymbol: r.providerSymbol,
    analysisTimestamp: r.processingTimestamp,
    analysisRunId: r.requestId,
    primaryTimeframe: r.primaryTimeframe,
    dataQualityStatus: r.dataQualityStatus,
    analysisStatus: r.analysisStatus,
    mtfRelation: r.mtfRelation,
    timeframeSnapshots: (r.timeframeSnapshots ?? []).map((s) => ({
      timeframe: s.timeframe,
      barCount: s.barCount,
      regimeDirection: s.regimeDirection,
      regimeStructure: s.regimeStructure,
      tipCandleState: s.tipCandleState,
    })),
    availableEvidenceIds,
    evidenceSummaries,
    candidates: candidates.map((c) => ({
      candidateId: c.candidateId,
      strategyId: String(c.strategyId),
      direction: String(c.direction),
      status: String(c.status),
      thesis: clip(c.thesis),
      supportingEvidenceIds: c.supportingEvidenceIds,
      conflictingEvidenceIds: c.conflictingEvidenceIds,
      invalidationConditions: c.invalidationConditions,
      knownLimitations: c.knownLimitations,
    })),
    ranking: {
      rankingRunId: r.ranking?.rankingRunId ?? input.rankingRun?.rankingRunId ?? null,
      rankedCount: r.ranking?.rankedCount ?? input.rankingRun?.rankedCount ?? 0,
      top: rankingTop,
      isWinProbability: false as const,
    },
    probability: bundle
      ? {
          assessmentId: bundle.probability.assessmentId,
          candidateId: bundle.probability.candidateId,
          probability: bundle.probability.probability,
          rawEmpiricalFrequency: bundle.probability.rawEmpiricalFrequency,
          sampleStatus: bundle.probability.sampleStatus,
          calibrationStatus: bundle.probability.calibrationStatus,
          reliabilityStatus: bundle.probability.reliabilityStatus,
          targetEvent: bundle.probability.targetEvent,
          isWinProbability: bundle.probability.isWinProbability,
          limitations: bundle.probability.limitations,
        }
      : probRow
      ? {
          assessmentId: null,
          candidateId: probRow.candidateId,
          probability: probRow.probability,
          rawEmpiricalFrequency: null,
          sampleStatus: probRow.sampleStatus,
          calibrationStatus: probRow.calibrationStatus,
          reliabilityStatus: probRow.reliabilityStatus,
          targetEvent: null,
          isWinProbability: probRow.isWinProbability,
          limitations: [],
        }
      : null,
    evidenceIntelligence: bundle
      ? {
          assessmentId: bundle.evidence.assessmentId,
          supportingCount: bundle.evidence.supporting.length,
          contradictingCount: bundle.evidence.contradicting.length,
          missing: bundle.evidence.missing,
          explanation: clip(bundle.evidence.explanation, 400),
        }
      : null,
    contextSummary: (r.contextSummary as Record<string, unknown>) ?? null,
    knownLimitations,
  };

  const contextIdentity = createHash("sha256")
    .update(
      stableSerialize({
        ...contextBase,
        contextVersion: MIF_AI_MARKET_REASONING_CONTEXT_VERSION,
      }),
    )
    .digest("hex");

  return {
    contextVersion: MIF_AI_MARKET_REASONING_CONTEXT_VERSION,
    contextIdentity,
    ...contextBase,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
  };
}

export function isContextBlocked(ctx: MifAiReasoningContext): boolean {
  return (
    ctx.dataQualityStatus === "BLOCKED"
    || ctx.dataQualityStatus === "MISSING"
    || String(ctx.analysisStatus).startsWith("FAILED")
  );
}

export function isContextInsufficient(ctx: MifAiReasoningContext): boolean {
  return (
    ctx.evidenceSummaries.length === 0
    && ctx.candidates.length === 0
    && !ctx.ranking
    && !ctx.probability
  );
}
