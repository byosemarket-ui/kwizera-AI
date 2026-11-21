/**
 * Shared adapter helpers — never invent market values.
 */
import { MIF_PROVIDER_ID, type MifCandleState } from "../../canonical/types.js";
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import {
  MIF_MARKET_EVIDENCE_MAX_LEVELS,
  MIF_MARKET_EVIDENCE_MAX_MEASUREMENTS,
  MIF_MARKET_EVIDENCE_MAX_REFS,
  MIF_MARKET_EVIDENCE_MAX_WARNINGS,
  MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_ID,
  MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_VERSION,
} from "../contracts.js";
import { buildEvidenceId, hashEvidencePayload } from "../identity.js";
import type {
  MifEvidenceConfidenceType,
  MifEvidenceDirection,
  MifEvidenceLevel,
  MifEvidenceMeasurement,
  MifEvidenceScore,
  MifEvidenceType,
  MifUnifiedMarketEvidence,
} from "../types.js";
import { assertValidEvidenceOrThrow } from "../validate.js";

export interface BuildEvidenceInput {
  sourceEngine: string;
  engineVersion: string;
  evidenceType: MifEvidenceType;
  providerSymbol: string;
  timeframe: string | null;
  instrument?: MifCanonicalInstrument | null;
  direction: MifEvidenceDirection;
  eventTime: string | null;
  observedAt: string;
  candleStatus: MifCandleState | null;
  levels?: readonly MifEvidenceLevel[];
  measurements?: readonly MifEvidenceMeasurement[];
  supportingEvidenceIds?: readonly string[];
  conflictingEvidenceIds?: readonly string[];
  warnings?: readonly string[];
  limitations?: readonly string[];
  validFrom?: string | null;
  validUntil?: string | null;
  score: Omit<MifEvidenceScore, "confidenceType"> & {
    confidenceType: MifEvidenceConfidenceType;
  };
  analysisId?: string | null;
  signalId?: string | null;
  sourceAssessmentId?: string | null;
  sourceInputIdentity?: string | null;
  sourceContractId?: string | null;
  sourceContractVersion?: string | null;
  sourceCandidateId?: string | null;
  runId?: string | null;
  snapshotId?: string | null;
  snapshotIdSourceVerified?: boolean;
  datasetId?: string | null;
  contentHash?: string | null;
  /** Raw source slice used for fingerprint — must not invent fields. */
  fingerprintSource: unknown;
}

function clipArr<T>(arr: readonly T[] | undefined, max: number): T[] {
  return (arr ?? []).slice(0, max);
}

export function mapBuySellToDirection(
  d: string | null | undefined,
): MifEvidenceDirection {
  const u = String(d ?? "").toUpperCase();
  if (u === "BUY" || u === "BULLISH" || u === "UP") return "BULLISH";
  if (u === "SELL" || u === "BEARISH" || u === "DOWN") return "BEARISH";
  return "NEUTRAL";
}

export function buildUnifiedEvidence(input: BuildEvidenceInput): MifUnifiedMarketEvidence {
  const sourceFingerprint = hashEvidencePayload(input.fingerprintSource);
  const snapshotId = input.snapshotId ?? null;
  const snapshotIdSourceVerified =
    snapshotId == null ? false : input.snapshotIdSourceVerified === true;
  const evidenceId = buildEvidenceId({
    sourceEngine: input.sourceEngine,
    evidenceType: input.evidenceType,
    providerSymbol: input.providerSymbol,
    timeframe: input.timeframe,
    sourceAssessmentId: input.sourceAssessmentId ?? null,
    sourceCandidateId: input.sourceCandidateId ?? null,
    sourceFingerprint,
    snapshotId,
  });

  const item: MifUnifiedMarketEvidence = {
    contractId: MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_ID,
    contractVersion: MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_VERSION,
    evidenceId,
    signalId: input.signalId ?? null,
    analysisId: input.analysisId ?? null,
    sourceEngine: input.sourceEngine,
    engineVersion: input.engineVersion,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: input.providerSymbol,
    timeframe: input.timeframe,
    instrument: input.instrument ?? null,
    evidenceType: input.evidenceType,
    direction: input.direction,
    eventTime: input.eventTime,
    observedAt: input.observedAt,
    candleStatus: input.candleStatus,
    levels: clipArr(input.levels, MIF_MARKET_EVIDENCE_MAX_LEVELS),
    measurements: clipArr(input.measurements, MIF_MARKET_EVIDENCE_MAX_MEASUREMENTS),
    supportingEvidenceIds: clipArr(
      input.supportingEvidenceIds,
      MIF_MARKET_EVIDENCE_MAX_REFS,
    ),
    conflictingEvidenceIds: clipArr(
      input.conflictingEvidenceIds,
      MIF_MARKET_EVIDENCE_MAX_REFS,
    ),
    warnings: clipArr(input.warnings, MIF_MARKET_EVIDENCE_MAX_WARNINGS),
    limitations: clipArr(input.limitations, MIF_MARKET_EVIDENCE_MAX_WARNINGS),
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    score: {
      confidenceType: input.score.confidenceType,
      value: input.score.value,
      scale: input.score.scale,
      isWinProbability: input.score.isWinProbability,
      isCalibratedPrediction: input.score.isCalibratedPrediction,
      calibrationStatus: input.score.calibrationStatus,
      reliabilityStatus: input.score.reliabilityStatus,
      definition: input.score.definition,
    },
    provenance: {
      sourceAssessmentId: input.sourceAssessmentId ?? null,
      sourceInputIdentity: input.sourceInputIdentity ?? null,
      sourceContractId: input.sourceContractId ?? null,
      sourceContractVersion: input.sourceContractVersion ?? null,
      sourceCandidateId: input.sourceCandidateId ?? null,
      runId: input.runId ?? null,
      snapshotId,
      datasetId: input.datasetId ?? null,
      contentHash: input.contentHash ?? null,
      sourceFingerprint,
      snapshotIdSourceVerified,
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalEvidenceOnly: true,
    notExecutable: true,
  };
  assertValidEvidenceOrThrow(item);
  return item;
}
