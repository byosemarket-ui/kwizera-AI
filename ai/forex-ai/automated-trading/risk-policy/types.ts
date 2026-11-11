/**
 * Stage 3/4 — Risk policy & approval contracts.
 * Stage 4 adds propose ≠ approve. Never invents numeric thresholds. Never mutates broker.
 */

export const RISK_POLICY_SCHEMA = "kwizera.at-risk-policy.v1" as const;
/** Stage id reflects latest workflow (Stage 4 approval) while schema remains v1-compatible. */
export const RISK_POLICY_STAGE = "STAGE_4_RISK_LIMITS_CONFIGURATION_APPROVAL" as const;

export const STAGE3_TRACKED_INSTRUMENTS = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "XAU/USD",
] as const;

export type Stage3TrackedInstrument = (typeof STAGE3_TRACKED_INSTRUMENTS)[number];

/**
 * KWIZERA AI STUDIO → FOREX → AUTOMATED TRADING — active instrument phase.
 * Catalog (`STAGE3_TRACKED_INSTRUMENTS`) is preserved for future multi-market work.
 * Only ACTIVE instruments enter Stage 1 collection / completion / active AT workflow.
 * Inactive tracked instruments remain OUT_OF_SCOPE (not deleted).
 */
export const STAGE3_ACTIVE_INSTRUMENTS = ["XAU/USD"] as const;

export type Stage3ActiveInstrument = (typeof STAGE3_ACTIVE_INSTRUMENTS)[number];

export type InstrumentPhaseStatus = "ACTIVE" | "OUT_OF_SCOPE";

export function isStage3ActiveInstrument(
  instrument: string | null | undefined,
): instrument is Stage3ActiveInstrument {
  const n = String(instrument ?? "").replace(/\s+/g, "").toUpperCase();
  return (STAGE3_ACTIVE_INSTRUMENTS as readonly string[]).some(
    (a) => a.replace(/\s+/g, "").toUpperCase() === n,
  );
}

export function getInstrumentPhaseStatus(
  instrument: string | null | undefined,
): InstrumentPhaseStatus {
  return isStage3ActiveInstrument(instrument) ? "ACTIVE" : "OUT_OF_SCOPE";
}

/** Resolve/precheck field status (only APPROVED active values become VERIFIED). */
export type RiskPolicyFieldStatus =
  | "VERIFIED"
  | "NOT_CONFIGURED"
  | "INVALID"
  | "UNAVAILABLE";

/** Stage 4 approval workflow status for a limit slot. */
export type RiskLimitApprovalState =
  | "NOT_CONFIGURED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "INVALID";

export type SlippageBasis = "entry_vs_executable";

export type RiskPolicyAuditAction =
  | "CREATE_EMPTY"
  | "SET_SPREAD"
  | "CLEAR_SPREAD"
  | "SET_SLIPPAGE"
  | "CLEAR_SLIPPAGE"
  | "REJECT_INVALID"
  | "PROPOSE_SPREAD"
  | "PROPOSE_SLIPPAGE"
  | "APPROVE_SPREAD"
  | "APPROVE_SLIPPAGE"
  | "REJECT_SPREAD"
  | "REJECT_SLIPPAGE"
  | "CLEAR_PROPOSED_SPREAD"
  | "CLEAR_PROPOSED_SLIPPAGE"
  | "ROLLBACK_SPREAD"
  | "ROLLBACK_SLIPPAGE";

export interface RiskPolicyAuditEntry {
  atUtc: string;
  actor: string;
  action: RiskPolicyAuditAction;
  instrument: string | null;
  kind?: "spread" | "slippage" | null;
  detail: string;
  previousValue: number | null;
  nextValue: number | null;
  policyVersion: number | null;
  configVersion: number | null;
}

export interface RiskLimitProposal {
  value: number;
  units: "absolute_price";
  pricePrecision: number | null;
  proposedAtUtc: string;
  proposedBy: string;
  note: string | null;
}

/** Snapshot of a previously approved active value (for rollback). */
export interface RiskLimitApprovedRevision {
  value: number;
  units: "absolute_price";
  pricePrecision: number | null;
  approvedAtUtc: string;
  approvedBy: string;
  configVersion: number;
  documentVersion: number;
}

export interface InstrumentSpreadPolicy {
  instrument: string;
  /** Active approved absolute spread limit. Null until APPROVED. */
  maxSpreadAbsolute: number | null;
  units: "absolute_price";
  pricePrecision: number | null;
  /** Resolve status: VERIFIED only when approvalState=APPROVED and value valid. */
  status: RiskPolicyFieldStatus;
  approvalState: RiskLimitApprovalState;
  reason: string | null;
  configVersion: number;
  createdAtUtc: string;
  updatedAtUtc: string;
  approvedAtUtc: string | null;
  approvedBy: string | null;
  effectiveAtUtc: string | null;
  proposed: RiskLimitProposal | null;
  history: RiskLimitApprovedRevision[];
}

export interface InstrumentSlippagePolicy {
  instrument: string;
  maxSlippageAbsolute: number | null;
  units: "absolute_price";
  basis: SlippageBasis;
  pricePrecision: number | null;
  status: RiskPolicyFieldStatus;
  approvalState: RiskLimitApprovalState;
  reason: string | null;
  configVersion: number;
  createdAtUtc: string;
  updatedAtUtc: string;
  approvedAtUtc: string | null;
  approvedBy: string | null;
  effectiveAtUtc: string | null;
  proposed: RiskLimitProposal | null;
  history: RiskLimitApprovedRevision[];
}

export interface InstrumentRiskPolicy {
  instrument: string;
  /** Documented absolute-price precision guidance (never used as invented limit). */
  documentedPricePrecision: number | null;
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
  approvalState: RiskLimitApprovalState | null;
  reason: string | null;
  instrument: string | null;
  configVersion: number | null;
}

export interface ResolvedSlippageLimit {
  value: number | null;
  source: "request" | "instrument_policy" | null;
  status: RiskPolicyFieldStatus;
  approvalState: RiskLimitApprovalState | null;
  reason: string | null;
  instrument: string | null;
  basis: SlippageBasis;
  configVersion: number | null;
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

/** Documented precision guidance for tracked instruments (display/docs only). */
export const INSTRUMENT_PRICE_PRECISION_GUIDANCE: Record<Stage3TrackedInstrument, number> = {
  "EUR/USD": 5,
  "GBP/USD": 5,
  "USD/JPY": 3,
  "XAU/USD": 2,
};
