/**
 * Step 2 — Risk, Capital Allocation & Order Construction.
 * Produces auditable order proposals. Never places, submits, modifies, or cancels broker orders.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AtBinaryDirection } from "../analysis/direction.js";

export const AT_ORDER_PROPOSAL_SCHEMA = "at-order-proposal-v1" as const;
export const AT_ORDER_PROPOSAL_PHASE = "4.18G.2" as const;
export const AT_ORDER_PROPOSAL_MAX_HISTORY = 80;

/**
 * Legacy fixed-lot ceiling retained for Stage 3 compatibility audits / historical evidence.
 * Under v3 dynamic sizing this fixed cap is NOT enforced on new proposals
 * (`OWNER_FIXED_LOT_CAP_ENFORCED=false`). Quantity comes from per-order risk budget + broker rules.
 */
export const OWNER_MAX_QUANTITY = 0.01;
/** Owner-approved Stage 1 Part 1: dynamic sizing — do not force 0.01 / 1.00 lots. */
export const OWNER_FIXED_LOT_CAP_ENFORCED = false as const;

/**
 * Per-order risk policy v3 (owner-approved Stage 1 Part 1):
 *   riskTargetAmount = allocation × 0.25
 *   maximumPermittedOrderLoss = allocation × 0.25 (hard ceiling)
 *   allowedRiskAmount = min(target, hardMax)
 * Distinct from Capital Allocation % and Order Allocation. Never pooled across orders.
 */
export const RISK_POLICY_ID = "PER_ORDER_ALLOCATION_25TARGET_25MAX" as const;
export const RISK_POLICY_ID_LEGACY_20 = "PER_ORDER_ALLOCATION_20TARGET_25MAX" as const;
export const RISK_POLICY_ID_LEGACY_25 = "PER_ORDER_ALLOCATION_25PCT_LOSS" as const;
export const RISK_POLICY_VERSION = "per-order-risk-v3-25target-25max" as const;
export const RISK_POLICY_VERSION_LEGACY_20 = "per-order-risk-v2-20target-25max" as const;
export const RISK_POLICY_VERSION_LEGACY_25 = "per-order-risk-v1-25pct-only" as const;
export const PER_ORDER_RISK_TARGET_PERCENT = 25 as const;
export const PER_ORDER_RISK_MAXIMUM_PERCENT = 25 as const;

export type AtOrderProposalLifecycle =
  | "RECEIVED"
  | "CALCULATING"
  | "VALIDATING"
  | "PROPOSAL_READY"
  | "BLOCKED"
  | "REJECTED"
  | "EXPIRED"
  | "SUPERSEDED";

export type AtOrderProposalBlockCode =
  | "NO_CANONICAL_BUY_SELL"
  | "NO_TRADE_NOT_ELIGIBLE"
  | "HANDOFF_MISSING"
  | "HANDOFF_EXPIRED"
  | "SYSTEM_MASTER_OFF"
  | "INVALID_ENTRY"
  | "INVALID_STOP_LOSS"
  | "INVALID_SL_GEOMETRY"
  | "INVALID_PRICE_PRECISION"
  | "MISSING_INSTRUMENT_SPEC"
  | "STALE_INSTRUMENT_SPEC"
  | "INSTRUMENT_NOT_ALLOWLISTED"
  | "INSTRUMENT_PHASE_OUT_OF_SCOPE"
  | "STALE_ACCOUNT_EQUITY"
  | "STALE_MARGIN_DATA"
  | "MISSING_ACCOUNT_EQUITY"
  | "MISSING_MARGIN_DATA"
  | "RISK_LIMIT_EXCEEDED"
  | "RISK_TARGET_EXCEEDED"
  | "ALLOCATION_BUDGET_EXCEEDED"
  | "INSUFFICIENT_AVAILABLE_MARGIN"
  | "EXPOSURE_LIMIT_EXCEEDED"
  | "EXPOSURE_UNVERIFIED"
  | "BROKER_MINIMUM_EXCEEDS_ALLOWED_QUANTITY"
  | "OWNER_MAX_QUANTITY_EXCEEDED"
  | "INVALID_STRATEGY_ALLOCATION_PCT"
  | "PER_ORDER_ALLOCATION_MISSING"
  | "PER_ORDER_ALLOCATION_INVALID"
  | "MISSING_FX_CONVERSION"
  | "STALE_FX_CONVERSION"
  | "DUPLICATE_ACTIVE_PROPOSAL"
  | "SIZING_FAILED"
  | "TRADING_DISABLED"
  | "EMERGENCY_LOCK"
  | "NET_REWARD_BELOW_3R"
  | "TECHNICAL_TARGET_CANNOT_SUPPORT_NET_3R"
  | "TP_OUTSIDE_VALID_MARKET_STRUCTURE"
  | "TP_PRICE_INVALID"
  | "TRADING_COST_UNVERIFIED"
  | "SPREAD_COST_DOUBLE_COUNTED"
  | "PER_ORDER_RISK_EXCEEDED"
  | "BROKER_QUANTITY_CONSTRAINT_FAILED"
  | "CURRENCY_CONVERSION_UNVERIFIED"
  | "STOP_LOSS_CHANGED_DURING_TP"
  | "QUANTITY_CHANGED_DURING_TP"
  | "UNKNOWN";

