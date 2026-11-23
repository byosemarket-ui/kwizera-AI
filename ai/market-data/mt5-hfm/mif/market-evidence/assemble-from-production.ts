/**
 * Phase 2 — assemble a bounded Market Evidence Package from production pipeline outputs.
 * Does not re-run engines. Does not call OpenAI. Analytical packaging only.
 */
import type { MifOpportunityRankingRun } from "../opportunity-ranking/types.js";
import type { MifProbabilityBundle } from "../probability-intelligence/types.js";
import type { MifProductionIntegrationResult } from "../production-integration/types.js";
import type { MifStrategyEligibilityResult } from "../strategy-intelligence/types.js";
import { MIF_MARKET_EVIDENCE_MAX_ITEMS } from "./contracts.js";
import { assembleMarketEvidencePackage } from "./package.js";
import type { MifMarketEvidencePackage, MifUnifiedMarketEvidence } from "./types.js";
import {
  adaptDetectionEvidenceRefToEvidence,
  adaptOpportunityCandidateToEvidence,
  adaptProbabilityBundleToEvidence,
  adaptProductionResultToEvidence,
  adaptRankingRunToEvidence,
  adaptStrategyEligibilityToEvidence,
} from "./adapters/index.js";

export interface AssembleFromProductionInput {
  result: MifProductionIntegrationResult;
  rankingRun?: MifOpportunityRankingRun | null;
  probabilityBundles?: readonly MifProbabilityBundle[] | null;
  eligibility?: readonly MifStrategyEligibilityResult[] | null;
  analysisId?: string | null;
  snapshotId?: string | null;
  snapshotIdSourceVerified?: boolean;
  /** Extra pre-adapted items (e.g. structure/fib from callers). */
  extraItems?: readonly MifUnifiedMarketEvidence[];
}

/**
 * Package production + optional ranking/probability/eligibility into validated evidence.
 * Caps at MIF_MARKET_EVIDENCE_MAX_ITEMS after dedupe.
 */
export function assembleEvidenceFromProduction(
  input: AssembleFromProductionInput,
): MifMarketEvidencePackage {
  const analysisId = input.analysisId ?? input.result.requestId ?? null;
  const runId = input.result.persistence?.runId ?? null;
  const snapshotId = input.snapshotId ?? null;
  const opts = {
    analysisId,
    runId,
    snapshotId,
  };

  // Phase 01: catalog evidence refs first so truncation preserves groundable IDs
  // (tc.regime, etc.) and ABSENT presence remains visible to Charts AI.
  const items: MifUnifiedMarketEvidence[] = [];
  for (const ref of input.result.evidenceRefs ?? []) {
    items.push(
      adaptDetectionEvidenceRefToEvidence(ref, {
        providerSymbol: input.result.providerSymbol,
        observedAt: input.result.processingTimestamp,
        analysisId,
        runId,
        snapshotId,
      }),
    );
  }

  items.push(adaptProductionResultToEvidence(input.result, opts));

  for (const cand of input.result.detection?.candidates ?? []) {
    items.push(adaptOpportunityCandidateToEvidence(cand, opts));
  }

  if (input.rankingRun) {
    items.push(...adaptRankingRunToEvidence(input.rankingRun, opts));
  }

  for (const bundle of input.probabilityBundles ?? []) {
    items.push(adaptProbabilityBundleToEvidence(bundle, opts));
  }

  for (const el of input.eligibility ?? []) {
    items.push(
      adaptStrategyEligibilityToEvidence(el, {
        providerSymbol: input.result.providerSymbol,
        observedAt: input.result.processingTimestamp,
        analysisId,
        runId,
        snapshotId,
        timeframe: input.result.primaryTimeframe,
      }),
    );
  }

  if (input.extraItems?.length) {
    items.push(...input.extraItems);
  }

  const refCount = input.result.evidenceRefs?.length ?? 0;
  return assembleMarketEvidencePackage({
    items: items.slice(0, MIF_MARKET_EVIDENCE_MAX_ITEMS * 2),
    analysisId,
    runId,
    snapshotId,
    snapshotIdSourceVerified: input.snapshotIdSourceVerified === true,
    providerSymbol: input.result.providerSymbol,
    limitations: [
      "Charts Analyze Now packages production evidenceRefs with stable catalog evidenceIds",
      "ABSENT presence means missing/insufficient — not directional opposition",
      ...(refCount === 0
        ? ["Per-TF technical assessments must be supplied via evidenceRefs or extraItems when needed"]
        : [`productionEvidenceRefsIncluded=${refCount}`]),
    ],
  });
}
