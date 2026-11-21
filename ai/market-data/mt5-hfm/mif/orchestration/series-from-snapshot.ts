/**
 * Convert Charts multi-TF snapshot datasets into MIF FromSeries candle arrays.
 * FORMING tips stay FORMING — never promoted to CLOSED.
 */
import type { HfmAnalysisMultiTfSnapshot, HfmAnalysisNormalizedCandle } from "../../analysis/types.js";
import {
  baseCanonicalCandle,
  deriveCloseTimeSec,
  type MifCanonicalCandle,
} from "../canonical/candle.js";
import type { MifProductionTfSeriesInput } from "../production-integration/types.js";
import type { MifOrchestrationCandleTipState } from "./types.js";

function mapClosedCandle(
  c: HfmAnalysisNormalizedCandle,
  symbol: string,
  timeframe: string,
): MifCanonicalCandle {
  return baseCanonicalCandle({
    providerSymbol: symbol,
    timeframe,
    openTimeSec: c.timestamp,
    closeTimeSec: deriveCloseTimeSec(c.timestamp, timeframe),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    tickVolume: c.tickVolume,
    realVolume: c.realVolume,
    collapsedVolume: null,
    volumeType: c.volumeType === "real" ? "real" : c.volumeType === "tick" ? "tick" : "none",
    spread: null,
    candleState: "CLOSED",
    priceBasis: "bid",
    timebase: "BROKER_SERVER",
    timezoneOffsetSec: null,
    brokerTimestampSec: c.sourceTimestamp ?? c.timestamp,
    receivedAt: null,
    availableAt: c.normalizedAt,
    availabilityStatus: "KNOWN",
    sourceDialect: "hfm.historical-bar",
    sourceProvenance: c.provenance,
    sourceMode: "HISTORICAL",
    sourceDataQuality: "ok",
    validation: { status: "ok", errors: [], warnings: [] },
    instrument: null,
  });
}

function mapFormingCandle(
  c: HfmAnalysisNormalizedCandle,
  symbol: string,
  timeframe: string,
): MifCanonicalCandle {
  return baseCanonicalCandle({
    providerSymbol: symbol,
    timeframe,
    openTimeSec: c.timestamp,
    closeTimeSec: deriveCloseTimeSec(c.timestamp, timeframe),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    tickVolume: c.tickVolume,
    realVolume: c.realVolume,
    collapsedVolume: null,
    volumeType: c.volumeType === "real" ? "real" : c.volumeType === "tick" ? "tick" : "none",
    spread: null,
    candleState: "FORMING",
    priceBasis: "bid",
    timebase: "BROKER_SERVER",
    timezoneOffsetSec: null,
    brokerTimestampSec: c.sourceTimestamp ?? c.timestamp,
    receivedAt: c.normalizedAt,
    availableAt: c.normalizedAt,
    availabilityStatus: "KNOWN",
    sourceDialect: "hfm.forming-candle",
    sourceProvenance: c.provenance,
    sourceMode: "LIVE",
    sourceDataQuality: "ok",
    validation: { status: "ok", errors: [], warnings: [] },
    instrument: null,
  });
}

function detectOutOfOrder(candles: readonly MifCanonicalCandle[]): boolean {
  for (let i = 1; i < candles.length; i++) {
    if (candles[i]!.openTimeSec < candles[i - 1]!.openTimeSec) return true;
  }
  return false;
}

function dedupeByOpenTime(candles: readonly MifCanonicalCandle[]): MifCanonicalCandle[] {
  const byTime = new Map<number, MifCanonicalCandle>();
  for (const c of candles) {
    byTime.set(c.openTimeSec, c);
  }
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, c]) => c);
}

export interface SnapshotSeriesConversion {
  series: MifProductionTfSeriesInput[];
  tipStates: Record<string, MifOrchestrationCandleTipState>;
  warnings: string[];
  presentTimeframes: string[];
  missingTimeframes: string[];
}

export function buildMifSeriesFromChartsSnapshot(input: {
  snapshot: HfmAnalysisMultiTfSnapshot;
  timeframePack: readonly string[];
}): SnapshotSeriesConversion {
  const symbol = String(input.snapshot.symbol || "").trim().toUpperCase();
  const warnings: string[] = [];
  const tipStates: Record<string, MifOrchestrationCandleTipState> = {};
  const presentTimeframes: string[] = [];
  const missingTimeframes: string[] = [];
  const series: MifProductionTfSeriesInput[] = [];

  for (const tfRaw of input.timeframePack) {
    const tf = String(tfRaw).trim().toUpperCase();
    const ds = input.snapshot.timeframes[tf] ?? input.snapshot.timeframes[tfRaw];
    if (!ds || (!ds.historical.length && !ds.current)) {
      missingTimeframes.push(tf);
      tipStates[tf] = "MISSING";
      warnings.push(`MISSING_TIMEFRAME:${tf}`);
      continue;
    }
    if (String(ds.symbol || "").trim().toUpperCase() !== symbol) {
      warnings.push(`SYMBOL_MISMATCH:${tf}:${ds.symbol}`);
      missingTimeframes.push(tf);
      tipStates[tf] = "MISSING";
      continue;
    }

    const closedOnly = ds.historical
      .filter((c) => !c.isCurrent)
      .map((c) => mapClosedCandle(c, symbol, tf));

    // Detect disorder on the raw mapped sequence before deterministic sort/dedupe.
    if (detectOutOfOrder(closedOnly)) {
      warnings.push(`OUT_OF_ORDER:${tf}`);
    }

    let candles = dedupeByOpenTime(closedOnly);
    let tipState: MifOrchestrationCandleTipState = candles.length ? "CLOSED" : "MISSING";

    if (ds.current) {
      // Never promote forming tip to CLOSED.
      const forming = mapFormingCandle(ds.current, symbol, tf);
      candles = dedupeByOpenTime([
        ...candles.filter((c) => c.openTimeSec !== forming.openTimeSec),
        forming,
      ]);
      tipState = "FORMING";
    } else if (ds.freshness && /stale/i.test(ds.freshness)) {
      tipState = "STALE";
      warnings.push(`STALE_TF:${tf}:${ds.freshness}`);
    }

    if (!candles.length) {
      missingTimeframes.push(tf);
      tipStates[tf] = "MISSING";
      warnings.push(`EMPTY_SERIES:${tf}`);
      continue;
    }

    tipStates[tf] = tipState;
    presentTimeframes.push(tf);
    const tip = candles[candles.length - 1]!;
    series.push({
      timeframe: tf,
      bars: [],
      candles,
      freshness: ds.freshness,
      source: ds.sourceProvenance,
      newestTimestampSec: tip.openTimeSec,
      errors: tipState === "FORMING" ? ["tip_is_forming"] : [],
    });
  }

  return {
    series,
    tipStates,
    warnings,
    presentTimeframes,
    missingTimeframes,
  };
}
