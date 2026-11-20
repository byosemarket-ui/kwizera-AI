/**
 * Phase 5E Step 1 — deterministic per-candidate analytical scoring.
 * Pure function. Does not mutate candidates or evidence.
 * Scores are setup-quality measures — NOT win probabilities.
 */
import { createHash } from "node:crypto";
import type { MifOpportunityCandidate, MifDetectionEvidenceRef } from "../opportunity-detection/types.js";
import type { MifEvidenceFamily, MifStrategyDefinition } from "../strategy-intelligence/types.js";
import { getDefaultMifStrategyIntelligenceRegistry } from "../strategy-intelligence/registry.js";
import { stableSerialize } from "../quality/stable-identity.js";
import {
  MIF_OPPORTUNITY_RANKING_CONTRACT_ID,
  MIF_OPPORTUNITY_RANKING_CONTRACT_VERSION,
  MIF_OPPORTUNITY_RANKING_ENGINE_ID,
  MIF_OPPORTUNITY_RANKING_ENGINE_VERSION,
} from "./contracts.js";
import { resolveRankingPolicy } from "./policies.js";
import { buildEvidenceContributions } from "./provenance.js";
import type {
  MifRankedOpportunity,
  MifRankingEligibility,
  MifRankingPolicy,
  MifRankingScoreBand,
  MifScoreComponentResult,
} from "./types.js";

