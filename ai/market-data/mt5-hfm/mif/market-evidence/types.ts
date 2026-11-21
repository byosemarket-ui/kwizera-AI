/**
 * Phase 2 — Unified Market Evidence types (HFM_MT5 only).
 */
import type { MifCanonicalInstrument } from "../canonical/instrument.js";
import type { MifCandleState, MifProviderId, MifSafetyFlags } from "../canonical/types.js";
import type {
  MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_ID,
  MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_VERSION,
  MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_ID,
  MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_VERSION,
} from "./contracts.js";

export type MifEvidenceDirection = "BULLISH" | "BEARISH" | "NEUTRAL";

/**
 * Confidence semantics — never silently convert ranking into win probability.
 * TRADE_OUTCOME_PROBABILITY requires calibration/reliability metadata when present.
 */
export type MifEvidenceConfidenceType =
  | "DATA_CONFIDENCE"
  | "PATTERN_CONFIDENCE"
  | "STRUCTURE_CONFIDENCE"
  | "SETUP_QUALITY"
  | "DIRECTIONAL_PROBABILITY"
  | "TRADE_OUTCOME_PROBABILITY"
  | "ENGINE_SPECIFIC"
  | "NONE";

export type MifEvidenceRelationKind =
  | "EXACT_DUPLICATE"
  | "RELATED"
  | "SUPPORTING"
  | "CONFLICTING"
  | "STALE"
  | "MISSING"
  | "INVALID"
  | "UNRELATED";

export type MifEvidenceType =
  | "DATA_QUALITY"
  | "FIBONACCI"
  | "CHART_PATTERN"
  | "HARMONIC_PATTERN"
  | "MARKET_REGIME"
  | "MTF_RELATIONSHIP"
  | "MARKET_STRUCTURE"
  | "STRUCTURE_EVENT"
  | "SUPPORT_RESISTANCE"
  | "LIQUIDITY_REFERENCE"
  | "MOMENTUM"
  | "PRICE_DISPLACEMENT"
  | "STRATEGY_ELIGIBILITY"
  | "OPPORTUNITY_CANDIDATE"
  | "PRODUCTION_PIPELINE"
  | "OPPORTUNITY_RANKING"
  | "PROBABILITY_INTELLIGENCE"
  | "DIALECT_LIMITATION"
  | "OTHER";

export interface MifEvidenceLevel {
  id: string;
  kind: string;
  price: number | null;
  side: "HIGH" | "LOW" | "MID" | "ZONE" | "OTHER" | null;
  note: string | null;
}

export interface MifEvidenceMeasurement {
  id: string;
  name: string;
  value: number | string | boolean | null;
  unit: string | null;
  note: string | null;
}

export interface MifEvidenceScore {
  confidenceType: MifEvidenceConfidenceType;
  /** Numeric score when the source provides one; null when absent. */
  value: number | null;
  /** Scale documentation from source (e.g. "0-100 setup quality"). */
  scale: string | null;
  /** Explicit: this score is never a win probability unless type says so + flags. */
  isWinProbability: boolean;
  isCalibratedPrediction: boolean | null;
  calibrationStatus: string | null;
  reliabilityStatus: string | null;
  definition: string;
}

export interface MifEvidenceProvenance {
  sourceAssessmentId: string | null;
  sourceInputIdentity: string | null;
  sourceContractId: string | null;
  sourceContractVersion: string | null;
  sourceCandidateId: string | null;
  runId: string | null;
  snapshotId: string | null;
  datasetId: string | null;
  contentHash: string | null;
  /** Opaque original payload fingerprint for exact-duplicate detection. */
  sourceFingerprint: string;
  /** True when snapshotId was provided by the source (not fabricated). */
  snapshotIdSourceVerified: boolean;
}

export interface MifUnifiedMarketEvidence extends MifSafetyFlags {
  contractId: typeof MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_ID;
  contractVersion: typeof MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_VERSION;
  evidenceId: string;
  signalId: string | null;
  analysisId: string | null;
  sourceEngine: string;
  engineVersion: string;
  providerId: MifProviderId;
  providerSymbol: string;
  timeframe: string | null;
  instrument: MifCanonicalInstrument | null;
  evidenceType: MifEvidenceType;
  direction: MifEvidenceDirection;
  eventTime: string | null;
  observedAt: string;
  candleStatus: MifCandleState | null;
  levels: readonly MifEvidenceLevel[];
  measurements: readonly MifEvidenceMeasurement[];
  supportingEvidenceIds: readonly string[];
  conflictingEvidenceIds: readonly string[];
  warnings: readonly string[];
  limitations: readonly string[];
  validFrom: string | null;
  validUntil: string | null;
  score: MifEvidenceScore;
  provenance: MifEvidenceProvenance;
  doesNotApproveAiReasoning: true;
  analyticalEvidenceOnly: true;
  notExecutable: true;
}

export interface MifEvidenceRelation {
  kind: MifEvidenceRelationKind;
  leftEvidenceId: string;
  rightEvidenceId: string;
  reason: string;
}

export interface MifMarketEvidencePackage extends MifSafetyFlags {
  contractId: typeof MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_ID;
  contractVersion: typeof MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_VERSION;
  packageId: string;
  analysisId: string | null;
  runId: string | null;
  snapshotId: string | null;
  snapshotIdSourceVerified: boolean;
  providerId: MifProviderId;
  providerSymbol: string;
  assembledAt: string;
  items: readonly MifUnifiedMarketEvidence[];
  relations: readonly MifEvidenceRelation[];
  droppedDuplicateCount: number;
  warnings: readonly string[];
  limitations: readonly string[];
  doesNotApproveAiReasoning: true;
  analyticalEvidencePackageOnly: true;
  notExecutable: true;
}

export interface MifEvidenceValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}
