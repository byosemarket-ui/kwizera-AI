/**
 * STEP 2C — HFM SSE distribution helpers.
 * Validated quotes only; bounded replay; coalescing metrics.
 * Provider-isolated: HFM_MT5 / demo.
 */
import { randomUUID } from "node:crypto";
import {
  MT5_HFM_BROKER_ID,
  MT5_HFM_ENVIRONMENT,
  MT5_HFM_SSE_SCHEMA_VERSION,
  buildEnvelope,
  assertHfmSseEnvelope,
  type Mt5HfmEventEnvelope,
  type Mt5HfmSseEventType,
} from "./event-contract.js";
import type { Mt5HfmFreshness } from "./freshness.js";
import { getHfmQuoteService } from "./quote-service.js";
import { getHfmQuoteSubscriptionRegistry } from "./quote-subscriptions.js";
import { getHfmSubscriptionManager } from "./subscription-manager.js";
import { getHfmSymbolFreshnessEngine } from "./symbol-freshness.js";
import { getHfmRecoveryEngine } from "./recovery-engine.js";
import type { HfmCanonicalQuote } from "./quote-types.js";

export const HFM_SSE_REPLAY_RETENTION = 200;
export const HFM_SSE_MAX_EVENT_BYTES = 48_000;

export interface HfmSseDistributionMetrics {
  provider: typeof MT5_HFM_BROKER_ID;
  environment: typeof MT5_HFM_ENVIRONMENT;
  schemaVersion: typeof MT5_HFM_SSE_SCHEMA_VERSION;
  eventsPublished: number;
  eventsRejected: number;
  eventsCoalesced: number;
  eventsDropped: number;
  replayHits: number;
  replayMisses: number;
  snapshotFallbacks: number;
  lastSnapshotBytes: number | null;
  lastSnapshotMs: number | null;
  lastEventBytes: number | null;
  maxEventBytes: number;
  quoteToPublishLatencyMsSum: number;
  quoteToPublishLatencyMsCount: number;
}

const metrics: HfmSseDistributionMetrics = {
  provider: MT5_HFM_BROKER_ID,
  environment: MT5_HFM_ENVIRONMENT,
  schemaVersion: MT5_HFM_SSE_SCHEMA_VERSION,
  eventsPublished: 0,
  eventsRejected: 0,
  eventsCoalesced: 0,
  eventsDropped: 0,
  replayHits: 0,
  replayMisses: 0,
  snapshotFallbacks: 0,
  lastSnapshotBytes: null,
  lastSnapshotMs: null,
  lastEventBytes: null,
  maxEventBytes: 0,
  quoteToPublishLatencyMsSum: 0,
  quoteToPublishLatencyMsCount: 0,
};

/** Bounded ring of recent published envelopes for Last-Event-ID replay. */
const history: Mt5HfmEventEnvelope[] = [];

export function getHfmSseDistributionMetrics(): HfmSseDistributionMetrics {
  return { ...metrics };
}

export function resetHfmSseDistributionForTests(): void {
  history.length = 0;
  metrics.eventsPublished = 0;
  metrics.eventsRejected = 0;
  metrics.eventsCoalesced = 0;
  metrics.eventsDropped = 0;
  metrics.replayHits = 0;
  metrics.replayMisses = 0;
  metrics.snapshotFallbacks = 0;
  metrics.lastSnapshotBytes = null;
  metrics.lastSnapshotMs = null;
  metrics.lastEventBytes = null;
  metrics.maxEventBytes = 0;
  metrics.quoteToPublishLatencyMsSum = 0;
  metrics.quoteToPublishLatencyMsCount = 0;
}

export function recordHfmSsePublished(envelope: Mt5HfmEventEnvelope, byteLength: number): void {
  metrics.eventsPublished += 1;
  metrics.lastEventBytes = byteLength;
  if (byteLength > metrics.maxEventBytes) metrics.maxEventBytes = byteLength;
  history.push(envelope);
  while (history.length > HFM_SSE_REPLAY_RETENTION) history.shift();
}

