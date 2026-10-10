/**
 * Phase 32 — Cross-module identity consistency helpers.
 * Ensures Dashboard / Charts / TA / AI / Memory agree on provider-aware identity.
 */
import { marketIdentityKey, normalizeCanonicalSymbol } from "../../../ai/market-data/providers/identity";
import type { MarketProviderId } from "../../../ai/market-data/providers/types";
import type { SelectedMarket } from "./selected-market";
import type { ChartTimeframeId } from "../chart/types";

export interface ForexMarketIdentityView {
  provider: MarketProviderId;
  marketType: string;
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  timeframe: ChartTimeframeId | string;
}

export function identityFromSelectedMarket(
  market: SelectedMarket,
  timeframe: ChartTimeframeId | string,
): ForexMarketIdentityView {
  const provider: MarketProviderId = market.provider === "FOREXCONNECT" || market.venue === "forexconnect"
    ? "FOREXCONNECT"
    : market.provider === "FXCM" || market.venue === "fxcm"
      ? "FXCM"
      : "BINANCE";
  const canonicalSymbol = normalizeCanonicalSymbol(market.symbol);
  return {
    provider,
    marketType: provider === "BINANCE" ? "CRYPTO" : "FOREX",
    providerSymbol: market.symbol,
    canonicalSymbol,
    displaySymbol: market.displaySymbol,
    timeframe,
  };
}

export function identityKeyFromView(view: ForexMarketIdentityView): string {
  return `${marketIdentityKey({
    provider: view.provider,
    marketType: view.marketType,
    symbol: view.canonicalSymbol,
  })}:${String(view.timeframe).toLowerCase()}`;
}

/** True when two views describe the same provider+instrument+timeframe. */
export function identitiesAgree(a: ForexMarketIdentityView, b: ForexMarketIdentityView): boolean {
  return identityKeyFromView(a) === identityKeyFromView(b);
}

export function assertSameProvider(a: ForexMarketIdentityView, b: ForexMarketIdentityView): boolean {
  return a.provider === b.provider;
}

/** FXCM EURUSD and Binance EURUSDC must never share an identity key. */
export function marketsAreDistinct(
  left: { provider: MarketProviderId; symbol: string; marketType?: string },
  right: { provider: MarketProviderId; symbol: string; marketType?: string },
): boolean {
  const leftKey = marketIdentityKey({
    provider: left.provider,
    marketType: left.marketType ?? (left.provider === "FXCM" ? "FOREX" : "CRYPTO"),
    symbol: left.symbol,
  });
  const rightKey = marketIdentityKey({
    provider: right.provider,
    marketType: right.marketType ?? (right.provider === "FXCM" ? "FOREX" : "CRYPTO"),
    symbol: right.symbol,
  });
  return leftKey !== rightKey;
}
