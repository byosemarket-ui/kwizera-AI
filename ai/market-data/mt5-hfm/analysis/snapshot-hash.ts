/**
 * Deterministic snapshot identity + SHA-256 hashing for HFM Analysis contexts.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  HFM_ANALYSIS_PROVIDER,
  HFM_ANALYSIS_SNAPSHOT_HASH_VERSION,
} from "./constants.js";
import type {
  HfmAnalysisMultiTfSnapshot,
  HfmAnalysisQuoteContext,
  HfmAnalysisTfDataset,
} from "./types.js";

function roundPrice(n: number): number {
  return Math.round(n * 1e10) / 1e10;
}

function candleCanon(c: {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number | null;
  realVolume: number | null;
  provenance: string;
  isCurrent: boolean;
}): unknown {
  return {
    t: c.timestamp,
    o: roundPrice(c.open),
    h: roundPrice(c.high),
    l: roundPrice(c.low),
    c: roundPrice(c.close),
    tv: c.tickVolume,
    rv: c.realVolume,
    p: c.provenance,
    cur: c.isCurrent,
  };
}

export function buildCanonicalSnapshotPayload(input: {
  symbol: string;
  chartTimeframeAtStart: string;
  datasets: Record<string, HfmAnalysisTfDataset>;
  quote: HfmAnalysisQuoteContext;
  qualityStatus: string;
}): unknown {
  const tfKeys = Object.keys(input.datasets).sort();
  const timeframes: Record<string, unknown> = {};
  for (const tf of tfKeys) {
    const ds = input.datasets[tf]!;
    timeframes[tf] = {
      symbol: ds.symbol,
      timeframe: ds.timeframe,
      historical: ds.historical.map(candleCanon),
      current: ds.current ? candleCanon(ds.current) : null,
      freshness: ds.freshness,
      validationStatus: ds.validationStatus,
      sourceProvenance: ds.sourceProvenance,
    };
  }
  return {
    hashVersion: HFM_ANALYSIS_SNAPSHOT_HASH_VERSION,
    provider: HFM_ANALYSIS_PROVIDER,
    symbol: input.symbol.toUpperCase(),
    chartTimeframeAtStart: input.chartTimeframeAtStart.toUpperCase(),
    quote: {
      bid: input.quote.bid != null ? roundPrice(input.quote.bid) : null,
      ask: input.quote.ask != null ? roundPrice(input.quote.ask) : null,
      spread: input.quote.spread != null ? roundPrice(input.quote.spread) : null,
      brokerTimestamp: input.quote.brokerTimestamp,
      freshness: input.quote.freshness,
    },
    qualityStatus: input.qualityStatus,
    timeframes,
  };
}

export function hashCanonicalPayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  return createHash("sha256").update(json, "utf8").digest("hex");
}

export function createSnapshotIdentity(input: {
  symbol: string;
  chartTimeframeAtStart: string;
  datasets: Record<string, HfmAnalysisTfDataset>;
  quote: HfmAnalysisQuoteContext;
  qualityStatus: string;
  capturedAt?: string;
}): Pick<
  HfmAnalysisMultiTfSnapshot,
  "snapshotId" | "snapshotHash" | "hashVersion" | "capturedAt"
> {
  const canonical = buildCanonicalSnapshotPayload(input);
  const snapshotHash = hashCanonicalPayload(canonical);
  return {
    snapshotId: randomUUID(),
    snapshotHash,
    hashVersion: HFM_ANALYSIS_SNAPSHOT_HASH_VERSION,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
  };
}
