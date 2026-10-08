/**
 * FXCM Market Data Provider — Phase 25 foundation + Phase 26 authentication.
 * Instruments + authenticated health only. No live quotes, streaming, candles, or trading.
 */
import {
  FXCM_INSTRUMENT_CACHE_MS,
  FXCM_PHASE25_CAPABILITIES,
  resolveFxcmConfig,
  type FxcmConfig,
} from "./config.js";
import { fxcmGetInstruments, type FetchLike } from "./client.js";
import {
  createFxcmAuthenticationService,
  type FxcmAuthenticationService,
} from "./auth-service.js";
import { FxcmMarketDataError, userFacingFxcmError } from "./errors.js";
import { mapFxcmInstrumentList, toCanonicalFxcmSymbol } from "./instrument-mapper.js";
import type {
  MarketDataProvider,
  MarketInstrument,
  MarketProviderHealth,
  MarketProviderInfo,
} from "../providers/types.js";
import type { FxcmInstrumentCache } from "./types.js";
import type { SafeFxcmAuthenticationStatus } from "./auth-types.js";

export interface FxcmProviderOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  nowMs?: () => number;
  auth?: FxcmAuthenticationService;
}

export class FxcmMarketDataProvider implements MarketDataProvider {
  private readonly config: FxcmConfig;
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl?: FetchLike;
  private readonly nowMs: () => number;
  private readonly auth: FxcmAuthenticationService;
  private cache: FxcmInstrumentCache | null = null;
  private lastHealth: MarketProviderHealth | null = null;

  constructor(options: FxcmProviderOptions = {}) {
    this.env = options.env ?? (process.env as Record<string, string | undefined>);
    this.config = resolveFxcmConfig(this.env);
    this.fetchImpl = options.fetchImpl;
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.auth = options.auth ?? createFxcmAuthenticationService({
      env: this.env,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
    });
  }

  getConfig(): FxcmConfig {
    return this.config;
  }

