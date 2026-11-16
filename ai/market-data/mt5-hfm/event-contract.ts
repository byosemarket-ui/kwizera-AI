/**
 * HFM MT5 Phase 1 realtime event contract (SSE).
 * Broker provenance is always HFM_MT5 / Demo. No secrets, no AF_UNIX paths.
 */
import type { Mt5HfmFreshness } from "./freshness.js";

export const MT5_HFM_BROKER_ID = "HFM_MT5" as const;
export const MT5_HFM_ENVIRONMENT = "demo" as const;

export const MT5_HFM_SSE_EVENT_TYPES = [
  "hello",
  "snapshot",
  "account",
  "quote",
  "candles",
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
  broker: typeof MT5_HFM_BROKER_ID;
  environment: typeof MT5_HFM_ENVIRONMENT;
  type: Mt5HfmSseEventType;
  eventId: string;
  seq: number | null;
  /** Broker/MT5 event time (unix seconds) when available. */
  brokerTimestamp: number | null;
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
    brokerTimestamp?: number | null;
    serverReceivedAt: string;
    freshness: Mt5HfmFreshness;
    provenance?: Mt5HfmEventEnvelope["provenance"];
    validation?: Mt5HfmEventEnvelope["validation"];
  },
): Mt5HfmEventEnvelope<T> {
  const publishedAt = new Date().toISOString();
  return {
    v: 1,
    broker: MT5_HFM_BROKER_ID,
    environment: MT5_HFM_ENVIRONMENT,
    type,
    eventId: opts.eventId,
    seq: opts.seq ?? null,
    brokerTimestamp: opts.brokerTimestamp ?? null,
    serverReceivedAt: opts.serverReceivedAt,
    publishedAt,
    freshness: opts.freshness,
    connectionState: connectionStateFromFreshness(opts.freshness),
    provenance: opts.provenance ?? "hub",
    validation: opts.validation ?? "ok",
    data,
  };
}
