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

const MAX_SERIES = 32;
const POLL_MS = 500;

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
  private pollInFlight = false;

  constructor(options?: { bridge?: ForexConnectBridge }) {
    this.bridge = options?.bridge ?? getForexConnectBridge();
  }

  private sessionKey(symbol: string, timeframe: string): string {
    return `FOREXCONNECT:${normalizeCanonicalSymbol(symbol)}:${timeframe}`;
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
      session.refCount += 1;
      this.ensurePoller();
      return this.toSeries(session);
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
      updateCount: 0,
      streamState: "SUBSCRIBED_WAITING",
      errorCode: null,
      errorMessage: null,
      bootstrapped: true,
    };
    this.sessions.set(key, session);
    this.ensurePoller();
    await this.pollOnce();
    return this.toSeries(session);
  }

  async unsubscribe(symbol: string, timeframe: string): Promise<void> {
    const key = this.sessionKey(symbol, timeframe);
    const session = this.sessions.get(key);
    if (!session) return;
    session.refCount -= 1;
    if (session.refCount > 0) return;
    this.sessions.delete(key);
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
    if (this.sessions.size === 0) this.stopPoller();
  }

  getSeries(symbol: string, timeframe: string): SafeForexConnectLiveSeries | null {
    if (!isForexConnectSupportedTimeframe(timeframe)) return null;
    const session = this.sessions.get(this.sessionKey(symbol, timeframe));
    return session ? this.toSeries(session) : null;
  }

  getLatestQuote(symbol: string): ForexConnectLiveQuote | null {
    const compact = normalizeCanonicalSymbol(symbol);
    for (const session of this.sessions.values()) {
      if (
        session.canonicalSymbol === compact
        || session.providerSymbol.toUpperCase() === symbol.trim().toUpperCase()
      ) {
        return session.lastQuote;
      }
    }
    return null;
  }

  async getStreamStatus(): Promise<ForexConnectStreamStatus> {
    return this.bridge.getStreamStatus();
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
      const quotes = await this.bridge.pollQuotes();
      const now = Date.now();
      for (const session of this.sessions.values()) {
        const match = quotes.find((q) =>
          q.canonicalSymbol === session.canonicalSymbol
          || q.providerSymbol.toUpperCase() === session.providerSymbol.toUpperCase()
        );
        if (!match) {
          if (session.lastQuoteAtMs != null && now - session.lastQuoteAtMs > FOREXCONNECT_STALE_MS) {
            session.streamState = "STALE";
          }
          continue;
        }
        const eventTimeMs = match.sourceTimestampMs ?? match.receivedAtMs;
        const price = match.candlePrice;
        if (price == null) continue;
        // Ignore stale cached quotes republished without newer timestamps.
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
      lastQuoteAt: session.lastQuoteAtMs ? new Date(session.lastQuoteAtMs).toISOString() : null,
      lastQuoteAgeMs: session.lastQuoteAtMs != null ? Math.max(0, now - session.lastQuoteAtMs) : null,
      updateCount: session.updateCount,
      note: session.updateCount > 0
        ? "ForexConnect live bid candles (Offers table updates + historical baseline)."
        : "ForexConnect subscribed; waiting for Offers table price updates.",
      errorCode: session.errorCode,
      errorMessage: session.errorMessage,
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
