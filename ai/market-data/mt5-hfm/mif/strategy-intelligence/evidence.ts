/**
 * Phase 5D Step 1 — evidence family catalog and helper constructors.
 * Maps families to existing Phase 5C contracts where available.
 */
import { MIF_FIBONACCI_CONTRACT_ID } from "../analysis/fibonacci/contracts.js";
import { MIF_HARMONIC_PATTERNS_CONTRACT_ID } from "../analysis/harmonics/contracts.js";
import { MIF_MTF_RELATIONSHIPS_CONTRACT_ID } from "../analysis/mtf-relationships/contracts.js";
import { MIF_CHART_PATTERNS_CONTRACT_ID } from "../analysis/patterns/contracts.js";
import { MIF_MARKET_REGIME_CONTRACT_ID } from "../analysis/regime/contracts.js";
import type {
  MifEvidenceAvailability,
  MifEvidenceFamily,
  MifEvidenceMissingEffect,
  MifEvidenceRequirementMode,
  MifStrategyEvidenceRequirement,
  MifTimeframeRole,
} from "./types.js";

export const MIF_EVIDENCE_FAMILY_CATALOG: Record<
  MifEvidenceFamily,
  {
    availability: MifEvidenceAvailability;
    expectedSourceEngine: string | null;
    expectedSourceContractId: string | null;
    notes: string;
  }
> = {
  MARKET_STRUCTURE: {
    availability: "AVAILABLE",
    expectedSourceEngine: "mif-market-structure",
    expectedSourceContractId: "kwizera.mif.market-structure.v1",
    notes: "Phase 5D.6 dedicated market-structure assessment (forex-structure swings/BOS/CHoCH).",
  },
  MARKET_REGIME: {
    availability: "AVAILABLE",
    expectedSourceEngine: "mif-market-regime",
    expectedSourceContractId: MIF_MARKET_REGIME_CONTRACT_ID,
    notes: "Phase 5C Step 2 market regime engine.",
  },
  MULTI_TIMEFRAME_RELATIONSHIP: {
    availability: "AVAILABLE",
    expectedSourceEngine: "mif-multi-timeframe-relationships",
    expectedSourceContractId: MIF_MTF_RELATIONSHIPS_CONTRACT_ID,
    notes: "Phase 5C Step 3 MTF relationships engine.",
  },
  FIBONACCI: {
    availability: "AVAILABLE",
    expectedSourceEngine: "mif-fibonacci",
    expectedSourceContractId: MIF_FIBONACCI_CONTRACT_ID,
    notes: "Phase 5C Step 1A Fibonacci engine.",
  },
  GEOMETRIC_PATTERN: {
    availability: "AVAILABLE",
    expectedSourceEngine: "mif-chart-patterns",
    expectedSourceContractId: MIF_CHART_PATTERNS_CONTRACT_ID,
    notes: "Phase 5C Step 1B geometric chart patterns.",
  },
  HARMONIC_PATTERN: {
    availability: "AVAILABLE",
    expectedSourceEngine: "mif-harmonic-patterns",
    expectedSourceContractId: MIF_HARMONIC_PATTERNS_CONTRACT_ID,
    notes: "Phase 5C Step 2 harmonic patterns.",
  },
  SUPPORT_RESISTANCE: {
    availability: "AVAILABLE",
    expectedSourceEngine: "mif-support-resistance",
    expectedSourceContractId: "kwizera.mif.support-resistance.v1",
    notes: "Phase 5D.6 dedicated support/resistance from confirmed swing zones.",
  },
  LIQUIDITY_REFERENCE: {
    availability: "AVAILABLE",
    expectedSourceEngine: "mif-liquidity-reference",
    expectedSourceContractId: "kwizera.mif.liquidity-reference.v1",
    notes: "Phase 5D.6 price-structure liquidity references — does not claim resting orders.",
  },
  PRICE_DISPLACEMENT: {
    availability: "PARTIAL",
    expectedSourceEngine: "mif-market-regime trendEvidence",
    expectedSourceContractId: MIF_MARKET_REGIME_CONTRACT_ID,
    notes: "Displacement/ATR fields exist on regime trend/breakout evidence.",
  },
  MOMENTUM: {
    availability: "AVAILABLE",
    expectedSourceEngine: "mif-momentum",
    expectedSourceContractId: "kwizera.mif.momentum.v1",
    notes: "Phase 5D.6 ROC+RSI momentum assessment — not a win probability.",
  },
  VOLATILITY: {
    availability: "AVAILABLE",
    expectedSourceEngine: "mif-market-regime",
    expectedSourceContractId: MIF_MARKET_REGIME_CONTRACT_ID,
    notes: "Volatility dimension from market regime engine.",
  },
  RANGE_STRUCTURE: {
    availability: "PARTIAL",
    expectedSourceEngine: "mif-market-regime rangeEvidence",
    expectedSourceContractId: MIF_MARKET_REGIME_CONTRACT_ID,
    notes: "Range boundaries via regime rangeEvidence when structure=RANGING.",
  },
  CANDLE_CONFIRMATION: {
    availability: "PARTIAL",
    expectedSourceEngine: "canonical candle state",
    expectedSourceContractId: "kwizera.mif.market-data.v1",
    notes: "CLOSED vs FORMING semantics from canonical candles / pattern confirmation.",
  },
  DATA_QUALITY: {
    availability: "AVAILABLE",
    expectedSourceEngine: "mif-quality",
    expectedSourceContractId: "kwizera.mif.quality.v1",
    notes: "Phase 5B.2 quality assessments + analytical quality gate.",
  },
};

export function evidenceReq(input: {
  evidenceId: string;
  family: MifEvidenceFamily;
  mode: MifEvidenceRequirementMode;
  timeframeRoles?: readonly MifTimeframeRole[];
  minQualityStatuses?: readonly ("VALID" | "WARNING" | "DEGRADED")[];
  requireClosedCandle?: boolean;
  allowUnknown?: boolean;
  missingAffects?: MifEvidenceMissingEffect;
  notes?: string;
  availabilityOverride?: MifEvidenceAvailability;
}): MifStrategyEvidenceRequirement {
  const meta = MIF_EVIDENCE_FAMILY_CATALOG[input.family];
  return {
    evidenceId: input.evidenceId,
    family: input.family,
    mode: input.mode,
    expectedSourceEngine: meta.expectedSourceEngine,
    expectedSourceContractId: meta.expectedSourceContractId,
    availability: input.availabilityOverride ?? meta.availability,
    timeframeRoles: input.timeframeRoles ?? [],
    minQualityStatuses: input.minQualityStatuses ?? ["VALID", "WARNING"],
    requireClosedCandle: input.requireClosedCandle ?? false,
    allowUnknown: input.allowUnknown ?? false,
    missingAffects:
      input.missingAffects
      ?? (input.mode === "REQUIRED" ? "INSUFFICIENT_EVIDENCE" : "IGNORE"),
    notes: input.notes ?? meta.notes,
  };
}
