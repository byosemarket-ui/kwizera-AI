/**
 * Phase 29 — FXCM real-time quote streaming service.
 *
 * Flow:
 *   Auth/config → persistent Engine.IO session → POST /subscribe(pairs)
 *   → Socket.IO symbol events → normalize/validate → quote store
 *
 * Does NOT construct live candles, indicators, AI ticks, or trading.
 */
import {
  FXCM_MAX_STREAM_SUBSCRIPTIONS,
  FXCM_STREAM_RECONNECT_BASE_MS,
  FXCM_STREAM_RECONNECT_MAX_MS,
  resolveFxcmConfig,
  type FxcmConfig,
} from "./config.js";
import {
  fxcmSubscribeMarketData,
  fxcmUnsubscribeMarketData,
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
  assertSafeStreamPayload,
  isOutOfOrderQuote,
  normalizeFxcmPriceUpdate,
  normalizeFxcmSourceTimestampMs,
  parseFxcmPriceUpdatePayload,
} from "./stream-normalize.js";
import {
  createFxcmSocketTransport,
  type FakeFxcmTransportController,
  type FxcmSocketTransport,
} from "./stream-transport.js";
import {
  subscriptionKey,
  type FxcmMarketQuoteEvent,
  type FxcmStreamMetrics,
  type FxcmStreamState,
  type FxcmSubscriptionRecord,
  type FxcmSubscriptionState,
  type SafeFxcmQuoteSnapshot,
  type SafeFxcmStreamStatus,
} from "./stream-types.js";

export type FxcmQuoteListener = (event: FxcmMarketQuoteEvent) => void;

export interface FxcmStreamServiceOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  nowMs?: () => number;
  sleep?: (ms: number) => Promise<void>;
  auth?: FxcmAuthenticationService;
  discovery?: FxcmInstrumentDiscoveryService;
  transportFactory?: (opts: {
    config: FxcmConfig;
    env: Record<string, string | undefined>;
    fetchImpl?: FetchLike;
    nowMs: () => number;
  }) => FxcmSocketTransport;
  fakeTransport?: FakeFxcmTransportController;
  /** Disable automatic reconnect (tests). */
  autoReconnect?: boolean;
}

interface InternalSubscription extends FxcmSubscriptionRecord {
  lastSourceMs: number | null;
  lastReceivedMs: number | null;
  latestQuote: FxcmMarketQuoteEvent | null;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}

export class FxcmRealtimeStreamService {
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl?: FetchLike;
  private readonly nowMs: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly auth: FxcmAuthenticationService;
  private readonly discovery: FxcmInstrumentDiscoveryService;
  private readonly transportFactory: FxcmStreamServiceOptions["transportFactory"];
  private readonly fakeTransport?: FakeFxcmTransportController;
  private readonly autoReconnect: boolean;

  private config: FxcmConfig;
  private transport: FxcmSocketTransport | null = null;
  private streamState: FxcmStreamState = "DISABLED";
  private connectedAt: string | null = null;
  private lastEventAt: string | null = null;
  private lastSourceTimestamp: string | null = null;
  private lastLatencyMs: number | null = null;
  private eventsReceived = 0;
  private invalidEvents = 0;
  private reconnectCount = 0;
  private lastErrorCode: string | null = null;
  private lastErrorMessage: string | null = null;
  private subscriptions = new Map<string, InternalSubscription>();
  private listeners = new Set<FxcmQuoteListener>();
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private closed = false;
  private ensureInflight: Promise<void> | null = null;
  private subscribeInflight = new Map<string, Promise<FxcmSubscriptionRecord>>();

