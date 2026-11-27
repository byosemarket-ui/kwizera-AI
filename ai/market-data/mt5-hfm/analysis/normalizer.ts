/**
 * Canonical normalization for HFM Analysis candles / quotes.
 * Engine 3: broker-domain open time is never labeled as UTC.
 */
import { HFM_ANALYSIS_PROVIDER } from "./constants.js";
import type {
  HfmAnalysisNormalizedCandle,
  HfmAnalysisQuoteContext,
  HfmAnalysisTfDataset,
} from "./types.js";
import type { HfmHistoricalBar } from "../historical-engine.js";
import type { HfmChartsAnalysisCandle } from "../charts-analysis-contract.js";
import {
  isTrustedCandleUtc,
  normalizeHfmCandleOpenTime,
  type HfmCandleTimeProvenance,
} from "../candle-timestamp.js";

function volumeType(
  tickVolume: number | null,
  realVolume: number | null,
): "tick" | "real" | "none" {
  if (realVolume != null && Number.isFinite(realVolume)) return "real";
  if (tickVolume != null && Number.isFinite(tickVolume)) return "tick";
  return "none";
}

function readProvenance(
  bar: HfmHistoricalBar | HfmChartsAnalysisCandle,
): HfmCandleTimeProvenance {
  const brokerOpen =
    typeof (bar as HfmCandleTimeProvenance).brokerOpenTime === "number"
      ? (bar as HfmCandleTimeProvenance).brokerOpenTime
      : bar.time;
  if (
    typeof (bar as HfmCandleTimeProvenance).timestampNormalizationStatus === "string" &&
    typeof (bar as HfmCandleTimeProvenance).brokerOpenTime === "number"
  ) {
    const p = bar as HfmCandleTimeProvenance;
    return {
      brokerOpenTime: p.brokerOpenTime,
      openTimeUtc: p.openTimeUtc ?? null,
      brokerUtcOffsetSec: p.brokerUtcOffsetSec ?? null,
      timestampNormalizationStatus: p.timestampNormalizationStatus,
      timestampNormalizationReason: p.timestampNormalizationReason ?? null,
      timestampSource: p.timestampSource ?? "unknown",
      offsetObservedAtGmtSec: p.offsetObservedAtGmtSec ?? null,
      offsetObservedAtBrokerSec: p.offsetObservedAtBrokerSec ?? null,
      offsetTrust: p.offsetTrust ?? "NONE",
      timestampObservedAt: p.timestampObservedAt ?? null,
    };
  }
  return normalizeHfmCandleOpenTime({
    brokerOpenTime: brokerOpen,
    timestampSource: "mt5_copyrates",
    preferLiveOffset: false,
  });
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
  const timeProv = readProvenance(bar);
  const trustedUtc = isTrustedCandleUtc(timeProv.timestampNormalizationStatus)
    ? timeProv.openTimeUtc
    : null;
  return {
    symbol: symbol.toUpperCase(),
    provider: HFM_ANALYSIS_PROVIDER,
    timeframe: timeframe.toUpperCase(),
    /**
     * Broker-domain candle-open seconds (NOT UTC).
     * Prefer openTimeUtc when timestampNormalizationStatus is trusted.
     */
    timestamp: timeProv.brokerOpenTime,
    brokerOpenTime: timeProv.brokerOpenTime,
    openTimeUtc: trustedUtc,
    brokerUtcOffsetSec: timeProv.brokerUtcOffsetSec,
    timestampNormalizationStatus: timeProv.timestampNormalizationStatus,
    timestampNormalizationReason: timeProv.timestampNormalizationReason,
    timestampSource: timeProv.timestampSource,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    tickVolume,
    realVolume,
    volumeType: volumeType(tickVolume, realVolume),
    provenance: provenance as HfmAnalysisNormalizedCandle["provenance"],
    isCurrent: Boolean(opts?.isCurrent),
    /** Broker-domain source open (same as brokerOpenTime). */
    sourceTimestamp: timeProv.brokerOpenTime,
    /** Processing instant — not candle-open time. */
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
  // Broker-domain ordering (all tips share the same domain).
  const times = historical.map((c) => c.brokerOpenTime ?? c.timestamp);
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
  quoteTimestampUtc?: number | null;
  receiveTimestamp: string | null;
  freshness: string;
  acquisition: string | null;
  marketSessionState?: string | null;
  marketSessionReason?: string | null;
  brokerClockFrozen?: boolean | null;
  timestampNormalizationStatus?: string | null;
  snapshotAgeSec?: number | null;
  tickAgeSec?: number | null;
  receiptAgeSec?: number | null;
  quoteFreshnessStatus?: string | null;
  dataQualityStatus?: string | null;
  freshnessReason?: string | null;
  quoteVersionId?: string | null;
  quoteProvenance?: string | null;
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
    quoteTimestampUtc: input.quoteTimestampUtc ?? null,
    receiveTimestamp: input.receiveTimestamp,
    freshness: input.freshness,
    acquisition: input.acquisition,
    marketSessionState: input.marketSessionState ?? null,
    marketSessionReason: input.marketSessionReason ?? null,
    brokerClockFrozen: input.brokerClockFrozen ?? null,
    timestampNormalizationStatus: input.timestampNormalizationStatus ?? null,
    snapshotAgeSec: input.snapshotAgeSec ?? null,
    tickAgeSec: input.tickAgeSec ?? null,
    receiptAgeSec: input.receiptAgeSec ?? null,
    quoteFreshnessStatus: input.quoteFreshnessStatus ?? null,
    dataQualityStatus: input.dataQualityStatus ?? null,
    freshnessReason: input.freshnessReason ?? null,
    quoteVersionId: input.quoteVersionId ?? null,
    quoteProvenance: input.quoteProvenance ?? null,
  };
}
