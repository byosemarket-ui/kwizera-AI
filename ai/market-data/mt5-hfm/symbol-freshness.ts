/**
 * STEP 2B — per-symbol freshness engine + bounded monitor.
 * Never labels stale/LKG data as FRESH/LIVE. Uses trusted server clock.
 */
import {
  HFM_CATEGORY_FRESHNESS_MS,
  HFM_SUB_ENVIRONMENT,
  HFM_SUB_PROVIDER,
  HFM_SUBSCRIPTION_DEFAULTS,
  type HfmSymbolFreshnessState,
  type HfmSymbolFreshnessStatus,
} from "./subscription-types.js";

export interface HfmFreshnessEvent {
  type: "freshness.changed";
  provider: typeof HFM_SUB_PROVIDER;
  environment: typeof HFM_SUB_ENVIRONMENT;
  symbol: string;
  previousStatus: HfmSymbolFreshnessStatus | null;
  newStatus: HfmSymbolFreshnessStatus;
  reason: string | null;
  quoteAgeMs: number | null;
  timestamp: string;
}

type Listener = (ev: HfmFreshnessEvent) => void;

export function thresholdsForCategory(category: string | null | undefined): {
  fresh: number;
  aging: number;
  stale: number;
} {
  const key = String(category ?? "OTHER").toUpperCase();
  return HFM_CATEGORY_FRESHNESS_MS[key] ?? HFM_CATEGORY_FRESHNESS_MS.OTHER;
}

export function computeSymbolFreshness(input: {
  nowMs: number;
  lastValidQuoteAt: string | null;
  lastReceivedAt: string | null;
  lastTickTimestamp: number | null;
  category?: string | null;
  overrideThresholdMs?: number | null;
  terminalRunning?: boolean | null;
  transportOk?: boolean | null;
  marketClosed?: boolean;
  lastQuoteInvalid?: boolean;
  hasAnyQuote?: boolean;
}): { status: HfmSymbolFreshnessStatus; reason: string; quoteAgeMs: number | null; thresholdMs: number } {
  const th = thresholdsForCategory(input.category);
  const thresholdMs = input.overrideThresholdMs && input.overrideThresholdMs > 0
    ? input.overrideThresholdMs
    : th.fresh;

  if (input.terminalRunning === false) {
    return { status: "TERMINAL_DISCONNECTED", reason: "TERMINAL_DOWN", quoteAgeMs: null, thresholdMs };
  }
  if (input.transportOk === false) {
    return { status: "TRANSPORT_UNAVAILABLE", reason: "TRANSPORT_DOWN", quoteAgeMs: null, thresholdMs };
  }
  if (input.marketClosed) {
    const age = ageFrom(input.lastValidQuoteAt, input.nowMs);
    return { status: "MARKET_CLOSED", reason: "MARKET_CONFIRMED_CLOSED", quoteAgeMs: age, thresholdMs };
  }
  if (input.lastQuoteInvalid && !input.hasAnyQuote) {
    return { status: "INVALID", reason: "LAST_QUOTE_INVALID", quoteAgeMs: null, thresholdMs };
  }
  if (!input.lastValidQuoteAt && !input.hasAnyQuote) {
    return { status: "NO_QUOTE", reason: "NEVER_RECEIVED", quoteAgeMs: null, thresholdMs };
  }

  const quoteAgeMs = ageFrom(input.lastValidQuoteAt ?? input.lastReceivedAt, input.nowMs);
  if (quoteAgeMs == null) {
    return { status: "NO_QUOTE", reason: "MISSING_TIMESTAMP", quoteAgeMs: null, thresholdMs };
  }
  if (quoteAgeMs <= th.fresh) {
    return { status: "FRESH", reason: "WITHIN_FRESH_WINDOW", quoteAgeMs, thresholdMs };
  }
  if (quoteAgeMs <= th.aging) {
    return { status: "AGING", reason: "WITHIN_AGING_WINDOW", quoteAgeMs, thresholdMs };
  }
  if (quoteAgeMs <= th.stale) {
    return { status: "STALE", reason: "WITHIN_STALE_WINDOW", quoteAgeMs, thresholdMs };
  }
  return { status: "STALE", reason: "BEYOND_STALE_WINDOW", quoteAgeMs, thresholdMs };
}

function ageFrom(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, nowMs - t);
}

/** How long a preserved marketClosed observation remains authoritative under transport failure. */
export const HFM_MARKET_SESSION_OBSERVATION_MAX_AGE_MS = 15 * 60 * 1000;

export type HfmMarketSessionObservationProvenance =
  | "snapshot"
  | "preserved"
  | "expired"
  | "unknown";

