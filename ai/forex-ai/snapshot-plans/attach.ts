/**
 * Attach Phase 44 plan bundle to a completed snapshot analysis.
 */
import type { AnalysisMarketSnapshot } from "../../market-data/analysis-snapshot/types.js";
import { buildSnapshotPlanBundle } from "./build-plans.js";
import type { SnapshotPlanBundle } from "./types.js";

export type AnalysisWithPlans<T> = T & {
  planBundle: SnapshotPlanBundle | null;
};

export function attachPlanBundleToAnalysis<
  T extends {
    analysisId: string;
    snapshotId: string;
    contentFingerprint: string;
    instrument: string;
    candleTimeframe: string;
    analysisPeriod: string;
    marketBias: string;
    decision: string;
    decisionRationale: string;
    keyEvidence: string[];
    invalidationConditions: string[];
    confidence: string | null;
    limitations: string[];
    warnings: string[];
    status: string;
    error: string | null;
  },
>(
  analysis: T,
  snapshot: AnalysisMarketSnapshot,
  provider: "LOCAL" | "OPENAI",
): AnalysisWithPlans<T> {
  try {
    const planBundle = buildSnapshotPlanBundle({ analysis, snapshot, provider });
    return { ...analysis, planBundle };
  } catch {
    return { ...analysis, planBundle: null };
  }
}
