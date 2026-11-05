import type { AutomatedTradingEnvironment } from "../types.js";
import type {
  AtBrokerExecutionAuthorizationIntent,
  AtBrokerExecutionBlocker,
  AtBrokerExecutionFoundationPersisted,
} from "./types.js";
import { OWNER_MAX_LOTS_EXECUTION } from "./types.js";

export interface ExecutionAuthorizationEvalInput {
  foundation: AtBrokerExecutionFoundationPersisted;
  environment: AutomatedTradingEnvironment;
  emergencyEntryLock: boolean;
  handoffLifecycle: string | null;
  handoffId: string | null;
  proposalId: string | null;
  quantityLots: number | null;
  capitalAllocationPercent: number | null;
  individualOrderAllocation: number | null;
  /** System Master ON must never be treated as execution auth. */
  systemMasterOn: boolean;
  nowMs?: number;
}

export interface ExecutionAuthorizationEvalResult {
  mayProceedTowardSubmit: false;
  blockers: AtBrokerExecutionBlocker[];
  systemMasterDoesNotAuthorizeExecution: true;
  handoffReadyIsNotExecutionPermission: true;
  phase1SubmitImplemented: false;
}

/**
 * Fail-closed authorization matrix for Phase 1.
 * Always returns mayProceedTowardSubmit=false — no path enables mutation.
 */
export function evaluateExecutionAuthorization(
  input: ExecutionAuthorizationEvalInput,
): ExecutionAuthorizationEvalResult {
  const blockers: AtBrokerExecutionBlocker[] = [];

  blockers.push({
    code: "PHASE1_SUBMIT_FORBIDDEN",
    message: "Broker Execution Engine Phase 1 does not implement order submission.",
  });

  if (!input.foundation.executionMasterEnabled) {
    blockers.push({
      code: "EXECUTION_MASTER_OFF",
      message: "Execution Master is OFF (default). Distinct from System Master.",
    });
  }

  if (!input.foundation.armedForSubmission) {
    blockers.push({
      code: "NOT_ARMED",
      message: "Submission arming is false. Phase 1 never arms automatically.",
    });
  }

  if (input.emergencyEntryLock) {
    blockers.push({
      code: "EMERGENCY_LOCK",
      message: "Emergency entry lock is ON — submissions blocked.",
    });
  }

  if (input.environment === "LIVE") {
    blockers.push({
      code: "LIVE_ENVIRONMENT_FORBIDDEN",
      message: "LIVE broker submission is forbidden for this module.",
    });
  }

  if (input.handoffLifecycle !== "HANDOFF_READY") {
    blockers.push({
      code: "HANDOFF_NOT_READY",
      message: `Handoff lifecycle is ${input.handoffLifecycle ?? "null"}; HANDOFF_READY required before any future submit.`,
    });
  } else {
    // Explicit: ready handoff is still not permission.
    blockers.push({
      code: "AUTHORIZATION_MISSING",
      message: "HANDOFF_READY is not execution permission — per-submission owner authorization required (later phase).",
    });
  }

  if (input.systemMasterOn) {
    blockers.push({
      code: "SYSTEM_MASTER_IS_NOT_EXECUTION_AUTH",
      message: "System Master ON authorizes analysis only — never broker execution.",
    });
  }

  if (
    input.quantityLots != null
    && Number.isFinite(input.quantityLots)
    && input.quantityLots > OWNER_MAX_LOTS_EXECUTION + 1e-12
  ) {
    blockers.push({
      code: "OWNER_MAX_EXCEEDED",
      message: `Quantity ${input.quantityLots} exceeds owner maximum ${OWNER_MAX_LOTS_EXECUTION} lots.`,
    });
  }

  if (
    input.capitalAllocationPercent == null
    || !Number.isFinite(input.capitalAllocationPercent)
    || input.individualOrderAllocation == null
    || !Number.isFinite(input.individualOrderAllocation)
    || input.individualOrderAllocation <= 0
  ) {
    blockers.push({
      code: "CAPITAL_NOT_CONFIGURED",
      message: "Strategy capitalAllocationPercent and individualOrderAllocation must both be configured by the owner.",
    });
  }

  blockers.push({
    code: "MUTATION_GATES_NOT_PHASE1",
    message: "DEMO mutation env/secret gates are not evaluated or enabled in Phase 1.",
  });

  // Deduplicate by code while preserving order.
  const seen = new Set<string>();
  const unique = blockers.filter((b) => {
    if (seen.has(b.code)) return false;
    seen.add(b.code);
    return true;
  });

  return {
    mayProceedTowardSubmit: false,
    blockers: unique,
    systemMasterDoesNotAuthorizeExecution: true,
    handoffReadyIsNotExecutionPermission: true,
    phase1SubmitImplemented: false,
  };
}

export function createPhase1AuthorizationIntent(input: {
  handoffId: string;
  proposalId: string | null;
  idempotencyKey: string;
  instrument: string | null;
  direction: "BUY" | "SELL" | null;
  quantityLots: number | null;
  environment: AutomatedTradingEnvironment;
  createdBy: string;
  expiresAtUtc?: string | null;
  nowMs?: number;
}): AtBrokerExecutionAuthorizationIntent {
  const now = new Date(input.nowMs ?? Date.now()).toISOString();
  return {
    authorizationId: `atx-p1-${Date.now().toString(36)}`,
    handoffId: input.handoffId,
    proposalId: input.proposalId,
    idempotencyKey: input.idempotencyKey,
    instrument: input.instrument,
    direction: input.direction,
    quantityLots: input.quantityLots,
    environment: input.environment,
    createdAtUtc: now,
    expiresAtUtc: input.expiresAtUtc ?? null,
    createdBy: input.createdBy,
    activatesMutation: false,
    note: "Phase 1 intent only — does not authorize broker mutation.",
  };
}
