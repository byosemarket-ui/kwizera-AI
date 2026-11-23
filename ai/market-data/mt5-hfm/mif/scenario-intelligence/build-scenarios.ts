/**
 * Phase 4 — deterministic bullish + bearish scenario synthesis.
 * Reuses existing OD candidates and evidence. Non-LLM. No second market fetch.
 */
import type { MifOpportunityCandidate } from "../opportunity-detection/types.js";
import type { MifOpportunityRankingRun } from "../opportunity-ranking/types.js";
import type { MifProductionIntegrationResult } from "../production-integration/types.js";
import type { MifOrchestrationCandleTipState } from "../orchestration/types.js";
import {
  MIF_SCENARIO_INTELLIGENCE_CONTRACT_ID,
  MIF_SCENARIO_INTELLIGENCE_CONTRACT_VERSION,
  MIF_SCENARIO_INTELLIGENCE_ENGINE_ID,
  MIF_SCENARIO_INTELLIGENCE_ENGINE_VERSION,
  MIF_SCENARIO_PACKAGE_CONTRACT_ID,
  MIF_SCENARIO_PACKAGE_CONTRACT_VERSION,
  MIF_SCENARIO_TF_PACK,
} from "./contracts.js";
import {
  computeScenarioId,
  computeScenarioPackageId,
  computeSetupFingerprint,
} from "./fingerprint.js";
import { buildScenarioLevels } from "./levels.js";
import {
  candidateStatusToPresentation,
  presentationStatusToLifecycle,
} from "./lifecycle-map.js";
import type {
  MifDirectionalScenario,
  MifScenarioDirection,
  MifScenarioIntelligenceResult,
  MifScenarioPackage,
  MifScenarioPackageOutcome,
  MifScenarioPresentationStatus,
  MifScenarioTimeframeContext,
} from "./types.js";

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((x) => String(x || "").trim()))].sort();
}

function uniqueByAssessment(
  evidenceIds: readonly string[],
  evidence: readonly { evidenceId: string; sourceAssessmentId: string | null }[],
): { ids: string[]; assessmentKeys: string[]; noAssessmentCount: number } {
  const byAssessment = new Map<string, string>();
  const noAssessment: string[] = [];
  for (const id of evidenceIds) {
    const ref = evidence.find((e) => e.evidenceId === id);
    const key = ref?.sourceAssessmentId?.trim() || "";
    if (!key) {
      // Phase 02 — still include once per id, but do not invent assessment keys.
      if (!noAssessment.includes(id)) noAssessment.push(id);
      continue;
    }
    // Prefer first id per assessment — prevents double-counting overlapping detectors
    if (!byAssessment.has(key)) byAssessment.set(key, id);
  }
  return {
    ids: uniqueIds([...byAssessment.values(), ...noAssessment]),
    // Align count with what actually contributes to unique ids.
    assessmentKeys: [...byAssessment.keys(), ...noAssessment.map((id) => `noAssessment:${id}`)].sort(),
    noAssessmentCount: noAssessment.length,
  };
}

function directionMatches(
  side: MifScenarioDirection,
  cand: MifOpportunityCandidate,
): boolean {
  if (side === "BULLISH") return cand.direction === "BUY";
  return cand.direction === "SELL";
}

function tipHasForming(tipStates: Readonly<Record<string, string>>): boolean {
  return Object.values(tipStates).some((s) => String(s).toUpperCase() === "FORMING");
}

function anySupportingForming(
  evidenceIds: readonly string[],
  evidence: readonly { evidenceId: string; candleState: string | null }[],
): boolean {
  for (const id of evidenceIds) {
    const e = evidence.find((x) => x.evidenceId === id);
    if (e && String(e.candleState || "").toUpperCase() === "FORMING") return true;
  }
  return false;
}

