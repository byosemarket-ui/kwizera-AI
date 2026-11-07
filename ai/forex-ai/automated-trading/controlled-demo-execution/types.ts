/**
 * Stage 7 — First Controlled FXCM DEMO Execution contracts.
 * Readiness + one-time grant + attempt tracking. Mutation remains DISABLED.
 */
import {
  OWNER_MAX_QUANTITY,
  PER_ORDER_RISK_MAXIMUM_PERCENT,
  PER_ORDER_RISK_TARGET_PERCENT,
} from "../order-proposal/types.js";

export const AT_CONTROLLED_DEMO_SCHEMA = "at-controlled-demo-execution-v1" as const;
export const AT_CONTROLLED_DEMO_STAGE = "STAGE_7_CONTROLLED_DEMO_EXECUTION" as const;
export const AT_CONTROLLED_DEMO_PHASE = "7.0" as const;

export const STAGE7_OWNER_MAX_LOTS = OWNER_MAX_QUANTITY;
export const STAGE7_RISK_TARGET_PERCENT = PER_ORDER_RISK_TARGET_PERCENT;
export const STAGE7_RISK_MAX_PERCENT = PER_ORDER_RISK_MAXIMUM_PERCENT;
export const STAGE7_MIN_REWARD_TO_RISK = 3 as const;
/** Supported OM TIF values verified via Stage 6 / sidecar probe. */
export const STAGE7_SUPPORTED_TIF = ["IOC", "GTC", "FOK", "DAY"] as const;
export type Stage7SupportedTif = (typeof STAGE7_SUPPORTED_TIF)[number];

/** Display / attempt states — submission-adjacent broker states never entered without mutation. */
export type Stage7DisplayState =
  | "NOT_READY"
  | "READY_FOR_OWNER_REVIEW"
  | "OWNER_AUTHORIZED"
  | "SUBMISSION_PENDING"
  | "BROKER_ACCEPTED"
  | "BROKER_REJECTED"
  | "UNKNOWN"
  | "RECONCILIATION_REQUIRED"
  | "PROTECTION_PENDING"
  | "PROTECTED"
  | "PROTECTION_FAILED";

export type Stage7AttemptState =
  | "CREATED"
  | "AUTHORIZED"
  | "SUBMISSION_PENDING"
  | "BROKER_ACCEPTED"
  | "BROKER_REJECTED"
  | "UNKNOWN"
  | "RECONCILIATION_REQUIRED"
  | "PROTECTION_PENDING"
  | "PROTECTED"
  | "PROTECTION_FAILED"
  | "BLOCKED";

export interface Stage7Blocker {
  code: string;
  message: string;
  category: "TECHNICAL" | "CONTROL" | "AUTHORIZATION" | "SAFETY" | "PROTECTION";
}

export interface Stage7ProposalSnapshot {
  proposalId: string;
  proposalVersion: string;
  riskRecordId: string | null;
  allocationId: string | null;
  accountIdMasked: string | null;
  instrument: string | null;
  direction: "BUY" | "SELL" | null;
  quantity: number | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  timeInForce: Stage7SupportedTif | null;
  capitalAllocation: number | null;
  operatingRiskPercent: number | null;
  modeledMonetaryRisk: number | null;
  rewardToRisk: number | null;
}

export interface Stage7ExecutionGrant {
  grantId: string;
  schemaVersion: typeof AT_CONTROLLED_DEMO_SCHEMA;
  stage: typeof AT_CONTROLLED_DEMO_STAGE;
  createdAtUtc: string;
  expiresAtUtc: string;
  createdBy: string;
  proposalId: string;
  proposalVersion: string;
  riskRecordId: string;
  allocationId: string;
  accountIdMasked: string;
  environment: "DEMO";
  instrument: string;
  direction: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  timeInForce: Stage7SupportedTif;
  idempotencyKey: string;
  snapshot: Stage7ProposalSnapshot;
  usedAtUtc: string | null;
  revokedAtUtc: string | null;
  /**
   * Stage 7 development: grants never activate broker mutation.
   * Future stages may flip this only after owner-authorized submission wiring.
   */
  activatesMutation: false;
  confirmAcknowledged: true;
  note: string;
}

