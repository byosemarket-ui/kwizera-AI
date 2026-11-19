/**
 * Phase 5C Step 2 — deterministic market-regime identities (excludes wall-clock).
 */
import { createHash } from "node:crypto";
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import { stableSerialize } from "../../quality/stable-identity.js";
import type { MifMarketRegimePolicy } from "./types.js";

function candleSlice(c: MifCanonicalCandle): Record<string, unknown> {
  return {
    providerId: c.providerId,
    providerSymbol: c.providerSymbol,
    timeframe: c.timeframe,
    openTimeSec: c.openTimeSec,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    candleState: c.candleState,
  };
}

export function computeMarketRegimeInputIdentity(input: {
  contractId: string;
  contractVersion: string;
  engineId: string;
  engineVersion: string;
  policy: MifMarketRegimePolicy;
  providerSymbol: string;
  timeframe: string;
  candles: readonly MifCanonicalCandle[];
  qualityInputIdentity: string | null;
  direction: string;
  structure: string;
  volatility: string;
  previousStructure: string | null;
}): string {
  const payload = {
    contractId: input.contractId,
    contractVersion: input.contractVersion,
    engineId: input.engineId,
    engineVersion: input.engineVersion,
    policyId: input.policy.policyId,
    policyVersion: input.policy.policyVersion,
    atrMethodId: input.policy.atrMethodId,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    timeframe: String(input.timeframe || "").trim(),
    qualityInputIdentity: input.qualityInputIdentity,
    direction: input.direction,
    structure: input.structure,
    volatility: input.volatility,
    previousStructure: input.previousStructure,
    candles: input.candles.map(candleSlice),
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}
