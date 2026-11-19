/**
 * Phase 5C Step 2 — narrow reference bridge for future unified technical analysis.
 *
 * Does NOT mutate STEP 1A/1B/1C assessments.
 * Does NOT approve AI reasoning or execution.
 * Holds optional references to harmonic + regime assessments alongside an optional
 * unified chart-analysis assessment for downstream consumers.
 */
import type { MifHarmonicAssessment } from "./harmonics/types.js";
import type { MifMarketRegimeAssessment } from "./regime/types.js";
import type { MifUnifiedChartAnalysisAssessment } from "./unified/types.js";

export interface MifStep2AnalyticalBundle {
  /** Optional STEP 1C result — referenced, not copied. */
  unifiedChartAnalysis: MifUnifiedChartAnalysisAssessment | null;
  /** STEP 2 harmonic assessment — referenced, not copied. */
  harmonicPatterns: MifHarmonicAssessment | null;
  /** STEP 2 market-regime assessment — referenced, not copied. */
  marketRegime: MifMarketRegimeAssessment | null;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
  analyticalBundleOnly: true;
}

/** Build an immutable reference bundle. Never mutates inputs. */
export function buildMifStep2AnalyticalBundle(input: {
  unifiedChartAnalysis?: MifUnifiedChartAnalysisAssessment | null;
  harmonicPatterns?: MifHarmonicAssessment | null;
  marketRegime?: MifMarketRegimeAssessment | null;
}): MifStep2AnalyticalBundle {
  return {
    unifiedChartAnalysis: input.unifiedChartAnalysis ?? null,
    harmonicPatterns: input.harmonicPatterns ?? null,
    marketRegime: input.marketRegime ?? null,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalBundleOnly: true,
  };
}
