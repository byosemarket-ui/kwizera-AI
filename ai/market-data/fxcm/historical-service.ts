/**
 * Phase 28 — FXCM historical market data service.
 * Official path: Offers snapshot → offerId → GET /candles/{offer_id}/{period_id}
 * No live streaming, no synthetic candles, no Binance fallback.
 */
import {
  FXCM_CANDLES_MAX_NUM,
  FXCM_HISTORICAL_CACHE_MS,
  FXCM_HISTORICAL_MAX_RANGE_MS,
  FXCM_OFFER_CACHE_MS,
  FXCM_PHASE28_CAPABILITIES,
  readFxcmAccessToken,
  resolveFxcmConfig,
  type FxcmConfig,
  type FxcmEnvironment,
} from "./config.js";
import {
  fxcmGetCandles,
  fxcmGetOffersModel,
  parseFxcmOffersMap,
  type FetchLike,
} from "./client.js";
import {
  createFxcmAuthenticationService,
  type FxcmAuthenticationService,
} from "./auth-service.js";
import {
  createFxcmInstrumentDiscoveryService,
  type FxcmInstrumentDiscoveryService,
} from "./instrument-discovery.js";
import { FxcmMarketDataError, userFacingFxcmError } from "./errors.js";
import {
  assertSafeHistoricalPayload,
  buildHistoricalQuality,
  detectFxcmCandleGaps,
  normalizeFxcmCandleRows,
} from "./historical-normalize.js";
import type {
  FxcmHistoricalCandle,
  FxcmHistoricalRequest,
  SafeFxcmHistoricalResult,
} from "./historical-types.js";
import {
  FXCM_TIMEFRAME_MS,
  isFxcmSupportedProjectTimeframe,
  toFxcmPeriodId,
  type FxcmSupportedProjectTimeframe,
} from "./timeframes.js";

export interface FxcmHistoricalServiceOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  nowMs?: () => number;
  auth?: FxcmAuthenticationService;
  discovery?: FxcmInstrumentDiscoveryService;
}

interface OfferCache {
  environment: FxcmEnvironment;
  fetchedAtUtc: number;
  bySymbol: Map<string, number>;
}

interface HistCacheEntry {
  key: string;
  environment: FxcmEnvironment;
  fetchedAtUtc: number;
  result: SafeFxcmHistoricalResult;
}

function cacheKey(input: {
  environment: FxcmEnvironment;
  marketType: string;
  canonical: string;
  timeframe: string;
  start: number | null;
  end: number | null;
  limit: number | null;
}): string {
  return [
    "FXCM",
    input.environment,
    input.marketType,
    input.canonical,
    input.timeframe,
    input.start ?? "n",
    input.end ?? "n",
    input.limit ?? "n",
  ].join(":");
}

export class FxcmHistoricalMarketDataService {
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl?: FetchLike;
  private readonly nowMs: () => number;
  private readonly auth: FxcmAuthenticationService;
  private readonly discovery: FxcmInstrumentDiscoveryService;
  private config: FxcmConfig;
  private offerCache: OfferCache | null = null;
  private readonly histCache = new Map<string, HistCacheEntry>();
  private inflight = new Map<string, Promise<SafeFxcmHistoricalResult>>();

  constructor(options: FxcmHistoricalServiceOptions = {}) {
    this.env = options.env ?? (process.env as Record<string, string | undefined>);
    this.fetchImpl = options.fetchImpl;
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.config = resolveFxcmConfig(this.env);
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
  }

  getCapabilities() {
    return { ...FXCM_PHASE28_CAPABILITIES };
  }

  getConfig(): FxcmConfig {
    this.config = resolveFxcmConfig(this.env);
    return this.config;
  }

