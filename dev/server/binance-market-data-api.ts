/**
 * Public Binance market-data API.
 * GET /api/forex/binance/status — reachability
 * GET /api/forex/binance/markets — Spot discovery (no prices, no trading)
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { userFacingBinanceError } from "../../ai/market-data/binance/errors.js";
import { createBinanceMarketDataService, type BinanceMarketDataService } from "../../ai/market-data/binance/service.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

let defaultService: BinanceMarketDataService | null = null;

function getDefaultService(): BinanceMarketDataService {
  defaultService ??= createBinanceMarketDataService();
  return defaultService;
}

export function createBinanceMarketDataHandler(options?: {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): { handle: typeof handleBinanceMarketDataApi } {
  const isolated = createBinanceMarketDataService({
    env: options?.env,
    fetchImpl: options?.fetchImpl,
  });
  return {
    handle: (req, res, url, sendJson) => handleWithService(isolated, req, res, url, sendJson),
  };
}

export async function handleBinanceMarketDataApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  return handleWithService(getDefaultService(), req, res, url, sendJson);
}

async function handleWithService(
  binance: BinanceMarketDataService,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/binance")) return false;

  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, {
        ok: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Use GET on Binance public market-data routes." },
      });
      return true;
    }

    if (url.pathname === "/api/forex/binance/status") {
      const snapshot = await binance.probePublicRest();
      const config = binance.getConfig();
      sendJson(res, snapshot.state === "ERROR" ? 503 : 200, {
        ok: snapshot.state !== "ERROR",
        snapshot,
        public: {
          restBaseHost: snapshot.restBaseHost || config.restBaseHost,
          websocketPrepared: true,
          tradingEnabled: false,
          marketType: "spot",
        },
      });
      return true;
    }

    if (url.pathname === "/api/forex/binance/markets") {
      const refresh = url.searchParams.get("refresh") === "1";
      const catalog = await binance.listSpotMarkets({ refresh });
      sendJson(res, 200, {
        ok: true,
        markets: catalog.markets,
        count: catalog.markets.length,
        fetchedAtUtc: catalog.fetchedAtUtc,
        restBaseHost: catalog.restBaseHost,
        marketType: catalog.marketType,
        cached: catalog.cached,
        liveMarketData: false,
        note: "Spot market metadata only. Live prices are not included.",
      });
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: { code: "NOT_FOUND", message: "Unknown Binance foundation route." },
    });
    return true;
  } catch (error) {
    const mapped = userFacingBinanceError(error);
    sendJson(res, mapped.code === "BINANCE_DISABLED" ? 503 : 503, {
      ok: false,
      error: { code: mapped.code, message: mapped.code === "BINANCE_DISABLED"
        ? "Binance market service unavailable."
        : "Unable to load Binance markets." },
      liveMarketData: false,
    });
    return true;
  }
}
