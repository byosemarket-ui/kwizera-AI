/**
 * Phase 6 — pure parsers for Phase 5 v1.2 reasoning + package summaries.
 * Phase 03 — surfaces prediction linkage + explicit score-kind availability.
 */
export const HFM_ANALYTICAL_CONFIDENCE_DISCLAIMER =
  "Analytical confidence — not win probability.";

export const HFM_ESTIMATED_PROBABILITY_UNAVAILABLE_LABEL = "NOT AVAILABLE";
export const HFM_ESTIMATED_PROBABILITY_UNAVAILABLE_REASON =
  "Charts path ranking-only; statistical probability not computed (skipProbability).";
export const HFM_HISTORICAL_WIN_RATE_SEE_ADMIN =
  "See Admin Performance Analytics for completed decisive evaluations.";

export type DecisionAction =
  | "BUY"
  | "SELL"
  | "NO_TRADE"
  | "WAITING_FOR_CONFIRMATION"
  | "NONE";

/** Directional preference separate from confirmed entry / WAITING. */
export type PreferredBias =
  | "BUY_BIAS"
  | "SELL_BIAS"
  | "NO_TRADE"
  | "NONE";

export type ParsedPredictionLinkageStatus =
  | "CREATED"
  | "REUSED"
  | "SKIPPED"
  | "FAILED"
  | null;

export interface ParsedPredictionLinkage {
  status: ParsedPredictionLinkageStatus;
  predictionId: string | null;
  reason: string | null;
  bridgedAt: string | null;
}
export interface ParsedDisagreement {
  agreesWithRanking: boolean | null;
  agreesWithScenarioOutcome: boolean | null;
  disagreementReason: string | null;
  alternativeEvidenceIds: string[];
}

export interface ParsedDirectionalAssessment {
  side: "BULLISH" | "BEARISH";
  status: string;
  summary: string;
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
  missingConfirmations: string[];
  invalidationConditions: string[];
}

export interface ParsedLevel {
  label: string;
  price: number | null;
  low: number | null;
  high: number | null;
  provenance: string | null;
  sourceBacked: boolean;
}

export interface ParsedDirectionalConviction {
  direction: "BUY" | "SELL" | null;
  score: number | null;
  label: string | null;
  bullishEvidenceScore: number | null;
  bearishEvidenceScore: number | null;
  evidenceCompleteness: number | null;
  dataQuality: number | null;
  conflictSeverity: number | null;
  conflictKind: string | null;
  supportingEngineIds: string[];
  contradictingEngineIds: string[];
  keyEvidence: string[];
  knownLimitations: string[];
  calculationVersion: string | null;
  scoreSemantics: string | null;
}

