/**
 * KWIZERA AI STUDIO → FOREX → AUTOMATED TRADING → XAU/USD
 * Post-entry management PLANNING only.
 *
 * Calculates trailing / partial-close / protective SL proposals.
 * Does NOT mutate broker state. Does NOT widen risk. Does NOT authorize execution.
 */
import { wouldWidenStopLoss } from "../simulation-risk/profit-protection.js";
import { floorQuantityToStep } from "../simulation-risk/quantity-constraints.js";

export const POST_ENTRY_PLAN_ENGINE_ID = "XauPostEntryManagementPlan" as const;

export type PostEntryPlanDecision =
  | "PLAN_READY"
  | "REJECTED"
  | "NOT_APPLICABLE";

export interface PostEntryPositionSnapshot {
  instrument: string | null;
  positionId: string | null;
  direction: "BUY" | "SELL" | null;
  entryPrice: number | null;
  currentPrice: number | null;
  originalStopLoss: number | null;
  takeProfit: number | null;
  openQuantityLots: number | null;
  quoteAgeMs: number | null;
  quoteMaxAgeMs?: number | null;
  quantityStep?: number | null;
  quantityMin?: number | null;
}

export interface PostEntryPlanInput extends PostEntryPositionSnapshot {
  /** Desired trailing distance in price units (tighten only). */
  trailingDistancePrice?: number | null;
  /** Fraction of open quantity to close (0–1], floored to broker step. */
  partialCloseFraction?: number | null;
  nowMs?: number | null;
}

