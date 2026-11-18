/**
 * Phase 5C Step 1A — deterministic Fibonacci assessment input identity.
 * Excludes wall-clock assessmentTimestamp / random ids.
 */
import { createHash } from "node:crypto";
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import { stableSerialize } from "../../quality/stable-identity.js";
import type { MifFibonacciPolicy } from "./types.js";
import type { MifFibonacciAnchorRef, MifFibonacciOrientation } from "./types.js";

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

function anchorSlice(a: MifFibonacciAnchorRef | null): Record<string, unknown> | null {
  if (!a) return null;
  return {
    swingId: a.swingId,
    kind: a.kind,
    price: a.price,
    timeSec: a.timeSec,
    index: a.index,
    status: a.status,
  };
}

export function computeFibonacciInputIdentity(input: {
  contractId: string;
  contractVersion: string;
  engineId: string;
  engineVersion: string;
  policy: MifFibonacciPolicy;
  providerSymbol: string;
  timeframe: string;
  candles: readonly MifCanonicalCandle[];
  qualityInputIdentity: string | null;
  orientation: MifFibonacciOrientation | null;
  anchorA: MifFibonacciAnchorRef | null;
  anchorB: MifFibonacciAnchorRef | null;
  instrumentDigits: number | null;
  instrumentTickSize: number | null;
}): string {
  const payload = {
    contractId: input.contractId,
    contractVersion: input.contractVersion,
    engineId: input.engineId,
    engineVersion: input.engineVersion,
    policyId: input.policy.policyId,
    policyVersion: input.policy.policyVersion,
    retracementRatios: [...input.policy.retracementRatios],
    extensionRatios: [...input.policy.extensionRatios],
    anchorSelectionStrategy: input.policy.anchorSelectionStrategy,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    timeframe: String(input.timeframe || "").trim(),
    qualityInputIdentity: input.qualityInputIdentity,
    orientation: input.orientation,
    anchorA: anchorSlice(input.anchorA),
    anchorB: anchorSlice(input.anchorB),
    instrumentDigits: input.instrumentDigits,
    instrumentTickSize: input.instrumentTickSize,
    candles: input.candles.map(candleSlice),
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}
