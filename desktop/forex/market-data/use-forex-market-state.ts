/**
 * Client Market State — builds from the SAME Binance hooks as Charts/TA.
 * No second WebSocket / REST path.
 */
import { useMemo } from "react";
import { applyLiveKline } from "../../../ai/market-data/binance/adapter";
import { buildForexMarketState, type ForexBinanceMarketState } from "../../../ai/forex-market-state";
import type { ChartTimeframeId } from "../chart/types";
import { sanitizeCandles } from "../chart/validate-candles";
import { isBinanceSpotSelection, type SelectedMarket } from "./selected-market";
import { useBinanceKlines } from "./use-binance-klines";
import { useBinanceLiveKline } from "./use-binance-live-kline";
import { resolveKlineUiStatus } from "./live-market-status";

export function useForexMarketState(
  selectedMarket: SelectedMarket | null | undefined,
  timeframe: ChartTimeframeId,
): {
  marketState: ForexBinanceMarketState | null;
  loading: boolean;
} {
  const binanceSelected = isBinanceSpotSelection(selectedMarket);
  const symbol = binanceSelected ? selectedMarket.symbol : null;
  const history = useBinanceKlines(symbol, timeframe);
  const liveKline = useBinanceLiveKline(symbol, timeframe);

  const candles = useMemo(() => {
    if (!binanceSelected || history.state !== "ready") return [];
    if (history.symbol !== selectedMarket.symbol || history.timeframe !== timeframe) return [];
    const base = sanitizeCandles(history.candles.map((candle) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      closed: candle.closed,
    })));
    const live = liveKline.kline;
    if (
      !live
      || live.symbol !== selectedMarket.symbol
      || live.timeframe !== timeframe
      || liveKline.subscribedSymbol !== selectedMarket.symbol
      || liveKline.timeframe !== timeframe
    ) {
      return base;
    }
    return sanitizeCandles(applyLiveKline(base, live.candle));
  }, [binanceSelected, history, liveKline.kline, liveKline.subscribedSymbol, liveKline.timeframe, selectedMarket, timeframe]);

  const historyReady = Boolean(
    binanceSelected
    && history.state === "ready"
    && history.symbol === selectedMarket?.symbol
    && history.timeframe === timeframe
    && candles.length > 0,
  );

  const connection = resolveKlineUiStatus(
    liveKline,
    symbol,
    timeframe,
    historyReady,
  );

  const marketState = useMemo(() => {
    if (!binanceSelected || !symbol) return null;
    if (!historyReady && candles.length === 0) return null;
    return buildForexMarketState({
      symbol,
      timeframe,
      candles,
      connection,
      lastMarketUpdateMs: liveKline.kline?.eventTimeUtc ?? (candles[candles.length - 1]
        ? candles[candles.length - 1]!.time * 1000
        : null),
    });
  }, [binanceSelected, symbol, timeframe, candles, connection, historyReady, liveKline.kline?.eventTimeUtc]);

  return {
    marketState,
    loading: Boolean(binanceSelected && history.state === "loading"),
  };
}
