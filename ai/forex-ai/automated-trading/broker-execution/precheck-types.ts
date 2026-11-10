/**
 * Phase 2 — Final pre-execution validator types.
 * Validation never authorizes broker submission.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AtBrokerExecutionLifecycle } from "./types.js";
import { OWNER_MAX_LOTS_EXECUTION } from "./types.js";

export const AT_BROKER_PRECHECK_PHASE = "4.18G.4-P2" as const;
export const AT_BROKER_PRECHECK_RESULT_SCHEMA = "at-broker-precheck-result-v1" as const;

/** Default TTL for a successful precheck snapshot (informational only). */
export const AT_BROKER_PRECHECK_DEFAULT_TTL_MS = 60_000;

export const OWNER_MAX_LOTS_PRECHECK = OWNER_MAX_LOTS_EXECUTION;

export type AtPrecheckStatus =
  | "PASSED"
  | "BLOCKED"
  | "INCOMPLETE";

export type AtPrecheckCheckVerdict = "PASS" | "FAIL" | "INCOMPLETE" | "NOT_APPLICABLE";

export type AtPrecheckReasonCode =
  | "HANDOFF_MISSING"
  | "HANDOFF_NOT_READY"
  | "HANDOFF_SUPERSEDED"
  | "HANDOFF_EXPIRED"
  | "HANDOFF_PROPOSAL_MISMATCH"
  | "PROPOSAL_MISSING"
  | "PROPOSAL_NOT_READY"
  | "PROPOSAL_SUPERSEDED"
  | "PROPOSAL_EXPIRED"
  | "PROPOSAL_MISMATCH"
  | "INSTRUMENT_MISMATCH"
  | "DIRECTION_MISMATCH"
  | "INVALID_ENTRY"
  | "INVALID_STOP_LOSS"
  | "INVALID_TAKE_PROFIT"
  | "INVALID_SL_GEOMETRY"
  | "INVALID_TP_GEOMETRY"
  | "REWARD_RISK_BELOW_3R"
  | "INVALID_QUANTITY"
  | "OWNER_MAX_QUANTITY_EXCEEDED"
  | "BROKER_QUANTITY_CONTRACT_FAILED"
  | "BROKER_MINIMUM_EXCEEDS_ALLOWED_QUANTITY"
  | "MISSING_ACCOUNT_DATA"
  | "STALE_ACCOUNT_DATA"
  | "INVALID_EQUITY"
  | "INVALID_BALANCE"
  | "MISSING_MARGIN_DATA"
  | "STALE_MARGIN_DATA"
  | "INSUFFICIENT_AVAILABLE_MARGIN"
  | "CAPITAL_NOT_CONFIGURED"
  | "EXPOSURE_UNVERIFIED"
  | "EXPOSURE_LIMIT_EXCEEDED"
  | "EMERGENCY_LOCK"
  | "MASTER_ENABLE_NOT_SAFE"
  | "AUTOMATIC_ENTRY_NOT_SAFE"
  | "EXECUTION_MASTER_OFF"
  | "EXECUTION_MASTER_ON_FORBIDDEN_PHASE2"
  | "ARMED_FOR_SUBMISSION_FORBIDDEN"
  | "SAFETY_STAMP_VIOLATION"
  | "CONTROLS_MISSING"
  | "FOUNDATION_MISSING"
  | "DUPLICATE_TRADE"
  | "DAILY_LOSS_UNAVAILABLE"
  | "MAX_DAILY_LOSS_EXCEEDED"
  | "DRAWDOWN_UNAVAILABLE"
  | "MAX_DRAWDOWN_EXCEEDED"
  | "CONCURRENT_POSITIONS_UNAVAILABLE"
  | "MAX_OPEN_POSITIONS_EXCEEDED"
  | "MARKET_UNAVAILABLE"
  | "STALE_MARKET_DATA"
  | "SPREAD_LIMIT_NOT_CONFIGURED"
  | "SPREAD_DATA_UNAVAILABLE"
  | "EXCESSIVE_SPREAD"
  | "SPREAD_POLICY_INVALID"
  | "DYNAMIC_SPREAD_REJECT"
  | "DYNAMIC_SPREAD_NOT_EVALUATED"
  | "QUOTE_MISSING"
  | "QUOTE_STALE"
  | "QUOTE_INVALID"
  | "MARKET_DATA_NOT_LIVE"
  | "SPREAD_DATA_INSUFFICIENT"
  | "SPREAD_ABNORMAL_WIDENING"
  | "SPREAD_COST_UNVERIFIED"
  | "SPREAD_COST_EXCESSIVE"
  | "STOP_LOSS_RISK_EXCEEDED"
  | "NET_REWARD_BELOW_POLICY"
  | "INSTRUMENT_METADATA_UNVERIFIED"
  | "CURRENCY_CONVERSION_UNVERIFIED"
  | "BROKER_CONSTRAINT_UNVERIFIED"
  | "LEGACY_EMERGENCY_SPREAD_CEILING"
  | "DYNAMIC_SPREAD_OK"
  | "SLIPPAGE_LIMIT_NOT_CONFIGURED"
  | "SLIPPAGE_POLICY_INVALID"
  | "SLIPPAGE_DATA_UNAVAILABLE"
  | "EXCESSIVE_SLIPPAGE"
  | "ACCOUNT_IDENTITY_MISMATCH"
  | "STALE_PROPOSAL_SNAPSHOT"
  | "INVALID_GTD_EXPIRY"
  | "UNSUPPORTED_TIME_IN_FORCE"
  | "RISK_CONFIG_MISSING"
  | "LIVE_ENVIRONMENT_FORBIDDEN"
  | "PHASE2_SUBMIT_FORBIDDEN"
  | "UNKNOWN";

