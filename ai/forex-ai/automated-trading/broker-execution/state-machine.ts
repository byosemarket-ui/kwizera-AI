import {
  AT_BROKER_EXECUTION_PHASE1_ALLOWED_STATES,
  type AtBrokerExecutionLifecycle,
} from "./types.js";

const PHASE1_SET = new Set<AtBrokerExecutionLifecycle>(AT_BROKER_EXECUTION_PHASE1_ALLOWED_STATES);

/** Transitions that would imply broker mutation or submission — blocked in Phase 1. */
const SUBMIT_ADJACENT: ReadonlySet<AtBrokerExecutionLifecycle> = new Set([
  "PRECHECK",
  "READY_TO_SUBMIT",
  "SUBMITTING",
  "SUBMIT_UNKNOWN",
  "ACCEPTED",
  "REJECTED",
  "PARTIALLY_FILLED",
  "FILLED",
  "RECONCILING",
  "RECONCILED",
  "PROTECTION_PENDING",
  "CLOSED",
  "CANCELLED",
  "FAILED",
]);

export function isPhase1AllowedLifecycle(state: AtBrokerExecutionLifecycle): boolean {
  return PHASE1_SET.has(state);
}

export function isSubmitAdjacentLifecycle(state: AtBrokerExecutionLifecycle): boolean {
  return SUBMIT_ADJACENT.has(state);
}

/**
 * Pure Phase 1 transition guard.
 * Returns ok:false for any submit-adjacent target or illegal Phase 1 hop.
 */
export function assertPhase1Transition(
  from: AtBrokerExecutionLifecycle,
  to: AtBrokerExecutionLifecycle,
): { ok: true } | { ok: false; code: "PHASE1_SUBMIT_FORBIDDEN" | "INVALID_TRANSITION"; message: string } {
  if (isSubmitAdjacentLifecycle(to)) {
    return {
      ok: false,
      code: "PHASE1_SUBMIT_FORBIDDEN",
      message: `Phase 1 forbids transition ${from} → ${to} (submit/mutation not implemented).`,
    };
  }
  if (!isPhase1AllowedLifecycle(to)) {
    return {
      ok: false,
      code: "PHASE1_SUBMIT_FORBIDDEN",
      message: `Phase 1 does not allow lifecycle ${to}.`,
    };
  }
  // Allowed Phase 1 edges (non-exhaustive future graph reserved).
  const allowedFromIdle = new Set<AtBrokerExecutionLifecycle>([
    "IDLE",
    "AUTHORIZATION_REQUIRED",
    "PRECHECK_BLOCKED",
    "SUPERSEDED",
  ]);
  if (from === "IDLE" && allowedFromIdle.has(to)) return { ok: true };
  if (from === "AUTHORIZATION_REQUIRED" && (to === "IDLE" || to === "PRECHECK_BLOCKED" || to === "SUPERSEDED" || to === "AUTHORIZATION_REQUIRED")) {
    return { ok: true };
  }
  if (from === "PRECHECK_BLOCKED" && (to === "IDLE" || to === "AUTHORIZATION_REQUIRED" || to === "SUPERSEDED" || to === "PRECHECK_BLOCKED")) {
    return { ok: true };
  }
  if (from === "SUPERSEDED" && (to === "IDLE" || to === "SUPERSEDED")) return { ok: true };
  if (from === to) return { ok: true };
  return {
    ok: false,
    code: "INVALID_TRANSITION",
    message: `Invalid Phase 1 transition ${from} → ${to}.`,
  };
}
