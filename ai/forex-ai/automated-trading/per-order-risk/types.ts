/**
 * Stage 5 — Automated Per-Order Risk Management Engine contracts.
 * Proposal preparation + auditable risk records only. Never places broker orders.
 */
import {
  PER_ORDER_RISK_MAXIMUM_PERCENT,
  PER_ORDER_RISK_TARGET_PERCENT,
  RISK_POLICY_ID,
  RISK_POLICY_VERSION,
} from "../order-proposal/types.js";

export const AT_PER_ORDER_RISK_SCHEMA = "at-per-order-risk-v1" as const;
export const AT_PER_ORDER_RISK_STAGE = "STAGE_5_AUTOMATED_PER_ORDER_RISK_ENGINE" as const;
export const AT_PER_ORDER_RISK_PHASE = "5.0" as const;

/** Verified operating default from existing order-proposal / capital-budget policy. */
export const DEFAULT_PER_ORDER_RISK_PERCENT = PER_ORDER_RISK_TARGET_PERCENT;
/** Hard ceiling — never exceeded intentionally. */
export const MAX_PER_ORDER_LOSS_PERCENT = PER_ORDER_RISK_MAXIMUM_PERCENT;
export const MINIMUM_REWARD_TO_RISK_RATIO = 3 as const;

export {
  PER_ORDER_RISK_TARGET_PERCENT,
  PER_ORDER_RISK_MAXIMUM_PERCENT,
  RISK_POLICY_ID,
  RISK_POLICY_VERSION,
};

/**
 * Display categories for Admin UI — not a new lifecycle state machine.
 * Mapped from existing proposal lifecycle + blockers.
 */
export type PerOrderRiskDisplayCategory =
  | "VALIDATED_PROPOSAL"
  | "BLOCKED_PROPOSAL"
  | "WAITING_FOR_DATA"
  | "INVALID_RISK"
  | "EXPIRED_PROPOSAL";

export type PerOrderRiskValidationResult =
  | "PASS"
  | "FAIL"
  | "WAITING"
  | "NOT_EVALUATED";

/** Machine-readable Stage 5 codes — reuse equivalents where already present. */
export type PerOrderRiskRejectionCode =
  | "ORDER_ALLOCATION_UNAVAILABLE"
  | "ORDER_RISK_BUDGET_EXCEEDED"
  | "STOP_LOSS_MISSING"
  | "STOP_LOSS_INVALID"
  | "WAITING_FOR_VALID_STOP_LOSS"
  | "POSITION_SIZE_UNVERIFIED"
  | "CONTRACT_SIZE_UNVERIFIED"
  | "OWNER_MAX_LOT_EXCEEDED"
  | "TAKE_PROFIT_BELOW_3R"
  | "PROPOSED_ORDER_MARGIN_UNVERIFIED"
  | "SPREAD_LIMIT_NOT_CONFIGURED"
  | "SLIPPAGE_LIMIT_NOT_CONFIGURED"
  | "MARKET_DATA_STALE"
  | "ACCOUNT_DATA_STALE"
  | "PROPOSAL_EXPIRED"
  | "HANDOFF_NOT_READY"
  | "EMERGENCY_LOCK"
  | "EXECUTION_MASTER_OFF"
  | "ENTRY_UNAVAILABLE"
  | "DIRECTION_MISSING"
  | "MONETARY_3R_UNVERIFIED"
  | "UNKNOWN";

export interface PerOrderRiskRejection {
  code: PerOrderRiskRejectionCode | string;
  message: string;
  instrument?: string | null;
  proposalId?: string | null;
  actual?: number | string | null;
  required?: number | string | null;
  missing?: string | null;
}

export interface PerOrderRiskLevelProvenance {
  entrySource: string | null;
  stopLossSource: string | null;
  takeProfitSource: string | null;
  atrValue: number | null;
  atrMethod: string | null;
  structureUsed: boolean;
}

/**
 * Independently auditable per-order risk record.
 * Modeled Stop Loss risk ≠ guaranteed realized loss (gaps/slippage).
 */
export interface PerOrderRiskRecord {
  schemaVersion: typeof AT_PER_ORDER_RISK_SCHEMA;
  stage: typeof AT_PER_ORDER_RISK_STAGE;
  phase: typeof AT_PER_ORDER_RISK_PHASE;
  proposalId: string;
  allocationId: string;
  accountIdMasked: string | null;
  environment: "DEMO" | "LIVE" | null;
  instrument: string | null;
  direction: "BUY" | "SELL" | null;
  entryPrice: number | null;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  capitalAllocation: number | null;
  accountCurrency: string | null;
  operatingRiskPercent: typeof DEFAULT_PER_ORDER_RISK_PERCENT | number;
  hardMaximumRiskPercent: typeof MAX_PER_ORDER_LOSS_PERCENT | number;
  maximumAllowedMonetaryLoss: number | null;
  plannedMonetaryRisk: number | null;
  actualModeledMonetaryRisk: number | null;
  expectedMonetaryProfit: number | null;
  actualRewardToRiskRatio: number | null;
  calculatedQuantity: number | null;
  quantityUnit: string | null;
  contractSize: number | null;
  pricePrecision: number | null;
  marginRequirement: number | null;
  marginVerificationStatus: "VERIFIED" | "UNVERIFIED" | "MISSING" | null;
  spreadAtCalculation: number | null;
  slippagePolicyStatus: string | null;
  spreadPolicyStatus: string | null;
  marketDataTimestampUtc: string | null;
  riskCalculationTimestampUtc: string;
  policyVersion: string;
  contractMetadataVersion: string | null;
  proposalExpiryUtc: string | null;
  validationResult: PerOrderRiskValidationResult;
  displayCategory: PerOrderRiskDisplayCategory;
  rejectionReasons: PerOrderRiskRejection[];
  levelProvenance: PerOrderRiskLevelProvenance;
  riskPolicyId: string;
  /**
   * Explicit: modeled SL risk is a planning estimate.
   * Gaps, slippage, and liquidity can cause realized loss to exceed the model.
   */
  modeledVsRealizedNote: string;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  executionAuthorized: false;
}

export const MODELED_VS_REALIZED_NOTE =
  "Modeled Stop Loss monetary risk is a deterministic planning estimate from Entry–SL distance × quantity × verified contract metadata. "
  + "It is NOT a guaranteed maximum realized loss. Market gaps, slippage, liquidity shortages, and broker execution conditions "
  + "can cause realized loss to exceed the modeled amount. Broker-side SL modification is out of Stage 5 scope.";