export interface PostEntryPlanResult {
  engineId: typeof POST_ENTRY_PLAN_ENGINE_ID;
  decision: PostEntryPlanDecision;
  primaryReasonCode: string;
  reasonCodes: string[];
  trailing: {
    proposedStopLoss: number | null;
    widensRisk: boolean;
    brokerMutationAuthorized: false;
    note: string;
  };
  partialClose: {
    proposedCloseLots: number | null;
    remainingLots: number | null;
    brokerMutationAuthorized: false;
    note: string;
  };
  brokerSlModification: {
    supportedInThisPhase: false;
    authorized: false;
    note: string;
  };
  authorizesBrokerSubmission: false;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  evaluatedAtUtc: string;
  note: string;
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Build a post-entry management plan for an open XAU position.
 * Plans are auditable calculations only — never broker actions.
 */
export function planPostEntryManagement(input: PostEntryPlanInput): PostEntryPlanResult {
  const nowMs = input.nowMs ?? Date.now();
  const codes: string[] = [];
  const baseNote =
    "Post-entry PLAN only. Trailing / partial-close / SL modification against the broker "
    + "remain DISABLED until separately authorized.";

  const fail = (code: string, message: string): PostEntryPlanResult => ({
    engineId: POST_ENTRY_PLAN_ENGINE_ID,
    decision: "REJECTED",
    primaryReasonCode: code,
    reasonCodes: [code, ...codes],
    trailing: {
      proposedStopLoss: null,
      widensRisk: false,
      brokerMutationAuthorized: false,
      note: "No trailing plan — rejected.",
    },
    partialClose: {
      proposedCloseLots: null,
      remainingLots: null,
      brokerMutationAuthorized: false,
      note: "No partial-close plan — rejected.",
    },
    brokerSlModification: {
      supportedInThisPhase: false,
      authorized: false,
      note: "Broker SL modification is not authorized in this Automated Trading phase.",
    },
    authorizesBrokerSubmission: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    evaluatedAtUtc: new Date(nowMs).toISOString(),
    note: `${message} ${baseNote}`,
  });

  if (!input.positionId) return fail("MISSING_POSITION", "Position identity missing.");
  if (input.direction !== "BUY" && input.direction !== "SELL") {
    return fail("DIRECTION_INVALID", "Position direction missing.");
  }
  if (!finitePositive(input.entryPrice) || !finitePositive(input.currentPrice)) {
    return fail("PRICE_UNVERIFIED", "Entry/current price unverified.");
  }
  if (!finitePositive(input.originalStopLoss)) {
    return fail("ORIGINAL_SL_MISSING", "Original Stop Loss missing.");
  }
  if (!finitePositive(input.openQuantityLots)) {
    return fail("QUANTITY_INVALID", "Open quantity missing.");
  }

  const maxAge = input.quoteMaxAgeMs ?? 5_000;
  if (!finitePositive(input.quoteAgeMs) || input.quoteAgeMs > maxAge) {
    return fail("QUOTE_STALE", "Quote stale or age unknown — fail closed.");
  }

  // Trailing: tighten only toward market; never widen vs original SL.
  let proposedStop: number | null = null;
  let widens = false;
  if (finitePositive(input.trailingDistancePrice)) {
    proposedStop = input.direction === "BUY"
      ? input.currentPrice - input.trailingDistancePrice
      : input.currentPrice + input.trailingDistancePrice;
    widens = wouldWidenStopLoss(input.direction, input.originalStopLoss, proposedStop);
    if (widens) {
      codes.push("PROTECTIVE_SL_WIDEN_REJECTED");
      proposedStop = null;
    } else {
      codes.push("TRAILING_SL_PLAN_READY");
    }
  } else {
    codes.push("TRAILING_DISTANCE_NOT_CONFIGURED");
  }

  // Partial close: floor to broker step; never round up.
  let closeLots: number | null = null;
  let remaining: number | null = null;
  const step = finitePositive(input.quantityStep) ? input.quantityStep : 1;
  const minQ = finitePositive(input.quantityMin) ? input.quantityMin : step;
  if (finitePositive(input.partialCloseFraction) && input.partialCloseFraction <= 1) {
    const raw = input.openQuantityLots * input.partialCloseFraction;
    closeLots = floorQuantityToStep(raw, step, minQ);
    if (closeLots == null || closeLots <= 0) {
      codes.push("PARTIAL_CLOSE_BELOW_MIN_AFTER_FLOOR");
      closeLots = null;
    } else if (closeLots > input.openQuantityLots + 1e-12) {
      codes.push("PARTIAL_CLOSE_EXCEEDS_OPEN");
      closeLots = null;
    } else {
      remaining = Math.max(0, input.openQuantityLots - closeLots);
      // Remaining must also be 0 or ≥ min step (avoid dust below broker min).
      if (remaining > 0 && remaining + 1e-12 < minQ) {
        codes.push("PARTIAL_CLOSE_LEAVES_DUST_BELOW_MIN");
        closeLots = null;
        remaining = null;
      } else {
        codes.push("PARTIAL_CLOSE_PLAN_READY");
      }
    }
  } else {
    codes.push("PARTIAL_CLOSE_FRACTION_NOT_CONFIGURED");
  }

  const decision: PostEntryPlanDecision =
    (proposedStop != null || closeLots != null) ? "PLAN_READY" : "NOT_APPLICABLE";

  return {
    engineId: POST_ENTRY_PLAN_ENGINE_ID,
    decision,
    primaryReasonCode: decision === "PLAN_READY" ? "POST_ENTRY_PLAN_READY" : "POST_ENTRY_PLAN_NOT_APPLICABLE",
    reasonCodes: codes,
    trailing: {
      proposedStopLoss: proposedStop,
      widensRisk: widens,
      brokerMutationAuthorized: false,
      note: proposedStop != null
        ? "Trailing SL plan calculated — broker mutation NOT authorized."
        : "No valid trailing SL plan (missing distance or widen rejected).",
    },
    partialClose: {
      proposedCloseLots: closeLots,
      remainingLots: remaining,
      brokerMutationAuthorized: false,
      note: closeLots != null
        ? "Partial-close quantity floored to broker step — broker mutation NOT authorized."
        : "No valid partial-close plan.",
    },
    brokerSlModification: {
      supportedInThisPhase: false,
      authorized: false,
      note: "Broker SL modification remains DISABLED for Automated Trading XAU phase.",
    },
    authorizesBrokerSubmission: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    evaluatedAtUtc: new Date(nowMs).toISOString(),
    note: baseNote,
  };
}
