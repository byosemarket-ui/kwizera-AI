/**
 * Phase 56.2 / 56.2.2 — Simulation-only risk engine & trade draft validation contracts.
 * Shared DEMO/LIVE architecture. Never places broker orders.
 * 56.2.2 adds margin-allocation (12–25% of equity) and independent 3R analysis.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AtBinaryDirection } from "../analysis/direction.js";
import type { MarketEvidenceStrength } from "./allocation-3r.js";
import type { AtSimProfitProtectionResult } from "./profit-protection.js";

export const AT_SIM_RISK_SCHEMA = "at-simulation-risk-draft-v1";
export const AT_SIM_RISK_PHASE = "56.2.4";
export const AT_SIM_RISK_POLICY_VERSION = "sim-risk-policy-v1";
export const AT_SIM_RISK_BANNER =
  "SIMULATION-ONLY DRAFT VALIDATION — PHASE 56.2.4 — EXECUTION FORBIDDEN";

/**
 * Hard max-loss % per trade remains undecided (distinct from 12–25% allocation).
 * Legacy OD-04 naming kept on riskBudgetMode fields.
 */
export type AtSimRiskBudgetMode = "UNDECIDED" | "PERCENTAGE" | "FIXED";

/** Owner-approved margin/position allocation range policy (not loss %). */
export type AtSimAllocationPolicyMode = "PERCENTAGE_RANGE" | "UNSET";

export type AtSimDraftOverallStatus =
  | "DRAFT"
  | "VALIDATING"
  | "VALIDATION_PASSED"
  | "REJECTED_LOCAL"
  | "BLOCKED_INSUFFICIENT_DATA"
  | "BLOCKED_POLICY_UNDECIDED";

export type AtSimCheckStatus = "PASS" | "FAIL" | "BLOCKED" | "SKIPPED";

export type AtSimCheckCategory =
  | "STRUCTURAL"
  | "DIRECTION_PRICE"
  | "INSTRUMENT"
  | "QUOTE"
  | "ACCOUNT"
  | "QUANTITY_CONTRACT"
  | "RISK_BUDGET"
  | "ALLOCATION"
  | "REWARD_RISK"
  | "PROFIT_PROTECTION"
  | "MARGIN"
  | "ENVIRONMENT"
  | "SAFETY";

export type { MarketEvidenceStrength };
export type { AtSimProfitProtectionResult };

export interface AtSimRiskPolicy {
  schemaVersion: typeof AT_SIM_RISK_POLICY_VERSION;
  mode: "SIMULATION_ONLY";
  /**
   * Hard max-loss / risk-budget mode — still UNDECIDED until owner sets a
   * separate loss ceiling. Not the 12–25% allocation range.
   */
  riskBudgetMode: AtSimRiskBudgetMode;
  riskPercent: number | null;
  riskFixedAmount: number | null;
  /** Owner-approved allocation band (12–25% of equity). */
  allocationPolicyMode: AtSimAllocationPolicyMode;
  allocationPercentMin: number;
  allocationPercentMax: number;
  updatedAtUtc: string;
  updatedBy: "admin" | "system";
  note: string;
}

export interface AtSimValidationCheck {
  code: string;
  category: AtSimCheckCategory;
  status: AtSimCheckStatus;
  message: string;
}

export interface AtSimReason {
  code: string;
  message: string;
}

export interface AtSimContractMetaInput {
  /** True only when caller marks fields as broker-verified (never invent). */
  verified: boolean;
  pointSize: number | null;
  tickSize: number | null;
  digits: number | null;
  quantityMin: number | null;
  quantityStep: number | null;
  /** Explicit unit from verified metadata — never invent ounces. */
  quantityUnit: string | null;
  /** Ambiguous/unknown units block quantity sizing. */
  quantityUnitAmbiguous: boolean;
  contractMultiplier: number | null;
  baseUnitSize: number | null;
  pipCostAccount: number | null;
  marginPerLotAccount: number | null;
  /**
   * Broker min stop distance in **price** units (CondDist pips × PointSize).
   * Null when unverified OR when no positive minimum is attested (CondDist=0).
   */
  minStopDistance: number | null;
  minStopDistanceVerified: boolean;
  /** True when SDK CondDistStop=0 pips (account-scoped: no positive minimum). */
  minStopNoPositiveMinimum?: boolean;
  /** CondDist raw pips when unit verified; null otherwise. */
  condDistStopPips?: number | null;
  condDistUnit?: "pips" | "unknown" | null;
  source: string | null;
  unavailableReason: string | null;
}

