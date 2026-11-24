import {
  MIF_RESEARCH_RELIABILITY_POLICY_ID,
  MIF_RESEARCH_RELIABILITY_POLICY_VERSION,
  MIF_RR_DEGRADATION_CONFIRM_FRAC,
  MIF_RR_DEGRADATION_SUSPECT_FRAC,
  MIF_RR_MIN_SAMPLE_DEGRADATION,
  MIF_RR_PRICE_DISCONTINUITY_FRAC,
  MIF_RR_QUOTE_LIVE_MAX_AGE_SEC,
  MIF_RR_QUOTE_STALE_MAX_AGE_SEC,
  MIF_RR_SPREAD_WIDE_MULTIPLIER,
} from "./contracts.js";

export interface MifResearchReliabilityPolicy {
  policyId: string;
  policyVersion: string;
  quoteLiveMaxAgeSec: number;
  quoteStaleMaxAgeSec: number;
  priceDiscontinuityFrac: number;
  spreadWideMultiplier: number;
  minSampleDegradation: number;
  degradationSuspectFrac: number;
  degradationConfirmFrac: number;
  comparePriceToleranceFrac: number;
  rationale: Record<string, string>;
}

export function resolveResearchReliabilityPolicy(
  overrides?: Partial<MifResearchReliabilityPolicy> | null,
): MifResearchReliabilityPolicy {
  const base: MifResearchReliabilityPolicy = {
    policyId: MIF_RESEARCH_RELIABILITY_POLICY_ID,
    policyVersion: MIF_RESEARCH_RELIABILITY_POLICY_VERSION,
    quoteLiveMaxAgeSec: MIF_RR_QUOTE_LIVE_MAX_AGE_SEC,
    quoteStaleMaxAgeSec: MIF_RR_QUOTE_STALE_MAX_AGE_SEC,
    priceDiscontinuityFrac: MIF_RR_PRICE_DISCONTINUITY_FRAC,
    spreadWideMultiplier: MIF_RR_SPREAD_WIDE_MULTIPLIER,
    minSampleDegradation: MIF_RR_MIN_SAMPLE_DEGRADATION,
    degradationSuspectFrac: MIF_RR_DEGRADATION_SUSPECT_FRAC,
    degradationConfirmFrac: MIF_RR_DEGRADATION_CONFIRM_FRAC,
    comparePriceToleranceFrac: 0.0015,
    rationale: {
      quoteFreshness:
        "LIVE if provider-timestamp age <= liveMaxAgeSec; STALE between live and stale; DELAYED/MISSING/INVALID otherwise. HTTP 200 alone is never LIVE.",
      spread:
        "Ask must be >= bid; abnormal if spread > median(recent)*multiplier when recent observations exist; else spreadAbnormal=null (config/evidence insufficient).",
      degradation:
        "SUSPECT if expectancy drop >= suspectFrac with any sample; CONFIRM only if drop >= confirmFrac AND sample >= minSample. Short losing streaks alone never confirm.",
      compare:
        "Live bid/ask mid compared to last CLOSED candle close only; forming candles excluded; NOT_COMPARABLE when semantics differ.",
    },
  };
  return overrides ? { ...base, ...overrides } : base;
}
