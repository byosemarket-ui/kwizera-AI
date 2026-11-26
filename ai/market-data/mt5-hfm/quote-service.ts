/**
 * STEP 2A — HFM Node quote service: validate, freshness, LKG, state transitions.
 */
import type { HfmCatalogInstrument } from "./catalog-types.js";
import { getHfmCatalogService } from "./catalog-service.js";
import {
  DEFAULT_MT5_HFM_FRESHNESS_POLICY,
  freshnessFromAgeSec,
  type Mt5HfmFreshnessPolicy,
} from "./freshness.js";
import { getHfmQuoteSubscriptionRegistry } from "./quote-subscriptions.js";
import { getHfmSubscriptionManager } from "./subscription-manager.js";
import { getHfmSymbolFreshnessEngine } from "./symbol-freshness.js";
import {
  HFM_QUOTE_ENVIRONMENT,
  HFM_QUOTE_PROVIDER,
  type HfmCanonicalQuote,
  type HfmQuoteServiceSnapshot,
  type HfmQuoteStatus,
} from "./quote-types.js";
import { validateHfmRawQuote, type HfmRawQuoteInput } from "./quote-validation.js";

const MAX_REJECTED = 64;

export interface HfmQuoteIngestContext {
  server: string | null;
  sequence: number | null;
  receivedAt: string;
  ageSec: number | null;
  marketClosed: boolean;
  terminalRunning: boolean | null;
  feedFreshness: string;
  requireCatalogMatch?: boolean;
  /** MT5 TimeCurrent() from the polled snapshot (broker-server seconds). */
  brokerTime?: number | null;
  /** MT5 TimeGMT() from the polled snapshot (GMT/UTC seconds). */
  gmtTime?: number | null;
}

interface SymbolQuoteState {
  lastKnownGood: HfmCanonicalQuote | null;
  lastRejected: HfmCanonicalQuote | null;
  status: HfmQuoteStatus;
  updatedAt: string;
}

function emptyCounts(): HfmQuoteServiceSnapshot["counts"] {
  return {
    live: 0,
    stale: 0,
    marketClosed: 0,
    noQuote: 0,
    invalid: 0,
    incomplete: 0,
    delayed: 0,
    error: 0,
    waiting: 0,
  };
}

function mapFeedToQuoteStatus(
  base: HfmQuoteStatus,
  ctx: HfmQuoteIngestContext,
  policy: Mt5HfmFreshnessPolicy,
): HfmQuoteStatus {
  if (base === "INVALID" || base === "NO_QUOTE" || base === "INCOMPLETE" || base === "ERROR") {
    return base;
  }
  if (ctx.terminalRunning === false) return "ERROR";
  if (ctx.marketClosed) return "MARKET_CLOSED";
  const feed = freshnessFromAgeSec(ctx.ageSec, policy, {
    terminalRunning: ctx.terminalRunning ?? true,
    marketClosed: ctx.marketClosed,
  });
  if (feed === "STALE") return "STALE";
  if (feed === "DISCONNECTED") return "ERROR";
  if (feed === "WAITING_FOR_DATA") return "WAITING_FOR_DATA";
  if (feed === "MARKET_CLOSED") return "MARKET_CLOSED";
  // Delayed: tick time much older than receive while feed age still LIVE.
  return base;
}

function applyDelayCheck(quote: HfmCanonicalQuote, ctx: HfmQuoteIngestContext): HfmQuoteStatus {
  if (quote.status !== "LIVE" || quote.quoteTimestamp == null) return quote.status;
  const receivedMs = Date.parse(ctx.receivedAt);
  if (!Number.isFinite(receivedMs)) return quote.status;
  const tickMs = quote.quoteTimestampMs ?? quote.quoteTimestamp * 1000;
  const lagSec = (receivedMs - tickMs) / 1000;
  if (lagSec > 60 && lagSec < 3600) return "DELAYED";
  return quote.status;
}

export class HfmQuoteService {
  private readonly bySymbol = new Map<string, SymbolQuoteState>();
  private readonly rejectedRing: HfmCanonicalQuote[] = [];
  private readonly policy: Mt5HfmFreshnessPolicy;
  private lastServer: string | null = null;
  private lastSequence: number | null = null;
  private lastReceivedAt: string | null = null;
  private lastFeedFreshness = "WAITING_FOR_DATA";
  private lastMarketClosed = false;
  private lastTerminalRunning: boolean | null = null;