function resolvePresentationStatus(input: {
  candidates: readonly MifOpportunityCandidate[];
  missingConfirmations: readonly string[];
  incompleteEvidence: boolean;
  formingOnlyBlocked: boolean;
  hasConflict: boolean;
  tipStates: Readonly<Record<string, string>>;
}): MifScenarioPresentationStatus {
  if (!input.candidates.length || input.incompleteEvidence) {
    return "INSUFFICIENT";
  }
  if (input.candidates.every((c) => c.status === "INVALID")) return "INVALIDATED";
  if (input.candidates.every((c) => c.status === "REJECTED")) return "INSUFFICIENT";

  const best = input.candidates.find((c) => c.status === "DETECTED")
    ?? input.candidates.find((c) => c.status === "NEEDS_CONFIRMATION")
    ?? input.candidates[0]!;

  let status = candidateStatusToPresentation(best.status);

  if (
    status === "DEVELOPING"
    && (input.missingConfirmations.length > 0 || best.status === "NEEDS_CONFIRMATION")
  ) {
    status = "WAITING_FOR_CONFIRMATION";
  }

  // Never confirm from FORMING alone or with outstanding confirmations / incomplete evidence
  if (status === "DEVELOPING" || status === "WAITING_FOR_CONFIRMATION") {
    const canConfirm =
      best.status === "DETECTED"
      && input.missingConfirmations.length === 0
      && !input.formingOnlyBlocked
      && !input.incompleteEvidence
      && !tipHasForming(
        Object.fromEntries(
          Object.entries(input.tipStates).filter(([tf]) =>
            ["M5", "M15"].includes(tf),
          ),
        ),
      );
    if (canConfirm && !input.hasConflict) {
      status = "CONFIRMED";
    } else if (best.status === "DETECTED" && input.formingOnlyBlocked) {
      status = "WAITING_FOR_CONFIRMATION";
    } else if (best.status === "DETECTED" && input.hasConflict) {
      status = "DEVELOPING";
    }
  }

  if (status === "CONFIRMED" && (input.formingOnlyBlocked || input.incompleteEvidence)) {
    status = "WAITING_FOR_CONFIRMATION";
  }

  return status;
}

function buildTimeframeContext(input: {
  expectedTimeframes: readonly string[];
  presentTimeframes: readonly string[];
  missingTimeframes: readonly string[];
  tipStates: Readonly<Record<string, string>>;
  mtfRelation: string | null;
}): MifScenarioTimeframeContext {
  const conflictNotes: string[] = [];
  if (input.missingTimeframes.length) {
    conflictNotes.push(`MISSING_TIMEFRAMES:${input.missingTimeframes.join(",")}`);
  }
  for (const [tf, st] of Object.entries(input.tipStates)) {
    if (/STALE/i.test(st)) conflictNotes.push(`STALE_TF:${tf}`);
    if (/MISSING/i.test(st)) conflictNotes.push(`MISSING_TF_TIP:${tf}`);
  }
  if (input.mtfRelation === "CONFLICT" || input.mtfRelation === "POTENTIAL_REVERSAL") {
    conflictNotes.push(`MTF_${input.mtfRelation}`);
  }
  return {
    expectedTimeframes: [...input.expectedTimeframes],
    presentTimeframes: [...input.presentTimeframes],
    missingTimeframes: [...input.missingTimeframes],
    tipStates: { ...input.tipStates },
    higherTimeframeContext: ["H4", "H1"].filter((tf) =>
      input.presentTimeframes.includes(tf)
    ),
    intermediateStructure: ["H1", "M30"].filter((tf) =>
      input.presentTimeframes.includes(tf)
    ),
    lowerTimeframeFormation: ["M15", "M5"].filter((tf) =>
      input.presentTimeframes.includes(tf)
    ),
    conflictNotes,
  };
}

function scoreSide(input: {
  candidates: readonly MifOpportunityCandidate[];
  ranking: MifOpportunityRankingRun | null;
  supportingCount: number;
  conflictingCount: number;
  status: MifScenarioPresentationStatus;
}): number {
  let score = 0;
  score += input.candidates.length * 10;
  score += input.supportingCount * 8;
  score -= input.conflictingCount * 12;
  if (input.status === "CONFIRMED") score += 25;
  if (input.status === "WAITING_FOR_CONFIRMATION") score += 10;
  if (input.status === "DEVELOPING") score += 8;
  if (input.status === "INSUFFICIENT" || input.status === "INVALIDATED") score -= 40;

  if (input.ranking) {
    for (const r of input.ranking.rankings) {
      if (!input.candidates.some((c) => c.candidateId === r.candidateId)) continue;
      if (r.overallScore != null) score += r.overallScore * 0.35;
      if (r.scoreBand === "VERY_STRONG" || r.scoreBand === "STRONG") score += 8;
      if (r.scoreBand === "BLOCKED" || r.scoreBand === "INSUFFICIENT_EVIDENCE") score -= 15;
    }
  }
  return score;
}

