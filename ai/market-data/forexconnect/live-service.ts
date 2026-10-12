/**
 * Phase 35 — ForexConnect live candle service.
 * Polls localhost sidecar quotes (Offers table updates) and maintains forming bid candles.
 */
import type { ForexConnectBridge } from "./client.js";
import { getForexConnectBridge } from "./client.js";
import { ForexConnectMarketDataError } from "./errors.js";
import {
  applyFcBidPriceToCandles,
  FOREXCONNECT_STALE_MS,
  formingCandleOf,
  historicalToFcLiveCandle,
  mergeHistoricalWithFcLiveCandles,
  isGenuineFcOfferEventSource,
  normalizeFcOfferQuote,
} from "./live-candle-sync.js";
import type {
  ForexConnectLiveCandle,
  ForexConnectLiveQuote,
  ForexConnectLiveStreamState,
  ForexConnectStreamStatus,
  SafeForexConnectLiveSeries,
} from "./live-types.js";
import {
  isForexConnectSupportedTimeframe,
  type ForexConnectSupportedTimeframe,
} from "./timeframes.js";
import { normalizeCanonicalSymbol } from "../providers/identity.js";
import { resolveFcWaitingStreamState } from "./stream-state.js";

export { resolveFcWaitingStreamState } from "./stream-state.js";

const MAX_SERIES = 32;
const POLL_MS = 500;
/** HTTP poll clients do not unsubscribe; release idle live sessions after this quiet period. */
export const FOREXCONNECT_LIVE_IDLE_MS = 180_000;
const IDLE_SWEEP_MS = 15_000;

interface Session {
  key: string;
  symbol: string;
  timeframe: ForexConnectSupportedTimeframe;
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  refCount: number;
  candles: ForexConnectLiveCandle[];
  lastQuote: ForexConnectLiveQuote | null;
  lastQuoteAtMs: number | null;
  /** Last HTTP/API consumer touch — used for idle release (browser close/navigation). */
  lastClientAtMs: number;
  updateCount: number;
  streamState: ForexConnectLiveStreamState;
  errorCode: string | null;
  errorMessage: string | null;
  bootstrapped: boolean;
}

export class ForexConnectLiveCandleService {
  private readonly bridge: ForexConnectBridge;
  private readonly sessions = new Map<string, Session>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private idleSweepTimer: ReturnType<typeof setInterval> | null = null;
  private pollInFlight = false;
  private idleSweepCount = 0;
  /** Sidecar Offers callback counter — LIVE only when this increases. */
  private lastSeenStreamUpdateCount = 0;
  private lastStreamStatus: ForexConnectStreamStatus | null = null;

  constructor(options?: { bridge?: ForexConnectBridge }) {
    this.bridge = options?.bridge ?? getForexConnectBridge();
  }

  private sessionKey(symbol: string, timeframe: string): string {
    return `FOREXCONNECT:${normalizeCanonicalSymbol(symbol)}:${timeframe}`;
  }

  /**
   * Ensure a live session for HTTP poll clients.
   * Reuses an existing session without bumping refCount (mode=live polls must not leak).
   */
  async ensure(symbol: string, timeframe: string): Promise<SafeForexConnectLiveSeries> {
    if (!isForexConnectSupportedTimeframe(timeframe)) {
      throw new ForexConnectMarketDataError(
        "FOREXCONNECT_UNSUPPORTED_TIMEFRAME",
        `Unsupported ForexConnect timeframe "${timeframe}".`,
      );
    }
    const key = this.sessionKey(symbol, timeframe);
    const existing = this.sessions.get(key);
    if (existing) {
      existing.lastClientAtMs = Date.now();
      this.ensurePoller();
      this.ensureIdleSweeper();
      return this.toSeries(existing);
    }
    return this.subscribe(symbol, timeframe);
  }

