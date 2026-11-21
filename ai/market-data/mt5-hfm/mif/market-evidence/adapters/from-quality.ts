import type { MifStep1DataIntegrityAssessment } from "../../quality/types.js";
import type { MifUnifiedQualityAssessment } from "../../quality/unified/types.js";
import type { MifUnifiedMarketEvidence } from "../types.js";
import { buildUnifiedEvidence } from "./common.js";

export function adaptDataIntegrityToEvidence(
  assessment: MifStep1DataIntegrityAssessment,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  return buildUnifiedEvidence({
    sourceEngine: assessment.engineId,
    engineVersion: assessment.engineVersion,
    evidenceType: "DATA_QUALITY",
    providerSymbol: assessment.providerSymbol,
    timeframe: assessment.timeframe,
    direction: "NEUTRAL",
    eventTime: assessment.assessmentTimestamp,
    observedAt: assessment.assessmentTimestamp,
    candleStatus: null,
    warnings: assessment.findings.map((f) => `${f.code}:${f.severity}`).slice(0, 40),
    limitations: [
      "Step1 data integrity only — not trade approval",
      ...(assessment.doesNotApproveAiReasoning ? ["doesNotApproveAiReasoning"] : []),
    ],
    score: {
      confidenceType: "DATA_CONFIDENCE",
      value: null,
      scale: `status=${assessment.status}`,
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Data integrity status — not a win probability or setup score",
    },
    measurements: [
      { id: "status", name: "status", value: assessment.status, unit: null, note: null },
      {
        id: "orderingValid",
        name: "orderingValid",
        value: assessment.orderingValid,
        unit: null,
        note: null,
      },
    ],
    analysisId: opts?.analysisId ?? null,
    runId: opts?.runId ?? null,
    snapshotId: opts?.snapshotId ?? null,
    snapshotIdSourceVerified: opts?.snapshotId != null,
    sourceAssessmentId: assessment.assessmentId,
    sourceInputIdentity: assessment.inputIdentity,
    sourceContractId: assessment.contractId,
    sourceContractVersion: assessment.contractVersion,
    fingerprintSource: {
      kind: "step1-integrity",
      assessmentId: assessment.assessmentId,
      inputIdentity: assessment.inputIdentity,
      status: assessment.status,
    },
  });
}

export function adaptUnifiedQualityToEvidence(
  assessment: MifUnifiedQualityAssessment,
  opts?: {
    analysisId?: string | null;
    runId?: string | null;
    snapshotId?: string | null;
    providerSymbol?: string;
    timeframe?: string | null;
  },
): MifUnifiedMarketEvidence {
  return buildUnifiedEvidence({
    sourceEngine: "mif-unified-quality",
    engineVersion: assessment.contractVersion,
    evidenceType: "DATA_QUALITY",
    providerSymbol: opts?.providerSymbol ?? "UNKNOWN",
    timeframe: opts?.timeframe ?? null,
    direction: "NEUTRAL",
    eventTime: assessment.assessmentTimestamp,
    observedAt: assessment.assessmentTimestamp,
    candleStatus: null,
    warnings: (assessment.findings ?? []).map((f) => String(f.code ?? f)).slice(0, 40),
    limitations: ["Unified quality assessment — not trade approval"],
    score: {
      confidenceType: "DATA_CONFIDENCE",
      value: null,
      scale: `status=${assessment.status}`,
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Unified quality status — not a win probability",
    },
    measurements: [
      { id: "status", name: "status", value: assessment.status, unit: null, note: null },
    ],
    analysisId: opts?.analysisId ?? null,
    runId: opts?.runId ?? null,
    snapshotId: opts?.snapshotId ?? null,
    snapshotIdSourceVerified: opts?.snapshotId != null,
    sourceAssessmentId: assessment.assessmentId,
    sourceInputIdentity: assessment.inputIdentity ?? null,
    sourceContractId: assessment.contractId,
    sourceContractVersion: assessment.contractVersion,
    fingerprintSource: {
      kind: "unified-quality",
      assessmentId: assessment.assessmentId,
      inputIdentity: assessment.inputIdentity,
      status: assessment.status,
    },
  });
}
