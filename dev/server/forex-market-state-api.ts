/**
 * Forex Market State API — Phase 18.
 * GET /api/forex/market-state?symbol=BTCUSDT&timeframe=15m
 *
 * Uses existing BinanceMarketDataService (REST klines). No second WebSocket.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildForexMarketState, toForexAiMarketState } from "../../ai/forex-market-state/index.js";
import { parseInterval } from "../../ai/market-data/binance/adapter.js";
import { createBinanceMarketDataService, type BinanceMarketDataService } from "../../ai/market-data/binance/service.js";
import { userFacingBinanceError } from "../../ai/market-data/binance/errors.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

let defaultService: BinanceMarketDataService | null = null;

function getService(): BinanceMarketDataService {
  defaultService ??= createBinanceMarketDataService();
  return defaultService;
}

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

  const symbolRaw = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();
  const timeframeRaw = (url.searchParams.get("timeframe") ?? "").trim().toLowerCase();
  const timeframe = parseInterval(timeframeRaw);
  if (!/^[A-Z0-9]{4,30}$/.test(symbolRaw) || !timeframe) {
    sendJson(res, 400, {
      ok: false,
      error: {
        code: "INVALID_QUERY",
        message: "Require symbol (e.g. BTCUSDT) and supported timeframe (e.g. 15m).",
      },
    });
    return true;
  }

  try {
    const binance = getService();
    const series = await binance.listKlines({ symbol: symbolRaw, timeframe, limit: 300 });
    const marketState = buildForexMarketState({
      symbol: series.symbol,
      timeframe: series.timeframe,
      candles: series.candles,
      connection: series.candles.length > 0 ? "CONNECTED" : "NO_DATA",
      lastMarketUpdateMs: series.candles.length
        ? series.candles[series.candles.length - 1]!.time * 1000
        : null,
    });
    const aiMarketState = toForexAiMarketState(marketState);

    sendJson(res, 200, {
      ok: true,
      success: true,
      marketState,
      aiMarketState,
      note: "REST snapshot via central Binance service. Live WS remains the Charts/TA stream; this endpoint does not open a second socket.",
    });
    return true;
  } catch (error) {
    const mapped = userFacingBinanceError(error);
    sendJson(res, mapped.code === "BINANCE_DISABLED" ? 503 : 503, {
      ok: false,
      success: false,
      error: { code: mapped.code, message: mapped.message },
    });
    return true;
  }
}
