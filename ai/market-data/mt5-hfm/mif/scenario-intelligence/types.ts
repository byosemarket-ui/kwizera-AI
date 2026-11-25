/**
 * Phase 4 — Scenario Intelligence types.
 * Presentation statuses map to existing MIF lifecycle; this is not a second FSM.
 */
import type { MifSafetyFlags } from "../canonical/types.js";
import type { MifCandidateLifecycleState } from "../production-integration/persistence/types.js";
import type {
  MIF_SCENARIO_INTELLIGENCE_CONTRACT_ID,
  MIF_SCENARIO_INTELLIGENCE_CONTRACT_VERSION,
  MIF_SCENARIO_PACKAGE_CONTRACT_ID,
  MIF_SCENARIO_PACKAGE_CONTRACT_VERSION,
} from "./contracts.js";

/** Presentation-level scenario status (maps to existing lifecycle). */
export type MifScenarioPresentationStatus =
  | "OBSERVING"
  | "DEVELOPING"
  | "WAITING_FOR_CONFIRMATION"
  | "CONFIRMED"
  | "INVALIDATED"
  | "EXPIRED"
  | "INSUFFICIENT";

export type MifScenarioDirection = "BULLISH" | "BEARISH";

export type MifScenarioPackageOutcome =
  | "BULLISH_PREFERRED"
  | "BEARISH_PREFERRED"
  | "BALANCED_CONFLICT"
  | "NO_QUALIFIED_OPPORTUNITY";

export type MifScenarioLevelStatus =
  | "AVAILABLE_FROM_SOURCE"
  | "LEVELS_PARTIAL"
  | "LEVELS_NOT_PROVIDED"
  | "LEVELS_INVALID_GEOMETRY"
  | "NOT_APPLICABLE";

export interface MifScenarioLevel {
  kind: "ENTRY" | "INVALIDATION" | "TARGET" | "STOP_REFERENCE";
  price: number | null;
  side: "ABOVE" | "BELOW" | "AT" | null;
  provenance: string | null;
  source: "CANDIDATE_NOTES" | "EVIDENCE" | "NONE";
}

export interface MifScenarioLevels {
  status: MifScenarioLevelStatus;
  entry: MifScenarioLevel | null;
  invalidation: MifScenarioLevel | null;
  targets: readonly MifScenarioLevel[];
  /** Null when entry/invalidation/target incomplete — never fabricated. */
  riskReward: number | null;
  notes: readonly string[];
}

export interface MifScenarioTimeframeContext {
  expectedTimeframes: readonly string[];
  presentTimeframes: readonly string[];
  missingTimeframes: readonly string[];
  tipStates: Readonly<Record<string, string>>;
  higherTimeframeContext: readonly string[];
  intermediateStructure: readonly string[];
  lowerTimeframeFormation: readonly string[];
  conflictNotes: readonly string[];
}

export interface MifDirectionalScenario extends MifSafetyFlags {
  scenarioId: string;
  setupFingerprint: string;
  side: MifScenarioDirection;
  providerId: "HFM_MT5";
  providerSymbol: string;
  /** Presentation status — mapped from existing lifecycle, not a parallel FSM. */
  status: MifScenarioPresentationStatus;
  /** Existing MIF persistence lifecycle state this presentation maps to. */
  lifecycleState: MifCandidateLifecycleState;
  thesis: string;
  rationale: string;
  supportingEvidenceIds: readonly string[];
  conflictingEvidenceIds: readonly string[];
  missingConfirmations: readonly string[];
  invalidationConditions: readonly string[];
  contributingCandidateIds: readonly string[];
  contributingStrategyIds: readonly string[];
  levels: MifScenarioLevels;
  evidenceCompleteness: {
    supportingCount: number;
    conflictingCount: number;
    uniqueAssessmentCount: number;
    incompleteEvidence: boolean;
    formingOnlyConfirmationBlocked: boolean;
    trustedConfirmed: boolean;
  };
  warnings: readonly string[];
  assessmentTimestamp: string;
  snapshotId: string | null;
  snapshotIdSourceVerified: boolean;
  analyticalScenarioOnly: true;
  notExecutable: true;
  doesNotApproveAiReasoning: true;
}

export interface MifScenarioPackage extends MifSafetyFlags {
  contractId: typeof MIF_SCENARIO_PACKAGE_CONTRACT_ID;
  contractVersion: typeof MIF_SCENARIO_PACKAGE_CONTRACT_VERSION;
  engineId: string;
  engineVersion: string;
  packageId: string;
  providerId: "HFM_MT5";
  providerSymbol: string;
  snapshotId: string | null;
  snapshotHash: string | null;
  snapshotIdSourceVerified: boolean;
  assessmentTimestamp: string;
  bullishScenario: MifDirectionalScenario;
  bearishScenario: MifDirectionalScenario;
  outcome: MifScenarioPackageOutcome;
  strongerSide: MifScenarioDirection | null;
  comparisonExplanation: string;
  timeframeContext: MifScenarioTimeframeContext;
  warnings: readonly string[];
  completenessTrusted: boolean;
  analyticalPackageOnly: true;
  notExecutable: true;
  doesNotApproveAiReasoning: true;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

export interface MifScenarioIntelligenceResult extends MifSafetyFlags {
  contractId: typeof MIF_SCENARIO_INTELLIGENCE_CONTRACT_ID;
  contractVersion: typeof MIF_SCENARIO_INTELLIGENCE_CONTRACT_VERSION;
  package: MifScenarioPackage;
  timingsMs: { buildMs: number; totalMs: number };
  analyticalOnly: true;
  notExecutable: true;
}
