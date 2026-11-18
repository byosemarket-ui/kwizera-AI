/**
 * Phase 5B.2 Step 1 — deterministic input identity (excludes wall-clock / random ids).
 */
import { createHash } from "node:crypto";
import type { MifCanonicalCandle } from "../canonical/candle.js";
import type { MifCoverageRequirement } from "./types.js";

/** Stable JSON: sorted object keys, arrays preserve order, undefined omitted. */
export function stableSerialize(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v === undefined) return undefined;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(obj).sort()) {
        sorted[k] = obj[k];
      }
      return sorted;
    }
    return v;
  });
}

function candleIdentitySlice(c: MifCanonicalCandle): Record<string, unknown> {
  return {
    providerId: c.providerId,
    providerSymbol: c.providerSymbol,
    timeframe: c.timeframe,
    openTimeSec: c.openTimeSec,
    closeTimeSec: c.closeTimeSec,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    tickVolume: c.tickVolume,
    realVolume: c.realVolume,
    collapsedVolume: c.collapsedVolume,
    volumeType: c.volumeType,
    candleState: c.candleState,
    timebase: c.timebase,
    priceBasis: c.priceBasis,
  };
}

export function computeStep1InputIdentity(input: {
  candles: readonly MifCanonicalCandle[];
  providerSymbol: string;
  timeframe: string;
  engineId: string;
  engineVersion: string;
  policyId: string;
  policyVersion: string;
  contractId: string;
  contractVersion: string;
  coverageRequirement?: MifCoverageRequirement | null;
  authorityId?: string | null;
  authorityVersion?: string | null;
}): string {
  const payload = {
    contractId: input.contractId,
    contractVersion: input.contractVersion,
    engineId: input.engineId,
    engineVersion: input.engineVersion,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    timeframe: String(input.timeframe || "").trim(),
    coverageRequirement: input.coverageRequirement
      ? {
          consumerId: input.coverageRequirement.consumerId,
          minValidCandles: input.coverageRequirement.minValidCandles,
        }
      : null,
    authorityId: input.authorityId ?? null,
    authorityVersion: input.authorityVersion ?? null,
    // Preserve original input order in the identity (ordering is semantic).
    candles: input.candles.map(candleIdentitySlice),
  };
  const serialized = stableSerialize(payload);
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}
