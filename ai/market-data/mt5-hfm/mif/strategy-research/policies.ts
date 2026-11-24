import {
  MIF_STRATEGY_RESEARCH_MAX_COST_SCENARIOS,
  MIF_STRATEGY_RESEARCH_MIN_SAMPLE,
  MIF_STRATEGY_RESEARCH_POLICY_ID,
  MIF_STRATEGY_RESEARCH_POLICY_VERSION,
} from "./contracts.js";
import type { HfmCostAssumption } from "./types.js";

export interface MifStrategyResearchPolicy {
  policyId: string;
  policyVersion: string;
  minSampleForAvailableMetrics: number;
  maxCostScenarios: number;
  materialDegradationThreshold: number;
  sameCandleAmbiguityPolicy: string;
  lookAheadPolicy: string;
  reliabilityRationale: Record<string, string>;
}

export function resolveStrategyResearchPolicy(
  overrides?: Partial<MifStrategyResearchPolicy> | null,
): MifStrategyResearchPolicy {
  const base: MifStrategyResearchPolicy = {
    policyId: MIF_STRATEGY_RESEARCH_POLICY_ID,
    policyVersion: MIF_STRATEGY_RESEARCH_POLICY_VERSION,
    minSampleForAvailableMetrics: MIF_STRATEGY_RESEARCH_MIN_SAMPLE,
    maxCostScenarios: MIF_STRATEGY_RESEARCH_MAX_COST_SCENARIOS,
    materialDegradationThreshold: 0.25,
    sameCandleAmbiguityPolicy:
      "When SL and TP could both be touched in one candle without sequence evidence, classify AMBIGUOUS — never assume the favorable fill.",
    lookAheadPolicy:
      "Only bars with openTime <= decisionTime are visible; future bars must not influence earlier entries. No repainting.",
    reliabilityRationale: {
      RESEARCH_ONLY:
        "Default for all Phase 08 results — historical research is never live trading proof.",
      INSUFFICIENT_SAMPLE: `Fewer than ${MIF_STRATEGY_RESEARCH_MIN_SAMPLE} closed decisive trades.`,
      PROVISIONAL: "Sample meets minimum but no out-of-sample walk-forward completed.",
      OUT_OF_SAMPLE_TESTED:
        "Walk-forward OOS window completed with sufficient samples; still not live proof.",
      ROBUSTNESS_UNVERIFIED:
        "OOS or sensitivity incomplete; multiple comparisons or single-regime risk.",
    },
  };
  return overrides ? { ...base, ...overrides } : base;
}

export function defaultGrossCostAssumption(): HfmCostAssumption {
  return {
    spreadPoints: 0,
    slippagePoints: 0,
    commissionPerTrade: 0,
    swapPerBar: 0,
    label: "GROSS_OHLC_ZERO_COST_BASELINE",
    source: "CONFIGURABLE_ASSUMPTION",
    note:
      "Baseline gross OHLC with zero assumed costs. Not measured HFM/FXCM fills. Cost sensitivity scenarios apply separate assumptions.",
  };
}
