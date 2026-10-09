/**
 * Client Market State — builds from the SAME unified candle hook as Charts/TA.
 * Provider identity retained; no Binance↔FXCM silent fallback.
 */
import { useMemo } from "react";
import { applyLiveKline } from "../../../ai/market-data/binance/adapter";
import { buildForexMarketState, type ForexBinanceMarketState } from "../../../ai/forex-market-state";
import type { ChartTimeframeId } from "../chart/types";
import { sanitizeCandles } from "../chart/validate-candles";
import {
  isBinanceSpotSelection,
  isForexConnectSelection,
  isFxcmSelection,
  type SelectedMarket,
} from "./selected-market";
import { useBinanceLiveKline } from "./use-binance-live-kline";
import { useUnifiedCandles } from "./use-unified-candles";
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
  const forexConnectSelected = isForexConnectSelection(selectedMarket);
  const provider = forexConnectSelected
    ? "FOREXCONNECT" as const
    : fxcmSelected
      ? "FXCM" as const
      : binanceSelected
        ? "BINANCE" as const
        : null;
  const symbol = (binanceSelected || fxcmSelected || forexConnectSelected) && selectedMarket
    ? selectedMarket.symbol
    : null;

  const unified = useUnifiedCandles(provider, symbol, timeframe, {
    marketType: (fxcmSelected || forexConnectSelected) ? "FOREX" : binanceSelected ? "CRYPTO" : null,
  });
  const liveKline = useBinanceLiveKline(binanceSelected && selectedMarket ? selectedMarket.symbol : null, timeframe);

  const candles = useMemo(() => {
    if (!provider || !symbol) return [];
    if (
      unified.state === "loading"
      || unified.state === "error"
      || unified.state === "unavailable"
      || unified.state === "empty"
    ) {
      return [];
    }
    if (unified.provider !== provider || unified.symbol !== symbol || unified.timeframe !== timeframe) {
      return [];
    }
    const base = sanitizeCandles(unified.candles.map((candle) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume ?? 0,
      closed: candle.closed,
    })));
    if (!binanceSelected || !selectedMarket) return base;
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
    provider,
    symbol,
    unified,
    binanceSelected,
    liveKline.kline,
    liveKline.subscribedSymbol,
    liveKline.timeframe,
    selectedMarket,
    timeframe,
  ]);

  const historyReady = Boolean(
    provider
    && symbol
    && (unified.state === "ready" || unified.state === "live" || unified.state === "stale"
      || unified.state === "connecting" || unified.state === "reconnecting")
    && unified.provider === provider
    && unified.symbol === symbol
    && unified.timeframe === timeframe
    && candles.length > 0,
  );

  const connection = (fxcmSelected || forexConnectSelected)
    ? (unified.live ? "LIVE"
      : unified.state === "ready" || unified.state === "stale" ? "CONNECTED"
        : unified.state === "loading" ? "CONNECTING"
          : "NO_DATA")
    : resolveKlineUiStatus(
      liveKline,
      binanceSelected && selectedMarket ? selectedMarket.symbol : null,
      timeframe,
      historyReady,
    );

  const marketState = useMemo(() => {
    if (!selectedMarket || candles.length === 0) return null;
    if (fxcmSelected || forexConnectSelected) {
      return buildForexMarketState({
        symbol: selectedMarket.symbol,
        timeframe,
        candles,
        connection,
        lastMarketUpdateMs: unified.lastQuoteAt
          ? Date.parse(unified.lastQuoteAt)
          : (candles[candles.length - 1] ? candles[candles.length - 1]!.time * 1000 : null),
        provider: forexConnectSelected ? "FOREXCONNECT" : "FXCM",
        marketType: "FOREX",
        displaySymbol: selectedMarket.displaySymbol,
        providerSymbol: selectedMarket.symbol,
        canonicalSymbol: selectedMarket.symbol.replace(/[/_-\s]/g, "").toUpperCase(),
      });
    }
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
      provider: "BINANCE",
      marketType: "SPOT",
    });
  }, [
    selectedMarket,
    fxcmSelected,
    forexConnectSelected,
    binanceSelected,
    symbol,
    timeframe,
    candles,
    connection,
    historyReady,
    liveKline.kline?.eventTimeUtc,
    unified.lastQuoteAt,
  ]);

  return {
    marketState,
    loading: Boolean(provider && symbol && unified.state === "loading"),
  };
}
