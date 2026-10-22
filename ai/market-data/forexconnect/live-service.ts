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
import { classifyForexConnectInstrument } from "./instrument-classify.js";
import { normalizeCanonicalSymbol } from "../providers/identity.js";
import type { MarketAssetType } from "../providers/types.js";
import {
  resolveFcFeedStreamState,
  resolveFcWaitingStreamState,
} from "./stream-state.js";
import {
  ForexConnectIntendedSubscriptionsStore,
  normalizeForexConnectPersistedEnvironment,
  type ForexConnectIntendedHydrateResult,
  type ForexConnectPersistedEnvironment,
  type ForexConnectPersistedIntendedEntry,
} from "./intended-subscriptions-store.js";

export {
  resolveFcFeedStreamState,
  resolveFcWaitingStreamState,
} from "./stream-state.js";

const MAX_SERIES = 32;
const POLL_MS = 500;
/** HTTP poll clients do not unsubscribe; release idle live sessions after this quiet period. */
export const FOREXCONNECT_LIVE_IDLE_MS = 180_000;
const IDLE_SWEEP_MS = 15_000;
/** Phase 56.3.3 — bounded restore after reconnect (no unbounded retry storm). */
export const FOREXCONNECT_RESTORE_MAX_ATTEMPTS = 3;
const RESTORE_BACKOFF_MS = [400, 1_200, 3_000] as const;

export type ForexConnectProviderLifecycleState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "SUBSCRIBING"
  | "RESTORING"
  | "LIVE"
  | "ERROR";

export interface ForexConnectIntendedSubscription {
  providerSymbol: string;
  timeframe: ForexConnectSupportedTimeframe;
  rememberedAtMs: number;
}

export interface ForexConnectRestoreResult {
  ok: boolean;
  attempted: number;
  restored: Array<{
    providerSymbol: string;
    timeframe: string;
    streamState: ForexConnectLiveStreamState | null;
    ok: boolean;
    error?: string;
  }>;
  lifecycleState: ForexConnectProviderLifecycleState;
  placesOrders: false;
  acceptsForExecution: false;
}

interface Session {
  key: string;
  symbol: string;
  timeframe: ForexConnectSupportedTimeframe;
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  /** Phase 56.3.3 — classified asset type (never silently hardcoded FOREX). */
  marketType: MarketAssetType;
  refCount: number;
  candles: ForexConnectLiveCandle[];
  lastQuote: ForexConnectLiveQuote | null;
  /** Last Offers receipt time (includes same-price heartbeats). */
  lastQuoteAtMs: number | null;
  /** Last genuine bid/ask change time — gates LIVE vs NO_RECENT_MARKET_UPDATES. */
  lastPriceChangeAtMs: number | null;
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
  /** Shared in-flight poll so ensure()/timer await the same cycle (no skipped recovery). */
  private pollPromise: Promise<void> | null = null;
  /** Coalesce concurrent ensure/subscribe for the same key (HTTP poll stampede). */
  private subscribeInflight = new Map<string, Promise<SafeForexConnectLiveSeries>>();
  private idleSweepCount = 0;
  /** Sidecar global Offers counter — diagnostics only; never gates instrument LIVE. */
  private lastSeenStreamUpdateCount = 0;
  private lastStreamStatus: ForexConnectStreamStatus | null = null;
  /**
   * Phase 56.3.3 — intended Offers subscriptions independent of the active session Map.
   * Survives same-env disconnect; cleared on DEMO↔LIVE switch or idle release.
   */
  private readonly intendedSubscriptions = new Map<string, ForexConnectIntendedSubscription>();
  private readonly persistence: ForexConnectIntendedSubscriptionsStore | null;
  private providerLifecycle: ForexConnectProviderLifecycleState = "DISCONNECTED";
  private lastDisconnectAtMs: number | null = null;
  private lastRestoreAtMs: number | null = null;
  private lastRestoreError: string | null = null;
  private restoreAttemptCount = 0;
  private restoreInflight: Promise<ForexConnectRestoreResult> | null = null;
  private lastHydrateResult: ForexConnectIntendedHydrateResult | null = null;
  private hydrateInflight: Promise<ForexConnectIntendedHydrateResult> | null = null;
  private persistedEnvironment: ForexConnectPersistedEnvironment | null = null;