export function recordHfmSseRejected(): void {
  metrics.eventsRejected += 1;
}

export function recordHfmSseCoalesced(n = 1): void {
  metrics.eventsCoalesced += n;
}

export function recordHfmSseDropped(n = 1): void {
  metrics.eventsDropped += n;
}

export function recordQuotePublishLatency(receivedAt: string | null | undefined): void {
  if (!receivedAt) return;
  const t = Date.parse(receivedAt);
  if (!Number.isFinite(t)) return;
  const lag = Math.max(0, Date.now() - t);
  metrics.quoteToPublishLatencyMsSum += lag;
  metrics.quoteToPublishLatencyMsCount += 1;
}

/** Map canonical quote status → SSE freshness without inventing LIVE for stale LKG. */
export function freshnessFromQuoteStatus(
  status: string | null | undefined,
  feed: Mt5HfmFreshness,
): Mt5HfmFreshness {
  switch (status) {
    case "LIVE":
    case "INCOMPLETE":
      return feed === "MARKET_CLOSED" ? "MARKET_CLOSED" : "LIVE";
    case "STALE":
    case "DELAYED":
      return "STALE";
    case "MARKET_CLOSED":
      return "MARKET_CLOSED";
    case "ERROR":
      return feed === "DISCONNECTED" ? "DISCONNECTED" : "STALE";
    case "NO_QUOTE":
    case "WAITING_FOR_DATA":
      return "WAITING_FOR_DATA";
    case "INVALID":
      return "DATA_UNAVAILABLE";
    default:
      return feed;
  }
}

