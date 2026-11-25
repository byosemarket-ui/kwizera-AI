/**
 * Ensure primary market direction is always BUY|SELL while preserving
 * execution-readiness / confirmation as separate fields.
 * Analytical only — never authorizes broker execution.
 */
import type { HfmDirectionalFusionPackage } from "../../mif/directional-fusion/types.js";
import type {
  HfmReasoningDecisionAction,
  HfmReasoningDecisionStatus,
  HfmReasoningValidatedResult,
} from "./types.js";

export type HfmExecutionReadiness =
  | "SETUP_CONFIRMED"
  | "SETUP_DEVELOPING"
  | "ENTRY_NOT_AVAILABLE"
  | "RISK_CHECK_REQUIRED"
  | "EXECUTION_NOT_AUTHORIZED"
  | "WAITING_FOR_CONFIRMATION"
  | "INSUFFICIENT"
  | "NO_TRADE";

export interface HfmDirectionalConvictionView {
  direction: "BUY" | "SELL";
  directionalConvictionScore: number;
  convictionLabel: string;
  bullishEvidenceScore: number;
  bearishEvidenceScore: number;
  evidenceCompleteness: number;
  dataQuality: number;
  conflictSeverity: number;
  conflictKind: string;
  supportingEngineIds: string[];
  contradictingEngineIds: string[];
  keyEvidence: string[];
  knownLimitations: string[];
  calculationVersion: string;
  tieBreakApplied: boolean;
  tieBreakReason: string | null;
  scoreSemantics: "ANALYTICAL_DIRECTIONAL_CONVICTION_NOT_WIN_PROBABILITY";
  executionAuthorizationImplied: false;
}

function mapExecutionReadiness(input: {
  originalAction: string;
  decisionStatus: string;
  setupStatus: string;
}): HfmExecutionReadiness {
  const setup = input.setupStatus.toUpperCase();
  const status = input.decisionStatus.toUpperCase();
  const act = input.originalAction.toUpperCase();

  if (setup === "READY" && status === "CONFIRMED" && (act === "BUY" || act === "SELL")) {
    return "SETUP_CONFIRMED";
  }
  if (act === "NO_TRADE" || status === "NO_TRADE") return "NO_TRADE";
  if (status === "INSUFFICIENT" || status === "INVALIDATED" || status === "EXPIRED") {
    return "INSUFFICIENT";
  }
  if (setup === "WAITING" || status === "WAITING_FOR_CONFIRMATION" || act === "WAITING_FOR_CONFIRMATION") {
    return "WAITING_FOR_CONFIRMATION";
  }
  if (setup === "NOT_APPLICABLE" || status === "DEVELOPING" || status === "OBSERVING") {
    return "SETUP_DEVELOPING";
  }
  return "EXECUTION_NOT_AUTHORIZED";
}

function resolveDirection(input: {
  fusion: HfmDirectionalFusionPackage | null | undefined;
  action: string;
  overallBias: string | null | undefined;
  strongerSide: string | null | undefined;
}): "BUY" | "SELL" {
  if (input.fusion?.conviction.direction === "BUY" || input.fusion?.conviction.direction === "SELL") {
    return input.fusion.conviction.direction;
  }
  const act = String(input.action || "").toUpperCase();
  if (act === "BUY") return "BUY";
  if (act === "SELL") return "SELL";
  const side = String(input.strongerSide || "").toUpperCase();
  if (side === "BULLISH") return "BUY";
  if (side === "BEARISH") return "SELL";
  const bias = String(input.overallBias || "").toUpperCase();
  if (bias === "BULLISH") return "BUY";
  if (bias === "BEARISH") return "SELL";
  // Deterministic documented fallback — minimal evidence
  return "BUY";
}

