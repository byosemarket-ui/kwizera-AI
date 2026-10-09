/**
 * Phase 34 — ForexConnect MarketDataProvider adapter (read-only).
 * Distinct from FXCM Socket REST — never conflate identities.
 */
import type {
  MarketDataCapabilities,
  MarketDataProvider,
  MarketInstrument,
  MarketProviderHealth,
  MarketProviderInfo,
} from "../providers/types.js";
import { ForexConnectMarketDataError } from "./errors.js";
import {
  createForexConnectBridge,
  getForexConnectBridge,
  type ForexConnectBridge,
} from "./client.js";
import { FOREXCONNECT_SUPPORTED_PROJECT_TIMEFRAMES } from "./timeframes.js";

const CAPS: MarketDataCapabilities = {
  instruments: true,
  liveQuotes: false,
  streamingQuotes: false,
  historicalPrices: true,
  candles: true,
  liveCandles: false,
  trading: false,
};

function mapStatusToHealth(status: string): MarketProviderHealth["status"] {
  switch (status) {
    case "DISABLED":
      return "DISABLED";
    case "NOT_CONFIGURED":
      return "NOT_CONFIGURED";
    case "CONNECTING":
      return "CONNECTING";
    case "CONNECTED":
      return "CONNECTED";
    case "AUTHENTICATION_FAILED":
      return "AUTHENTICATION_ERROR";
    case "SERVICE_UNAVAILABLE":
    case "SDK_UNAVAILABLE":
      return "UNAVAILABLE";
    case "DISCONNECTED":
      return "CONFIGURED";
    default:
      return "ERROR";
  }
}

export class ForexConnectMarketDataProvider implements MarketDataProvider {
  private readonly bridge: ForexConnectBridge;

  constructor(options?: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    bridge?: ForexConnectBridge;
  }) {
    this.bridge = options?.bridge
      ?? createForexConnectBridge({ env: options?.env, fetchImpl: options?.fetchImpl });
  }

  getBridge(): ForexConnectBridge {
    return this.bridge;
  }

  getProviderInfo(): MarketProviderInfo {
    const cfg = this.bridge.getConfig();
    return {
      provider: "FOREXCONNECT",
      displayName: "FXCM ForexConnect",
      apiPath: "FXCM ForexConnect SDK (sidecar)",
      marketTypes: ["FOREX", "CFD", "COMMODITY", "INDEX", "OTHER"],
      environmentLabel: cfg.environmentLabel,
      capabilities: CAPS,
    };
  }

  getCapabilities(): MarketDataCapabilities {
    return { ...CAPS };
  }

  async healthCheck(): Promise<MarketProviderHealth> {
    const status = await this.bridge.getStatus();
    const configured = Boolean(status.configured);
    const connected = status.status === "CONNECTED";
    return {
      provider: "FOREXCONNECT",
      enabled: Boolean(status.enabled),
      environment: status.environment === "real" ? "real" : "demo",
      environmentLabel: status.environmentLabel,
      configured,
      authenticated: connected,
      reachable: Boolean(status.sidecarReachable),
      status: mapStatusToHealth(String(status.status)),
      connectionState: connected
        ? "CONNECTED"
        : status.status === "CONNECTING"
          ? "CONNECTING"
          : status.status === "ERROR" || status.status === "AUTHENTICATION_FAILED"
            ? "ERROR"
            : "DISCONNECTED",
      liveStreamEnabled: false,
      tradingEnabled: false,
      instrumentDiscovery: connected
        ? "READY"
        : !status.enabled
          ? "DISABLED"
          : !configured
            ? "NOT_CONFIGURED"
            : "ERROR",
      checkedAt: status.checkedAt ?? new Date().toISOString(),
      errorCode: status.errorCode ?? null,
      errorMessage: status.errorMessage ?? null,
      notes: [
        "ForexConnect historical candles via official get_history (bid OHLC).",
        `Supported timeframes: ${FOREXCONNECT_SUPPORTED_PROJECT_TIMEFRAMES.join(", ")}`,
        "Trading: DISABLED",
        "Distinct from FXCM Socket REST.",
      ],
    };
  }

  async listInstruments(options?: { refresh?: boolean }): Promise<MarketInstrument[]> {
    void options;
    const status = await this.bridge.getStatus();
    if (!status.enabled) {
      throw new ForexConnectMarketDataError(
        "FOREXCONNECT_DISABLED",
        "ForexConnect is disabled. Set KWIZERA_FOREXCONNECT_ENABLED=1.",
      );
    }
    if (!status.configured) {
      throw new ForexConnectMarketDataError(
        "FOREXCONNECT_NOT_CONFIGURED",
        "ForexConnect is not configured on the server.",
      );
    }
    if (status.status !== "CONNECTED") {
      throw new ForexConnectMarketDataError(
        String(status.errorCode ?? `FOREXCONNECT_${status.status}`),
        status.errorMessage
          ?? "ForexConnect is not connected. Connect via Admin before listing instruments.",
      );
    }
    const result = await this.bridge.listInstruments();
    if (!result.ok) {
      throw new ForexConnectMarketDataError(
        result.error?.code ?? "FOREXCONNECT_DISCOVERY_FAILED",
        result.error?.message ?? "Instrument discovery failed.",
      );
    }
    return result.instruments.map((item) => ({
      provider: "FOREXCONNECT" as const,
      providerSymbol: item.providerSymbol,
      canonicalSymbol: item.canonicalSymbol,
      displaySymbol: item.displaySymbol,
      marketType: "FOREX" as const,
      baseAsset: item.baseAsset,
      quoteAsset: item.quoteAsset,
      status: item.status === "available" ? "available" as const : "unknown" as const,
      capabilities: { ...CAPS },
      metadata: {
        offerId: item.offerId ?? null,
        source: item.source ?? "forexconnect-offers",
        venue: "forexconnect",
      },
    }));
  }

  async getInstrument(symbol: string): Promise<MarketInstrument | null> {
    const list = await this.listInstruments();
    const compact = String(symbol).replace(/[/_-\s]/g, "").toUpperCase();
    const slash = symbol.includes("/") ? symbol.trim().toUpperCase() : null;
    return list.find((item) =>
      item.canonicalSymbol === compact
      || item.providerSymbol.toUpperCase() === String(symbol).trim().toUpperCase()
      || (slash != null && item.providerSymbol.toUpperCase() === slash)
    ) ?? null;
  }
}

export function createForexConnectMarketDataProvider(options?: {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  bridge?: ForexConnectBridge;
}): ForexConnectMarketDataProvider {
  return new ForexConnectMarketDataProvider(options);
}

export function getForexConnectMarketDataProvider(): ForexConnectMarketDataProvider {
  return createForexConnectMarketDataProvider({ bridge: getForexConnectBridge() });
}
