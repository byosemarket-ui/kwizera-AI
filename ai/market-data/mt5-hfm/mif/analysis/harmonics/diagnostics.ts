/**
 * Phase 5C Step 2 — harmonic diagnostics summary.
 */
import type { MifHarmonicDetection, MifHarmonicDiagnostics } from "./types.js";

export function buildHarmonicDiagnostics(input: {
  reason: string;
  confirmedSwingCount: number;
  provisionalSwingCount: number;
  candidateCount: number;
  detections: readonly MifHarmonicDetection[];
  atrMethodId: string;
  atrValue: number | null;
  atrPeriod: number;
}): MifHarmonicDiagnostics {
  void input.detections;
  return {
    overallStatusReason: input.reason,
    confirmedSwingCount: input.confirmedSwingCount,
    provisionalSwingCount: input.provisionalSwingCount,
    candidateCount: input.candidateCount,
    atrMethodId: input.atrMethodId,
    atrValue: input.atrValue,
    atrPeriod: input.atrPeriod,
  };
}