export interface ParsedAnalysisView {
  action: DecisionAction;
  /** Primary market direction — BUY|SELL when fusion/normalization applied. */
  marketDirection: "BUY" | "SELL" | null;
  /** Preferred directional bias; may be BUY_BIAS/SELL_BIAS while readiness remains WAITING. */
  preferredBias: PreferredBias;
  decisionStatus: string | null;
  executionReadiness: string | null;
  directionalConviction: ParsedDirectionalConviction | null;
  confidence: number | null;
  confidenceLabel: string | null;
  confidenceDisclaimer: string;
  summary: string;
  selectedScenarioId: string | null;
  marketRegime: string | null;
  overallBias: string | null;
  rankingReference: string | null;
  bullishAssessment: ParsedDirectionalAssessment | null;
  bearishAssessment: ParsedDirectionalAssessment | null;
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
  missingConfirmations: string[];
  /** Alias surfaced for Charts blocking UI (same ids/notes as missingConfirmations). */
  blockingReasons: string[];
  invalidationConditions: string[];
  disagreement: ParsedDisagreement;
  levels: ParsedLevel[];
  riskReward: number | null;
  analysisId: string | null;
  snapshotId: string | null;
  symbol: string | null;
  model: string | null;
  completeness: string | null;
  analysisStatus: string | null;
  inputCompleteness: string | null;
  groundingStatus: string | null;
  evidencePackageId: string | null;
  scenarioPackageId: string | null;
  dataQualityWarnings: string[];
  schemaVersion: string | null;
  /** Phase 03 — P8.A bridge linkage (immutable prediction record when CREATED/REUSED). */
  predictionLinkage: ParsedPredictionLinkage;
  /** Phase 03 — Charts path does not emit statistical probability. */
  estimatedProbabilityStatus: "NOT_AVAILABLE";
  estimatedProbabilityUnavailableReason: string;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function parseAssessment(
  raw: unknown,
  side: "BULLISH" | "BEARISH",
): ParsedDirectionalAssessment | null {
  const o = asRecord(raw);
  if (!o) return null;
  return {
    side,
    status: str(o.status) ?? "NOT_SUPPORTED",
    summary: str(o.summary) ?? `${side} assessment not provided`,
    supportingEvidenceIds: strArr(o.supportingEvidenceIds),
    conflictingEvidenceIds: strArr(o.conflictingEvidenceIds),
    missingConfirmations: strArr(o.missingConfirmations),
    invalidationConditions: strArr(o.invalidationConditions),
  };
}

const SUPPORTIVE_STATUSES = new Set([
  "WAITING_FOR_CONFIRMATION",
  "DEVELOPING",
  "POSSIBLE",
  "NEEDS_CONFIRMATION",
  "CONFIRMED",
  "ACTIVE",
  "DETECTED",
]);

const WEAK_STATUSES = new Set([
  "INSUFFICIENT",
  "NOT_SUPPORTED",
  "INVALIDATED",
  "REJECTED",
  "EXPIRED",
  "LOW_EVIDENCE",
  "BLOCKED",
]);

function statusRank(status: string | null | undefined): number {
  const s = String(status ?? "").toUpperCase();
  if (s === "CONFIRMED" || s === "ACTIVE" || s === "DETECTED") return 3;
  if (SUPPORTIVE_STATUSES.has(s)) return 2;
  if (WEAK_STATUSES.has(s)) return 0;
  return 1;
}

/**
 * Separates directional preference from confirmed trade action.
 * A market may show BUY_BIAS/SELL_BIAS while the decision remains WAITING_FOR_CONFIRMATION.
 */
export function derivePreferredBias(input: {
  action: DecisionAction;
  bullish: ParsedDirectionalAssessment | null;
  bearish: ParsedDirectionalAssessment | null;
  overallBias: string | null;
  rankingReference: string | null;
}): PreferredBias {
  if (input.action === "BUY") return "BUY_BIAS";
  if (input.action === "SELL") return "SELL_BIAS";
  if (input.action === "NO_TRADE") return "NO_TRADE";

  const ref = String(input.rankingReference ?? "").toUpperCase();
  if (ref.includes("BULLISH")) return "BUY_BIAS";
  if (ref.includes("BEARISH")) return "SELL_BIAS";

  const overall = String(input.overallBias ?? "").toUpperCase();
  if (overall === "BULLISH") return "BUY_BIAS";
  if (overall === "BEARISH") return "SELL_BIAS";

  const bullRank = statusRank(input.bullish?.status);
  const bearRank = statusRank(input.bearish?.status);
  const bullSupport = input.bullish?.supportingEvidenceIds.length ?? 0;
  const bearSupport = input.bearish?.supportingEvidenceIds.length ?? 0;

  if (bearRank > bullRank) return "SELL_BIAS";
  if (bullRank > bearRank) return "BUY_BIAS";
  if (bearSupport > bullSupport) return "SELL_BIAS";
  if (bullSupport > bearSupport) return "BUY_BIAS";
  return "NONE";
}

export function parseHfmAnalysisRecord(analysis: unknown): ParsedAnalysisView | null {
  const root = asRecord(analysis);
  if (!root) return null;
  const result = asRecord(root.result);
  const decision = asRecord(result?.decision);
  const rawAction = str(decision?.action)?.toUpperCase() ?? "";
  const rawMarketDirection = str(result?.marketDirection)?.toUpperCase() ?? "";
  const marketDirection: "BUY" | "SELL" | null =
    rawMarketDirection === "BUY" || rawMarketDirection === "SELL"
      ? rawMarketDirection
      : rawAction === "BUY" || rawAction === "SELL"
      ? rawAction
      : null;
  // Hero / primary action prefers marketDirection (always BUY|SELL when present).
  const action: DecisionAction =
    marketDirection
      ? marketDirection
      : rawAction === "BUY"
      || rawAction === "SELL"
      || rawAction === "NO_TRADE"
      || rawAction === "WAITING_FOR_CONFIRMATION"
      ? rawAction
      : "NONE";

  const convictionRaw = asRecord(result?.directionalConviction);
  const directionalConviction: ParsedDirectionalConviction | null = convictionRaw
    ? {
        direction:
          str(convictionRaw.direction)?.toUpperCase() === "SELL"
            ? "SELL"
            : str(convictionRaw.direction)?.toUpperCase() === "BUY"
            ? "BUY"
            : marketDirection,
        score: num(convictionRaw.directionalConvictionScore),
        label: str(convictionRaw.convictionLabel),
        bullishEvidenceScore: num(convictionRaw.bullishEvidenceScore),
        bearishEvidenceScore: num(convictionRaw.bearishEvidenceScore),
        evidenceCompleteness: num(convictionRaw.evidenceCompleteness),
        dataQuality: num(convictionRaw.dataQuality),
        conflictSeverity: num(convictionRaw.conflictSeverity),
        conflictKind: str(convictionRaw.conflictKind),
        supportingEngineIds: strArr(convictionRaw.supportingEngineIds),
        contradictingEngineIds: strArr(convictionRaw.contradictingEngineIds),
        keyEvidence: strArr(convictionRaw.keyEvidence),
        knownLimitations: strArr(convictionRaw.knownLimitations),
        calculationVersion: str(convictionRaw.calculationVersion),
        scoreSemantics: str(convictionRaw.scoreSemantics),
      }
    : null;

  const trade = asRecord(result?.tradePlan);
  const entry = asRecord(trade?.entryZone);
  const levels: ParsedLevel[] = [];
  const entryLow = num(entry?.low);
  const entryHigh = num(entry?.high);
  if (entryLow != null || entryHigh != null) {
    levels.push({
      label: "Entry zone",
      price: entryLow ?? entryHigh,
      low: entryLow,
      high: entryHigh,
      provenance: "tradePlan.entryZone",
      sourceBacked: true,
    });
  }
  const stop = num(trade?.stopLoss);
  if (stop != null) {
    levels.push({
      label: "Stop-loss",
      price: stop,
      low: stop,
      high: stop,
      provenance: "tradePlan.stopLoss",
      sourceBacked: true,
    });
  }
  const targets = Array.isArray(trade?.takeProfitTargets)
    ? (trade!.takeProfitTargets as unknown[]).map(num).filter((n): n is number => n != null)
    : [];
  targets.forEach((t, i) => {
    levels.push({
      label: `Take-profit ${i + 1}`,
      price: t,
      low: t,
      high: t,
      provenance: `tradePlan.takeProfitTargets[${i}]`,
      sourceBacked: true,
    });
  });
  const inv = num(trade?.invalidationPrice);
  if (inv != null) {
    levels.push({
      label: "Invalidation",
      price: inv,
      low: inv,
      high: inv,
      provenance: "tradePlan.invalidationPrice",
      sourceBacked: true,
    });
  }

  const dd = asRecord(result?.deterministicDisagreement) ?? {};
  const lineage = asRecord(root.lineage);
  const evidence = asRecord(result?.evidence);
  const cs = asRecord(result?.confidenceSemantics);
  const marketOverview = asRecord(result?.marketOverview);
  const bullishAssessment = parseAssessment(result?.bullishAssessment, "BULLISH");
  const bearishAssessment = parseAssessment(result?.bearishAssessment, "BEARISH");
  const overallBias = str(marketOverview?.overallBias);
  const rankingReference = str(lineage?.rankingReference);
  const missingConfirmations = strArr(result?.missingConfirmations);
  const preferredBias = derivePreferredBias({
    action,
    bullish: bullishAssessment,
    bearish: bearishAssessment,
    overallBias,
    rankingReference,
  });
  const linkageRaw = asRecord(root.predictionLinkage);
  const linkageStatusRaw = str(linkageRaw?.status)?.toUpperCase() ?? "";
  const predictionLinkage: ParsedPredictionLinkage = {
    status:
      linkageStatusRaw === "CREATED"
      || linkageStatusRaw === "REUSED"
      || linkageStatusRaw === "SKIPPED"
      || linkageStatusRaw === "FAILED"
        ? linkageStatusRaw
        : null,
    predictionId: str(linkageRaw?.predictionId),
    reason: str(linkageRaw?.reason),
    bridgedAt: str(linkageRaw?.bridgedAt),
  };

  return {
    action,
    marketDirection,
    preferredBias,
    decisionStatus: str(result?.decisionStatus),
    executionReadiness: str(result?.executionReadiness),
    directionalConviction,
    confidence: num(decision?.confidence),
    confidenceLabel: str(decision?.confidenceLabel),
    confidenceDisclaimer:
      str(cs?.definition)
      || HFM_ANALYTICAL_CONFIDENCE_DISCLAIMER,
    summary: str(decision?.summary) ?? "",
    selectedScenarioId: str(result?.selectedScenarioId) ?? str(lineage?.selectedScenarioId),
    marketRegime: str(result?.marketRegime),
    overallBias,
    rankingReference,
    bullishAssessment,
    bearishAssessment,
    supportingEvidenceIds: strArr(result?.supportingEvidenceIds),
    conflictingEvidenceIds: strArr(result?.conflictingEvidenceIds),
    missingConfirmations,
    blockingReasons: missingConfirmations,
    invalidationConditions: strArr(result?.invalidationConditions),
    disagreement: {
      agreesWithRanking:
        typeof dd.agreesWithRanking === "boolean" ? dd.agreesWithRanking : null,
      agreesWithScenarioOutcome:
        typeof dd.agreesWithScenarioOutcome === "boolean" ? dd.agreesWithScenarioOutcome : null,
      disagreementReason: str(dd.disagreementReason),
      alternativeEvidenceIds: strArr(dd.alternativeEvidenceIds),
    },
    levels,
    riskReward: num(trade?.riskRewardEstimate),
    analysisId: str(root.analysisId) ?? str(result?.analysisId),
    snapshotId: str(root.snapshotId) ?? str(result?.snapshotId) ?? str(root.contextId),
    symbol: str(root.symbol) ?? str(result?.symbol),
    model: str(result?.model) ?? str(root.model),
    completeness: str(asRecord(result?.completeness)?.status),
    analysisStatus: str(result?.analysisStatus) ?? str(root.status),
    inputCompleteness: str(result?.inputCompleteness) ?? str(lineage?.inputCompleteness),
    groundingStatus: str(lineage?.groundingStatus),
    evidencePackageId: str(result?.evidencePackageId) ?? str(lineage?.evidencePackageId),
    scenarioPackageId: str(result?.scenarioPackageId) ?? str(lineage?.scenarioPackageId),
    dataQualityWarnings: strArr(evidence?.dataQualityWarnings),
    schemaVersion: str(result?.schemaVersion) ?? str(root.schemaVersion),
    predictionLinkage,
    estimatedProbabilityStatus: "NOT_AVAILABLE",
    estimatedProbabilityUnavailableReason: HFM_ESTIMATED_PROBABILITY_UNAVAILABLE_REASON,
  };
}

export function extractScenarioLevels(
  scenario: Record<string, unknown> | null,
): ParsedLevel[] {
  if (!scenario) return [];
  const levels = asRecord(scenario.levels);
  if (!levels) return [];
  const out: ParsedLevel[] = [];
  const entry = asRecord(levels.entry);
  const entryPx = num(entry?.price);
  if (entryPx != null && entry?.source !== "NONE") {
    out.push({
      label: "Entry",
      price: entryPx,
      low: entryPx,
      high: entryPx,
      provenance: str(entry?.provenance),
      sourceBacked: true,
    });
  }
  const inv = asRecord(levels.invalidation);
  const invPx = num(inv?.price);
  if (invPx != null && inv?.source !== "NONE") {
    out.push({
      label: "Invalidation",
      price: invPx,
      low: invPx,
      high: invPx,
      provenance: str(inv?.provenance),
      sourceBacked: true,
    });
  }
  const targets = Array.isArray(levels.targets) ? levels.targets : [];
  targets.forEach((t, i) => {
    const row = asRecord(t);
    const px = num(row?.price);
    if (px != null && row?.source !== "NONE") {
      out.push({
        label: `Target ${i + 1}`,
        price: px,
        low: px,
        high: px,
        provenance: str(row?.provenance),
        sourceBacked: true,
      });
    }
  });
  return out;
}
