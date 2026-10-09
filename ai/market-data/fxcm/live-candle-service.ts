/**
 * Phase 30 — FXCM live candle service (server-side authoritative).
 *
 * Orchestrates:
 *   Phase 28 historical candles
 *   + Phase 29 quote stream
 *   → sync engine → continuous series
 *
 * Initialization race protection:
 *   subscribe stream first → buffer quotes → load historical → merge buffer → activate
 *
 * Reconnect: historical gap reconcile from last candle → now, then resume quotes.
 * No synthetic candles. No trading. No live indicators/AI.
 */
import {
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
import { FxcmMarketDataError, userFacingFxcmError } from "./errors.js";
import type { FetchLike } from "./client.js";
import {
  FXCM_TIMEFRAME_MS,
  isFxcmSupportedProjectTimeframe,
  type FxcmSupportedProjectTimeframe,
} from "./timeframes.js";
import type { FxcmMarketQuoteEvent, FxcmStreamState } from "./stream-types.js";
import {
  applyFxcmPriceToCandles,
  closeElapsedFxcmCandles,
  formingCandleOf,
  fxcmCandlePriceFromQuote,
  historicalToLiveCandle,
  mergeHistoricalWithLiveCandles,
} from "./live-candle-sync.js";
import {
  fxcmLiveCandleSeriesKey,
  type FxcmLiveCandle,
  type FxcmLiveCandleMode,
  type FxcmLiveCandleQualityStatus,
  type SafeFxcmLiveCandleSeries,
} from "./live-candle-types.js";
import { assertSafeStreamPayload } from "./stream-normalize.js";
import { normalizeFxcmSourceTimestampMs } from "./stream-normalize.js";
import type { MarketAssetType } from "../providers/types.js";

const LIVE_BUFFER_MAX = 500;
const HISTORICAL_LIMIT = 300;

export type FxcmLiveCandleListener = (series: SafeFxcmLiveCandleSeries) => void;

export interface FxcmLiveCandleServiceOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  nowMs?: () => number;
  auth?: FxcmAuthenticationService;
  discovery?: FxcmInstrumentDiscoveryService;
  historical?: FxcmHistoricalMarketDataService;
  stream?: FxcmRealtimeStreamService;
}

interface SessionState {
  key: string;
  generation: number;
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  timeframe: FxcmSupportedProjectTimeframe;
  candles: FxcmLiveCandle[];
  initializing: boolean;
  active: boolean;
  buffer: FxcmMarketQuoteEvent[];
  duplicatesRemoved: number;
  invalidQuotes: number;
  reconciledGaps: number;
  lastQuoteAt: string | null;
  lastSourceTimestamp: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  unsubscribeQuote: (() => void) | null;
  refCount: number;
}

export class FxcmLiveCandleService {
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl?: FetchLike;
  private readonly nowMs: () => number;
  private readonly auth: FxcmAuthenticationService;
  private readonly discovery: FxcmInstrumentDiscoveryService;
  private readonly historical: FxcmHistoricalMarketDataService;
  private readonly stream: FxcmRealtimeStreamService;
  private config: FxcmConfig;
  private sessions = new Map<string, SessionState>();
  private listeners = new Set<FxcmLiveCandleListener>();
  private closed = false;

  constructor(options: FxcmLiveCandleServiceOptions = {}) {
    this.env = options.env ?? (process.env as Record<string, string | undefined>);
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
    this.config = resolveFxcmConfig(this.env);
  }

  getStreamService(): FxcmRealtimeStreamService {
    return this.stream;
  }