export function quotePayloadForSse(q: HfmCanonicalQuote): Record<string, unknown> {
  return {
    symbol: q.symbol,
    bid: q.bid,
    ask: q.ask,
    last: q.last,
    spread: q.spread,
    spreadPoints: q.spreadPoints,
    brokerSpreadPoints: q.brokerSpreadPoints,
    digits: q.digits,
    point: q.point,
    tickSize: q.tickSize,
    tickTime: q.quoteTimestamp,
    tickTimeMs: q.quoteTimestampMs,
    tickVolume: q.tickVolume,
    realVolume: q.realVolume,
    status: q.status,
    validation: q.validation,
    provider: q.provider,
    environment: q.environment,
    server: q.server,
    receivedAt: q.receivedAt,
    sequence: q.sequence,
    acquisitionMethod: q.acquisitionMethod,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

/**
 * Build bounded connection snapshot from validated quote service + 2B state.
 * Never upgrades stale LKG to LIVE.
 */
export function buildHfmConnectionSnapshot(opts: {
  feedFreshness: Mt5HfmFreshness;
  terminalRunning: boolean | null;
  terminalConnected: boolean | null;
  authenticated: boolean | null;
  ageSec: number | null;
  seq: number | null;
  server: string | null;
  account: Record<string, unknown> | null;
}): {
  envelope: Mt5HfmEventEnvelope;
  byteLength: number;
  durationMs: number;
} {
  const t0 = Date.now();
  const quoteSnap = getHfmQuoteService().snapshot();
  const subs = getHfmSubscriptionManager().listAll().filter(
    (s) => s.status === "ACTIVE" || s.status === "PAUSED" || s.status === "RECOVERING",
  );
  const quotesOut: Array<Record<string, unknown>> = [];
  for (const q of quoteSnap.quotes) {
    // Rejected/invalid must not appear as LIVE ticks.
    if (q.status === "INVALID") {
      quotesOut.push({
        symbol: q.symbol,
        bid: null,
        ask: null,
        last: null,
        spread: null,
        status: "INVALID",
        provider: "HFM_MT5",
        environment: "demo",
        note: "Invalid quote withheld; LKG not presented as LIVE.",
      });
      continue;
    }
    const row = quotePayloadForSse(q);
    row.snapshotFreshness = freshnessFromQuoteStatus(q.status, opts.feedFreshness);
    quotesOut.push(row);
  }

  const data = {
    schemaVersion: MT5_HFM_SSE_SCHEMA_VERSION,
    provider: MT5_HFM_BROKER_ID,
    environment: MT5_HFM_ENVIRONMENT,
    server: opts.server ?? quoteSnap.server,
    snapshotId: randomUUID(),
    snapshotKind: "connection",
    account: opts.account,
    quotes: quotesOut,
    quoteCounts: quoteSnap.counts,
    subscriptions: {
      capacity: getHfmSubscriptionManager().capacity(),
      active: getHfmQuoteSubscriptionRegistry().list().symbols,
      records: subs.map((s) => ({
        symbol: s.symbol,
        status: s.status,
        priority: s.priority,
        subscriptionId: s.subscriptionId,
      })),
    },
    freshness: {
      feed: opts.feedFreshness,
      symbolCounts: getHfmSymbolFreshnessEngine().counts(),
    },
    recovery: getHfmRecoveryEngine().getState(),
    terminalRunning: opts.terminalRunning,
    terminalConnected: opts.terminalConnected,
    authenticated: opts.authenticated,
    ageSec: opts.ageSec,
    seq: opts.seq ?? quoteSnap.sequence,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };

  const envelope = buildEnvelope("snapshot", data, {
    eventId: randomUUID(),
    seq: opts.seq ?? quoteSnap.sequence,
    serverReceivedAt: quoteSnap.receivedAt ?? new Date().toISOString(),
    freshness: opts.feedFreshness,
    provenance: "hub",
    validation: "ok",
  });

  const assert = assertHfmSseEnvelope(envelope);
  if (!assert.ok) {
    metrics.eventsRejected += 1;
  }

  const json = JSON.stringify(envelope);
  const durationMs = Date.now() - t0;
  metrics.lastSnapshotBytes = Buffer.byteLength(json);
  metrics.lastSnapshotMs = durationMs;
  return { envelope, byteLength: metrics.lastSnapshotBytes, durationMs };
}

/**
 * Resolve Last-Event-ID against retained history.
 * Returns replay envelopes after the ID, or null → caller must send fresh snapshot.
 */
export function resolveHfmSseReplay(lastEventId: string | null | undefined): {
  mode: "replay" | "snapshot_fallback";
  envelopes: Mt5HfmEventEnvelope[];
} {
  const id = lastEventId?.trim();
  if (!id) {
    metrics.snapshotFallbacks += 1;
    return { mode: "snapshot_fallback", envelopes: [] };
  }
  const idx = history.findIndex((e) => e.eventId === id);
  if (idx < 0) {
    metrics.replayMisses += 1;
    metrics.snapshotFallbacks += 1;
    return { mode: "snapshot_fallback", envelopes: [] };
  }
  metrics.replayHits += 1;
  return { mode: "replay", envelopes: history.slice(idx + 1) };
}

/** Gate: only publish quote envelopes that pass provider + validation checks. */
export function shouldDistributeQuoteEvent(payload: Record<string, unknown>): {
  ok: boolean;
  reason: string | null;
} {
  if (payload.provider != null && payload.provider !== MT5_HFM_BROKER_ID) {
    return { ok: false, reason: "PROVIDER_MISMATCH" };
  }
  if (payload.environment != null && payload.environment !== MT5_HFM_ENVIRONMENT) {
    return { ok: false, reason: "ENVIRONMENT_MISMATCH" };
  }
  const status = payload.status != null ? String(payload.status) : null;
  if (status === "INVALID") {
    return { ok: false, reason: "INVALID_QUOTE" };
  }
  const bid = payload.bid;
  const ask = payload.ask;
  if (typeof bid !== "number" || typeof ask !== "number" || !(bid > 0) || !(ask > 0) || ask < bid) {
    return { ok: false, reason: "INVALID_BID_ASK" };
  }
  const validation = payload.validation as { verdict?: string } | undefined;
  if (validation?.verdict === "rejected") {
    return { ok: false, reason: "VALIDATION_REJECTED" };
  }
  return { ok: true, reason: null };
}

export type HfmSseEventTypeAlias = Mt5HfmSseEventType;
