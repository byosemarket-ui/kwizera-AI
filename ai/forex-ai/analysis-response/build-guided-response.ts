/**
 * Phase 46 — Assemble guided analysis sections from analysis + plans (no AI override of numbers).
 */
import type { SnapshotPlanBundle } from "../snapshot-plans/types.js";
import type { PositionRiskResult } from "../position-sizing/types.js";
import { buildOrderTicketGuidance } from "./order-ticket.js";
import type {
  GuidedAnalysisResponse,
  GuidedEvidenceSection,
  GuidedFinalDecision,
  GuidedMarketSummary,
  TradeAllocationInput,
} from "./types.js";
import { FOREX_GUIDED_ANALYSIS_SCHEMA } from "./types.js";

export interface GuidedAnalysisSource {
  analysisId?: string;
  snapshotId?: string;
  contentFingerprint?: string;
  analysisProvider?: string | null;
  model?: string | null;
  decision?: string | null;
  decisionRationale?: string | null;
  marketBias?: string | null;
  marketStructureSummary?: string | null;
  keyEvidence?: string[];
  bullishScenario?: string | null;
  bearishScenario?: string | null;
  invalidationConditions?: string[];
  limitations?: string[];
  warnings?: string[];
  dataQuality?: string | null;
  instrument?: string | null;
  provider?: string | null;
  planBundle?: (SnapshotPlanBundle & {
    pullback: SnapshotPlanBundle["pullback"] & { positionRisk?: PositionRiskResult | null };
    breakout: SnapshotPlanBundle["breakout"] & { positionRisk?: PositionRiskResult | null };
  }) | null;
}

function buildEvidence(src: GuidedAnalysisSource): GuidedEvidenceSection {
  const bundle = src.planBundle;
  const se = bundle?.structureEvidence;
  const observedFacts: string[] = [];
  if (se?.trendState) observedFacts.push(`Structure trendState: ${se.trendState}`);
  if (se?.quoteFreshness) observedFacts.push(`Quote freshness: ${se.quoteFreshness}`);
  if (se?.lastSwingHigh != null) observedFacts.push(`Last swing high: ${se.lastSwingHigh}`);
  if (se?.lastSwingLow != null) observedFacts.push(`Last swing low: ${se.lastSwingLow}`);
  for (const ev of (se?.events ?? []).slice(0, 4)) {
    observedFacts.push(`${ev.type} ${ev.direction} ${ev.status}${ev.level != null ? ` @ ${ev.level}` : ""}`);
  }
  for (const z of (se?.zones ?? []).slice(0, 3)) {
    observedFacts.push(`Zone ${z.side} ${z.low}–${z.high} (${z.status})`);
  }
  for (const p of (se?.patterns ?? []).slice(0, 3)) {
    const when = p.completedAt
      ?? (p.candleEndTime != null && Number.isFinite(p.candleEndTime)
        ? new Date(p.candleEndTime * 1000).toISOString().replace(".000Z", "Z")
        : null);
    const tf = p.timeframe ? ` tf=${p.timeframe}` : "";
    observedFacts.push(
      `Pattern ${p.name} ${p.direction} ${p.status}`
        + `${when ? ` @ ${when}` : ""}${tf}`,
    );
  }

  const supporting = [...(src.keyEvidence ?? [])];
  const contradicting: string[] = [];
  if (src.bullishScenario && bundle?.marketDirection === "BEARISH") {
    contradicting.push(`Bullish scenario still noted: ${src.bullishScenario}`);
  }
  if (src.bearishScenario && bundle?.marketDirection === "BULLISH") {
    contradicting.push(`Bearish scenario still noted: ${src.bearishScenario}`);
  }

  const confirmationRequired = [
    ...new Set([
      ...(bundle?.pullback.confirmationRequired ?? []),
      ...(bundle?.breakout.confirmationRequired ?? []),
    ]),
  ];
  const invalidationConditions = [
    ...new Set([
      ...(src.invalidationConditions ?? []),
      ...(bundle?.pullback.invalidationConditions ?? []).slice(0, 2),
      ...(bundle?.breakout.invalidationConditions ?? []).slice(0, 2),
    ]),
  ];
  const dataLimitations = [
    ...new Set([
      ...(src.limitations ?? []),
      ...(src.warnings ?? []),
      ...(se?.warnings ?? []),
      ...(bundle?.pullback.dataQualityLimitations ?? []),
      ...(bundle?.breakout.dataQualityLimitations ?? []),
    ]),
  ];

  return {
    observedFacts,
    supportingEvidence: supporting,
    contradictingEvidence: contradicting,
    confirmationRequired,
    invalidationConditions,
    dataLimitations,
    structureNotes: src.marketStructureSummary ? [src.marketStructureSummary] : [],
  };
}

