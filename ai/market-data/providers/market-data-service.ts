/**
 * Central Market Data Service — Phase 31.
 * Routes by explicit provider identity. Never silently falls back across providers.
 */
import { createBinanceMarketDataService, type BinanceMarketDataService } from "../binance/service.js";
import { toDisplaySymbol } from "../binance/adapter.js";
import type { SafeFxcmHistoricalResult } from "../fxcm/historical-types.js";
import type { SafeFxcmLiveCandleSeries } from "../fxcm/live-candle-types.js";
import type { SafeFxcmQuoteSnapshot } from "../fxcm/stream-types.js";
import {
  buildMarketIdentity,
  marketDataCacheKey,
  marketIdentityKey,
  normalizeCanonicalSymbol,
  parseMarketProviderId,
  type MarketIdentity,
} from "./identity.js";
import {
  normalizeConnectionState,
  normalizeDataQuality,
  parseCanonicalTimeframe,
  type CanonicalTimeframeId,
  type UnifiedCandle,
  type UnifiedCandleSeries,
  type UnifiedMarketSnapshot,
  type UnifiedProviderHealth,
  type UnifiedQuote,
} from "./contracts.js";
import { createMarketInstrumentRegistry, type MarketInstrumentRegistry } from "./instrument-registry.js";
import {
  createMarketDataProviderRegistry,
  type MarketDataProviderRegistry,
} from "./registry.js";
import { requireExplicitProvider } from "./routing.js";
import type {
  MarketAssetType,
  MarketInstrument,
  MarketProviderHealth,
  MarketProviderId,
} from "./types.js";

export class MarketDataRoutingError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MarketDataRoutingError";
    this.code = code;
  }
}

export interface HistoricalCandlesRequest {
  provider: MarketProviderId | string;
  symbol: string;
  timeframe: string;
  marketType?: MarketAssetType | string | null;
  startTimeMs?: number | null;
  endTimeMs?: number | null;
  limit?: number | null;
  refresh?: boolean;
}

export interface LiveCandlesRequest {
  provider: MarketProviderId | string;
  symbol: string;
  timeframe: string;
  marketType?: MarketAssetType | string | null;
}

export interface QuoteRequest {
  provider: MarketProviderId | string;
  symbol: string;
  marketType?: MarketAssetType | string | null;
}

export class MarketDataService {
  private readonly registry: MarketDataProviderRegistry;
  private readonly instruments: MarketInstrumentRegistry;
  private readonly binance: BinanceMarketDataService;
  private readonly historicalCache = new Map<string, { at: number; series: UnifiedCandleSeries }>();
  private readonly HIST_CACHE_MS = 5_000;

