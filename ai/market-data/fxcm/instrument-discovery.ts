/**
 * Phase 27 — FXCM Instrument Discovery Service.
 *
 * Authenticates via Phase 26, retrieves official /trading/get_instruments,
 * normalizes + validates mappings, caches per DEMO/REAL environment.
 * Does NOT fetch prices, candles, streams, or trading data.
 */
import {
  FXCM_INSTRUMENT_CACHE_MS,
  resolveFxcmConfig,
  type FxcmConfig,
  type FxcmEnvironment,
} from "./config.js";
import { fxcmGetInstruments, type FetchLike } from "./client.js";
import {
  createFxcmAuthenticationService,
  type FxcmAuthenticationService,
} from "./auth-service.js";
import { FxcmMarketDataError, userFacingFxcmError } from "./errors.js";
import {
  assertSafeDiscoveryPayload,
  filterDiscoveredInstruments,
  mapFxcmInstrumentCatalog,
  toCanonicalFxcmSymbol,
} from "./instrument-mapper.js";
import { readFxcmAccessToken } from "./config.js";
import type { MarketInstrument } from "../providers/types.js";
import type {
  FxcmCacheFreshness,
  FxcmDiscoveryStatus,
  FxcmMappingConflict,
  SafeFxcmDiscoveredInstrument,
  SafeFxcmDiscoveryResult,
} from "./instrument-discovery-types.js";

export interface FxcmInstrumentDiscoveryOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  nowMs?: () => number;
  auth?: FxcmAuthenticationService;
  cacheTtlMs?: number;
}

