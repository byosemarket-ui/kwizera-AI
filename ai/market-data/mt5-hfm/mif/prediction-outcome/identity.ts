/**
 * Phase 5F STEP 3 — deterministic prediction identity.
 * candidateId alone is insufficient: the same candidate may recur across reasoning runs.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../quality/stable-identity.js";
import {
  MIF_PREDICTION_OUTCOME_CONTRACT_ID,
  MIF_PREDICTION_OUTCOME_CONTRACT_VERSION,
  MIF_PREDICTION_SNAPSHOT_POLICY_VERSION,
} from "./contracts.js";

export interface MifPredictionIdentityMaterial {
  candidateId: string;
  reasoningRunId: string | null;
  analysisRunId: string | null;
  evaluationId: string | null;
  activationOpenTimeSec: number;
  instrument: string;
  timeframe: string;
  direction: string;
  snapshotPolicyVersion: string;
}

/**
 * Stable prediction occurrence identity.
 * Uses immutable source identity + activation boundary — never wall-clock.
 */
export function computePredictionId(material: MifPredictionIdentityMaterial): string {
  const payload = {
    contractId: MIF_PREDICTION_OUTCOME_CONTRACT_ID,
    contractVersion: MIF_PREDICTION_OUTCOME_CONTRACT_VERSION,
    snapshotPolicyVersion:
      material.snapshotPolicyVersion || MIF_PREDICTION_SNAPSHOT_POLICY_VERSION,
    candidateId: String(material.candidateId || "").trim(),
    reasoningRunId: material.reasoningRunId ? String(material.reasoningRunId).trim() : null,
    analysisRunId: material.analysisRunId ? String(material.analysisRunId).trim() : null,
    evaluationId: material.evaluationId ? String(material.evaluationId).trim() : null,
    activationOpenTimeSec: material.activationOpenTimeSec,
    instrument: String(material.instrument || "").trim().toUpperCase(),
    timeframe: String(material.timeframe || "").trim().toUpperCase(),
    direction: String(material.direction || "").trim().toUpperCase(),
  };
  const digest = createHash("sha256")
    .update(stableSerialize(payload), "utf8")
    .digest("hex");
  return `pred:${digest.slice(0, 32)}`;
}

export function computeSnapshotHash(snapshotBody: unknown): string {
  return createHash("sha256").update(stableSerialize(snapshotBody), "utf8").digest("hex");
}

export function computeCandleRangeHash(input: {
  openTimeSecs: readonly number[];
  closes: readonly number[];
  highs: readonly number[];
  lows: readonly number[];
  marketSourceMode: string;
  provenanceKey: string;
}): string {
  return createHash("sha256")
    .update(
      stableSerialize({
        openTimeSecs: input.openTimeSecs,
        closes: input.closes,
        highs: input.highs,
        lows: input.lows,
        marketSourceMode: input.marketSourceMode,
        provenanceKey: input.provenanceKey,
      }),
      "utf8",
    )
    .digest("hex");
}

export function computeOutcomeId(input: {
  predictionId: string;
  policyVersion: string;
  evaluatorVersion: string;
  candleRangeHash: string;
}): string {
  const digest = createHash("sha256")
    .update(
      stableSerialize({
        predictionId: input.predictionId,
        policyVersion: input.policyVersion,
        evaluatorVersion: input.evaluatorVersion,
        candleRangeHash: input.candleRangeHash,
      }),
      "utf8",
    )
    .digest("hex");
  return `po:${digest.slice(0, 32)}`;
}