  async subscribe(symbol: string, timeframe: string): Promise<SafeForexConnectLiveSeries> {
    if (!isForexConnectSupportedTimeframe(timeframe)) {
      throw new ForexConnectMarketDataError(
        "FOREXCONNECT_UNSUPPORTED_TIMEFRAME",
        `Unsupported ForexConnect timeframe "${timeframe}".`,
      );
    }
    const key = this.sessionKey(symbol, timeframe);
    let session = this.sessions.get(key);
    if (session) {
      // Touch only — never accumulate refCount from repeated HTTP mode=live polls.
      session.lastClientAtMs = Date.now();
      this.ensurePoller();
      this.ensureIdleSweeper();
      return this.toSeries(session);
    }
    if (this.sessions.size >= MAX_SERIES) {
      this.sweepIdleSessions(Date.now());
    }
    if (this.sessions.size >= MAX_SERIES) {
      throw new ForexConnectMarketDataError(
        "FOREXCONNECT_SUBSCRIPTION_LIMIT",
        `Too many ForexConnect live sessions (max ${MAX_SERIES}).`,
      );
    }

    const sub = await this.bridge.subscribeQuotes(symbol);
    if (!sub.ok) {
      throw new ForexConnectMarketDataError(
        sub.error?.code ?? "FOREXCONNECT_SUBSCRIBE_FAILED",
        sub.error?.message ?? "ForexConnect subscribe failed.",
      );
    }

    const hist = await this.bridge.getHistoricalCandles({
      symbol: sub.providerSymbol ?? symbol,
      timeframe,
      limit: 300,
    });

    const identity = {
      marketType: "FOREX" as const,
      providerSymbol: hist.providerSymbol,
      canonicalSymbol: hist.canonicalSymbol,
      timeframe,
    };
    const candles = hist.candles.map((c) => historicalToFcLiveCandle(c, identity));
    const now = Date.now();

    session = {
      key,
      symbol,
      timeframe,
      providerSymbol: hist.providerSymbol,
      canonicalSymbol: hist.canonicalSymbol,
      displaySymbol: hist.displaySymbol,
      refCount: 1,
      candles,
      lastQuote: null,
      lastQuoteAtMs: null,
      lastClientAtMs: now,
      updateCount: 0,
      streamState: "SUBSCRIBED_WAITING",
      errorCode: null,
      errorMessage: null,
      bootstrapped: true,
    };
    this.sessions.set(key, session);
    this.ensurePoller();
    this.ensureIdleSweeper();
    await this.pollOnce();
    return this.toSeries(session);
  }

  async unsubscribe(symbol: string, timeframe: string): Promise<void> {
    const key = this.sessionKey(symbol, timeframe);
    const session = this.sessions.get(key);
    if (!session) return;
    session.refCount = Math.max(0, session.refCount - 1);
    if (session.refCount > 0) return;
    await this.releaseSession(session);
  }

  /** Active live session count (diagnostics / tests). */
  getSessionCount(): number {
    return this.sessions.size;
  }

  getIdleSweepCount(): number {
    return this.idleSweepCount;
  }

  /** Test helper — run idle release with an explicit clock. */
  sweepIdleSessionsForTests(nowMs: number = Date.now()): void {
    this.sweepIdleSessions(nowMs);
  }

  getSeries(symbol: string, timeframe: string): SafeForexConnectLiveSeries | null {
    if (!isForexConnectSupportedTimeframe(timeframe)) return null;
    const session = this.sessions.get(this.sessionKey(symbol, timeframe));
    if (!session) return null;
    session.lastClientAtMs = Date.now();
    return this.toSeries(session);
  }

  private async releaseSession(session: Session): Promise<void> {
    this.sessions.delete(session.key);
    const stillNeeded = [...this.sessions.values()].some(
      (s) => normalizeCanonicalSymbol(s.providerSymbol) === session.canonicalSymbol
        || s.providerSymbol === session.providerSymbol,
    );
    if (!stillNeeded) {
      try {
        await this.bridge.unsubscribeQuotes(session.providerSymbol);
      } catch {
        /* best-effort */
      }
    }
    if (this.sessions.size === 0) {
      this.stopPoller();
      this.stopIdleSweeper();
    }
  }

  private sweepIdleSessions(nowMs: number = Date.now()): void {
    const idle: Session[] = [];
    for (const session of this.sessions.values()) {
      if (nowMs - session.lastClientAtMs >= FOREXCONNECT_LIVE_IDLE_MS) {
        idle.push(session);
      }
    }
    for (const session of idle) {
      this.idleSweepCount += 1;
      void this.releaseSession(session);
    }
  }

  private ensureIdleSweeper(): void {
    if (this.idleSweepTimer) return;
    this.idleSweepTimer = setInterval(() => {
      this.sweepIdleSessions();
    }, IDLE_SWEEP_MS);
  }

  private stopIdleSweeper(): void {
    if (this.idleSweepTimer) {
      clearInterval(this.idleSweepTimer);
      this.idleSweepTimer = null;
    }
  }

  getLatestQuote(symbol: string): ForexConnectLiveQuote | null {
    return this.getLatestQuoteState(symbol)?.quote ?? null;
  }

