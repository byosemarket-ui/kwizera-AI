/**
 * Phase 38C — Deterministic candlestick pattern API (read-only).
 * GET /api/forex/patterns/candlestick?provider=&symbol=&timeframe=&limit=
 *
 * Fetches candles via MarketDataService.getHistoricalCandles (same as market-data).
 * No admin mutations. No cross-provider fallback.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  detectCandlestickPatterns,
  fromUnifiedCandles,
  RULE_VERSION,
} from "../../ai/forex-patterns/index.js";
import { parseCanonicalTimeframe } from "../../ai/market-data/providers/contracts.js";
import { parseMarketProviderId } from "../../ai/market-data/providers/identity.js";
import {
  getMarketDataService,
  MarketDataRoutingError,
} from "../../ai/market-data/providers/market-data-service.js";
import { userFacingBinanceError } from "../../ai/market-data/binance/errors.js";
import {
  ForexConnectMarketDataError,
  userFacingForexConnectError,
} from "../../ai/market-data/forexconnect/errors.js";
import { FxcmMarketDataError, userFacingFxcmError } from "../../ai/market-data/fxcm/errors.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

function mapError(error: unknown, provider: string | null): { status: number; code: string; message: string } {
  if (error instanceof MarketDataRoutingError) {
    return { status: 400, code: error.code, message: error.message };
  }
  if (
    error instanceof ForexConnectMarketDataError
    || String((error as { code?: string })?.code ?? "").startsWith("FOREXCONNECT_")
  ) {
    const fc = userFacingForexConnectError(error);
    return {
      status: fc.code === "FOREXCONNECT_DISABLED" || fc.code === "FOREXCONNECT_NOT_CONFIGURED" ? 503 : 502,
      code: fc.code,
      message: fc.message,
    };
  }
  if (error instanceof FxcmMarketDataError || provider === "FXCM") {
    const fxcm = userFacingFxcmError(error);
    return {
      status: fxcm.code === "FXCM_DISABLED" || fxcm.code === "FXCM_NOT_CONFIGURED" ? 503 : 502,
      code: fxcm.code,
      message: fxcm.message,
    };
  }
  const binance = userFacingBinanceError(error);
  return {
    status: binance.code === "BINANCE_DISABLED" ? 503 : 502,
    code: binance.code,
    message: binance.message,
  };
}

export async function handleForexPatternsApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (url.pathname !== "/api/forex/patterns/candlestick") return false;

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Use GET for candlestick patterns." },
    });
    return true;
  }

  const symbolRaw = (url.searchParams.get("symbol") ?? "").trim();
  const timeframeRaw = (url.searchParams.get("timeframe") ?? "").trim().toLowerCase();
  const timeframe = parseCanonicalTimeframe(timeframeRaw);
  const provider = parseMarketProviderId(url.searchParams.get("provider"));
  const limitRaw = Number(url.searchParams.get("limit") ?? "300");
  const limit = Number.isFinite(limitRaw) ? Math.min(1000, Math.max(10, Math.floor(limitRaw))) : 300;

  if (!provider || !symbolRaw || !timeframe) {
    sendJson(res, 400, {
      ok: false,
      error: {
        code: "INVALID_QUERY",
        message: "Require provider (BINANCE|FXCM|FOREXCONNECT), symbol, and supported timeframe.",
      },
    });
    return true;
  }

  try {
    const service = getMarketDataService();
    const series = await service.getHistoricalCandles({
      provider,
      symbol: symbolRaw,
      timeframe,
      limit,
    });

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

    const priceBasis =
      provider === "FXCM" ? "mid"
        : provider === "FOREXCONNECT" ? "bid"
          : null;

    const analysis = detectCandlestickPatterns({
      provider,
      environment: series.identity.environment ?? null,
      symbol: series.identity.displaySymbol || series.identity.canonicalSymbol || symbolRaw,
      timeframe: series.timeframe,
      candles: fromUnifiedCandles(series.candles),
      includeForming: true,
      priceBasis,
    });

    sendJson(res, 200, {
      ok: true,
      analysis,
      ruleVersion: RULE_VERSION,
      note: "Deterministic candlestick patterns via MarketDataService. Educational only. No trade signal.",
    });
    return true;
  } catch (error) {
    const mapped = mapError(error, provider);
    sendJson(res, mapped.status, {
      ok: false,
      error: { code: mapped.code, message: mapped.message },
    });
    return true;
  }
}
