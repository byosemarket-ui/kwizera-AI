/**
 * Phase 5F STEP 2 — dataset eligibility for analogue search corpus.
 */
import type { MifResearchDatasetManifest } from "../types.js";
import type { MifAnalogueEligibilityMode } from "./contracts.js";
import type { MifAnalogueExclusionReason } from "./types.js";

export interface MifAnalogueEligibilityDecision {
  eligible: boolean;
  reasons: MifAnalogueExclusionReason[];
  notes: string[];
}

/**
 * Normal search corpus gate. INCOMPLETE / non-HFM / non-candle-research rejected.
 */
export function assessAnalogueDatasetEligibility(
  manifest: MifResearchDatasetManifest,
  mode: MifAnalogueEligibilityMode,
): MifAnalogueEligibilityDecision {
  const reasons: MifAnalogueExclusionReason[] = [];
  const notes: string[] = [];

  if (manifest.provider !== "HFM_MT5") {
    reasons.push("PROVIDER_NOT_HFM_MT5");
  }
  if (manifest.status !== "COMPLETE") {
    reasons.push("STATUS_INCOMPLETE");
  }
  if (!manifest.researchEligibility?.suitableForCandleResearch) {
    reasons.push("NOT_SUITABLE_FOR_CANDLE_RESEARCH");
  }
  if (!manifest.contentHash || String(manifest.contentHash).length < 16) {
    reasons.push("MISSING_CONTENT_HASH");
  }

  if (mode === "STRUCTURE_REGIME") {
    notes.push("STRUCTURE_REGIME requires tip-safe structure features when includeStructureFeatures=true");
  }
  if (mode === "MULTI_TIMEFRAME") {
    notes.push("MULTI_TIMEFRAME requires aligned COMPLETE secondary datasets at shared tip");
  }
  if (mode === "HISTORICAL_OUTCOME") {
    notes.push("HISTORICAL_OUTCOME requires complete post-tip horizons; incomplete horizons marked PARTIAL/INSUFFICIENT");
  }

  if (!manifest.researchEligibility?.suitableForCostAdjustedBacktest) {
    notes.push("COST_INCOMPLETE: candle similarity allowed; cost-adjusted evidence forbidden");
  }
  if (manifest.researchEligibility?.metadataAuthority !== "HISTORICALLY_AUTHORITATIVE") {
    notes.push("METADATA_LIMITED: no historical session authority");
  }

  return { eligible: reasons.length === 0, reasons, notes };
}

export function resolveComparisonMode(input: {
  referenceInstrument: string;
  referenceTimeframe: string;
  candidateInstrument: string;
  candidateTimeframe: string;
  allowCrossInstrument: boolean;
}): {
  mode: import("./contracts.js").MifAnalogueComparisonMode;
  allowed: boolean;
  reason: MifAnalogueExclusionReason | null;
  normalizationPolicy: string;
} {
  const sameInst =
    input.referenceInstrument.toUpperCase() === input.candidateInstrument.toUpperCase();
  const sameTf =
    input.referenceTimeframe.toUpperCase() === input.candidateTimeframe.toUpperCase();

  if (sameInst && sameTf) {
    return {
      mode: "SAME_INSTRUMENT_SAME_TIMEFRAME",
      allowed: true,
      reason: null,
      normalizationPolicy: "atr-zscore-v1",
    };
  }
  if (!sameInst && sameTf) {
    if (!input.allowCrossInstrument) {
      return {
        mode: "CROSS_INSTRUMENT_SAME_TIMEFRAME",
        allowed: false,
        reason: "OTHER",
        normalizationPolicy: "atr-zscore-v1",
      };
    }
    return {
      mode: "CROSS_INSTRUMENT_SAME_TIMEFRAME",
      allowed: true,
      reason: null,
      normalizationPolicy: "atr-zscore-dimensionless-v1",
    };
  }
  if (sameInst && !sameTf) {
    return {
      mode: "SAME_INSTRUMENT_CROSS_TIMEFRAME",
      allowed: false,
      reason: "CROSS_TF_REJECTED",
      normalizationPolicy: "none",
    };
  }
  return {
    mode: "CROSS_INSTRUMENT_CROSS_TIMEFRAME",
    allowed: false,
    reason: "CROSS_INSTRUMENT_CROSS_TF_REJECTED",
    normalizationPolicy: "none",
  };
}
