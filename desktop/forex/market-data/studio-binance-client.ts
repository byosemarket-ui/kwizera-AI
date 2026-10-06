import type { MarketConnectionSnapshot } from "../../../ai/market-data/binance/types";
import { disconnectedSnapshot } from "../../../ai/market-data/binance/connection";
import { resolveBinancePublicConfig } from "../../../ai/market-data/binance/config";

const STATUS_PATH = "/api/forex/binance/status";

export async function fetchBinanceConnectionStatus(
  fetchImpl: typeof fetch = fetch,
): Promise<MarketConnectionSnapshot> {
  const fallback = disconnectedSnapshot(
    resolveBinancePublicConfig({ KWIZERA_ENV: "development" }),
    "Binance public API status is unavailable.",
  );
  try {
    const response = await fetchImpl(STATUS_PATH, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json() as { snapshot?: MarketConnectionSnapshot };
    if (!payload.snapshot || typeof payload.snapshot.state !== "string") {
      return { ...fallback, state: "ERROR", errorCode: "BINANCE_INVALID_RESPONSE", message: "Invalid Binance status payload." };
    }
    return {
      ...payload.snapshot,
      liveMarketData: false,
      websocketActive: false,
    };
  } catch {
    return {
      ...fallback,
      state: "ERROR",
      errorCode: "BINANCE_NETWORK",
      message: "Market data is temporarily unavailable.",
    };
  }
}
