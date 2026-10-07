/**
 * Deterministic mistake detection from stored analysis facts + outcomes.
 */
import { randomUUID } from "node:crypto";
import type {
  ForexAnalysisMemoryRecord,
  ForexMistakeCategory,
  ForexMistakeRecord,
  ForexMistakeSeverity,
  ForexScenarioOutcomeRecord,
} from "./types.js";

function severityFor(category: ForexMistakeCategory): ForexMistakeSeverity {
  switch (category) {
    case "AI_HALLUCINATION_BLOCKED":
    case "WRONG_DIRECTION":
    case "TIMEFRAME_CONFLICT_IGNORED":
      return "HIGH";
    case "DATA_STALE":
    case "INVALIDATION_MISSED":
    case "MODEL_OUTPUT_INVALID":
    case "ANALYSIS_TIMEOUT":
      return "MEDIUM";
    default:
      return "LOW";
  }
}

export function detectMistakesForAnalysis(
  analysis: ForexAnalysisMemoryRecord,
  outcome: ForexScenarioOutcomeRecord | null,
): ForexMistakeRecord[] {
  const out: ForexMistakeRecord[] = [];
  const push = (category: ForexMistakeCategory, description: string, evidence: string[]) => {
    out.push({
      id: randomUUID(),
      analysisId: analysis.id,
      category,
      severity: severityFor(category),
      description,
      evidence,
      detectedAt: new Date().toISOString(),
      resolved: false,
      resolution: null,
      symbol: analysis.symbol,
      scenario: analysis.scenario,
    });
  };

  if (analysis.dataQuality === "STALE" || analysis.dataQuality === "DISCONNECTED") {
    push("DATA_STALE", "Analysis was generated while market data quality was degraded.", [
      `dataQuality=${analysis.dataQuality}`,
    ]);
  }

  if (analysis.analysisStatus === "INSUFFICIENT_DATA") {
    push("INSUFFICIENT_DATA", "Analysis stored with insufficient market data.", [
      `analysisStatus=${analysis.analysisStatus}`,
    ]);
  }

  if (analysis.alignment === "CONFLICTING" || analysis.alignment === "MIXED") {
    const interp = (analysis.aiInterpretation ?? "").toLowerCase();
    if (/\b(strongly aligned|fully aligned|perfect alignment)\b/.test(interp)) {
      push("TIMEFRAME_CONFLICT_IGNORED", "AI interpretation claimed strong alignment despite mixed/conflicting MTF state.", [
        `alignment=${analysis.alignment}`,
        `interpretation=${analysis.aiInterpretation?.slice(0, 160)}`,
      ]);
    }
  }

  if (analysis.entryZone?.status === "UNAVAILABLE") {
    push("ENTRY_ZONE_UNAVAILABLE", "Entry zone was unavailable for this scenario.", [
      analysis.entryZone.unavailableReason ?? "ENTRY_ZONE_UNAVAILABLE",
    ]);
  }

  if (
    analysis.entryZone
    && analysis.entryZone.lowerBound != null
    && analysis.entryZone.upperBound != null
    && analysis.entryZone.upperBound > analysis.entryZone.lowerBound
  ) {
    const width = analysis.entryZone.upperBound - analysis.entryZone.lowerBound;
    const mid = (analysis.entryZone.upperBound + analysis.entryZone.lowerBound) / 2;
    if (mid > 0 && width / mid > 0.05) {
      push("ENTRY_ZONE_TOO_WIDE", "Entry zone width exceeds 5% of mid price (heuristic).", [
        `width=${width}`,
        `mid=${mid}`,
      ]);
    }
  }

  if (analysis.narrativeStatus === "DETERMINISTIC_ONLY" || analysis.narrativeStatus === "MARKET_STATE_ONLY") {
    push("MODEL_OUTPUT_INVALID", "Model narrative unavailable; deterministic/fallback path used.", [
      `narrativeStatus=${analysis.narrativeStatus}`,
    ]);
  }

  if (outcome?.status === "INVALIDATED" && analysis.scenarioDirection && analysis.scenario) {
    push("WRONG_DIRECTION", "Scenario was later invalidated against stored conditions.", [
      `scenario=${analysis.scenario}`,
      `outcome=${outcome.status}`,
      ...(outcome.evidence.slice(0, 3)),
    ]);
  }

  if (outcome?.status === "EXPIRED" && !outcome.confirmationReached) {
    push("LATE_CONFIRMATION", "Confirmation never observed within evaluation horizon.", [
      `expires related outcome=${outcome.id}`,
    ]);
  }

  return out;
}
