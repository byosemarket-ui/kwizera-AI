/**
 * Phase 56.2.8 — configurable freshness thresholds by provider / asset class.
 * Defaults are explicit policy decisions grounded in existing FOREXCONNECT_STALE_MS / MARKET_QUOTE_STALE_MS (15s).
 */
import type { MarketAssetType, MarketProviderId } from "../providers/types.js";
import type { InstrumentReadinessFreshnessPolicy } from "./types.js";

/** Align with ForexConnect Offers LIVE gate and AT MARKET_QUOTE_STALE_MS. */
export const DEFAULT_QUOTE_STALE_MS = 15_000;

const ASSET_CLASS_OVERRIDES_MS: Partial<Record<MarketAssetType, number>> = {
  // Crypto venues often tick faster; keep the same 15s LIVE definition unless provider docs differ.
  CRYPTO: 15_000,
  FOREX: 15_000,
  COMMODITY: 15_000,
  INDEX: 15_000,
  STOCK: 15_000,
  SHARE: 15_000,
};

export function resolveInstrumentFreshnessPolicy(input: {
  provider: MarketProviderId;
  marketType?: MarketAssetType | string | null;
  overrideStaleMs?: number | null;
}): InstrumentReadinessFreshnessPolicy {
  if (
    typeof input.overrideStaleMs === "number"
    && Number.isFinite(input.overrideStaleMs)
    && input.overrideStaleMs > 0
  ) {
    return {
      quoteStaleMs: Math.floor(input.overrideStaleMs),
      source: "explicit_override",
      rationale: "Caller-supplied stale threshold (tests / admin probe).",
    };
  }

  const asset = String(input.marketType ?? "").toUpperCase() as MarketAssetType;
  const assetMs = ASSET_CLASS_OVERRIDES_MS[asset];
  if (assetMs != null) {
    return {
      quoteStaleMs: assetMs,
      source: `policy:${input.provider}:${asset}`,
      rationale:
        "Default 15s genuine bid/ask change window — matches ForexConnect LIVE gate and AT MARKET_QUOTE_STALE_MS. "
        + "Not a universal claim for every future venue; override when provider docs require otherwise.",
    };
  }

  return {
    quoteStaleMs: DEFAULT_QUOTE_STALE_MS,
    source: `policy:${input.provider}:DEFAULT`,
    rationale:
      "Fallback 15s quote stale window from existing FOREXCONNECT_STALE_MS / MARKET_QUOTE_STALE_MS policy. "
      + "Unknown asset class does not invent a looser threshold.",
  };
}