function buildOneSide(input: {
  side: MifScenarioDirection;
  providerSymbol: string;
  candidates: readonly MifOpportunityCandidate[];
  evidence: readonly {
    evidenceId: string;
    sourceAssessmentId: string | null;
    candleState: string | null;
    qualityStatus: string;
  }[];
  tipStates: Readonly<Record<string, string>>;
  incompleteEvidence: boolean;
  snapshotId: string | null;
  snapshotIdSourceVerified: boolean;
  assessmentTimestamp: string;
  mtfRelation: string | null;
}): MifDirectionalScenario {
  const sideCands = input.candidates.filter((c) => directionMatches(input.side, c));
  const rawSupport = sideCands.flatMap((c) => c.supportingEvidenceIds);
  const rawConflict = sideCands.flatMap((c) => c.conflictingEvidenceIds);
  const support = uniqueByAssessment(rawSupport, input.evidence);
  const conflict = uniqueByAssessment(rawConflict, input.evidence);
  const missingConfirmations = uniqueIds(
    sideCands.flatMap((c) => c.requiredConfirmations ?? []),
  );
  const invalidationConditions = uniqueIds(
    sideCands.flatMap((c) => c.invalidationConditions ?? []),
  );
  const strategyIds = uniqueIds(sideCands.map((c) => String(c.strategyId)));
  const formingBlocked =
    anySupportingForming(support.ids, input.evidence)
    || (tipHasForming(input.tipStates) && missingConfirmations.length > 0);

  const hasConflict =
    conflict.ids.length > 0
    || input.mtfRelation === "CONFLICT"
    || input.mtfRelation === "POTENTIAL_REVERSAL";

  const status = resolvePresentationStatus({
    candidates: sideCands,
    missingConfirmations,
    incompleteEvidence: input.incompleteEvidence || sideCands.length === 0,
    formingOnlyBlocked: formingBlocked,
    hasConflict,
    tipStates: input.tipStates,
  });

  const lifecycleState = presentationStatusToLifecycle(status);
  const levels = buildScenarioLevels({ side: input.side, candidates: sideCands });
  const fingerprint = computeSetupFingerprint({
    providerSymbol: input.providerSymbol,
    side: input.side,
    strategyIds,
    candidates: sideCands,
  });
  const scenarioId = computeScenarioId({ setupFingerprint: fingerprint, side: input.side });

  const warnings: string[] = [];
  if (sideCands.length === 0) warnings.push(`NO_CANDIDATES_${input.side}`);
  if (formingBlocked) warnings.push("FORMING_CONFIRMATION_BLOCKED");
  if (input.incompleteEvidence) warnings.push("INCOMPLETE_EVIDENCE");
  if (hasConflict) warnings.push("DIRECTIONAL_OR_MTF_CONFLICT");
  if (levels.status !== "AVAILABLE_FROM_SOURCE") warnings.push(levels.status);
  if (support.noAssessmentCount > 0 || conflict.noAssessmentCount > 0) {
    warnings.push(
      `NO_ASSESSMENT_EVIDENCE_IDS support=${support.noAssessmentCount};conflict=${conflict.noAssessmentCount}`,
    );
  }

  const trustedConfirmed =
    status === "CONFIRMED"
    && !formingBlocked
    && !input.incompleteEvidence
    && support.ids.length > 0;

  const thesis = sideCands[0]?.thesis
    ?? `${input.side} scenario — no qualifying detector candidate`;
  const rationale = sideCands.length
    ? sideCands.map((c) => `${c.strategyId}:${c.status}`).join("; ")
    : "No BUY/SELL candidates on this side after eligibility and detection";

  return {
    scenarioId,
    setupFingerprint: fingerprint,
    side: input.side,
    providerId: "HFM_MT5",
    providerSymbol: input.providerSymbol,
    status,
    lifecycleState,
    thesis,
    rationale,
    supportingEvidenceIds: support.ids,
    conflictingEvidenceIds: conflict.ids,
    missingConfirmations,
    invalidationConditions,
    contributingCandidateIds: sideCands.map((c) => c.candidateId),
    contributingStrategyIds: strategyIds,
    levels,
    evidenceCompleteness: {
      supportingCount: support.ids.length,
      conflictingCount: conflict.ids.length,
      uniqueAssessmentCount: support.assessmentKeys.length,
      incompleteEvidence: input.incompleteEvidence || sideCands.length === 0,
      formingOnlyConfirmationBlocked: formingBlocked,
      trustedConfirmed,
    },
    warnings,
    assessmentTimestamp: input.assessmentTimestamp,
    snapshotId: input.snapshotId,
    snapshotIdSourceVerified: input.snapshotIdSourceVerified,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    analyticalScenarioOnly: true,
    notExecutable: true,
    doesNotApproveAiReasoning: true,
  };
}

