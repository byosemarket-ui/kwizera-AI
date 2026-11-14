/**
 * Step 3 — FXCM Broker Compatibility, Validation & Handoff.
 * Read-only validation of Step 2 proposals. Never submits broker orders.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AtBinaryDirection } from "../analysis/direction.js";
import type { AtOrderProposalRecord } from "../order-proposal/types.js";

export const AT_BROKER_HANDOFF_SCHEMA = "at-broker-handoff-v1" as const;
export const AT_BROKER_HANDOFF_PHASE = "4.18G.3" as const;
export const AT_BROKER_HANDOFF_MAX_HISTORY = 80;
export const AT_FUTURE_EXECUTION_CONTRACT_VERSION = "at-future-execution-contract-v1" as const;

/** No fixed owner lot cap — quantity comes from the proposal's account-balance risk sizing. */
export const OWNER_MAX_LOTS = null;

export type AtBrokerHandoffLifecycle =
  | "RECEIVED"
  | "VALIDATING"
  | "BROKER_COMPATIBLE"
  | "HANDOFF_READY"
  | "BLOCKED"
  | "REJECTED"
  | "EXPIRED"
  | "SUPERSEDED";

export type AtBrokerHandoffBlockCode =
  | "NO_CANONICAL_BUY_SELL"
  | "NO_TRADE_NOT_ELIGIBLE"
  | "PROPOSAL_MISSING"
  | "PROPOSAL_NOT_READY"
  | "PROPOSAL_SUPERSEDED"
  | "PROPOSAL_EXPIRED"
  | "SYSTEM_MASTER_OFF"
  | "MISSING_ACCOUNT_ID"
  | "STALE_ACCOUNT_METADATA"
  | "MISSING_ACCOUNT_CURRENCY"
  | "ACCOUNT_NOT_FRESH"
  | "MISSING_OFFER_OR_SYMBOL"
  | "MISSING_CONTRACT_SIZE"
  | "MISSING_QUANTITY_UNIT"
  | "BROKER_AMOUNT_UNIT_UNVERIFIED"
  | "BROKER_MINIMUM_EXCEEDS_ALLOWED_QUANTITY"
  | "BROKER_MINIMUM_EXCEEDS_RISK_BUDGET"
  | "QUANTITY_MISMATCH_BETWEEN_PIPELINE_STAGES"
  | "OWNER_MAX_QUANTITY_EXCEEDED"
  | "QUANTITY_STEP_INVALID"
  | "INVALID_ENTRY"
  | "INVALID_STOP_LOSS"
  | "INVALID_TAKE_PROFIT"
  | "INVALID_SL_GEOMETRY"
  | "INVALID_TP_GEOMETRY"
  | "INVALID_PRICE_PRECISION"
  | "REWARD_RISK_BELOW_3R"
  | "INVALID_ORDER_TYPE"
  | "UNSUPPORTED_TIME_IN_FORCE"
  | "GTD_EXPIRATION_MISSING"
  | "PROTECTION_ATTACHMENT_UNVERIFIED"
  | "STALE_MARGIN_DATA"
  | "INSUFFICIENT_AVAILABLE_MARGIN"
  | "EXPOSURE_LIMIT_EXCEEDED"
  | "STALE_INSTRUMENT_METADATA"
  | "INSTRUMENT_MISMATCH"
  | "DIRECTION_MISMATCH"
  | "RISK_POLICY_MISMATCH"
  | "MISSING_RISK_POLICY_VERSION"
  | "TRADE_ID_MUST_NOT_BE_INVENTED"
  | "ORDER_ID_MUST_NOT_BE_INVENTED"
  | "UNKNOWN";

export interface AtBrokerCheck {
  code: string;
  pass: boolean;
  message: string;
}

export interface AtBrokerBlocker {
  code: AtBrokerHandoffBlockCode | string;
  message: string;
}

export type ProtectionAttachmentMode =
  | "ATTACH_ON_OPEN_ORDER"
  | "POST_FILL_SEPARATE_PROTECTION"
  | "UNSUPPORTED"
  | "UNVERIFIED";

