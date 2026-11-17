/**
 * HFM MT5 realtime event contract (SSE) — Phase 1 + STEP 2C.
 * Broker provenance is always HFM_MT5 / Demo. No secrets, no AF_UNIX paths.
 *
 * Wire event names stay short for dashboard compatibility (`quote`, `snapshot`, …).
 * Payload `subtype` carries STEP 2C semantic names (quote.updated, freshness.changed, …).
 */
import type { Mt5HfmFreshness } from "./freshness.js";

export const MT5_HFM_BROKER_ID = "HFM_MT5" as const;
export const MT5_HFM_ENVIRONMENT = "demo" as const;
/** Versioned SSE envelope schema (STEP 2C). */
export const MT5_HFM_SSE_SCHEMA_VERSION = "hfm-sse-v2" as const;

export const MT5_HFM_SSE_EVENT_TYPES = [
  "hello",
  "snapshot",
  "account",
  "quote",
  "candles",
  "tick",
  "candle_update",
  "candle_finalized",
  "history_synchronized",
  "state",
  "heartbeat",
  "error",
  /** STEP 2B lifecycle / freshness / recovery (bounded; no flood). */
  "subscription",
  "freshness",
  "recovery",
] as const;

export type Mt5HfmSseEventType = (typeof MT5_HFM_SSE_EVENT_TYPES)[number];

export interface Mt5HfmEventEnvelope<T = unknown> {
  v: 1;
  schemaVersion: typeof MT5_HFM_SSE_SCHEMA_VERSION;
  broker: typeof MT5_HFM_BROKER_ID;
  environment: typeof MT5_HFM_ENVIRONMENT;
  type: Mt5HfmSseEventType;
  eventId: string;
  seq: number | null;
  correlationId: string | null;
  /** Broker/MT5 event time (unix seconds) when available. */
  brokerTimestamp: number | null;
  /** When the source event occurred (UTC ISO). */
  occurredAt: string;
  /** When the backend received the acquisition. */
  serverReceivedAt: string;
  /** When this event was published to subscribers. */
  publishedAt: string;
  freshness: Mt5HfmFreshness;
  connectionState: "connected" | "degraded" | "disconnected" | "waiting";
  provenance: "mql5_readonly_snapshot" | "journal_fallback" | "agent" | "hub";
  validation: "ok" | "rejected" | "partial";
  data: T;
}

export function connectionStateFromFreshness(
  freshness: Mt5HfmFreshness,
): Mt5HfmEventEnvelope["connectionState"] {
  switch (freshness) {
    case "LIVE":
    case "MARKET_CLOSED":
      return "connected";
    case "STALE":
      return "degraded";
    case "WAITING_FOR_DATA":
      return "waiting";
    default:
      return "disconnected";
  }
}

export function buildEnvelope<T>(
  type: Mt5HfmSseEventType,
  data: T,
  opts: {
    eventId: string;
    seq?: number | null;
    correlationId?: string | null;
    brokerTimestamp?: number | null;
    occurredAt?: string | null;
    serverReceivedAt: string;
    freshness: Mt5HfmFreshness;
    provenance?: Mt5HfmEventEnvelope["provenance"];
    validation?: Mt5HfmEventEnvelope["validation"];
  },
): Mt5HfmEventEnvelope<T> {
  const publishedAt = new Date().toISOString();
  return {
    v: 1,
    schemaVersion: MT5_HFM_SSE_SCHEMA_VERSION,
    broker: MT5_HFM_BROKER_ID,
    environment: MT5_HFM_ENVIRONMENT,
    type,
    eventId: opts.eventId,
    seq: opts.seq ?? null,
    correlationId: opts.correlationId ?? null,
    brokerTimestamp: opts.brokerTimestamp ?? null,
    occurredAt: opts.occurredAt ?? opts.serverReceivedAt ?? publishedAt,
    serverReceivedAt: opts.serverReceivedAt,
    publishedAt,
    freshness: opts.freshness,
    connectionState: connectionStateFromFreshness(opts.freshness),
    provenance: opts.provenance ?? "hub",
    validation: opts.validation ?? "ok",
    data,
  };
}

export function assertHfmSseEnvelope(raw: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["NOT_OBJECT"] };
  }
  const e = raw as Record<string, unknown>;
  if (e.broker !== MT5_HFM_BROKER_ID) errors.push("PROVIDER_MISMATCH");
  if (e.environment !== MT5_HFM_ENVIRONMENT) errors.push("ENVIRONMENT_MISMATCH");
  if (e.v !== 1) errors.push("SCHEMA_V_MISMATCH");
  if (typeof e.eventId !== "string" || !e.eventId) errors.push("EVENT_ID_MISSING");
  if (typeof e.type !== "string" || !(MT5_HFM_SSE_EVENT_TYPES as readonly string[]).includes(e.type)) {
    errors.push("EVENT_TYPE_INVALID");
  }
  if (typeof e.publishedAt !== "string" || !e.publishedAt) errors.push("PUBLISHED_AT_MISSING");
  if (typeof e.serverReceivedAt !== "string" || !e.serverReceivedAt) errors.push("SERVER_RECEIVED_AT_MISSING");
  if (e.schemaVersion != null && e.schemaVersion !== MT5_HFM_SSE_SCHEMA_VERSION) {
    errors.push("SCHEMA_VERSION_MISMATCH");
  }
  return { ok: errors.length === 0, errors };
}