  /**
   * Quote + per-session freshness. Seeds may populate quote without LIVE streamState.
   * Callers must not treat a non-null quote as LIVE without checking streamState.
   */
  getLatestQuoteState(symbol: string): {
    quote: ForexConnectLiveQuote;
    streamState: ForexConnectLiveStreamState;
    lastQuoteAtMs: number | null;
    updateCount: number;
  } | null {
    const compact = normalizeCanonicalSymbol(symbol);
    for (const session of this.sessions.values()) {
      if (
        session.canonicalSymbol === compact
        || session.providerSymbol.toUpperCase() === symbol.trim().toUpperCase()
      ) {
        if (!session.lastQuote) return null;
        const series = this.toSeries(session);
        return {
          quote: session.lastQuote,
          streamState: series.streamState,
          lastQuoteAtMs: session.lastQuoteAtMs,
          updateCount: session.updateCount,
        };
      }
    }
    return null;
  }

  async getStreamStatus(): Promise<ForexConnectStreamStatus> {
    return this.bridge.getStreamStatus();
  }

  /** Drop all live sessions (used when switching DEMO ↔ LIVE). */
  async clearAllSessions(): Promise<void> {
    const symbols = [...new Set([...this.sessions.values()].map((s) => s.providerSymbol))];
    this.sessions.clear();
    this.stopPoller();
    this.stopIdleSweeper();
    for (const symbol of symbols) {
      try {
        await this.bridge.unsubscribeQuotes(symbol);
      } catch {
        /* best-effort */
      }
    }
  }

