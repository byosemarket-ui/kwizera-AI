/**
 * P8.C — deterministic Charts evaluation identity.
 * Binds predictionId + evaluator/policy versions + PIT manifest + dataset hash + candle range.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../../mif/quality/stable-identity.js";
import {
  HFM_CHARTS_ENTRY_TRIGGER_POLICY_VERSION,
  HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_ID,
  HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_VERSION,
  HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
  HFM_CHARTS_SIGNED_R_POLICY_VERSION,
} from "./contracts.js";

export function computeChartsEvaluationId(input: {
  predictionId: string;
  evaluatorVersion?: string;
  entryTriggerPolicyVersion?: string;
  signedRPolicyVersion?: string;
  pitManifestId: string;
  datasetContentHash: string;
  candleRangeHash: string;
  triggerStatus: string;
  triggerOpenTimeSec: number | null;
}): string {
  const digest = createHash("sha256")
    .update(
      stableSerialize({
        contractId: HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_ID,
        contractVersion: HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_VERSION,
        evaluatorVersion:
          input.evaluatorVersion ?? HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
        entryTriggerPolicyVersion:
          input.entryTriggerPolicyVersion ?? HFM_CHARTS_ENTRY_TRIGGER_POLICY_VERSION,
        signedRPolicyVersion:
          input.signedRPolicyVersion ?? HFM_CHARTS_SIGNED_R_POLICY_VERSION,
        predictionId: input.predictionId,
        pitManifestId: input.pitManifestId,
        datasetContentHash: input.datasetContentHash,
        candleRangeHash: input.candleRangeHash,
        triggerStatus: input.triggerStatus,
        triggerOpenTimeSec: input.triggerOpenTimeSec,
      }),
      "utf8",
    )
    .digest("hex");
  return `cpe:${digest.slice(0, 32)}`;
}

export function computeChartsPerformanceSummaryId(input: {
  evaluationIds: readonly string[];
  policyVersion?: string;
}): string {
  const digest = createHash("sha256")
    .update(
      stableSerialize({
        policyVersion: input.policyVersion ?? "1.0.0",
        evaluationIds: [...input.evaluationIds].sort(),
      }),
      "utf8",
    )
    .digest("hex");
  return `cps:${digest.slice(0, 24)}`;
}
