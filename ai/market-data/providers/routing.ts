/**
 * Provider routing helpers — prevent Binance/FXCM symbol collisions.
 */
import type { MarketProviderId } from "./types.js";

const CRYPTO_SUFFIXES = ["USDT", "USDC", "BUSD", "BTC", "ETH", "BNB", "FDUSD", "TUSD"];

/** Compact Binance-style crypto symbols (e.g. BTCUSDT). */
export function looksLikeBinanceCryptoSymbol(symbol: string): boolean {
  const s = String(symbol ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,30}$/.test(s)) return false;
  if (s.includes("/")) return false;
  return CRYPTO_SUFFIXES.some((suffix) => s.endsWith(suffix) && s.length > suffix.length);
}

/** FXCM-style Forex/CFD symbols (e.g. EUR/USD) or compact FX pairs without crypto suffix. */
export function looksLikeFxcmForexSymbol(symbol: string): boolean {
  const s = String(symbol ?? "").trim().toUpperCase();
  if (s.includes("/")) return true;
  if (looksLikeBinanceCryptoSymbol(s)) return false;
  // Compact 6-letter FX pairs (EURUSD) — not crypto.
  if (/^[A-Z]{6}$/.test(s)) return true;
  return false;
}

/**
 * Select provider for a symbol request.
 * Explicit provider always wins. Otherwise heuristics route crypto→BINANCE, FX→FXCM.
 */
export function resolveMarketProviderForSymbol(
  symbol: string,
  explicit?: MarketProviderId | string | null,
): MarketProviderId {
  const p = String(explicit ?? "").trim().toUpperCase();
  if (p === "BINANCE" || p === "FXCM") return p;
  if (looksLikeBinanceCryptoSymbol(symbol)) return "BINANCE";
  if (looksLikeFxcmForexSymbol(symbol)) return "FXCM";
  // Default existing crypto path for ambiguous compact symbols.
  return "BINANCE";
}

export function marketIdentityKey(input: {
  provider: MarketProviderId;
  marketType: string;
  symbol: string;
}): string {
  return `${input.provider}|${input.marketType}|${String(input.symbol).toUpperCase()}`;
}
