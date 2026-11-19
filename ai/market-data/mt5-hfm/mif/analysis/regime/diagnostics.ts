/**
 * Phase 5C Step 2 — market regime diagnostics.
 */
import type { MifMarketRegimeDiagnostics } from "./types.js";

export function buildMarketRegimeDiagnostics(input: {
  reason: string;
  closedBarCount: number;
  confirmedSwingCount: number;
  atrMethodId: string;
  atrValue: number | null;
  atrPeriod: number;
}): MifMarketRegimeDiagnostics {
  return {
    overallStatusReason: input.reason,
    closedBarCount: input.closedBarCount,
    confirmedSwingCount: input.confirmedSwingCount,
    atrMethodId: input.atrMethodId,
    atrValue: input.atrValue,
    atrPeriod: input.atrPeriod,
  };
}