  onChange(listener: FxcmLiveCandleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  listSessions(): SafeFxcmLiveCandleSeries[] {
    return [...this.sessions.values()].map((s) => this.toSafeSeries(s));
  }

  getSeries(symbol: string, timeframe: string): SafeFxcmLiveCandleSeries | null {
    const session = this.findSession(symbol, timeframe);
    if (!session) return null;
    this.refreshClosure(session);
    return this.toSafeSeries(session);
  }

  /**
   * Start / retain a live candle session.
   * Reference-counted so Charts + TA can share one underlying stream.
   */
  async subscribe(symbol: string, timeframe: string): Promise<SafeFxcmLiveCandleSeries> {
    if (this.closed) {
      throw new FxcmMarketDataError("FXCM_UNAVAILABLE", "FXCM live candle service is closed.");
    }
    this.config = resolveFxcmConfig(this.env);
    if (!this.config.enabled) {
      throw new FxcmMarketDataError("FXCM_DISABLED", "FXCM market data is disabled.");
    }
    if (!this.config.accessTokenConfigured) {
      throw new FxcmMarketDataError("FXCM_NOT_CONFIGURED", "FXCM access token is not configured.");
    }
    if (!isFxcmSupportedProjectTimeframe(timeframe)) {
      throw new FxcmMarketDataError("FXCM_UNSUPPORTED_TIMEFRAME", "Unsupported FXCM timeframe.");
    }

    const discovery = await this.discovery.discover({ refresh: false });
    const raw = String(symbol ?? "").trim();
    const inst = discovery.instruments.find((i) =>
      i.providerSymbol === raw
      || i.canonicalSymbol === raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
      || i.displaySymbol === raw
    );
    if (!inst) {
      throw new FxcmMarketDataError("FXCM_INSTRUMENT_NOT_FOUND", "Instrument not found in FXCM catalog.");
    }
    if (inst.mappingStatus !== "VALIDATED") {
      if (inst.mappingStatus === "CONFLICT") {
        throw new FxcmMarketDataError("FXCM_MAPPING_CONFLICT", "FXCM symbol mapping is in conflict.");
      }
      throw new FxcmMarketDataError("FXCM_MAPPING_UNRESOLVED", "FXCM symbol mapping is unresolved.");
    }

    const key = fxcmLiveCandleSeriesKey(inst.providerSymbol, timeframe, inst.marketType);
    const existing = this.sessions.get(key);
    if (existing) {
      existing.refCount += 1;
      this.refreshClosure(existing);
      return this.toSafeSeries(existing);
    }

    const session: SessionState = {
      key,
      generation: 1,
      marketType: inst.marketType,
      providerSymbol: inst.providerSymbol,
      canonicalSymbol: inst.canonicalSymbol,
      displaySymbol: inst.displaySymbol,
      timeframe,
      candles: [],
      initializing: true,
      active: false,
      buffer: [],
      duplicatesRemoved: 0,
      invalidQuotes: 0,
      reconciledGaps: 0,
      lastQuoteAt: null,
      lastSourceTimestamp: null,
      errorCode: null,
      errorMessage: null,
      unsubscribeQuote: null,
      refCount: 1,
    };
    this.sessions.set(key, session);

    // 1) Subscribe stream first and buffer quotes during historical load.
    session.unsubscribeQuote = this.stream.onQuote((event) => {
      if (event.providerSymbol !== session.providerSymbol) return;
      this.handleQuote(session, event);
    });

    try {
      await this.stream.subscribe(inst.providerSymbol);
      const hist = await this.historical.getHistoricalCandles({
        symbol: inst.providerSymbol,
        timeframe,
        limit: HISTORICAL_LIMIT,
        refresh: false,
      });
      const identity = {
        marketType: session.marketType,
        providerSymbol: session.providerSymbol,
        canonicalSymbol: session.canonicalSymbol,
        timeframe: session.timeframe,
      };
      const histLive = hist.candles.map((c) => historicalToLiveCandle(c, identity));
      const now = this.nowMs();
      const merged = mergeHistoricalWithLiveCandles(histLive, [], now, timeframe);
      session.candles = merged.candles;
      session.duplicatesRemoved += merged.duplicatesRemoved;

      // 2) Drain buffer into series
      const buffered = session.buffer.splice(0, session.buffer.length);
      for (const q of buffered) {
        this.applyQuoteImmediate(session, q);
      }

      session.initializing = false;
      session.active = true;
      this.refreshClosure(session);
      this.emit(session);
      return this.toSafeSeries(session);
    } catch (error) {
      const mapped = userFacingFxcmError(error);
      session.errorCode = mapped.code;
      session.errorMessage = mapped.message;
      session.initializing = false;
      this.sessions.delete(key);
      session.unsubscribeQuote?.();
      throw error instanceof FxcmMarketDataError
        ? error
        : new FxcmMarketDataError(mapped.code, mapped.message);
    }
  }

  async unsubscribe(symbol: string, timeframe: string): Promise<void> {
    const session = this.findSession(symbol, timeframe);
    if (!session) return;
    session.refCount = Math.max(0, session.refCount - 1);
    if (session.refCount > 0) return;

    session.unsubscribeQuote?.();
    session.unsubscribeQuote = null;
    this.sessions.delete(session.key);

    // Unsubscribe provider stream only if no other candle session needs the symbol.
    const stillNeeded = [...this.sessions.values()].some(
      (s) => s.providerSymbol === session.providerSymbol,
    );
    if (!stillNeeded) {
      await this.stream.unsubscribe(session.providerSymbol).catch(() => undefined);
    }
  }

  /** Reconcile gap after stream reconnect using Phase 28 historical. */
  async reconcileSession(symbol: string, timeframe: string): Promise<SafeFxcmLiveCandleSeries | null> {
    const session = this.findSession(symbol, timeframe);
    if (!session || !session.active) return session ? this.toSafeSeries(session) : null;

    const gen = session.generation;
    const last = session.candles[session.candles.length - 1];
    const startMs = last ? last.time * 1000 : this.nowMs() - 24 * 60 * 60 * 1000;
    const endMs = this.nowMs();

    try {
      const hist = await this.historical.getHistoricalCandles({
        symbol: session.providerSymbol,
        timeframe: session.timeframe,
        startTimeMs: startMs,
        endTimeMs: endMs,
        limit: HISTORICAL_LIMIT,
        refresh: true,
      });
      if (gen !== session.generation) return this.toSafeSeries(session);

      const identity = {
        marketType: session.marketType,
        providerSymbol: session.providerSymbol,
        canonicalSymbol: session.canonicalSymbol,
        timeframe: session.timeframe,
      };
      const histLive = hist.candles.map((c) => historicalToLiveCandle(c, identity));
      const merged = mergeHistoricalWithLiveCandles(
        histLive,
        session.candles,
        this.nowMs(),
        session.timeframe,
      );
      session.candles = merged.candles;
      session.duplicatesRemoved += merged.duplicatesRemoved;
      session.reconciledGaps += 1;
      session.errorCode = null;
      session.errorMessage = null;
      this.refreshClosure(session);
      this.emit(session);
    } catch (error) {
      const mapped = userFacingFxcmError(error);
      session.errorCode = mapped.code;
      session.errorMessage = mapped.message;
    }
    return this.toSafeSeries(session);
  }

  /** Test helper: inject a normalized quote into an active session. */
  injectQuote(symbol: string, timeframe: string, event: FxcmMarketQuoteEvent): void {
    const session = this.findSession(symbol, timeframe);
    if (!session) return;
    this.handleQuote(session, event);
  }

  shutdown(): void {
    this.closed = true;
    for (const session of this.sessions.values()) {
      session.unsubscribeQuote?.();
    }
    this.sessions.clear();
    this.listeners.clear();
  }

  private findSession(symbol: string, timeframe: string): SessionState | null {
    const raw = String(symbol ?? "").trim();
    const tf = String(timeframe ?? "").trim();
    for (const s of this.sessions.values()) {
      if (s.timeframe !== tf) continue;
      if (
        s.providerSymbol === raw
        || s.canonicalSymbol === raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
        || s.displaySymbol === raw
        || s.key === raw
      ) {
        return s;
      }
    }
    return null;
  }

  private handleQuote(session: SessionState, event: FxcmMarketQuoteEvent): void {
    if (!event.valid) {
      session.invalidQuotes += 1;
      return;
    }
    if (session.initializing) {
      session.buffer.push(event);
      if (session.buffer.length > LIVE_BUFFER_MAX) {
        session.buffer.splice(0, session.buffer.length - LIVE_BUFFER_MAX);
      }
      return;
    }
    if (!session.active) return;

    // Reconnect race: only active generation accepts events.
    const streamState = this.stream.getStreamState();
    if (streamState === "DISCONNECTED" || streamState === "RECONNECTING") {
      // Do not fabricate; freeze series. Trigger reconcile when LIVE again via evaluate path.
      return;
    }

    const applied = this.applyQuoteImmediate(session, event);
    if (applied) this.emit(session);

    // If we just returned to LIVE after a gap, reconcile once.
    if (streamState === "LIVE" && session.candles.length > 0) {
      const tip = session.candles[session.candles.length - 1]!;
      const eventMs = this.quoteEventMs(event);
      if (eventMs != null && eventMs - tip.time * 1000 > FXCM_TIMEFRAME_MS[session.timeframe] * 2) {
        session.generation += 1;
        void this.reconcileSession(session.providerSymbol, session.timeframe);
      }
    }
  }

  private applyQuoteImmediate(session: SessionState, event: FxcmMarketQuoteEvent): boolean {
    const price = fxcmCandlePriceFromQuote({
      bid: event.bid,
      ask: event.ask,
      mid: event.mid,
      eventTimeMs: this.quoteEventMs(event) ?? this.nowMs(),
    });
    if (price == null) {
      session.invalidQuotes += 1;
      return false;
    }
    const eventMs = this.quoteEventMs(event) ?? this.nowMs();
    const result = applyFxcmPriceToCandles(
      session.candles,
      price,
      eventMs,
      {
        marketType: session.marketType,
        providerSymbol: session.providerSymbol,
        canonicalSymbol: session.canonicalSymbol,
        timeframe: session.timeframe,
      },
      this.nowMs(),
    );
    if (!result.applied) {
      if (result.reason && result.reason !== "closed_candle_immutable" && result.reason !== "out_of_order_bucket") {
        session.invalidQuotes += 1;
      }
      return false;
    }
    session.candles = result.candles;
    session.lastQuoteAt = event.receivedAt;
    session.lastSourceTimestamp = event.sourceTimestamp;
    return true;
  }

  private quoteEventMs(event: FxcmMarketQuoteEvent): number | null {
    if (event.sourceTimestamp) {
      const ms = Date.parse(event.sourceTimestamp);
      if (Number.isFinite(ms)) return ms;
    }
    const fromRaw = normalizeFxcmSourceTimestampMs(event.sourceTimestamp);
    if (fromRaw != null) return fromRaw;
    const recv = Date.parse(event.receivedAt);
    return Number.isFinite(recv) ? recv : null;
  }

  private refreshClosure(session: SessionState): void {
    session.candles = closeElapsedFxcmCandles(session.candles, this.nowMs(), session.timeframe);
  }

  private streamStateFor(session: SessionState): FxcmStreamState {
    const stream = this.stream.getStreamState();
    const quote = this.stream.getQuote(session.providerSymbol);
    if (quote?.state) return quote.state;
    return stream;
  }

  private toSafeSeries(session: SessionState): SafeFxcmLiveCandleSeries {
    this.refreshClosure(session);
    const streamState = this.streamStateFor(session);
    const forming = formingCandleOf(session.candles);
    const live = streamState === "LIVE" && Boolean(forming) && session.active && !session.initializing;
    const mode: FxcmLiveCandleMode = live
      ? "HISTORICAL_PLUS_LIVE"
      : session.candles.length > 0
        ? "HISTORICAL"
        : "LIVE";
    const qualityStatus: FxcmLiveCandleQualityStatus =
      session.candles.length === 0 ? "NO_DATA"
        : streamState === "STALE" ? "STALE"
          : session.reconciledGaps > 0 && !live ? "GAP"
            : session.invalidQuotes > 0 ? "PARTIAL"
              : "VALID";

    return {
      provider: "FXCM",
      environment: this.config.environment,
      environmentLabel: this.config.environmentLabel,
      marketType: session.marketType,
      symbol: session.canonicalSymbol,
      canonicalSymbol: session.canonicalSymbol,
      providerSymbol: session.providerSymbol,
      displaySymbol: session.displaySymbol,
      timeframe: session.timeframe,
      mode,
      streamState,
      live,
      priceBasis: "mid",
      trading: "DISABLED",
      count: session.candles.length,
      candles: session.candles,
      forming,
      lastQuoteAt: session.lastQuoteAt,
      lastSourceTimestamp: session.lastSourceTimestamp,
      quality: {
        status: qualityStatus,
        candleCount: session.candles.length,
        formingOpen: Boolean(forming),
        duplicatesRemoved: session.duplicatesRemoved,
        invalidQuotes: session.invalidQuotes,
        reconciledGaps: session.reconciledGaps,
        source: "FXCM",
      },
      note: "Phase 30 FXCM historical + live mid candles. Not trading. Live candles ≠ Binance.",
      errorCode: session.errorCode,
      errorMessage: session.errorMessage,
    };
  }

  private emit(session: SessionState): void {
    const safe = this.toSafeSeries(session);
    assertSafeStreamPayload(safe);
    for (const listener of this.listeners) {
      try {
        listener(safe);
      } catch {
        // ignore consumer errors
      }
    }
  }
}

export function createFxcmLiveCandleService(
  options?: FxcmLiveCandleServiceOptions,
): FxcmLiveCandleService {
  return new FxcmLiveCandleService(options);
}
