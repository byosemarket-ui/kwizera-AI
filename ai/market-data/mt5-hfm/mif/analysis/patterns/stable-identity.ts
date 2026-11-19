/**
 * Phase 5C Step 1B — deterministic chart-pattern identities (excludes wall-clock).
 */
import { createHash } from "node:crypto";
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import { stableSerialize } from "../../quality/stable-identity.js";
import type { MifChartPatternDetection, MifChartPatternPolicy } from "./types.js";
import type { RawPatternCandidate } from "./matchers/types.js";

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

export function computeDetectionIdentity(input: {
  patternType: string;
  pivots: Array<{ swingId: string; role: string; price: number; timeSec: number }>;
  lifecycle: string;
  policyId: string;
  policyVersion: string;
  engineVersion: string;
  confirmationCandleOpenTimeSec: number | null;
}): string {
  const payload = {
    patternType: input.patternType,
    pivots: input.pivots.map((p) => ({
      swingId: p.swingId,
      role: p.role,
      price: p.price,
      timeSec: p.timeSec,
    })),
    lifecycle: input.lifecycle,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    engineVersion: input.engineVersion,
    confirmationCandleOpenTimeSec: input.confirmationCandleOpenTimeSec,
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}

export function computeChartPatternsInputIdentity(input: {
  contractId: string;
  contractVersion: string;
  engineId: string;
  engineVersion: string;
  policy: MifChartPatternPolicy;
  providerSymbol: string;
  timeframe: string;
  candles: readonly MifCanonicalCandle[];
  qualityInputIdentity: string | null;
  detections: Array<Pick<MifChartPatternDetection, "patternType" | "lifecycle" | "detectionIdentity">>;
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
    detections: input.detections.map((d) => ({
      patternType: d.patternType,
      lifecycle: d.lifecycle,
      detectionIdentity: d.detectionIdentity,
    })),
    candles: input.candles.map(candleSlice),
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}

export function compareRawCandidates(a: RawPatternCandidate, b: RawPatternCandidate): number {
  if (a.patternType !== b.patternType) return a.patternType.localeCompare(b.patternType);
  const aLast = a.pivots[a.pivots.length - 1]?.timeSec ?? 0;
  const bLast = b.pivots[b.pivots.length - 1]?.timeSec ?? 0;
  if (aLast !== bLast) return aLast - bLast;
  const aId = a.pivots.map((p) => p.swingId).join("|");
  const bId = b.pivots.map((p) => p.swingId).join("|");
  return aId.localeCompare(bId);
}
