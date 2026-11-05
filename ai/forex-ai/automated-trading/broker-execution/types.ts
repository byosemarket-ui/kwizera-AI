/**
 * Broker Execution Engine — Phase 1 foundation.
 * Architecture and safety only. Never places broker orders in this phase.
 */
import type { AutomatedTradingEnvironment } from "../types.js";

export const AT_BROKER_EXECUTION_SCHEMA = "at-broker-execution-foundation-v1" as const;
export const AT_BROKER_EXECUTION_PHASE = "4.18G.4-P1" as const;
export const AT_BROKER_EXECUTION_MAX_AUDIT = 200;

/** Owner-approved maximum — never raised. */
export const OWNER_MAX_LOTS_EXECUTION = 0.01;

/**
 * Execution request lifecycle.
 * Phase 1 may only occupy IDLE | AUTHORIZATION_REQUIRED | PRECHECK_BLOCKED | SUPERSEDED.
 * Submit-adjacent states exist for the machine design but cannot be entered until later phases.
 */
export type AtBrokerExecutionLifecycle =
  | "IDLE"
  | "AUTHORIZATION_REQUIRED"
  | "PRECHECK"
  | "PRECHECK_BLOCKED"
  | "READY_TO_SUBMIT"
  | "SUBMITTING"
  | "SUBMIT_UNKNOWN"
  | "ACCEPTED"
  | "REJECTED"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "RECONCILING"
  | "RECONCILED"
  | "PROTECTION_PENDING"
  | "CLOSED"
  | "CANCELLED"
  | "FAILED"
  | "SUPERSEDED";

/** States allowed while Phase 1 code is the only implementation. */
export const AT_BROKER_EXECUTION_PHASE1_ALLOWED_STATES: readonly AtBrokerExecutionLifecycle[] = [
  "IDLE",
  "AUTHORIZATION_REQUIRED",
  "PRECHECK_BLOCKED",
  "SUPERSEDED",
] as const;

export type AtBrokerExecutionBlockCode =
  | "PHASE1_SUBMIT_FORBIDDEN"
  | "EXECUTION_MASTER_OFF"
  | "NOT_ARMED"
  | "EMERGENCY_LOCK"
  | "LIVE_ENVIRONMENT_FORBIDDEN"
  | "HANDOFF_NOT_READY"
  | "AUTHORIZATION_MISSING"
  | "AUTHORIZATION_MISMATCH"
  | "AUTHORIZATION_EXPIRED"
  | "OWNER_MAX_EXCEEDED"
  | "CAPITAL_NOT_CONFIGURED"
  | "SYSTEM_MASTER_IS_NOT_EXECUTION_AUTH"
  | "MUTATION_GATES_NOT_PHASE1"
  | "AUDIT_PERSIST_FAILED"
  | "UNKNOWN";

export interface AtBrokerExecutionBlocker {
  code: AtBrokerExecutionBlockCode | string;
  message: string;
}

export type AtBrokerExecutionAuditDecision = "ALLOW" | "DENY";

export interface AtBrokerExecutionAuditEvent {
  id: string;
  atUtc: string;
  actor: string;
  action: string;
  detail: string;
  /** Present on Phase 1.1+ events; null for legacy rows (never invented on load). */
  correlationId: string | null;
  /** Present on Phase 1.1+ events; null for legacy rows. */
  decision: AtBrokerExecutionAuditDecision | null;
  /** Present on Phase 1.1+ events; null for legacy rows. */
  reasonCode: string | null;
  handoffId: string | null;
  proposalId: string | null;
  lifecycle: AtBrokerExecutionLifecycle | null;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

/**
 * Owner authorization intent for a future specific submission.
 * Phase 1 records intent for audit/design only — never enables mutation.
 */
export interface AtBrokerExecutionAuthorizationIntent {
  authorizationId: string;
  handoffId: string;
  proposalId: string | null;
  idempotencyKey: string;
  instrument: string | null;
  direction: "BUY" | "SELL" | null;
  quantityLots: number | null;
  environment: AutomatedTradingEnvironment;
  createdAtUtc: string;
  expiresAtUtc: string | null;
  createdBy: string;
  /** Always false in Phase 1 — intent is not a live grant. */
  activatesMutation: false;
  note: string;
}

export interface AtBrokerExecutionFoundationPersisted {
  schemaVersion: typeof AT_BROKER_EXECUTION_SCHEMA;
  phase: typeof AT_BROKER_EXECUTION_PHASE;
  stateVersion: number;
  /** Distinct from System Master. Default OFF. */
  executionMasterEnabled: boolean;
  /** Never auto-armed. Default false. */
  armedForSubmission: boolean;
  lifecycle: AtBrokerExecutionLifecycle;
  environmentBound: AutomatedTradingEnvironment | "UNBOUND";
  activeHandoffId: string | null;
  activeProposalId: string | null;
  activeAuthorizationId: string | null;
  blockers: AtBrokerExecutionBlocker[];
  authorizationIntents: AtBrokerExecutionAuthorizationIntent[];
  audit: AtBrokerExecutionAuditEvent[];
  updatedAtUtc: string;
  updatedBy: string;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  brokerExecution: "DISABLED";
  phaseNote: string;
}

export interface AtBrokerExecutionPublicStatus {
  schemaVersion: typeof AT_BROKER_EXECUTION_SCHEMA;
  phase: typeof AT_BROKER_EXECUTION_PHASE;
  stateVersion: number;
  executionMasterEnabled: boolean;
  armedForSubmission: boolean;
  lifecycle: AtBrokerExecutionLifecycle;
  environmentBound: AutomatedTradingEnvironment | "UNBOUND";
  activeHandoffId: string | null;
  activeProposalId: string | null;
  activeAuthorizationId: string | null;
  blockers: AtBrokerExecutionBlocker[];
  authorizationIntentCount: number;
  auditCount: number;
  ownerMaxLots: typeof OWNER_MAX_LOTS_EXECUTION;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  brokerExecution: "DISABLED";
  executionStatusLabel: "EXECUTION_FORBIDDEN";
  systemMasterDoesNotAuthorizeExecution: true;
  handoffReadyIsNotExecutionPermission: true;
  phase1SubmitImplemented: false;
  phaseNote: string;
  /** Documented GET-status audit policy — never floods durable audit from polling. */
  auditPolicy: {
    statusGetWritesAudit: false;
    statusGetDocumentsDenialsOnPayload: true;
    stateChangingAttemptsWriteAudit: true;
    deniedLifecycleTransitionsWriteAudit: true;
  };
  prerequisites: {
    capitalAllocationConfigured: boolean | null;
    compatibleInstrumentAtOwnerMax: boolean | null;
    eligibleBuySellSignal: boolean | null;
    demoMutationGates: "NOT_EVALUATED_PHASE1";
  };
}

export type AtBrokerExecutionAuditAppendResult =
  | {
    ok: true;
    persisted: true;
    event: AtBrokerExecutionAuditEvent;
  }
  | {
    ok: false;
    persisted: false;
    code: "AUDIT_PERSIST_FAILED";
    message: string;
    event: AtBrokerExecutionAuditEvent | null;
  };