  constructor(policy: Mt5HfmFreshnessPolicy = DEFAULT_MT5_HFM_FRESHNESS_POLICY) {
    this.policy = { ...policy };
  }

  private key(symbol: string): string {
    return symbol;
  }

  private async catalogMap(): Promise<Map<string, HfmCatalogInstrument> | null> {
    try {
      const snap = await getHfmCatalogService().load();
      if (!snap?.symbols?.length) return null;
      const map = new Map<string, HfmCatalogInstrument>();
      for (const s of snap.symbols) {
        map.set(s.symbol, s);
        map.set(s.symbol.toUpperCase(), s);
      }
      return map;
    } catch {
      return null;
    }
  }

  async ingestRawQuotes(
    rawQuotes: HfmRawQuoteInput[],
    ctx: HfmQuoteIngestContext,
  ): Promise<{
    published: HfmCanonicalQuote[];
    rejected: HfmCanonicalQuote[];
    skippedUnsubscribed: number;
  }> {
    const catalog = await this.catalogMap();
    const subMgr = getHfmSubscriptionManager();
    const requireCatalog = ctx.requireCatalogMatch ?? Boolean(catalog && catalog.size > 0);
    const published: HfmCanonicalQuote[] = [];
    const rejected: HfmCanonicalQuote[] = [];
    let skippedUnsubscribed = 0;

    this.lastServer = ctx.server;
    this.lastSequence = ctx.sequence;
    this.lastReceivedAt = ctx.receivedAt;
    this.lastFeedFreshness = ctx.feedFreshness;
    this.lastMarketClosed = ctx.marketClosed;
    this.lastTerminalRunning = ctx.terminalRunning;

    const freshness = getHfmSymbolFreshnessEngine();
    freshness.setConnectivity({
      terminalRunning: ctx.terminalRunning,
      transportOk: true,
      marketClosed: ctx.marketClosed,
    });

    for (const raw of rawQuotes) {
      const sym = typeof raw.symbol === "string" ? raw.symbol : "";
      // Paused / unsubscribed symbols are not acquired (STEP 2B).
      if (sym && !subMgr.isAcquisitionEligible(sym)) {
        skippedUnsubscribed += 1;
        continue;
      }

      if (sym) freshness.noteAcquisitionAttempt(sym, ctx.receivedAt);

      const { quote, accepted } = validateHfmRawQuote(raw, {
        receivedAt: ctx.receivedAt,
        server: ctx.server,
        sequence: ctx.sequence,
        catalogBySymbol: catalog,
        requireCatalogMatch: requireCatalog,
        provider: HFM_QUOTE_PROVIDER,
        environment: HFM_QUOTE_ENVIRONMENT,
        brokerTime: ctx.brokerTime ?? null,
        gmtTime: ctx.gmtTime ?? null,
        terminalRunning: ctx.terminalRunning,
        feedAvailable: ctx.terminalRunning !== false && ctx.feedFreshness !== "DISCONNECTED",
      });

      const stateKey = this.key(quote.symbol || sym || "UNKNOWN");
      const prev = this.bySymbol.get(stateKey);
      const previousStatus = prev?.status ?? null;

      let nextStatus = mapFeedToQuoteStatus(quote.status, ctx, this.policy);
      if (accepted) {
        nextStatus = applyDelayCheck({ ...quote, status: nextStatus }, ctx);
      }

      const transitioned: HfmCanonicalQuote = {
        ...quote,
        status: nextStatus,
        previousStatus,
        statusReason: quote.statusReason,
        statusChangedAt:
          previousStatus !== nextStatus ? ctx.receivedAt : prev?.lastKnownGood?.statusChangedAt ?? ctx.receivedAt,
      };

      if (!accepted) {
        rejected.push(transitioned);
        this.pushRejected(transitioned);
        const state = this.bySymbol.get(stateKey) ?? {
          lastKnownGood: null,
          lastRejected: null,
          status: "NO_QUOTE" as HfmQuoteStatus,
          updatedAt: ctx.receivedAt,
        };
        state.lastRejected = transitioned;
        // Never overwrite LKG with invalid.
        state.status = state.lastKnownGood ? state.lastKnownGood.status : nextStatus;
        state.updatedAt = ctx.receivedAt;
        this.bySymbol.set(stateKey, state);
        if (sym) {
          freshness.noteInvalidQuote(sym, ctx.receivedAt);
          subMgr.markAcquired(sym, ctx.receivedAt, false);
        }
        continue;
      }

      const state: SymbolQuoteState = {
        lastKnownGood: transitioned,
        lastRejected: prev?.lastRejected ?? null,
        status: nextStatus,
        updatedAt: ctx.receivedAt,
      };
      this.bySymbol.set(stateKey, state);
      published.push(transitioned);
      if (transitioned.symbol) {
        freshness.noteValidQuote({
          symbol: transitioned.symbol,
          receivedAt: ctx.receivedAt,
          tickTimestamp: transitioned.quoteTimestamp,
        });
        subMgr.markAcquired(transitioned.symbol, ctx.receivedAt, true);
      }
    }

    return { published, rejected, skippedUnsubscribed };
  }

