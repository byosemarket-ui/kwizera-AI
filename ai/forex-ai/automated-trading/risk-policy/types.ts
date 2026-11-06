/**
 * Stage 3 — Risk policy configuration & order readiness contracts.
 * Never invents numeric thresholds. Never mutates broker state.
 */

export const RISK_POLICY_SCHEMA = "kwizera.at-risk-policy.v1" as const;
export const RISK_POLICY_STAGE = "STAGE_3_RISK_POLICY_ORDER_READINESS" as const;

export const STAGE3_TRACKED_INSTRUMENTS = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "XAU/USD",
] as const;

export type Stage3TrackedInstrument = (typeof STAGE3_TRACKED_INSTRUMENTS)[number];

export type RiskPolicyFieldStatus =
  | "VERIFIED"
  | "NOT_CONFIGURED"
  | "INVALID"
  | "UNAVAILABLE";

export type SlippageBasis = "entry_vs_executable";

export interface RiskPolicyAuditEntry {
  atUtc: string;
  actor: string;
  action:
    | "CREATE_EMPTY"
    | "SET_SPREAD"
    | "CLEAR_SPREAD"
    | "SET_SLIPPAGE"
    | "CLEAR_SLIPPAGE"
    | "REJECT_INVALID";
  instrument: string | null;
  detail: string;
  previousValue: number | null;
  nextValue: number | null;
}

export interface InstrumentSpreadPolicy {
  instrument: string;
  /** Absolute price units (same scale as bid/ask). Null until owner-approved. */
  maxSpreadAbsolute: number | null;
  units: "absolute_price";
  /** Decimal places used for display/validation when known; never invented. */
  pricePrecision: number | null;
  status: RiskPolicyFieldStatus;
  reason: string | null;
  approvedAtUtc: string | null;
  approvedBy: string | null;
}

export interface InstrumentSlippagePolicy {
  instrument: string;
  /** Absolute price distance |entry − executable|. Null until owner-approved. */
  maxSlippageAbsolute: number | null;
  units: "absolute_price";
  basis: SlippageBasis;
  status: RiskPolicyFieldStatus;
  reason: string | null;
  approvedAtUtc: string | null;
  approvedBy: string | null;
}

export interface InstrumentRiskPolicy {
  instrument: string;
  spread: InstrumentSpreadPolicy;
  slippage: InstrumentSlippagePolicy;
}

export interface AtRiskPolicyDocument {
  schemaVersion: typeof RISK_POLICY_SCHEMA;
  stage: typeof RISK_POLICY_STAGE;
  version: number;
  updatedAtUtc: string;
  instruments: Record<string, InstrumentRiskPolicy>;
  audit: RiskPolicyAuditEntry[];
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}

export interface ResolvedSpreadLimit {
  value: number | null;
  source: "request" | "instrument_policy" | "env" | null;
  status: RiskPolicyFieldStatus;
  reason: string | null;
  instrument: string | null;
}

export interface ResolvedSlippageLimit {
  value: number | null;
  source: "request" | "instrument_policy" | null;
  status: RiskPolicyFieldStatus;
  reason: string | null;
  instrument: string | null;
  basis: SlippageBasis;
}

export type MarginAttestationStatus =
  | "VERIFIED"
  | "UNAVAILABLE"
  | "INVALID"
  | "INSUFFICIENT";

export interface ProposedOrderMarginAttestation {
  status: MarginAttestationStatus;
  reason: string | null;
  usableMargin: number | null;
  requiredMargin: number | null;
  requiredMarginSource:
    | "proposal.estimatedMargin"
    | "handoff.requiredMargin"
    | "mmr_per_lot_x_lots"
    | null;
  mmrPerLot: number | null;
  lots: number | null;
  contractVerified: boolean;
  baseUnitSize: number | null;
}

export type OrderReadinessVerdict = "READY_FOR_PRECHECK" | "NOT_READY" | "INCONSISTENT";

export interface OrderReadinessFinding {
  id: string;
  severity: "block" | "warn" | "info";
  code: string;
  message: string;
}

export interface OrderReadinessAudit {
  schemaVersion: "kwizera.order-readiness.v1";
  stage: typeof RISK_POLICY_STAGE;
  auditedAtUtc: string;
  verdict: OrderReadinessVerdict;
  proposalId: string | null;
  handoffId: string | null;
  proposalLifecycle: string | null;
  handoffLifecycle: string | null;
  findings: OrderReadinessFinding[];
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  executionAuthorized: false;
  note: string;
}
