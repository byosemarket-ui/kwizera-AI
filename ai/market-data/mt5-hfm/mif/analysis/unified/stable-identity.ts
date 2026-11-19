/**
 * Phase 5C Step 1C — deterministic unified chart-analysis identity (excludes wall-clock).
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../../quality/stable-identity.js";
import type { MifPatternFibRelationship, MifUnifiedChartAnalysisPolicy } from "./types.js";

export function computeUnifiedChartAnalysisInputIdentity(input: {
  contractId: string;
  contractVersion: string;
  engineId: string;
  engineVersion: string;
  policy: MifUnifiedChartAnalysisPolicy;
  providerSymbol: string;
  timeframe: string;
  patternInputIdentity: string | null;
  fibonacciInputIdentity: string | null;
  qualityInputIdentity: string | null;
  relationshipIds: readonly string[];
  confluenceGrade: string;
}): string {
  const payload = {
    contractId: input.contractId,
    contractVersion: input.contractVersion,
    engineId: input.engineId,
    engineVersion: input.engineVersion,
    policyId: input.policy.policyId,
    policyVersion: input.policy.policyVersion,
    correlationMethodId: input.policy.correlationMethodId,
    correlationMethodVersion: input.policy.correlationMethodVersion,
    confluenceTolRel: input.policy.confluenceTolRel,
    confluenceTolAtrMult: input.policy.confluenceTolAtrMult,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    timeframe: String(input.timeframe || "").trim(),
    patternInputIdentity: input.patternInputIdentity,
    fibonacciInputIdentity: input.fibonacciInputIdentity,
    qualityInputIdentity: input.qualityInputIdentity,
    relationshipIds: [...input.relationshipIds].sort(),
    confluenceGrade: input.confluenceGrade,
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}

export function relationshipIdsOf(
  relationships: readonly MifPatternFibRelationship[],
): string[] {
  return relationships.map((r) => r.relationshipId);
}