export interface AtPrecheckCheck {
  id: string;
  category:
    | "handoff"
    | "proposal"
    | "account"
    | "permission"
    | "risk"
    | "market"
    | "spread";
  verdict: AtPrecheckCheckVerdict;
  code: AtPrecheckReasonCode | string;
  message: string;
  mandatory: boolean;
}

export interface AtPrecheckBlockingReason {
  code: AtPrecheckReasonCode | string;
  message: string;
  checkId: string;
}

export interface AtPrecheckControlSnapshot {
  emergencyEntryLock: boolean | null;
  masterEnable: boolean | null;
  automaticEntry: boolean | null;
  positionManagement: boolean | null;
  executionMasterEnabled: boolean;
  armedForSubmission: boolean;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  tradingDisabled: true;
  source: "authoritative_store" | "injected_for_test" | "missing";
}

export interface AtPrecheckRiskLimits {
  maxLotsPerOrder: number;
  maxTotalExposureLots: number;
  maxOpenPositions: number;
  /** Absolute day-loss cap in account currency; null = gate requires telemetry then fails closed. */
  maxDailyLossAccount: number | null;
  maxDrawdownFractionOfDayStartEquity: number | null;
  /**
   * Legacy owner-approved absolute ceiling (optional emergency safety only).
   * When null, Dynamic Spread Intelligence is the sole spread eligibility rule —
   * precheck must NOT fail solely because this field is null.
   */
  maxSpreadAbsolute: number | null;
  /** Optional; when null → SLIPPAGE_LIMIT_NOT_CONFIGURED (fail closed). Absolute |entry−executable|. */
  maxSlippageAbsolute: number | null;
  accountMaxAgeMs: number;
  quoteMaxAgeMs: number;
}

export interface AtPrecheckAccountSnapshot {
  equity: number | null;
  balance: number | null;
  usableMargin: number | null;
  usedMargin: number | null;
  currency: string | null;
  accountIdMasked: string | null;
  fetchedAtMs: number | null;
  isFresh: boolean | null;
}

export interface AtPrecheckMarketSnapshot {
  bid: number | null;
  ask: number | null;
  spread: number | null;
  quoteAgeMs: number | null;
  tradingEligible: boolean | null;
  marketClosed: boolean | null;
  instrument: string | null;
}

export interface AtPrecheckExposureSnapshot {
  openExposureLots: number | null;
  openPositionCount: number | null;
  exposureAuthoritative: boolean | null;
  duplicateTradeSuspected: boolean | null;
  dayRealizedPnlAccount: number | null;
  dayStartEquity: number | null;
}

export interface AtPrecheckInstrumentContract {
  baseUnitSize: number | null;
  minQuantity: number | null;
  quantityStep: number | null;
  mmrPerLot: number | null;
  contractVerified: boolean | null;
}

/**
 * Pure inputs for the Phase 2 validator.
 * Callers must supply authoritative controls — never invent permissive defaults.
 */
