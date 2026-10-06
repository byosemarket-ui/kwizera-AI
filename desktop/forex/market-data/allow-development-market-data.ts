/**
 * Development/demo OHLCV is isolated for tests and local experiments only.
 * Production Forex UI must never serve fabricated market data.
 */
export function allowDevelopmentMarketData(): boolean {
  if (typeof process !== "undefined") {
    if (process.env.KWIZERA_ALLOW_DEV_MARKET_DATA === "1") return true;
    // Vitest sets VITEST=true — unit tests may exercise the generator explicitly.
    if (process.env.VITEST === "true" || process.env.VITEST === "1") return true;
  }
  try {
    // Vite: never allow fabricated series in production builds.
    // @ts-expect-error import.meta.env is provided by Vite
    if (import.meta?.env?.PROD === true) return false;
    // @ts-expect-error import.meta.env is provided by Vite
    if (import.meta?.env?.DEV === true && import.meta?.env?.MODE === "development") {
      return process.env.KWIZERA_ALLOW_DEV_MARKET_DATA === "1";
    }
  } catch {
    /* ignore non-Vite runtimes */
  }
  return false;
}

export const LIVE_MARKET_UNAVAILABLE = "Live Binance market data is not connected for this symbol.";
export const LIVE_PRICE_UNAVAILABLE = "Live market data unavailable.";
