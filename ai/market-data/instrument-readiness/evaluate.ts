/**
 * Phase 56.2.8 / 56.3.1 — evaluate per-instrument readiness independently.
 * One instrument's LIVE/STALE state must not imply another instrument's state.
 */
import { resolveFcFeedStreamState } from "../forexconnect/stream-state.js";
import type { MarketInstrument, MarketProviderId } from "../providers/types.js";
import type { UnifiedConnectionState } from "../providers/contracts.js";
import { buildLiveFeedDiagnostics } from "./feed-diagnostics.js";
import { resolveInstrumentFreshnessPolicy } from "./freshness-policy.js";
import type {
  InstrumentCapabilityFlags,
  InstrumentReadinessBlocker,
  InstrumentReadinessCatalogSummary,
  InstrumentReadinessSnapshot,
  InstrumentReadinessStatus,
} from "./types.js";

export interface InstrumentLiveQuoteInput {
  bid?: number | null;
  ask?: number | null;
  streamState?: string | null;
  priceChangeAgeMs?: number | null;
  receiptAgeMs?: number | null;
  updateCount?: number | null;
  /** True when only historical candles/seed exist — never claim live. */
  historicalOnly?: boolean;
  /** Sidecar Offers origin — absent on seeded snapshots. */
  eventSource?: string | null;
  lastPriceChangeAtMs?: number | null;
  lastReceiptAtMs?: number | null;
}

export interface EvaluateInstrumentReadinessInput {
  provider: MarketProviderId;
  instrument: MarketInstrument | null;
  providerSymbol: string;
  canonicalSymbol?: string | null;
  displaySymbol?: string | null;
  live?: InstrumentLiveQuoteInput | null;
  /** Provider declared historical candles capability (catalog-level). */
  historicalCapability?: boolean;
  /** Whether a historical series was successfully fetched recently (optional evidence). */
  historicalFetchedOk?: boolean | null;
  /** Phase 56.3.1 — caller asked subscribeLive on this evaluation. */
  subscriptionRequested?: boolean;
  nowMs?: number;
  staleMs?: number | null;
}