  constructor(options?: {
    bridge?: ForexConnectBridge;
    /**
     * Durable intended-subscription store. Default null (unit tests stay disk-free).
     * Production singleton enables the store under data/forexconnect/.
     */
    persistence?: ForexConnectIntendedSubscriptionsStore | null;
  }) {
    this.bridge = options?.bridge ?? getForexConnectBridge();
    this.persistence = options?.persistence ?? null;
  }

  private resolveActiveEnvironment(): ForexConnectPersistedEnvironment | null {
    try {
      const cfg = this.bridge.getConfig();
      const fromCfg = normalizeForexConnectPersistedEnvironment(cfg?.environment);
      if (fromCfg) return fromCfg;
    } catch {
      /* best-effort */
    }
    return this.persistedEnvironment;
  }

  private rememberIntended(
    providerSymbol: string,
    timeframe: ForexConnectSupportedTimeframe,
  ): Promise<void> {
    const key = this.sessionKey(providerSymbol, timeframe);
    this.intendedSubscriptions.set(key, {
      providerSymbol,
      timeframe,
      rememberedAtMs: Date.now(),
    });
    return this.persistIntendedSafe();
  }

  private forgetIntended(
    providerSymbol: string,
    timeframe: ForexConnectSupportedTimeframe,
  ): Promise<void> {
    this.intendedSubscriptions.delete(this.sessionKey(providerSymbol, timeframe));
    return this.persistIntendedSafe();
  }

  private async persistIntendedSafe(): Promise<void> {
    if (!this.persistence) return;
    const env = this.resolveActiveEnvironment();
    this.persistedEnvironment = env;
    const rows: ForexConnectPersistedIntendedEntry[] = [...this.intendedSubscriptions.values()].map(
      (row) => ({
        providerSymbol: row.providerSymbol,
        timeframe: row.timeframe,
        rememberedAtMs: row.rememberedAtMs,
        canonicalSymbol: normalizeCanonicalSymbol(row.providerSymbol),
      }),
    );
    try {
      await this.persistence.save(env, rows);
    } catch {
      /* fail-safe: in-memory intent remains; diagnostics expose persistence error */
    }
  }

  /**
   * Phase 56.3.4 — load durable intent after process restart.
   * Does not create sessions or claim LIVE; pair with restoreIntendedSubscriptions.
   */
  async hydratePersistedIntended(options?: {
    environment?: string | null;
    validateCatalog?: boolean;
  }): Promise<ForexConnectIntendedHydrateResult> {
    if (this.hydrateInflight) return this.hydrateInflight;
    const run = this.runHydratePersistedIntended(options);
    this.hydrateInflight = run;
    void run.finally(() => {
      if (this.hydrateInflight === run) this.hydrateInflight = null;
    });
    return run;
  }

  private async runHydratePersistedIntended(options?: {
    environment?: string | null;
    validateCatalog?: boolean;
  }): Promise<ForexConnectIntendedHydrateResult> {
    if (!this.persistence) {
      const empty: ForexConnectIntendedHydrateResult = {
        ok: true,
        loaded: [],
        skipped: [{ reason: "persistence_disabled" }],
        environment: null,
        recoveredCorrupt: false,
        error: null,
        storePath: "(disabled)",
        placesOrders: false,
        acceptsForExecution: false,
      };
      this.lastHydrateResult = empty;
      return empty;
    }

    let catalogSymbols: Set<string> | null = null;
    if (options?.validateCatalog !== false) {
      try {
        const listed = await this.bridge.listInstruments();
        if (listed?.ok && Array.isArray(listed.instruments)) {
          catalogSymbols = new Set(
            listed.instruments
              .map((i) => String(i.providerSymbol ?? "").trim())
              .filter(Boolean),
          );
        }
      } catch {
        catalogSymbols = null;
      }
    }

    const env = options?.environment ?? this.resolveActiveEnvironment();
    const result = await this.persistence.hydrate({
      environment: env,
      catalogSymbols,
    });
    this.lastHydrateResult = result;
    if (result.environment) this.persistedEnvironment = result.environment;

    for (const entry of result.loaded) {
      const key = this.sessionKey(entry.providerSymbol, entry.timeframe);
      if (this.intendedSubscriptions.has(key)) continue;
      this.intendedSubscriptions.set(key, {
        providerSymbol: entry.providerSymbol,
        timeframe: entry.timeframe,
        rememberedAtMs: entry.rememberedAtMs,
      });
    }
    return result;
  }