export type ProtectionCompatibilityStatus =
  | "COMPATIBLE_ATTACH_ON_OPEN"
  | "REQUIRES_POST_FILL_WORKFLOW"
  | "BLOCKED_UNVERIFIED"
  | "NOT_EVALUATED";

export interface AtBrokerHandoffProvenance {
  handoffId: string;
  schemaVersion: typeof AT_BROKER_HANDOFF_SCHEMA;
  createdAtUtc: string;
  updatedAtUtc: string;
  proposalId: string | null;
  proposalSchemaVersion: string | null;
  analysisId: string | null;
  resultIntakeId: string | null;
  observationId: string | null;
  imageId: string | null;
  imageHash: string | null;
  instrument: string | null;
  timeframe: string | null;
  strategyId: string | null;
  riskPolicyVersion: string | null;
  environment: AutomatedTradingEnvironment | null;
}

export interface AtBrokerAccountCompat {
  broker: "FXCM";
  brokerPlatform: "FOREXCONNECT";
  accountReference: string | null;
  accountCurrency: string | null;
  accountType: string | null;
  accountStatus: string | null;
  accountMetadataTimestamp: string | null;
  accountConnected: boolean | null;
  accountAuthenticated: boolean | null;
  accountDataFresh: boolean | null;
  equity: number | null;
  usedMargin: number | null;
  availableMargin: number | null;
}

export interface AtBrokerInstrumentCompat {
  symbol: string | null;
  offerId: string | null;
  instrumentType: string | null;
  baseCurrency: string | null;
  quoteCurrency: string | null;
  contractSize: number | null;
  lotSize: number | null;
  amountUnit: string | null;
  minimumAmount: number | null;
  maximumAmount: number | null;
  amountStep: number | null;
  tickSize: number | null;
  pipSize: number | null;
  pricePrecision: number | null;
  pipValue: number | null;
  tickValue: number | null;
  tradingStatus: string | null;
  tradingSession: string | null;
  marginRequirement: number | null;
  instrumentMetadataTimestamp: string | null;
  contractVerified: boolean | null;
}

export interface AtBrokerDirectionOrder {
  canonicalDecision: "BUY" | "SELL" | "NO_TRADE" | null;
  brokerBuySell: "B" | "S" | null;
  orderType: "MARKET" | "LIMIT" | "STOP_ENTRY" | "LIMIT_ENTRY" | "UNSET" | null;
  amount: number | null;
  normalizedQuantity: number | null;
  ownerMaxLots: typeof OWNER_MAX_LOTS;
  entryPrice: number | null;
  entryZoneLow: number | null;
  entryZoneHigh: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  timeInForce: "GTC" | "IOC" | "FOK" | "DAY" | "GTD" | null;
  expiration: string | null;
  clientReference: string | null;
  /** Never invent — always null in Step 3. */
  brokerOrderId: null;
  brokerTradeId: null;
}

export interface AtBrokerRiskCapital {
  strategyAllocationPercent: number | null;
  strategyAllocationBudget: number | null;
  individualOrderAllocation: number | null;
  riskTargetPercent: number | null;
  maximumRiskPercent: number | null;
  allowedRiskAmount: number | null;
  projectedLossAtStopLoss: number | null;
  plannedRewardRisk: number | null;
  requiredMargin: number | null;
  availableMargin: number | null;
  projectedExposure: number | null;
  remainingAllocation: number | null;
  riskPolicyVersion: string | null;
}

export interface AtBrokerProtectionCompat {
  stopLossSupported: boolean | null;
  takeProfitSupported: boolean | null;
  attachmentMode: ProtectionAttachmentMode;
  requiredProtectionWorkflow: string | null;
  protectionCompatibilityStatus: ProtectionCompatibilityStatus;
  note: string;
}

