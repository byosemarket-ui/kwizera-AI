import { normalizeBinanceExchangeInfo, normalizeBinanceKlines, normalizeBinanceTicker24h, toBinanceInterval, toBinanceSymbol } from "./adapter.js";
import { BINANCE_MARKET_CACHE_MS, resolveBinancePublicConfig, type BinancePublicConfig } from "./config.js";
import { disconnectedSnapshot, snapshotForState } from "./connection.js";
import { BinanceMarketDataError, userFacingBinanceError } from "./errors.js";
import { fetchBinanceExchangeInfo, pingBinancePublicRest, type FetchLike } from "./rest-client.js";
import { PHASE7_CAPABILITIES, type MarketConnectionSnapshot, type NormalizedCandle, type NormalizedMarket, type NormalizedTicker } from "./types.js";

export interface BinanceMarketCatalog {
  markets: NormalizedMarket[];
  fetchedAtUtc: number;
  restBaseHost: string;
  marketType: "spot";
  cached: boolean;
}

export interface BinanceMarketDataService {
  getConfig(): BinancePublicConfig;
  getSnapshot(): MarketConnectionSnapshot;
  probePublicRest(): Promise<MarketConnectionSnapshot>;
  listSpotMarkets(options?: { refresh?: boolean }): Promise<BinanceMarketCatalog>;
  findSpotMarket(symbol: string): Promise<NormalizedMarket | null>;
  normalizeKlines(rows: unknown): NormalizedCandle[];
  normalizeTicker(raw: unknown): NormalizedTicker;
  assertPublicSymbol(symbol: string): string;
  mapTimeframe(timeframe: "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w"): string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function createBinanceMarketDataService(options: {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
} = {}): BinanceMarketDataService {
  const config = resolveBinancePublicConfig(options.env);
  let snapshot = disconnectedSnapshot(
    config,
    config.enabled ? "Binance public API is not connected." : "Binance public market data is disabled.",
  );
  let catalogCache: BinanceMarketCatalog | null = null;

  return {
    getConfig() {
      return config;
    },
    getSnapshot() {
      return snapshot;
    },
    async probePublicRest() {
      if (!config.enabled) {
        snapshot = snapshotForState(config, "DISCONNECTED", {
          errorCode: "BINANCE_DISABLED",
          message: "Binance public market data is disabled.",
        });
        return snapshot;
      }
      snapshot = snapshotForState(config, "CONNECTING", {
        message: "Checking Binance public API…",
      });
      try {
        const ping = await pingBinancePublicRest(config, options.fetchImpl);
        snapshot = snapshotForState(config, "CONNECTED", {
          restReachable: true,
          restBaseHost: hostOf(ping.restBaseUrl),
          liveMarketData: false,
          websocketActive: false,
          serverTimeUtc: ping.serverTimeUtc,
          message: "Binance public API reachable. Live market data is not streaming.",
          errorCode: null,
          capabilities: { ...PHASE7_CAPABILITIES },
        });
        return snapshot;
      } catch (error) {
        const mapped = userFacingBinanceError(error);
        snapshot = snapshotForState(config, "ERROR", {
          restReachable: false,
          liveMarketData: false,
          message: mapped.message,
          errorCode: mapped.code,
        });
        return snapshot;
      }
    },
    async listSpotMarkets(listOptions = {}) {
      if (!config.enabled) {
        throw new BinanceMarketDataError("BINANCE_DISABLED", "Binance public market data is disabled.");
      }
      const now = Date.now();
      if (!listOptions.refresh && catalogCache && now - catalogCache.fetchedAtUtc < BINANCE_MARKET_CACHE_MS) {
        return { ...catalogCache, cached: true };
      }
      const fetched = await fetchBinanceExchangeInfo(config, options.fetchImpl);
      const markets = normalizeBinanceExchangeInfo(fetched.body);
      catalogCache = {
        markets,
        fetchedAtUtc: now,
        restBaseHost: hostOf(fetched.restBaseUrl),
        marketType: "spot",
        cached: false,
      };
      snapshot = snapshotForState(config, "CONNECTED", {
        restReachable: true,
        restBaseHost: catalogCache.restBaseHost,
        message: "Binance public API reachable. Live market data is not streaming.",
        errorCode: null,
        capabilities: { ...PHASE7_CAPABILITIES },
      });
      return catalogCache;
    },
    async findSpotMarket(symbol) {
      const compact = toBinanceSymbol(symbol);
      const catalog = await this.listSpotMarkets();
      return catalog.markets.find((item) => item.symbol === compact) ?? null;
    },
    normalizeKlines(rows) {
      return normalizeBinanceKlines(rows);
    },
    normalizeTicker(raw) {
      return normalizeBinanceTicker24h(raw);
    },
    assertPublicSymbol(symbol) {
      return toBinanceSymbol(symbol);
    },
    mapTimeframe(timeframe) {
      return toBinanceInterval(timeframe);
    },
  };
}

export function notImplementedStreaming(): never {
  throw new BinanceMarketDataError(
    "BINANCE_NOT_IMPLEMENTED",
    "Binance WebSocket streaming is reserved for a later phase.",
  );
}