export interface AtPreExecutionValidationInput {
  handoff: import("../broker-compatibility/types.js").AtBrokerHandoffRecord | null;
  proposal: import("../order-proposal/types.js").AtOrderProposalRecord | null;
  /** When set, must match handoff.provenance.proposalId and proposal.proposalId. */
  expectedProposalId?: string | null;
  expectedHandoffId?: string | null;
  environment: AutomatedTradingEnvironment;
  controls: {
    emergencyEntryLock: boolean | null;
    masterEnable: boolean | null;
    automaticEntry: boolean | null;
    positionManagement?: boolean | null;
  } | null;
  foundation: {
    executionMasterEnabled: boolean;
    armedForSubmission: boolean;
    placesOrders: false;
    acceptsForExecution: false;
    mutatesBroker: false;
    lifecycle: AtBrokerExecutionLifecycle;
  } | null;
  account: AtPrecheckAccountSnapshot | null;
  market: AtPrecheckMarketSnapshot | null;
  exposure: AtPrecheckExposureSnapshot | null;
  instrumentContract: AtPrecheckInstrumentContract | null;
  riskLimits?: Partial<AtPrecheckRiskLimits> | null;
  nowMs?: number;
  validationId?: string;
  /** Informational TTL; does not authorize execution. */
  ttlMs?: number;
  /**
   * Dynamic Spread Intelligence inputs (Stage 1 remediation — mode DYNAMIC).
   * When omitted, precheck invokes the engine from market/proposal fields (fail-closed).
   */
  dynamicSpread?: {
    historicalSpreads?: import("../dynamic-spread/types.js").DynamicSpreadHistoricalObservation[] | null;
    provenance?: string | null;
    feedConnected?: boolean | null;
    quoteTimestampUtc?: string | null;
    quoteId?: string | null;
    contract?: import("../simulation-risk/types.js").AtSimContractMetaInput | null;
    orderAllocationAccount?: number | null;
    allocationId?: string | null;
    accountCurrency?: string | null;
    commissionAccount?: number | null;
    commissionVerified?: boolean | null;
    slippageEstimateAccount?: number | null;
    slippageEvidenceAvailable?: boolean | null;
    /** Precomputed evaluation — when set, precheck consumes it directly. */
    evaluation?: import("../dynamic-spread/types.js").DynamicSpreadEvaluationResult | null;
  } | null;
}

export interface AtPreExecutionValidationResult {
  schemaVersion: typeof AT_BROKER_PRECHECK_RESULT_SCHEMA;
  phase: typeof AT_BROKER_PRECHECK_PHASE;
  validationId: string;
  proposalId: string | null;
  handoffId: string | null;
  validatedAt: string;
  status: AtPrecheckStatus;
  /**
   * True only when every mandatory check PASSes.
   * Never means broker submission is authorized.
   */
  allowed: boolean;
  blockingReasons: AtPrecheckBlockingReason[];
  warnings: string[];
  checks: AtPrecheckCheck[];
  riskChecks: AtPrecheckCheck[];
  accountChecks: AtPrecheckCheck[];
  permissionChecks: AtPrecheckCheck[];
  marketDataChecks: AtPrecheckCheck[];
  controlSnapshot: AtPrecheckControlSnapshot;
  suggestedLifecycle: "AUTHORIZATION_REQUIRED" | "PRECHECK_BLOCKED";
  expiresAt: string;
  ownerMaxLots: typeof OWNER_MAX_LOTS_PRECHECK;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  brokerExecution: "DISABLED";
  executionAuthorized: false;
  phase2SubmitImplemented: false;
  note: string;
  /** Dynamic Spread Intelligence decision attached to every precheck run. */
  dynamicSpread?: import("../dynamic-spread/types.js").DynamicSpreadEvaluationResult | null;
}

export function defaultPrecheckRiskLimits(): AtPrecheckRiskLimits {
  return {
    maxLotsPerOrder: OWNER_MAX_LOTS_PRECHECK,
    maxTotalExposureLots: OWNER_MAX_LOTS_PRECHECK,
    maxOpenPositions: 1,
    // Fail-closed: limits exist as proposed profile values but telemetry must be supplied.
    maxDailyLossAccount: 25,
    maxDrawdownFractionOfDayStartEquity: 0.03,
    maxSpreadAbsolute: null,
    maxSlippageAbsolute: null,
    accountMaxAgeMs: 15_000,
    quoteMaxAgeMs: 5_000,
  };
}
