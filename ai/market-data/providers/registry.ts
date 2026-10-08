/**
 * Market data provider registry — BINANCE + FXCM.
 */
import { createBinanceMarketDataService } from "../binance/service.js";
import { createFxcmMarketDataProvider, type FxcmMarketDataProvider } from "../fxcm/provider.js";
import type {
  MarketDataCapabilities,
  MarketDataProvider,
  MarketProviderHealth,
  MarketProviderId,
  MarketProviderInfo,
} from "./types.js";

export interface MarketProviderRegistrySnapshot {
  providers: Array<{
    info: MarketProviderInfo;
    health: MarketProviderHealth;
  }>;
  generatedAt: string;
}

export class MarketDataProviderRegistry {
  private readonly fxcm: FxcmMarketDataProvider;
  private readonly binanceEnv?: Record<string, string | undefined>;

  constructor(options?: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
  }) {
    this.binanceEnv = options?.env;
    this.fxcm = createFxcmMarketDataProvider({
      env: options?.env,
      fetchImpl: options?.fetchImpl,
    });
  }

  listProviderIds(): MarketProviderId[] {
    return ["BINANCE", "FXCM"];
  }

  getFxcm(): FxcmMarketDataProvider {
    return this.fxcm;
  }

  getProvider(id: MarketProviderId): MarketDataProvider | null {
    if (id === "FXCM") return this.fxcm;
    if (id === "BINANCE") {
      // Binance remains on its existing service; expose a thin adapter for registry consumers.
      return createBinanceRegistryAdapter(this.binanceEnv);
    }
    return null;
  }

  async snapshot(): Promise<MarketProviderRegistrySnapshot> {
    const binance = createBinanceMarketDataService({ env: this.binanceEnv });
    const binanceSnap = await binance.probePublicRest();
    const binanceConfig = binance.getConfig();
    const fxcmHealth = await this.fxcm.healthCheck();

    const binanceCaps: MarketDataCapabilities = {
      instruments: true,
      liveQuotes: true,
      streamingQuotes: true,
      historicalPrices: true,
      candles: true,
      trading: false,
    };

    return {
      generatedAt: new Date().toISOString(),
      providers: [
        {
          info: {
            provider: "BINANCE",
            displayName: "Binance Spot",
            apiPath: "Binance public REST/WebSocket",
            marketTypes: ["CRYPTO"],
            environmentLabel: "BINANCE PUBLIC",
            capabilities: binanceCaps,
          },
          health: {
            provider: "BINANCE",
            enabled: binanceConfig.enabled,
            environment: "public",
            environmentLabel: "BINANCE PUBLIC",
            configured: binanceConfig.enabled,
            authenticated: false,
            reachable: binanceSnap.restReachable,
            status: !binanceConfig.enabled
              ? "DISABLED"
              : binanceSnap.state === "CONNECTED"
                ? "CONNECTED"
                : binanceSnap.state === "ERROR"
                  ? "NETWORK_ERROR"
                  : "UNAVAILABLE",
            connectionState: binanceSnap.state,
            liveStreamEnabled: Boolean(binanceSnap.liveMarketData || binanceSnap.websocketActive),
            tradingEnabled: false,
            instrumentDiscovery: binanceConfig.enabled ? "READY" : "DISABLED",
            checkedAt: new Date(binanceSnap.probedAtUtc).toISOString(),
            errorCode: binanceSnap.errorCode,
            errorMessage: binanceSnap.state === "ERROR" ? binanceSnap.message : null,
            notes: [
              binanceSnap.liveMarketData ? "Binance live market data active." : "Binance public API status (Spot).",
              "Trading: DISABLED",
            ],
          },
        },
        {
          info: this.fxcm.getProviderInfo(),
          health: fxcmHealth,
        },
      ],
    };
  }
}

function createBinanceRegistryAdapter(env?: Record<string, string | undefined>): MarketDataProvider {
  const service = createBinanceMarketDataService({ env });
  return {
    getProviderInfo() {
      return {
        provider: "BINANCE",
        displayName: "Binance Spot",
        apiPath: "Binance public REST/WebSocket",
        marketTypes: ["CRYPTO"],
        environmentLabel: "BINANCE PUBLIC",
        capabilities: {
          instruments: true,
          liveQuotes: true,
          streamingQuotes: true,
          historicalPrices: true,
          candles: true,
          trading: false,
        },
      };
    },
    getCapabilities() {
      return {
        instruments: true,
        liveQuotes: true,
        streamingQuotes: true,
        historicalPrices: true,
        candles: true,
        trading: false,
      };
    },
    async healthCheck() {
      const snap = await service.probePublicRest();
      const config = service.getConfig();
      return {
        provider: "BINANCE",
        enabled: config.enabled,
        environment: "public",
        environmentLabel: "BINANCE PUBLIC",
        configured: config.enabled,
        authenticated: false,
        reachable: snap.restReachable,
        status: !config.enabled
          ? "DISABLED"
          : snap.state === "CONNECTED"
            ? "CONNECTED"
            : snap.state === "ERROR"
              ? "NETWORK_ERROR"
              : "UNAVAILABLE",
        connectionState: snap.state,
        liveStreamEnabled: Boolean(snap.liveMarketData || snap.websocketActive),
        tradingEnabled: false,
        instrumentDiscovery: config.enabled ? "READY" : "DISABLED",
        checkedAt: new Date(snap.probedAtUtc).toISOString(),
        errorCode: snap.errorCode,
        errorMessage: snap.state === "ERROR" ? snap.message : null,
        notes: ["Binance Spot public market data."],
      };
    },
    async listInstruments() {
      const catalog = await service.listSpotMarkets();
      return catalog.markets.map((m) => ({
        provider: "BINANCE" as const,
        providerSymbol: m.symbol,
        canonicalSymbol: m.symbol,
        displaySymbol: m.displaySymbol,
        marketType: "CRYPTO" as const,
        baseAsset: m.baseAsset,
        quoteAsset: m.quoteAsset,
        status: m.tradable ? "available" as const : "unknown" as const,
        capabilities: {
          instruments: true,
          liveQuotes: true,
          streamingQuotes: true,
          historicalPrices: true,
          candles: true,
          trading: false,
        },
        metadata: {
          venue: m.venue,
          marketType: m.marketType,
          source: m.source,
        },
      }));
    },
    async getInstrument(symbol: string) {
      const market = await service.findSpotMarket(symbol);
      if (!market) return null;
      return {
        provider: "BINANCE" as const,
        providerSymbol: market.symbol,
        canonicalSymbol: market.symbol,
        displaySymbol: market.displaySymbol,
        marketType: "CRYPTO" as const,
        baseAsset: market.baseAsset,
        quoteAsset: market.quoteAsset,
        status: market.tradable ? "available" as const : "unknown" as const,
        capabilities: {
          instruments: true,
          liveQuotes: true,
          streamingQuotes: true,
          historicalPrices: true,
          candles: true,
          trading: false,
        },
        metadata: { venue: market.venue, source: market.source },
      };
    },
  };
}

let singleton: MarketDataProviderRegistry | null = null;

export function getMarketDataProviderRegistry(): MarketDataProviderRegistry {
  singleton ??= new MarketDataProviderRegistry();
  return singleton;
}

export function createMarketDataProviderRegistry(options?: {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): MarketDataProviderRegistry {
  return new MarketDataProviderRegistry(options);
}

export function resetMarketDataProviderRegistryForTests(): void {
  singleton = null;
}

export { FXCM_PHASE28_CAPABILITIES, FXCM_PHASE25_CAPABILITIES } from "../fxcm/config.js";