  async getHistoricalCandles(request: FxcmHistoricalRequest): Promise<SafeFxcmHistoricalResult> {
    this.config = resolveFxcmConfig(this.env);
    const validated = this.validateRequest(request);
    const key = cacheKey({
      environment: this.config.environment,
      marketType: validated.marketType,
      canonical: validated.canonicalSymbol,
      timeframe: validated.timeframe,
      start: validated.startMs,
      end: validated.endMs,
      limit: validated.limit,
    });

    if (!request.refresh) {
      const cached = this.histCache.get(key);
      if (
        cached
        && cached.environment === this.config.environment
        && this.nowMs() - cached.fetchedAtUtc < FXCM_HISTORICAL_CACHE_MS
      ) {
        const fromCache: SafeFxcmHistoricalResult = {
          ...cached.result,
          source: "CACHE",
          quality: { ...cached.result.quality, source: "CACHE" },
          note: "Phase 28 historical candles from cache (CACHE). Not a live stream.",
        };
        assertSafeHistoricalPayload(fromCache, readFxcmAccessToken(this.env));
        return fromCache;
      }
    }

    const existing = this.inflight.get(key);
    if (existing) return existing;

    const promise = this.runHistorical(validated, key)
      .finally(() => {
        this.inflight.delete(key);
      });
    this.inflight.set(key, promise);
    return promise;
  }

  private validateRequest(request: FxcmHistoricalRequest): {
    symbolQuery: string;
    timeframe: FxcmSupportedProjectTimeframe;
    periodId: string;
    startMs: number | null;
    endMs: number | null;
    limit: number | null;
    marketType: string;
    canonicalSymbol: string;
    providerSymbol: string;
    displaySymbol: string;
    mappingStatus: string;
  } {
    if (!this.config.enabled) {
      throw new FxcmMarketDataError("FXCM_DISABLED", "FXCM market data is disabled.");
    }
    if (!this.config.accessTokenConfigured) {
      throw new FxcmMarketDataError("FXCM_NOT_CONFIGURED", "FXCM access token is not configured.");
    }

    const symbolQuery = String(request.symbol ?? "").trim();
    if (!symbolQuery) {
      throw new FxcmMarketDataError("FXCM_INVALID_SYMBOL", "Symbol is required.");
    }

    if (!isFxcmSupportedProjectTimeframe(request.timeframe)) {
      throw new FxcmMarketDataError(
        "FXCM_UNSUPPORTED_TIMEFRAME",
        `Unsupported timeframe for FXCM: ${String(request.timeframe)}.`,
      );
    }
    const timeframe = request.timeframe;
    const periodId = toFxcmPeriodId(timeframe);
    if (!periodId) {
      throw new FxcmMarketDataError("FXCM_UNSUPPORTED_TIMEFRAME", "FXCM timeframe mapping missing.");
    }

    let startMs = request.startTimeMs != null ? Number(request.startTimeMs) : null;
    let endMs = request.endTimeMs != null ? Number(request.endTimeMs) : null;
    if (startMs != null && !Number.isFinite(startMs)) {
      throw new FxcmMarketDataError("FXCM_INVALID_RANGE", "Invalid startTime.");
    }
    if (endMs != null && !Number.isFinite(endMs)) {
      throw new FxcmMarketDataError("FXCM_INVALID_RANGE", "Invalid endTime.");
    }
    if (startMs != null && endMs != null) {
      if (startMs >= endMs) {
        throw new FxcmMarketDataError("FXCM_INVALID_RANGE", "startTime must be before endTime.");
      }
      if (endMs - startMs > FXCM_HISTORICAL_MAX_RANGE_MS) {
        throw new FxcmMarketDataError(
          "FXCM_INVALID_RANGE",
          "Requested historical range exceeds the Phase 28 safety limit.",
        );
      }
    }

    let limit = request.limit != null ? Math.floor(Number(request.limit)) : null;
    if (limit != null) {
      if (!Number.isFinite(limit) || limit < 1) {
        throw new FxcmMarketDataError("FXCM_INVALID_RANGE", "limit must be a positive integer.");
      }
      limit = Math.min(limit, FXCM_CANDLES_MAX_NUM);
    }

    return {
      symbolQuery,
      timeframe,
      periodId,
      startMs: startMs != null ? Math.floor(startMs) : null,
      endMs: endMs != null ? Math.floor(endMs) : null,
      limit,
      // Filled after instrument resolve — placeholders replaced in runHistorical.
      marketType: "FOREX",
      canonicalSymbol: "",
      providerSymbol: "",
      displaySymbol: "",
      mappingStatus: "",
    };
  }