export interface AtOrderProposalBlocker {
  code: AtOrderProposalBlockCode | string;
  message: string;
}

export interface AtOrderProposalCapitalSnapshot {
  verifiedEquity: number | null;
  accountCurrency: string | null;
  /** A — portion of verified equity for this strategy (1–100). */
  strategyAllocationPercent: number | null;
  /** strategyAllocationBudget = verifiedEquity × strategyAllocationPercent / 100 */
  strategyAllocationBudget: number | null;
  /** C — capital/margin budget for this individual proposal. */
  individualOrderAllocation: number | null;
  allocatedAmount: number | null;
  existingCommittedExposure: number | null;
  pendingProposalReservations: number | null;
  remainingStrategyBudget: number | null;
  /** Risk target % (25) — intended max loss for this order. */
  riskTargetPercent: typeof PER_ORDER_RISK_TARGET_PERCENT | number | null;
  /** C — riskTargetAmount = orderAllocation × 0.25 */
  riskTargetAmount: number | null;
  /** Hard maximum risk % (25) — absolute ceiling. */
  riskMaximumPercent: typeof PER_ORDER_RISK_MAXIMUM_PERCENT | number | null;
  /** D — maximumPermittedOrderLoss = orderAllocation × 0.25 */
  maximumPermittedOrderLoss: number | null;
  /** allowedRiskAmount = min(riskTargetAmount, maximumPermittedOrderLoss) */
  allowedRiskAmount: number | null;
  projectedLossAtStopLoss: number | null;
  remainingRiskBudget: number | null;
  /** Aggregate open/pending projected risk when known; null if no aggregate policy. */
  aggregateOpenRisk: number | null;
  pendingProposalRisk: number | null;
  /** No strategy-level aggregate risk % is configured — null, not invented. */
  aggregateRiskPercentPolicy: null;
  riskValidationStatus: "PASS" | "FAIL" | "NOT_EVALUATED" | null;
  riskPolicyId: string;
  riskPolicyVersion: string;
  currency: string | null;
  configVersion: number | null;
  lastUpdateAtUtc: string | null;
}

export interface AtOrderProposalPricePlan {
  entryType: "LIMIT" | "MARKET" | "ZONE" | "EXPLICIT" | "UNSET";
  entryPrice: number | null;
  entryZoneLow: number | null;
  entryZoneHigh: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskDistance: number | null;
  rewardDistance: number | null;
  /** Gross price-distance R:R (may exceed 3 when cost-adjusted). */
  plannedRewardRiskRatio: number | null;
  takeProfitLabel: "3R_PLANNED_TARGET" | "NET_3R_AFTER_VERIFIED_COSTS";
  takeProfitNote: string;
  invalidationConditions: string[];
  /** Stage 1 — gross vs net reward visibility (null when costs not verified). */
  grossRewardRiskRatio?: number | null;
  netRewardRiskRatio?: number | null;
  verifiedTradingCostsAccount?: number | null;
  modeledStopLossRiskAccount?: number | null;
  grossTakeProfitRewardAccount?: number | null;
  netTakeProfitRewardAccount?: number | null;
  takeProfitSource?: "3R_FROM_VERIFIED_STOP_DISTANCE" | "NET_3R_AFTER_VERIFIED_COSTS" | null;
}

