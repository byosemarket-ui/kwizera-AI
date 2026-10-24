/**
 * Phase 58.3 — DEMO lifecycle preflight (grant-scoped).
 * Distinct from broker-intent preflight which always ends EXECUTION_DISABLED / XAU-only.
 * Passing this check does not enable global placesOrders.
 */
import { evaluateProtectiveGeometry } from "../broker-intent/protective-geometry.js";

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
  if (!input.quotePresent || input.quoteBid == null || input.quoteAsk == null) {
    blockers.push("QUOTE_UNAVAILABLE");
  } else if (!(input.quoteBid > 0) || !(input.quoteAsk > 0) || !(input.quoteAsk >= input.quoteBid)) {
    blockers.push("QUOTE_INVALID");
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

  const ok = blockers.length === 0;
  return {
    ok,
    code: ok ? "DEMO_PREFLIGHT_OK" : blockers[0] ?? "DEMO_PREFLIGHT_BLOCKED",
    blockers,
    entryHintUsed,
    placesOrdersGlobal: false,
    acceptsForExecutionGlobal: false,
    maySubmitDemoMutation: ok,
  };
}
