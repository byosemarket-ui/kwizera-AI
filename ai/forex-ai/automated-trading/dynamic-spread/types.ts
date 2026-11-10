/**
 * Dynamic Spread Intelligence Engine — decision contracts.
 * ACCEPT/REJECT eligibility only. Never authorizes or submits broker orders.
 * Never invents contract metadata, conversion rates, or owner thresholds.
 */

export const DYNAMIC_SPREAD_ENGINE_ID = "Dynamic Spread Intelligence Engine" as const;
export const DYNAMIC_SPREAD_ENGINE_VERSION = "dynamic-spread-intelligence-v1" as const;
export const DYNAMIC_SPREAD_MODE = "DYNAMIC" as const;

/** Minimum LIVE observations required for rolling percentile / abnormality checks. */
export const DYNAMIC_SPREAD_MIN_ROLLING_SAMPLES = 20;

/** Max age of a historical observation to count toward rolling stats (ms). */
export const DYNAMIC_SPREAD_OBSERVATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Default live quote freshness window (ms) when caller does not supply one. */
export const DYNAMIC_SPREAD_DEFAULT_QUOTE_MAX_AGE_MS = 5_000;

export type DynamicSpreadDecision = "ACCEPT" | "REJECT";

export type DynamicSpreadReasonCode =
  | "QUOTE_MISSING"
  | "QUOTE_STALE"
  | "QUOTE_INVALID"
  | "MARKET_DATA_NOT_LIVE"
  | "MARKET_UNAVAILABLE"
  | "INSTRUMENT_MISMATCH"
  | "FEED_DISCONNECTED"
  | "SPREAD_DATA_INSUFFICIENT"
  | "SPREAD_ABNORMAL_WIDENING"
  | "SPREAD_COST_UNVERIFIED"
  | "SPREAD_COST_EXCESSIVE"
  | "STOP_LOSS_RISK_EXCEEDED"
  | "NET_REWARD_BELOW_POLICY"
  | "NET_REWARD_BELOW_3R"
  | "INSTRUMENT_METADATA_UNVERIFIED"
  | "CURRENCY_CONVERSION_UNVERIFIED"
  | "BROKER_CONSTRAINT_UNVERIFIED"
  | "QUANTITY_INVALID"
  | "ALLOCATION_UNVERIFIED"
  | "PROPOSAL_BINDING_REQUIRED"
  | "LEGACY_EMERGENCY_SPREAD_CEILING"
  | "DYNAMIC_SPREAD_OK";

/**
 * Cost-accounting convention (documented; must stay consistent with simulation-risk):
 * - Modeled SL loss = |entry−SL| × contract economics × lots — does NOT include spread.
 * - Spread cost is a separate entry friction: full (ask−bid) converted via POINT_COST or
 *   CONTRACT_MULTIPLIER (same methods as estimateStopLossRisk).
 * - Spread is subtracted from TP monetary reward for net ≥3R checks when verified.
 * - Never add spread into estimatedStopLossRisk (prevents double-counting).
 */
export const DYNAMIC_SPREAD_COST_ACCOUNTING_CONVENTION =
  "SL_GROSS_EXCLUDES_SPREAD__SPREAD_IS_ENTRY_FRICTION_SUBTRACTED_FROM_TP_REWARD_ONLY" as const;

export type DynamicSpreadCostAccountingConvention =
  typeof DYNAMIC_SPREAD_COST_ACCOUNTING_CONVENTION;

export interface DynamicSpreadRollingStats {
  sampleCount: number;
  minRequiredSamples: number;
  sufficient: boolean;
  currentSpread: number | null;
  median: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  /** Population stdev of absolute spreads in the rolling window. */
  volatility: number | null;
  recentWidening: boolean | null;
  abnormal: boolean | null;
  oldestObservationAtUtc: string | null;
  newestObservationAtUtc: string | null;
  note: string;
}

export interface DynamicSpreadCostBreakdown {
  spreadAbsolute: number | null;
  spreadCostAccount: number | null;
  commissionAccount: number | null;
  slippageEstimateAccount: number | null;
  totalEntryFrictionAccount: number | null;
  method: "POINT_COST" | "CONTRACT_MULTIPLIER" | null;
  commissionStatus: "VERIFIED" | "NOT_VERIFIED" | "NOT_APPLICABLE";
  slippageStatus: "EVIDENCE_AVAILABLE" | "UNAVAILABLE";
  currency: string | null;
  note: string;
}