  private async resolveInstrument(symbolQuery: string) {
    const discovery = await this.discovery.discover({});
    if (discovery.discoveryStatus === "DISABLED") {
      throw new FxcmMarketDataError("FXCM_DISABLED", "FXCM market data is disabled.");
    }
    if (discovery.discoveryStatus === "NOT_CONFIGURED") {
      throw new FxcmMarketDataError("FXCM_NOT_CONFIGURED", "FXCM access token is not configured.");
    }
    const needleCanonical = symbolQuery.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const inst = discovery.instruments.find((i) =>
      i.providerSymbol === symbolQuery
      || i.displaySymbol === symbolQuery
      || i.canonicalSymbol === needleCanonical
    );
    if (!inst) {
      throw new FxcmMarketDataError("FXCM_INSTRUMENT_NOT_FOUND", "Instrument not found in FXCM catalog.");
    }
    if (inst.mappingStatus === "UNRESOLVED") {
      throw new FxcmMarketDataError("FXCM_MAPPING_UNRESOLVED", "FXCM symbol mapping is unresolved.");
    }
    if (inst.mappingStatus === "CONFLICT") {
      throw new FxcmMarketDataError("FXCM_MAPPING_CONFLICT", "FXCM symbol mapping is in conflict.");
    }
    return inst;
  }

  private async resolveOfferId(providerSymbol: string, signal?: AbortSignal): Promise<number> {
    const now = this.nowMs();
    if (
      this.offerCache
      && this.offerCache.environment === this.config.environment
      && now - this.offerCache.fetchedAtUtc < FXCM_OFFER_CACHE_MS
    ) {
      const hit = this.offerCache.bySymbol.get(providerSymbol)
        ?? this.offerCache.bySymbol.get(providerSymbol.toUpperCase());
      if (hit != null) return hit;
    }

    const authCtx = await this.auth.authenticate();
    if (authCtx.state !== "AUTHENTICATED") {
      throw new FxcmMarketDataError(
        "FXCM_AUTHENTICATION_FAILED",
        authCtx.lastErrorMessage ?? "FXCM authentication failed.",
      );
    }
    const session = this.auth.getSessionHandle();
    if (!session) {
      throw new FxcmMarketDataError("FXCM_AUTHENTICATION_FAILED", "Authenticated session missing.");
    }

    const raw = await fxcmGetOffersModel(this.config, session, { fetchImpl: this.fetchImpl, signal });
    const bySymbol = parseFxcmOffersMap(raw);
    this.offerCache = {
      environment: this.config.environment,
      fetchedAtUtc: now,
      bySymbol,
    };
    const offerId = bySymbol.get(providerSymbol) ?? bySymbol.get(providerSymbol.toUpperCase());
    if (offerId == null) {
      throw new FxcmMarketDataError(
        "FXCM_OFFER_NOT_FOUND",
        "FXCM offer id not found for instrument (Offers table).",
      );
    }
    return offerId;
  }

