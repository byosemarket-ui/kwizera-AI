/**
 * FXCM Market Data Provider — Phases 25–29.
 * Authentication (26) + discovery (27) + historical (28) + real-time quotes (29).
 * No live candles, no trading.
 */
import {
  FXCM_PHASE31_CAPABILITIES,
  resolveFxcmConfig,
  type FxcmConfig,
} from "./config.js";
import {
  createFxcmAuthenticationService,
  type FxcmAuthenticationService,
} from "./auth-service.js";
import {
  createFxcmInstrumentDiscoveryService,
  type FxcmInstrumentDiscoveryService,
} from "./instrument-discovery.js";
import {
  createFxcmHistoricalMarketDataService,
  type FxcmHistoricalMarketDataService,
} from "./historical-service.js";
import {
  createFxcmRealtimeStreamService,
  type FxcmRealtimeStreamService,
} from "./stream-service.js";
import {
  createFxcmLiveCandleService,
  type FxcmLiveCandleService,
} from "./live-candle-service.js";
import type { SafeFxcmDiscoveryResult } from "./instrument-discovery-types.js";
import type { FxcmHistoricalRequest, SafeFxcmHistoricalResult } from "./historical-types.js";
import type { SafeFxcmStreamStatus, SafeFxcmQuoteSnapshot, FxcmSubscriptionRecord } from "./stream-types.js";
import type { SafeFxcmLiveCandleSeries } from "./live-candle-types.js";
import { FxcmMarketDataError, userFacingFxcmError } from "./errors.js";
import type { FetchLike } from "./client.js";
import type {
  MarketDataProvider,
  MarketInstrument,
  MarketProviderHealth,
  MarketProviderInfo,
} from "../providers/types.js";
import type { SafeFxcmAuthenticationStatus } from "./auth-types.js";

export interface FxcmProviderOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  nowMs?: () => number;
  auth?: FxcmAuthenticationService;
  discovery?: FxcmInstrumentDiscoveryService;
  historical?: FxcmHistoricalMarketDataService;
  stream?: FxcmRealtimeStreamService;
  liveCandles?: FxcmLiveCandleService;
}