function buildFinalDecision(src: GuidedAnalysisSource): GuidedFinalDecision {
  const bundle = src.planBundle;
  const decision = String(src.decision ?? "").toUpperCase();
  const directional = decision === "BUY" || decision === "SELL" ? decision : null;
  const biasOrCondition = bundle?.marketDirection ?? src.marketBias ?? "UNCERTAIN";
  const pullRisk = bundle?.pullback.positionRisk;
  const breakRisk = bundle?.breakout.positionRisk;
  const anyEligible = Boolean(pullRisk?.riskEligible || breakRisk?.riskEligible);
  const block = pullRisk?.blockingReasons[0] || breakRisk?.blockingReasons[0] || null;

  // Phase 50C — nextAction describes entry/risk readiness, not a replacement for BUY|SELL direction.
  let nextAction = "Do not submit a broker order from this panel — continue monitoring.";
  if (decision === "NO_TRADE" || bundle?.pullback.intent === "UNSUITABLE") {
    nextAction = "No suitable entry plan — clearer structure or fresher data needed before ticket review.";
  } else if (!anyEligible) {
    nextAction = block
      ? `${directional ? `Direction ${directional}. ` : ""}Address entry/risk blockers before a ticket: ${block}`
      : `${directional ? `Direction ${directional}. ` : ""}Complete confirmation and risk prerequisites before any order ticket.`;
  } else if (!directional) {
    nextAction = "Analysis did not produce a BUY/SELL directional classification — treat as incomplete.";
  } else {
    nextAction = `Directional lean is ${directional}. Entry confirmation and risk eligibility remain separate gates.`;
  }

  const keyFinancialRisk = pullRisk?.netLossAccount != null && pullRisk.accountCurrency
    ? `Pullback estimated risk ≈ ${pullRisk.netLossAccount.toFixed(2)} ${pullRisk.accountCurrency}`
    : breakRisk?.netLossAccount != null && breakRisk.accountCurrency
      ? `Breakout estimated risk ≈ ${breakRisk.netLossAccount.toFixed(2)} ${breakRisk.accountCurrency}`
      : "Financial risk unavailable until Phase 45 inputs are complete.";

  return {
    summary: directional
      ? `Directional decision: ${directional}. Market condition/bias context: ${biasOrCondition}. `
        + (bundle?.directionMeaning ?? "")
        + " Entry readiness and risk eligibility are separate from this lean."
      : `No BUY/SELL directional decision available. Condition/bias: ${biasOrCondition}. `
        + (bundle?.directionMeaning ?? ""),
    nextAction,
    primaryInvalidation:
      src.invalidationConditions?.[0]
      ?? bundle?.pullback.invalidationConditions[0]
      ?? bundle?.breakout.invalidationConditions[0]
      ?? null,
    keyFinancialRisk,
  };
}

export function buildGuidedAnalysisResponse(input: {
  source: GuidedAnalysisSource;
  tradeAllocation?: TradeAllocationInput | null;
}): GuidedAnalysisResponse {
  const src = input.source;
  const bundle = src.planBundle;
  const marketSummary: GuidedMarketSummary = {
    instrument: src.instrument ?? null,
    provider: src.provider ?? src.analysisProvider ?? null,
    snapshotId: src.snapshotId ?? null,
    dataQuality: src.dataQuality ?? null,
    marketCondition: bundle?.marketDirection ?? src.marketBias ?? null,
    conditionMeaning: bundle?.directionMeaning ?? null,
    conditionExplanation: bundle?.directionExplanation ?? null,
    decision: src.decision ?? null,
    decisionRationale: src.decisionRationale ?? null,
    confidenceDisplay: bundle?.confidenceDisplay ?? null,
  };

  const orderTicketByPlan = bundle
    ? [
      buildOrderTicketGuidance({ plan: bundle.pullback }),
      buildOrderTicketGuidance({ plan: bundle.breakout }),
    ]
    : [];

  return {
    schemaVersion: FOREX_GUIDED_ANALYSIS_SCHEMA,
    provider: src.analysisProvider ?? src.provider ?? null,
    model: src.model ?? null,
    marketSummary,
    evidence: buildEvidence(src),
    orderTicketByPlan,
    finalDecision: buildFinalDecision(src),
    tradeAllocation: input.tradeAllocation
      ? {
        amount: input.tradeAllocation.amount,
        currency: input.tradeAllocation.currency,
        note:
          "Allocated trade capital is not an acceptable loss. "
          + "Phase 45 risk budget (Admin settings) governs maximum loss sizing.",
      }
      : null,
  };
}
