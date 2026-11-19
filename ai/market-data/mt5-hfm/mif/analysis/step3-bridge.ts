/**
 * Phase 5C Step 3 — reference bridge bundling MTF relationships with prior analytical assessments.
 * Does not mutate Step 1/2 results. Does not approve AI or execution.
 */
import type { MifMtfRelationshipsAssessment } from "./mtf-relationships/types.js";
import type { MifStep2AnalyticalBundle } from "./step2-bridge.js";

export interface MifStep3AnalyticalBundle {
  step2: MifStep2AnalyticalBundle | null;
  multiTimeframeRelationships: MifMtfRelationshipsAssessment | null;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
  analyticalBundleOnly: true;
}

export function buildMifStep3AnalyticalBundle(input: {
  step2?: MifStep2AnalyticalBundle | null;
  multiTimeframeRelationships?: MifMtfRelationshipsAssessment | null;
}): MifStep3AnalyticalBundle {
  return {
    step2: input.step2 ?? null,
    multiTimeframeRelationships: input.multiTimeframeRelationships ?? null,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalBundleOnly: true,
  };
}
