/**
 * Step 2 — Risk, Capital Allocation & Order Construction.
 * Produces auditable order proposals. Never places, submits, modifies, or cancels broker orders.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AtBinaryDirection } from "../analysis/direction.js";

export const AT_ORDER_PROPOSAL_SCHEMA = "at-order-proposal-v1" as const;
export const AT_ORDER_PROPOSAL_PHASE = "4.18G.2" as const;
export const AT_ORDER_PROPOSAL_MAX_HISTORY = 80;

/** Owner-approved maximum trade size (lots/contracts). Never raised. */
export const OWNER_MAX_QUANTITY = 0.01;

/**
 * Production risk policy (unchanged from simulation-risk capital-budget):
 * allowedRiskAmount = individualOrderAllocation × PER_ORDER_LOSS_LIMIT_FRACTION (0.25).
 * Distinct from Capital Allocation % and Order Allocation.
 */
export const RISK_POLICY_ID = "PER_ORDER_ALLOCATION_25PCT_LOSS" as const;

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
  | "STALE_ACCOUNT_EQUITY"
  | "STALE_MARGIN_DATA"
  | "MISSING_ACCOUNT_EQUITY"
  | "MISSING_MARGIN_DATA"
  | "RISK_LIMIT_EXCEEDED"
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
  /** B — max permitted loss if SL is reached (25% of order allocation under current policy). */
  allowedRiskAmount: number | null;
  projectedLossAtStopLoss: number | null;
  remainingRiskBudget: number | null;
  riskPolicyId: typeof RISK_POLICY_ID;
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
  plannedRewardRiskRatio: number | null;
  takeProfitLabel: "3R_PLANNED_TARGET";
  takeProfitNote: string;
  invalidationConditions: string[];
}

export interface AtOrderProposalQuantityPlan {
  calculatedQuantity: number | null;
  normalizedQuantity: number | null;
  lotContractUnit: string | null;
  contractSize: number | null;
  tickSize: number | null;
  pipTickValue: number | null;
  brokerMinimum: number | null;
  brokerMaximum: number | null;
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
