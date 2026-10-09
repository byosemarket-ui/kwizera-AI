/**
 * Forex Market State API — Phases 18 + 31.
 * GET /api/forex/market-state?provider=BINANCE&symbol=BTCUSDT&timeframe=15m
 * GET /api/forex/market-state?provider=FXCM&symbol=EUR/USD&timeframe=15m
 *
 * Routes candles through the unified MarketDataService. No cross-provider fallback.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildForexMarketState, toForexAiMarketState } from "../../ai/forex-market-state/index.js";
import { parseCanonicalTimeframe } from "../../ai/market-data/providers/contracts.js";
import { parseMarketProviderId } from "../../ai/market-data/providers/identity.js";
import {
  getMarketDataService,
  MarketDataRoutingError,
} from "../../ai/market-data/providers/market-data-service.js";
import { userFacingBinanceError } from "../../ai/market-data/binance/errors.js";
import { userFacingFxcmError } from "../../ai/market-data/fxcm/errors.js";
import { resolveMarketProviderForSymbol } from "../../ai/market-data/providers/routing.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

export async function handleForexMarketStateApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (url.pathname !== "/api/forex/market-state") return false;

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Use GET for market state." },
    });
    return true;
  }

  const symbolRaw = (url.searchParams.get("symbol") ?? "").trim();
  const timeframeRaw = (url.searchParams.get("timeframe") ?? "").trim().toLowerCase();
  const timeframe = parseCanonicalTimeframe(timeframeRaw);
  const explicitProvider = parseMarketProviderId(url.searchParams.get("provider"));
  // Legacy Binance callers omit provider — keep Binance default for compact crypto only.
  const provider = explicitProvider
    ?? resolveMarketProviderForSymbol(symbolRaw, null);

  if (!symbolRaw || !timeframe) {
    sendJson(res, 400, {
      ok: false,
      error: {
        code: "INVALID_QUERY",
        message: "Require symbol and supported timeframe (e.g. 15m). Prefer explicit provider.",
      },
    });
    return true;
  }

  try {
    const service = getMarketDataService();
    const series = provider === "FXCM"
      ? (service.getLiveCandleSeries({ provider, symbol: symbolRaw, timeframe })
        ?? await service.getHistoricalCandles({ provider, symbol: symbolRaw, timeframe, limit: 300 }))
      : await service.getHistoricalCandles({ provider, symbol: symbolRaw, timeframe, limit: 300 });

    if (series.identity.provider !== provider) {
      sendJson(res, 409, {
        ok: false,
        error: {
          code: "PROVIDER_MISMATCH",
          message: "Candle series provider does not match the requested provider.",
        },
      });
      return true;
    }

    const connection = series.connectionState === "LIVE" ? "LIVE"
      : series.connectionState === "CONNECTED" ? "CONNECTED"
        : series.connectionState === "STALE" ? "DISCONNECTED"
          : series.candles.length > 0 ? "CONNECTED" : "NO_DATA";

    const marketState = buildForexMarketState({
      symbol: series.identity.canonicalSymbol,
      timeframe: series.timeframe,
      candles: series.candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume ?? 0,
        closed: c.isClosed,
      })),
      connection,
      lastMarketUpdateMs: series.lastQuoteAt
        ? Date.parse(series.lastQuoteAt)
        : (series.candles.length ? series.candles[series.candles.length - 1]!.time * 1000 : null),
      provider,
      marketType: provider === "FXCM" ? "FOREX" : "SPOT",
      displaySymbol: series.identity.displaySymbol,
      providerSymbol: series.identity.providerSymbol,
      canonicalSymbol: series.identity.canonicalSymbol,
    });
    const aiMarketState = toForexAiMarketState(marketState);

    sendJson(res, 200, {
      ok: true,
      success: true,
      provider,
      marketState,
      aiMarketState,
      note: "Market State via unified MarketDataService. Provider identity retained. No cross-provider fallback.",
    });
    return true;
  } catch (error) {
    if (error instanceof MarketDataRoutingError) {
      sendJson(res, 400, {
        ok: false,
        success: false,
        error: { code: error.code, message: error.message },
      });
      return true;
    }
    if (provider === "FXCM") {
      const mapped = userFacingFxcmError(error);
      sendJson(res, 503, {
        ok: false,
        success: false,
        error: { code: mapped.code, message: mapped.message },
      });
      return true;
    }
    const mapped = userFacingBinanceError(error);
    sendJson(res, mapped.code === "BINANCE_DISABLED" ? 503 : 503, {
      ok: false,
      success: false,
      error: { code: mapped.code, message: mapped.message },
    });
    return true;
  }
}