interface EnvCacheEntry {
  environment: FxcmEnvironment;
  restBaseHost: string;
  fetchedAtUtc: number;
  instruments: MarketInstrument[];
  discovered: SafeFxcmDiscoveredInstrument[];
  conflicts: FxcmMappingConflict[];
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export class FxcmInstrumentDiscoveryService {
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl?: FetchLike;
  private readonly nowMs: () => number;
  private readonly auth: FxcmAuthenticationService;
  private readonly cacheTtlMs: number;
  private config: FxcmConfig;
  /** Separate caches per environment — DEMO catalog must never appear as REAL. */
  private readonly caches = new Map<FxcmEnvironment, EnvCacheEntry>();
  private inflight: Promise<SafeFxcmDiscoveryResult> | null = null;
  private freshness: FxcmCacheFreshness = "EMPTY";

  constructor(options: FxcmInstrumentDiscoveryOptions = {}) {
    this.env = options.env ?? (process.env as Record<string, string | undefined>);
    this.fetchImpl = options.fetchImpl;
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.cacheTtlMs = options.cacheTtlMs ?? FXCM_INSTRUMENT_CACHE_MS;
    this.config = resolveFxcmConfig(this.env);
    this.auth = options.auth ?? createFxcmAuthenticationService({
      env: this.env,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
    });
    this.freshness = this.initialFreshness();
  }

  getAuthService(): FxcmAuthenticationService {
    return this.auth;
  }

  getConfig(): FxcmConfig {
    this.config = resolveFxcmConfig(this.env);
    return this.config;
  }

  private initialFreshness(): FxcmCacheFreshness {
    const cfg = resolveFxcmConfig(this.env);
    if (!cfg.enabled) return "DISABLED";
    if (!cfg.accessTokenConfigured) return "NOT_CONFIGURED";
    return "EMPTY";
  }

  private getCacheForEnv(environment: FxcmEnvironment): EnvCacheEntry | null {
    const entry = this.caches.get(environment) ?? null;
    if (!entry) return null;
    if (entry.environment !== environment) return null;
    return entry;
  }

  private freshnessFor(entry: EnvCacheEntry | null, now: number): FxcmCacheFreshness {
    if (!this.config.enabled) return "DISABLED";
    if (!this.config.accessTokenConfigured) return "NOT_CONFIGURED";
    if (!entry) return this.freshness === "FAILED" ? "FAILED" : "EMPTY";
    if (now - entry.fetchedAtUtc < this.cacheTtlMs) return "FRESH";
    return "STALE";
  }

  private emptyResult(
    partial: Partial<SafeFxcmDiscoveryResult> & {
      discoveryStatus: FxcmDiscoveryStatus;
      freshness: FxcmCacheFreshness;
    },
  ): SafeFxcmDiscoveryResult {
    const cfg = this.getConfig();
    return {
      provider: "FXCM",
      environment: cfg.environment,
      environmentLabel: cfg.environmentLabel,
      discoveryStatus: partial.discoveryStatus,
      freshness: partial.freshness,
      source: partial.source ?? "NONE",
      fetchedAt: partial.fetchedAt ?? null,
      count: partial.count ?? 0,
      instruments: partial.instruments ?? [],
      conflicts: partial.conflicts ?? [],
      authenticationState: partial.authenticationState ?? this.auth.getState(),
      marketData: "NOT_STARTED",
      liveStream: "NOT_ENABLED_YET",
      trading: "DISABLED",
      errorCode: partial.errorCode ?? null,
      errorMessage: partial.errorMessage ?? null,
      note: partial.note
        ?? "Phase 27 instrument discovery — metadata only; no live prices, candles, or trading.",
    };
  }

  /**
   * Discover instruments. Uses cache when fresh unless refresh=true.
   * Single-flight protects concurrent refresh storms.
   */
  discover(options?: {
    refresh?: boolean;
    marketType?: string | null;
    search?: string | null;
    status?: string | null;
    baseAsset?: string | null;
    quoteAsset?: string | null;
    mappingStatus?: string | null;
  }): Promise<SafeFxcmDiscoveryResult> {
    if (this.inflight && options?.refresh) {
      return this.inflight.then((result) => this.applyFilters(result, options));
    }
    if (this.inflight) {
      return this.inflight.then((result) => this.applyFilters(result, options));
    }

    this.inflight = this.runDiscover(Boolean(options?.refresh))
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight.then((result) => this.applyFilters(result, options));
  }

  private applyFilters(
    result: SafeFxcmDiscoveryResult,
    filters?: {
      marketType?: string | null;
      search?: string | null;
      status?: string | null;
      baseAsset?: string | null;
      quoteAsset?: string | null;
      mappingStatus?: string | null;
    },
  ): SafeFxcmDiscoveryResult {
    if (!filters) return result;
    const instruments = filterDiscoveredInstruments(result.instruments, filters);
    return { ...result, instruments, count: instruments.length };
  }

  private async runDiscover(refresh: boolean): Promise<SafeFxcmDiscoveryResult> {
    this.config = resolveFxcmConfig(this.env);
    const now = this.nowMs();

    if (!this.config.enabled) {
      this.freshness = "DISABLED";
      return this.emptyResult({
        discoveryStatus: "DISABLED",
        freshness: "DISABLED",
        authenticationState: "DISABLED",
        errorCode: "FXCM_DISABLED",
        errorMessage: "FXCM market data is disabled.",
      });
    }

    if (!this.config.accessTokenConfigured) {
      this.freshness = "NOT_CONFIGURED";
      return this.emptyResult({
        discoveryStatus: "NOT_CONFIGURED",
        freshness: "NOT_CONFIGURED",
        authenticationState: "NOT_CONFIGURED",
        errorCode: "FXCM_CONFIG_MISSING",
        errorMessage: "FXCM access token is not configured on the server.",
      });
    }

    const cached = this.getCacheForEnv(this.config.environment);
    const freshness = this.freshnessFor(cached, now);

    if (!refresh && cached && freshness === "FRESH") {
      this.freshness = "FRESH";
      const result = this.emptyResult({
        discoveryStatus: "READY",
        freshness: "FRESH",
        source: "CACHED",
        fetchedAt: new Date(cached.fetchedAtUtc).toISOString(),
        count: cached.discovered.length,
        instruments: cached.discovered,
        conflicts: cached.conflicts,
        authenticationState: this.auth.getState(),
        note: "Phase 27 instrument discovery from cache (FRESH). Source=CACHED — not a live price feed.",
      });
      assertSafeDiscoveryPayload(result, readFxcmAccessToken(this.env));
      return result;
    }

    // Serve STALE cache while attempting refresh only when refresh not forced —
    // for forced refresh we still try provider; on failure fall back to stale.
    this.freshness = "REFRESHING";

    const authCtx = await this.auth.authenticate();
    if (authCtx.state !== "AUTHENTICATED") {
      this.freshness = cached ? "STALE" : "FAILED";
      if (cached && cached.environment === this.config.environment) {
        return this.emptyResult({
          discoveryStatus: authCtx.state === "NETWORK_ERROR" ? "NETWORK_ERROR" : "AUTHENTICATION_ERROR",
          freshness: "STALE",
          source: "CACHED",
          fetchedAt: new Date(cached.fetchedAtUtc).toISOString(),
          count: cached.discovered.length,
          instruments: cached.discovered,
          conflicts: cached.conflicts,
          authenticationState: authCtx.state,
          errorCode: authCtx.lastErrorCode,
          errorMessage: authCtx.lastErrorMessage,
          note: "Returning STALE cached instruments — authentication failed. Source=CACHED.",
        });
      }
      return this.emptyResult({
        discoveryStatus: authCtx.state === "NETWORK_ERROR" ? "NETWORK_ERROR"
          : authCtx.state === "UNAVAILABLE" ? "UNAVAILABLE"
            : "AUTHENTICATION_ERROR",
        freshness: "AUTH_REQUIRED",
        authenticationState: authCtx.state,
        errorCode: authCtx.lastErrorCode,
        errorMessage: authCtx.lastErrorMessage ?? "FXCM authentication failed.",
      });
    }

    let session = this.auth.getSessionHandle();
    if (!session) {
      this.freshness = "FAILED";
      return this.emptyResult({
        discoveryStatus: "AUTHENTICATION_ERROR",
        freshness: "FAILED",
        authenticationState: "AUTHENTICATION_ERROR",
        errorCode: "FXCM_AUTH_UNAUTHORIZED",
        errorMessage: "Authenticated session missing.",
      });
    }

    try {
      let raw = await fxcmGetInstruments(this.config, session, { fetchImpl: this.fetchImpl });
      let catalog = mapFxcmInstrumentCatalog(raw);

      const entry: EnvCacheEntry = {
        environment: this.config.environment,
        restBaseHost: this.config.restBaseHost,
        fetchedAtUtc: now,
        instruments: catalog.instruments,
        discovered: catalog.discovered,
        conflicts: catalog.conflicts,
        lastErrorCode: null,
        lastErrorMessage: null,
      };
      this.caches.set(this.config.environment, entry);
      this.freshness = "FRESH";
      this.auth.touchValidated();

      console.info("[FXCM] instruments discovered", JSON.stringify({
        environment: this.config.environment,
        host: this.config.restBaseHost,
        count: catalog.discovered.length,
        conflicts: catalog.conflicts.length,
        source: "FXCM",
        cached: false,
      }));

      const result = this.emptyResult({
        discoveryStatus: "READY",
        freshness: "FRESH",
        source: "FXCM",
        fetchedAt: new Date(now).toISOString(),
        count: catalog.discovered.length,
        instruments: catalog.discovered,
        conflicts: catalog.conflicts,
        authenticationState: "AUTHENTICATED",
      });
      assertSafeDiscoveryPayload(result, readFxcmAccessToken(this.env));
      return result;
    } catch (error) {
      const mapped = userFacingFxcmError(error);
      if (mapped.code === "FXCM_AUTHENTICATION_FAILED") {
        try {
          await this.auth.markExpiredAndReauthenticate();
          session = this.auth.getSessionHandle();
          if (session) {
            const raw = await fxcmGetInstruments(this.config, session, { fetchImpl: this.fetchImpl });
            const catalog = mapFxcmInstrumentCatalog(raw);
            const entry: EnvCacheEntry = {
              environment: this.config.environment,
              restBaseHost: this.config.restBaseHost,
              fetchedAtUtc: now,
              instruments: catalog.instruments,
              discovered: catalog.discovered,
              conflicts: catalog.conflicts,
              lastErrorCode: null,
              lastErrorMessage: null,
            };
            this.caches.set(this.config.environment, entry);
            this.freshness = "FRESH";
            const result = this.emptyResult({
              discoveryStatus: "READY",
              freshness: "FRESH",
              source: "FXCM",
              fetchedAt: new Date(now).toISOString(),
              count: catalog.discovered.length,
              instruments: catalog.discovered,
              conflicts: catalog.conflicts,
              authenticationState: "AUTHENTICATED",
            });
            assertSafeDiscoveryPayload(result, readFxcmAccessToken(this.env));
            return result;
          }
        } catch {
          // fall through to stale/fail
        }
      }

      const stale = this.getCacheForEnv(this.config.environment);
      this.freshness = stale ? "STALE" : "FAILED";
      if (stale) {
        return this.emptyResult({
          discoveryStatus: mapped.code === "FXCM_NETWORK" || mapped.code === "FXCM_TIMEOUT"
            ? "NETWORK_ERROR"
            : "FAILED",
          freshness: "STALE",
          source: "CACHED",
          fetchedAt: new Date(stale.fetchedAtUtc).toISOString(),
          count: stale.discovered.length,
          instruments: stale.discovered,
          conflicts: stale.conflicts,
          authenticationState: this.auth.getState(),
          errorCode: mapped.code,
          errorMessage: mapped.message,
          note: "Returning STALE cached instruments — provider refresh failed. Source=CACHED.",
        });
      }

      return this.emptyResult({
        discoveryStatus: mapped.code === "FXCM_NETWORK" || mapped.code === "FXCM_TIMEOUT"
          ? "NETWORK_ERROR"
          : mapped.code === "FXCM_UNAVAILABLE" ? "UNAVAILABLE" : "FAILED",
        freshness: "FAILED",
        authenticationState: this.auth.getState(),
        errorCode: mapped.code,
        errorMessage: mapped.message,
      });
    }
  }

  async listInstruments(options?: { refresh?: boolean }): Promise<MarketInstrument[]> {
    const discovery = await this.discover({ refresh: options?.refresh });
    if (
      discovery.discoveryStatus === "DISABLED"
      || discovery.discoveryStatus === "NOT_CONFIGURED"
    ) {
      throw new FxcmMarketDataError(
        discovery.errorCode === "FXCM_DISABLED" ? "FXCM_DISABLED" : "FXCM_NOT_CONFIGURED",
        discovery.errorMessage ?? "FXCM instruments unavailable.",
      );
    }
    if (
      discovery.count === 0
      && discovery.source === "NONE"
      && discovery.discoveryStatus !== "READY"
    ) {
      throw new FxcmMarketDataError(
        discovery.errorCode === "FXCM_AUTHENTICATION_FAILED"
          || discovery.discoveryStatus === "AUTHENTICATION_ERROR"
          ? "FXCM_AUTHENTICATION_FAILED"
          : discovery.discoveryStatus === "NETWORK_ERROR"
            ? "FXCM_NETWORK"
            : "FXCM_UNAVAILABLE",
        discovery.errorMessage ?? "FXCM instrument discovery failed.",
      );
    }
    const entry = this.getCacheForEnv(this.config.environment);
    return (entry?.instruments ?? []).map((i) => ({ ...i, metadata: { ...i.metadata } }));
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

  /** Test helper — inspect which environments currently hold cache entries. */
  cachedEnvironments(): FxcmEnvironment[] {
    return [...this.caches.keys()];
  }
}

export function createFxcmInstrumentDiscoveryService(
  options?: FxcmInstrumentDiscoveryOptions,
): FxcmInstrumentDiscoveryService {
  return new FxcmInstrumentDiscoveryService(options);
}
