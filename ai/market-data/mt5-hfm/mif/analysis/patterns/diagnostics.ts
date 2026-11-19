/**
 * Phase 5C Step 1B — bounded diagnostics builder.
 */
import type { MifChartPatternDiagnostics, MifChartPatternDetection } from "./types.js";

export function buildPatternDiagnostics(input: {
  reason: string;
  confirmedSwingCount: number;
  provisionalSwingCount: number;
  detections: MifChartPatternDetection[];
  atrMethodId: string;
  atrValue: number | null;
  atrPeriod: number;
}): MifChartPatternDiagnostics {
  return {
    overallStatusReason: input.reason,
    confirmedSwingCount: input.confirmedSwingCount,
    provisionalSwingCount: input.provisionalSwingCount,
    candidateCount: input.detections.length,
    atrMethodId: input.atrMethodId,
    atrValue: input.atrValue,
    atrPeriod: input.atrPeriod,
  };
}
