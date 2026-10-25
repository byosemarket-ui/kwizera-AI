/**
 * Phase 59.0 — Validate an analysis decision before order construction.
 * WAIT / NO-TRADE / REJECTED / incomplete / contradictory → reject.
 * Does not invent direction from confidence alone.
 */
import type { AtDecisionResult } from "../decision/types.js";
import type { AtExecutionRejection } from "./types.js";

export interface ValidateDecisionForExecutionInput {
  decision: AtDecisionResult | null | undefined;
  /** When set, decision.instrument must match (case-insensitive). */
  expectedInstrument?: string | null;
  /** Max age of decidedAtUtc; null skips age check. */
  maxDecisionAgeMs?: number | null;
  nowMs?: number;
}

export interface ValidateDecisionForExecutionResult {
  ok: boolean;
  direction: "BUY" | "SELL" | null;
  instrument: string | null;
  rejections: AtExecutionRejection[];
}

export function validateDecisionForExecution(
  input: ValidateDecisionForExecutionInput,
): ValidateDecisionForExecutionResult {
  const rejections: AtExecutionRejection[] = [];
  const d = input.decision;

  if (!d) {
    rejections.push({
      code: "DECISION_MISSING",
      message: "No trading decision provided — executor does not invent trades.",
    });
    return { ok: false, direction: null, instrument: null, rejections };
  }

  if (d.decisionStatus !== "ACCEPTED_FOR_REVIEW") {
    rejections.push({
      code: "DECISION_NOT_ACCEPTED",
      message: `decisionStatus=${d.decisionStatus} — only ACCEPTED_FOR_REVIEW may proceed to order construction.`,
    });
  }

  if (d.direction !== "BUY" && d.direction !== "SELL") {
    rejections.push({
      code: "WAIT_OR_NO_TRADE",
      message:
        "Direction is missing/null (WAIT/NO-TRADE). WAIT must never produce an order; direction is not inferred from confidence.",
    });
  }

  if (d.placesOrders !== false || d.acceptsForExecution !== false) {
    rejections.push({
      code: "DECISION_SAFETY_FLAGS_INVALID",
      message: "Decision must retain placesOrders=false and acceptsForExecution=false.",
    });
  }

  if (d.verification?.readyForTrading === true) {
    rejections.push({
      code: "DECISION_READY_FOR_TRADING_ASSERTION",
      message:
        "Decision must not claim readyForTrading=true; Phase 59 keeps that gate false on analysis decisions.",
    });
  }

  const instrument = d.instrument != null ? String(d.instrument).trim() : "";
  if (!instrument) {
    rejections.push({
      code: "DECISION_INSTRUMENT_MISSING",
      message: "Decision instrument is required.",
    });
  }

  const expected = input.expectedInstrument != null
    ? String(input.expectedInstrument).trim()
    : "";
  if (expected && instrument && expected.toUpperCase() !== instrument.toUpperCase()) {
    rejections.push({
      code: "DECISION_INSTRUMENT_MISMATCH",
      message: `Decision instrument ${instrument} does not match expected ${expected}.`,
    });
  }

  const maxAge = input.maxDecisionAgeMs;
  if (maxAge != null && Number.isFinite(maxAge) && maxAge > 0 && d.decidedAtUtc) {
    const decidedMs = Date.parse(d.decidedAtUtc);
    const now = input.nowMs ?? Date.now();
    if (!Number.isFinite(decidedMs)) {
      rejections.push({
        code: "DECISION_TIMESTAMP_INVALID",
        message: "decidedAtUtc is not a valid timestamp.",
      });
    } else if (now - decidedMs > maxAge) {
      rejections.push({
        code: "DECISION_STALE",
        message: `Decision age exceeds maxDecisionAgeMs=${maxAge}.`,
      });
    }
  }

  const ok = rejections.length === 0;
  return {
    ok,
    direction: ok && (d.direction === "BUY" || d.direction === "SELL") ? d.direction : null,
    instrument: ok ? instrument : instrument || null,
    rejections,
  };
}
