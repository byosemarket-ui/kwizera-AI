import { BINANCE_PUBLIC_REST_PATHS, type BinancePublicConfig } from "./config.js";
import { BinanceMarketDataError } from "./errors.js";

export type FetchLike = typeof fetch;

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new BinanceMarketDataError("BINANCE_INVALID_RESPONSE", "Binance returned a non-JSON payload.", response.status);
  }
}

export async function binancePublicGet(
  config: BinancePublicConfig,
  pathname: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ status: number; body: unknown; durationMs: number }> {
  if (!config.enabled) {
    throw new BinanceMarketDataError("BINANCE_DISABLED", "Binance public market data is disabled.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const started = Date.now();
  try {
    const response = await fetchImpl(`${config.restBaseUrl}${pathname}`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const body = await readJson(response);
    if (!response.ok) {
      throw new BinanceMarketDataError(
        "BINANCE_HTTP",
        "Binance public API returned an error.",
        response.status,
      );
    }
    return { status: response.status, body, durationMs: Date.now() - started };
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

export async function pingBinancePublicRest(
  config: BinancePublicConfig,
  fetchImpl: FetchLike = fetch,
): Promise<{ serverTimeUtc: number | null; durationMs: number }> {
  await binancePublicGet(config, BINANCE_PUBLIC_REST_PATHS.ping, fetchImpl);
  try {
    const time = await binancePublicGet(config, BINANCE_PUBLIC_REST_PATHS.time, fetchImpl);
    const payload = time.body as { serverTime?: number };
    const serverTimeUtc = typeof payload.serverTime === "number" ? payload.serverTime : null;
    return { serverTimeUtc, durationMs: time.durationMs };
  } catch {
    return { serverTimeUtc: null, durationMs: 0 };
  }
}
