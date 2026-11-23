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

export interface ParsedAnalysisView {
  action: DecisionAction;
  decisionStatus: string | null;
  confidence: number | null;
  confidenceLabel: string | null;
  confidenceDisclaimer: string;
  summary: string;
  selectedScenarioId: string | null;
  marketRegime: string | null;
  bullishAssessment: ParsedDirectionalAssessment | null;
  bearishAssessment: ParsedDirectionalAssessment | null;
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
  missingConfirmations: string[];
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

export function parseHfmAnalysisRecord(analysis: unknown): ParsedAnalysisView | null {
  const root = asRecord(analysis);
  if (!root) return null;
  const result = asRecord(root.result);
  const decision = asRecord(result?.decision);
  const rawAction = str(decision?.action)?.toUpperCase() ?? "";
  const action: DecisionAction =
    rawAction === "BUY"
    || rawAction === "SELL"
    || rawAction === "NO_TRADE"
    || rawAction === "WAITING_FOR_CONFIRMATION"
      ? rawAction
      : "NONE";

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
    decisionStatus: str(result?.decisionStatus),
    confidence: num(decision?.confidence),
    confidenceLabel: str(decision?.confidenceLabel),
    confidenceDisclaimer:
      str(cs?.definition)
      || HFM_ANALYTICAL_CONFIDENCE_DISCLAIMER,
    summary: str(decision?.summary) ?? "",
    selectedScenarioId: str(result?.selectedScenarioId) ?? str(lineage?.selectedScenarioId),
    marketRegime: str(result?.marketRegime),
    bullishAssessment: parseAssessment(result?.bullishAssessment, "BULLISH"),
    bearishAssessment: parseAssessment(result?.bearishAssessment, "BEARISH"),
    supportingEvidenceIds: strArr(result?.supportingEvidenceIds),
    conflictingEvidenceIds: strArr(result?.conflictingEvidenceIds),
    missingConfirmations: strArr(result?.missingConfirmations),
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