export function applyPrimaryMarketDirection(input: {
  result: HfmReasoningValidatedResult;
  fusion: HfmDirectionalFusionPackage | null | undefined;
  strongerSide?: string | null;
}): HfmReasoningValidatedResult {
  const result = input.result;
  const originalAction = String(result.decision?.action ?? "WAITING_FOR_CONFIRMATION");
  const originalStatus = String(result.decisionStatus ?? "NOT_PROVIDED");
  const setupStatus = String(result.tradePlan?.setupStatus ?? "NOT_APPLICABLE");

  const marketDirection = resolveDirection({
    fusion: input.fusion,
    action: originalAction,
    overallBias: result.marketOverview?.overallBias,
    strongerSide: input.strongerSide,
  });

  const executionReadiness = mapExecutionReadiness({
    originalAction,
    decisionStatus: originalStatus,
    setupStatus,
  });

  // Preserve readiness semantics: WAITING/NO_TRADE must not become "CONFIRMED" merely because direction is set.
  let decisionStatus: HfmReasoningDecisionStatus = result.decisionStatus;
  if (
    originalAction === "WAITING_FOR_CONFIRMATION"
    || originalAction === "NO_TRADE"
    || originalStatus === "WAITING_FOR_CONFIRMATION"
    || originalStatus === "NO_TRADE"
    || originalStatus === "INSUFFICIENT"
    || originalStatus === "DEVELOPING"
    || originalStatus === "OBSERVING"
  ) {
    if (originalAction === "NO_TRADE" || originalStatus === "NO_TRADE") {
      decisionStatus = "NO_TRADE";
    } else if (originalStatus === "INSUFFICIENT") {
      decisionStatus = "INSUFFICIENT";
    } else if (originalStatus === "DEVELOPING" || originalStatus === "OBSERVING") {
      decisionStatus = originalStatus as HfmReasoningDecisionStatus;
    } else {
      decisionStatus = "WAITING_FOR_CONFIRMATION";
    }
  } else if (originalAction === "BUY" || originalAction === "SELL") {
    // Keep model/status when it already chose a direction; still never implies execution.
    decisionStatus = result.decisionStatus;
  }

  const conviction: HfmDirectionalConvictionView | null = input.fusion
    ? {
        direction: input.fusion.conviction.direction,
        directionalConvictionScore: input.fusion.conviction.directionalConvictionScore,
        convictionLabel: input.fusion.conviction.convictionLabel,
        bullishEvidenceScore: input.fusion.conviction.bullishEvidenceScore,
        bearishEvidenceScore: input.fusion.conviction.bearishEvidenceScore,
        evidenceCompleteness: input.fusion.conviction.evidenceCompleteness,
        dataQuality: input.fusion.conviction.dataQuality,
        conflictSeverity: input.fusion.conviction.conflictSeverity,
        conflictKind: input.fusion.conviction.conflictKind,
        supportingEngineIds: [...input.fusion.conviction.supportingEngineIds],
        contradictingEngineIds: [...input.fusion.conviction.contradictingEngineIds],
        keyEvidence: [...input.fusion.conviction.keyEvidence],
        knownLimitations: [
          ...input.fusion.conviction.knownLimitations,
          ...(originalAction === "WAITING_FOR_CONFIRMATION" || originalAction === "NO_TRADE"
            ? [`MODEL_ACTION_WAS_${originalAction}`]
            : []),
        ],
        calculationVersion: input.fusion.conviction.calculationVersion,
        tieBreakApplied: input.fusion.conviction.tieBreakApplied,
        tieBreakReason: input.fusion.conviction.tieBreakReason,
        scoreSemantics: "ANALYTICAL_DIRECTIONAL_CONVICTION_NOT_WIN_PROBABILITY",
        executionAuthorizationImplied: false,
      }
    : {
        direction: marketDirection,
        directionalConvictionScore: 15,
        convictionLabel: "MINIMAL",
        bullishEvidenceScore: marketDirection === "BUY" ? 1 : 0,
        bearishEvidenceScore: marketDirection === "SELL" ? 1 : 0,
        evidenceCompleteness: 0.2,
        dataQuality: 0.5,
        conflictSeverity: 50,
        conflictKind: "INSUFFICIENT_DATA",
        supportingEngineIds: [],
        contradictingEngineIds: [],
        keyEvidence: ["FUSION_PACKAGE_ABSENT_FALLBACK"],
        knownLimitations: [
          "FUSION_PACKAGE_ABSENT",
          "MINIMAL_EVIDENCE_FALLBACK",
          "DO_NOT_TREAT_AS_STRONG_SIGNAL",
          "NOT_WIN_PROBABILITY",
          "NOT_EXECUTION_AUTHORIZATION",
        ],
        calculationVersion: "hfm-directional-conviction-v1",
        tieBreakApplied: true,
        tieBreakReason: "DETERMINISTIC_FALLBACK_WITHOUT_FUSION",
        scoreSemantics: "ANALYTICAL_DIRECTIONAL_CONVICTION_NOT_WIN_PROBABILITY",
        executionAuthorizationImplied: false,
      };

  // Primary action is always BUY|SELL (directional). Readiness lives elsewhere.
  const action = marketDirection as HfmReasoningDecisionAction;

  // Trade plan direction follows marketDirection for display, but setupStatus stays readiness.
  const tradePlan = {
    ...result.tradePlan,
    direction:
      executionReadiness === "SETUP_CONFIRMED"
        ? marketDirection
        : result.tradePlan.direction === "BUY" || result.tradePlan.direction === "SELL"
        ? result.tradePlan.direction
        : ("NONE" as const),
    setupStatus:
      executionReadiness === "SETUP_CONFIRMED"
        ? result.tradePlan.setupStatus
        : result.tradePlan.setupStatus === "READY"
        ? ("WAITING" as const)
        : result.tradePlan.setupStatus,
  };

  // If model used WAITING as action, ensure setup is not READY
  if (
    (originalAction === "WAITING_FOR_CONFIRMATION" || originalAction === "NO_TRADE")
    && tradePlan.setupStatus === "READY"
  ) {
    tradePlan.setupStatus = originalAction === "NO_TRADE" ? "NOT_APPLICABLE" : "WAITING";
  }

  return {
    ...result,
    marketDirection,
    directionalConviction: conviction,
    executionReadiness,
    decision: {
      ...result.decision,
      action,
      summary:
        result.decision.summary
        + (originalAction !== action
          ? ` [Primary direction ${action} from evidence fusion; model/readiness was ${originalAction}/${decisionStatus}.]`
          : ""),
    },
    decisionStatus,
    tradePlan,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

/** True when prediction bridge may create a directional prediction snapshot. */
export function isPredictionBridgeEligible(result: HfmReasoningValidatedResult): boolean {
  const action = String(result.decision?.action ?? "").toUpperCase();
  if (action !== "BUY" && action !== "SELL") return false;
  const status = String(result.decisionStatus ?? "").toUpperCase();
  if (status !== "CONFIRMED") return false;
  const setup = String(result.tradePlan?.setupStatus ?? "").toUpperCase();
  if (setup !== "READY") return false;
  const readiness = String((result as { executionReadiness?: string }).executionReadiness ?? "").toUpperCase();
  if (
    readiness
    && readiness !== "SETUP_CONFIRMED"
    && readiness !== ""
  ) {
    // Explicit non-confirmed readiness blocks bridge
    if (
      readiness === "WAITING_FOR_CONFIRMATION"
      || readiness === "SETUP_DEVELOPING"
      || readiness === "ENTRY_NOT_AVAILABLE"
      || readiness === "EXECUTION_NOT_AUTHORIZED"
      || readiness === "INSUFFICIENT"
      || readiness === "NO_TRADE"
      || readiness === "RISK_CHECK_REQUIRED"
    ) {
      return false;
    }
  }
  if (result.acceptsForExecution === true) return false; // should never happen; belt-and-suspenders
  return true;
}
