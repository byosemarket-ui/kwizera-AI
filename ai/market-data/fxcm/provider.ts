/**
 * FXCM Market Data Provider — Phase 25 foundation.
 * Instruments + health only. No live quotes, streaming, candles, or trading.
 */
import {
  FXCM_INSTRUMENT_CACHE_MS,
  FXCM_PHASE25_CAPABILITIES,
  resolveFxcmConfig,
  type FxcmConfig,
} from "./config.js";
import { fxcmGetInstruments, openFxcmSession, type FetchLike } from "./client.js";
import { FxcmMarketDataError, userFacingFxcmError } from "./errors.js";
import { mapFxcmInstrumentList, toCanonicalFxcmSymbol } from "./instrument-mapper.js";
import type {
  MarketDataProvider,
  MarketInstrument,
  MarketProviderHealth,
  MarketProviderInfo,
} from "../providers/types.js";
import type { FxcmInstrumentCache } from "./types.js";

export interface FxcmProviderOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  nowMs?: () => number;
}

export class FxcmMarketDataProvider implements MarketDataProvider {
  private readonly config: FxcmConfig;
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl?: FetchLike;
  private readonly nowMs: () => number;
  private cache: FxcmInstrumentCache | null = null;
  private lastHealth: MarketProviderHealth | null = null;

  constructor(options: FxcmProviderOptions = {}) {
    this.env = options.env ?? (process.env as Record<string, string | undefined>);
    this.config = resolveFxcmConfig(this.env);
    this.fetchImpl = options.fetchImpl;
    this.nowMs = options.nowMs ?? (() => Date.now());
  }

  getConfig(): FxcmConfig {
    return this.config;
  }

  getProviderInfo(): MarketProviderInfo {
    return {
      provider: "FXCM",
      displayName: "FXCM",
      apiPath: "FXCM Socket REST API (official)",
      marketTypes: ["FOREX", "CFD", "COMMODITY", "INDEX", "TREASURY", "SHARE", "OTHER"],
      environmentLabel: this.config.environmentLabel,
      capabilities: { ...FXCM_PHASE25_CAPABILITIES },
    };
  }

  getCapabilities() {
    return { ...FXCM_PHASE25_CAPABILITIES };
  }

  getLastHealth(): MarketProviderHealth | null {
    return this.lastHealth;
  }