  /** Diagnostics — intended vs active (never invents LIVE). */
  getLifecycleDiagnostics(nowMs: number = Date.now()): {
    lifecycleState: ForexConnectProviderLifecycleState;
    activeSessionCount: number;
    intendedCount: number;
    intended: ForexConnectIntendedSubscription[];
    lastDisconnectAtMs: number | null;
    lastDisconnectAgeMs: number | null;
    lastRestoreAtMs: number | null;
    lastRestoreError: string | null;
    restoreAttemptCount: number;
    restoreInFlight: boolean;
    persistence: {
      enabled: boolean;
      storePath: string | null;
      lastError: string | null;
      lastWriteAtMs: number | null;
      lastHydrateAtMs: number | null;
      lastRecoveredCorrupt: boolean;
      lastHydrateLoaded: number;
      lastHydrateSkipped: number;
      environment: ForexConnectPersistedEnvironment | null;
    };
    placesOrders: false;
    acceptsForExecution: false;
  } {
    const persistDiag = this.persistence?.getDiagnostics() ?? null;
    return {
      lifecycleState: this.providerLifecycle,
      activeSessionCount: this.sessions.size,
      intendedCount: this.intendedSubscriptions.size,
      intended: [...this.intendedSubscriptions.values()],
      lastDisconnectAtMs: this.lastDisconnectAtMs,
      lastDisconnectAgeMs: this.lastDisconnectAtMs != null
        ? Math.max(0, nowMs - this.lastDisconnectAtMs)
        : null,
      lastRestoreAtMs: this.lastRestoreAtMs,
      lastRestoreError: this.lastRestoreError,
      restoreAttemptCount: this.restoreAttemptCount,
      restoreInFlight: this.restoreInflight != null,
      persistence: {
        enabled: this.persistence != null,
        storePath: persistDiag?.storePath ?? null,
        lastError: persistDiag?.lastError
          ?? this.lastHydrateResult?.error
          ?? null,
        lastWriteAtMs: persistDiag?.lastWriteAtMs ?? null,
        lastHydrateAtMs: persistDiag?.lastHydrateAtMs ?? null,
        lastRecoveredCorrupt: Boolean(
          persistDiag?.lastRecoveredCorrupt || this.lastHydrateResult?.recoveredCorrupt,
        ),
        lastHydrateLoaded: this.lastHydrateResult?.loaded.length ?? 0,
        lastHydrateSkipped: this.lastHydrateResult?.skipped.length ?? 0,
        environment: this.persistedEnvironment ?? this.resolveActiveEnvironment(),
      },
      placesOrders: false,
      acceptsForExecution: false,
    };
  }

  listIntendedSubscriptions(): ForexConnectIntendedSubscription[] {
    return [...this.intendedSubscriptions.values()];
  }

  /**
   * Mark all active sessions non-LIVE after provider loss.
   * Does not invent quotes; readiness must re-verify genuine updates after restore.
   */
  markAllSessionsDisconnected(reason: string = "Provider session disconnected."): void {
    this.providerLifecycle = "DISCONNECTED";
    this.lastDisconnectAtMs = Date.now();
    this.lastRestoreError = null;
    for (const session of this.sessions.values()) {
      session.streamState = "DISCONNECTED";
      session.errorCode = "FOREXCONNECT_DISCONNECTED";
      session.errorMessage = reason.slice(0, 300);
      // Invalidate price-change freshness — heartbeats alone must not keep LIVE.
      session.lastPriceChangeAtMs = null;
    }
  }