export interface AtSimAccountMetaInput {
  /** True when equity/margin came from a verified Accounts snapshot. */
  verified: boolean;
  accountIdMasked: string | null;
  accountCurrency: string | null;
  equity: number | null;
  balance: number | null;
  usableMargin: number | null;
  usedMargin: number | null;
  fetchedAtUtc: string | null;
  environment: AutomatedTradingEnvironment | null;
  unavailableReason: string | null;
}

export interface AtSimQuoteMetaInput {
  bid: number | null;
  ask: number | null;
  entryPrice: number | null;
  entrySource: string | null;
  fresh: boolean | null;
  freshnessReasonCode: string | null;
  quoteAgeMs: number | null;
  observedAtUtc: string | null;
}

export interface AtSimEnvironmentMetaInput {
  requested: AutomatedTradingEnvironment;
  actualSession: AutomatedTradingEnvironment | null;
  matches: boolean | null;
  environmentEpoch: number | null;
  identityVerified: boolean;
  /** LIVE context may be represented; execution remains forbidden. */
  liveExecutionAuthorized: false;
}

export interface AtSimProfitProtectionInputLite {
  currentPrice: number | null;
  favorableMovePrice: number | null;
  multiTimeframeReversalEvidence: boolean;
  evidenceContradictory: boolean;
  evidenceInsufficient: boolean;
  /** Proposed sim threshold — not live-approved. */
  proposedMinFavorableR: number;
  proposedTightenToBreakEven: boolean;
}

/**
 * Structured draft input for the simulation risk engine.
 * Missing fields produce explicit BLOCKED/FAIL codes — never guessed.
 */
export interface AtSimDraftInput {
  environment: AutomatedTradingEnvironment;
  environmentMeta: AtSimEnvironmentMetaInput;
  instrument: string;
  direction: AtBinaryDirection | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  requestedQuantity: number | null;
  /**
   * Owner/AI-selected allocation within 12–25%. Optional — never forced from weak evidence.
   * This is margin/position sizing input, NOT stop-loss risk %.
   */
  allocationPercentage: number | null;
  /** Deterministic market-evidence gate for allocation forcing. */
  marketEvidenceStrength: MarketEvidenceStrength | null;
  /** Optional simulation profit-protection context. */
  profitProtection: AtSimProfitProtectionInputLite | null;
  /** Phase 56.2.3 — strategy capital % from AT controls (1–100) or null if unset. */
  capitalAllocationPercent: number | null;
  /** Requested monetary slice of remaining strategy budget for this draft. */
  requestedPerOrderAllocation: number | null;
  /** Sum of ACTIVE strategy budget reservations (same environment), excluding this draft. */
  reservedStrategyBudgetActive: number;
  quote: AtSimQuoteMetaInput;
  contract: AtSimContractMetaInput | null;
  account: AtSimAccountMetaInput | null;
  sourceDecisionId: string | null;
  sourceAnalysisId: string | null;
  sourceEvidenceFingerprint: string | null;
  sourceDecidedAtUtc: string | null;
  policy: AtSimRiskPolicy;
  /** Optional: open positions / pending exposure when authoritative (usually false in assemble). */
  openPositionsCount: number | null;
  pendingOrdersCount: number | null;
  exposureDataAuthoritative: boolean;
}

export interface AtSimAllocationAnalysis {
  allocationPercentage: number | null;
  allocationBudget: number | null;
  equityUsed: number | null;
  /** Explicit: allocation budget is not stop-loss risk. */
  isStopLossRisk: false;
  /** True when percentage is inside the owner-approved 12–25% band. */
  inApprovedRange: boolean | null;
  forcedByWeakEvidence: false;
  status: AtSimCheckStatus;
  note: string;
}