  constructor(options?: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    registry?: MarketDataProviderRegistry;
    binance?: BinanceMarketDataService;
    instruments?: MarketInstrumentRegistry;
  }) {
    this.registry = options?.registry ?? createMarketDataProviderRegistry({
      env: options?.env,
      fetchImpl: options?.fetchImpl,
    });
    this.binance = options?.binance ?? createBinanceMarketDataService({ env: options?.env, fetchImpl: options?.fetchImpl });
    this.instruments = options?.instruments ?? createMarketInstrumentRegistry();
  }

  getRegistry(): MarketDataProviderRegistry {
    return this.registry;
  }

  getInstrumentRegistry(): MarketInstrumentRegistry {
    return this.instruments;
  }

  listProviders(): MarketProviderId[] {
    return this.registry.listProviderIds();
  }

  resolveProvider(provider: MarketProviderId | string): MarketProviderId {
    const required = requireExplicitProvider(provider);
    if (!required.ok) {
      throw new MarketDataRoutingError(required.code, required.message);
    }
    const resolved = this.registry.getProvider(required.provider);
    if (!resolved) {
      throw new MarketDataRoutingError("UNKNOWN_PROVIDER", `Provider ${required.provider} is not registered.`);
    }
    return required.provider;
  }

  async listInstruments(options?: {
    provider?: MarketProviderId | string | null;
    marketType?: MarketAssetType | string | null;
    search?: string | null;
    refresh?: boolean;
    limit?: number;
  }): Promise<MarketInstrument[]> {
    const providerFilter = options?.provider ? this.resolveProvider(options.provider) : null;
    const marketType = options?.marketType
      ? String(options.marketType).trim().toUpperCase() as MarketAssetType
      : null;
    const limit = options?.limit ?? 5_000;

    // Explicit single-provider request: never return a silent empty list when that
    // provider is DISABLED / NOT_CONFIGURED / auth-failed. Never fall back to Binance.
    if (providerFilter) {
      const provider = this.registry.getProvider(providerFilter);
      if (!provider) {
        throw new MarketDataRoutingError("UNKNOWN_PROVIDER", `Provider ${providerFilter} is not registered.`);
      }
      const cached = this.instruments.listByProvider(providerFilter);
      if (options?.refresh || cached.length === 0) {
        // Propagate provider errors (FXCM_DISABLED, FXCM_NOT_CONFIGURED, …).
        const list = await provider.listInstruments({ refresh: options?.refresh });
        this.instruments.removeByProvider(providerFilter);
        this.instruments.upsertMany(list);
      }
      if (options?.search) {
        return this.instruments.search(options.search, {
          provider: providerFilter,
          marketType,
          limit: options.limit ?? 200,
        });
      }
      let list = this.instruments.listByProvider(providerFilter);
      if (marketType) list = list.filter((item) => item.marketType === marketType);
      return list.slice(0, limit);
    }

    // All-providers catalog: a single provider failure must not wipe the other.
    if (options?.refresh || this.instruments.size() === 0) {
      if (options?.refresh) this.instruments.clear();
      for (const providerId of this.registry.listProviderIds()) {
        const provider = this.registry.getProvider(providerId);
        if (!provider) continue;
        try {
          const list = await provider.listInstruments({ refresh: options?.refresh });
          this.instruments.removeByProvider(providerId);
          this.instruments.upsertMany(list);
        } catch {
          // Keep other providers; explicit ?provider=FXCM path above surfaces FXCM errors.
        }
      }
    }

    if (options?.search) {
      return this.instruments.search(options.search, {
        provider: null,
        marketType,
        limit: options.limit ?? 200,
      });
    }

    let list = this.instruments.listAll();
    if (marketType) {
      list = list.filter((item) => item.marketType === marketType);
    }
    return list.slice(0, limit);
  }

  async getInstrument(input: {
    provider: MarketProviderId | string;
    symbol: string;
    marketType?: MarketAssetType | string | null;
  }): Promise<MarketInstrument | null> {
    const providerId = this.resolveProvider(input.provider);
    const provider = this.registry.getProvider(providerId);
    if (!provider) return null;

    const direct = await provider.getInstrument(input.symbol);
    if (direct) {
      this.instruments.upsert(direct);
      if (input.marketType && direct.marketType !== String(input.marketType).toUpperCase()) {
        return null;
      }
      return direct;
    }

    const marketType = (input.marketType
      ? String(input.marketType).toUpperCase()
      : providerId === "BINANCE" ? "CRYPTO" : "FOREX") as MarketAssetType;

    return this.instruments.findByProviderSymbol(providerId, input.symbol)
      ?? this.instruments.getInstrument({
        provider: providerId,
        marketType,
        canonicalSymbol: normalizeCanonicalSymbol(input.symbol),
      });
  }

  async getHistoricalCandles(request: HistoricalCandlesRequest): Promise<UnifiedCandleSeries> {
    const providerId = this.resolveProvider(request.provider);
    const timeframe = parseCanonicalTimeframe(request.timeframe);
    if (!timeframe) {
      throw new MarketDataRoutingError("UNSUPPORTED_TIMEFRAME", `Unsupported timeframe: ${request.timeframe}`);
    }

    const marketType = (request.marketType
      ? String(request.marketType).toUpperCase()
      : providerId === "BINANCE" ? "CRYPTO" : "FOREX") as MarketAssetType;

    const cacheKey = marketDataCacheKey({
      provider: providerId,
      marketType,
      symbol: request.symbol,
      timeframe,
      kind: "historical",
      environment: providerId === "FXCM" ? this.registry.getFxcm().getConfig().environment : "public",
    });
    const cached = this.historicalCache.get(cacheKey);
    if (cached && Date.now() - cached.at < this.HIST_CACHE_MS && !request.refresh) {
      return cached.series;
    }

    if (providerId === "BINANCE") {
      const series = await this.fetchBinanceHistorical(request.symbol, timeframe, request.limit ?? 300);
      this.historicalCache.set(cacheKey, { at: Date.now(), series });
      return series;
    }

    // FXCM only — never fall back to Binance.
    const fxcm = this.registry.getFxcm();
    const result = await fxcm.getHistoricalCandles({
      symbol: request.symbol,
      timeframe,
      startTimeMs: request.startTimeMs,
      endTimeMs: request.endTimeMs,
      limit: request.limit,
      refresh: request.refresh,
    });
    const series = unifyFxcmHistorical(result);
    this.historicalCache.set(cacheKey, { at: Date.now(), series });
    return series;
  }

  async subscribeLiveCandles(request: LiveCandlesRequest): Promise<UnifiedCandleSeries> {
    const providerId = this.resolveProvider(request.provider);
    const timeframe = parseCanonicalTimeframe(request.timeframe);
    if (!timeframe) {
      throw new MarketDataRoutingError("UNSUPPORTED_TIMEFRAME", `Unsupported timeframe: ${request.timeframe}`);
    }

    if (providerId === "BINANCE") {
      // Browser owns Binance WS live klines; server returns historical REST as HISTORICAL baseline.
      const historical = await this.fetchBinanceHistorical(request.symbol, timeframe, 300);
      return {
        ...historical,
        sourceMode: "HISTORICAL",
        note: "Binance live candles are delivered via the existing browser WebSocket path; REST historical snapshot returned here.",
      };
    }

    const fxcm = this.registry.getFxcm();
    const live = await fxcm.subscribeLiveCandles(request.symbol, timeframe);
    return unifyFxcmLiveSeries(live);
  }

  async unsubscribeLiveCandles(request: LiveCandlesRequest): Promise<void> {
    const providerId = this.resolveProvider(request.provider);
    if (providerId !== "FXCM") return;
    const timeframe = parseCanonicalTimeframe(request.timeframe);
    if (!timeframe) return;
    await this.registry.getFxcm().unsubscribeLiveCandles(request.symbol, timeframe);
  }

  getLiveCandleSeries(request: LiveCandlesRequest): UnifiedCandleSeries | null {
    const providerId = parseMarketProviderId(request.provider);
    if (providerId !== "FXCM") return null;
    const timeframe = parseCanonicalTimeframe(request.timeframe);
    if (!timeframe) return null;
    const live = this.registry.getFxcm().getLiveCandleSeries(request.symbol, timeframe);
    return live ? unifyFxcmLiveSeries(live) : null;
  }

  async getCurrentQuote(request: QuoteRequest): Promise<UnifiedQuote | null> {
    const providerId = this.resolveProvider(request.provider);
    if (providerId === "BINANCE") {
      return null; // Browser miniTicker path remains authoritative for Binance live quotes.
    }
    const quotes = this.registry.getFxcm().listQuotes();
    const compact = normalizeCanonicalSymbol(request.symbol);
    const slash = request.symbol.includes("/") ? request.symbol.trim().toUpperCase() : null;
    const match = quotes.find((q) =>
      normalizeCanonicalSymbol(q.canonicalSymbol) === compact
      || normalizeCanonicalSymbol(q.providerSymbol) === compact
      || (slash != null && q.providerSymbol.toUpperCase() === slash),
    );
    return match ? unifyFxcmQuote(match) : null;
  }

  async subscribeQuotes(request: QuoteRequest): Promise<UnifiedQuote | null> {
    const providerId = this.resolveProvider(request.provider);
    if (providerId !== "FXCM") {
      throw new MarketDataRoutingError(
        "CAPABILITY_UNSUPPORTED",
        "Quote subscribe via MarketDataService is FXCM-only; Binance uses the existing live ticker stream.",
      );
    }
    await this.registry.getFxcm().subscribeQuote(request.symbol);
    return this.getCurrentQuote(request);
  }

  async unsubscribeQuotes(request: QuoteRequest): Promise<void> {
    const providerId = this.resolveProvider(request.provider);
    if (providerId !== "FXCM") return;
    await this.registry.getFxcm().unsubscribeQuote(request.symbol);
  }

  async getProviderHealth(provider?: MarketProviderId | string | null): Promise<UnifiedProviderHealth[]> {
    const ids = provider
      ? [this.resolveProvider(provider)]
      : this.registry.listProviderIds();
    const out: UnifiedProviderHealth[] = [];
    for (const id of ids) {
      const p = this.registry.getProvider(id);
      if (!p) continue;
      const health = await p.healthCheck();
      out.push(toUnifiedHealth(health, p.getCapabilities()));
    }
    return out;
  }

  async getSnapshot(input: {
    provider: MarketProviderId | string;
    symbol: string;
    timeframe: string;
    marketType?: MarketAssetType | string | null;
  }): Promise<UnifiedMarketSnapshot> {
    const providerId = this.resolveProvider(input.provider);
    const timeframe = parseCanonicalTimeframe(input.timeframe);
    if (!timeframe) {
      throw new MarketDataRoutingError("UNSUPPORTED_TIMEFRAME", `Unsupported timeframe: ${input.timeframe}`);
    }
    const marketType = (input.marketType
      ? String(input.marketType).toUpperCase()
      : providerId === "BINANCE" ? "CRYPTO" : "FOREX") as MarketAssetType;

    const instrument = await this.getInstrument({
      provider: providerId,
      symbol: input.symbol,
      marketType,
    });

    const identity = buildMarketIdentity({
      provider: providerId,
      marketType: instrument?.marketType ?? marketType,
      providerSymbol: instrument?.providerSymbol ?? input.symbol,
      canonicalSymbol: instrument?.canonicalSymbol ?? normalizeCanonicalSymbol(input.symbol),
      displaySymbol: instrument?.displaySymbol
        ?? (providerId === "BINANCE" ? toDisplaySymbol(normalizeCanonicalSymbol(input.symbol)) : input.symbol),
      environment: providerId === "FXCM" ? this.registry.getFxcm().getConfig().environment : "public",
    });

    let series: UnifiedCandleSeries | null = null;
    if (providerId === "FXCM") {
      series = this.getLiveCandleSeries({ provider: providerId, symbol: input.symbol, timeframe })
        ?? await this.getHistoricalCandles({
          provider: providerId,
          symbol: input.symbol,
          timeframe,
          marketType,
        });
    } else {
      series = await this.getHistoricalCandles({
        provider: providerId,
        symbol: input.symbol,
        timeframe,
        marketType,
      });
    }

    const quote = await this.getCurrentQuote({ provider: providerId, symbol: input.symbol, marketType });
    const forming = series?.forming ?? (series?.candles.length
      ? series.candles[series.candles.length - 1]!
      : null);

    return {
      identity,
      quote,
      candle: forming,
      series,
      connectionState: series?.connectionState ?? "NO_DATA",
      dataQuality: series?.dataQuality ?? "NO_DATA",
      updatedAt: new Date().toISOString(),
    };
  }

  /** Assert two identities do not collide (cross-provider isolation). */
  assertIsolated(a: MarketIdentity, b: MarketIdentity): boolean {
    return marketIdentityKey(a) !== marketIdentityKey(b);
  }

  private async fetchBinanceHistorical(
    symbol: string,
    timeframe: CanonicalTimeframeId,
    limit: number,
  ): Promise<UnifiedCandleSeries> {
    const series = await this.binance.listKlines({ symbol, timeframe, limit });
    const identity = buildMarketIdentity({
      provider: "BINANCE",
      marketType: "CRYPTO",
      providerSymbol: series.symbol,
      canonicalSymbol: series.symbol,
      displaySymbol: toDisplaySymbol(series.symbol),
      environment: "public",
    });
    const candles: UnifiedCandle[] = series.candles.map((c) => ({
      provider: "BINANCE",
      marketType: "CRYPTO",
      providerSymbol: series.symbol,
      canonicalSymbol: series.symbol,
      displaySymbol: identity.displaySymbol,
      timeframe,
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      isClosed: c.closed,
      source: "BINANCE",
      sourceMode: "HISTORICAL",
      dataQuality: "VALID",
    }));
    return {
      identity,
      timeframe,
      source: "BINANCE",
      sourceMode: "HISTORICAL",
      connectionState: candles.length ? "CONNECTED" : "NO_DATA",
      dataQuality: candles.length ? "VALID" : "NO_DATA",
      candles,
      forming: candles.length && !candles[candles.length - 1]!.isClosed
        ? candles[candles.length - 1]!
        : null,
      count: candles.length,
      lastQuoteAt: null,
      updatedAt: new Date().toISOString(),
      note: "Binance Spot REST historical candles.",
      errorCode: null,
      errorMessage: null,
    };
  }
}

