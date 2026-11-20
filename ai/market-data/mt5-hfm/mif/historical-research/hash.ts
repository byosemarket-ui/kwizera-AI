/**
 * Phase 5F STEP 1 — deterministic dataset content hash.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../quality/stable-identity.js";
import type { MifResearchStoredBar } from "./types.js";

export function canonicalizeResearchBar(bar: MifResearchStoredBar): Record<string, unknown> {
  return {
    time: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    tickVolume: bar.tickVolume,
    realVolume: bar.realVolume,
    spread: bar.spread,
    validationStatus: bar.validationStatus,
    provenance: bar.provenance,
    timebase: bar.timebase,
  };
}

/**
 * Content hash from canonicalized bars + identity fields.
 * Bars are sorted by time ascending before hashing (order-stable).
 */
export function computeResearchDatasetContentHash(input: {
  provider: "HFM_MT5";
  instrument: string;
  timeframe: string;
  timebase: "BROKER_SERVER";
  version: number;
  bars: readonly MifResearchStoredBar[];
}): string {
  const sorted = [...input.bars].sort((a, b) => a.time - b.time);
  const payload = {
    provider: input.provider,
    instrument: String(input.instrument).trim().toUpperCase(),
    timeframe: String(input.timeframe).trim().toUpperCase(),
    timebase: input.timebase,
    version: input.version,
    candleCount: sorted.length,
    bars: sorted.map(canonicalizeResearchBar),
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}

export function buildDatasetId(input: {
  instrument: string;
  timeframe: string;
  contentHash: string;
}): string {
  const sym = String(input.instrument).trim().toUpperCase();
  const tf = String(input.timeframe).trim().toUpperCase();
  return `ds:${sym}:${tf}:${input.contentHash.slice(0, 16)}`;
}
