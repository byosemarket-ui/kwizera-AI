/**
 * Phase 43B/43C — Unified Market Data Snapshot Engine.
 * Builds immutable, instrument-specific analysis snapshots via MarketDataService.
 */
import { randomUUID } from "node:crypto";
import { parseMarketProviderId } from "../providers/identity.js";
import type { MarketAssetType, MarketProviderId } from "../providers/types.js";
import {
  getMarketDataService,
  type MarketDataService,
} from "../providers/market-data-service.js";
import {
  CANONICAL_TIMEFRAMES,
  type CanonicalTimeframeId,
  type UnifiedCandle,
  type UnifiedQuote,
} from "../providers/contracts.js";
import {
  ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
  type AnalysisMarketSnapshot,
  type AnalysisSnapshotCandle,
  type AnalysisSnapshotQuote,
  type AnalysisSnapshotRequest,
  type CreateAnalysisSnapshotResult,
} from "./types.js";
import {
  ANALYSIS_SNAPSHOT_STALE_QUOTE_MS,
  resolveAndValidateRequestShape,
  timeframeIntervalMs,
} from "./periods.js";
import {
  preferResampleSource,
  resampleCandles,
} from "./resample.js";
import {
  buildValidationReport,
  computeCoverageRatio,
  detectDataGaps,
  isEvidenceReady,
} from "./validate.js";
import {
  buildAnalysisSnapshotFingerprintPayload,
  fingerprintAnalysisSnapshotPayload,
} from "./fingerprint.js";
import { getAnalysisSnapshotStore, type AnalysisSnapshotStore } from "./store.js";

function mapCandle(c: UnifiedCandle): AnalysisSnapshotCandle {
  return {
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    isClosed: Boolean(c.isClosed),
    resampled: false,
  };
}

