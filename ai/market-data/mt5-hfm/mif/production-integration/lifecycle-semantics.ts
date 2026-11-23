/**
 * Phase 04 — Opportunity Lifecycle semantic stages mapped onto the existing
 * MifCandidateLifecycleState FSM. Does NOT introduce a second state machine.
 */
import type { MifCandidateLifecycleState, MifCandidateOutcomeKind } from "./persistence/types.js";

/** Phase 04 semantic stage labels (presentation / API). */
export type HfmOpportunityLifecycleSemanticStage =
  | "DETECTED"
  | "FORMING"
  | "WAITING_FOR_CONFIRMATION"
  | "CONFIRMED"
  | "INVALIDATED"
  | "EXPIRED"
  | "OUTCOME_PENDING"
  | "OUTCOME_EVALUATED";

export const HFM_LIFECYCLE_TRANSITION_RULE_VERSION = "phase04-lifecycle-v1" as const;

export const HFM_LIFECYCLE_PROVIDER_ID = "HFM_MT5" as const;

/** Active (non-terminal) persistence states eligible for continuous monitoring. */
export const HFM_LIFECYCLE_MONITORABLE_STATES: readonly MifCandidateLifecycleState[] = [
  "DETECTED",
  "ACTIVE",
  "NEEDS_CONFIRMATION",
  "CONFIRMED",
] as const;

/** Terminal persistence states — must not silently reopen. */
export const HFM_LIFECYCLE_TERMINAL_STATES: readonly MifCandidateLifecycleState[] = [
  "INVALIDATED",
  "EXPIRED",
  "COMPLETED",
  "OUTCOME_UNKNOWN",
  "REJECTED",
  "INVALID",
] as const;

/**
 * Map authoritative persistence state → Phase 04 semantic stage.
 * OUTCOME_PENDING = confirmed (or still-active after confirm path) awaiting decisive evaluation.
 * OUTCOME_EVALUATED = COMPLETED / OUTCOME_UNKNOWN after evaluator ran.
 */
export function toSemanticLifecycleStage(
  lifecycleState: MifCandidateLifecycleState,
  outcomeKind: MifCandidateOutcomeKind | null | undefined = null,
): HfmOpportunityLifecycleSemanticStage {
  switch (lifecycleState) {
    case "DETECTED":
      return "DETECTED";
    case "ACTIVE":
      // ACTIVE after detection = forming; if outcome already set, treat as pending/evaluated.
      if (outcomeKind && outcomeKind !== "NONE") return "OUTCOME_PENDING";
      return "FORMING";
    case "NEEDS_CONFIRMATION":
      return "WAITING_FOR_CONFIRMATION";
    case "CONFIRMED":
      // Confirmation met; decisive outcome not yet written (OUTCOME_PENDING filter
      // also matches CONFIRMED via semanticStageToPersistenceStates).
      return "CONFIRMED";
    case "INVALIDATED":
      return "INVALIDATED";
    case "EXPIRED":
      return "EXPIRED";
    case "COMPLETED":
    case "OUTCOME_UNKNOWN":
      return "OUTCOME_EVALUATED";
    case "REJECTED":
    case "INVALID":
      return "INVALIDATED";
    default:
      return "DETECTED";
  }
}

/** Reverse: semantic stage → preferred persistence state (for filters / docs). */
export function semanticStageToPersistenceStates(
  stage: HfmOpportunityLifecycleSemanticStage,
): readonly MifCandidateLifecycleState[] {
  switch (stage) {
    case "DETECTED":
      return ["DETECTED"];
    case "FORMING":
      return ["ACTIVE"];
    case "WAITING_FOR_CONFIRMATION":
      return ["NEEDS_CONFIRMATION"];
    case "CONFIRMED":
      return ["CONFIRMED"];
    case "INVALIDATED":
      return ["INVALIDATED", "REJECTED", "INVALID"];
    case "EXPIRED":
      return ["EXPIRED"];
    case "OUTCOME_PENDING":
      return ["CONFIRMED", "ACTIVE"];
    case "OUTCOME_EVALUATED":
      return ["COMPLETED", "OUTCOME_UNKNOWN"];
    default:
      return [];
  }
}

export function isTerminalLifecycleState(state: MifCandidateLifecycleState): boolean {
  return (HFM_LIFECYCLE_TERMINAL_STATES as readonly string[]).includes(state);
}

export function isMonitorableLifecycleState(state: MifCandidateLifecycleState): boolean {
  return (HFM_LIFECYCLE_MONITORABLE_STATES as readonly string[]).includes(state);
}

/** Manual API must never force CONFIRMED — only observe/monitor engines may. */
export function isManualForceConfirmForbidden(toState: MifCandidateLifecycleState): boolean {
  return toState === "CONFIRMED";
}