  constructor(options: FxcmStreamServiceOptions = {}) {
    this.env = options.env ?? (process.env as Record<string, string | undefined>);
    this.fetchImpl = options.fetchImpl;
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.sleep = options.sleep ?? defaultSleep;
    this.auth = options.auth ?? createFxcmAuthenticationService({
      env: this.env,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
      sleep: this.sleep,
    });
    this.discovery = options.discovery ?? createFxcmInstrumentDiscoveryService({
      env: this.env,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
      auth: this.auth,
    });
    this.transportFactory = options.transportFactory;
    this.fakeTransport = options.fakeTransport;
    this.autoReconnect = options.autoReconnect !== false;
    this.config = resolveFxcmConfig(this.env);
    this.streamState = this.initialState();
  }

  private initialState(): FxcmStreamState {
    if (!this.config.enabled) return "DISABLED";
    if (!this.config.accessTokenConfigured) return "NOT_CONFIGURED";
    return "DISCONNECTED";
  }

  getConfig(): FxcmConfig {
    return this.config;
  }

  getStreamState(): FxcmStreamState {
    this.refreshStaleState();
    return this.streamState;
  }

  onQuote(listener: FxcmQuoteListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getMetrics(): FxcmStreamMetrics {
    this.refreshStaleState();
    return {
      provider: "FXCM",
      environment: this.config.environment,
      environmentLabel: this.config.environmentLabel,
      streamState: this.streamState,
      connectedAt: this.connectedAt,
      lastEventAt: this.lastEventAt,
      lastSourceTimestamp: this.lastSourceTimestamp,
      eventsReceived: this.eventsReceived,
      invalidEvents: this.invalidEvents,
      reconnectCount: this.reconnectCount,
      subscriptionCount: [...this.subscriptions.values()].filter((s) =>
        s.state === "SUBSCRIBED" || s.state === "SUBSCRIBING"
      ).length,
      latencyMs: this.lastLatencyMs,
      quoteStaleMs: this.config.quoteStaleMs,
      notes: [
        "Phase 29 real-time quotes only — live candles not enabled.",
        "Trading: DISABLED.",
        `Environment: ${this.config.environmentLabel}`,
        "CONNECTED ≠ LIVE; LIVE requires a recent valid market event.",
      ],
    };
  }

  getSafeStatus(): SafeFxcmStreamStatus {
    const auth = this.auth.getSafeStatus();
    const metrics = this.getMetrics();
    const liveStream =
      !this.config.enabled ? "DISABLED"
        : !this.config.accessTokenConfigured ? "NOT_CONFIGURED"
          : "ENABLED";
    return {
      provider: "FXCM",
      environment: this.config.environment,
      environmentLabel: this.config.environmentLabel,
      stream: metrics,
      subscriptions: this.listSubscriptions(),
      quotes: this.listQuotes(),
      authenticationState: auth.authentication.state,
      marketData: this.streamState === "DISABLED" || this.streamState === "NOT_CONFIGURED"
        ? "DISABLED"
        : this.subscriptions.size > 0 || this.streamState === "LIVE" || this.streamState === "CONNECTED"
          ? "STREAMING"
          : "NOT_STARTED",
      liveStream,
      trading: "DISABLED",
      mode: "REALTIME_QUOTE",
      note: "FXCM real-time quotes (Phase 29). Not live candles. Not trading.",
      errorCode: this.lastErrorCode,
      errorMessage: this.lastErrorMessage,
    };
  }

  listSubscriptions(): FxcmSubscriptionRecord[] {
    return [...this.subscriptions.values()].map((s) => ({
      key: s.key,
      provider: "FXCM",
      marketType: s.marketType,
      providerSymbol: s.providerSymbol,
      canonicalSymbol: s.canonicalSymbol,
      displaySymbol: s.displaySymbol,
      state: s.state,
      subscribedAt: s.subscribedAt,
      lastEventAt: s.lastEventAt,
      lastSourceTimestamp: s.lastSourceTimestamp,
      eventsReceived: s.eventsReceived,
      invalidEvents: s.invalidEvents,
      lastErrorCode: s.lastErrorCode,
      lastErrorMessage: s.lastErrorMessage,
    }));
  }

  listQuotes(): SafeFxcmQuoteSnapshot[] {
    this.refreshStaleState();
    const out: SafeFxcmQuoteSnapshot[] = [];
    for (const sub of this.subscriptions.values()) {
      const q = sub.latestQuote;
      const state = this.quoteStateFor(sub);
      out.push({
        provider: "FXCM",
        marketType: sub.marketType,
        providerSymbol: sub.providerSymbol,
        canonicalSymbol: sub.canonicalSymbol,
        displaySymbol: sub.displaySymbol,
        bid: q?.valid ? q.bid : null,
        ask: q?.valid ? q.ask : null,
        mid: q?.valid ? q.mid : null,
        last: null,
        sessionHigh: q?.valid ? q.sessionHigh : null,
        sessionLow: q?.valid ? q.sessionLow : null,
        sourceTimestamp: q?.valid ? q.sourceTimestamp : null,
        receivedAt: q?.receivedAt ?? null,
        latencyMs: q?.valid ? q.latencyMs : null,
        state,
        dataQuality: q?.valid
          ? (state === "STALE" ? "STALE" : "LIVE")
          : q ? "INVALID" : "NO_DATA",
        subscriptionState: sub.state,
        eventsReceived: sub.eventsReceived,
      });
    }
    return out;
  }

  getQuote(symbol: string): SafeFxcmQuoteSnapshot | null {
    const resolved = this.findSubscription(symbol);
    if (!resolved) return null;
    return this.listQuotes().find((q) =>
      q.providerSymbol === resolved.providerSymbol
      && q.marketType === resolved.marketType
    ) ?? null;
  }

  private findSubscription(symbol: string): InternalSubscription | null {
    const raw = String(symbol ?? "").trim();
    if (!raw) return null;
    for (const sub of this.subscriptions.values()) {
      if (
        sub.providerSymbol === raw
        || sub.canonicalSymbol === raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
        || sub.displaySymbol === raw
        || sub.key === raw
      ) {
        return sub;
      }
    }
    return null;
  }

  private quoteStateFor(sub: InternalSubscription): FxcmStreamState {
    if (this.streamState === "DISABLED" || this.streamState === "NOT_CONFIGURED") return this.streamState;
    if (this.streamState === "AUTHENTICATION_ERROR" || this.streamState === "NETWORK_ERROR" || this.streamState === "ERROR") {
      return this.streamState;
    }
    if (this.streamState === "RECONNECTING" || this.streamState === "CONNECTING") return this.streamState;
    if (this.streamState === "DISCONNECTED") return "DISCONNECTED";
    if (sub.state !== "SUBSCRIBED") {
      if (sub.state === "FAILED") return "ERROR";
      if (sub.state === "SUBSCRIBING") return "CONNECTING";
      return "NO_DATA";
    }
    if (!sub.latestQuote?.valid) return "NO_DATA";
    const age = sub.lastReceivedMs != null ? this.nowMs() - sub.lastReceivedMs : Number.POSITIVE_INFINITY;
    if (age > this.config.quoteStaleMs) return "STALE";
    return "LIVE";
  }

  private refreshStaleState(): void {
    if (
      this.streamState !== "LIVE"
      && this.streamState !== "STALE"
      && this.streamState !== "CONNECTED"
      && this.streamState !== "NO_DATA"
    ) {
      return;
    }
    const subscribed = [...this.subscriptions.values()].filter((s) => s.state === "SUBSCRIBED");
    if (subscribed.length === 0) {
      if (this.transport?.isConnected()) this.streamState = "CONNECTED";
      return;
    }
    const anyLive = subscribed.some((s) => {
      if (!s.latestQuote?.valid || s.lastReceivedMs == null) return false;
      return this.nowMs() - s.lastReceivedMs <= this.config.quoteStaleMs;
    });
    const anyData = subscribed.some((s) => s.latestQuote?.valid);
    if (anyLive) {
      this.streamState = "LIVE";
    } else if (anyData) {
      this.streamState = "STALE";
    } else if (this.transport?.isConnected()) {
      this.streamState = "CONNECTED";
    }
  }

  async ensureConnected(): Promise<void> {
    if (this.closed) return;
    if (this.ensureInflight) return this.ensureInflight;
    this.ensureInflight = this.connectInternal().finally(() => {
      this.ensureInflight = null;
    });
    return this.ensureInflight;
  }

  private async connectInternal(): Promise<void> {
    this.config = resolveFxcmConfig(this.env);
    if (!this.config.enabled) {
      this.streamState = "DISABLED";
      return;
    }
    if (!this.config.accessTokenConfigured) {
      this.streamState = "NOT_CONFIGURED";
      return;
    }
    if (this.transport?.isConnected()) return;

    this.clearReconnectTimer();
    this.streamState = this.reconnectCount > 0 ? "RECONNECTING" : "CONNECTING";
    try {
      // Keep Phase 26 auth lifecycle aware (does not replace stream socket).
      await this.auth.authenticate();
      this.transport?.disconnect();
      this.transport = this.createTransport();
      this.transport.onEvent((name, data) => this.handleTransportEvent(name, data));
      this.transport.onState((state, detail) => this.handleTransportState(state, detail));
      await this.transport.connect();
      this.connectedAt = new Date(this.nowMs()).toISOString();
      this.streamState = "CONNECTED";
      this.lastErrorCode = null;
      this.lastErrorMessage = null;
      this.reconnectAttempt = 0;
      this.startStaleTimer();
      await this.restoreSubscriptions();
    } catch (error) {
      const mapped = userFacingFxcmError(error);
      this.lastErrorCode = mapped.code;
      this.lastErrorMessage = mapped.message;
      if (mapped.code === "FXCM_AUTHENTICATION_FAILED" || mapped.code === "FXCM_NOT_CONFIGURED") {
        this.streamState = mapped.code === "FXCM_NOT_CONFIGURED" ? "NOT_CONFIGURED" : "AUTHENTICATION_ERROR";
        this.auth.clearSession("expired");
      } else if (mapped.code === "FXCM_NETWORK" || mapped.code === "FXCM_TIMEOUT" || mapped.code === "FXCM_CONNECTION_FAILED") {
        this.streamState = "NETWORK_ERROR";
      } else if (mapped.code === "FXCM_DISABLED") {
        this.streamState = "DISABLED";
      } else {
        this.streamState = "ERROR";
      }
      this.scheduleReconnect();
      throw error;
    }
  }

  private createTransport(): FxcmSocketTransport {
    const base = {
      config: this.config,
      env: this.env,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
      fake: this.fakeTransport,
    };
    if (this.transportFactory) {
      return this.transportFactory(base);
    }
    return createFxcmSocketTransport(base);
  }

  private handleTransportState(
    state: "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR",
    detail?: string,
  ): void {
    if (this.closed) return;
    if (state === "CONNECTED") {
      this.connectedAt = new Date(this.nowMs()).toISOString();
      if (this.streamState !== "LIVE" && this.streamState !== "STALE") {
        this.streamState = "CONNECTED";
      }
      return;
    }
    if (state === "CONNECTING") {
      this.streamState = this.reconnectCount > 0 ? "RECONNECTING" : "CONNECTING";
      return;
    }
    if (state === "DISCONNECTED" || state === "ERROR") {
      if (detail) {
        this.lastErrorMessage = detail;
      }
      this.streamState = state === "ERROR" ? "NETWORK_ERROR" : "DISCONNECTED";
      for (const sub of this.subscriptions.values()) {
        if (sub.state === "SUBSCRIBED") {
          // Provider may drop subscriptions on disconnect — mark for restore.
          sub.state = "NOT_SUBSCRIBED";
        }
      }
      this.scheduleReconnect();
    }
  }

  private handleTransportEvent(eventName: string, data: unknown): void {
    const sub = [...this.subscriptions.values()].find((s) => s.providerSymbol === eventName);
    if (!sub || (sub.state !== "SUBSCRIBED" && sub.state !== "SUBSCRIBING")) {
      return;
    }

    const receivedAtMs = this.nowMs();
    const parsed = parseFxcmPriceUpdatePayload(data);
    const incomingSourceMs = normalizeFxcmSourceTimestampMs(parsed?.Updated);
    if (isOutOfOrderQuote(incomingSourceMs, sub.lastSourceMs)) {
      // Do not overwrite newer accepted quote; count as received but skip apply.
      this.eventsReceived += 1;
      sub.eventsReceived += 1;
      console.info("[fxcm-stream] out-of-order event ignored", JSON.stringify({
        providerSymbol: sub.providerSymbol,
        reason: "older_than_current_source",
      }));
      return;
    }

    const event = normalizeFxcmPriceUpdate(data, {
      providerSymbol: sub.providerSymbol,
      canonicalSymbol: sub.canonicalSymbol,
      displaySymbol: sub.displaySymbol,
      marketType: sub.marketType,
      receivedAtMs,
      connectionState: "LIVE",
    });

    this.eventsReceived += 1;
    sub.eventsReceived += 1;
    this.lastEventAt = event.receivedAt;

    if (!event.valid) {
      this.invalidEvents += 1;
      sub.invalidEvents += 1;
      console.info("[fxcm-stream] invalid quote", JSON.stringify({
        providerSymbol: sub.providerSymbol,
        reason: event.invalidReason,
      }));
      return;
    }

    sub.latestQuote = event;
    sub.lastEventAt = event.receivedAt;
    sub.lastSourceTimestamp = event.sourceTimestamp;
    sub.lastSourceMs = incomingSourceMs;
    sub.lastReceivedMs = receivedAtMs;
    sub.state = "SUBSCRIBED";
    this.lastSourceTimestamp = event.sourceTimestamp;
    this.lastLatencyMs = event.latencyMs;
    this.streamState = "LIVE";
    this.lastErrorCode = null;
    this.lastErrorMessage = null;

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // consumer errors must not break the stream
      }
    }
  }

  /**
   * Subscribe using Phase 27 validated mapping.
   * Duplicate providerSymbol subscriptions are no-ops.
   */
  async subscribe(symbol: string): Promise<FxcmSubscriptionRecord> {
    if (this.closed) {
      throw new FxcmMarketDataError("FXCM_UNAVAILABLE", "FXCM stream service is closed.");
    }
    this.config = resolveFxcmConfig(this.env);
    if (!this.config.enabled) {
      throw new FxcmMarketDataError("FXCM_DISABLED", "FXCM market data is disabled.");
    }
    if (!this.config.accessTokenConfigured) {
      throw new FxcmMarketDataError("FXCM_NOT_CONFIGURED", "FXCM access token is not configured.");
    }

    const raw = String(symbol ?? "").trim();
    if (!raw) {
      throw new FxcmMarketDataError("FXCM_INVALID_SYMBOL", "Symbol is required.");
    }

    const existing = this.findSubscription(raw);
    if (existing && (existing.state === "SUBSCRIBED" || existing.state === "SUBSCRIBING")) {
      return this.listSubscriptions().find((s) => s.key === existing.key)!;
    }

    const inflight = this.subscribeInflight.get(raw);
    if (inflight) return inflight;

    const work = this.subscribeInternal(raw).finally(() => {
      this.subscribeInflight.delete(raw);
    });
    this.subscribeInflight.set(raw, work);
    return work;
  }

  private async subscribeInternal(raw: string): Promise<FxcmSubscriptionRecord> {
    const discovery = await this.discovery.discover({ refresh: false });
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

    const key = subscriptionKey(inst.providerSymbol, inst.marketType);
    const activeCount = [...this.subscriptions.values()].filter((s) =>
      s.state === "SUBSCRIBED" || s.state === "SUBSCRIBING"
    ).length;
    if (activeCount >= FXCM_MAX_STREAM_SUBSCRIPTIONS && !this.subscriptions.has(key)) {
      throw new FxcmMarketDataError(
        "FXCM_RATE_LIMITED",
        `FXCM subscription limit reached (${FXCM_MAX_STREAM_SUBSCRIPTIONS}).`,
      );
    }

    const record: InternalSubscription = this.subscriptions.get(key) ?? {
      key,
      provider: "FXCM",
      marketType: inst.marketType,
      providerSymbol: inst.providerSymbol,
      canonicalSymbol: inst.canonicalSymbol,
      displaySymbol: inst.displaySymbol,
      state: "NOT_SUBSCRIBED",
      subscribedAt: null,
      lastEventAt: null,
      lastSourceTimestamp: null,
      eventsReceived: 0,
      invalidEvents: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastSourceMs: null,
      lastReceivedMs: null,
      latestQuote: null,
    };
    record.state = "SUBSCRIBING";
    this.subscriptions.set(key, record);

    try {
      await this.ensureConnected();
      const session = this.transport?.getSession();
      if (!session) {
        throw new FxcmMarketDataError("FXCM_CONNECTION_FAILED", "FXCM stream session missing.");
      }
      this.transport?.watchEvent(inst.providerSymbol);
      const response = await fxcmSubscribeMarketData(
        this.config,
        session,
        inst.providerSymbol,
        { fetchImpl: this.fetchImpl },
      );

      // Subscribe HTTP response may include an initial pairs snapshot — normalize if present.
      const pairs = (response as { pairs?: unknown }).pairs;
      if (pairs != null) {
        this.handleTransportEvent(inst.providerSymbol, pairs);
      }

      record.state = "SUBSCRIBED";
      record.subscribedAt = new Date(this.nowMs()).toISOString();
      record.lastErrorCode = null;
      record.lastErrorMessage = null;
      this.subscriptions.set(key, record);
      // LIVE only after a valid event; until then CONNECTED/NO_DATA.
      if (this.streamState !== "LIVE" && this.streamState !== "STALE") {
        this.streamState = record.latestQuote?.valid ? "LIVE" : "CONNECTED";
      }
      return this.listSubscriptions().find((s) => s.key === key)!;
    } catch (error) {
      const mapped = userFacingFxcmError(error);
      record.state = "FAILED";
      record.lastErrorCode = mapped.code;
      record.lastErrorMessage = mapped.message;
      this.subscriptions.set(key, record);
      this.lastErrorCode = mapped.code;
      this.lastErrorMessage = mapped.message;
      if (mapped.code === "FXCM_AUTHENTICATION_FAILED") {
        this.streamState = "AUTHENTICATION_ERROR";
        this.auth.clearSession("expired");
        this.transport?.disconnect();
        this.scheduleReconnect();
      }
      throw error instanceof FxcmMarketDataError
        ? error
        : new FxcmMarketDataError(mapped.code, mapped.message);
    }
  }

  async unsubscribe(symbol: string): Promise<void> {
    const sub = this.findSubscription(symbol);
    if (!sub) return;
    if (sub.state === "NOT_SUBSCRIBED") {
      this.subscriptions.delete(sub.key);
      return;
    }
    sub.state = "UNSUBSCRIBING";
    try {
      const session = this.transport?.getSession();
      if (session && this.transport?.isConnected()) {
        await fxcmUnsubscribeMarketData(
          this.config,
          session,
          sub.providerSymbol,
          { fetchImpl: this.fetchImpl },
        );
      }
    } catch {
      // Best-effort unsubscribe — always clear local state.
    }
    this.transport?.unwatchEvent(sub.providerSymbol);
    this.subscriptions.delete(sub.key);
    this.refreshStaleState();
  }

  private async restoreSubscriptions(): Promise<void> {
    const needed = [...this.subscriptions.values()].filter((s) =>
      s.state === "NOT_SUBSCRIBED" || s.state === "FAILED" || s.state === "SUBSCRIBING"
    );
    // Also restore previously subscribed instruments after reconnect.
    const previously = [...this.subscriptions.values()].filter((s) =>
      s.subscribedAt != null && s.state !== "UNSUBSCRIBING"
    );
    const targets = new Map<string, InternalSubscription>();
    for (const s of [...needed, ...previously]) targets.set(s.key, s);

    for (const sub of targets.values()) {
      try {
        sub.state = "SUBSCRIBING";
        const session = this.transport?.getSession();
        if (!session) continue;
        this.transport?.watchEvent(sub.providerSymbol);
        await fxcmSubscribeMarketData(
          this.config,
          session,
          sub.providerSymbol,
          { fetchImpl: this.fetchImpl },
        );
        sub.state = "SUBSCRIBED";
        sub.subscribedAt = sub.subscribedAt ?? new Date(this.nowMs()).toISOString();
        sub.lastErrorCode = null;
        sub.lastErrorMessage = null;
      } catch (error) {
        const mapped = userFacingFxcmError(error);
        sub.state = "FAILED";
        sub.lastErrorCode = mapped.code;
        sub.lastErrorMessage = mapped.message;
      }
    }
  }

  private scheduleReconnect(): void {
    if (!this.autoReconnect || this.closed) return;
    if (this.streamState === "DISABLED" || this.streamState === "NOT_CONFIGURED") return;
    if (this.reconnectTimer) return;
    const attempt = this.reconnectAttempt;
    const delay = Math.min(
      FXCM_STREAM_RECONNECT_BASE_MS * (2 ** Math.min(attempt, 5)),
      FXCM_STREAM_RECONNECT_MAX_MS,
    );
    this.reconnectAttempt += 1;
    this.reconnectCount += 1;
    this.streamState = "RECONNECTING";
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.ensureConnected().catch(() => {
        // ensureConnected schedules next attempt on failure
      });
    }, delay);
    this.reconnectTimer.unref?.();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startStaleTimer(): void {
    if (this.staleTimer) return;
    const interval = Math.max(1_000, Math.min(5_000, Math.floor(this.config.quoteStaleMs / 3)));
    this.staleTimer = setInterval(() => {
      this.refreshStaleState();
    }, interval);
    this.staleTimer.unref?.();
  }

  private stopStaleTimer(): void {
    if (this.staleTimer) {
      clearInterval(this.staleTimer);
      this.staleTimer = null;
    }
  }

  /** Test helper: force stale evaluation at current clock. */
  evaluateFreshness(): FxcmStreamState {
    this.refreshStaleState();
    return this.streamState;
  }

  /** Test helper: inject a raw provider event for a subscribed symbol. */
  injectRawEvent(providerSymbol: string, raw: unknown): void {
    this.handleTransportEvent(providerSymbol, raw);
  }

  shutdown(): void {
    this.closed = true;
    this.clearReconnectTimer();
    this.stopStaleTimer();
    this.listeners.clear();
    const session = this.transport?.getSession();
    if (session && this.transport?.isConnected()) {
      for (const sub of this.subscriptions.values()) {
        void fxcmUnsubscribeMarketData(
          this.config,
          session,
          sub.providerSymbol,
          { fetchImpl: this.fetchImpl },
        ).catch(() => undefined);
      }
    }
    this.transport?.disconnect();
    this.transport = null;
    this.subscriptions.clear();
    this.streamState = this.initialState();
  }

  toSafeApiPayload(): SafeFxcmStreamStatus {
    const status = this.getSafeStatus();
    assertSafeStreamPayload(status);
    return status;
  }
}

export function createFxcmRealtimeStreamService(
  options?: FxcmStreamServiceOptions,
): FxcmRealtimeStreamService {
  return new FxcmRealtimeStreamService(options);
}