function unifyFxcmHistorical(result: SafeFxcmHistoricalResult): UnifiedCandleSeries {
  const identity = buildMarketIdentity({
    provider: "FXCM",
    marketType: result.marketType,
    providerSymbol: result.providerSymbol,
    canonicalSymbol: result.canonicalSymbol,
    displaySymbol: result.displaySymbol,
    environment: result.environment,
  });
  const candles: UnifiedCandle[] = result.candles.map((c) => ({
    provider: "FXCM",
    marketType: result.marketType,
    providerSymbol: result.providerSymbol,
    canonicalSymbol: result.canonicalSymbol,
    displaySymbol: result.displaySymbol,
    timeframe: result.timeframe,
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    isClosed: c.closed,
    source: "FXCM",
    sourceMode: "HISTORICAL",
    dataQuality: normalizeDataQuality(result.quality.status),
  }));
  return {
    identity,
    timeframe: result.timeframe,
    source: "FXCM",
    sourceMode: "HISTORICAL",
    connectionState: candles.length ? "CONNECTED" : "NO_DATA",
    dataQuality: normalizeDataQuality(result.quality.status),
    candles,
    forming: null,
    count: candles.length,
    lastQuoteAt: null,
    updatedAt: result.fetchedAt,
    note: result.note ?? "FXCM historical candles.",
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
  };
}

