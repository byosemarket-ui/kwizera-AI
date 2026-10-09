/**
 * Client Market State — builds from the SAME candle hooks as Charts/TA.
 * Phase 31: Binance and FXCM share one Market State engine; provider identity retained.
 */
import { useMemo } from "react";
import { applyLiveKline } from "../../../ai/market-data/binance/adapter";
import { buildForexMarketState, type ForexBinanceMarketState } from "../../../ai/forex-market-state";
import type { ChartTimeframeId } from "../chart/types";
import { sanitizeCandles } from "../chart/validate-candles";
import { isBinanceSpotSelection, isFxcmSelection, type SelectedMarket } from "./selected-market";
import { useBinanceKlines } from "./use-binance-klines";
import { useBinanceLiveKline } from "./use-binance-live-kline";
import { useFxcmLiveCandles } from "./use-fxcm-live-candles";
import { resolveKlineUiStatus } from "./live-market-status";

export function useForexMarketState(
  selectedMarket: SelectedMarket | null | undefined,
  timeframe: ChartTimeframeId,
): {
  marketState: ForexBinanceMarketState | null;
  loading: boolean;
} {
  const binanceSelected = isBinanceSpotSelection(selectedMarket);
  const fxcmSelected = isFxcmSelection(selectedMarket);
  const binanceSymbol = binanceSelected ? selectedMarket.symbol : null;
  const fxcmSymbol = fxcmSelected ? selectedMarket.symbol : null;

  const history = useBinanceKlines(binanceSymbol, timeframe);
  const liveKline = useBinanceLiveKline(binanceSymbol, timeframe);
  const fxcmLive = useFxcmLiveCandles(fxcmSymbol, timeframe);

  const candles = useMemo(() => {
    if (fxcmSelected && fxcmLive.state === "ready") {
      return sanitizeCandles(fxcmLive.candles.map((candle) => ({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume ?? 0,
        closed: candle.closed,
      })));
    }
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
  }, [
    binanceSelected,
    fxcmSelected,
    fxcmLive,
    history,
    liveKline.kline,
    liveKline.subscribedSymbol,
    liveKline.timeframe,
    selectedMarket,
    timeframe,
  ]);

  const historyReady = Boolean(
    (binanceSelected
      && history.state === "ready"
      && history.symbol === selectedMarket?.symbol
      && history.timeframe === timeframe
      && candles.length > 0)
    || (fxcmSelected && fxcmLive.state === "ready" && candles.length > 0),
  );

  const connection = fxcmSelected
    ? (fxcmLive.live ? "LIVE"
      : fxcmLive.state === "ready" ? "CONNECTED"
        : fxcmLive.state === "loading" ? "CONNECTING"
          : "NO_DATA")
    : resolveKlineUiStatus(
      liveKline,
      binanceSymbol,
      timeframe,
      historyReady,
    );

  const marketState = useMemo(() => {
    if (!selectedMarket || candles.length === 0) return null;
    if (fxcmSelected) {
      return buildForexMarketState({
        symbol: selectedMarket.symbol,
        timeframe,
        candles,
        connection,
        lastMarketUpdateMs: fxcmLive.lastQuoteAt
          ? Date.parse(fxcmLive.lastQuoteAt)
          : (candles[candles.length - 1] ? candles[candles.length - 1]!.time * 1000 : null),
        provider: "FXCM",
        marketType: "FOREX",
        displaySymbol: selectedMarket.displaySymbol,
        providerSymbol: selectedMarket.symbol,
        canonicalSymbol: selectedMarket.symbol.replace(/[/_-\s]/g, "").toUpperCase(),
      });
    }
    if (!binanceSelected || !binanceSymbol) return null;
    if (!historyReady && candles.length === 0) return null;
    return buildForexMarketState({
      symbol: binanceSymbol,
      timeframe,
      candles,
      connection,
      lastMarketUpdateMs: liveKline.kline?.eventTimeUtc ?? (candles[candles.length - 1]
        ? candles[candles.length - 1]!.time * 1000
        : null),
      provider: "BINANCE",
      marketType: "SPOT",
    });
  }, [
    selectedMarket,
    fxcmSelected,
    binanceSelected,
    binanceSymbol,
    timeframe,
    candles,
    connection,
    historyReady,
    liveKline.kline?.eventTimeUtc,
    fxcmLive.lastQuoteAt,
  ]);

  return {
    marketState,
    loading: Boolean(
      (binanceSelected && history.state === "loading")
      || (fxcmSelected && fxcmLive.state === "loading"),
    ),
  };
}