export interface HfmMarketSessionObservation {
  marketClosed: boolean | null;
  observedAt: string | null;
  ageMs: number | null;
  provenance: HfmMarketSessionObservationProvenance;
  authoritative: boolean;
}

export class HfmSymbolFreshnessEngine {
  private readonly bySymbol = new Map<string, HfmSymbolFreshnessState>();
  private readonly listeners = new Set<Listener>();
  private monitorTimer: ReturnType<typeof setInterval> | null = null;
  private terminalRunning: boolean | null = null;
  private transportOk: boolean | null = null;
  private marketClosed = false;
  private marketClosedObservedAtMs: number | null = null;
  private marketClosedProvenance: HfmMarketSessionObservationProvenance = "unknown";
  private readonly marketClosedMaxAgeMs: number;

  constructor(opts?: { marketClosedMaxAgeMs?: number }) {
    this.marketClosedMaxAgeMs =
      opts?.marketClosedMaxAgeMs ?? HFM_MARKET_SESSION_OBSERVATION_MAX_AGE_MS;
  }

  onEvent(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(ev: HfmFreshnessEvent): void {
    for (const l of this.listeners) {
      try {
        l(ev);
      } catch {
        /* isolate */
      }
    }
  }

  /**
   * Update connectivity. Omit `marketClosed` to preserve the last known session
   * observation (transport failure must not invent MARKET_OPEN/CLOSED).
   */
  setConnectivity(opts: {
    terminalRunning?: boolean | null;
    transportOk?: boolean | null;
    marketClosed?: boolean;
    /** Wall clock for tests; defaults to Date.now(). */
    nowMs?: number;
  }): void {
    if (opts.terminalRunning !== undefined) this.terminalRunning = opts.terminalRunning;
    if (opts.transportOk !== undefined) this.transportOk = opts.transportOk;
    if (opts.marketClosed !== undefined) {
      this.marketClosed = Boolean(opts.marketClosed);
      this.marketClosedObservedAtMs = opts.nowMs ?? Date.now();
      this.marketClosedProvenance = "snapshot";
    }
  }

  getMarketSessionObservation(nowMs: number = Date.now()): HfmMarketSessionObservation {
    if (this.marketClosedObservedAtMs == null) {
      return {
        marketClosed: null,
        observedAt: null,
        ageMs: null,
        provenance: "unknown",
        authoritative: false,
      };
    }
    const ageMs = Math.max(0, nowMs - this.marketClosedObservedAtMs);
    if (ageMs > this.marketClosedMaxAgeMs) {
      return {
        marketClosed: null,
        observedAt: new Date(this.marketClosedObservedAtMs).toISOString(),
        ageMs,
        provenance: "expired",
        authoritative: false,
      };
    }
    const preserved = this.marketClosedProvenance === "snapshot" && this.transportOk === false;
    return {
      marketClosed: this.marketClosed,
      observedAt: new Date(this.marketClosedObservedAtMs).toISOString(),
      ageMs,
      provenance: preserved ? "preserved" : this.marketClosedProvenance,
      authoritative: true,
    };
  }

  /** Effective marketClosed for freshness compute — never invent open/closed from transport alone. */
  private effectiveMarketClosed(nowMs: number): boolean {
    const obs = this.getMarketSessionObservation(nowMs);
    if (!obs.authoritative || obs.marketClosed == null) return false;
    return obs.marketClosed;
  }

  ensure(symbol: string, category: string | null = null): HfmSymbolFreshnessState {
    const existing = this.bySymbol.get(symbol);
    if (existing) return existing;
    const th = thresholdsForCategory(category);
    const state: HfmSymbolFreshnessState = {
      provider: HFM_SUB_PROVIDER,
      environment: HFM_SUB_ENVIRONMENT,
      symbol,
      lastTickTimestamp: null,
      lastReceivedAt: null,
      lastValidQuoteAt: null,
      lastAcquisitionAttemptAt: null,
      lastAcquisitionSuccessAt: null,
      quoteAgeMs: null,
      lastKnownGoodAgeMs: null,
      freshnessThresholdMs: th.fresh,
      freshnessStatus: "NO_QUOTE",
      freshnessReason: "INIT",
      previousFreshnessStatus: null,
      changedAt: null,
      category,
    };
    this.bySymbol.set(symbol, state);
    return state;
  }

  noteAcquisitionAttempt(symbol: string, atIso: string): void {
    const s = this.ensure(symbol);
    s.lastAcquisitionAttemptAt = atIso;
  }

  noteValidQuote(input: {
    symbol: string;
    receivedAt: string;
    tickTimestamp: number | null;
    category?: string | null;
    overrideThresholdMs?: number | null;
  }): HfmSymbolFreshnessState {
    const s = this.ensure(input.symbol, input.category ?? null);
    if (input.category) s.category = input.category;
    s.lastReceivedAt = input.receivedAt;
    s.lastValidQuoteAt = input.receivedAt;
    s.lastAcquisitionSuccessAt = input.receivedAt;
    s.lastTickTimestamp = input.tickTimestamp;
    return this.recompute(input.symbol, {
      overrideThresholdMs: input.overrideThresholdMs,
      hasAnyQuote: true,
      lastQuoteInvalid: false,
    });
  }

  noteInvalidQuote(symbol: string, receivedAt: string): HfmSymbolFreshnessState {
    const s = this.ensure(symbol);
    s.lastReceivedAt = receivedAt;
    s.lastAcquisitionAttemptAt = receivedAt;
    return this.recompute(symbol, { hasAnyQuote: Boolean(s.lastValidQuoteAt), lastQuoteInvalid: true });
  }

  recompute(
    symbol: string,
    opts?: {
      overrideThresholdMs?: number | null;
      hasAnyQuote?: boolean;
      lastQuoteInvalid?: boolean;
      nowMs?: number;
    },
  ): HfmSymbolFreshnessState {
    const s = this.ensure(symbol);
    const nowMs = opts?.nowMs ?? Date.now();
    const result = computeSymbolFreshness({
      nowMs,
      lastValidQuoteAt: s.lastValidQuoteAt,
      lastReceivedAt: s.lastReceivedAt,
      lastTickTimestamp: s.lastTickTimestamp,
      category: s.category,
      overrideThresholdMs: opts?.overrideThresholdMs ?? s.freshnessThresholdMs,
      terminalRunning: this.terminalRunning,
      transportOk: this.transportOk,
      marketClosed: this.effectiveMarketClosed(nowMs),
      lastQuoteInvalid: opts?.lastQuoteInvalid,
      hasAnyQuote: opts?.hasAnyQuote ?? Boolean(s.lastValidQuoteAt),
    });
    s.quoteAgeMs = result.quoteAgeMs;
    s.lastKnownGoodAgeMs = result.quoteAgeMs;
    s.freshnessThresholdMs = result.thresholdMs;
    s.freshnessReason = result.reason;
    if (s.freshnessStatus !== result.status) {
      const prev = s.freshnessStatus;
      s.previousFreshnessStatus = prev;
      s.freshnessStatus = result.status;
      s.changedAt = new Date(nowMs).toISOString();
      this.emit({
        type: "freshness.changed",
        provider: HFM_SUB_PROVIDER,
        environment: HFM_SUB_ENVIRONMENT,
        symbol,
        previousStatus: prev,
        newStatus: result.status,
        reason: result.reason,
        quoteAgeMs: result.quoteAgeMs,
        timestamp: s.changedAt,
      });
    }
    this.bySymbol.set(symbol, s);
    return s;
  }

  get(symbol: string): HfmSymbolFreshnessState | null {
    return this.bySymbol.get(symbol) ?? null;
  }

  list(symbols?: string[]): HfmSymbolFreshnessState[] {
    if (!symbols) return [...this.bySymbol.values()];
    return symbols.map((s) => this.ensure(s));
  }

  counts(): Record<HfmSymbolFreshnessStatus, number> {
    const out: Record<HfmSymbolFreshnessStatus, number> = {
      FRESH: 0,
      AGING: 0,
      STALE: 0,
      NO_QUOTE: 0,
      MARKET_CLOSED: 0,
      TERMINAL_DISCONNECTED: 0,
      TRANSPORT_UNAVAILABLE: 0,
      INVALID: 0,
    };
    for (const s of this.bySymbol.values()) out[s.freshnessStatus] += 1;
    return out;
  }

  /** Bounded monitor — recomputes without acquiring ticks. */
  startMonitor(symbolsProvider: () => string[], intervalMs = HFM_SUBSCRIPTION_DEFAULTS.monitorIntervalMs): void {
    if (this.monitorTimer) return;
    this.monitorTimer = setInterval(() => {
      const nowMs = Date.now();
      for (const sym of symbolsProvider()) {
        this.recompute(sym, { nowMs });
      }
    }, Math.max(1000, intervalMs));
    if (typeof this.monitorTimer === "object" && "unref" in this.monitorTimer) {
      (this.monitorTimer as NodeJS.Timeout).unref();
    }
  }

  stopMonitor(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
  }
}

let singleton: HfmSymbolFreshnessEngine | null = null;

export function getHfmSymbolFreshnessEngine(): HfmSymbolFreshnessEngine {
  if (!singleton) singleton = new HfmSymbolFreshnessEngine();
  return singleton;
}

export function resetHfmSymbolFreshnessEngineForTests(): void {
  singleton?.stopMonitor();
  singleton = null;
}
