/**
 * Phase 5B.2 Step 3 — Phase 2 shadow bridge (observational only).
 * Never mutates Phase 2 status, approvedForAiReasoning, snapshots, or schedulers.
 */
import { createHash } from "node:crypto";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import {
  MIF_QUALITY_STEP3_SHADOW_ENGINE_ID,
  MIF_QUALITY_STEP3_SHADOW_ENGINE_VERSION,
  MIF_UNIFIED_QUALITY_CONTRACT_ID,
  MIF_UNIFIED_QUALITY_CONTRACT_VERSION,
} from "../contracts.js";
import { stableSerialize } from "../stable-identity.js";
import {
  compareCandleIntegrity,
  compareCoverage,
  compareGaps,
  compareOverallInterpretation,
  compareQuoteFreshness,
  compareSynchronization,
} from "./compare-phase2.js";
import type { MifPhase2ShadowReport, Phase2ShadowBridgeInput } from "./types.js";

function computeShadowInputIdentity(input: Phase2ShadowBridgeInput): string {
  const payload = {
    contractId: MIF_UNIFIED_QUALITY_CONTRACT_ID,
    contractVersion: MIF_UNIFIED_QUALITY_CONTRACT_VERSION,
    engineId: MIF_QUALITY_STEP3_SHADOW_ENGINE_ID,
    engineVersion: MIF_QUALITY_STEP3_SHADOW_ENGINE_VERSION,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    mif: {
      dataIntegrity: input.dataIntegrity?.inputIdentity ?? null,
      quote: input.quote?.inputIdentity ?? null,
      multiTimeframe: input.multiTimeframe?.inputIdentity ?? null,
    },
    phase2: {
      status: input.phase2Quality.status,
      approvedForAiReasoning: input.phase2Quality.approvedForAiReasoning,
      errorCodes: input.phase2Quality.errors.map((e) => e.code).sort(),
      warningCodes: input.phase2Quality.warnings.map((w) => w.code).sort(),
      syncStatus: input.phase2Sync?.status ?? null,
      sourceIdentity: input.phase2SourceIdentity ?? null,
    },
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}

/**
 * Compare already-produced Phase 2 and MIF assessments.
 * Does not recompute Phase 2 quality. Does not touch AI eligibility.
 */
export function comparePhase2Shadow(input: Phase2ShadowBridgeInput): MifPhase2ShadowReport {
  // Capture originals — never write back.
  const phase2Status = input.phase2Quality.status;
  const phase2Approved = input.phase2Quality.approvedForAiReasoning;

  const dimensions = [
    compareCandleIntegrity(input.phase2Quality, input.dataIntegrity),
    compareCoverage(input.phase2Quality, input.dataIntegrity),
    compareGaps(input.phase2Quality, input.dataIntegrity),
    compareQuoteFreshness(input.phase2Quality, input.quote),
    compareSynchronization(input.phase2Sync, input.multiTimeframe),
    compareOverallInterpretation(input.phase2Quality, null),
  ];

  const hasGenuineDisagreement = dimensions.some((d) => d.outcome === "genuine_disagreement");
  const inputIdentity = computeShadowInputIdentity(input);

  return {
    contractId: MIF_UNIFIED_QUALITY_CONTRACT_ID,
    contractVersion: MIF_UNIFIED_QUALITY_CONTRACT_VERSION,
    scope: "step3-phase2-shadow",
    assessmentId: input.assessmentId ?? `step3-shadow:${inputIdentity.slice(0, 16)}`,
    inputIdentity,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    engineId: MIF_QUALITY_STEP3_SHADOW_ENGINE_ID,
    engineVersion: MIF_QUALITY_STEP3_SHADOW_ENGINE_VERSION,
    assessmentTimestamp: input.assessmentTimestamp ?? new Date().toISOString(),
    phase2SourceIdentity: input.phase2SourceIdentity ?? null,
    phase2Status,
    phase2ApprovedForAiReasoning: phase2Approved,
    phase2ApprovedForAiReasoningUnchanged: true,
    dimensions,
    hasGenuineDisagreement,
    diagnosticsSummary: `shadow disagree=${hasGenuineDisagreement}; phase2=${phase2Status}; aiApproved=${phase2Approved} (unchanged)`,
    doesNotApproveAiReasoning: true,
    doesNotMutatePhase2: true,
    notUnifiedOverallAssessment: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

/** Attach unified overall status into overall_interpretation dimension (still observational). */
export function attachUnifiedOverallToShadow(
  shadow: MifPhase2ShadowReport,
  phase2Quality: Phase2ShadowBridgeInput["phase2Quality"],
  unifiedOverall: string,
): MifPhase2ShadowReport {
  const overall = compareOverallInterpretation(phase2Quality, unifiedOverall);
  const dimensions = shadow.dimensions.map((d) =>
    d.dimension === "overall_interpretation" ? overall : d,
  );
  return {
    ...shadow,
    dimensions,
    hasGenuineDisagreement: dimensions.some((d) => d.outcome === "genuine_disagreement"),
    diagnosticsSummary: `shadow disagree=${dimensions.some((d) => d.outcome === "genuine_disagreement")}; phase2=${shadow.phase2Status}; mifOverall=${unifiedOverall}; aiApproved=${shadow.phase2ApprovedForAiReasoning} (unchanged)`,
  };
}
