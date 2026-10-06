import { normalizeBinanceKlines, normalizeBinanceTicker24h, toBinanceInterval, toBinanceSymbol } from "./adapter.js";
import { resolveBinancePublicConfig, type BinancePublicConfig } from "./config.js";
import { disconnectedSnapshot, snapshotForState } from "./connection.js";
import { BinanceMarketDataError, userFacingBinanceError } from "./errors.js";
import { pingBinancePublicRest, type FetchLike } from "./rest-client.js";
import type { MarketConnectionSnapshot, NormalizedCandle, NormalizedTicker } from "./types.js";

export interface BinanceMarketDataService {
  getConfig(): BinancePublicConfig;
  getSnapshot(): MarketConnectionSnapshot;
  probePublicRest(): Promise<MarketConnectionSnapshot>;
  normalizeKlines(rows: unknown): NormalizedCandle[];
  normalizeTicker(raw: unknown): NormalizedTicker;
  assertPublicSymbol(symbol: string): string;
  mapTimeframe(timeframe: "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w"): string;
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
          liveMarketData: false,
          websocketActive: false,
          serverTimeUtc: ping.serverTimeUtc,
          message: "Binance public API reachable. Live market data is not streaming.",
          errorCode: null,
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