export interface AtOrderProposalQuantityPlan {
  /** Application lots (risk/margin unit). */
  calculatedQuantity: number | null;
  /** Application lots after broker/risk normalization. */
  normalizedQuantity: number | null;
  /** ForexConnect integer AMOUNT = baseUnitSize × lots. */
  brokerAmount: number | null;
  lotContractUnit: string | null;
  contractSize: number | null;
  tickSize: number | null;
  pipTickValue: number | null;
  /** Broker AMOUNT minimum. */
  brokerMinimum: number | null;
  /** Broker AMOUNT maximum when supplied. */
  brokerMaximum: number | null;
  /** Broker AMOUNT step (BaseUnitSize). */
  quantityStep: number | null;
  ownerMaxQuantity: typeof OWNER_MAX_QUANTITY;
  estimatedMargin: number | null;
  availableMargin: number | null;
  usedMargin: number | null;
  projectedMarginUtilization: number | null;
  existingExposure: number | null;
  projectedExposure: number | null;
  sizingMethod: "POINT_COST" | "CONTRACT_MULTIPLIER" | null;
}

/** Broker-compatible preparation fields — never claim an order was created. */
export interface AtOrderProposalBrokerPrep {
  accountReference: string | null;
  instrumentOfferReference: string | null;
  buySell: "BUY" | "SELL" | null;
  amountQuantity: number | null;
  orderType: "LIMIT" | "MARKET" | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  timeInForce: string | null;
  expiration: string | null;
  clientReference: string | null;
  /** Distinct from trade IDs — null until a real broker order exists (never invented). */
  brokerOrderId: null;
  brokerTradeId: null;
  note: string;
}

export interface AtOrderProposalRecord {
  schemaVersion: typeof AT_ORDER_PROPOSAL_SCHEMA;
  phase: typeof AT_ORDER_PROPOSAL_PHASE;
  proposalId: string;
  idempotencyKey: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  lifecycle: AtOrderProposalLifecycle;
  analysisId: string | null;
  resultIntakeId: string | null;
  observationId: string | null;
  imageId: string | null;
  imageHash: string | null;
  instrument: string | null;
  timeframe: string | null;
  strategyId: string | null;
  environment: AutomatedTradingEnvironment | null;
  canonicalDecision: "BUY" | "SELL" | "NO_TRADE" | null;
  direction: AtBinaryDirection | null;
  strategyRationale: string[];
  supportingEvidence: string[];
  conflictingEvidence: string[];
  analysisConfidencePct: number | null;
  confidenceCalibrationFlag: boolean;
  pricePlan: AtOrderProposalPricePlan;
  capital: AtOrderProposalCapitalSnapshot;
  quantity: AtOrderProposalQuantityPlan;
  brokerPrep: AtOrderProposalBrokerPrep;
  blockers: AtOrderProposalBlocker[];
  notes: string[];
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  /**
   * Stage 5 — optional auditable per-order risk record.
   * Present when generated via automated per-order risk engine.
   * Typed loosely here to avoid circular imports; consumers use PerOrderRiskRecord.
   */
  perOrderRisk?: import("../per-order-risk/types.js").PerOrderRiskRecord;
}

export interface AtOrderProposalAllocationConfig {
  /** Persisted per-order allocation preference (not strategy %). */
  individualOrderAllocation: number | null;
  allocationCurrency: string;
  /** Mirror of last-known strategy % for audit; source of truth remains AT controls. */
  strategyAllocationPercentSnapshot: number | null;
  currency: string | null;
  configVersion: number;
  updatedAtUtc: string;
}

export interface AtOrderProposalStoreFile {
  schemaVersion: typeof AT_ORDER_PROPOSAL_SCHEMA;
  phase: typeof AT_ORDER_PROPOSAL_PHASE;
  latestId: string | null;
  byIdempotencyKey: Record<string, string>;
  /** Active proposal reservations counted against strategy budget (PROPOSAL_READY only). */
  activeReservations: Record<string, number>;
  allocationConfig: AtOrderProposalAllocationConfig;
  history: AtOrderProposalRecord[];
}

export interface AtOrderProposalPublicStatus {
  schemaVersion: typeof AT_ORDER_PROPOSAL_SCHEMA;
  phase: typeof AT_ORDER_PROPOSAL_PHASE;
  latest: AtOrderProposalRecord | null;
  allocationConfig: AtOrderProposalAllocationConfig;
  activeReservationTotal: number;
  activeProposalCount: number;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}