function finitePrice(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function mapFeedToFreshness(
  feed: string,
  hasBidAsk: boolean,
): InstrumentReadinessStatus {
  if (feed === "LIVE" && hasBidAsk) return "READY";
  if (feed === "STALE") return "STALE";
  if (feed === "DISCONNECTED" || feed === "DISABLED" || feed === "ERROR") return "DISCONNECTED";
  if (feed === "NOT_CONFIGURED") return "UNAVAILABLE";
  if (feed === "UNSUPPORTED") return "UNSUPPORTED";
  if (
    feed === "SUBSCRIBED_WAITING"
    || feed === "SUBSCRIBING"
    || feed === "MARKET_INACTIVE"
    || feed === "NO_RECENT_MARKET_UPDATES"
  ) {
    return "PARTIALLY_READY";
  }
  return "UNVERIFIED";
}

function overallFrom(parts: {
  discovered: boolean;
  liveStatus: InstrumentReadinessStatus;
  dataSupported: boolean;
}): InstrumentReadinessStatus {
  if (!parts.discovered) return "UNAVAILABLE";
  if (!parts.dataSupported) return "UNSUPPORTED";
  if (parts.liveStatus === "READY") return "READY";
  if (parts.liveStatus === "STALE") return "STALE";
  if (parts.liveStatus === "DISCONNECTED") return "DISCONNECTED";
  if (parts.liveStatus === "PARTIALLY_READY") return "PARTIALLY_READY";
  if (parts.liveStatus === "UNSUPPORTED") return "UNSUPPORTED";
  return parts.liveStatus;
}

/**
 * Evaluate readiness for one provider+instrument. Does not invent quotes or metadata.
 * `executionAuthorized` is always false in this phase.
 */
export function evaluateInstrumentReadiness(
  input: EvaluateInstrumentReadinessInput,
): InstrumentReadinessSnapshot {
  const nowMs = input.nowMs ?? Date.now();
  const instrument = input.instrument;
  const marketType = instrument?.marketType ?? "UNKNOWN";
  const policy = resolveInstrumentFreshnessPolicy({
    provider: input.provider,
    marketType,
    overrideStaleMs: input.staleMs,
  });

  const blockers: InstrumentReadinessBlocker[] = [];
  const discovered = Boolean(instrument);
  const caps = instrument?.capabilities;
  const dataSupported = Boolean(
    caps?.liveQuotes || caps?.streamingQuotes || caps?.historicalPrices || caps?.candles,
  );

  if (!discovered) {
    blockers.push({
      id: "instrument_undiscovered",
      status: "UNAVAILABLE",
      reason: "Instrument not present in the provider catalog for this session.",
      blocks: ["live quotes", "analysis", "simulation draft"],
    });
  } else if (!dataSupported) {
    blockers.push({
      id: "capability_unsupported",
      status: "UNSUPPORTED",
      reason: "Provider catalog lists the symbol without usable quote/candle capabilities.",
      blocks: ["live quotes", "analysis"],
    });
  }

  const live = input.live ?? null;
  const bid = finitePrice(live?.bid);
  const ask = finitePrice(live?.ask);
  const hasBidAsk = bid != null && ask != null && ask >= bid;
  const updateCount = Math.max(0, Math.floor(Number(live?.updateCount ?? 0)) || 0);
  const priceChangeAgeMs =
    typeof live?.priceChangeAgeMs === "number" && Number.isFinite(live.priceChangeAgeMs)
      ? Math.max(0, live.priceChangeAgeMs)
      : null;
  const receiptAgeMs =
    typeof live?.receiptAgeMs === "number" && Number.isFinite(live.receiptAgeMs)
      ? Math.max(0, live.receiptAgeMs)
      : null;

  const recomputed = resolveFcFeedStreamState({
    priceChangeAgeMs,
    receiptAgeMs,
    updateCount,
    staleMs: policy.quoteStaleMs,
  });
  const streamRaw = String(live?.streamState ?? "").trim().toUpperCase();
  const feedStatus = live
    ? (streamRaw === "LIVE" && recomputed !== "LIVE" ? recomputed : (streamRaw || recomputed))
    : null;

  const historicalOnly = Boolean(live?.historicalOnly) || (live != null && updateCount <= 0 && hasBidAsk);
  let freshnessStatus: InstrumentReadinessStatus = live
    ? mapFeedToFreshness(String(feedStatus ?? "UNVERIFIED"), hasBidAsk)
    : "UNAVAILABLE";
  let reasonCode: string | null = feedStatus;

  const feedDiagnostics = buildLiveFeedDiagnostics({
    sessionActive: live != null,
    subscriptionRequested: input.subscriptionRequested,
    feedStatus: live ? String(feedStatus ?? null) : null,
    hasBidAsk,
    updateCount,
    historicalOnly,
    eventSource: live?.eventSource ?? null,
    priceChangeAgeMs,
    receiptAgeMs,
    lastPriceChangeAtMs: live?.lastPriceChangeAtMs ?? null,
    lastReceiptAtMs: live?.lastReceiptAtMs
      ?? (receiptAgeMs != null ? nowMs - receiptAgeMs : null),
    nowMs,
  });

  if (live && !hasBidAsk) {
    freshnessStatus = "UNAVAILABLE";
    reasonCode = "BID_ASK_MISSING";
    blockers.push({
      id: feedDiagnostics.blockerId ?? "quote_missing",
      status: "UNAVAILABLE",
      reason: feedDiagnostics.blockerReason ?? "Bid/Ask missing or invalid for this instrument.",
      blocks: ["live readiness", "simulation monetary risk"],
    });
  } else if (live && freshnessStatus !== "READY") {
    blockers.push({
      id: feedDiagnostics.blockerId ?? "quote_not_live",
      status: freshnessStatus,
      reason: feedDiagnostics.blockerReason
        ?? `Feed not LIVE for this instrument (status=${feedStatus ?? "unknown"}). Seeded/historical prices are not live.`,
      blocks: ["liveFeedReady", "analysisReady when live required", "simulation draft sizing"],
    });
  } else if (!live && discovered) {
    blockers.push({
      id: feedDiagnostics.blockerId ?? "no_active_session",
      status: "UNVERIFIED",
      reason: feedDiagnostics.blockerReason
        ?? "No active live session for this instrument.",
      blocks: ["liveFeedReady", "simulation draft that requires fresh Bid/Ask"],
    });
  }

  if (historicalOnly && hasBidAsk) {
    reasonCode = reasonCode ?? "HISTORICAL_OR_SEEDED_QUOTE";
  }
  if (feedDiagnostics.blockerId && freshnessStatus !== "READY") {
    reasonCode = feedDiagnostics.blockerId.toUpperCase();
  }

  const historicalCapability = input.historicalCapability
    ?? Boolean(caps?.historicalPrices || caps?.candles);
  const historicalAvailable = historicalCapability
    && (input.historicalFetchedOk !== false);

  const liveFeedReady = freshnessStatus === "READY" && hasBidAsk && !historicalOnly;
  const analysisReady = discovered && dataSupported && (liveFeedReady || historicalAvailable);
  const simulationReady = liveFeedReady && discovered;

  if (!liveFeedReady && historicalAvailable) {
    // Honest: historical path may support charts/analysis while live remains blocked.
    blockers.push({
      id: "historical_without_live",
      status: "PARTIALLY_READY",
      reason: "Historical candles may be available while the live Offers/stream feed is not READY.",
      blocks: ["liveFeedReady", "simulation draft that requires fresh Bid/Ask"],
    });
  }

  const capabilityFlags: InstrumentCapabilityFlags = {
    discovered,
    dataSupported,
    liveFeedReady,
    historicalAvailable,
    analysisReady,
    simulationReady,
    executionAuthorized: false,
  };

  const overall = overallFrom({
    discovered,
    liveStatus: live ? freshnessStatus : (discovered ? "UNVERIFIED" : "UNAVAILABLE"),
    dataSupported,
  });

  return {
    phase: "56.3.2",
    provider: input.provider,
    providerSymbol: instrument?.providerSymbol ?? input.providerSymbol,
    canonicalSymbol: instrument?.canonicalSymbol
      ?? input.canonicalSymbol
      ?? input.providerSymbol,
    displaySymbol: instrument?.displaySymbol
      ?? input.displaySymbol
      ?? input.providerSymbol,
    marketType,
    connectionState: (feedStatus as UnifiedConnectionState | string | null)
      ?? (discovered ? "NO_DATA" : "DISCONNECTED"),
    quote: live
      ? {
          bid,
          ask,
          feedStatus,
          freshnessStatus,
          reasonCode,
          priceChangeAgeMs,
          receiptAgeMs,
          updateCount,
          historicalOnly,
          diagnostics: feedDiagnostics,
        }
      : null,
    feedDiagnostics,
    overall,
    capabilities: capabilityFlags,
    freshnessPolicy: policy,
    blockers,
    evaluatedAtUtc: new Date(nowMs).toISOString(),
    placesOrders: false,
    acceptsForExecution: false,
  };
}

export function summarizeInstrumentReadinessCatalog(input: {
  provider: MarketProviderId | null;
  snapshots: InstrumentReadinessSnapshot[];
  notes?: string[];
  nowMs?: number;
}): InstrumentReadinessCatalogSummary {
  const snapshots = input.snapshots;
  const liveReadySymbols = snapshots
    .filter((s) => s.capabilities.liveFeedReady)
    .map((s) => s.displaySymbol || s.providerSymbol);
  const blockedSymbols = snapshots
    .filter((s) => !s.capabilities.liveFeedReady)
    .map((s) => ({
      symbol: s.displaySymbol || s.providerSymbol,
      blockerId: s.feedDiagnostics?.blockerId
        ?? s.blockers.find((b) => b.id !== "historical_without_live")?.id
        ?? null,
    }));
  return {
    phase: "56.3.2",
    provider: input.provider,
    discoveredCount: snapshots.filter((s) => s.capabilities.discovered).length,
    liveFeedReadyCount: liveReadySymbols.length,
    historicalAvailableCount: snapshots.filter((s) => s.capabilities.historicalAvailable).length,
    blockedOrUnreadyCount: blockedSymbols.length,
    liveReadySymbols,
    blockedSymbols,
    snapshots,
    notes: [
      ...(input.notes ?? []),
      "Per-instrument readiness is independent — one LIVE symbol never marks peers READY.",
      "liveReadySymbols lists only instruments with verified LIVE freshness; never a global LIVE flag.",
      "executionAuthorized remains false; discovery/live data do not authorize broker trading.",
    ],
    placesOrders: false,
    acceptsForExecution: false,
    evaluatedAtUtc: new Date(input.nowMs ?? Date.now()).toISOString(),
  };
}