  private async runHistorical(
    validated: ReturnType<FxcmHistoricalMarketDataService["validateRequest"]>,
    key: string,
  ): Promise<SafeFxcmHistoricalResult> {
    try {
      const inst = await this.resolveInstrument(validated.symbolQuery);
      validated.marketType = inst.marketType;
      validated.canonicalSymbol = inst.canonicalSymbol ?? "";
      validated.providerSymbol = inst.providerSymbol;
      validated.displaySymbol = inst.displaySymbol;
      validated.mappingStatus = inst.mappingStatus;

      const authCtx = await this.auth.authenticate();
      if (authCtx.state !== "AUTHENTICATED") {
        throw new FxcmMarketDataError(
          "FXCM_AUTHENTICATION_FAILED",
          authCtx.lastErrorMessage ?? "FXCM authentication failed.",
        );
      }
      const session = this.auth.getSessionHandle();
      if (!session) {
        throw new FxcmMarketDataError("FXCM_AUTHENTICATION_FAILED", "Authenticated session missing.");
      }

      const offerId = await this.resolveOfferId(inst.providerSymbol);
      const candles = await this.fetchCandlesChunked({
        offerId,
        periodId: validated.periodId,
        timeframe: validated.timeframe,
        startMs: validated.startMs,
        endMs: validated.endMs,
        limit: validated.limit,
      });

      const gaps = detectFxcmCandleGaps(candles, validated.timeframe);
      // Re-normalize already done in fetch; recompute quality on final set
      const quality = buildHistoricalQuality({
        candles,
        invalidCandles: 0,
        duplicatesRemoved: 0,
        gaps,
        source: "FXCM",
      });

      const fetchedAt = new Date(this.nowMs()).toISOString();
      const result: SafeFxcmHistoricalResult = {
        provider: "FXCM",
        environment: this.config.environment,
        environmentLabel: this.config.environmentLabel,
        marketType: inst.marketType,
        symbol: validated.canonicalSymbol,
        canonicalSymbol: validated.canonicalSymbol,
        providerSymbol: validated.providerSymbol,
        displaySymbol: validated.displaySymbol,
        timeframe: validated.timeframe,
        providerPeriod: toFxcmPeriodId(validated.timeframe)!,
        source: "FXCM",
        providerSource: "FXCM",
        mode: "HISTORICAL",
        liveStream: "NOT_ENABLED_YET",
        trading: "DISABLED",
        fetchedAt,
        startTime: validated.startMs != null ? new Date(validated.startMs).toISOString() : null,
        endTime: validated.endMs != null ? new Date(validated.endMs).toISOString() : null,
        count: candles.length,
        candles,
        quality: { ...quality, invalidCandles: 0 },
        offerId,
        mappingStatus: validated.mappingStatus,
        note: "Phase 28 FXCM historical candles only — not LIVE. No streaming in this phase.",
        errorCode: null,
        errorMessage: null,
      };

      // Attach invalid/dupe stats from last chunk merge via internal property if needed — already deduped in fetchCandlesChunked
      this.histCache.set(key, {
        key,
        environment: this.config.environment,
        fetchedAtUtc: this.nowMs(),
        result,
      });

      console.info("[FXCM] historical candles", JSON.stringify({
        environment: this.config.environment,
        providerSymbol: validated.providerSymbol,
        timeframe: validated.timeframe,
        count: candles.length,
        source: "FXCM",
        quality: quality.status,
        liveStream: false,
      }));

      assertSafeHistoricalPayload(result, readFxcmAccessToken(this.env));
      return result;
    } catch (error) {
      const mapped = userFacingFxcmError(error);
      // Re-throw typed errors for API status mapping
      if (error instanceof FxcmMarketDataError) throw error;
      throw new FxcmMarketDataError(mapped.code, mapped.message);
    }
  }