function unifyFxcmLiveSeries(result: SafeFxcmLiveCandleSeries): UnifiedCandleSeries {
  const identity = buildMarketIdentity({
    provider: "FXCM",
    marketType: result.marketType,
    providerSymbol: result.providerSymbol,
    canonicalSymbol: result.canonicalSymbol,
    displaySymbol: result.displaySymbol,
    environment: result.environment,
  });
  const sourceMode = result.mode === "HISTORICAL" ? "HISTORICAL"
    : result.mode === "LIVE" ? "LIVE"
      : "HISTORICAL_LIVE";
  const candles: UnifiedCandle[] = result.candles.map((c) => ({
    provider: "FXCM",
    marketType: result.marketType,
    providerSymbol: result.providerSymbol,
    canonicalSymbol: result.canonicalSymbol,
    displaySymbol: result.displaySymbol,
    timeframe: result.timeframe,
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    isClosed: c.closed,
    source: "FXCM",
    sourceMode,
    dataQuality: normalizeDataQuality(result.quality.status),
  }));
  const forming = result.forming
    ? {
        provider: "FXCM" as const,
        marketType: result.marketType,
        providerSymbol: result.providerSymbol,
        canonicalSymbol: result.canonicalSymbol,
        displaySymbol: result.displaySymbol,
        timeframe: result.timeframe,
        time: result.forming.time,
        open: result.forming.open,
        high: result.forming.high,
        low: result.forming.low,
        close: result.forming.close,
        volume: result.forming.volume,
        isClosed: result.forming.closed,
        source: "FXCM" as const,
        sourceMode,
        dataQuality: normalizeDataQuality(result.quality.status),
      }
    : null;
  return {
    identity,
    timeframe: result.timeframe,
    source: "FXCM",
    sourceMode,
    connectionState: normalizeConnectionState(result.streamState),
    dataQuality: normalizeDataQuality(result.quality.status),
    candles,
    forming,
    count: candles.length,
    lastQuoteAt: result.lastQuoteAt,
    updatedAt: new Date().toISOString(),
    note: result.note,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
  };
}