export interface Stage7ProtectionResult {
  status: "NOT_APPLICABLE" | "PENDING" | "VERIFIED" | "FAILED" | "UNSUPPORTED";
  tradeId: string | null;
  brokerOrderId: string | null;
  fillPrice: number | null;
  fillQuantity: number | null;
  stopVerified: boolean;
  takeProfitVerified: boolean;
  monetaryRiskWithinLimit: boolean;
  rewardToRiskOk: boolean;
  blockers: Stage7Blocker[];
  note: string;
}

export interface Stage7AuditEvent {
  id: string;
  atUtc: string;
  actor: string;
  action: string;
  detail: string;
  correlationId: string | null;
  proposalId: string | null;
  grantId: string | null;
  attemptId: string | null;
  blockerCodes: string[];
  placesOrders: false;
  mutatesBroker: false;
}

export interface Stage7ExecutionAttempt {
  schemaVersion: typeof AT_CONTROLLED_DEMO_SCHEMA;
  stage: typeof AT_CONTROLLED_DEMO_STAGE;
  phase: typeof AT_CONTROLLED_DEMO_PHASE;
  attemptId: string;
  idempotencyKey: string;
  state: Stage7AttemptState;
  displayState: Stage7DisplayState;
  proposalSnapshot: Stage7ProposalSnapshot;
  grantId: string | null;
  blockers: Stage7Blocker[];
  brokerRequestId: string | null;
  brokerOrderId: string | null;
  brokerTradeId: string | null;
  acknowledgementSource: "NONE" | "DRY_RUN" | "MOCK_FIXTURE" | "BROKER_RESPONSE";
  verifiedBrokerAcceptance: false | true;
  protection: Stage7ProtectionResult | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  executionAuthorized: false;
  mutationInvoked: false;
}

export interface Stage7ReadinessReport {
  schemaVersion: typeof AT_CONTROLLED_DEMO_SCHEMA;
  stage: typeof AT_CONTROLLED_DEMO_STAGE;
  phase: typeof AT_CONTROLLED_DEMO_PHASE;
  evaluatedAtUtc: string;
  displayState: Stage7DisplayState;
  technicalPass: boolean;
  controlsPass: boolean;
  authorizationPass: boolean;
  allGatesPass: boolean;
  blockers: Stage7Blocker[];
  snapshot: Stage7ProposalSnapshot | null;
  gates: Record<string, { pass: boolean; code: string | null; detail: string }>;
  supportedTimeInForce: readonly Stage7SupportedTif[];
  gtdSupported: false;
  submissionEnabled: false;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  executionAuthorized: false;
  note: string;
}

export interface Stage7PublicStatus {
  schemaVersion: typeof AT_CONTROLLED_DEMO_SCHEMA;
  stage: typeof AT_CONTROLLED_DEMO_STAGE;
  phase: typeof AT_CONTROLLED_DEMO_PHASE;
  submissionEnabled: false;
  displayState: Stage7DisplayState;
  latestReadiness: Stage7ReadinessReport | null;
  activeGrant: Stage7ExecutionGrant | null;
  latestAttempt: Stage7ExecutionAttempt | null;
  attemptCount: number;
  grantCount: number;
  auditCount: number;
  ownerMaxLots: typeof STAGE7_OWNER_MAX_LOTS;
  controlsObserved: {
    executionMasterEnabled: boolean;
    emergencyEntryLock: boolean;
    tradingEnabled: boolean;
    automaticEntry: boolean;
    selectedEnvironment: string;
  };
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  executionAuthorized: false;
  mutationPortWired: false;
  note: string;
}