export class FxcmMarketDataProvider implements MarketDataProvider {
  private readonly config: FxcmConfig;
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl?: FetchLike;
  private readonly nowMs: () => number;
  private readonly auth: FxcmAuthenticationService;
  private readonly discovery: FxcmInstrumentDiscoveryService;
  private readonly historical: FxcmHistoricalMarketDataService;
  private readonly stream: FxcmRealtimeStreamService;
  private readonly liveCandles: FxcmLiveCandleService;
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
    this.discovery = options.discovery ?? createFxcmInstrumentDiscoveryService({
      env: this.env,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
      auth: this.auth,
    });
    this.historical = options.historical ?? createFxcmHistoricalMarketDataService({
      env: this.env,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
      auth: this.auth,
      discovery: this.discovery,
    });
    this.stream = options.stream ?? createFxcmRealtimeStreamService({
      env: this.env,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
      auth: this.auth,
      discovery: this.discovery,
    });
    this.liveCandles = options.liveCandles ?? createFxcmLiveCandleService({
      env: this.env,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
      auth: this.auth,
      discovery: this.discovery,
      historical: this.historical,
      stream: this.stream,
    });
  }

  getConfig(): FxcmConfig {
    return this.config;
  }

  getAuthService(): FxcmAuthenticationService {
    return this.auth;
  }

  getDiscoveryService(): FxcmInstrumentDiscoveryService {
    return this.discovery;
  }

  getHistoricalService(): FxcmHistoricalMarketDataService {
    return this.historical;
  }

  getStreamService(): FxcmRealtimeStreamService {
    return this.stream;
  }

  getLiveCandleService(): FxcmLiveCandleService {
    return this.liveCandles;
  }

  getProviderInfo(): MarketProviderInfo {
    return {
      provider: "FXCM",
      displayName: "FXCM",
      apiPath: "FXCM Socket REST API (official)",
      marketTypes: ["FOREX", "CFD", "COMMODITY", "INDEX", "TREASURY", "SHARE", "OTHER"],
      environmentLabel: this.config.environmentLabel,
      capabilities: { ...FXCM_PHASE31_CAPABILITIES },
    };
  }

  getCapabilities() {
    return { ...FXCM_PHASE31_CAPABILITIES };
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

  async discoverInstruments(options?: {
    refresh?: boolean;
    marketType?: string | null;
    search?: string | null;
    status?: string | null;
    baseAsset?: string | null;
    quoteAsset?: string | null;
    mappingStatus?: string | null;
  }): Promise<SafeFxcmDiscoveryResult> {
    return this.discovery.discover(options);
  }

  getStreamStatus(): SafeFxcmStreamStatus {
    return this.stream.toSafeApiPayload();
  }

  async subscribeQuote(symbol: string): Promise<FxcmSubscriptionRecord> {
    return this.stream.subscribe(symbol);
  }

  async unsubscribeQuote(symbol: string): Promise<void> {
    return this.stream.unsubscribe(symbol);
  }

  listQuotes(): SafeFxcmQuoteSnapshot[] {
    return this.stream.listQuotes();
  }

  async subscribeLiveCandles(symbol: string, timeframe: string): Promise<SafeFxcmLiveCandleSeries> {
    return this.liveCandles.subscribe(symbol, timeframe);
  }

  async unsubscribeLiveCandles(symbol: string, timeframe: string): Promise<void> {
    return this.liveCandles.unsubscribe(symbol, timeframe);
  }

  getLiveCandleSeries(symbol: string, timeframe: string): SafeFxcmLiveCandleSeries | null {
    return this.liveCandles.getSeries(symbol, timeframe);
  }

  async healthCheck(): Promise<MarketProviderHealth> {
    const checkedAt = new Date(this.nowMs()).toISOString();
    const streamState = this.stream.getStreamState();
    const streamLive = streamState === "LIVE";
    const liveSessions = this.liveCandles.listSessions().length;
    const baseNotes = [
      "Phase 30 live candle sync available (historical + quotes).",
      "Phase 29 real-time quotes available.",
      "Phase 28 historical candles available.",
      "Trading: DISABLED.",
      `Stream state: ${streamState}`,
      `Live candle sessions: ${liveSessions}`,
      `Environment: ${this.config.environmentLabel}`,
      "CONNECTED ≠ LIVE; LIVE requires a recent valid quote event.",
      "API path: FXCM Socket REST (official). ForexConnect SDK is NOT integrated.",
      "ForexConnect uses username/password (not Socket REST token) but requires native C++/Java/Python SDK — incompatible with this Node.js gateway without a separate sidecar.",
      "Next action: set KWIZERA_FXCM_ENABLED=1 + KWIZERA_FXCM_ACCESS_TOKEN (Trading Station Web token). Live REST often needs api@fxcm.com enablement. See docs/forex-fxcm-forexconnect-investigation.md.",
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

    // Authenticated — verify discovery path (metadata only).
    try {
      const discovery = await this.discovery.discover({ refresh: false });
      if (discovery.discoveryStatus !== "READY" && discovery.source === "NONE") {
        throw new FxcmMarketDataError(
          discovery.errorCode ?? "FXCM_UNAVAILABLE",
          discovery.errorMessage ?? "Instrument discovery failed.",
        );
      }
      this.auth.touchValidated();
      const connectionState =
        streamState === "RECONNECTING" ? "RECONNECTING"
          : streamState === "CONNECTING" ? "CONNECTING"
            : streamState === "LIVE" || streamState === "CONNECTED" || streamState === "STALE" ? "CONNECTED"
              : streamState === "NETWORK_ERROR" || streamState === "ERROR" || streamState === "AUTHENTICATION_ERROR"
                ? "ERROR"
                : "DISCONNECTED";
      this.lastHealth = {
        provider: "FXCM",
        enabled: true,
        environment: this.config.environment,
        environmentLabel: this.config.environmentLabel,
        configured: true,
        authenticated: true,
        reachable: true,
        status: "CONNECTED",
        connectionState,
        liveStreamEnabled: streamLive || streamState === "CONNECTED" || streamState === "STALE",
        tradingEnabled: false,
        instrumentDiscovery: "READY",
        checkedAt,
        errorCode: null,
        errorMessage: null,
        notes: [
          ...baseNotes,
          "Authentication: AUTHENTICATED.",
          `Instruments discovered: ${discovery.count}`,
          `Discovery source: ${discovery.source}`,
          `Quote subscriptions: ${this.stream.listSubscriptions().length}`,
        ],
      };
      console.info("[fxcm] health", JSON.stringify({
        status: "CONNECTED",
        authState: "AUTHENTICATED",
        environment: this.config.environment,
        host: this.config.restBaseHost,
        instruments: discovery.count,
        discoverySource: discovery.source,
        streamState,
        liveStreamEnabled: this.lastHealth.liveStreamEnabled,
        tradingEnabled: false,
        marketData: streamLive ? "STREAMING" : "READY",
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
    return this.discovery.listInstruments(options);
  }

  async getInstrument(symbol: string): Promise<MarketInstrument | null> {
    return this.discovery.getInstrument(symbol);
  }

  async getHistoricalCandles(request: FxcmHistoricalRequest): Promise<SafeFxcmHistoricalResult> {
    return this.historical.getHistoricalCandles(request);
  }
}

export function createFxcmMarketDataProvider(options?: FxcmProviderOptions): FxcmMarketDataProvider {
  return new FxcmMarketDataProvider(options);
}
