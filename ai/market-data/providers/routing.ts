/**
 * Provider routing helpers — prevent Binance/FXCM symbol collisions.
 * Phase 31: explicit provider is mandatory for authoritative requests;
 * heuristics are only for legacy convenience and never imply fallback.
 */
import { marketIdentityKey as identityKey } from "./identity.js";
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
 * Explicit provider always wins. No silent cross-provider fallback.
 */
export function resolveMarketProviderForSymbol(
  symbol: string,
  explicit?: MarketProviderId | string | null,
): MarketProviderId {
  const p = String(explicit ?? "").trim().toUpperCase();
  if (p === "BINANCE" || p === "FXCM" || p === "FOREXCONNECT") return p;
  if (looksLikeBinanceCryptoSymbol(symbol)) return "BINANCE";
  if (looksLikeFxcmForexSymbol(symbol)) return "FXCM";
  // Default existing crypto path for ambiguous compact symbols.
  return "BINANCE";
}

/** @deprecated Prefer identity.marketIdentityKey — kept for Phase 25 tests. */
export function marketIdentityKey(input: {
  provider: MarketProviderId;
  marketType: string;
  symbol: string;
}): string {
  return identityKey(input);
}

/**
 * Reject requests that would silently substitute another provider.
 * Returns an error code when the explicit provider is missing or unknown.
 */
export function requireExplicitProvider(
  explicit?: MarketProviderId | string | null,
): { ok: true; provider: MarketProviderId } | { ok: false; code: "PROVIDER_REQUIRED" | "UNKNOWN_PROVIDER"; message: string } {
  const raw = String(explicit ?? "").trim();
  if (!raw) {
    return {
      ok: false,
      code: "PROVIDER_REQUIRED",
      message: "provider is required. Never route by symbol alone.",
    };
  }
  const p = raw.toUpperCase();
  if (p === "BINANCE" || p === "FXCM" || p === "FOREXCONNECT") return { ok: true, provider: p };
  return {
    ok: false,
    code: "UNKNOWN_PROVIDER",
    message: `Unknown provider "${raw}". Supported: BINANCE, FXCM, FOREXCONNECT.`,
  };
}