  private ensurePoller(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      void this.pollOnce();
    }, POLL_MS);
  }

  private stopPoller(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollOnce(): Promise<void> {
    if (this.pollInFlight || this.sessions.size === 0) return;
    this.pollInFlight = true;
    try {
      const [quotes, stream] = await Promise.all([
        this.bridge.pollQuotes(),
        this.bridge.getStreamStatus(),
      ]);
      this.lastStreamStatus = stream;
      const now = Date.now();
      const streamUpdates = Number(stream.updateCount ?? 0);
      const hasNewOffersEvents = streamUpdates > this.lastSeenStreamUpdateCount;
      if (hasNewOffersEvents) this.lastSeenStreamUpdateCount = streamUpdates;

      for (const session of this.sessions.values()) {
        const match = quotes.find((q) =>
          q.canonicalSymbol === session.canonicalSymbol
          || q.providerSymbol.toUpperCase() === session.providerSymbol.toUpperCase()
        );
        if (!match) {
          if (session.updateCount > 0
            && session.lastQuoteAtMs != null
            && now - session.lastQuoteAtMs > FOREXCONNECT_STALE_MS) {
            session.streamState = "STALE";
          } else if (session.updateCount <= 0) {
            // Preserve sidecar MARKET_INACTIVE / SUBSCRIBED_WAITING — do not collapse to CONNECTING.
            session.streamState = resolveFcWaitingStreamState(stream.streamState, session.updateCount);
          }
          continue;
        }

        // Seeded Offers snapshots may be shown as last quote, but must not fabricate LIVE candles.
        // Bootstrap exception: when the sidecar stream is already LIVE and this symbol has a
        // genuine Offers eventSource quote newer than the session, apply without waiting for the
        // next global updateCount bump (avoids SUBSCRIBED_WAITING while peers are ticking).
        const genuineEvent = isGenuineFcOfferEventSource(match.eventSource);
        const quoteAdvanced = session.lastQuoteAtMs == null
          || match.receivedAtMs > session.lastQuoteAtMs;
        const bootstrapFromLivePeer = !hasNewOffersEvents
          && session.updateCount <= 0
          && stream.streamState === "LIVE"
          && streamUpdates > 0
          && genuineEvent
          && quoteAdvanced
          && (now - match.receivedAtMs) <= FOREXCONNECT_STALE_MS;

        if (!hasNewOffersEvents && !bootstrapFromLivePeer) {
          if (session.lastQuote == null) session.lastQuote = match;
          if (session.updateCount <= 0) {
            session.streamState = resolveFcWaitingStreamState(stream.streamState, session.updateCount);
          } else if (
            session.lastQuoteAtMs != null
            && now - session.lastQuoteAtMs > FOREXCONNECT_STALE_MS
          ) {
            session.streamState = "STALE";
          }
          continue;
        }

        const eventTimeMs = match.sourceTimestampMs ?? match.receivedAtMs;
        const price = match.candlePrice;
        if (price == null) continue;
        if (
          session.lastQuoteAtMs != null
          && match.receivedAtMs <= session.lastQuoteAtMs
          && (match.sourceTimestampMs == null
            || match.sourceTimestampMs <= (session.lastQuote?.sourceTimestampMs ?? 0))
        ) {
          continue;
        }

        const applied = applyFcBidPriceToCandles(
          session.candles,
          price,
          eventTimeMs,
          {
            marketType: "FOREX",
            providerSymbol: session.providerSymbol,
            canonicalSymbol: session.canonicalSymbol,
            timeframe: session.timeframe,
          },
          now,
        );
        session.candles = mergeHistoricalWithFcLiveCandles(
          session.candles,
          applied.candles,
          now,
          session.timeframe,
        );
        session.lastQuote = match;
        session.lastQuoteAtMs = match.receivedAtMs;
        if (applied.applied) session.updateCount += 1;
        session.streamState = "LIVE";
        session.errorCode = null;
        session.errorMessage = null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "ForexConnect live poll failed.";
      for (const session of this.sessions.values()) {
        session.streamState = "ERROR";
        session.errorCode = "FOREXCONNECT_STREAM_ERROR";
        session.errorMessage = message.slice(0, 300);
      }
    } finally {
      this.pollInFlight = false;
    }
  }

  private toSeries(session: Session): SafeForexConnectLiveSeries {
    const now = Date.now();
    let streamState = session.streamState;
    if (session.updateCount <= 0 && this.lastStreamStatus) {
      streamState = resolveFcWaitingStreamState(this.lastStreamStatus.streamState, session.updateCount);
    }
    if (
      session.lastQuoteAtMs != null
      && now - session.lastQuoteAtMs > FOREXCONNECT_STALE_MS
      && streamState === "LIVE"
    ) {
      streamState = "STALE";
    }
    const candles = mergeHistoricalWithFcLiveCandles(
      session.candles,
      session.candles,
      now,
      session.timeframe,
    );
    const forming = formingCandleOf(candles);
    const cfg = this.bridge.getConfig();
    const mode = session.updateCount > 0 ? "HISTORICAL_LIVE" : "HISTORICAL";
    const diag = this.lastStreamStatus?.diagnostics ?? null;
    const sidecarUpdateCount = Number(this.lastStreamStatus?.updateCount ?? 0);
    const sidecarLastQuoteAt = this.lastStreamStatus?.lastQuoteAt ?? null;
    const sidecarLastQuoteAgeMs = this.lastStreamStatus?.lastQuoteAgeMs ?? null;
    const lastQuoteAt = session.lastQuoteAtMs
      ? new Date(session.lastQuoteAtMs).toISOString()
      : sidecarLastQuoteAt;
    const lastQuoteAgeMs = session.lastQuoteAtMs != null
      ? Math.max(0, now - session.lastQuoteAtMs)
      : sidecarLastQuoteAgeMs;
    const diagNote = diag
      ? ` pollCycles=${diag.pollCycles} pollChanges=${diag.pollChanges} updateCount=${sidecarUpdateCount}`
      : ` updateCount=${sidecarUpdateCount}`;
    const note = session.updateCount > 0
      ? `ForexConnect live bid candles (Offers table updates + historical baseline).${diagNote}`
      : streamState === "MARKET_INACTIVE"
        ? `ForexConnect Offers subscribed; market inactive (no bid/ask changes).${diagNote}`
        : `ForexConnect subscribed; waiting for Offers table price updates.${diagNote}`;
    return {
      ok: true,
      provider: "FOREXCONNECT",
      marketType: "FOREX",
      providerSymbol: session.providerSymbol,
      canonicalSymbol: session.canonicalSymbol,
      displaySymbol: session.displaySymbol,
      timeframe: session.timeframe,
      priceBasis: "bid",
      environment: cfg.environment,
      environmentLabel: cfg.environmentLabel,
      mode,
      streamState,
      candles,
      forming,
      count: candles.length,
      lastQuoteAt,
      lastQuoteAgeMs,
      updateCount: session.updateCount,
      note,
      errorCode: session.errorCode,
      errorMessage: session.errorMessage,
      streamDiagnostics: diag,
      sidecarUpdateCount,
    };
  }
}

let singleton: ForexConnectLiveCandleService | null = null;

export function getForexConnectLiveCandleService(): ForexConnectLiveCandleService {
  singleton ??= new ForexConnectLiveCandleService();
  return singleton;
}

export function createForexConnectLiveCandleService(options?: {
  bridge?: ForexConnectBridge;
}): ForexConnectLiveCandleService {
  return new ForexConnectLiveCandleService(options);
}

export function resetForexConnectLiveCandleServiceForTests(): void {
  singleton = null;
}

export { normalizeFcOfferQuote };
