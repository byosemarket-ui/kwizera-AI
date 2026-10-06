/**
 * Public Binance market-data foundation API.
 * GET /api/forex/binance/status — reachability probe only. No trading. No secrets.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
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
    if (url.pathname !== "/api/forex/binance/status") {
      sendJson(res, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "Unknown Binance foundation route." },
      });
      return true;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, {
        ok: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Use GET /api/forex/binance/status." },
      });
      return true;
    }

    const snapshot = await binance.probePublicRest();
    const config = binance.getConfig();
    sendJson(res, snapshot.state === "ERROR" ? 503 : 200, {
      ok: snapshot.state !== "ERROR",
      snapshot,
      public: {
        restBaseHost: config.restBaseHost,
        websocketPrepared: true,
        tradingEnabled: false,
      },
    });
    return true;
  } catch {
    sendJson(res, 503, {
      ok: false,
      error: { code: "BINANCE_NETWORK", message: "Market data is temporarily unavailable." },
    });
    return true;
  }
}