export interface AtSimRewardRiskAnalysis {
  estimatedStopLossRisk: number | null;
  targetReward3R: number | null;
  theoreticalTakeProfit3R: number | null;
  riskRewardRatio: number | null;
  estimatedGrossTarget: number | null;
  estimatedNetTarget: number | null;
  estimatedNetTargetStatus: "COMPUTED" | "NOT_VERIFIED";
  estimatedRequiredMargin: number | null;
  estimatedRequiredMarginStatus: "COMPUTED" | "NOT_VERIFIED";
  status: AtSimCheckStatus;
  note: string;
}

export interface AtSimCapitalBudgetAnalysis {
  capitalAllocationPercent: number | null;
  capitalAllocationBudget: number | null;
  reservedActive: number;
  remainingBudget: number | null;
  perOrderAllocation: number | null;
  perOrderLossLimit: number | null;
  perOrderLossLimitPass: boolean | null;
  status: AtSimCheckStatus;
  note: string;
}

export interface AtSimDraftResult {
  schemaVersion: typeof AT_SIM_RISK_SCHEMA;
  phase: typeof AT_SIM_RISK_PHASE;
  draftId: string;
  createdAtUtc: string;
  validatedAtUtc: string;
  overallStatus: AtSimDraftOverallStatus;
  environment: AutomatedTradingEnvironment;
  instrument: string;
  direction: AtBinaryDirection | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  /** Only set when quantity was validly calculated from verified metadata + approved risk. */
  proposedQuantity: number | null;
  proposedQuantityNote: string | null;
  structuralOk: boolean;
  instrumentStatus: AtSimCheckStatus;
  quoteFreshnessStatus: AtSimCheckStatus;
  slTpStatus: AtSimCheckStatus;
  accountStatus: AtSimCheckStatus;
  quantityContractStatus: AtSimCheckStatus;
  riskBudgetStatus: AtSimCheckStatus;
  marginStatus: AtSimCheckStatus;
  checks: AtSimValidationCheck[];
  reasons: AtSimReason[];
  explanations: string[];
  sourceDecisionId: string | null;
  sourceAnalysisId: string | null;
  sourceEvidenceFingerprint: string | null;
  riskPolicyVersion: typeof AT_SIM_RISK_POLICY_VERSION;
  riskPolicyMode: "SIMULATION_ONLY";
  riskPercentConfigured: boolean;
  /** Phase 56.2.2 — allocation vs independent 3R analysis (simulation only). */
  allocationAnalysis: AtSimAllocationAnalysis;
  rewardRiskAnalysis: AtSimRewardRiskAnalysis;
  /** Phase 56.2.3 — strategy capital + per-order 25% loss limit. */
  capitalBudgetAnalysis: AtSimCapitalBudgetAnalysis;
  /** Simulation-only profit-protection evaluation (never broker execution). */
  profitProtection: AtSimProfitProtectionResult | null;
  eligibilityStatus: "SIMULATION_ANALYSIS_ONLY" | "BLOCKED" | "REJECTED";
  banner: typeof AT_SIM_RISK_BANNER;
  simulationOnly: true;
  placesOrders: false;
  acceptsForExecution: false;
}

export interface AtSimRiskPublicStatus {
  phase: typeof AT_SIM_RISK_PHASE;
  schemaVersion: typeof AT_SIM_RISK_SCHEMA;
  policy: AtSimRiskPolicy;
  allowlist: string[];
  latest: AtSimDraftResult | null;
  historyCount: number;
  simulationOnly: true;
  placesOrders: false;
  acceptsForExecution: false;
  note: string;
}

export function defaultSimRiskPolicy(): AtSimRiskPolicy {
  return {
    schemaVersion: AT_SIM_RISK_POLICY_VERSION,
    mode: "SIMULATION_ONLY",
    riskBudgetMode: "UNDECIDED",
    riskPercent: null,
    riskFixedAmount: null,
    allocationPolicyMode: "PERCENTAGE_RANGE",
    allocationPercentMin: 12,
    allocationPercentMax: 25,
    updatedAtUtc: new Date().toISOString(),
    updatedBy: "system",
    note:
      "Owner margin allocation range is 12–25% of verified equity (sizing input, not loss %). "
      + "Independent hard max-loss % per trade remains undecided — not invented. "
      + "3R TP is a simulation objective when monetary R is verifiable.",
  };
}
