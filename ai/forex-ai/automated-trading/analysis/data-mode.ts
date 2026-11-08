/**
 * Stage 2 — Authoritative market data mode classification.
 * Historical/cached/synthetic must never silently become LIVE.
 * Closed market → explicit MARKET_CLOSED (not an application crash).
 */
export type MarketDataMode =
  | "LIVE"
  | "HISTORICAL"
  | "CACHED"
  | "STALE"
  | "SYNTHETIC"
  | "TEST"
  | "MARKET_CLOSED"
  | "UNKNOWN";

export interface DataModeClassification {
  dataMode: MarketDataMode;
  mayLabelAsLiveMarketPrice: boolean;
  mayClaimLiveProposalReady: boolean;
  code: string;
  reasons: string[];
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

/**
 * Classify data mode from analysis/freshness inputs. Fail closed.
 */
export function classifyMarketDataMode(input: {
  marketClosed?: boolean | null;
  /** Explicit fixture/test label from caller. */
  syntheticOrTest?: boolean | null;
  /** Explicit cached snapshot (e.g. weekend Offers cache). */
  cachedSnapshot?: boolean | null;
  quoteFresh?: boolean | null;
  historicalOnly?: boolean | null;
  freshnessOverall?: string | null;
  quoteProvenance?: string | null;
  candleIsHistoricalSeries?: boolean | null;
}): DataModeClassification {
  const reasons: string[] = [];
  const flags = {
    placesOrders: false as const,
    acceptsForExecution: false as const,
    mutatesBroker: false as const,
  };

  if (input.syntheticOrTest === true) {
    const mode: MarketDataMode =
      String(input.quoteProvenance || "").toUpperCase().includes("TEST") ? "TEST" : "SYNTHETIC";
    return {
      ...flags,
      dataMode: mode,
      mayLabelAsLiveMarketPrice: false,
      mayClaimLiveProposalReady: false,
      code: "SYNTHETIC_OR_TEST_DATA",
      reasons: ["Caller labelled data as synthetic/test — never LIVE."],
    };
  }

  if (input.marketClosed === true) {
    return {
      ...flags,
      dataMode: "MARKET_CLOSED",
      mayLabelAsLiveMarketPrice: false,
      mayClaimLiveProposalReady: false,
      code: "WAITING_FOR_LIVE_MARKET",
      reasons: ["Market closed — refuse LIVE price/proposal claims."],
    };
  }

  const prov = String(input.quoteProvenance || "").toUpperCase();
  if (prov === "CACHED" || input.cachedSnapshot === true) {
    return {
      ...flags,
      dataMode: "CACHED",
      mayLabelAsLiveMarketPrice: false,
      mayClaimLiveProposalReady: false,
      code: "CACHED_NOT_LIVE",
      reasons: ["Cached snapshot must not silently become LIVE."],
    };
  }
  if (prov === "STALE" || input.freshnessOverall === "STALE_QUOTE") {
    return {
      ...flags,
      dataMode: "STALE",
      mayLabelAsLiveMarketPrice: false,
      mayClaimLiveProposalReady: false,
      code: "STALE_NOT_LIVE",
      reasons: ["Stale quote/data — fail closed for LIVE claims."],
    };
  }
  if (prov === "HISTORICAL" || input.historicalOnly === true) {
    reasons.push("No fresh live quote/ticks — historical/candle path only.");
    return {
      ...flags,
      dataMode: "HISTORICAL",
      mayLabelAsLiveMarketPrice: false,
      mayClaimLiveProposalReady: false,
      code: "HISTORICAL_NOT_LIVE",
      reasons,
    };
  }

  // Candles alone never promote to LIVE market price.
  if (input.candleIsHistoricalSeries === true && input.quoteFresh !== true) {
    return {
      ...flags,
      dataMode: "HISTORICAL",
      mayLabelAsLiveMarketPrice: false,
      mayClaimLiveProposalReady: false,
      code: "CANDLE_SERIES_NOT_LIVE_PRICE",
      reasons: ["Historical candle series must never be presented as a live market price."],
    };
  }

  if (input.quoteFresh === true && input.historicalOnly !== true && input.marketClosed !== true) {
    return {
      ...flags,
      dataMode: "LIVE",
      mayLabelAsLiveMarketPrice: true,
      mayClaimLiveProposalReady: true,
      code: "LIVE_FRESH",
      reasons: ["Verified fresh quote (and not historical-only)."],
    };
  }

  if (input.quoteFresh === false) {
    return {
      ...flags,
      dataMode: "STALE",
      mayLabelAsLiveMarketPrice: false,
      mayClaimLiveProposalReady: false,
      code: "QUOTE_NOT_FRESH",
      reasons: ["Quote marked not fresh."],
    };
  }

  return {
    ...flags,
    dataMode: "UNKNOWN",
    mayLabelAsLiveMarketPrice: false,
    mayClaimLiveProposalReady: false,
    code: "DATA_MODE_UNKNOWN",
    reasons: ["Insufficient evidence to label LIVE — fail closed."],
  };
}

/** Normalize legacy / alternate labels into MarketDataMode. */
export function normalizeDataModeLabel(raw: string | null | undefined): MarketDataMode {
  const u = String(raw || "").trim().toUpperCase();
  if (u === "LIVE") return "LIVE";
  if (u === "HISTORICAL" || u === "HISTORICAL_ONLY") return "HISTORICAL";
  if (u === "CACHED") return "CACHED";
  if (u === "STALE" || u === "STALE_QUOTE") return "STALE";
  if (u === "SYNTHETIC" || u === "SYNTHETIC_TEST_DATA") return "SYNTHETIC";
  if (u === "TEST") return "TEST";
  if (u === "MARKET_CLOSED") return "MARKET_CLOSED";
  return "UNKNOWN";
}