  async healthCheck(): Promise<MarketProviderHealth> {
    const checkedAt = new Date(this.nowMs()).toISOString();
    const baseNotes = [
      "Phase 25 foundation only.",
      "Live stream: NOT ENABLED YET.",
      "Historical candles: NOT ENABLED YET.",
      "Trading: DISABLED.",
      `Environment: ${this.config.environmentLabel}`,
    ];

    if (!this.config.enabled) {
      this.lastHealth = {
        provider: "FXCM",
        enabled: false,
        environment: this.config.environment,
        environmentLabel: this.config.environmentLabel,
        configured: false,
        authenticated: false,
        reachable: false,
        status: "DISABLED",
        connectionState: "DISCONNECTED",
        liveStreamEnabled: false,
        tradingEnabled: false,
        instrumentDiscovery: "DISABLED",
        checkedAt,
        errorCode: "FXCM_DISABLED",
        errorMessage: "FXCM market data is disabled.",
        notes: baseNotes,
      };
      return this.lastHealth;
    }

    if (!this.config.accessTokenConfigured) {
      this.lastHealth = {
        provider: "FXCM",
        enabled: true,
        environment: this.config.environment,
        environmentLabel: this.config.environmentLabel,
        configured: false,
        authenticated: false,
        reachable: false,
        status: "NOT_CONFIGURED",
        connectionState: "DISCONNECTED",
        liveStreamEnabled: false,
        tradingEnabled: false,
        instrumentDiscovery: "NOT_CONFIGURED",
        checkedAt,
        errorCode: "FXCM_NOT_CONFIGURED",
        errorMessage: "Set KWIZERA_FXCM_ACCESS_TOKEN on the server to enable FXCM authentication.",
        notes: [...baseNotes, "Configuration: NOT CONFIGURED"],
      };
      return this.lastHealth;
    }

    try {
      const session = await openFxcmSession(this.config, { env: this.env, fetchImpl: this.fetchImpl });
      // Lightweight authenticated probe: instrument list (metadata only, no prices).
      const raw = await fxcmGetInstruments(this.config, session, { fetchImpl: this.fetchImpl });
      const instruments = mapFxcmInstrumentList(raw);
      this.cache = {
        instruments,
        fetchedAtUtc: this.nowMs(),
        environment: this.config.environment,
        restBaseHost: this.config.restBaseHost,
        cached: false,
      };
      this.lastHealth = {
        provider: "FXCM",
        enabled: true,
        environment: this.config.environment,
        environmentLabel: this.config.environmentLabel,
        configured: true,
        authenticated: true,
        reachable: true,
        status: "CONNECTED",
        connectionState: "CONNECTED",
        liveStreamEnabled: false,
        tradingEnabled: false,
        instrumentDiscovery: "READY",
        checkedAt,
        errorCode: null,
        errorMessage: null,
        notes: [
          ...baseNotes,
          "API: CONNECTED (authenticated session established).",
          "Connected to API ≠ live market data stream.",
          `Instruments discovered: ${instruments.length}`,
        ],
      };
      console.info("[fxcm] health", JSON.stringify({
        status: "CONNECTED",
        environment: this.config.environment,
        host: this.config.restBaseHost,
        instruments: instruments.length,
        liveStreamEnabled: false,
        tradingEnabled: false,
      }));
      return this.lastHealth;
    } catch (error) {
      const mapped = userFacingFxcmError(error);
      const authFail = mapped.code === "FXCM_AUTHENTICATION_FAILED" || mapped.code === "FXCM_NOT_CONFIGURED";
      const network = mapped.code === "FXCM_NETWORK" || mapped.code === "FXCM_TIMEOUT" || mapped.code === "FXCM_CONNECTION_FAILED";
      this.lastHealth = {
        provider: "FXCM",
        enabled: true,
        environment: this.config.environment,
        environmentLabel: this.config.environmentLabel,
        configured: true,
        authenticated: false,
        reachable: network ? false : authFail,
        status: authFail
          ? "AUTHENTICATION_ERROR"
          : network
            ? "NETWORK_ERROR"
            : "ERROR",
        connectionState: "ERROR",
        liveStreamEnabled: false,
        tradingEnabled: false,
        instrumentDiscovery: "ERROR",
        checkedAt,
        errorCode: mapped.code,
        errorMessage: mapped.message,
        notes: baseNotes,
      };
      console.info("[fxcm] health", JSON.stringify({
        status: this.lastHealth.status,
        environment: this.config.environment,
        host: this.config.restBaseHost,
        errorCode: mapped.code,
      }));
      return this.lastHealth;
    }
  }

  async listInstruments(options?: { refresh?: boolean }): Promise<MarketInstrument[]> {
    if (!this.config.enabled) {
      throw new FxcmMarketDataError("FXCM_DISABLED", "FXCM market data is disabled.");
    }
    if (!this.config.accessTokenConfigured) {
      throw new FxcmMarketDataError("FXCM_NOT_CONFIGURED", "FXCM access token is not configured.");
    }
    const now = this.nowMs();
    if (
      !options?.refresh
      && this.cache
      && now - this.cache.fetchedAtUtc < FXCM_INSTRUMENT_CACHE_MS
    ) {
      return this.cache.instruments.map((i) => ({ ...i, metadata: { ...i.metadata } }));
    }

    const session = await openFxcmSession(this.config, { env: this.env, fetchImpl: this.fetchImpl });
    const raw = await fxcmGetInstruments(this.config, session, { fetchImpl: this.fetchImpl });
    const instruments = mapFxcmInstrumentList(raw);
    this.cache = {
      instruments,
      fetchedAtUtc: now,
      environment: this.config.environment,
      restBaseHost: this.config.restBaseHost,
      cached: false,
    };
    console.info("[fxcm] instruments", JSON.stringify({
      count: instruments.length,
      environment: this.config.environment,
      host: this.config.restBaseHost,
      cached: false,
    }));
    return instruments;
  }

  async getInstrument(symbol: string): Promise<MarketInstrument | null> {
    const needleCanonical = toCanonicalFxcmSymbol(symbol);
    const needleProvider = String(symbol ?? "").trim();
    if (!needleCanonical && !needleProvider) {
      throw new FxcmMarketDataError("FXCM_INVALID_SYMBOL", "Symbol is required.");
    }
    const list = await this.listInstruments();
    return list.find((i) =>
      i.providerSymbol === needleProvider
      || i.canonicalSymbol === needleCanonical
      || i.displaySymbol === needleProvider
    ) ?? null;
  }
}

export function createFxcmMarketDataProvider(options?: FxcmProviderOptions): FxcmMarketDataProvider {
  return new FxcmMarketDataProvider(options);
}
