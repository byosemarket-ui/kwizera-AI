/**
 * Phase 56.2 — Simulation-only risk engine & trade draft validation contracts.
 * Shared DEMO/LIVE architecture. Never places broker orders.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AtBinaryDirection } from "../analysis/direction.js";

export const AT_SIM_RISK_SCHEMA = "at-simulation-risk-draft-v1";
export const AT_SIM_RISK_PHASE = "56.2";
export const AT_SIM_RISK_POLICY_VERSION = "sim-risk-policy-v1";
export const AT_SIM_RISK_BANNER =
  "SIMULATION-ONLY DRAFT VALIDATION — PHASE 56.2 — EXECUTION FORBIDDEN";

/** Owner risk % remains undecided (OD-04). Never invent a default. */
export type AtSimRiskBudgetMode = "UNDECIDED" | "PERCENTAGE" | "FIXED";

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
  | "MARGIN"
  | "ENVIRONMENT"
  | "SAFETY";

export interface AtSimRiskPolicy {
  schemaVersion: typeof AT_SIM_RISK_POLICY_VERSION;
  mode: "SIMULATION_ONLY";
  /** Owner-approved risk budget — null until decided. */
  riskBudgetMode: AtSimRiskBudgetMode;
  riskPercent: number | null;
  riskFixedAmount: number | null;
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
  /** Broker min stop distance in price units — null when unverified. */
  minStopDistance: number | null;
  minStopDistanceVerified: boolean;
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
  quote: AtSimQuoteMetaInput;
  contract: AtSimContractMetaInput | null;
  account: AtSimAccountMetaInput | null;
  sourceDecisionId: string | null;
  sourceAnalysisId: string | null;
  sourceEvidenceFingerprint: string | null;
  sourceDecidedAtUtc: string | null;
  policy: AtSimRiskPolicy;
  /** Optional: open positions / pending exposure when authoritative (usually null in 56.2). */
  openPositionsCount: number | null;
  pendingOrdersCount: number | null;
  exposureDataAuthoritative: boolean;
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
    updatedAtUtc: new Date().toISOString(),
    updatedBy: "system",
    note:
      "Owner risk percentage is undecided (OD-04). "
      + "Risk-budget sizing remains blocked until an explicit owner decision.",
  };
}
