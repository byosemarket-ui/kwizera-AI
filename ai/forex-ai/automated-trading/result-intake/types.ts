/**
 * Phase 4.18G.1 — AI Analysis Result Intake & Decision Understanding.
 * Receives validated canonical analysis results. Never places broker orders.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import type {
  AnalysisConfidenceBreakdown,
  AnalysisFinalOutcome,
  CanonicalMarketDirection,
} from "../analysis/canonical-analysis.types.js";
import { ANALYSIS_CONFIDENCE_TYPE } from "../analysis/canonical-analysis.types.js";

export const AT_RESULT_INTAKE_SCHEMA = "at-analysis-result-intake-v1" as const;
export const AT_RESULT_INTAKE_PHASE = "4.18G.1" as const;
export const AT_RESULT_INTAKE_MAX_HISTORY = 80;
/** Default expiry for order-prep handoff eligibility (analysis age). */
export const AT_RESULT_INTAKE_DEFAULT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** Intake lifecycle — separate from analysis lifecycle (ANALYSIS_VALID, …). */
export type AtResultIntakeLifecycle =
  | "RECEIVED"
  | "VALIDATING"
  | "ACCEPTED"
  | "REJECTED"
  | "QUARANTINED"
  | "DUPLICATE"
  | "SUPERSEDED"
  | "EXPIRED";

/** Dashboard / operator decision label. */
export type AtResultDecision = "BUY" | "SELL" | "NO_TRADE";

export type AtResultValidationStatus =
  | "VALID"
  | "INVALID_SCHEMA"
  | "MISSING_IDENTITY"
  | "INVALID_DIRECTION"
  | "INVALID_CONFIDENCE"
  | "INVALID_OBSERVATION"
  | "INVALID_IMAGE"
  | "IMAGE_HASH_MISMATCH"
  | "STALE_ANALYSIS"
  | "SEMANTIC_FAILURE"
  | "RECONCILIATION_FAILURE"
  | "DUPLICATE"
  | "SYSTEM_MASTER_OFF"
  | "CALIBRATION_CLAIM_REJECTED";

export interface AtResultIntakeEnrichment {
  observationId?: string | null;
  imageId?: string | null;
  imageHash?: string | null;
  imageSource?: string | null;
  imageDeliveryStatus?: string | null;
  includedImageBytesInRequest?: boolean | null;
  /** Expected hash to verify against imageHash (optional). */
  expectedImageHash?: string | null;
  modelIdentifier?: string | null;
  openaiLifecycle?: string | null;
  timeframeCoverage?: string[] | null;
  supportingEvidence?: string[] | null;
  conflictingEvidence?: string[] | null;
  invalidationConditions?: string[] | null;
}

export interface AtResultIntakeRecord {
  schemaVersion: typeof AT_RESULT_INTAKE_SCHEMA;
  phase: typeof AT_RESULT_INTAKE_PHASE;
  resultId: string;
  /** Stable idempotency key — same analysis must not create a second independent result. */
  idempotencyKey: string;
  analysisId: string;
  observationId: string | null;
  imageId: string | null;
  imageHash: string | null;
  instrument: string;
  provider: "FOREXCONNECT";
  environment: AutomatedTradingEnvironment;
  modelIdentifier: string | null;
  primaryTimeframe: string;
  timeframeCoverage: string[];
  analyzedAtUtc: string;
  receivedAtUtc: string;

  /** Operator-facing decision (BUY|SELL|NO_TRADE). */
  decision: AtResultDecision;
  /** Authoritative canonical outcome (may be STALE_DATA, CONFLICT, …). */
  canonicalOutcome: AnalysisFinalOutcome;
  aiDirection: CanonicalMarketDirection | null;
  strategyDirection: "BUY" | "SELL" | "NO_TRADE" | null;
  canonicalDecision: CanonicalMarketDirection | "NO_TRADE";
  reconciliationStatus: string;
  validationStatus: AtResultValidationStatus;
  intakeLifecycle: AtResultIntakeLifecycle;

  directionalConfidencePct: number | null;
  confidenceType: typeof ANALYSIS_CONFIDENCE_TYPE;
  isCalibratedWinProbability: false;
  confidenceBreakdown: AnalysisConfidenceBreakdown | null;
  confidenceLimitations: string[];

  analysisReasons: string[];
  supportingEvidence: string[];
  conflictingEvidence: string[];
  marketTrend: string | null;
  marketMomentum: string | null;
  volatility: string | null;
  mtfAlignment: string | null;
  marketStructure: string | null;
  invalidationConditions: string[];
  sourceProvenance: string[];

  imageSource: string | null;
  imageDeliveryStatus: string | null;
  includedImageBytesInRequest: boolean | null;
  observationCorrelated: boolean | null;
  imageHashVerified: boolean | null;

  noTradeReason: string | null;
  rejectionReason: string | null;
  supersededByResultId: string | null;
  supersedesResultId: string | null;
  expiresAtUtc: string | null;
  /** True only for ACCEPTED canonical BUY/SELL — never for NO_TRADE/STALE/… */
  eligibleForOrderPreparation: boolean;

  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

/** Read-only handoff for the next risk/order-construction stage. */
export interface AtOrderPreparationHandoff {
  acceptedResultId: string;
  analysisId: string;
  instrument: string;
  canonicalDirection: CanonicalMarketDirection;
  directionalConfidencePct: number | null;
  confidenceType: typeof ANALYSIS_CONFIDENCE_TYPE;
  isCalibratedWinProbability: false;
  observationId: string | null;
  imageId: string | null;
  imageHash: string | null;
  analyzedAtUtc: string;
  resultExpiresAtUtc: string | null;
  validationStatus: AtResultValidationStatus;
  intakeLifecycle: "ACCEPTED";
  evidenceReferences: {
    reconciliationStatus: string;
    canonicalOutcome: AnalysisFinalOutcome;
    primaryTimeframe: string;
    mtfAlignment: string | null;
  };
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}

export interface AtResultIntakePublicStatus {
  phase: typeof AT_RESULT_INTAKE_PHASE;
  schemaVersion: typeof AT_RESULT_INTAKE_SCHEMA;
  latest: AtResultIntakeRecord | null;
  historyCount: number;
  acceptedDirectionalCount: number;
  latestHandoff: AtOrderPreparationHandoff | null;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}

export interface AtResultIntakeStoreFile {
  schemaVersion: typeof AT_RESULT_INTAKE_SCHEMA;
  phase: typeof AT_RESULT_INTAKE_PHASE;
  latestId: string | null;
  byIdempotencyKey: Record<string, string>;
  history: AtResultIntakeRecord[];
}