export interface DynamicSpreadStopLossImpact {
  modeledStopLossRiskAccount: number | null;
  /** Spread is NOT included in modeledStopLossRiskAccount. */
  spreadIncludedInStopLossRisk: false;
  orderAllocationAccount: number | null;
  allowedRiskAmountAccount: number | null;
  riskTargetFraction: 0.25;
  riskHardMaxFraction: 0.25;
  withinPerOrderRiskBudget: boolean | null;
  note: string;
}

export interface DynamicSpreadNetRewardResult {
  modeledStopLossRiskAccount: number | null;
  grossTakeProfitRewardAccount: number | null;
  netTakeProfitRewardAccount: number | null;
  rewardToRiskRatio: number | null;
  minimumRequiredRatio: 3;
  meetsMinimum: boolean | null;
  costsSubtractedFromReward: boolean;
  note: string;
}

export interface DynamicSpreadEvaluationResult {
  engineId: typeof DYNAMIC_SPREAD_ENGINE_ID;
  engineVersion: typeof DYNAMIC_SPREAD_ENGINE_VERSION;
  mode: typeof DYNAMIC_SPREAD_MODE;
  decision: DynamicSpreadDecision;
  /**
   * ACCEPT means only that Dynamic Spread Intelligence validation passed.
   * It does NOT authorize broker submission.
   */
  authorizesBrokerSubmission: false;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  instrument: string | null;
  proposalId: string | null;
  allocationId: string | null;
  quoteId: string | null;
  quoteTimestampUtc: string | null;
  quoteAgeMs: number | null;
  bid: number | null;
  ask: number | null;
  currentSpread: number | null;
  pricePrecision: number | null;
  provenance: string | null;
  feedConnected: boolean | null;
  marketStatus: "OPEN" | "CLOSED" | "UNKNOWN" | null;
  rolling: DynamicSpreadRollingStats;
  costBreakdown: DynamicSpreadCostBreakdown;
  costAccountingConvention: DynamicSpreadCostAccountingConvention;
  stopLossImpact: DynamicSpreadStopLossImpact;
  netReward: DynamicSpreadNetRewardResult;
  quantityLots: number | null;
  brokerAmount: number | null;
  baseUnitSize: number | null;
  contractMetaVerified: boolean;
  reasonCodes: DynamicSpreadReasonCode[];
  primaryReasonCode: DynamicSpreadReasonCode;
  message: string;
  evaluatedAtUtc: string;
  /**
   * Binding: a REJECTED proposalId must not be re-accepted without a new proposal
   * and a fresh evaluation run.
   */
  requiresFreshProposalOnReject: true;
  legacyEmergencyCeilingApplied: boolean;
  legacyMaxSpreadAbsolute: number | null;
}

export interface DynamicSpreadHistoricalObservation {
  spreadAbsolute: number;
  observedAtUtc: string;
  provenance?: string | null;
  instrument?: string | null;
}

export interface DynamicSpreadEngineInput {
  instrument: string | null | undefined;
  expectedInstrument?: string | null | undefined;
  bid: number | null | undefined;
  ask: number | null | undefined;
  quoteTimestampUtc?: string | null | undefined;
  quoteId?: string | null | undefined;
  quoteAgeMs?: number | null | undefined;
  quoteMaxAgeMs?: number | null | undefined;
  provenance?: string | null | undefined;
  feedConnected?: boolean | null | undefined;
  marketStatus?: "OPEN" | "CLOSED" | "UNKNOWN" | null | undefined;
  historicalSpreads?: DynamicSpreadHistoricalObservation[] | null | undefined;
  direction?: "BUY" | "SELL" | null | undefined;
  entryPrice?: number | null | undefined;
  stopLoss?: number | null | undefined;
  takeProfit?: number | null | undefined;
  quantityLots?: number | null | undefined;
  brokerAmount?: number | null | undefined;
  baseUnitSize?: number | null | undefined;
  /** Verified contract economics — never invent. */
  contract?: import("../simulation-risk/types.js").AtSimContractMetaInput | null | undefined;
  orderAllocationAccount?: number | null | undefined;
  allocationId?: string | null | undefined;
  proposalId?: string | null | undefined;
  accountCurrency?: string | null | undefined;
  /** Optional verified commission in account currency (≥0). */
  commissionAccount?: number | null | undefined;
  commissionVerified?: boolean | null | undefined;
  /** Optional evidence-backed slippage cost estimate in account currency. */
  slippageEstimateAccount?: number | null | undefined;
  slippageEvidenceAvailable?: boolean | null | undefined;
  /**
   * Legacy owner-approved absolute ceiling when present.
   * Optional emergency safety only — null does NOT fail closed once DYNAMIC mode is active.
   */
  legacyMaxSpreadAbsolute?: number | null | undefined;
  nowMs?: number | null | undefined;
}