  /**
   * Restore previously intended subscriptions after CONNECTED.
   * Single-flight + bounded attempts. Does not claim LIVE without genuine Offers changes.
   */
  async restoreIntendedSubscriptions(options?: {
    maxAttempts?: number;
  }): Promise<ForexConnectRestoreResult> {
    if (this.restoreInflight) return this.restoreInflight;
    const maxAttempts = Math.max(
      1,
      Math.min(
        options?.maxAttempts ?? FOREXCONNECT_RESTORE_MAX_ATTEMPTS,
        FOREXCONNECT_RESTORE_MAX_ATTEMPTS,
      ),
    );
    // Assign before awaiting so concurrent callers share one Promise identity.
    const shared = this.runRestoreIntended(maxAttempts);
    this.restoreInflight = shared;
    void shared.finally(() => {
      if (this.restoreInflight === shared) this.restoreInflight = null;
    });
    return shared;
  }

  private async runRestoreIntended(maxAttempts: number): Promise<ForexConnectRestoreResult> {
    // Drop intents that are no longer in the provider catalog (do not blind-subscribe).
    let catalogSymbols: Set<string> | null = null;
    try {
      const listed = await this.bridge.listInstruments();
      if (listed?.ok && Array.isArray(listed.instruments)) {
        catalogSymbols = new Set(
          listed.instruments
            .map((i) => String(i.providerSymbol ?? "").trim())
            .filter(Boolean),
        );
      }
    } catch {
      catalogSymbols = null;
    }
    if (catalogSymbols && catalogSymbols.size > 0) {
      for (const [key, target] of [...this.intendedSubscriptions.entries()]) {
        const upper = target.providerSymbol.toUpperCase();
        const canon = normalizeCanonicalSymbol(target.providerSymbol);
        const hit = [...catalogSymbols].some((c) => {
          const u = String(c).toUpperCase();
          return u === upper || normalizeCanonicalSymbol(String(c)) === canon;
        });
        if (!hit) {
          this.intendedSubscriptions.delete(key);
        }
      }
      await this.persistIntendedSafe();
    }

    const targets = [...this.intendedSubscriptions.values()];
    if (targets.length === 0) {
      this.providerLifecycle = "CONNECTED";
      return {
        ok: true,
        attempted: 0,
        restored: [],
        lifecycleState: this.providerLifecycle,
        placesOrders: false,
        acceptsForExecution: false,
      };
    }

    this.providerLifecycle = "RESTORING";
    this.restoreAttemptCount = 0;
    let lastBatch: ForexConnectRestoreResult["restored"] = [];

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      this.restoreAttemptCount = attempt + 1;
      if (attempt > 0) {
        const delay = RESTORE_BACKOFF_MS[Math.min(attempt - 1, RESTORE_BACKOFF_MS.length - 1)] ?? 3_000;
        await new Promise((r) => setTimeout(r, delay));
      }
      lastBatch = [];
      for (const target of targets) {
        try {
          this.providerLifecycle = "SUBSCRIBING";
          const series = await this.ensure(target.providerSymbol, target.timeframe);
          lastBatch.push({
            providerSymbol: target.providerSymbol,
            timeframe: target.timeframe,
            streamState: series.streamState,
            ok: true,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Restore ensure failed.";
          lastBatch.push({
            providerSymbol: target.providerSymbol,
            timeframe: target.timeframe,
            streamState: null,
            ok: false,
            error: message.slice(0, 200),
          });
        }
      }
      const allOk = lastBatch.every((r) => r.ok);
      if (allOk) break;
    }

    this.lastRestoreAtMs = Date.now();
    const failures = lastBatch.filter((r) => !r.ok);
    this.lastRestoreError = failures[0]?.error ?? null;
    const anyLive = lastBatch.some((r) => r.streamState === "LIVE");
    this.providerLifecycle = failures.length === lastBatch.length && lastBatch.length > 0
      ? "ERROR"
      : anyLive
        ? "LIVE"
        : "CONNECTED";

    return {
      ok: failures.length === 0,
      attempted: this.restoreAttemptCount,
      restored: lastBatch,
      lifecycleState: this.providerLifecycle,
      placesOrders: false,
      acceptsForExecution: false,
    };
  }

  /** Notify lifecycle when the provider session is confirmed CONNECTED (before restore). */
  notifyProviderConnected(): void {
    if (this.providerLifecycle === "RESTORING" || this.providerLifecycle === "SUBSCRIBING") return;
    this.providerLifecycle = this.sessions.size > 0 ? "CONNECTED" : "CONNECTED";
    this.lastRestoreError = null;
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
      // HTTP mode=live polls must drive recovery even if the background timer skipped a cycle.
      await this.pollOnce();
      const refreshed = this.sessions.get(key) ?? existing;
      return this.toSeries(refreshed);
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
    const existing = this.sessions.get(key);
    if (existing) {
      // Touch only — never accumulate refCount from repeated HTTP mode=live polls.
      existing.lastClientAtMs = Date.now();
      this.ensurePoller();
      this.ensureIdleSweeper();
      await this.pollOnce();
      return this.toSeries(existing);
    }
    const inflight = this.subscribeInflight.get(key);
    if (inflight) return inflight;

    const pending = this.createSession(symbol, timeframe, key).finally(() => {
      this.subscribeInflight.delete(key);
    });
    this.subscribeInflight.set(key, pending);
    return pending;
  }

  private async createSession(
    symbol: string,
    timeframe: ForexConnectSupportedTimeframe,
    key: string,
  ): Promise<SafeForexConnectLiveSeries> {
    // Re-check after awaiting the coalescing queue slot.
    const raced = this.sessions.get(key);
    if (raced) {
      raced.lastClientAtMs = Date.now();
      this.ensurePoller();
      this.ensureIdleSweeper();
      await this.pollOnce();
      return this.toSeries(raced);
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

    // Phase 56.3.3 — classify from Offers symbol/type; do not hardcode FOREX.
    const classified = classifyForexConnectInstrument({
      provider: "FOREXCONNECT",
      providerSymbol: hist.providerSymbol,
      canonicalSymbol: hist.canonicalSymbol,
      displaySymbol: hist.displaySymbol,
      marketType: hist.marketType ?? "FOREX",
      baseAsset: null,
      quoteAsset: null,
      status: "available",
    });
    const marketType: MarketAssetType = classified.marketType;

    const identity = {
      marketType,
      providerSymbol: hist.providerSymbol,
      canonicalSymbol: hist.canonicalSymbol,
      timeframe,
    };
    const candles = hist.candles.map((c) => historicalToFcLiveCandle(c, identity));
    const now = Date.now();

    const session: Session = {
      key,
      symbol,
      timeframe,
      providerSymbol: hist.providerSymbol,
      canonicalSymbol: hist.canonicalSymbol,
      displaySymbol: hist.displaySymbol,
      marketType,
      refCount: 1,
      candles,
      lastQuote: null,
      lastQuoteAtMs: null,
      lastPriceChangeAtMs: null,
      lastClientAtMs: now,
      updateCount: 0,
      streamState: "SUBSCRIBED_WAITING",
      errorCode: null,
      errorMessage: null,
      bootstrapped: true,
    };
    this.sessions.set(key, session);
    await this.rememberIntended(hist.providerSymbol, timeframe);
    this.providerLifecycle = "SUBSCRIBING";
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
    await this.forgetIntended(session.providerSymbol, session.timeframe);
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

  private async releaseSession(session: Session, options?: { keepIntended?: boolean }): Promise<void> {
    this.sessions.delete(session.key);
    if (!options?.keepIntended) {
      await this.forgetIntended(session.providerSymbol, session.timeframe);
    }
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
      if (this.intendedSubscriptions.size === 0) {
        this.providerLifecycle = "DISCONNECTED";
      }
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
   * Phase 56.2.8 — active live sessions only (no catalog invention).
   * Used for per-instrument readiness without implying peer LIVE status.
   */
  listActiveQuoteSessions(nowMs: number = Date.now()): Array<{
    providerSymbol: string;
    canonicalSymbol: string;
    displaySymbol: string;
    timeframe: ForexConnectSupportedTimeframe;
    streamState: ForexConnectLiveStreamState;
    bid: number | null;
    ask: number | null;
    updateCount: number;
    priceChangeAgeMs: number | null;
    receiptAgeMs: number | null;
    /** Phase 56.3.1 — sidecar Offers origin; null on seeded snapshots. */
    eventSource: string | null;
    lastPriceChangeAtMs: number | null;
    lastReceiptAtMs: number | null;
  }> {
    const out: Array<{
      providerSymbol: string;
      canonicalSymbol: string;
      displaySymbol: string;
      timeframe: ForexConnectSupportedTimeframe;
      streamState: ForexConnectLiveStreamState;
      bid: number | null;
      ask: number | null;
      updateCount: number;
      priceChangeAgeMs: number | null;
      receiptAgeMs: number | null;
      eventSource: string | null;
      lastPriceChangeAtMs: number | null;
      lastReceiptAtMs: number | null;
    }> = [];
    for (const session of this.sessions.values()) {
      const series = this.toSeries(session);
      out.push({
        providerSymbol: session.providerSymbol,
        canonicalSymbol: session.canonicalSymbol,
        displaySymbol: session.displaySymbol,
        timeframe: session.timeframe,
        streamState: series.streamState,
        bid: session.lastQuote?.bid ?? null,
        ask: session.lastQuote?.ask ?? null,
        updateCount: session.updateCount,
        priceChangeAgeMs: session.lastPriceChangeAtMs != null
          ? Math.max(0, nowMs - session.lastPriceChangeAtMs)
          : null,
        receiptAgeMs: session.lastQuoteAtMs != null
          ? Math.max(0, nowMs - session.lastQuoteAtMs)
          : null,
        eventSource: session.lastQuote?.eventSource ?? null,
        lastPriceChangeAtMs: session.lastPriceChangeAtMs,
        lastReceiptAtMs: session.lastQuoteAtMs,
      });
    }
    return out;
  }

  /**
   * Quote + per-session freshness. Seeds may populate quote without LIVE streamState.
   * Callers must not treat a non-null quote as LIVE without checking streamState.
   */
  getLatestQuoteState(symbol: string): {
    quote: ForexConnectLiveQuote;
    streamState: ForexConnectLiveStreamState;
    /** Last Offers receipt (includes same-price heartbeats). */
    lastQuoteAtMs: number | null;
    /** Last genuine bid/ask change — null until a price change is applied. */
    lastPriceChangeAtMs: number | null;
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
          lastPriceChangeAtMs: session.lastPriceChangeAtMs,
          updateCount: session.updateCount,
        };
      }
    }
    return null;
  }

  async getStreamStatus(): Promise<ForexConnectStreamStatus> {
    return this.bridge.getStreamStatus();
  }

  /**
   * Drop all active live sessions.
   * - Default: preserve intended subscriptions (same-env disconnect → restore later).
   * - clearIntended=true: DEMO↔LIVE switch — do not restore across environments.
   */
  async clearAllSessions(options?: { clearIntended?: boolean }): Promise<void> {
    this.markAllSessionsDisconnected(
      options?.clearIntended
        ? "Environment switch cleared live sessions."
        : "Provider disconnect cleared live sessions.",
    );
    for (const session of this.sessions.values()) {
      if (!options?.clearIntended) {
        await this.rememberIntended(session.providerSymbol, session.timeframe);
      }
    }
    const symbols = [...new Set([...this.sessions.values()].map((s) => s.providerSymbol))];
    this.sessions.clear();
    this.stopPoller();
    this.stopIdleSweeper();
    if (options?.clearIntended) {
      this.intendedSubscriptions.clear();
      this.restoreAttemptCount = 0;
      if (this.persistence) {
        try {
          await this.persistence.clear();
        } catch {
          /* fail-safe */
        }
      }
    } else {
      await this.persistIntendedSafe();
    }
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
    if (this.sessions.size === 0) return;
    if (this.pollPromise) return this.pollPromise;
    this.pollPromise = this.runPollCycle().finally(() => {
      this.pollPromise = null;
    });
    return this.pollPromise;
  }

  private async runPollCycle(): Promise<void> {
    if (this.pollInFlight || this.sessions.size === 0) return;
    this.pollInFlight = true;
    try {
      const [quotes, stream] = await Promise.all([
        this.bridge.pollQuotes(),
        this.bridge.getStreamStatus(),
      ]);
      this.lastStreamStatus = stream;
      const now = Date.now();
      const sessionStatus = String(stream.sessionStatus ?? "").toUpperCase();
      const streamStateRaw = String(stream.streamState ?? "").toUpperCase();
      // Phase 56.3.3 — invalidate LIVE immediately when the provider session is gone.
      if (
        sessionStatus === "DISCONNECTED"
        || sessionStatus === "ERROR"
        || streamStateRaw === "DISCONNECTED"
      ) {
        this.markAllSessionsDisconnected(
          `Provider stream reported ${sessionStatus || streamStateRaw} during poll.`,
        );
        return;
      }
      const streamUpdates = Number(stream.updateCount ?? 0);
      // Track global Offers activity for diagnostics only — never gate per-instrument LIVE on it.
      if (streamUpdates > this.lastSeenStreamUpdateCount) {
        this.lastSeenStreamUpdateCount = streamUpdates;
      }

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
            session.streamState = resolveFcWaitingStreamState(stream.streamState, session.updateCount);
          }
          continue;
        }

        const prevQuote = session.lastQuote;
        if (session.lastQuote == null) session.lastQuote = match;

        const genuineEvent = isGenuineFcOfferEventSource(match.eventSource);
        const quoteAdvanced = session.lastQuoteAtMs == null
          || match.receivedAtMs > session.lastQuoteAtMs;
        const quoteFresh = Number.isFinite(match.receivedAtMs)
          && (now - match.receivedAtMs) <= FOREXCONNECT_STALE_MS;
        const priceChanged = prevQuote == null
          || prevQuote.bid !== match.bid
          || prevQuote.ask !== match.ask
          || prevQuote.candlePrice !== match.candlePrice;

        // Instrument-specific LIVE: genuine Offers bid/ask change for THIS symbol with a newer receipt.
        // Peer global updateCount must not promote a seeded AUD/CNH snapshot to LIVE.
        // LIVE requires a recent bid/ask change — same-price heartbeats are not LIVE.
        if (genuineEvent && quoteAdvanced && match.candlePrice != null) {
          const eventTimeMs = match.sourceTimestampMs ?? match.receivedAtMs;
          if (priceChanged) {
            const applied = applyFcBidPriceToCandles(
              session.candles,
              match.candlePrice,
              eventTimeMs,
              {
                marketType: session.marketType,
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
            session.lastPriceChangeAtMs = match.receivedAtMs;
            session.updateCount += 1;
          }
          session.lastQuote = match;
          session.lastQuoteAtMs = match.receivedAtMs;
          session.streamState = resolveFcFeedStreamState({
            priceChangeAgeMs: session.lastPriceChangeAtMs == null
              ? null
              : now - session.lastPriceChangeAtMs,
            receiptAgeMs: now - match.receivedAtMs,
            updateCount: session.updateCount,
          });
          session.errorCode = null;
          session.errorMessage = null;
          continue;
        }

        if (genuineEvent && session.lastQuoteAtMs != null && quoteFresh) {
          session.lastQuote = match;
          session.streamState = resolveFcFeedStreamState({
            priceChangeAgeMs: session.lastPriceChangeAtMs == null
              ? null
              : now - session.lastPriceChangeAtMs,
            receiptAgeMs: now - match.receivedAtMs,
            updateCount: session.updateCount,
          });
          session.errorCode = null;
          session.errorMessage = null;
          continue;
        }

        if (
          session.lastQuoteAtMs != null
          && now - session.lastQuoteAtMs > FOREXCONNECT_STALE_MS
          && (
            session.updateCount > 0
            || session.streamState === "LIVE"
            || session.streamState === "STALE"
            || session.streamState === "NO_RECENT_MARKET_UPDATES"
          )
        ) {
          session.streamState = "STALE";
          continue;
        }

        if (session.updateCount <= 0) {
          // Peers may be LIVE while this instrument only has a seeded Offers snapshot.
          if (
            (stream.streamState === "LIVE" || stream.streamState === "NO_RECENT_MARKET_UPDATES")
            && streamUpdates > 0
            && !genuineEvent
          ) {
            session.streamState = "MARKET_INACTIVE";
          } else {
            session.streamState = resolveFcWaitingStreamState(stream.streamState, session.updateCount);
          }
        }
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
    // Phase 56.3.5 — provider-loss / hard-error states are sticky until reconnect restore.
    // Do not re-promote DISCONNECTED → NO_RECENT_MARKET_UPDATES via residual receipt age.
    const hardState =
      session.streamState === "DISCONNECTED"
      || session.streamState === "ERROR"
      || session.streamState === "SERVICE_UNAVAILABLE"
      || session.streamState === "DISABLED";
    // Preserve instrument MARKET_INACTIVE (seeded while peers LIVE). Do not collapse to
    // SUBSCRIBED_WAITING via resolveFcWaitingStreamState("LIVE", 0).
    if (
      !hardState
      && session.updateCount <= 0
      && this.lastStreamStatus
      && session.streamState !== "MARKET_INACTIVE"
    ) {
      streamState = resolveFcWaitingStreamState(this.lastStreamStatus.streamState, session.updateCount);
    }
    const receiptAgeMs = session.lastQuoteAtMs != null
      ? Math.max(0, now - session.lastQuoteAtMs)
      : null;
    const priceChangeAgeMs = session.lastPriceChangeAtMs != null
      ? Math.max(0, now - session.lastPriceChangeAtMs)
      : null;
    if (!hardState && (session.updateCount > 0 || session.lastQuoteAtMs != null)) {
      streamState = resolveFcFeedStreamState({
        priceChangeAgeMs,
        receiptAgeMs,
        updateCount: session.updateCount,
      });
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
    // Instrument-specific freshness only — never inherit peer/global sidecar lastQuoteAt.
    // lastQuoteAt / age reflect last bid/ask change when available; else last receipt.
    const lastQuoteAt = session.lastPriceChangeAtMs != null
      ? new Date(session.lastPriceChangeAtMs).toISOString()
      : session.lastQuoteAtMs != null
        ? new Date(session.lastQuoteAtMs).toISOString()
        : null;
    const lastQuoteAgeMs = priceChangeAgeMs ?? receiptAgeMs;
    const diagNote = diag
      ? ` pollCycles=${diag.pollCycles} pollChanges=${diag.pollChanges} instrumentUpdates=${session.updateCount} sidecarUpdates=${sidecarUpdateCount}`
      : ` instrumentUpdates=${session.updateCount} sidecarUpdates=${sidecarUpdateCount}`;
    const note = streamState === "LIVE"
      ? `ForexConnect live bid candles (Offers table updates + historical baseline).${diagNote}`
      : streamState === "NO_RECENT_MARKET_UPDATES"
        ? `ForexConnect Offers active; no recent bid/ask changes for this instrument.${diagNote}`
        : streamState === "MARKET_INACTIVE"
          ? `ForexConnect Offers subscribed; this instrument has no fresh Offers events (peers may still be live).${diagNote}`
          : streamState === "STALE"
            ? `ForexConnect Offers feed stale for this instrument.${diagNote}`
            : `ForexConnect subscribed; waiting for Offers table price updates for this instrument.${diagNote}`;
    return {
      ok: true,
      provider: "FOREXCONNECT",
      marketType: session.marketType,
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
  // Production path — durable intended subscriptions under data/forexconnect/.
  singleton ??= new ForexConnectLiveCandleService({
    persistence: new ForexConnectIntendedSubscriptionsStore(),
  });
  return singleton;
}

export function createForexConnectLiveCandleService(options?: {
  bridge?: ForexConnectBridge;
  persistence?: ForexConnectIntendedSubscriptionsStore | null;
}): ForexConnectLiveCandleService {
  return new ForexConnectLiveCandleService(options);
}

export function resetForexConnectLiveCandleServiceForTests(): void {
  singleton = null;
}

export { normalizeFcOfferQuote };