function unifyFxcmQuote(q: SafeFxcmQuoteSnapshot): UnifiedQuote {
  const normalizedTimestamp = q.receivedAt
    ?? q.sourceTimestamp
    ?? new Date().toISOString();
  return {
    provider: "FXCM",
    marketType: q.marketType,
    providerSymbol: q.providerSymbol,
    canonicalSymbol: q.canonicalSymbol,
    displaySymbol: q.displaySymbol,
    providerTimestamp: q.sourceTimestamp,
    normalizedTimestamp,
    bid: q.bid,
    ask: q.ask,
    mid: q.mid,
    last: q.last ?? q.mid,
    source: "FXCM",
    dataQuality: normalizeDataQuality(q.dataQuality),
    receivedAt: q.receivedAt,
    sourceMode: "LIVE",
    connectionState: normalizeConnectionState(q.state),
  };
}

function toUnifiedHealth(
  health: MarketProviderHealth,
  caps: { instruments: boolean; liveQuotes: boolean; streamingQuotes: boolean; historicalPrices: boolean; candles: boolean; liveCandles: boolean; trading: boolean },
): UnifiedProviderHealth {
  const connection = normalizeConnectionState(
    health.liveStreamEnabled && health.connectionState === "CONNECTED"
      ? "LIVE"
      : health.connectionState,
  );
  return {
    provider: health.provider,
    authentication: health.authenticated
      ? "AUTHENTICATED"
      : health.configured
        ? String(health.status)
        : "NOT_CONFIGURED",
    connection,
    data: !health.enabled
      ? "DISABLED"
      : health.liveStreamEnabled
        ? "STREAMING"
        : health.reachable
          ? "READY"
          : connection,
    lastEventAt: null,
    lastDataAt: health.checkedAt,
    latencyMs: null,
    capabilities: {
      instrumentDiscovery: caps.instruments,
      historical: caps.historicalPrices,
      quotes: caps.liveQuotes,
      streaming: caps.streamingQuotes,
      candles: caps.candles,
      liveCandles: caps.liveCandles,
      trading: false,
    },
    environment: health.environmentLabel,
    notes: health.notes,
    diagnostics: {
      enabled: health.enabled,
      configured: health.configured,
      reachable: health.reachable,
      status: health.status,
      errorCode: health.errorCode,
      tradingEnabled: false,
    },
  };
}

let singleton: MarketDataService | null = null;

export function getMarketDataService(): MarketDataService {
  singleton ??= new MarketDataService();
  return singleton;
}

export function createMarketDataService(options?: ConstructorParameters<typeof MarketDataService>[0]): MarketDataService {
  return new MarketDataService(options);
}

export function resetMarketDataServiceForTests(): void {
  singleton = null;
}
