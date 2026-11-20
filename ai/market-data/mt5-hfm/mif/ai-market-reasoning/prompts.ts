/**
 * Phase 5E Step 3 — prompt builders for AI Market Reasoning.
 */
import {
  MIF_AI_MARKET_REASONING_DISCLAIMER,
  MIF_AI_MARKET_REASONING_PROMPT_VERSION,
} from "./contracts.js";
import type { MifAiReasoningContext } from "./types.js";

export function buildMifAiReasoningSystemPrompt(): string {
  return [
    "You are KWIZERA AI STUDIO Market Analyst for HFM_MT5.",
    "You produce structured JSON market reasoning grounded ONLY in the supplied context.",
    MIF_AI_MARKET_REASONING_DISCLAIMER,
    "",
    "Rules:",
    "1. Never invent evidence IDs, prices, levels, probabilities, or win rates.",
    "2. Cite evidence only using evidenceId values present in availableEvidenceIds.",
    "3. Ranking score is NOT probability. Null probability is NOT zero.",
    "4. FORMING candles are never CLOSED confirmations.",
    "5. Preserve contradictions; do not erase MTF conflicts.",
    "6. Provide BOTH bullishScenario and bearishScenario. Do not force BUY/SELL.",
    "7. Scenario status CONFIRMED only if context has explicit CLOSED confirmation evidence;",
    "   otherwise use WAITING_FOR_CONFIRMATION, DEVELOPING, LOW_EVIDENCE, or ACTIVE.",
    "8. priceContextStatus must be LEVELS_NOT_PROVIDED unless context.structuredLevels.hasAnyFinite is true.",
    "   Never claim AVAILABLE_FROM_SOURCE without structured entry/target/invalidation prices in context.",
    "   Never invent numeric prices; only echo values present in structuredLevels.",
    "9. Distinguish AI_INTERPRETATION / HYPOTHESIS from ENGINE_DERIVED facts in claimKinds.",
    "10. Output MUST be a single JSON object matching the required schema. No markdown.",
    "",
    `promptVersion=${MIF_AI_MARKET_REASONING_PROMPT_VERSION}`,
  ].join("\n");
}

export function buildMifAiReasoningUserPrompt(ctx: MifAiReasoningContext): string {
  const schema = {
    marketOverview: "string",
    higherTimeframeAnalysis: "string",
    intermediateTimeframeAnalysis: "string",
    lowerTimeframeAnalysis: "string",
    marketStructureAnalysis: "string",
    marketRegimeAnalysis: "string",
    liquidityAnalysis: "string",
    momentumAnalysis: "string",
    displacementAnalysis: "string",
    patternAnalysis: "string",
    opportunityAnalysis: "string",
    rankingInterpretation: "string",
    probabilityInterpretation: "string",
    evidenceSummary: "string",
    bullishScenario: {
      side: "BULLISH",
      status:
        "ACTIVE|DEVELOPING|WAITING_FOR_CONFIRMATION|CONFIRMED|INVALIDATED|LOW_EVIDENCE|BLOCKED",
      summary: "string",
      supportingEvidenceRefs: ["evidenceId"],
      contradictingEvidenceRefs: ["evidenceId"],
      missingEvidence: ["string"],
      confirmationConditions: ["string"],
      invalidationConditions: ["string"],
      claimKinds: ["OBSERVED_FACT|ENGINE_DERIVED|HISTORICAL_STATISTICAL|AI_INTERPRETATION|HYPOTHESIS|UNKNOWN"],
      priceContextStatus: "AVAILABLE_FROM_SOURCE|LEVELS_NOT_PROVIDED|STALE|NOT_APPLICABLE",
      priceContextNotes: ["string"],
    },
    bearishScenario: { "...": "same shape with side=BEARISH" },
    scenarioComparison: "string",
    confirmationConditions: ["string"],
    invalidationConditions: ["string"],
    missingInformation: ["string"],
    contradictions: ["string"],
    reasoningConclusion: "string",
    reasoningLimitations: ["string"],
    evidenceSupportStatus:
      "HIGH_EVIDENCE_SUPPORT|MODERATE_EVIDENCE_SUPPORT|LOW_EVIDENCE_SUPPORT|INSUFFICIENT_EVIDENCE|CONFLICTED|UNAVAILABLE",
    citedEvidenceRefs: ["evidenceId from availableEvidenceIds only"],
  };

  return [
    "Analyze the following HFM_MT5 MIF context and return JSON only.",
    "",
    "CONTEXT_JSON:",
    JSON.stringify(ctx),
    "",
    "REQUIRED_OUTPUT_SCHEMA:",
    JSON.stringify(schema),
    "",
    "Remember: do not invent numbers or evidence IDs. If unsure, say so in missingInformation.",
  ].join("\n");
}
