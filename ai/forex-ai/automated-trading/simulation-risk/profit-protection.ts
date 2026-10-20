/**
 * Phase 56.2.2 — Simulation-only evidence-based profit protection.
 * Never widens Stop Loss. Never places broker orders.
 */
import type { AtBinaryDirection } from "../analysis/direction.js";

export type AtSimProfitProtectionState =
  | "NOT_APPLICABLE"
  | "MONITORING"
  | "WATCH"
  | "REVERSAL_CONFIRMED_SIM"
  | "PROTECTIVE_ACTION_PROPOSED_SIM";

export type AtSimProtectiveAction =
  | "NONE"
  | "CONTINUE_MONITOR"
  | "TIGHTEN_SL_SIM"
  | "EARLY_EXIT_SIM";

export interface AtSimProfitProtectionInput {
  direction: AtBinaryDirection | null;
  originalStopLoss: number | null;
  entryPrice: number | null;
  currentPrice: number | null;
  /** Favorable excursion in price units (mark-to-market vs entry). */
  favorableMovePrice: number | null;
  /** Stop distance used as 1R price proxy when monetary R unavailable. */
  stopDistancePrice: number | null;
  multiTimeframeReversalEvidence: boolean;
  evidenceContradictory: boolean;
  evidenceInsufficient: boolean;
  /**
   * Proposed sim-only threshold in R-multiples before protection activates.
   * Not owner-approved for live trading — labeled in result.
   */
  proposedMinFavorableR: number;
  /** Proposed tighten target (e.g. break-even). Pending owner approval for live. */
  proposedTightenToBreakEven: boolean;
}

export interface AtSimProfitProtectionResult {
  state: AtSimProfitProtectionState;
  simulationOnly: true;
  placesOrders: false;
  acceptsForExecution: false;
  isBrokerExecution: false;
  proposedAction: AtSimProtectiveAction;
  proposedStopLoss: number | null;
  originalStopLoss: number | null;
  evidenceCodes: string[];
  reason: string;
  trailingThresholdOwnerApproved: false;
  proposedMinFavorableR: number;
}

function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Evaluate simulation-only profit protection.
 * Widening the original SL is always rejected.
 */
export function evaluateProfitProtection(
  input: AtSimProfitProtectionInput,
): AtSimProfitProtectionResult {
  const base: Omit<AtSimProfitProtectionResult, "state" | "proposedAction" | "proposedStopLoss" | "evidenceCodes" | "reason"> = {
    simulationOnly: true,
    placesOrders: false,
    acceptsForExecution: false,
    isBrokerExecution: false,
    originalStopLoss: isFinitePositive(input.originalStopLoss) ? input.originalStopLoss : null,
    trailingThresholdOwnerApproved: false,
    proposedMinFavorableR: input.proposedMinFavorableR,
  };

  if (
    (input.direction !== "BUY" && input.direction !== "SELL")
    || !isFinitePositive(input.entryPrice)
    || !isFinitePositive(input.originalStopLoss)
  ) {
    return {
      ...base,
      state: "NOT_APPLICABLE",
      proposedAction: "NONE",
      proposedStopLoss: null,
      evidenceCodes: ["PROTECTION_CONTEXT_INCOMPLETE"],
      reason: "Profit protection requires direction, entry, and original Stop Loss.",
    };
  }

  if (input.evidenceInsufficient || input.evidenceContradictory) {
    return {
      ...base,
      state: "WATCH",
      proposedAction: "CONTINUE_MONITOR",
      proposedStopLoss: null,
      evidenceCodes: [
        input.evidenceInsufficient ? "EVIDENCE_INSUFFICIENT" : "",
        input.evidenceContradictory ? "EVIDENCE_CONTRADICTORY" : "",
      ].filter(Boolean),
      reason: "Insufficient or contradictory evidence — do not claim a confirmed reversal.",
    };
  }

  const stopDist =
    isFinitePositive(input.stopDistancePrice)
      ? input.stopDistancePrice
      : Math.abs(input.entryPrice - input.originalStopLoss);
  const fav = input.favorableMovePrice;
  const minR = input.proposedMinFavorableR > 0 ? input.proposedMinFavorableR : 1;

  if (!isFinitePositive(fav) || !(stopDist > 0) || fav < minR * stopDist) {
    return {
      ...base,
      state: "MONITORING",
      proposedAction: "CONTINUE_MONITOR",
      proposedStopLoss: null,
      evidenceCodes: ["FAVORABLE_MOVE_BELOW_THRESHOLD_OR_UNKNOWN"],
      reason:
        "Favorable move below proposed simulation threshold (pending owner approval) — continue monitoring; do not force 3R exit.",
    };
  }

  if (!input.multiTimeframeReversalEvidence) {
    return {
      ...base,
      state: "WATCH",
      proposedAction: "CONTINUE_MONITOR",
      proposedStopLoss: null,
      evidenceCodes: ["REVERSAL_EVIDENCE_NOT_CONFIRMED"],
      reason: "Favorable move present but multi-timeframe reversal evidence is not confirmed.",
    };
  }

  // Reversal confirmed in simulation — propose protective action.
  let proposedStopLoss: number | null = null;
  let proposedAction: AtSimProtectiveAction = "EARLY_EXIT_SIM";
  const evidenceCodes = ["REVERSAL_CONFIRMED_SIM", "MULTI_TF_REVERSAL"];

  if (input.proposedTightenToBreakEven) {
    proposedStopLoss = input.entryPrice;
    proposedAction = "TIGHTEN_SL_SIM";
    evidenceCodes.push("PROPOSED_TIGHTEN_TO_BREAK_EVEN_PENDING_OWNER");
  }

  // Never widen risk vs original SL.
  if (proposedStopLoss != null) {
    const widened =
      input.direction === "BUY"
        ? proposedStopLoss < input.originalStopLoss
        : proposedStopLoss > input.originalStopLoss;
    if (widened) {
      return {
        ...base,
        state: "WATCH",
        proposedAction: "CONTINUE_MONITOR",
        proposedStopLoss: null,
        evidenceCodes: ["PROTECTIVE_SL_WIDEN_REJECTED"],
        reason: "Proposed Stop Loss would widen risk — rejected by policy.",
      };
    }
  }

  return {
    ...base,
    state: "PROTECTIVE_ACTION_PROPOSED_SIM",
    proposedAction,
    proposedStopLoss,
    evidenceCodes,
    reason:
      "Simulation-only protective action proposed from confirmed reversal evidence. "
      + "Not a broker order. Trailing/tighten thresholds remain pending owner approval for live use.",
  };
}

/**
 * Guard: a candidate SL must not increase potential loss vs the original SL.
 */
export function wouldWidenStopLoss(
  direction: AtBinaryDirection,
  originalStopLoss: number,
  candidateStopLoss: number,
): boolean {
  if (direction === "BUY") return candidateStopLoss < originalStopLoss;
  return candidateStopLoss > originalStopLoss;
}
