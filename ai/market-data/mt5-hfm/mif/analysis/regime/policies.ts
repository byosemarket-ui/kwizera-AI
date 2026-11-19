/**
 * Phase 5C Step 2 — versioned market-regime policy.
 * Thresholds are instrument/timeframe-relative via ATR ratios — not fixed absolute prices.
 */
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import {
  MIF_MARKET_REGIME_ATR_METHOD_ID,
  MIF_MARKET_REGIME_POLICY_ID,
  MIF_MARKET_REGIME_POLICY_VERSION,
} from "./contracts.js";
import type { MifMarketRegimePolicy, MifMarketRegimePolicyValidation } from "./types.js";

export const MIF_POLICY_HFM_MARKET_REGIME: MifMarketRegimePolicy = {
  policyId: MIF_MARKET_REGIME_POLICY_ID,
  policyVersion: MIF_MARKET_REGIME_POLICY_VERSION,
  providerId: MIF_PROVIDER_ID,
  atrMethodId: MIF_MARKET_REGIME_ATR_METHOD_ID,
  atrPeriod: 14,
  lookbackBars: 40,
  minConfirmedSwings: 4,
  minTrendSwingPairs: 2,
  minTrendDisplacementAtr: 1.5,
  maxRangeDisplacementAtr: 0.75,
  minRangeWidthAtr: 1.0,
  maxRangeWidthAtr: 6.0,
  breakoutBufferAtr: 0.15,
  breakoutConfirmBars: 2,
  breakoutFailBars: 5,
  volLowMax: 0.7,
  volNormalMax: 1.3,
  volHighMax: 2.0,
  atrBaselineLookback: 50,
  structurePersistBars: 2,
  allowedQualityStatuses: ["VALID", "WARNING"],
};

export function validateMifMarketRegimePolicy(
  policy: MifMarketRegimePolicy | null | undefined,
): MifMarketRegimePolicyValidation {
  const errors: string[] = [];
  if (!policy) return { ok: false, errors: ["policy missing"] };
  if (!policy.policyId?.trim()) errors.push("policyId missing");
  if (!policy.policyVersion?.trim()) errors.push("policyVersion missing");
  if (policy.providerId !== MIF_PROVIDER_ID) errors.push("providerId must be HFM_MT5");
  if (policy.atrMethodId !== MIF_MARKET_REGIME_ATR_METHOD_ID) {
    errors.push(`atrMethodId must be ${MIF_MARKET_REGIME_ATR_METHOD_ID}`);
  }
  const ints = [
    "atrPeriod",
    "lookbackBars",
    "minConfirmedSwings",
    "minTrendSwingPairs",
    "breakoutConfirmBars",
    "breakoutFailBars",
    "atrBaselineLookback",
    "structurePersistBars",
  ] as const;
  for (const k of ints) {
    const v = policy[k];
    if (!(typeof v === "number") || !Number.isInteger(v) || v < 1) {
      errors.push(`${k} must be integer >= 1`);
    }
  }
  if (policy.atrPeriod < 2) errors.push("atrPeriod must be >= 2");
  if (!(policy.volLowMax < policy.volNormalMax && policy.volNormalMax < policy.volHighMax)) {
    errors.push("volatility thresholds must be strictly increasing");
  }
  if (!policy.allowedQualityStatuses?.length) errors.push("allowedQualityStatuses empty");
  return { ok: errors.length === 0, errors };
}

export class MifMarketRegimePolicyRegistry {
  private readonly byKey = new Map<string, MifMarketRegimePolicy>();

  register(policy: MifMarketRegimePolicy, opts?: { allowOverwrite?: boolean }): void {
    const v = validateMifMarketRegimePolicy(policy);
    if (!v.ok) throw new Error(`invalid market-regime policy: ${v.errors.join("; ")}`);
    const key = `${policy.policyId}@${policy.policyVersion}`;
    if (this.byKey.has(key) && !opts?.allowOverwrite) {
      throw new Error(`duplicate market-regime policy ${key}`);
    }
    this.byKey.set(key, policy);
  }

  get(policyId: string, policyVersion: string): MifMarketRegimePolicy | null {
    return this.byKey.get(`${policyId}@${policyVersion}`) ?? null;
  }
}

export function createDefaultMifMarketRegimePolicyRegistry(): MifMarketRegimePolicyRegistry {
  const registry = new MifMarketRegimePolicyRegistry();
  registry.register(MIF_POLICY_HFM_MARKET_REGIME);
  return registry;
}
