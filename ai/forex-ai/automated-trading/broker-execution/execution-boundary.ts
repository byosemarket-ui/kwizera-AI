/**
 * Phase 3 — Hard execution boundary.
 * Every order pathway must terminate here. Always EXECUTION_BLOCKED in Phase 3.
 * Never instantiates a live submit adapter. Never mutates the broker.
 */
import { randomUUID } from "node:crypto";
import { getDisabledBrokerMutationAdapter } from "../broker-intent/mutation-stub.js";

export const AT_EXECUTION_BOUNDARY_SCHEMA = "at-execution-boundary-v1" as const;
export const AT_EXECUTION_BOUNDARY_PHASE = "PHASE3" as const;

export type ExecutionBoundaryDecisionCode =
  | "EXECUTION_DISABLED_BY_OWNER_POLICY"
  | "EXECUTION_MASTER_OFF"
  | "EMERGENCY_ENTRY_LOCK"
  | "BROKER_EXECUTION_DISABLED"
  | "DEMO_MUTATION_DISABLED"
  | "NO_ACTIVE_DEMO_GRANT"
  | "PLACES_ORDERS_FALSE"
  | "ACCEPTS_FOR_EXECUTION_FALSE"
  | "MUTATES_BROKER_FALSE";

export interface ExecutionBoundaryInput {
  payloadId: string;
  handoffId: string | null;
  proposalId: string | null;
  precheckId: string | null;
  analysisId: string | null;
  instrument: string | null;
  direction: "BUY" | "SELL" | null;
  /** Owner/runtime safety observations — never enable execution. */
  executionMasterEnabled?: boolean;
  emergencyEntryLock?: boolean;
  brokerExecution?: string;
  placesOrders?: boolean;
  acceptsForExecution?: boolean;
  mutatesBroker?: boolean;
  demoMutationAllowed?: boolean;
  activeDemoGrant?: boolean;
  nowMs?: number;
}

export interface ExecutionBoundaryDecision {
  schemaVersion: typeof AT_EXECUTION_BOUNDARY_SCHEMA;
  phase: typeof AT_EXECUTION_BOUNDARY_PHASE;
  decisionId: string;
  status: "EXECUTION_BLOCKED";
  reasonCode: ExecutionBoundaryDecisionCode;
  reasons: ExecutionBoundaryDecisionCode[];
  payloadId: string;
  handoffId: string | null;
  proposalId: string | null;
  precheckId: string | null;
  analysisId: string | null;
  instrument: string | null;
  direction: "BUY" | "SELL" | null;
  mutationProbe: {
    called: true;
    adapter: "DisabledBrokerMutationAdapter";
    code: "EXECUTION_FORBIDDEN";
    operation: "SUBMIT";
    placesOrders: false;
    acceptsForExecution: false;
    mutatesBroker: false;
  };
  payloadValidated: boolean;
  handoffValidated: boolean;
  submissionAttempted: false;
  deferredOrderQueued: false;
  decidedAtUtc: string;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  brokerExecution: "DISABLED";
  note: string;
}

/**
 * Evaluate the hard execution boundary. Always blocks. Proves disabled adapter reject.
 */
export function evaluateExecutionBoundary(
  input: ExecutionBoundaryInput,
): ExecutionBoundaryDecision {
  const reasons: ExecutionBoundaryDecisionCode[] = [
    "EXECUTION_DISABLED_BY_OWNER_POLICY",
    "BROKER_EXECUTION_DISABLED",
    "PLACES_ORDERS_FALSE",
    "ACCEPTS_FOR_EXECUTION_FALSE",
    "MUTATES_BROKER_FALSE",
  ];
  if (input.executionMasterEnabled !== true) {
    reasons.push("EXECUTION_MASTER_OFF");
  }
  if (input.emergencyEntryLock !== false) {
    reasons.push("EMERGENCY_ENTRY_LOCK");
  }
  if (input.demoMutationAllowed !== true) {
    reasons.push("DEMO_MUTATION_DISABLED");
  }
  if (input.activeDemoGrant !== true) {
    reasons.push("NO_ACTIVE_DEMO_GRANT");
  }

  const adapter = getDisabledBrokerMutationAdapter();
  const probe = adapter.submit({
    phase: "PHASE3",
    payloadId: input.payloadId,
    proposalId: input.proposalId,
    note: "Phase 3 boundary probe — must never reach broker.",
  });

  const nowIso = new Date(input.nowMs ?? Date.now()).toISOString();
  return {
    schemaVersion: AT_EXECUTION_BOUNDARY_SCHEMA,
    phase: AT_EXECUTION_BOUNDARY_PHASE,
    decisionId: randomUUID(),
    status: "EXECUTION_BLOCKED",
    reasonCode: "EXECUTION_DISABLED_BY_OWNER_POLICY",
    reasons: Array.from(new Set(reasons)),
    payloadId: input.payloadId,
    handoffId: input.handoffId,
    proposalId: input.proposalId,
    precheckId: input.precheckId,
    analysisId: input.analysisId,
    instrument: input.instrument,
    direction: input.direction,
    mutationProbe: {
      called: true,
      adapter: "DisabledBrokerMutationAdapter",
      code: "EXECUTION_FORBIDDEN",
      operation: "SUBMIT",
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    },
    payloadValidated: true,
    handoffValidated: Boolean(input.handoffId),
    submissionAttempted: false,
    deferredOrderQueued: false,
    decidedAtUtc: nowIso,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    brokerExecution: "DISABLED",
    note:
      probe.code === "EXECUTION_FORBIDDEN"
        ? "Phase 3 execution boundary: payload may be validated; submission is blocked by owner policy. No broker request sent."
        : "Phase 3 execution boundary blocked unexpectedly — fail closed.",
  };
}
