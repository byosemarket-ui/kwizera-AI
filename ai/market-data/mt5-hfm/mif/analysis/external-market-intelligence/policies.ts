import {
  MIF_EMI_ELEVATED_RISK_WINDOW_MS,
  MIF_EMI_HIGH_RISK_WINDOW_MS,
  MIF_EMI_MODERATE_RISK_WINDOW_MS,
  MIF_EXTERNAL_MARKET_POLICY_ID,
  MIF_EXTERNAL_MARKET_POLICY_VERSION,
} from "./contracts.js";
import type { MifExternalMarketIntelligencePolicy } from "./types.js";

export function resolveExternalMarketIntelligencePolicy(
  overrides?: Partial<MifExternalMarketIntelligencePolicy> | null,
): MifExternalMarketIntelligencePolicy {
  const base: MifExternalMarketIntelligencePolicy = {
    policyId: MIF_EXTERNAL_MARKET_POLICY_ID,
    policyVersion: MIF_EXTERNAL_MARKET_POLICY_VERSION,
    highRiskWindowMs: MIF_EMI_HIGH_RISK_WINDOW_MS,
    elevatedRiskWindowMs: MIF_EMI_ELEVATED_RISK_WINDOW_MS,
    moderateRiskWindowMs: MIF_EMI_MODERATE_RISK_WINDOW_MS,
    thresholdRationale: {
      highRiskWindowMs:
        "HIGH-importance SCHEDULED/UPCOMING event within ±2h of asOf → HIGH_EVENT_RISK (proximity+importance only).",
      elevatedRiskWindowMs:
        "HIGH within ±24h or MEDIUM within ±2h → ELEVATED_EVENT_RISK.",
      moderateRiskWindowMs:
        "HIGH within ±72h → MODERATE_EVENT_RISK when not already elevated.",
      surprise:
        "Numeric delta only when forecast+actual parse with compatible unit suffixes; else NOT_COMPARABLE. Never a trade signal.",
      alignment:
        "Technical bias from Phase 06 input (optional) vs fundamental bias from releases/surprises — conflicts preserved; no forced direction.",
    },
  };
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    thresholdRationale: {
      ...base.thresholdRationale,
      ...(overrides.thresholdRationale ?? {}),
    },
  };
}
