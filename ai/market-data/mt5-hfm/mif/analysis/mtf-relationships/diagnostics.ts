/**
 * Phase 5C Step 3 — MTF diagnostics.
 */
import type { MifMtfDiagnostics, MifMtfNormalizedContext } from "./types.js";

export function buildMtfDiagnostics(input: {
  reason: string;
  contexts: readonly MifMtfNormalizedContext[];
}): MifMtfDiagnostics {
  return {
    overallStatusReason: input.reason,
    bandCount: 3,
    contextCount: input.contexts.length,
    usableContextCount: input.contexts.filter((c) => c.available).length,
  };
}