  private pushRejected(q: HfmCanonicalQuote): void {
    this.rejectedRing.push(q);
    while (this.rejectedRing.length > MAX_REJECTED) this.rejectedRing.shift();
  }

  getQuote(symbol: string): HfmCanonicalQuote | null {
    const direct = this.bySymbol.get(symbol)?.lastKnownGood;
    if (direct) return direct;
    const u = symbol.toUpperCase();
    for (const [k, st] of this.bySymbol) {
      if (k.toUpperCase() === u) return st.lastKnownGood;
    }
    return null;
  }

  getRejected(symbol: string): HfmCanonicalQuote | null {
    const direct = this.bySymbol.get(symbol)?.lastRejected;
    if (direct) return direct;
    const u = symbol.toUpperCase();
    for (const [k, st] of this.bySymbol) {
      if (k.toUpperCase() === u) return st.lastRejected;
    }
    return null;
  }

  snapshot(): HfmQuoteServiceSnapshot {
    const subs = getHfmQuoteSubscriptionRegistry().list().symbols;
    const quotes: HfmCanonicalQuote[] = [];
    for (const sym of subs) {
      const q = this.getQuote(sym);
      if (q) quotes.push(q);
      else {
        quotes.push({
          provider: HFM_QUOTE_PROVIDER,
          environment: HFM_QUOTE_ENVIRONMENT,
          server: this.lastServer,
          symbol: sym,
          bid: null,
          ask: null,
          last: null,
          spread: null,
          spreadPoints: null,
          brokerSpreadPoints: null,
          digits: null,
          point: null,
          tickSize: null,
          tickVolume: null,
          realVolume: null,
          tickFlags: null,
          quoteTimestamp: null,
          quoteTimestampMs: null,
          receivedAt: this.lastReceivedAt ?? new Date().toISOString(),
          sequence: this.lastSequence,
          status: "NO_QUOTE",
          validation: {
            verdict: "rejected",
            errors: ["NO_QUOTE"],
            warnings: [],
            catalogMatched: false,
            catalogVersion: null,
          },
          source: "mql5_readonly_snapshot",
          acquisitionMethod: "unknown",
          previousStatus: null,
          statusReason: "NO_QUOTE",
          statusChangedAt: this.lastReceivedAt,
          mutatesBroker: false,
          placesOrders: false,
          acceptsForExecution: false,
        });
      }
    }

    const counts = emptyCounts();
    for (const q of quotes) {
      switch (q.status) {
        case "LIVE":
          counts.live += 1;
          break;
        case "STALE":
          counts.stale += 1;
          break;
        case "MARKET_CLOSED":
          counts.marketClosed += 1;
          break;
        case "NO_QUOTE":
          counts.noQuote += 1;
          break;
        case "INVALID":
          counts.invalid += 1;
          break;
        case "INCOMPLETE":
          counts.incomplete += 1;
          break;
        case "DELAYED":
          counts.delayed += 1;
          break;
        case "ERROR":
          counts.error += 1;
          break;
        default:
          counts.waiting += 1;
      }
    }

    return {
      provider: HFM_QUOTE_PROVIDER,
      environment: HFM_QUOTE_ENVIRONMENT,
      server: this.lastServer,
      receivedAt: this.lastReceivedAt ?? new Date().toISOString(),
      sequence: this.lastSequence,
      feedFreshness: this.lastFeedFreshness,
      marketClosed: this.lastMarketClosed,
      terminalRunning: this.lastTerminalRunning,
      subscribedSymbols: subs,
      quotes,
      counts,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
  }

  recentRejected(): HfmCanonicalQuote[] {
    return [...this.rejectedRing];
  }
}

let singleton: HfmQuoteService | null = null;

export function getHfmQuoteService(): HfmQuoteService {
  if (!singleton) singleton = new HfmQuoteService();
  return singleton;
}

export function resetHfmQuoteServiceForTests(): void {
  singleton = null;
}
