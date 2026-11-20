/**
 * Phase 5D.7 — versioned price-displacement policy with documented thresholds.
 */
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import {
  MIF_PRICE_DISPLACEMENT_ATR_METHOD_ID,
  MIF_PRICE_DISPLACEMENT_ATR_PERIOD,
  MIF_PRICE_DISPLACEMENT_MIN_BODY_ATR,
  MIF_PRICE_DISPLACEMENT_MIN_CLOSE_LOCATION,
  MIF_PRICE_DISPLACEMENT_MIN_CLOSED,
  MIF_PRICE_DISPLACEMENT_MIN_TR_ATR,
  MIF_PRICE_DISPLACEMENT_POLICY_ID,
  MIF_PRICE_DISPLACEMENT_POLICY_VERSION,
  MIF_PRICE_DISPLACEMENT_STRUCTURAL_BUFFER_ATR,
} from "./contracts.js";
import type { MifPriceDisplacementPolicy } from "./types.js";

export const MIF_POLICY_HFM_PRICE_DISPLACEMENT: MifPriceDisplacementPolicy = {
  policyId: MIF_PRICE_DISPLACEMENT_POLICY_ID,
  policyVersion: MIF_PRICE_DISPLACEMENT_POLICY_VERSION,
  atrMethodId: MIF_PRICE_DISPLACEMENT_ATR_METHOD_ID,
  atrPeriod: MIF_PRICE_DISPLACEMENT_ATR_PERIOD,
  minClosedCandles: MIF_PRICE_DISPLACEMENT_MIN_CLOSED,
  minBodyAtr: MIF_PRICE_DISPLACEMENT_MIN_BODY_ATR,
  minTrueRangeAtr: MIF_PRICE_DISPLACEMENT_MIN_TR_ATR,
  minCloseLocation: MIF_PRICE_DISPLACEMENT_MIN_CLOSE_LOCATION,
  structuralBreakBufferAtr: MIF_PRICE_DISPLACEMENT_STRUCTURAL_BUFFER_ATR,
  thresholdRationale: {
    minBodyAtr:
      "Body ≥ 1.0 ATR marks a strong impulse candle vs recent volatility; alone is insufficient for structural displacement.",
    minTrueRangeAtr:
      "TR ≥ 1.2 ATR requires range expansion beyond typical ATR≈1 noise.",
    minCloseLocation:
      "Close in outer 35% of range (loc ≥ 0.65 bullish / ≤ 0.35 bearish) rejects mid-range/doji closes.",
    structuralBreakBufferAtr:
      "0.05 ATR buffer beyond a validated structure boundary filters tick noise; requires dedicated MARKET_STRUCTURE ref.",
  },
};

export function validateMifPriceDisplacementPolicy(
  policy: MifPriceDisplacementPolicy | null | undefined,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!policy) return { ok: false, errors: ["policy missing"] };
  if (!policy.policyId?.trim()) errors.push("policyId missing");
  if (!policy.policyVersion?.trim()) errors.push("policyVersion missing");
  if (policy.atrMethodId !== MIF_PRICE_DISPLACEMENT_ATR_METHOD_ID) {
    errors.push(`atrMethodId must be ${MIF_PRICE_DISPLACEMENT_ATR_METHOD_ID}`);
  }
  if (!(policy.atrPeriod >= 2) || !Number.isInteger(policy.atrPeriod)) {
    errors.push("atrPeriod must be integer >= 2");
  }
  if (!(policy.minClosedCandles >= policy.atrPeriod + 1)) {
    errors.push("minClosedCandles must be >= atrPeriod + 1");
  }
  for (const k of [
    "minBodyAtr",
    "minTrueRangeAtr",
    "minCloseLocation",
    "structuralBreakBufferAtr",
  ] as const) {
    const v = policy[k];
    if (!(typeof v === "number") || !Number.isFinite(v) || v < 0) {
      errors.push(`${k} must be finite number >= 0`);
    }
  }
  if (policy.minCloseLocation > 1) errors.push("minCloseLocation must be <= 1");
  return { ok: errors.length === 0, errors };
}

export function resolvePriceDisplacementPolicy(
  overrides?: Partial<MifPriceDisplacementPolicy> | null,
): MifPriceDisplacementPolicy {
  if (!overrides) return { ...MIF_POLICY_HFM_PRICE_DISPLACEMENT };
  const merged: MifPriceDisplacementPolicy = {
    ...MIF_POLICY_HFM_PRICE_DISPLACEMENT,
    ...overrides,
    thresholdRationale: {
      ...MIF_POLICY_HFM_PRICE_DISPLACEMENT.thresholdRationale,
      ...(overrides.thresholdRationale ?? {}),
    },
  };
  const v = validateMifPriceDisplacementPolicy(merged);
  if (!v.ok) {
    throw new Error(`invalid price-displacement policy: ${v.errors.join("; ")}`);
  }
  return merged;
}

/** Provider binding check for callers that pass providerId explicitly. */
export function assertPriceDisplacementProvider(providerId: string): void {
  if (providerId !== MIF_PROVIDER_ID) {
    throw new Error(`price-displacement requires providerId=${MIF_PROVIDER_ID}`);
  }
}