export interface ScoreCandidateInput {
  candidate: MifOpportunityCandidate;
  evidence: readonly MifDetectionEvidenceRef[];
  dataQualityStatus: string;
  mtfRelation?: string | null;
  regimeStructure?: string | null;
  regimeDirection?: string | null;
  analysisRunId?: string | null;
  rankingRunId: string;
  primaryTimeframe?: string | null;
  lifecycleState?: string | null;
  policy?: Partial<MifRankingPolicy> | null;
  rankedAt?: string;
  strategyDefinition?: MifStrategyDefinition | null;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function bandFor(
  score: number | null,
  eligibility: MifRankingEligibility,
  policy: MifRankingPolicy,
): MifRankingScoreBand {
  if (eligibility === "BLOCKED" || eligibility === "INVALID") return "BLOCKED";
  if (eligibility === "INSUFFICIENT_EVIDENCE" || score == null) return "INSUFFICIENT_EVIDENCE";
  const t = policy.bandThresholds;
  if (score >= t.veryStrong) return "VERY_STRONG";
  if (score >= t.strong) return "STRONG";
  if (score >= t.moderate) return "MODERATE";
  if (score >= t.weak) return "WEAK";
  return "INSUFFICIENT_EVIDENCE";
}

function noteHas(notes: string | undefined, re: RegExp): boolean {
  return re.test(notes ?? "");
}

function findFamily(
  evidence: readonly MifDetectionEvidenceRef[],
  family: MifEvidenceFamily,
): MifDetectionEvidenceRef | undefined {
  return evidence.find((e) => e.family === family && e.presence === "PRESENT");
}

function qualityToScore(q: string): number {
  switch (q) {
    case "VALID":
      return 100;
    case "WARNING":
      return 70;
    case "DEGRADED":
      return 40;
    case "BLOCKED":
    case "MISSING":
      return 0;
    default:
      return 50;
  }
}

/**
 * Score one opportunity candidate. Does not assign rankPosition (done by ranker).
 */
export function scoreOpportunityCandidate(input: ScoreCandidateInput): MifRankedOpportunity {
  const policy = resolveRankingPolicy(input.policy);
  const rankedAt = input.rankedAt ?? new Date().toISOString();
  const cand = input.candidate;
  const strategyReg = getDefaultMifStrategyIntelligenceRegistry();
  const strategyDef =
    input.strategyDefinition
    ?? strategyReg.getStrategy(String(cand.strategyId));

  const requiredFamilies = new Set<MifEvidenceFamily>();
  const optionalFamilies = new Set<MifEvidenceFamily>();
  if (strategyDef) {
    for (const r of strategyDef.requiredEvidence) requiredFamilies.add(r.family);
    for (const r of strategyDef.optionalEvidence) optionalFamilies.add(r.family);
  } else {
    // Unknown strategy: only use families present on the candidate's supporting ids
    for (const e of input.evidence) {
      if (cand.supportingEvidenceIds.includes(e.evidenceId)) requiredFamilies.add(e.family);
    }
  }
  const relevantFamilies = new Set<MifEvidenceFamily>([
    ...requiredFamilies,
    ...optionalFamilies,
    "DATA_QUALITY",
    "MULTI_TIMEFRAME_RELATIONSHIP",
  ]);
  // Always evaluate families the candidate actually cites (without requiring unrelated engines).
  for (const e of input.evidence) {
    if (
      cand.supportingEvidenceIds.includes(e.evidenceId)
      || cand.conflictingEvidenceIds.includes(e.evidenceId)
    ) {
      relevantFamilies.add(e.family);
    }
  }

  const prov = buildEvidenceContributions({
    evidence: input.evidence,
    supportingIds: cand.supportingEvidenceIds,
    conflictingIds: cand.conflictingEvidenceIds,
    candidateDirection: cand.direction,
    relevantFamilies,
    policy,
  });

  const qualityRestrictions: string[] = [];
  let eligibility: MifRankingEligibility = "ELIGIBLE_FOR_RANK";

  if (cand.status === "INVALID" || cand.status === "REJECTED") {
    eligibility = "INVALID";
    qualityRestrictions.push(`candidate.status=${cand.status}`);
  }
  if (
    input.dataQualityStatus === "BLOCKED"
    || input.dataQualityStatus === "MISSING"
  ) {
    eligibility = "BLOCKED";
    qualityRestrictions.push(`dataQualityStatus=${input.dataQualityStatus}`);
  }
  if (input.lifecycleState === "INVALIDATED" || input.lifecycleState === "INVALID") {
    eligibility = eligibility === "ELIGIBLE_FOR_RANK" ? "BLOCKED" : eligibility;
    qualityRestrictions.push(`lifecycleState=${input.lifecycleState}`);
  }

  // Required evidence missing → insufficient (not zero-as-negative)
  const missingRequired: string[] = [];
  if (strategyDef) {
    for (const req of strategyDef.requiredEvidence) {
      const hit = input.evidence.find(
        (e) =>
          (e.evidenceId === req.evidenceId || e.family === req.family)
          && e.presence === "PRESENT"
          && e.qualityStatus !== "BLOCKED"
          && e.qualityStatus !== "MISSING",
      );
      if (!hit) missingRequired.push(req.evidenceId);
    }
  }
  if (missingRequired.length && eligibility === "ELIGIBLE_FOR_RANK") {
    eligibility = "INSUFFICIENT_EVIDENCE";
    qualityRestrictions.push(`missingRequired=${missingRequired.join(",")}`);
  }
  if (
    (cand.status === "NEEDS_CONFIRMATION" || prov.partial.length > 0)
    && eligibility === "ELIGIBLE_FOR_RANK"
  ) {
    eligibility = "RESTRICTED_PARTIAL";
    qualityRestrictions.push("partial_or_needs_confirmation");
  }

  // --- Component scores ---
  const components: MifScoreComponentResult[] = [];

  // 1. Data Quality
  const dqScore =
    eligibility === "BLOCKED" && input.dataQualityStatus === "BLOCKED"
      ? 0
      : qualityToScore(input.dataQualityStatus);
  components.push({
    componentId: "DATA_QUALITY",
    score: dqScore,
    weight: policy.weights.dataQuality,
    weightedContribution: dqScore * policy.weights.dataQuality,
    availability: input.dataQualityStatus === "BLOCKED" ? "BLOCKED" : "AVAILABLE",
    inputs: [`dataQualityStatus=${input.dataQualityStatus}`],
    missing: [],
    partial: input.dataQualityStatus === "WARNING" || input.dataQualityStatus === "DEGRADED"
      ? ["dataQuality"]
      : [],
    provenanceKeys: [],
    explanation: `Maps HFM_MT5 analytical data-quality status to 0–100 (${policy.weightRationale.dataQuality})`,
  });

  // 2. Evidence Completeness (strategy-aware)
  const reqTotal = (strategyDef?.requiredEvidence.length ?? requiredFamilies.size) || 1;
  const reqPresent = reqTotal - missingRequired.length;
  const optTotal = strategyDef?.optionalEvidence.length ?? 0;
  let optPresent = 0;
  if (strategyDef) {
    for (const opt of strategyDef.optionalEvidence) {
      if (
        input.evidence.some(
          (e) =>
            (e.evidenceId === opt.evidenceId || e.family === opt.family)
            && e.presence === "PRESENT",
        )
      ) {
        optPresent += 1;
      }
    }
  }
  // Required coverage dominates; optional adds up to +20 within component
  const completenessBase = (reqPresent / Math.max(1, reqTotal)) * 80;
  const completenessBonus = optTotal > 0 ? (optPresent / optTotal) * 20 : 20;
  const completenessScore = missingRequired.length === reqTotal && reqTotal > 0
    ? null
    : clampScore(completenessBase + completenessBonus);
  components.push({
    componentId: "EVIDENCE_COMPLETENESS",
    score: completenessScore,
    weight: policy.weights.evidenceCompleteness,
    weightedContribution:
      completenessScore == null
        ? null
        : completenessScore * policy.weights.evidenceCompleteness,
    availability: completenessScore == null ? "INSUFFICIENT" : "AVAILABLE",
    inputs: [
      `requiredPresent=${reqPresent}/${reqTotal}`,
      `optionalPresent=${optPresent}/${optTotal}`,
    ],
    missing: missingRequired,
    partial: prov.partial,
    provenanceKeys: prov.uniqueProvenanceKeys,
    explanation:
      "Strategy-required coverage (80) + optional coverage (20). Unrelated engines not required are not penalized.",
  });

  // 3. Analytical Evidence (net support after dedupe)
  const activePos = prov.positive.filter((c) => !c.deduplicated);
  const activeNeg = prov.negative.filter((c) => !c.deduplicated);
  const analyticalRaw =
    activePos.length + activeNeg.length === 0
      ? null
      : clampScore(
          50
          + activePos.length * 12
          - activeNeg.length * 18,
        );
  components.push({
    componentId: "ANALYTICAL_EVIDENCE",
    score: analyticalRaw,
    weight: policy.weights.analyticalEvidence,
    weightedContribution:
      analyticalRaw == null ? null : analyticalRaw * policy.weights.analyticalEvidence,
    availability: analyticalRaw == null ? "INSUFFICIENT" : "AVAILABLE",
    inputs: [`positive=${activePos.length}`, `negative=${activeNeg.length}`],
    missing: [],
    partial: [],
    provenanceKeys: activePos.map((c) => c.provenanceKey),
    explanation:
      "Net supporting vs conflicting contributions after provenance dedupe; baseline 50.",
  });

  // 4. Market Structure Alignment
  const struct = findFamily(input.evidence, "MARKET_STRUCTURE");
  let structureScore: number | null = null;
  let structureAvail: MifScoreComponentResult["availability"] = "NOT_APPLICABLE";
  if (!requiredFamilies.has("MARKET_STRUCTURE") && !optionalFamilies.has("MARKET_STRUCTURE")) {
    structureAvail = "NOT_APPLICABLE";
    structureScore = null;
  } else if (!struct) {
    structureAvail = requiredFamilies.has("MARKET_STRUCTURE") ? "INSUFFICIENT" : "NOT_APPLICABLE";
  } else {
    structureAvail = "AVAILABLE";
    const biasBull = noteHas(struct.notes, /BIAS=BULLISH|refSide=BUY/i);
    const biasBear = noteHas(struct.notes, /BIAS=BEARISH|refSide=SELL/i);
    const dir = cand.direction;
    if ((dir === "BUY" && biasBull) || (dir === "SELL" && biasBear)) structureScore = 90;
    else if ((dir === "BUY" && biasBear) || (dir === "SELL" && biasBull)) structureScore = 25;
    else structureScore = 55;
    structureScore = clampScore(
      structureScore * (qualityToScore(struct.qualityStatus) / 100),
    );
  }
  components.push({
    componentId: "MARKET_STRUCTURE_ALIGNMENT",
    score: structureScore,
    weight: policy.weights.marketStructureAlignment,
    weightedContribution:
      structureScore == null
        ? null
        : structureScore * policy.weights.marketStructureAlignment,
    availability: structureAvail,
    inputs: struct ? [`structure=${struct.notes ?? ""}`] : [],
    missing: structureAvail === "INSUFFICIENT" ? ["MARKET_STRUCTURE"] : [],
    partial: struct && struct.qualityStatus !== "VALID" ? [struct.evidenceId] : [],
    provenanceKeys: struct ? [struct.sourceAssessmentId ?? struct.evidenceId] : [],
    explanation: "Structure bias vs candidate direction; NOT_APPLICABLE when strategy does not use structure.",
  });

  // 5. Momentum & Displacement
  const mom = findFamily(input.evidence, "MOMENTUM");
  const disp = findFamily(input.evidence, "PRICE_DISPLACEMENT");
  const usesMom =
    requiredFamilies.has("MOMENTUM")
    || optionalFamilies.has("MOMENTUM")
    || requiredFamilies.has("PRICE_DISPLACEMENT")
    || optionalFamilies.has("PRICE_DISPLACEMENT");
  let mdScore: number | null = null;
  let mdAvail: MifScoreComponentResult["availability"] = usesMom ? "INSUFFICIENT" : "NOT_APPLICABLE";
  const mdInputs: string[] = [];
  if (usesMom && (mom || disp)) {
    mdAvail = "AVAILABLE";
    let acc = 50;
    if (disp) {
      const forming = noteHas(disp.notes, /provisional=TRUE|kind=FORMING|closeState=FORMING/i);
      const confirmed = noteHas(disp.notes, /confirmed=TRUE|kind=BULLISH|kind=BEARISH/i) && !forming;
      const structural = noteHas(disp.notes, /structuralDisplacement=TRUE/i);
      mdInputs.push(`displacement.forming=${forming}`, `displacement.confirmed=${confirmed}`);
      if (forming) {
        // Provisional FORMING never treated as confirmed
        acc += 5;
        qualityRestrictions.push("forming_displacement_provisional_only");
      } else if (confirmed) {
        const alignBull = noteHas(disp.notes, /direction=UP|kind=BULLISH/i) && cand.direction === "BUY";
        const alignBear = noteHas(disp.notes, /direction=DOWN|kind=BEARISH/i) && cand.direction === "SELL";
        if (alignBull || alignBear) acc += structural ? 35 : 25;
        else acc -= 15;
      }
    }
    if (mom) {
      const align =
        (noteHas(mom.notes, /direction=UP/i) && cand.direction === "BUY")
        || (noteHas(mom.notes, /direction=DOWN/i) && cand.direction === "SELL");
      mdInputs.push(`momentum.align=${align}`);
      acc += align ? 15 : noteHas(mom.notes, /direction=FLAT|UNKNOWN/i) ? 0 : -10;
    }
    mdScore = clampScore(acc);
  }
  components.push({
    componentId: "MOMENTUM_DISPLACEMENT",
    score: mdScore,
    weight: policy.weights.momentumDisplacement,
    weightedContribution:
      mdScore == null ? null : mdScore * policy.weights.momentumDisplacement,
    availability: mdAvail,
    inputs: mdInputs,
    missing: mdAvail === "INSUFFICIENT" ? ["MOMENTUM|PRICE_DISPLACEMENT"] : [],
    partial: disp && noteHas(disp.notes, /FORMING|provisional/i) ? [disp.evidenceId] : [],
    provenanceKeys: [mom?.sourceAssessmentId, disp?.sourceAssessmentId].filter(Boolean) as string[],
    explanation:
      "CLOSED confirmed displacement + momentum alignment; FORMING provisional cannot inflate as confirmed.",
  });

  // 6. MTF Agreement
  const mtf = findFamily(input.evidence, "MULTI_TIMEFRAME_RELATIONSHIP");
  const relFromNotes = mtf?.notes?.match(/relation=([A-Z_]+)/i)?.[1] ?? null;
  const rel = input.mtfRelation ?? relFromNotes;
  let mtfScore: number | null = null;
  let mtfAvail: MifScoreComponentResult["availability"] = "INSUFFICIENT";
  if (!rel || rel === "INSUFFICIENT_DATA" || rel === "UNKNOWN") {
    mtfAvail = "INSUFFICIENT";
  } else {
    mtfAvail = "AVAILABLE";
    switch (String(rel).toUpperCase()) {
      case "ALIGNMENT":
        mtfScore = 95;
        break;
      case "PARTIAL_ALIGNMENT":
        mtfScore = 70;
        break;
      case "TRANSITION":
        mtfScore = 55;
        break;
      case "POTENTIAL_REVERSAL":
        mtfScore = 40;
        break;
      case "CONFLICT":
        mtfScore = 20;
        break;
      default:
        mtfScore = 50;
    }
  }
  components.push({
    componentId: "MULTI_TIMEFRAME_AGREEMENT",
    score: mtfScore,
    weight: policy.weights.multiTimeframeAgreement,
    weightedContribution:
      mtfScore == null ? null : mtfScore * policy.weights.multiTimeframeAgreement,
    availability: mtfAvail,
    inputs: [`mtfRelation=${rel ?? "null"}`],
    missing: mtfAvail === "INSUFFICIENT" ? ["MULTI_TIMEFRAME_RELATIONSHIP"] : [],
    partial: rel === "PARTIAL_ALIGNMENT" ? ["mtf"] : [],
    provenanceKeys: mtf?.sourceAssessmentId ? [mtf.sourceAssessmentId] : [],
    explanation: "MTF directional relation mapped to 0–100; conflicts also feed conflict penalty.",
  });

  // 7. Strategy Setup Quality
  let setup = 60;
  if (cand.status === "DETECTED") setup = 80;
  if (cand.status === "NEEDS_CONFIRMATION") setup = 55;
  if (cand.status === "INVALID" || cand.status === "REJECTED") setup = 10;
  setup -= Math.min(30, (cand.requiredConfirmations?.length ?? 0) * 8);
  setup -= Math.min(20, (cand.knownLimitations?.length ?? 0) * 5);
  if (cand.quality?.score != null && Number.isFinite(cand.quality.score)) {
    // Existing detector quality is [0,1] analytical — blend lightly, not as win prob
    setup = setup * 0.7 + cand.quality.score * 100 * 0.3;
  }
  const setupScore = clampScore(setup);
  components.push({
    componentId: "STRATEGY_SETUP_QUALITY",
    score: setupScore,
    weight: policy.weights.strategySetupQuality,
    weightedContribution: setupScore * policy.weights.strategySetupQuality,
    availability: "AVAILABLE",
    inputs: [
      `status=${cand.status}`,
      `confirmations=${cand.requiredConfirmations?.length ?? 0}`,
      `limitations=${cand.knownLimitations?.length ?? 0}`,
    ],
    missing: [],
    partial: cand.status === "NEEDS_CONFIRMATION" ? ["status"] : [],
    provenanceKeys: [],
    explanation:
      "Candidate status, outstanding confirmations, known limitations; optional detector quality blend (not win probability).",
  });

  // 8. Conflict penalty
  const conflictCount =
    prov.contradictions.length
    + (rel === "CONFLICT" || rel === "POTENTIAL_REVERSAL" ? 1 : 0);
  const conflictPenalty = Math.min(
    policy.maxConflictPenalty,
    conflictCount * 8,
  );
  components.push({
    componentId: "CONFLICT_PENALTY",
    score: conflictPenalty,
    weight: 0,
    weightedContribution: -conflictPenalty,
    availability: conflictCount > 0 ? "AVAILABLE" : "NOT_APPLICABLE",
    inputs: [`conflictCount=${conflictCount}`],
    missing: [],
    partial: [],
    provenanceKeys: [],
    explanation:
      `Subtracts up to ${policy.maxConflictPenalty} points for contradictions; contradictions are preserved, not averaged away.`,
  });

  // Aggregate: renormalize positive weights over AVAILABLE/INSUFFICIENT components with scores
  const positiveComponents = components.filter(
    (c) =>
      c.componentId !== "CONFLICT_PENALTY"
      && c.score != null
      && c.availability !== "NOT_APPLICABLE"
      && c.availability !== "BLOCKED",
  );
  const weightSum = positiveComponents.reduce((a, c) => a + c.weight, 0);
  let overall: number | null = null;
  if (
    eligibility === "BLOCKED"
    || eligibility === "INVALID"
  ) {
    overall = null;
  } else if (positiveComponents.length === 0 || weightSum <= 0) {
    overall = null;
    if (eligibility === "ELIGIBLE_FOR_RANK") eligibility = "INSUFFICIENT_EVIDENCE";
  } else {
    const weighted = positiveComponents.reduce(
      (a, c) => a + (c.score! * c.weight) / weightSum,
      0,
    );
    overall = clampScore(weighted - conflictPenalty);
  }

  // If restricted partial, cap band below VERY_STRONG
  let scoreBand = bandFor(overall, eligibility, policy);
  if (eligibility === "RESTRICTED_PARTIAL" && scoreBand === "VERY_STRONG") {
    scoreBand = "STRONG";
    qualityRestrictions.push("capped_below_very_strong_due_to_partial");
  }

  const scoringExplanation = [
    `overall=${overall ?? "null"}`,
    `band=${scoreBand}`,
    `eligibility=${eligibility}`,
    `conflictPenalty=${conflictPenalty}`,
    `components=${positiveComponents.map((c) => `${c.componentId}=${c.score}`).join(",")}`,
    `policy=${policy.policyId}@${policy.policyVersion}`,
  ].join("; ");

  return {
    contractId: MIF_OPPORTUNITY_RANKING_CONTRACT_ID,
    contractVersion: MIF_OPPORTUNITY_RANKING_CONTRACT_VERSION,
    rankingRunId: input.rankingRunId,
    candidateId: cand.candidateId,
    analysisRunId: input.analysisRunId ?? null,
    providerId: cand.providerId,
    providerSymbol: cand.providerSymbol,
    strategyId: cand.strategyId,
    direction: cand.direction,
    timeframeRoles: [...cand.timeframeRoles],
    primaryTimeframe: input.primaryTimeframe ?? null,
    originalStatus: cand.status,
    lifecycleState: input.lifecycleState ?? null,
    rankingEligibility: eligibility,
    overallScore: overall,
    scoreBand,
    rankPosition: null,
    reliableRank:
      eligibility === "ELIGIBLE_FOR_RANK" || eligibility === "RESTRICTED_PARTIAL",
    componentScores: components,
    positiveContributions: prov.positive,
    negativeContributions: prov.negative,
    missingEvidence: [...new Set([...prov.missing, ...missingRequired])].sort(),
    partialEvidence: prov.partial,
    contradictions: prov.contradictions,
    qualityRestrictions,
    evidenceProvenanceRefs: prov.uniqueProvenanceKeys,
    scoringExplanation,
    rankingExplanation: "rank_pending",
    assessmentTimestamp: cand.assessmentTimestamp,
    rankedAt,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    engineId: MIF_OPPORTUNITY_RANKING_ENGINE_ID,
    engineVersion: MIF_OPPORTUNITY_RANKING_ENGINE_VERSION,
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

export function rankingInputIdentity(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableSerialize(parts)).digest("hex");
}
