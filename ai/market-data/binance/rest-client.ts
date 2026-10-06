import {
  BINANCE_EXCHANGE_INFO_TIMEOUT_MS,
  BINANCE_PUBLIC_REST_PATHS,
  type BinancePublicConfig,
} from "./config.js";
import { BinanceMarketDataError } from "./errors.js";

export type FetchLike = typeof fetch;

const PUBLIC_HEADERS = {
  Accept: "application/json",
  "User-Agent": "KwizeraAIStudio/1.0 (public-market-data)",
};

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new BinanceMarketDataError("BINANCE_INVALID_RESPONSE", "Binance returned a non-JSON payload.", response.status);
  }
}

async function getFromBase(
  baseUrl: string,
  pathname: string,
  timeoutMs: number,
  fetchImpl: FetchLike,
): Promise<{ status: number; body: unknown; durationMs: number; restBaseUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetchImpl(`${baseUrl}${pathname}`, {
      method: "GET",
      signal: controller.signal,
      headers: PUBLIC_HEADERS,
    });
    const body = await readJson(response);
    if (!response.ok) {
      throw new BinanceMarketDataError(
        "BINANCE_HTTP",
        "Binance public API returned an error.",
        response.status,
      );
    }
    return { status: response.status, body, durationMs: Date.now() - started, restBaseUrl: baseUrl };
  } catch (error) {
    if (error instanceof BinanceMarketDataError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new BinanceMarketDataError("BINANCE_TIMEOUT", "Binance public API timed out.");
    }
    throw new BinanceMarketDataError("BINANCE_NETWORK", "Could not reach Binance public API.");
  } finally {
    clearTimeout(timer);
  }
}

export async function binancePublicGet(
  config: BinancePublicConfig,
  pathname: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = config.timeoutMs,
): Promise<{ status: number; body: unknown; durationMs: number; restBaseUrl: string }> {
  if (!config.enabled) {
    throw new BinanceMarketDataError("BINANCE_DISABLED", "Binance public market data is disabled.");
  }
  const bases = config.restFallbackUrls.length > 0 ? config.restFallbackUrls : [config.restBaseUrl];
  let lastError: unknown;
  for (const base of bases) {
    try {
      return await getFromBase(base, pathname, timeoutMs, fetchImpl);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof BinanceMarketDataError) throw lastError;
  throw new BinanceMarketDataError("BINANCE_NETWORK", "Could not reach Binance public API.");
}

export async function pingBinancePublicRest(
  config: BinancePublicConfig,
  fetchImpl: FetchLike = fetch,
): Promise<{ serverTimeUtc: number | null; durationMs: number; restBaseUrl: string }> {
  const ping = await binancePublicGet(config, BINANCE_PUBLIC_REST_PATHS.ping, fetchImpl);
  try {
    const time = await getFromBase(ping.restBaseUrl, BINANCE_PUBLIC_REST_PATHS.time, config.timeoutMs, fetchImpl);
    const payload = time.body as { serverTime?: number };
    const serverTimeUtc = typeof payload.serverTime === "number" ? payload.serverTime : null;
    return { serverTimeUtc, durationMs: time.durationMs, restBaseUrl: ping.restBaseUrl };
  } catch {
    return { serverTimeUtc: null, durationMs: ping.durationMs, restBaseUrl: ping.restBaseUrl };
  }
}

export async function fetchBinanceExchangeInfo(
  config: BinancePublicConfig,
  fetchImpl: FetchLike = fetch,
): Promise<{ body: unknown; restBaseUrl: string }> {
  const result = await binancePublicGet(
    config,
    BINANCE_PUBLIC_REST_PATHS.exchangeInfo,
    fetchImpl,
    Math.max(config.timeoutMs, BINANCE_EXCHANGE_INFO_TIMEOUT_MS),
  );
  return { body: result.body, restBaseUrl: result.restBaseUrl };
}

export async function fetchBinanceKlines(
  config: BinancePublicConfig,
  options: { symbol: string; interval: string; limit?: number },
  fetchImpl: FetchLike = fetch,
): Promise<{ body: unknown; restBaseUrl: string }> {
  const limit = Math.min(1000, Math.max(50, options.limit ?? 300));
  const path = `${BINANCE_PUBLIC_REST_PATHS.klines}?symbol=${encodeURIComponent(options.symbol)}&interval=${encodeURIComponent(options.interval)}&limit=${limit}`;
  const result = await binancePublicGet(
    config,
    path,
    fetchImpl,
    Math.max(config.timeoutMs, 15000),
  );
  return { body: result.body, restBaseUrl: result.restBaseUrl };
}