  /**
   * Official num max = 10000. For ranges larger than one window, chunk by time
   * using timeframe duration × max num (documented API limit).
   */
  private async fetchCandlesChunked(input: {
    offerId: number;
    periodId: string;
    timeframe: FxcmSupportedProjectTimeframe;
    startMs: number | null;
    endMs: number | null;
    limit: number | null;
  }): Promise<FxcmHistoricalCandle[]> {
    const session = this.auth.getSessionHandle();
    if (!session) {
      throw new FxcmMarketDataError("FXCM_AUTHENTICATION_FAILED", "Authenticated session missing.");
    }

    const intervalMs = FXCM_TIMEFRAME_MS[input.timeframe];
    const maxWindowMs = intervalMs * FXCM_CANDLES_MAX_NUM;
    const now = this.nowMs();

    // Default: recent N candles when no range
    if (input.startMs == null && input.endMs == null) {
      const num = input.limit ?? 300;
      const raw = await fxcmGetCandles(this.config, session, {
        offerId: input.offerId,
        periodId: input.periodId,
        num,
      }, { fetchImpl: this.fetchImpl });
      const rows = extractCandlesArray(raw);
      const { candles, invalidCandles, duplicatesRemoved } = normalizeFxcmCandleRows(
        rows,
        input.timeframe,
        now,
      );
      if (invalidCandles > 0 || duplicatesRemoved > 0) {
        // quality rebuilt at top level; keep candles only
      }
      return candles;
    }

    const endMs = input.endMs ?? now;
    const startMs = input.startMs ?? Math.max(0, endMs - maxWindowMs);
    const chunks: FxcmHistoricalCandle[] = [];
    let invalidCandles = 0;
    let duplicatesRemoved = 0;
    let cursor = startMs;
    let safety = 0;
    const maxChunks = 24;

    while (cursor < endMs && safety < maxChunks) {
      safety += 1;
      const chunkEnd = Math.min(endMs, cursor + maxWindowMs);
      const sessionHandle = this.auth.getSessionHandle();
      if (!sessionHandle) {
        throw new FxcmMarketDataError("FXCM_AUTHENTICATION_FAILED", "Authenticated session missing.");
      }
      const raw = await fxcmGetCandles(this.config, sessionHandle, {
        offerId: input.offerId,
        periodId: input.periodId,
        num: FXCM_CANDLES_MAX_NUM,
        fromSec: Math.floor(cursor / 1000),
        toSec: Math.floor(chunkEnd / 1000),
      }, { fetchImpl: this.fetchImpl });
      const rows = extractCandlesArray(raw);
      const normalized = normalizeFxcmCandleRows(rows, input.timeframe, now);
      invalidCandles += normalized.invalidCandles;
      duplicatesRemoved += normalized.duplicatesRemoved;
      chunks.push(...normalized.candles);
      if (normalized.candles.length === 0) {
        cursor = chunkEnd;
        continue;
      }
      const last = normalized.candles[normalized.candles.length - 1]!;
      const next = last.time * 1000 + intervalMs;
      cursor = Math.max(chunkEnd, next);
    }

    // Final merge + dedupe across chunks
    const byTime = new Map<number, FxcmHistoricalCandle>();
    for (const c of chunks) {
      if (byTime.has(c.time)) {
        duplicatesRemoved += 1;
        continue;
      }
      byTime.set(c.time, c);
    }
    let merged = [...byTime.values()].sort((a, b) => a.time - b.time);
    if (input.startMs != null) {
      merged = merged.filter((c) => c.time * 1000 >= input.startMs!);
    }
    if (input.endMs != null) {
      merged = merged.filter((c) => c.time * 1000 <= input.endMs!);
    }
    if (input.limit != null && merged.length > input.limit) {
      merged = merged.slice(merged.length - input.limit);
    }
    void invalidCandles;
    void duplicatesRemoved;
    return merged;
  }
}

function extractCandlesArray(raw: unknown): unknown[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.candles)) return obj.candles;
  if (obj.data && typeof obj.data === "object") {
    const data = obj.data as Record<string, unknown>;
    if (Array.isArray(data.candles)) return data.candles;
  }
  return [];
}

export function createFxcmHistoricalMarketDataService(
  options?: FxcmHistoricalServiceOptions,
): FxcmHistoricalMarketDataService {
  return new FxcmHistoricalMarketDataService(options);
}
