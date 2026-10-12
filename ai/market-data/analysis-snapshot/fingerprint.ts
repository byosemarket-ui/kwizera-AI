/**
 * Deterministic content fingerprint for immutable analysis snapshots.
 * Excludes snapshotId / createdAt / requestId so identical market payloads match.
 */
import { createHash } from "node:crypto";
import type { AnalysisMarketSnapshot } from "./types.js";

export function buildAnalysisSnapshotFingerprintPayload(
  snapshot: Omit<AnalysisMarketSnapshot, "snapshotId" | "createdAt" | "requestId" | "contentFingerprint">,
): unknown {
  return {
    schemaVersion: snapshot.schemaVersion,
    provider: snapshot.provider,
    instrument: snapshot.instrument,
    environment: snapshot.environment,
    priceBasis: snapshot.priceBasis,
    candleTimeframe: snapshot.candleTimeframe,
    analysisPeriod: snapshot.analysisPeriod,
    requestedRange: {
      startUtc: snapshot.requestedRange.startUtc,
      endUtc: snapshot.requestedRange.endUtc,
    },
    returnedRange: snapshot.returnedRange
      ? {
          startUtc: snapshot.returnedRange.startUtc,
          endUtc: snapshot.returnedRange.endUtc,
        }
      : null,
    candleCount: snapshot.candleCount,
    candles: snapshot.candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      isClosed: c.isClosed,
      resampled: c.resampled,
      incompleteAggregation: Boolean(c.incompleteAggregation),
    })),
    latestQuote: snapshot.latestQuote
      ? {
          provider: snapshot.latestQuote.provider,
          canonicalSymbol: snapshot.latestQuote.canonicalSymbol,
          bid: snapshot.latestQuote.bid,
          ask: snapshot.latestQuote.ask,
          mid: snapshot.latestQuote.mid,
          last: snapshot.latestQuote.last,
          priceBasis: snapshot.latestQuote.priceBasis,
          providerEventTimestamp: snapshot.latestQuote.providerEventTimestamp,
          serverReceiptTimestamp: snapshot.latestQuote.serverReceiptTimestamp,
          freshness: snapshot.latestQuote.freshness,
        }
      : null,
    marketStatus: snapshot.marketStatus,
    freshness: snapshot.freshness,
    validation: {
      status: snapshot.validation.status,
      warnings: snapshot.validation.warnings,
      errors: snapshot.validation.errors,
    },
    dataGaps: snapshot.dataGaps,
    sourceMetadata: snapshot.sourceMetadata,
    warnings: snapshot.warnings,
    evidenceReady: snapshot.evidenceReady,
  };
}

export function fingerprintAnalysisSnapshotPayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  return createHash("sha256").update(json).digest("hex");
}
