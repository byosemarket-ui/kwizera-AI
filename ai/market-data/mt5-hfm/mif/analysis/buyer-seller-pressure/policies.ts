import {
  MIF_BSP_ABSORPTION_MAX_BODY_ATR,
  MIF_BSP_ABSORPTION_MIN_TICK_RATIO,
  MIF_BSP_ATR_PERIOD,
  MIF_BSP_IMBALANCE_DOMINANCE_MIN,
  MIF_BSP_IMBALANCE_STRONG_MIN,
  MIF_BSP_MIN_CLOSED,
  MIF_BSP_PERSISTENCE_BARS,
  MIF_BSP_SUSTAINED_AGREE_MIN,
  MIF_BUYER_SELLER_PRESSURE_POLICY_ID,
  MIF_BUYER_SELLER_PRESSURE_POLICY_VERSION,
} from "./contracts.js";
import type { MifBuyerSellerPressurePolicy } from "./types.js";

export function resolveBuyerSellerPressurePolicy(
  overrides?: Partial<MifBuyerSellerPressurePolicy> | null,
): MifBuyerSellerPressurePolicy {
  const base: MifBuyerSellerPressurePolicy = {
    policyId: MIF_BUYER_SELLER_PRESSURE_POLICY_ID,
    policyVersion: MIF_BUYER_SELLER_PRESSURE_POLICY_VERSION,
    atrPeriod: MIF_BSP_ATR_PERIOD,
    minClosedCandles: MIF_BSP_MIN_CLOSED,
    persistenceBars: MIF_BSP_PERSISTENCE_BARS,
    imbalanceDominanceMin: MIF_BSP_IMBALANCE_DOMINANCE_MIN,
    imbalanceStrongMin: MIF_BSP_IMBALANCE_STRONG_MIN,
    sustainedAgreeMin: MIF_BSP_SUSTAINED_AGREE_MIN,
    absorptionMaxBodyAtr: MIF_BSP_ABSORPTION_MAX_BODY_ATR,
    absorptionMinTickRatio: MIF_BSP_ABSORPTION_MIN_TICK_RATIO,
    thresholdRationale: {
      imbalanceDominanceMin:
        "|imbalance|≥0.15 nominates a side; below is BALANCED/noise — not a probability.",
      imbalanceStrongMin:
        "|imbalance|≥0.35 marks STRONG dominance vs WEAK when a side is nominated.",
      sustainedAgreeMin:
        "≥3 of last 5 tip-agreeing bars → SUSTAINED; else TEMPORARY_SPIKE.",
      absorptionMaxBodyAtr:
        "body/ATR < 0.35 with elevated tick activity → POSSIBLE_ABSORPTION proxy only.",
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