function dedupeSort(candles: AnalysisSnapshotCandle[]): AnalysisSnapshotCandle[] {
  const byTime = new Map<number, AnalysisSnapshotCandle>();
  for (const c of candles) {
    const prev = byTime.get(c.time);
    if (!prev) {
      byTime.set(c.time, c);
      continue;
    }
    // Prefer closed candle when colliding; never invent fields.
    if (c.isClosed && !prev.isClosed) byTime.set(c.time, c);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/**
 * Phase 47 — Keep completed candles with open in [start, end) and at most one
 * forming tip whose open is in [end, end + interval).
 */
function filterToRange(
  candles: AnalysisSnapshotCandle[],
  startMs: number,
  endMs: number,
  intervalMs: number,
): AnalysisSnapshotCandle[] {
  const startSec = Math.floor(startMs / 1000);
  const endSec = Math.floor(endMs / 1000);
  const intervalSec = Math.max(1, Math.floor(intervalMs / 1000));
  return candles.filter((c) => {
    if (c.isClosed) return c.time >= startSec && c.time < endSec;
    return c.time >= endSec && c.time < endSec + intervalSec;
  });
}

function mapQuote(
  provider: MarketProviderId,
  quote: UnifiedQuote | null,
  environment: string,
): AnalysisSnapshotQuote | null {
  if (!quote) {
    return provider === "BINANCE"
      ? {
          provider,
          providerSymbol: "",
          canonicalSymbol: "",
          bid: null,
          ask: null,
          mid: null,
          last: null,
          priceBasis: null,
          providerEventTimestamp: null,
          providerEventTimestampAvailable: false,
          serverReceiptTimestamp: null,
          ageMs: null,
          freshness: "HISTORICAL_ONLY",
          source: "binance-spot-public",
          environment,
        }
      : null;
  }

  const receiptIso = quote.receivedAt ?? quote.normalizedTimestamp ?? null;
  const receiptMs = receiptIso ? Date.parse(receiptIso) : NaN;
  const ageMs = Number.isFinite(receiptMs) ? Math.max(0, Date.now() - receiptMs) : null;
  const providerTs = quote.providerTimestamp ?? null;
  // ForexConnect: providerTimestamp equals receipt when SDK lacks broker event time.
  const providerEventTimestampAvailable = Boolean(
    providerTs
    && receiptIso
    && providerTs !== receiptIso
    && provider !== "FOREXCONNECT",
  );

  let freshness: AnalysisSnapshotQuote["freshness"] = "UNAVAILABLE";
  const conn = String(quote.connectionState ?? "").toUpperCase();
  if (conn === "LIVE" && quote.sourceMode === "LIVE" && (ageMs == null || ageMs <= ANALYSIS_SNAPSHOT_STALE_QUOTE_MS)) {
    freshness = "LIVE";
  } else if (conn === "STALE" || (ageMs != null && ageMs > ANALYSIS_SNAPSHOT_STALE_QUOTE_MS && quote.sourceMode === "LIVE")) {
    freshness = "STALE";
  } else if (conn === "MARKET_INACTIVE") {
    freshness = "MARKET_INACTIVE";
  } else if (conn === "SUBSCRIBED_WAITING") {
    freshness = "WAITING";
  } else if (quote.bid != null || quote.last != null) {
    freshness = ageMs != null && ageMs > ANALYSIS_SNAPSHOT_STALE_QUOTE_MS ? "STALE" : "WAITING";
  }

  const mid = quote.mid != null && Number.isFinite(quote.mid)
    ? quote.mid
    : (quote.bid != null && quote.ask != null && quote.bid <= quote.ask
      ? (quote.bid + quote.ask) / 2
      : null);

  return {
    provider,
    providerSymbol: quote.providerSymbol,
    canonicalSymbol: quote.canonicalSymbol,
    bid: quote.bid,
    ask: quote.ask,
    mid,
    last: quote.last,
    priceBasis: provider === "FOREXCONNECT" || provider === "FXCM" ? "bid" : (quote.last != null ? "last" : "mid"),
    providerEventTimestamp: providerEventTimestampAvailable ? providerTs : null,
    providerEventTimestampAvailable,
    serverReceiptTimestamp: receiptIso,
    ageMs,
    freshness,
    source: quote.source ?? null,
    environment,
  };
}

export class AnalysisSnapshotEngine {
  private readonly marketData: MarketDataService;
  private readonly store: AnalysisSnapshotStore;

  constructor(options?: {
    marketData?: MarketDataService;
    store?: AnalysisSnapshotStore;
  }) {
    this.marketData = options?.marketData ?? getMarketDataService();
    this.store = options?.store ?? getAnalysisSnapshotStore();
  }

  async createSnapshot(raw: AnalysisSnapshotRequest): Promise<CreateAnalysisSnapshotResult> {
    const started = Date.now();
    const requestId = String(raw.requestId ?? "").trim() || randomUUID();

    const shape = resolveAndValidateRequestShape({
      candleTimeframe: raw.candleTimeframe,
      analysisPeriod: raw.analysisPeriod,
      higherTimeframes: raw.higherTimeframes,
      rangeStartUtc: raw.rangeStartUtc,
      rangeEndUtc: raw.rangeEndUtc,
    });
    if (!shape.ok) {
      return {
        ok: false,
        snapshot: null,
        code: shape.code,
        error: shape.message,
        latencyMs: Date.now() - started,
      };
    }

    const provider = parseMarketProviderId(raw.provider);
    if (!provider) {
      return {
        ok: false,
        snapshot: null,
        code: "INVALID_PROVIDER",
        error: "Provider must be BINANCE, FXCM, or FOREXCONNECT.",
        latencyMs: Date.now() - started,
      };
    }

    const symbol = String(raw.symbol ?? "").trim();
    if (!symbol) {
      return {
        ok: false,
        snapshot: null,
        code: "INVALID_SYMBOL",
        error: "Symbol is required.",
        latencyMs: Date.now() - started,
      };
    }

    const requireLiveQuote = Boolean(raw.requireLiveQuote);
    const resolved = shape.value;
    let providerError: string | null = null;
    let seriesNote: string | null = null;
    let seriesErrorCode: string | null = null;
    let sourceMode: string | null = null;
    let environment = provider === "BINANCE" ? "public" : "unknown";
    let instrument: {
      providerSymbol: string;
      canonicalSymbol: string;
      displaySymbol: string;
      marketType: MarketAssetType;
    } = {
      providerSymbol: symbol,
      canonicalSymbol: symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      displaySymbol: symbol,
      marketType: provider === "BINANCE" ? "CRYPTO" : "FOREX",
    };

    try {
      const catalog = await this.marketData.getInstrument({
        provider,
        symbol,
        marketType: raw.marketType ?? (provider === "BINANCE" ? "CRYPTO" : "FOREX"),
      });
      if (!catalog) {
        return {
          ok: false,
          snapshot: null,
          code: "INSTRUMENT_NOT_FOUND",
          error: "Instrument not found in the provider catalog for the requested provider.",
          latencyMs: Date.now() - started,
        };
      }
      instrument = {
        providerSymbol: catalog.providerSymbol,
        canonicalSymbol: catalog.canonicalSymbol,
        displaySymbol: catalog.displaySymbol,
        marketType: catalog.marketType,
      };
    } catch (err) {
      providerError = err instanceof Error ? err.message.slice(0, 240) : "Instrument lookup failed.";
    }

    let candles: AnalysisSnapshotCandle[] = [];
    let resampled = false;
    let sourceTimeframe: CanonicalTimeframeId | null = resolved.candleTimeframe;
    try {
      // Warm live session for FC/FXCM so instrument-specific quote freshness is available.
      if (provider === "FOREXCONNECT" || provider === "FXCM") {
        try {
          await this.marketData.subscribeLiveCandles({
            provider,
            symbol: instrument.providerSymbol,
            timeframe: resolved.candleTimeframe,
            marketType: instrument.marketType,
          });
        } catch {
          /* historical may still succeed */
        }
      }

      const fetchMapped = async (tf: CanonicalTimeframeId, limit: number) => {
        const series = await this.marketData.getHistoricalCandles({
          provider,
          symbol: instrument.providerSymbol,
          timeframe: tf,
          marketType: instrument.marketType,
          limit,
          refresh: true,
        });
        seriesNote = series.note ?? null;
        seriesErrorCode = series.errorCode ?? null;
        sourceMode = series.sourceMode ?? null;
        environment = series.identity.environment ?? environment;
        instrument = {
          providerSymbol: series.identity.providerSymbol,
          canonicalSymbol: series.identity.canonicalSymbol,
          displaySymbol: series.identity.displaySymbol,
          marketType: series.identity.marketType,
        };
        const mapped = series.candles.map(mapCandle);
        if (series.forming) mapped.push(mapCandle(series.forming));
        return dedupeSort(mapped);
      };

      let mapped = await fetchMapped(resolved.candleTimeframe, resolved.fetchLimit);
      sourceTimeframe = resolved.candleTimeframe;

      // If native series is empty, attempt exact finer→coarser resampling only.
      if (mapped.length === 0) {
        const sourceTf = preferResampleSource(resolved.candleTimeframe, CANONICAL_TIMEFRAMES);
        if (sourceTf) {
          const ratio = timeframeIntervalMs(resolved.candleTimeframe) / timeframeIntervalMs(sourceTf);
          const sourceLimit = Math.min(
            300,
            Math.ceil(resolved.fetchLimit * ratio) + 5,
          );
          const sourceMapped = await fetchMapped(sourceTf, sourceLimit);
          if (sourceMapped.length) {
            const resampledResult = resampleCandles(
              sourceMapped,
              sourceTf,
              resolved.candleTimeframe,
            );
            if (resampledResult.ok) {
              mapped = resampledResult.candles;
              resampled = true;
              sourceTimeframe = sourceTf;
              seriesNote = [
                seriesNote,
                `Resampled ${sourceTf} → ${resolved.candleTimeframe}`,
              ].filter(Boolean).join("; ");
              seriesErrorCode = null;
            } else {
              providerError = resampledResult.message;
            }
          }
        }
      }

      candles = filterToRange(
        mapped,
        resolved.requestedRange.startMs,
        resolved.requestedRange.endMs,
        timeframeIntervalMs(resolved.candleTimeframe),
      );
    } catch (err) {
      providerError = err instanceof Error ? err.message.slice(0, 240) : "Historical candle fetch failed.";
    }

    let quote: AnalysisSnapshotQuote | null = null;
    try {
      const unifiedQuote = await this.marketData.getCurrentQuote({
        provider,
        symbol: instrument.providerSymbol,
        marketType: instrument.marketType,
      });
      quote = mapQuote(provider, unifiedQuote, environment);
      if (quote && !quote.providerSymbol) {
        quote = {
          ...quote,
          providerSymbol: instrument.providerSymbol,
          canonicalSymbol: instrument.canonicalSymbol,
        };
      }
    } catch {
      quote = mapQuote(provider, null, environment);
    }

    const dataGaps = detectDataGaps(
      candles,
      resolved.candleTimeframe,
      resolved.requestedRange,
      instrument.marketType,
    );
    const validation = buildValidationReport({
      candles,
      quote,
      timeframe: resolved.candleTimeframe,
      requestedRange: resolved.requestedRange,
      candlesRequestedEstimate: resolved.candlesRequestedEstimate,
      dataGaps,
      requireLiveQuote,
      providerError,
    });

    const closed = candles.filter((c) => c.isClosed);
    const returnedRange = closed.length
      ? {
          startMs: closed[0]!.time * 1000,
          endMs: closed[closed.length - 1]!.time * 1000,
          startUtc: new Date(closed[0]!.time * 1000).toISOString(),
          endUtc: new Date(closed[closed.length - 1]!.time * 1000).toISOString(),
        }
      : null;

    const warnings = [...validation.warnings];
    const marketStatus = quote?.freshness
      ?? (providerError ? "PROVIDER_ERROR" : closed.length ? "HISTORICAL" : "NO_DATA");

    const draft: Omit<AnalysisMarketSnapshot, "snapshotId" | "createdAt" | "requestId" | "contentFingerprint"> = {
      schemaVersion: ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
      provider,
      instrument,
      environment,
      priceBasis: quote?.priceBasis === "bid" || quote?.priceBasis === "ask"
        || quote?.priceBasis === "last" || quote?.priceBasis === "mid"
        ? quote.priceBasis
        : (provider === "FOREXCONNECT" || provider === "FXCM" ? "bid" : "unknown"),
      candleTimeframe: resolved.candleTimeframe,
      analysisPeriod: resolved.analysisPeriod,
      requestedRange: resolved.requestedRange,
      returnedRange,
      candleCount: candles.length,
      candlesRequestedEstimate: resolved.candlesRequestedEstimate,
      candles,
      latestQuote: quote,
      marketStatus,
      freshness: {
        quote: quote?.freshness ?? "UNAVAILABLE",
        historicalCoverageRatio: computeCoverageRatio(candles, resolved.candlesRequestedEstimate),
        formingCandlePresent: candles.some((c) => !c.isClosed),
        closedCandleCount: candles.filter((c) => c.isClosed).length,
        expectedClosedCandles: resolved.candlesRequestedEstimate,
        formingCandleCount: candles.filter((c) => !c.isClosed).length,
        windowBoundaryPolicy: "candle_aligned_half_open",
      },
      validation,
      dataGaps,
      sourceMetadata: {
        historicalSourceMode: sourceMode,
        seriesNote,
        seriesErrorCode,
        resampled,
        sourceTimeframe,
      },
      warnings,
      evidenceReady: isEvidenceReady(validation),
    };

    const contentFingerprint = fingerprintAnalysisSnapshotPayload(
      buildAnalysisSnapshotFingerprintPayload(draft),
    );

    const snapshot: AnalysisMarketSnapshot = {
      ...draft,
      snapshotId: randomUUID(),
      requestId,
      createdAt: new Date().toISOString(),
      contentFingerprint,
    };

    await this.store.save(snapshot);

    const ok = snapshot.evidenceReady;
    return {
      ok,
      snapshot,
      code: ok ? "OK" : validation.status,
      error: ok ? null : (validation.errors[0] ?? validation.status),
      latencyMs: Date.now() - started,
    };
  }

  async getSnapshot(snapshotId: string): Promise<AnalysisMarketSnapshot | null> {
    return this.store.get(snapshotId);
  }

  async listMeta(limit = 20) {
    return this.store.listMeta(limit);
  }
}

let singleton: AnalysisSnapshotEngine | null = null;

export function getAnalysisSnapshotEngine(): AnalysisSnapshotEngine {
  singleton ??= new AnalysisSnapshotEngine();
  return singleton;
}

export function createAnalysisSnapshotEngine(options?: {
  marketData?: MarketDataService;
  store?: AnalysisSnapshotStore;
}): AnalysisSnapshotEngine {
  return new AnalysisSnapshotEngine(options);
}

export function resetAnalysisSnapshotEngineForTests(): void {
  singleton = null;
}
