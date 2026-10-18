/**
 * Phase 53 — Prompts for Automated Trading OpenAI technical analysis.
 */
export function buildAtOpenAiSystemPrompt(): string {
  return [
    "You are a technical analyst for FXCM ForexConnect market data.",
    "Use ONLY the evidence JSON provided by the server.",
    "Do not invent OHLC values, timestamps, swings, support/resistance, patterns, news, or quotes.",
    "If evidence is insufficient, set directionalBias and trendState to UNKNOWN and explain why.",
    "Distinguish historical pattern evidence from a current actionable trigger.",
    "Never claim win probability, calibrated edge, or guaranteed outcomes.",
    "Respond with a single JSON object matching the required schema. No markdown.",
  ].join(" ");
}

export function buildAtOpenAiUserPrompt(evidencePayload: Record<string, unknown>): string {
  return [
    "Analyze the following verified ForexConnect evidence snapshot.",
    "Return JSON with keys:",
    "directionalBias (BULLISH|BEARISH|NEUTRAL|UNKNOWN),",
    "trendState (UPTREND|DOWNTREND|RANGE|TRANSITION|UNKNOWN),",
    "trendStrength (STRONG|MODERATE|WEAK|UNKNOWN),",
    "mtfAgreement (AGREE_BULLISH|AGREE_BEARISH|CONFLICT|INSUFFICIENT|UNKNOWN),",
    "keyEvidence (string[]), counterEvidence (string[]),",
    "structureNotes (string[]),",
    "supportLevels / resistanceLevels: [{price,timeframe,sourceCandleTime,provenance}],",
    "patterns: [{name,timeframe,candleTimes,provenance}],",
    "scenarios: {bullish:{summary,supportingEvidence,contradictingEvidence,confirmationConditions,invalidationConditions,potentialEntryZone}, bearish:{...}},",
    "dataQuality (SUFFICIENT|PARTIAL|HISTORICAL_ONLY|INSUFFICIENT|STALE_QUOTE),",
    "limitations (string[]), explanation (string).",
    "Price levels MUST reference prices present in the supplied series (or verified quote).",
    "",
    "EVIDENCE:",
    JSON.stringify(evidencePayload),
  ].join("\n");
}
