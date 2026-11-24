import type { HfmRegimeShiftReport } from "./types.js";

export function assessRegimeShift(input: {
  historicalRegime: string | null | undefined;
  currentRegime: string | null | undefined;
  timeframe?: string | null;
}): HfmRegimeShiftReport {
  const hist = (input.historicalRegime ?? "").trim() || null;
  const curr = (input.currentRegime ?? "").trim() || null;
  const evidence: string[] = [];
  const sampleLimitations: string[] = [];

  if (!hist || !curr) {
    sampleLimitations.push("historical_or_current_regime_missing");
    return {
      status: "INSUFFICIENT_DATA",
      historicalRegime: hist,
      currentRegime: curr,
      timeframe: input.timeframe ?? null,
      evidence,
      sampleLimitations,
      evidenceKind: "UNAVAILABLE",
    };
  }

  evidence.push(`historical=${hist}`, `current=${curr}`);
  const norm = (s: string) => s.toUpperCase().replace(/\s+/g, "_");
  if (norm(hist) === norm(curr)) {
    return {
      status: "NO_SHIFT",
      historicalRegime: hist,
      currentRegime: curr,
      timeframe: input.timeframe ?? null,
      evidence,
      sampleLimitations: ["regime_labels_caller_supplied_not_recomputed_here"],
      evidenceKind: "INFERRED",
    };
  }

  // Treat UNCLASSIFIED/UNKNOWN as not comparable rather than a shift.
  if (["UNCLASSIFIED", "UNKNOWN", "UNAVAILABLE"].includes(norm(hist))
    || ["UNCLASSIFIED", "UNKNOWN", "UNAVAILABLE"].includes(norm(curr))) {
    return {
      status: "NOT_COMPARABLE",
      historicalRegime: hist,
      currentRegime: curr,
      timeframe: input.timeframe ?? null,
      evidence,
      sampleLimitations: ["unclassified_regime_present"],
      evidenceKind: "INFERRED",
    };
  }

  return {
    status: "REGIME_SHIFT_DETECTED",
    historicalRegime: hist,
    currentRegime: curr,
    timeframe: input.timeframe ?? null,
    evidence,
    sampleLimitations: [
      "Phase 05/06 limitations: tick volume ≠ signed flow; no true aggressor/order-book unless sourced",
    ],
    evidenceKind: "INFERRED",
  };
}
