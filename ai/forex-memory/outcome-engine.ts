/**
 * Deterministic outcome evaluation — never asks the LLM "was this correct?".
 */
import { randomUUID } from "node:crypto";
import type {
  ForexAnalysisMemoryRecord,
  ForexScenarioOutcomeRecord,
  ForexScenarioOutcomeStatus,
} from "./types.js";

export interface OutcomeEvaluationInput {
  analysis: ForexAnalysisMemoryRecord;
  /** Authoritative later market price for the evaluation timeframe (server-sourced). */
  laterPrice: number | null;
  laterTimestamp: string | null;
  /** If historical reconstruct failed. */
  historicalAvailable: boolean;
  nowMs?: number;
}

function zoneTouched(analysis: ForexAnalysisMemoryRecord, price: number): boolean {
  const z = analysis.entryZone;
  if (!z || z.status === "UNAVAILABLE" || z.lowerBound == null || z.upperBound == null) return false;
  return price >= z.lowerBound && price <= z.upperBound;
}

function invalidationHit(analysis: ForexAnalysisMemoryRecord, price: number): boolean {
  const level = analysis.entryZone?.invalidationLevel ?? analysis.stopLossCandidate;
  if (level == null || !Number.isFinite(level)) return false;
  const dir = String(analysis.scenarioDirection ?? "").toUpperCase();
  if (dir === "BULLISH") return price < level;
  if (dir === "BEARISH") return price > level;
  return false;
}

function targetHit(analysis: ForexAnalysisMemoryRecord, price: number): boolean[] {
  return analysis.takeProfitCandidates.map((tp) => {
    const dir = String(analysis.scenarioDirection ?? "").toUpperCase();
    if (dir === "BULLISH") return price >= tp;
    if (dir === "BEARISH") return price <= tp;
    return false;
  });
}

export function evaluateScenarioOutcome(input: OutcomeEvaluationInput): ForexScenarioOutcomeRecord {
  const { analysis } = input;
  const nowMs = input.nowMs ?? Date.now();
  const generatedMs = Date.parse(analysis.generatedAt);
  const expired = Number.isFinite(generatedMs) && nowMs >= Date.parse(analysis.expiresAt);

  const eventOrder: string[] = [];
  const evidence: string[] = [];
  let status: ForexScenarioOutcomeStatus = "PENDING";
  let touched = false;
  let touchAt: string | null = null;
  let confirmationReached = false;
  let invalidationReached = false;
  let targets: boolean[] = [];

  if (!input.historicalAvailable && input.laterPrice == null) {
    status = "INSUFFICIENT_DATA";
    evidence.push("Historical/later market price unavailable for evaluation.");
  } else if (input.laterPrice == null || !Number.isFinite(input.laterPrice)) {
    status = "INCONCLUSIVE";
    evidence.push("Later price not finite.");
  } else if (
    analysis.analysisStatus === "INSUFFICIENT_DATA"
    || !analysis.scenario
    || analysis.scenario === "INSUFFICIENT_DATA"
    || analysis.scenario === "WAIT"
    || analysis.scenario === "CONFLICT"
  ) {
    status = "INCONCLUSIVE";
    evidence.push(`Scenario ${analysis.scenario ?? "none"} is not objectively evaluable.`);
  } else {
    const price = input.laterPrice;
    evidence.push(`laterPrice=${price}`, `laterTimestamp=${input.laterTimestamp ?? "n/a"}`);

    touched = zoneTouched(analysis, price);
    if (touched) {
      eventOrder.push("ZONE_TOUCHED");
      touchAt = input.laterTimestamp ?? new Date(nowMs).toISOString();
    }

    invalidationReached = invalidationHit(analysis, price);
    if (invalidationReached) {
      eventOrder.push("INVALIDATION_REACHED");
    }

    targets = targetHit(analysis, price);
    if (targets.some(Boolean)) eventOrder.push("TARGET_REACHED");

    // Confirmation heuristic: for continuation/pullback, LTF conditions that were NOT_MET
    // are considered reached if price moved toward scenario direction past reference without invalidation.
    const ref = analysis.entryZone?.referencePrice;
    const dir = String(analysis.scenarioDirection ?? "").toUpperCase();
    if (!invalidationReached && ref != null) {
      if (dir === "BULLISH" && price >= ref) confirmationReached = true;
      if (dir === "BEARISH" && price <= ref) confirmationReached = true;
    }
    // Also: if original confirmation all MET already at store time
    if (analysis.confirmationConditions.length > 0
      && analysis.confirmationConditions.every((c) => c.status === "MET" || c.status === "NOT_APPLICABLE")) {
      confirmationReached = true;
    }
    if (confirmationReached) eventOrder.push("CONFIRMATION_REACHED");

    if (invalidationReached && !confirmationReached) {
      status = "INVALIDATED";
    } else if (invalidationReached && confirmationReached) {
      // whichever conceptually — both observed; prefer invalidated if invalidation level breached
      status = "INVALIDATED";
    } else if (confirmationReached && targets.some(Boolean)) {
      status = "CONFIRMED";
    } else if (confirmationReached || touched) {
      status = "PARTIALLY_CONFIRMED";
    } else if (expired) {
      status = "EXPIRED";
      eventOrder.push("EXPIRED");
    } else {
      status = "PENDING";
    }
  }

  const learningNote = status === "PENDING"
    ? "Outcome still pending within evaluation horizon."
    : status === "CONFIRMED"
      ? "Scenario conditions were met without prior invalidation within the evaluation window."
      : status === "INVALIDATED"
        ? "Invalidation level or opposing structure condition was reached."
        : status === "EXPIRED"
          ? "Confirmation was never observed within the evaluation horizon."
          : status === "PARTIALLY_CONFIRMED"
            ? "Partial progress (zone touch and/or confirmation) without full target confirmation."
            : "Outcome could not be concluded from available facts.";

  return {
    id: randomUUID(),
    analysisId: analysis.id,
    symbol: analysis.symbol,
    scenario: analysis.scenario,
    status,
    zoneTouched: touched,
    zoneTouchAt: touchAt,
    confirmationReached,
    invalidationReached,
    targetReached: targets,
    eventOrder,
    evaluatedAt: new Date(nowMs).toISOString(),
    evaluationHorizonCandles: analysis.evaluationHorizonCandles,
    notes: evidence,
    learningNote,
    evidence,
  };
}
