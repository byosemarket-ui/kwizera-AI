/**
 * Phase 5D Step 1 — Strategy Intelligence Foundation types
 * (kwizera.mif.strategy-intelligence.v1).
 *
 * Registry metadata only — does not create opportunities or trade signals.
 */
import type { MifProviderId, MifSafetyFlags } from "../canonical/types.js";
import type { MifRegimeDirection, MifRegimeStructure, MifRegimeVolatility } from "../analysis/regime/types.js";
import type { MifStrategyIntelligenceReasonCode } from "./codes.js";
import type {
  MIF_STRATEGY_INTELLIGENCE_CONTRACT_ID,
  MIF_STRATEGY_INTELLIGENCE_CONTRACT_VERSION,
} from "./contracts.js";

export type MifStrategyId =
  | "TREND_CONTINUATION"
  | "PULLBACK"
  | "REVERSAL"
  | "BREAKOUT"
  | "BREAKOUT_RETEST"
  | "RANGE"
  | "LIQUIDITY_SWEEP"
  | "SUPPLY_DEMAND"
  | "MOMENTUM_EXPANSION"
  | "PATTERN_COMPLETION";

export type MifStrategyCategory =
  | "TREND_FOLLOWING"
  | "COUNTERTREND"
  | "BREAKOUT"
  | "RANGE"
  | "LIQUIDITY"
  | "SUPPLY_DEMAND"
  | "MOMENTUM"
  | "PATTERN_BASED";

export type MifStrategyLifecycleStatus = "DRAFT" | "ACTIVE" | "DISABLED" | "DEPRECATED";

export type MifTimeframeRole =
  | "MACRO_CONTEXT"
  | "MAJOR_CONTEXT"
  | "PRIMARY_DIRECTION"
  | "INTERMEDIATE_STRUCTURE"
  | "SETUP_DEVELOPMENT"
  | "OPPORTUNITY_FORMATION"
  | "LOWER_TIMEFRAME_CONFIRMATION"
  | "OPTIONAL_ENTRY_REFINEMENT";

export type MifEvidenceFamily =
  | "MARKET_STRUCTURE"
  | "MARKET_REGIME"
  | "MULTI_TIMEFRAME_RELATIONSHIP"
  | "FIBONACCI"
  | "GEOMETRIC_PATTERN"
  | "HARMONIC_PATTERN"
  | "SUPPORT_RESISTANCE"
  | "LIQUIDITY_REFERENCE"
  | "PRICE_DISPLACEMENT"
  | "MOMENTUM"
  | "VOLATILITY"
  | "RANGE_STRUCTURE"
  | "CANDLE_CONFIRMATION"
  | "DATA_QUALITY";

/**
 * Upstream availability relative to the current MIF implementation.
 * - AVAILABLE: Phase 5C engine exists and can supply this family.
 * - PARTIAL: related evidence exists but not as a dedicated first-class source.
 * - PLANNED: deferred to a later Phase 5D detector/step — do not fabricate.
 * - UNSUPPORTED: not available and must not be required for ACTIVE strategies
 *   unless marked optional with missingAffects=ignore.
 */
export type MifEvidenceAvailability = "AVAILABLE" | "PARTIAL" | "PLANNED" | "UNSUPPORTED";

export type MifEvidenceRequirementMode = "REQUIRED" | "OPTIONAL";

export type MifEvidenceMissingEffect =
  | "INELIGIBLE"
  | "INSUFFICIENT_EVIDENCE"
  | "WARNING"
  | "IGNORE";

export type MifEvidencePresence =
  | "PRESENT"
  | "ABSENT"
  | "UNKNOWN"
  | "INVALID"
  | "UNSUPPORTED";

export type MifStrategyEligibilityStatus =
  | "ELIGIBLE_FOR_DETECTION"
  | "INELIGIBLE"
  | "INSUFFICIENT_EVIDENCE"
  | "BLOCKED_BY_DATA_QUALITY"
  | "DISABLED"
  | "DEPRECATED"
  | "DRAFT";

export interface MifStrategyEvidenceRequirement {
  evidenceId: string;
  family: MifEvidenceFamily;
  mode: MifEvidenceRequirementMode;
  /** Expected upstream engine/contract id when available. */
  expectedSourceEngine: string | null;
  expectedSourceContractId: string | null;
  availability: MifEvidenceAvailability;
  timeframeRoles: readonly MifTimeframeRole[];
  /** Minimum acceptable analytical quality for this evidence. */
  minQualityStatuses: readonly ("VALID" | "WARNING" | "DEGRADED")[];
  requireClosedCandle: boolean;
  allowUnknown: boolean;
  missingAffects: MifEvidenceMissingEffect;
  notes: string;
}

