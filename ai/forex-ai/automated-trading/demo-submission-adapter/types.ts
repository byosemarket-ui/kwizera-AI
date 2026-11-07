/**
 * Stage 6 — FXCM DEMO-only submission adapter contracts.
 * Non-submitting production mode. Never places broker orders in this stage.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import {
  OWNER_MAX_QUANTITY,
  PER_ORDER_RISK_MAXIMUM_PERCENT,
  PER_ORDER_RISK_TARGET_PERCENT,
} from "../order-proposal/types.js";

export const AT_DEMO_ADAPTER_SCHEMA = "at-fxcm-demo-adapter-v1" as const;
export const AT_DEMO_ADAPTER_STAGE = "STAGE_6_FXCM_DEMO_SUBMISSION_ADAPTER" as const;
export const AT_DEMO_ADAPTER_PHASE = "6.0" as const;

/** Stage 6 production submission mode — never SUBMISSION_ENABLED. */
export type DemoAdapterSubmissionMode = "DISABLED" | "DRY_RUN";

export const DEMO_ADAPTER_SUBMISSION_MODE: DemoAdapterSubmissionMode = "DISABLED";
export const DEMO_ADAPTER_OWNER_MAX_LOTS = OWNER_MAX_QUANTITY;
export const DEMO_ADAPTER_RISK_TARGET_PERCENT = PER_ORDER_RISK_TARGET_PERCENT;
export const DEMO_ADAPTER_RISK_MAX_PERCENT = PER_ORDER_RISK_MAXIMUM_PERCENT;
export const DEMO_ADAPTER_MIN_REWARD_TO_RISK = 3 as const;

/**
 * Display / readiness categories — not a competing lifecycle state machine.
 * Submission-adjacent broker states are never entered in Stage 6.
 */
export type DemoAdapterReadinessCategory =
  | "ADAPTER_DISABLED"
  | "WAITING_FOR_PROPOSAL"
  | "PROPOSAL_INVALID"
  | "DEMO_NOT_VERIFIED"
  | "PRECHECK_BLOCKED"
  | "AUTHORIZATION_REQUIRED"
  | "DRY_RUN_READY"
  | "DRY_RUN_COMPLETED"
  | "RECONCILIATION_REQUIRED";

export type DemoAdapterAttemptState =
  | "NOT_STARTED"
  | "PREPARED"
  | "DRY_RUN_RECORDED"
  | "SUBMISSION_BLOCKED"
  | "BROKER_RESULT_UNKNOWN"
  | "RECONCILIATION_REQUIRED";

/** Verified FXCM TRUE_MARKET_OPEN request fields (from mutation_demo.py / Gehtsoft). */
export interface FxcmTrueMarketOpenPayload {
  orderTypeConstant: "TRUE_MARKET_OPEN";
  accountId: string;
  buySell: "BUY" | "SELL";
  /** Broker AMOUNT = round(baseUnitSize × lots); integer units. */
  amount: number;
  lots: number;
  symbol: string;
  offerId: string | null;
  rateStop: number | null;
  rateLimit: number | null;
  /**
   * OM family supports attached RATE_STOP / RATE_LIMIT on open.
   * If either protective rate is missing, protectionIncomplete=true — fail closed for protected opens.
   */
  protectionIncomplete: boolean;
  timeInForce: "IOC" | "GTC" | "FOK" | "DAY" | null;
  gtdExpiryUtc: string | null;
  plannedEntryPrice: number | null;
  executableBid: number | null;
  executableAsk: number | null;
  note: string;
}

export interface DemoEnvironmentVerification {
  ok: boolean;
  code: string;
  message: string;
  configuredEnvironment: AutomatedTradingEnvironment | null;
  sessionEnvironment: string | null;
  accountEnvironment: string | null;
  accountIdMasked: string | null;
  expectedAccountIdMasked: string | null;
  positivelyVerifiedDemo: boolean;
}

export interface DemoAdapterAuthorizationRequirements {
  executionMasterEnabled: boolean;
  emergencyLockCleared: boolean;
  tradingEnabled: boolean;
  freshFinalPrecheck: boolean;
  demoEnvironmentVerified: boolean;
  perSubmissionAuthorization: boolean;
  exactProposalIdentity: boolean;
  exactAccountIdentity: boolean;
  shortLivedGrant: boolean;
  noPriorSuccessfulSubmission: boolean;
  /** Stage 6: always false — controls remain disabled. */
  allSatisfied: false;
  missing: string[];
}

export interface BrokerAcknowledgementContract {
  executionAttemptId: string;
  proposalId: string;
  accountIdMasked: string | null;
  brokerRequestId: string | null;
  brokerOrderId: string | null;
  brokerTradeId: string | null;
  brokerStatus: string | null;
  accepted: boolean;
  rejected: boolean;
  resultUnknown: boolean;
  actualFillPrice: number | null;
  actualQuantity: number | null;
  brokerTimestampUtc: string | null;
  rejectionReason: string | null;
  /**
   * Only true when an authoritative broker response established acceptance.
   * HTTP 200 / local prepare / dry-run never set this.
   */
  verifiedBrokerAcceptance: false | true;
  source: "DRY_RUN" | "MOCK_FIXTURE" | "BROKER_RESPONSE";
  note: string;
}

export interface DemoAdapterAttemptRecord {
  schemaVersion: typeof AT_DEMO_ADAPTER_SCHEMA;
  stage: typeof AT_DEMO_ADAPTER_STAGE;
  phase: typeof AT_DEMO_ADAPTER_PHASE;
  executionAttemptId: string;
  idempotencyKey: string;
  proposalId: string;
  proposalVersion: string | null;
  allocationId: string | null;
  handoffId: string | null;
  accountIdMasked: string | null;
  instrument: string | null;
  direction: "BUY" | "SELL" | null;
  state: DemoAdapterAttemptState;
  readinessCategory: DemoAdapterReadinessCategory;
  submissionMode: DemoAdapterSubmissionMode;
  payload: FxcmTrueMarketOpenPayload | null;
  environment: DemoEnvironmentVerification | null;
  authorization: DemoAdapterAuthorizationRequirements | null;
  blockers: Array<{ code: string; message: string }>;
  acknowledgement: BrokerAcknowledgementContract | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  executionAuthorized: false;
  mutationInvoked: false;
}

export interface DemoAdapterPublicStatus {
  schemaVersion: typeof AT_DEMO_ADAPTER_SCHEMA;
  stage: typeof AT_DEMO_ADAPTER_STAGE;
  phase: typeof AT_DEMO_ADAPTER_PHASE;
  submissionMode: DemoAdapterSubmissionMode;
  readinessCategory: DemoAdapterReadinessCategory;
  ownerMaxLots: typeof DEMO_ADAPTER_OWNER_MAX_LOTS;
  riskTargetPercent: typeof DEMO_ADAPTER_RISK_TARGET_PERCENT;
  riskMaximumPercent: typeof DEMO_ADAPTER_RISK_MAX_PERCENT;
  minimumRewardToRisk: typeof DEMO_ADAPTER_MIN_REWARD_TO_RISK;
  latestAttempt: DemoAdapterAttemptRecord | null;
  attemptCount: number;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  executionAuthorized: false;
  brokerSubmissionImplemented: false;
  mutationPortWired: false;
  note: string;
}

/**
 * Port for future broker mutation. Stage 6 production wiring is NoopMutationPort.
 * Tests assert invoke* is never called.
 */
export interface BrokerMutationPort {
  readonly name: string;
  invokeTrueMarketOpen(_payload: FxcmTrueMarketOpenPayload): Promise<never>;
}
