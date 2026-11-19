/**
 * Phase 5C Step 1C — bounded diagnostics.
 */
import type { MifUnifiedChartAnalysisDiagnostics } from "./types.js";

export function buildUnifiedChartAnalysisDiagnostics(input: {
  reason: string;
  compatible: boolean;
  relationshipCount: number;
  withinToleranceCount: number;
  atrUsed: number | null;
  referenceTimeSec: number | null;
}): MifUnifiedChartAnalysisDiagnostics {
  return {
    overallStatusReason: input.reason,
    compatible: input.compatible,
    relationshipCount: input.relationshipCount,
    withinToleranceCount: input.withinToleranceCount,
    atrUsed: input.atrUsed,
    referenceTimeSec: input.referenceTimeSec,
    statusPrecedenceApplied: "BLOCKED>DEGRADED>INSUFFICIENT_DATA>WARNING>VALID",
  };
}