export interface MifStrategyRegimeCompatibility {
  /** Empty = any direction (still must be present if MARKET_REGIME required). */
  directions: readonly MifRegimeDirection[];
  structures: readonly MifRegimeStructure[];
  volatilities: readonly MifRegimeVolatility[];
  /** When true, UNKNOWN direction/structure fails compatibility. */
  rejectUnknown: boolean;
  notes: string;
}

export interface MifStrategyTimeframeRoleRequirement {
  role: MifTimeframeRole;
  mode: MifEvidenceRequirementMode;
  /** Canonical TFs typically mapped to this role (documentation). */
  typicalTimeframes: readonly string[];
  notes: string;
}

export interface MifStrategyConfirmationRequirement {
  confirmationId: string;
  description: string;
  requireClosedCandle: boolean;
  notes: string;
}

export interface MifStrategyInvalidationRequirement {
  invalidationId: string;
  description: string;
  notes: string;
}

export interface MifStrategyDefinition {
  strategyId: MifStrategyId;
  name: string;
  description: string;
  categories: readonly MifStrategyCategory[];
  definitionVersion: string;
  policyVersion: string;
  lifecycleStatus: MifStrategyLifecycleStatus;
  purpose: string;
  requiredEvidence: readonly MifStrategyEvidenceRequirement[];
  optionalEvidence: readonly MifStrategyEvidenceRequirement[];
  regimeCompatibility: MifStrategyRegimeCompatibility;
  timeframeRoles: readonly MifStrategyTimeframeRoleRequirement[];
  confirmations: readonly MifStrategyConfirmationRequirement[];
  invalidations: readonly MifStrategyInvalidationRequirement[];
  dataQualityMinStatus: "VALID" | "WARNING";
  knownLimitations: readonly string[];
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
  /** Explicit: eligibility ≠ opportunity / signal / trade. */
  doesNotCreateOpportunities: true;
}

export interface MifStrategyDefinitionValidation {
  ok: boolean;
  errors: string[];
}

export interface MifStrategyEvidenceSummaryItem {
  evidenceId: string;
  family: MifEvidenceFamily;
  presence: MifEvidencePresence;
  qualityStatus: "VALID" | "WARNING" | "DEGRADED" | "BLOCKED" | "MISSING" | "UNKNOWN";
  closedCandleSatisfied: boolean | null;
  sourceAssessmentId: string | null;
  sourceContractId: string | null;
  notes?: string;
}

export interface MifStrategyEvidenceSummary {
  providerSymbol: string;
  /** Overall data-quality gate for the evaluation context. */
  dataQualityStatus: "VALID" | "WARNING" | "DEGRADED" | "BLOCKED" | "MISSING";
  regimeDirection?: MifRegimeDirection | null;
  regimeStructure?: MifRegimeStructure | null;
  regimeVolatility?: MifRegimeVolatility | null;
  /** Roles for which at least one usable timeframe context is present. */
  availableTimeframeRoles?: readonly MifTimeframeRole[];
  evidence: readonly MifStrategyEvidenceSummaryItem[];
}

export interface MifStrategyRequirementEvaluation {
  evidenceId: string;
  family: MifEvidenceFamily;
  mode: MifEvidenceRequirementMode;
  outcome: "SATISFIED" | "MISSING" | "FAILED" | "UNSUPPORTED" | "UNKNOWN";
  message: string;
}

export interface MifStrategyEligibilityResult extends MifSafetyFlags {
  contractId: typeof MIF_STRATEGY_INTELLIGENCE_CONTRACT_ID;
  contractVersion: typeof MIF_STRATEGY_INTELLIGENCE_CONTRACT_VERSION;
  strategyId: MifStrategyId | string;
  definitionVersion: string | null;
  policyVersion: string | null;
  status: MifStrategyEligibilityStatus;
  satisfied: MifStrategyRequirementEvaluation[];
  missing: MifStrategyRequirementEvaluation[];
  failed: MifStrategyRequirementEvaluation[];
  unsupported: MifStrategyRequirementEvaluation[];
  warnings: string[];
  reasonCodes: MifStrategyIntelligenceReasonCode[];
  explanation: string;
  doesNotApproveAiReasoning: true;
  doesNotCreateOpportunities: true;
  eligibleForDetectionOnly: true;
}

export interface MifStrategyRegistryDiagnostics {
  catalogVersion: string;
  strategyCount: number;
  activeCount: number;
  draftCount: number;
  disabledCount: number;
  deprecatedCount: number;
  validationOk: boolean;
  validationErrors: string[];
  overallStatusReason: string;
}
