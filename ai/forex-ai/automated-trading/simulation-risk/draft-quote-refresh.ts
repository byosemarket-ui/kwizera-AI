/**
 * Phase 56.4.2 — Authoritative quote refresh at simulation-draft validation boundary.
 * Never reuses an aged lastVerification merely because an earlier Verify passed.
 * LIVE requires genuine Offers Bid/Ask price-change age within MARKET_QUOTE_STALE_MS.
 */
import { createHash } from "node:crypto";
import {
  MARKET_QUOTE_STALE_MS,
  type AtQuoteFreshnessReasonCode,
} from "../quote-freshness.js";

export interface DraftQuoteSnapshot {
  snapshotId: string;
  instrument: string;
  bid: number;
  ask: number;
  mid: number;
  streamState: string;
  sourceTimestampMs: number | null;
  receivedAtMs: number | null;
  priceChangeAgeMs: number | null;
  receiptAgeMs: number | null;
  updateCount: number;
  observedAtUtc: string;
  source: "forexconnect-live-offers";
  fresh: boolean;
  reasonCode: AtQuoteFreshnessReasonCode | "QUOTE_INVALID" | "QUOTE_MISSING";
  staleMs: number;
}

export type DraftQuoteRefreshResult =
  | { ok: true; snapshot: DraftQuoteSnapshot }
  | {
    ok: false;
    code: string;
    message: string;
    snapshot: DraftQuoteSnapshot | null;
  };

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function snapshotIdOf(parts: Record<string, unknown>): string {
  const h = createHash("sha256");
  h.update(JSON.stringify(parts));
  return `dq_${h.digest("hex").slice(0, 16)}`;
}

/**
 * Evaluate a live Offers quote for draft validation (not aged verification snapshot).
 */
export function evaluateDraftBoundaryQuote(input: {
  instrument: string;
  bid: number | null | undefined;
  ask: number | null | undefined;
  streamState: string | null | undefined;
  sourceTimestampMs?: number | null;
  receivedAtMs?: number | null;
  priceChangeAgeMs?: number | null;
  receiptAgeMs?: number | null;
  updateCount?: number | null;
  nowMs?: number;
  staleMs?: number;
}): DraftQuoteRefreshResult {
  const nowMs = input.nowMs ?? Date.now();
  const staleMs = input.staleMs ?? MARKET_QUOTE_STALE_MS;
  const instrument = String(input.instrument ?? "").trim() || "UNKNOWN";
  const streamState = String(input.streamState ?? "").toUpperCase();
  const observedAtUtc = new Date(nowMs).toISOString();

  const baseMeta = {
    instrument,
    streamState,
    sourceTimestampMs: input.sourceTimestampMs ?? null,
    receivedAtMs: input.receivedAtMs ?? null,
    priceChangeAgeMs: input.priceChangeAgeMs ?? null,
    receiptAgeMs: input.receiptAgeMs ?? null,
    updateCount: typeof input.updateCount === "number" ? Math.max(0, Math.floor(input.updateCount)) : 0,
    observedAtUtc,
    source: "forexconnect-live-offers" as const,
    staleMs,
  };

  if (!finitePositive(input.bid) || !finitePositive(input.ask)) {
    const snapshot: DraftQuoteSnapshot = {
      ...baseMeta,
      snapshotId: snapshotIdOf({ ...baseMeta, bid: input.bid, ask: input.ask }),
      bid: Number(input.bid) || 0,
      ask: Number(input.ask) || 0,
      mid: 0,
      fresh: false,
      reasonCode: "QUOTE_MISSING",
    };
    return {
      ok: false,
      code: "QUOTE_MISSING",
      message: "Bid/ask missing or non-positive at draft validation boundary.",
      snapshot,
    };
  }

  if (input.ask < input.bid) {
    const mid = (input.bid + input.ask) / 2;
    const snapshot: DraftQuoteSnapshot = {
      ...baseMeta,
      snapshotId: snapshotIdOf({ ...baseMeta, bid: input.bid, ask: input.ask }),
      bid: input.bid,
      ask: input.ask,
      mid,
      fresh: false,
      reasonCode: "QUOTE_INVALID",
    };
    return {
      ok: false,
      code: "QUOTE_INVALID",
      message: "Crossed or malformed quote (ask < bid) — draft rejected.",
      snapshot,
    };
  }

  if (streamState !== "LIVE") {
    const mid = (input.bid + input.ask) / 2;
    const reason: AtQuoteFreshnessReasonCode =
      streamState === "STALE" || streamState === "NO_RECENT_MARKET_UPDATES"
        ? streamState === "STALE"
          ? "QUOTE_AGE_EXCEEDED"
          : "HEARTBEAT_ONLY_NO_PRICE_CHANGE"
        : "FEED_NOT_LIVE";
    const snapshot: DraftQuoteSnapshot = {
      ...baseMeta,
      snapshotId: snapshotIdOf({ ...baseMeta, bid: input.bid, ask: input.ask, streamState }),
      bid: input.bid,
      ask: input.ask,
      mid,
      fresh: false,
      reasonCode: reason,
    };
    return {
      ok: false,
      code: reason === "QUOTE_AGE_EXCEEDED" ? "QUOTE_STALE" : "FEED_NOT_LIVE",
      message:
        `Feed is ${streamState || "UNKNOWN"} at draft boundary — LIVE Offers price changes required.`,
      snapshot,
    };
  }

  const priceAge = input.priceChangeAgeMs;
  if (priceAge == null || !Number.isFinite(priceAge)) {
    const mid = (input.bid + input.ask) / 2;
    const snapshot: DraftQuoteSnapshot = {
      ...baseMeta,
      snapshotId: snapshotIdOf({ ...baseMeta, bid: input.bid, ask: input.ask }),
      bid: input.bid,
      ask: input.ask,
      mid,
      fresh: false,
      reasonCode: "PRICE_CHANGE_AGE_UNKNOWN",
    };
    return {
      ok: false,
      code: "QUOTE_STALE",
      message:
        "No genuine Bid/Ask price-change age at draft boundary (heartbeat-only receipts are not fresh).",
      snapshot,
    };
  }

  if (priceAge > staleMs) {
    const mid = (input.bid + input.ask) / 2;
    const snapshot: DraftQuoteSnapshot = {
      ...baseMeta,
      snapshotId: snapshotIdOf({ ...baseMeta, bid: input.bid, ask: input.ask, priceAge }),
      bid: input.bid,
      ask: input.ask,
      mid,
      fresh: false,
      reasonCode: "QUOTE_AGE_EXCEEDED",
    };
    return {
      ok: false,
      code: "QUOTE_STALE",
      message:
        `Quote price-change age ${Math.round(priceAge)}ms exceeds freshness limit ${staleMs}ms.`,
      snapshot,
    };
  }

  const mid = (input.bid + input.ask) / 2;
  const snapshot: DraftQuoteSnapshot = {
    ...baseMeta,
    snapshotId: snapshotIdOf({
      ...baseMeta,
      bid: input.bid,
      ask: input.ask,
      priceAge,
      updateCount: baseMeta.updateCount,
    }),
    bid: input.bid,
    ask: input.ask,
    mid,
    fresh: true,
    reasonCode: "LIVE_FRESH",
  };
  return { ok: true, snapshot };
}
