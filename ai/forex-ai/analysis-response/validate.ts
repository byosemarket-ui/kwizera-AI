/**
 * Phase 46 — Validate trade allocation and guided response shape.
 */
import type { GuidedAnalysisResponse, TradeAllocationInput } from "./types.js";
import { FOREX_GUIDED_ANALYSIS_SCHEMA } from "./types.js";

const CURRENCY_RE = /^[A-Z]{3}$/;

export function validateTradeAllocation(
  raw: unknown,
): { ok: true; value: TradeAllocationInput } | { ok: false; message: string } {
  if (raw == null || typeof raw !== "object") {
    return { ok: false, message: "tradeAllocation must be an object." };
  }
  const o = raw as Record<string, unknown>;
  const amount = Number(o.amount);
  const currency = String(o.currency ?? "").trim().toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "tradeAllocation.amount must be a positive finite number." };
  }
  if (!CURRENCY_RE.test(currency)) {
    return { ok: false, message: "tradeAllocation.currency must be a 3-letter ISO code." };
  }
  return { ok: true, value: { amount, currency } };
}

export function isGuidedAnalysisResponse(value: unknown): value is GuidedAnalysisResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as GuidedAnalysisResponse;
  return v.schemaVersion === FOREX_GUIDED_ANALYSIS_SCHEMA
    && !!v.marketSummary
    && !!v.evidence
    && Array.isArray(v.orderTicketByPlan)
    && !!v.finalDecision;
}