export interface AtBrokerHandoffRecord {
  schemaVersion: typeof AT_BROKER_HANDOFF_SCHEMA;
  phase: typeof AT_BROKER_HANDOFF_PHASE;
  idempotencyKey: string;
  lifecycle: AtBrokerHandoffLifecycle;
  provenance: AtBrokerHandoffProvenance;
  account: AtBrokerAccountCompat;
  instrument: AtBrokerInstrumentCompat;
  directionOrder: AtBrokerDirectionOrder;
  riskCapital: AtBrokerRiskCapital;
  protection: AtBrokerProtectionCompat;
  validationStatus: "PASS" | "FAIL" | "NOT_EVALUATED";
  validationTimestamp: string;
  passedChecks: AtBrokerCheck[];
  failedChecks: AtBrokerCheck[];
  warnings: string[];
  blockers: AtBrokerBlocker[];
  expiresAtUtc: string | null;
  futureExecutionContractVersion: typeof AT_FUTURE_EXECUTION_CONTRACT_VERSION;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}

/**
 * Read-only contract for a future execution module.
 * Step 3 produces this snapshot; it does not execute.
 */
export interface AtFutureExecutionContract {
  contractVersion: typeof AT_FUTURE_EXECUTION_CONTRACT_VERSION;
  handoffId: string;
  proposalId: string | null;
  analysisId: string | null;
  riskPolicyVersion: string | null;
  broker: "FXCM";
  brokerPlatform: "FOREXCONNECT";
  accountReference: string | null;
  symbol: string | null;
  offerId: string | null;
  brokerBuySell: "B" | "S" | null;
  amount: number | null;
  amountUnit: string | null;
  orderType: string | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  timeInForce: string | null;
  expiration: string | null;
  clientReference: string | null;
  requiredProtectionWorkflow: string | null;
  validationStatus: "PASS" | "FAIL" | "NOT_EVALUATED";
  handoffLifecycle: AtBrokerHandoffLifecycle;
  expiresAtUtc: string | null;
  revalidateBeforeExecute: true;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}

export interface AtBrokerHandoffStoreFile {
  schemaVersion: typeof AT_BROKER_HANDOFF_SCHEMA;
  phase: typeof AT_BROKER_HANDOFF_PHASE;
  latestId: string | null;
  byIdempotencyKey: Record<string, string>;
  history: AtBrokerHandoffRecord[];
}

export interface AtBrokerHandoffPublicStatus {
  schemaVersion: typeof AT_BROKER_HANDOFF_SCHEMA;
  phase: typeof AT_BROKER_HANDOFF_PHASE;
  latest: AtBrokerHandoffRecord | null;
  historyCount: number;
  readyCount: number;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}

/** Snapshot inputs for pure validation (from lastVerification + proposal). */
export interface AtBrokerCompatibilityInput {
  proposal: AtOrderProposalRecord | null | undefined;
  account: {
    accountIdMasked: string | null;
    accountCurrency: string | null;
    equity: number | null;
    usedMargin: number | null;
    usableMargin: number | null;
    isFresh: boolean;
    fetchedAtUtc: string | null;
    environment: AutomatedTradingEnvironment | null;
    accountType?: string | null;
    accountStatus?: string | null;
  } | null;
  instrument: {
    symbol: string | null;
    offerId?: string | null;
    instrumentType: string | null;
    baseAsset: string | null;
    quoteAsset: string | null;
    pointSize: number | null;
    pipCostAccount: number | null;
    contractMultiplier: number | null;
    baseUnitSize: number | null;
    quantityMin: number | null;
    quantityStep: number | null;
    quantityUnit: string | null;
    marginPerLotAccount: number | null;
    contractVerified: boolean;
    contractSource: string | null;
    unavailableReason: string | null;
    digits?: number | null;
  } | null;
  market?: {
    bid: number | null;
    ask: number | null;
    marketSession?: string | null;
  } | null;
  accountConnected?: boolean | null;
  accountAuthenticated?: boolean | null;
  instrumentFresh?: boolean | null;
  marginFresh?: boolean | null;
  systemMasterOn?: boolean | null;
  maxExposureLimit?: number | null;
  existingExposure?: number | null;
  /** Authoritative attestation that opening-order SL/TP attach is supported. Never invent. */
  protectionAttachVerified?: boolean | null;
  nowMs?: number;
  handoffId?: string;
  idempotencyKey?: string;
  /** Default handoff TTL when metadata freshness known. */
  handoffTtlMs?: number;
}
