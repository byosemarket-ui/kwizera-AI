/**
 * Phase 58.3 — DEMO lifecycle preflight (grant-scoped).
 * Phase 59.0.3 — quote freshness + instrument match are required conditions for maySubmitDemoMutation.
 * Distinct from broker-intent preflight which always ends EXECUTION_DISABLED / XAU-only.
 * Passing this check does not enable global placesOrders.
 */
import { evaluateProtectiveGeometry } from "../broker-intent/protective-geometry.js";
import {
  evaluateExecutionQuoteEvidence,
  type AtQuoteSubscriptionReadinessCode,
} from "../quote-subscription-readiness.js";
import { MARKET_QUOTE_STALE_MS } from "../quote-freshness.js";

export interface DemoLifecyclePreflightInput {
  instrument: string;
  direction: "BUY" | "SELL";
  lots: number;
  maxLots: number;
  environment: string | null;
  sessionConnected: boolean;
  quotePresent: boolean;
  quoteBid: number | null;
  quoteAsk: number | null;
  /** Instrument reported on the offer/quote snapshot (must match request when present). */
  quoteInstrument?: string | null;
  /** Broker/offer timestamp (ISO string, epoch ms, or epoch seconds). */
  quoteTimestamp?: string | number | null;
  /** Precomputed age when available from stream diagnostics. */
  lastQuoteAgeMs?: number | null;
  /** Injected clock for deterministic tests. */
  nowMs?: number;
  freshnessThresholdMs?: number;
  requireProtective: boolean;
  stopLoss: number | null;
  takeProfit: number | null;
  entryHint: number | null;
  grantActive: boolean;
}

export interface DemoLifecyclePreflightResult {
  ok: boolean;
  code: string;
  blockers: string[];
  entryHintUsed: number | null;
  quoteReadinessCode: AtQuoteSubscriptionReadinessCode | null;
  quoteAgeMs: number | null;
  placesOrdersGlobal: false;
  acceptsForExecutionGlobal: false;
  maySubmitDemoMutation: boolean;
}

export function evaluateDemoLifecyclePreflight(
  input: DemoLifecyclePreflightInput,
): DemoLifecyclePreflightResult {
  const blockers: string[] = [];

  if (!input.grantActive) blockers.push("NO_ACTIVE_DEMO_GRANT");
  if (!input.sessionConnected) blockers.push("SESSION_NOT_CONNECTED");
  const env = String(input.environment || "").toLowerCase();
  if (env !== "demo") blockers.push("ENVIRONMENT_NOT_DEMO");
  if (!String(input.instrument || "").trim()) blockers.push("INSTRUMENT_REQUIRED");
  if (input.direction !== "BUY" && input.direction !== "SELL") blockers.push("DIRECTION_INVALID");
  if (!Number.isInteger(input.lots) || input.lots < 1) blockers.push("LOTS_INVALID");
  if (input.lots > input.maxLots) blockers.push("LOTS_EXCEED_GRANT");

  let quoteReadinessCode: AtQuoteSubscriptionReadinessCode | null = null;
  let quoteAgeMs: number | null = null;

  if (!input.quotePresent || input.quoteBid == null || input.quoteAsk == null) {
    blockers.push("QUOTE_UNAVAILABLE");
    quoteReadinessCode = "QUOTE_NOT_RECEIVED";
  } else {
    const evidence = evaluateExecutionQuoteEvidence({
      requestedInstrument: String(input.instrument || "").trim(),
      quoteInstrument: input.quoteInstrument ?? input.instrument,
      bid: input.quoteBid,
      ask: input.quoteAsk,
      lastQuoteAt: input.quoteTimestamp,
      lastQuoteAgeMs: input.lastQuoteAgeMs,
      nowMs: input.nowMs,
      freshnessThresholdMs: input.freshnessThresholdMs ?? MARKET_QUOTE_STALE_MS,
    });
    quoteReadinessCode = evidence.code;
    quoteAgeMs = evidence.quoteAgeMs;
    if (!evidence.readyForExecutionQuote) {
      // Authoritative gate: missing age, stale, crossed, mismatch, etc.
      blockers.push(evidence.code);
      if (evidence.code === "QUOTE_NOT_RECEIVED") blockers.push("QUOTE_UNAVAILABLE");
    }
  }

  let entryHintUsed: number | null = input.entryHint;
  if (
    (entryHintUsed == null || !Number.isFinite(entryHintUsed))
    && input.quoteBid != null
    && input.quoteAsk != null
  ) {
    entryHintUsed = input.direction === "BUY" ? input.quoteAsk : input.quoteBid;
  }

  if (input.requireProtective) {
    if (input.stopLoss == null || !Number.isFinite(input.stopLoss)) blockers.push("STOP_LOSS_REQUIRED");
    if (input.takeProfit == null || !Number.isFinite(input.takeProfit)) blockers.push("TAKE_PROFIT_REQUIRED");
    if (
      entryHintUsed != null
      && input.stopLoss != null
      && input.takeProfit != null
      && Number.isFinite(input.stopLoss)
      && Number.isFinite(input.takeProfit)
    ) {
      const geometry = evaluateProtectiveGeometry({
        direction: input.direction,
        entryPrice: entryHintUsed,
        stopLoss: input.stopLoss,
        takeProfit: input.takeProfit,
        requireProtective: true,
        requireThreeR: false,
      });
      if (!geometry.ok) {
        for (const r of geometry.rejections) blockers.push(r.code);
      }
    }
  }

  const uniqueBlockers = [...new Set(blockers)];
  const ok = uniqueBlockers.length === 0;
  return {
    ok,
    code: ok ? "DEMO_PREFLIGHT_OK" : uniqueBlockers[0] ?? "DEMO_PREFLIGHT_BLOCKED",
    blockers: uniqueBlockers,
    entryHintUsed,
    quoteReadinessCode,
    quoteAgeMs,
    placesOrdersGlobal: false,
    acceptsForExecutionGlobal: false,
    maySubmitDemoMutation: ok,
  };
}
