/**
 * Phase 5E Step 2 — Evidence Intelligence Engine.
 * Explains supporting / contradicting / missing evidence. Reuses STEP 1 provenance.
 * Pure / deterministic. Does not mutate source candidates or evidence.
 */
import { createHash } from "node:crypto";
import type { MifOpportunityCandidate, MifDetectionEvidenceRef } from "../opportunity-detection/types.js";
import type { MifEvidenceFamily } from "../strategy-intelligence/types.js";
import { getDefaultMifStrategyIntelligenceRegistry } from "../strategy-intelligence/registry.js";
import { stableSerialize } from "../quality/stable-identity.js";
import { buildEvidenceContributions } from "../opportunity-ranking/provenance.js";
import { resolveRankingPolicy } from "../opportunity-ranking/policies.js";
import {
  MIF_EVIDENCE_INTELLIGENCE_CONTRACT_ID,
  MIF_EVIDENCE_INTELLIGENCE_CONTRACT_VERSION,
  MIF_EVIDENCE_INTELLIGENCE_ENGINE_ID,
  MIF_EVIDENCE_INTELLIGENCE_ENGINE_VERSION,
} from "./contracts.js";
import { MIF_POLICY_HFM_EVIDENCE_INTELLIGENCE } from "./policies.js";
import type { MifEvidenceIntelligenceAssessment } from "./types.js";

export interface AssessEvidenceIntelligenceInput {
  candidate: MifOpportunityCandidate;
  evidence: readonly MifDetectionEvidenceRef[];
  analysisRunId?: string | null;
  primaryTimeframe?: string | null;
  assessedAt?: string;
  assessmentId?: string | null;
}

export function assessEvidenceIntelligence(
  input: AssessEvidenceIntelligenceInput,
): MifEvidenceIntelligenceAssessment {
  const cand = input.candidate;
  const assessedAt = input.assessedAt ?? new Date().toISOString();
  const rankingPolicy = resolveRankingPolicy();
  const strategyDef = getDefaultMifStrategyIntelligenceRegistry().getStrategy(
    String(cand.strategyId),
  );

  const requiredFamilies = new Set<MifEvidenceFamily>();
  const optionalFamilies = new Set<MifEvidenceFamily>();
  if (strategyDef) {
    for (const r of strategyDef.requiredEvidence) requiredFamilies.add(r.family);
    for (const r of strategyDef.optionalEvidence) optionalFamilies.add(r.family);
  }
  const relevantFamilies = new Set<MifEvidenceFamily>([
    ...requiredFamilies,
    ...optionalFamilies,
    "DATA_QUALITY",
    "MULTI_TIMEFRAME_RELATIONSHIP",
  ]);
  for (const e of input.evidence) {
    if (
      cand.supportingEvidenceIds.includes(e.evidenceId)
      || cand.conflictingEvidenceIds.includes(e.evidenceId)
    ) {
      relevantFamilies.add(e.family);
    }
  }

  const prov = buildEvidenceContributions({
    evidence: input.evidence,
    supportingIds: cand.supportingEvidenceIds,
    conflictingIds: cand.conflictingEvidenceIds,
    candidateDirection: cand.direction,
    relevantFamilies,
    policy: rankingPolicy,
  });

  const supporting = prov.contributions.filter(
    (c) =>
      !c.deduplicated
      && (c.polarity === "BULLISH_SUPPORT"
        || c.polarity === "BEARISH_SUPPORT"
        || (c.polarity === "NEUTRAL" && cand.supportingEvidenceIds.includes(c.evidenceId))),
  );
  const contradicting = prov.contributions.filter(
    (c) => !c.deduplicated && (c.polarity === "CONFLICTING" || c.polarity === "BLOCKED"),
  );
  const neutral = prov.contributions.filter(
    (c) =>
      !c.deduplicated
      && (c.polarity === "NEUTRAL" || c.polarity === "UNKNOWN" || c.polarity === "PARTIAL")
      && !cand.supportingEvidenceIds.includes(c.evidenceId),
  );
  const deduplicated = prov.contributions.filter((c) => c.deduplicated);
  const blocked = [
    ...new Set(
      prov.contributions
        .filter((c) => c.polarity === "BLOCKED" || c.qualityStatus === "BLOCKED")
        .map((c) => c.evidenceId),
    ),
  ].sort();

  const missingRequired: string[] = [];
  if (strategyDef) {
    for (const req of strategyDef.requiredEvidence) {
      const hit = input.evidence.find(
        (e) =>
          (e.evidenceId === req.evidenceId || e.family === req.family)
          && e.presence === "PRESENT"
          && e.qualityStatus !== "BLOCKED"
          && e.qualityStatus !== "MISSING",
      );
      if (!hit) missingRequired.push(req.evidenceId);
    }
  }

  const explanation = [
    `strategy=${cand.strategyId}`,
    `direction=${cand.direction}`,
    `supporting=${supporting.length}`,
    `contradicting=${contradicting.length}`,
    `neutral=${neutral.length}`,
    `missingRequired=${missingRequired.join(",") || "none"}`,
    `partial=${prov.partial.join(",") || "none"}`,
    `deduplicated=${deduplicated.length}`,
    `missing≠negative_proof`,
    `policy=${MIF_POLICY_HFM_EVIDENCE_INTELLIGENCE.policyId}@${MIF_POLICY_HFM_EVIDENCE_INTELLIGENCE.policyVersion}`,
  ].join("; ");

  const inputIdentity = createHash("sha256")
    .update(
      stableSerialize({
        candidateId: cand.candidateId,
        evidenceIds: input.evidence.map((e) => e.evidenceId).sort(),
        supportingIds: [...cand.supportingEvidenceIds].sort(),
        conflictingIds: [...cand.conflictingEvidenceIds].sort(),
        policyVersion: MIF_POLICY_HFM_EVIDENCE_INTELLIGENCE.policyVersion,
        engineVersion: MIF_EVIDENCE_INTELLIGENCE_ENGINE_VERSION,
      }),
    )
    .digest("hex");

  return {
    contractId: MIF_EVIDENCE_INTELLIGENCE_CONTRACT_ID,
    contractVersion: MIF_EVIDENCE_INTELLIGENCE_CONTRACT_VERSION,
    assessmentId: input.assessmentId || `evi:${inputIdentity.slice(0, 24)}`,
    policyId: MIF_POLICY_HFM_EVIDENCE_INTELLIGENCE.policyId,
    policyVersion: MIF_POLICY_HFM_EVIDENCE_INTELLIGENCE.policyVersion,
    engineId: MIF_EVIDENCE_INTELLIGENCE_ENGINE_ID,
    engineVersion: MIF_EVIDENCE_INTELLIGENCE_ENGINE_VERSION,
    candidateId: cand.candidateId,
    analysisRunId: input.analysisRunId ?? null,
    providerId: cand.providerId,
    providerSymbol: cand.providerSymbol,
    strategyId: String(cand.strategyId),
    direction: String(cand.direction),
    primaryTimeframe: input.primaryTimeframe ?? null,
    supporting,
    contradicting,
    neutral,
    missing: [...new Set([...prov.missing, ...missingRequired])].sort(),
    partial: prov.partial,
    blocked,
    deduplicated,
    provenanceRefs: prov.uniqueProvenanceKeys,
    explanation,
    assessedAt,
    inputIdentity,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalEvidenceOnly: true,
    notExecutable: true,
  };
}
