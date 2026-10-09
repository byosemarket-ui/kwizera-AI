/**
 * Phase 31 — Unified Market Data API.
 * Routes by explicit provider. Never silently falls back across providers.
 *
 * GET  /api/forex/market-data/status
 * GET  /api/forex/market-data/instruments
 * GET  /api/forex/market-data/candles
 * GET  /api/forex/market-data/quote
 * GET  /api/forex/market-data/snapshot
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createMarketDataService,
  MarketDataRoutingError,
  getMarketDataService,
  type MarketDataService,
} from "../../ai/market-data/providers/market-data-service.js";
import { parseMarketProviderId } from "../../ai/market-data/providers/identity.js";
import { userFacingBinanceError } from "../../ai/market-data/binance/errors.js";
import {
  ForexConnectMarketDataError,
  userFacingForexConnectError,
} from "../../ai/market-data/forexconnect/errors.js";
import { FxcmMarketDataError, userFacingFxcmError } from "../../ai/market-data/fxcm/errors.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

let serviceSingleton: MarketDataService | null = null;

function getService(): MarketDataService {
  serviceSingleton ??= getMarketDataService();
  return serviceSingleton;
}

function mapError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof MarketDataRoutingError) {
    return { status: 400, code: error.code, message: error.message };
  }
  // ForexConnect before FXCM — userFacingFxcmError defaults unknown errors to FXCM_UNAVAILABLE.
  if (
    error instanceof ForexConnectMarketDataError
    || String((error as { code?: string })?.code ?? "").startsWith("FOREXCONNECT_")
    || /forexconnect/i.test(error instanceof Error ? error.message : String(error ?? ""))
  ) {
    const fc = userFacingForexConnectError(error);
    return {
      status: fc.code === "FOREXCONNECT_DISABLED" || fc.code === "FOREXCONNECT_NOT_CONFIGURED"
        ? 503
        : fc.code.includes("UNSUPPORTED") || fc.code.includes("INVALID")
          ? 400
          : 502,
      code: fc.code,
      message: fc.message,
    };
  }
  if (error instanceof FxcmMarketDataError) {
    const fxcm = userFacingFxcmError(error);
    return {
      status: fxcm.code === "FXCM_DISABLED" || fxcm.code === "FXCM_NOT_CONFIGURED" ? 503 : 502,
      code: fxcm.code,
      message: fxcm.message,
    };
  }
  const binance = userFacingBinanceError(error);
  if (String(binance.code).startsWith("BINANCE_")) {
    return {
      status: binance.code === "BINANCE_DISABLED" ? 503 : 502,
      code: binance.code,
      message: binance.message,
    };
  }
  const fxcm = userFacingFxcmError(error);
  return {
    status: fxcm.code === "FXCM_DISABLED" || fxcm.code === "FXCM_NOT_CONFIGURED" ? 503 : 502,
    code: fxcm.code,
    message: fxcm.message,
  };
}

export async function handleForexMarketDataApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/market-data")) return false;

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Use GET for unified market-data routes." },
    });
    return true;
  }

  const service = getService();

  try {
    if (url.pathname === "/api/forex/market-data/status") {
      const provider = parseMarketProviderId(url.searchParams.get("provider"));
      const health = await service.getProviderHealth(provider);
      sendJson(res, 200, {
        ok: true,
        phase: 31,
        providers: health,
        note: "Unified market-data health. Trading disabled. No cross-provider fallback.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/market-data/instruments") {
      const provider = url.searchParams.get("provider");
      const marketType = url.searchParams.get("marketType");
      const search = url.searchParams.get("search");
      const refresh = url.searchParams.get("refresh") === "1";
      const instruments = await service.listInstruments({
        provider,
        marketType,
        search,
        refresh,
        limit: Number(url.searchParams.get("limit") ?? 500) || 500,
      });
      sendJson(res, 200, {
        ok: true,
        count: instruments.length,
        instruments,
        note: "Unified instrument catalog. Each row retains provider identity.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/market-data/candles") {
      const provider = url.searchParams.get("provider");
      const symbol = url.searchParams.get("symbol") ?? "";
      const timeframe = url.searchParams.get("timeframe") ?? "";
      const marketType = url.searchParams.get("marketType");
      const mode = (url.searchParams.get("mode") ?? "historical").toLowerCase();
      if (!provider || !symbol || !timeframe) {
        sendJson(res, 400, {
          ok: false,
          error: {
            code: "INVALID_QUERY",
            message: "Require provider, symbol, and timeframe. Provider is never inferred silently for candles.",
          },
        });
        return true;
      }
      const series = mode === "live"
        ? await service.subscribeLiveCandles({ provider, symbol, timeframe, marketType })
        : await service.getHistoricalCandles({
            provider,
            symbol,
            timeframe,
            marketType,
            limit: Number(url.searchParams.get("limit") ?? 300) || 300,
            refresh: url.searchParams.get("refresh") === "1",
          });
      sendJson(res, 200, {
        ok: true,
        series,
        note: "Normalized candles from the unified Market Data Service.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/market-data/quote") {
      const provider = url.searchParams.get("provider");
      const symbol = url.searchParams.get("symbol") ?? "";
      if (!provider || !symbol) {
        sendJson(res, 400, {
          ok: false,
          error: { code: "INVALID_QUERY", message: "Require provider and symbol." },
        });
        return true;
      }
      const quote = await service.getCurrentQuote({
        provider,
        symbol,
        marketType: url.searchParams.get("marketType"),
      });
      sendJson(res, 200, {
        ok: true,
        quote,
        note: quote
          ? "Normalized quote from the requested provider only."
          : "No current quote for this provider/symbol (Binance live quotes remain on the browser ticker path).",
      });
      return true;
    }

    if (url.pathname === "/api/forex/market-data/snapshot") {
      const provider = url.searchParams.get("provider");
      const symbol = url.searchParams.get("symbol") ?? "";
      const timeframe = url.searchParams.get("timeframe") ?? "15m";
      if (!provider || !symbol) {
        sendJson(res, 400, {
          ok: false,
          error: { code: "INVALID_QUERY", message: "Require provider and symbol." },
        });
        return true;
      }
      const snapshot = await service.getSnapshot({
        provider,
        symbol,
        timeframe,
        marketType: url.searchParams.get("marketType"),
      });
      sendJson(res, 200, {
        ok: true,
        snapshot,
        note: "Unified current-market snapshot for Market State / Charts consumers.",
      });
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: { code: "NOT_FOUND", message: "Unknown market-data route." },
    });
    return true;
  } catch (error) {
    const mapped = mapError(error);
    sendJson(res, mapped.status, {
      ok: false,
      error: { code: mapped.code, message: mapped.message },
    });
    return true;
  }
}

/** Test helper */
export function createForexMarketDataApiService(options?: ConstructorParameters<typeof MarketDataService>[0]): MarketDataService {
  return createMarketDataService(options);
}
