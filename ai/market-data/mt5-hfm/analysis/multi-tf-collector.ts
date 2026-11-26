/**
 * Collect H1/M30/M15/M5 from existing HFM historical + live + quote engines.
 */
import {
  HFM_ANALYSIS_CANDLE_LIMIT,
  HFM_ANALYSIS_DEFAULT_TF_PACK,
  HFM_ANALYSIS_PROVIDER,
} from "./constants.js";
import { buildTfDataset, normalizeQuoteContext } from "./normalizer.js";
import type { HfmAnalysisQuoteContext, HfmAnalysisTfDataset } from "./types.js";
import { fetchHfmHistoricalCandles } from "../historical-engine.js";
import { getHfmLiveCandleEngine } from "../live-candle-engine.js";
import { getHfmQuoteService } from "../quote-service.js";

export interface HfmMultiTfCollectionResult {
  provider: typeof HFM_ANALYSIS_PROVIDER;
  symbol: string;
  datasets: Record<string, HfmAnalysisTfDataset>;
  quote: HfmAnalysisQuoteContext;
  collectErrors: string[];
}

export async function collectHfmAnalysisMultiTf(input: {
  symbol: string;
  timeframes?: readonly string[];
  candleLimit?: number;
  refresh?: boolean;
}): Promise<HfmMultiTfCollectionResult> {
  const symbol = String(input.symbol || "").trim().toUpperCase();
  const timeframes = input.timeframes ?? HFM_ANALYSIS_DEFAULT_TF_PACK;
  const limit = Math.min(300, Math.max(30, input.candleLimit ?? HFM_ANALYSIS_CANDLE_LIMIT));
  const datasets: Record<string, HfmAnalysisTfDataset> = {};
  const collectErrors: string[] = [];

  // Sequential TF fetches — protect single-CPU VPS / MT5 agent.
  for (const tf of timeframes) {
    try {
      const hist = await fetchHfmHistoricalCandles({
        symbol,
        timeframe: tf,
        limit,
        refresh: input.refresh === true,
      });
      const forming = getHfmLiveCandleEngine().getForming(hist.symbol || symbol, tf);
      if (forming) {
        getHfmLiveCandleEngine().reconcileWithHistory(hist.symbol || symbol, tf, hist.bars);
      }
      const formingAfter = getHfmLiveCandleEngine().getForming(hist.symbol || symbol, tf);
      datasets[tf] = buildTfDataset({
        symbol: hist.symbol || symbol,
        timeframe: tf,
        historical: hist.bars,
        current: formingAfter
          ? {
              time: formingAfter.time,
              open: formingAfter.open,
              high: formingAfter.high,
              low: formingAfter.low,
              close: formingAfter.close,
              tickVolume: formingAfter.tickVolume,
              realVolume: null,
              spread: null,
              closed: false,
              provenance: "live_aggregate",
            }
          : null,
        freshness: hist.available ? (hist.freshness ?? "LIVE") : "NO_HISTORY",
        connectionStatus: hist.available ? "CONNECTED" : "UNAVAILABLE",
        validationStatus: hist.available ? (hist.errors.length ? "partial" : "ok") : "unavailable",
        sourceProvenance: hist.source ?? "HFM_MT5",
        errors: hist.errors,
      });
      if (!hist.available) {
        collectErrors.push(`${tf}: history unavailable (${hist.errors.join("; ") || "no data"})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      collectErrors.push(`${tf}: ${msg}`);
      datasets[tf] = buildTfDataset({
        symbol,
        timeframe: tf,
        historical: [],
        current: null,
        freshness: "ERROR",
        connectionStatus: "ERROR",
        validationStatus: "unavailable",
        sourceProvenance: "HFM_MT5",
        errors: [msg],
      });
    }
  }

  const q = getHfmQuoteService().getQuote(symbol);
  // B2: use quote-service reassessment (trusted UTC tick age). Never Date.now()-brokerTs.
  const freshness = q?.status ?? "NO_QUOTE";

  const quote = normalizeQuoteContext({
    symbol,
    bid: q?.bid ?? null,
    ask: q?.ask ?? null,
    brokerTimestamp: q?.quoteTimestamp ?? null,
    quoteTimestampUtc: q?.quoteTimestampUtc ?? null,
    receiveTimestamp: q?.receivedAt ?? null,
    freshness,
    acquisition: q ? q.acquisitionMethod ?? "SymbolInfoTick" : null,
    marketSessionState: q?.marketSessionState ?? null,
    marketSessionReason: q?.marketSessionReason ?? null,
    brokerClockFrozen: q?.brokerClockFrozen ?? null,
    timestampNormalizationStatus: q?.timestampNormalizationStatus ?? null,
    snapshotAgeSec: q?.snapshotAgeSec ?? null,
    tickAgeSec: q?.tickAgeSec ?? null,
    receiptAgeSec: q?.receiptAgeSec ?? null,
    quoteFreshnessStatus: q?.quoteFreshnessStatus ?? null,
    dataQualityStatus: q?.dataQualityStatus ?? null,
    freshnessReason: q?.freshnessReason ?? null,
  });

  return {
    provider: HFM_ANALYSIS_PROVIDER,
    symbol,
    datasets,
    quote,
    collectErrors,
  };
}