  getAuthService(): FxcmAuthenticationService {
    return this.auth;
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

  getSafeAuthenticationStatus(): SafeFxcmAuthenticationStatus {
    return this.auth.getSafeStatus();
  }

  async authenticate(options?: { force?: boolean }): Promise<SafeFxcmAuthenticationStatus> {
    await this.auth.authenticate(options);
    return this.auth.getSafeStatus();
  }

  async healthCheck(): Promise<MarketProviderHealth> {
    const checkedAt = new Date(this.nowMs()).toISOString();
    const baseNotes = [
      "Phase 26 authentication layer.",
      "Live stream: NOT ENABLED YET.",
      "Historical candles: NOT ENABLED YET.",
      "Trading: DISABLED.",
      "Market data: NOT_STARTED.",
      `Environment: ${this.config.environmentLabel}`,
      "FXCM authenticated ≠ LIVE market stream.",
    ];

    const authCtx = await this.auth.authenticate();
    const safe = this.auth.getSafeStatus();

    if (authCtx.state === "DISABLED") {
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

    if (!authCtx.configured || authCtx.state === "NOT_CONFIGURED") {
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
        errorCode: safe.authentication.lastErrorCode ?? "FXCM_NOT_CONFIGURED",
        errorMessage: safe.authentication.lastErrorMessage
          ?? "Set KWIZERA_FXCM_ACCESS_TOKEN on the server to enable FXCM authentication.",
        notes: [...baseNotes, "Configuration: NOT CONFIGURED"],
      };
      return this.lastHealth;
    }

    if (authCtx.state !== "AUTHENTICATED") {
      const status =
        authCtx.state === "AUTHENTICATION_ERROR" ? "AUTHENTICATION_ERROR"
          : authCtx.state === "NETWORK_ERROR" || authCtx.state === "RECONNECTING" ? "NETWORK_ERROR"
            : authCtx.state === "UNAVAILABLE" ? "UNAVAILABLE"
              : "ERROR";
      this.lastHealth = {
        provider: "FXCM",
        enabled: true,
        environment: this.config.environment,
        environmentLabel: this.config.environmentLabel,
        configured: true,
        authenticated: false,
        reachable: status !== "NETWORK_ERROR",
        status,
        connectionState: "ERROR",
        liveStreamEnabled: false,
        tradingEnabled: false,
        instrumentDiscovery: "ERROR",
        checkedAt,
        errorCode: safe.authentication.lastErrorCode,
        errorMessage: safe.authentication.lastErrorMessage,
        notes: baseNotes,
      };
      return this.lastHealth;
    }

    // Authenticated — optionally refresh instrument metadata cache (metadata only).
    try {
      const session = this.auth.getSessionHandle();
      if (!session) {
        throw new FxcmMarketDataError("FXCM_AUTHENTICATION_FAILED", "Authenticated session missing.");
      }
      const raw = await fxcmGetInstruments(this.config, session, { fetchImpl: this.fetchImpl });
      const instruments = mapFxcmInstrumentList(raw);
      this.cache = {
        instruments,
        fetchedAtUtc: this.nowMs(),
        environment: this.config.environment,
        restBaseHost: this.config.restBaseHost,
        cached: false,
      };
      this.auth.touchValidated();
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
          "Authentication: AUTHENTICATED.",
          "API session active — market streaming not enabled in this phase.",
          `Instruments discovered: ${instruments.length}`,
        ],
      };
      console.info("[fxcm] health", JSON.stringify({
        status: "CONNECTED",
        authState: "AUTHENTICATED",
        environment: this.config.environment,
        host: this.config.restBaseHost,
        instruments: instruments.length,
        liveStreamEnabled: false,
        tradingEnabled: false,
        marketData: "NOT_STARTED",
      }));
      return this.lastHealth;
    } catch (error) {
      const mapped = userFacingFxcmError(error);
      if (mapped.code === "FXCM_AUTHENTICATION_FAILED") {
        await this.auth.markExpiredAndReauthenticate();
      }
      this.lastHealth = {
        provider: "FXCM",
        enabled: true,
        environment: this.config.environment,
        environmentLabel: this.config.environmentLabel,
        configured: true,
        authenticated: this.auth.getState() === "AUTHENTICATED",
        reachable: mapped.code !== "FXCM_NETWORK" && mapped.code !== "FXCM_TIMEOUT",
        status: mapped.code === "FXCM_AUTHENTICATION_FAILED" ? "AUTHENTICATION_ERROR" : "ERROR",
        connectionState: "ERROR",
        liveStreamEnabled: false,
        tradingEnabled: false,
        instrumentDiscovery: "ERROR",
        checkedAt,
        errorCode: mapped.code,
        errorMessage: mapped.message,
        notes: baseNotes,
      };
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

    const authCtx = await this.auth.authenticate();
    if (authCtx.state !== "AUTHENTICATED") {
      throw new FxcmMarketDataError(
        "FXCM_AUTHENTICATION_FAILED",
        authCtx.lastErrorMessage ?? "FXCM authentication failed.",
      );
    }
    let session = this.auth.getSessionHandle();
    if (!session) {
      throw new FxcmMarketDataError("FXCM_AUTHENTICATION_FAILED", "Authenticated session missing.");
    }

    try {
      const raw = await fxcmGetInstruments(this.config, session, { fetchImpl: this.fetchImpl });
      const instruments = mapFxcmInstrumentList(raw);
      this.cache = {
        instruments,
        fetchedAtUtc: now,
        environment: this.config.environment,
        restBaseHost: this.config.restBaseHost,
        cached: false,
      };
      this.auth.touchValidated();
      console.info("[fxcm] instruments", JSON.stringify({
        count: instruments.length,
        environment: this.config.environment,
        host: this.config.restBaseHost,
        cached: false,
      }));
      return instruments;
    } catch (error) {
      const mapped = userFacingFxcmError(error);
      if (mapped.code === "FXCM_AUTHENTICATION_FAILED") {
        await this.auth.markExpiredAndReauthenticate();
        session = this.auth.getSessionHandle();
        if (!session) throw error;
        const raw = await fxcmGetInstruments(this.config, session, { fetchImpl: this.fetchImpl });
        const instruments = mapFxcmInstrumentList(raw);
        this.cache = {
          instruments,
          fetchedAtUtc: now,
          environment: this.config.environment,
          restBaseHost: this.config.restBaseHost,
          cached: false,
        };
        return instruments;
      }
      throw error;
    }
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