export interface BuildScenarioIntelligenceInput {
  pipeline: MifProductionIntegrationResult;
  rankingRun?: MifOpportunityRankingRun | null;
  snapshotId?: string | null;
  snapshotHash?: string | null;
  snapshotIdSourceVerified?: boolean;
  tipStates?: Readonly<Record<string, MifOrchestrationCandleTipState | string>>;
  presentTimeframes?: readonly string[];
  missingTimeframes?: readonly string[];
  expectedTimeframes?: readonly string[];
  /** Soft deadline — if already past, skip optional enrichment notes only. */
  deadlineAtMs?: number | null;
}

/**
 * Build dual-direction scenario package from an existing pipeline result.
 */
export function buildScenarioIntelligence(
  input: BuildScenarioIntelligenceInput,
): MifScenarioIntelligenceResult {
  const started = Date.now();
  const pipeline = input.pipeline;
  const symbol = String(pipeline.providerSymbol || "").trim().toUpperCase();
  const tipStates = { ...(input.tipStates ?? {}) };
  const expected = input.expectedTimeframes ?? MIF_SCENARIO_TF_PACK;
  const present = input.presentTimeframes
    ?? pipeline.resolvedTimeframes
    ?? [];
  const missing = input.missingTimeframes
    ?? expected.filter((tf) => !present.includes(tf));
  const incompleteEvidence =
    missing.length > 0
    || pipeline.dataQualityStatus === "BLOCKED"
    || pipeline.dataQualityStatus === "MISSING"
    || /FAILED_/i.test(String(pipeline.analysisStatus || ""));

  const evidence = pipeline.evidenceRefs ?? [];
  const candidates = pipeline.detection?.candidates ?? [];
  const ranking = input.rankingRun
    ?? (pipeline as { _rankingRun?: MifOpportunityRankingRun | null })._rankingRun
    ?? null;

  const common = {
    providerSymbol: symbol,
    candidates,
    evidence,
    tipStates,
    incompleteEvidence,
    snapshotId: input.snapshotId ?? null,
    snapshotIdSourceVerified: input.snapshotIdSourceVerified === true,
    assessmentTimestamp: pipeline.processingTimestamp || pipeline.marketDataTimestamp || new Date().toISOString(),
    mtfRelation: pipeline.mtfRelation ?? null,
  };

  const bullish = buildOneSide({ ...common, side: "BULLISH" });
  const bearish = buildOneSide({ ...common, side: "BEARISH" });

  const bullScore = scoreSide({
    candidates: candidates.filter((c) => c.direction === "BUY"),
    ranking,
    supportingCount: bullish.evidenceCompleteness.supportingCount,
    conflictingCount: bullish.evidenceCompleteness.conflictingCount,
    status: bullish.status,
  });
  const bearScore = scoreSide({
    candidates: candidates.filter((c) => c.direction === "SELL"),
    ranking,
    supportingCount: bearish.evidenceCompleteness.supportingCount,
    conflictingCount: bearish.evidenceCompleteness.conflictingCount,
    status: bearish.status,
  });

  const bullQualified =
    bullish.status !== "INSUFFICIENT"
    && bullish.status !== "INVALIDATED"
    && bullish.status !== "EXPIRED"
    && bullish.contributingCandidateIds.length > 0;
  const bearQualified =
    bearish.status !== "INSUFFICIENT"
    && bearish.status !== "INVALIDATED"
    && bearish.status !== "EXPIRED"
    && bearish.contributingCandidateIds.length > 0;

  let outcome: MifScenarioPackageOutcome = "NO_QUALIFIED_OPPORTUNITY";
  let strongerSide: MifScenarioDirection | null = null;
  let comparisonExplanation: string;

  if (!bullQualified && !bearQualified) {
    outcome = "NO_QUALIFIED_OPPORTUNITY";
    comparisonExplanation =
      "Neither bullish nor bearish side produced a sufficiently qualified setup after evidence evaluation.";
  } else if (bullQualified && !bearQualified) {
    outcome = "BULLISH_PREFERRED";
    strongerSide = "BULLISH";
    comparisonExplanation = `Bullish preferred (score=${bullScore.toFixed(1)}); bearish not qualified (${bearish.status}).`;
  } else if (bearQualified && !bullQualified) {
    outcome = "BEARISH_PREFERRED";
    strongerSide = "BEARISH";
    comparisonExplanation = `Bearish preferred (score=${bearScore.toFixed(1)}); bullish not qualified (${bullish.status}).`;
  } else {
    const delta = bullScore - bearScore;
    if (Math.abs(delta) < 8) {
      outcome = "BALANCED_CONFLICT";
      strongerSide = null;
      comparisonExplanation =
        `Both sides qualified with similar strength (bull=${bullScore.toFixed(1)}, bear=${bearScore.toFixed(1)}); conflicts retained.`;
    } else if (delta > 0) {
      outcome = "BULLISH_PREFERRED";
      strongerSide = "BULLISH";
      comparisonExplanation =
        `Bullish stronger (bull=${bullScore.toFixed(1)} vs bear=${bearScore.toFixed(1)}) by evidence quality — not raw detector count.`;
    } else {
      outcome = "BEARISH_PREFERRED";
      strongerSide = "BEARISH";
      comparisonExplanation =
        `Bearish stronger (bear=${bearScore.toFixed(1)} vs bull=${bullScore.toFixed(1)}) by evidence quality — not raw detector count.`;
    }
  }

  const timeframeContext = buildTimeframeContext({
    expectedTimeframes: expected,
    presentTimeframes: present,
    missingTimeframes: missing,
    tipStates,
    mtfRelation: pipeline.mtfRelation ?? null,
  });

  const warnings = uniqueIds([
    ...bullish.warnings,
    ...bearish.warnings,
    ...timeframeContext.conflictNotes,
    ...(input.deadlineAtMs != null && Date.now() >= input.deadlineAtMs
      ? ["SCENARIO_BUILT_NEAR_DEADLINE"]
      : []),
  ]);

  const completenessTrusted =
    !incompleteEvidence
    && missing.length === 0
    && (bullish.evidenceCompleteness.trustedConfirmed
      || bearish.evidenceCompleteness.trustedConfirmed
      || outcome === "NO_QUALIFIED_OPPORTUNITY");

  const packageId = computeScenarioPackageId({
    providerSymbol: symbol,
    snapshotId: input.snapshotId ?? null,
    bullishFingerprint: bullish.setupFingerprint,
    bearishFingerprint: bearish.setupFingerprint,
  });

  const pkg: MifScenarioPackage = {
    contractId: MIF_SCENARIO_PACKAGE_CONTRACT_ID,
    contractVersion: MIF_SCENARIO_PACKAGE_CONTRACT_VERSION,
    engineId: MIF_SCENARIO_INTELLIGENCE_ENGINE_ID,
    engineVersion: MIF_SCENARIO_INTELLIGENCE_ENGINE_VERSION,
    packageId,
    providerId: "HFM_MT5",
    providerSymbol: symbol,
    snapshotId: input.snapshotId ?? null,
    snapshotHash: input.snapshotHash ?? null,
    snapshotIdSourceVerified: input.snapshotIdSourceVerified === true,
    assessmentTimestamp: common.assessmentTimestamp,
    bullishScenario: bullish,
    bearishScenario: bearish,
    outcome,
    strongerSide,
    comparisonExplanation,
    timeframeContext,
    warnings,
    completenessTrusted,
    analyticalPackageOnly: true,
    notExecutable: true,
    doesNotApproveAiReasoning: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };

  const totalMs = Date.now() - started;
  return {
    contractId: MIF_SCENARIO_INTELLIGENCE_CONTRACT_ID,
    contractVersion: MIF_SCENARIO_INTELLIGENCE_CONTRACT_VERSION,
    package: pkg,
    timingsMs: { buildMs: totalMs, totalMs },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    analyticalOnly: true,
    notExecutable: true,
  };
}
