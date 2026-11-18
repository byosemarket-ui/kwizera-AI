/**
 * Canonical normalization for HFM Analysis candles / quotes.
 */
import { HFM_ANALYSIS_PROVIDER } from "./constants.js";
import type {
  HfmAnalysisNormalizedCandle,
  HfmAnalysisQuoteContext,
  HfmAnalysisTfDataset,
} from "./types.js";
import type { HfmHistoricalBar } from "../historical-engine.js";
import type { HfmChartsAnalysisCandle } from "../charts-analysis-contract.js";

function volumeType(
  tickVolume: number | null,
  realVolume: number | null,
): "tick" | "real" | "none" {
  if (realVolume != null && Number.isFinite(realVolume)) return "real";
  if (tickVolume != null && Number.isFinite(tickVolume)) return "tick";
  return "none";
}

export function normalizeHistoricalBar(
  symbol: string,
  timeframe: string,
  bar: HfmHistoricalBar | HfmChartsAnalysisCandle,
  opts?: { isCurrent?: boolean; nowIso?: string },
): HfmAnalysisNormalizedCandle {
  const tickVolume =
    typeof bar.tickVolume === "number" && Number.isFinite(bar.tickVolume) ? bar.tickVolume : null;
  const realVolume =
    typeof bar.realVolume === "number" && Number.isFinite(bar.realVolume) ? bar.realVolume : null;
  const provenance =
    ("provenance" in bar && bar.provenance) ? bar.provenance : "native";
  return {
    symbol: symbol.toUpperCase(),
    provider: HFM_ANALYSIS_PROVIDER,
    timeframe: timeframe.toUpperCase(),
    timestamp: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    tickVolume,
    realVolume,
    volumeType: volumeType(tickVolume, realVolume),
    provenance: provenance as HfmAnalysisNormalizedCandle["provenance"],
    isCurrent: Boolean(opts?.isCurrent),
    sourceTimestamp: bar.time,
    normalizedAt: opts?.nowIso ?? new Date().toISOString(),
  };
}

export function buildTfDataset(input: {
  symbol: string;
  timeframe: string;
  historical: Array<HfmHistoricalBar | HfmChartsAnalysisCandle>;
  current: HfmHistoricalBar | HfmChartsAnalysisCandle | null;
  freshness: string;
  connectionStatus: string;
  validationStatus: HfmAnalysisTfDataset["validationStatus"];
  sourceProvenance: string;
  errors?: string[];
}): HfmAnalysisTfDataset {
  const nowIso = new Date().toISOString();
  const historical = input.historical.map((b) =>
    normalizeHistoricalBar(input.symbol, input.timeframe, b, { isCurrent: false, nowIso }),
  );
  const current = input.current
    ? normalizeHistoricalBar(input.symbol, input.timeframe, input.current, {
        isCurrent: true,
        nowIso,
      })
    : null;
  const times = historical.map((c) => c.timestamp);
  return {
    timeframe: input.timeframe.toUpperCase(),
    symbol: input.symbol.toUpperCase(),
    historical,
    current,
    candleCount: historical.length,
    oldestTimestamp: times.length ? times[0]! : null,
    newestTimestamp: times.length ? times[times.length - 1]! : null,
    freshness: input.freshness,
    connectionStatus: input.connectionStatus,
    validationStatus: input.validationStatus,
    sourceProvenance: input.sourceProvenance,
    errors: input.errors ?? [],
  };
}

export function normalizeQuoteContext(input: {
  symbol: string;
  bid: number | null;
  ask: number | null;
  brokerTimestamp: number | null;
  receiveTimestamp: string | null;
  freshness: string;
  acquisition: string | null;
}): HfmAnalysisQuoteContext {
  let spread: number | null = null;
  if (
    input.bid != null &&
    input.ask != null &&
    Number.isFinite(input.bid) &&
    Number.isFinite(input.ask) &&
    input.ask >= input.bid
  ) {
    spread = Math.round((input.ask - input.bid) * 1e10) / 1e10;
  }
  return {
    symbol: input.symbol.toUpperCase(),
    bid: input.bid,
    ask: input.ask,
    spread,
    brokerTimestamp: input.brokerTimestamp,
    receiveTimestamp: input.receiveTimestamp,
    freshness: input.freshness,
    acquisition: input.acquisition,
  };
}
