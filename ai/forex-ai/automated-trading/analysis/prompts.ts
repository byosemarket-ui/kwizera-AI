/**
 * Phase 53 / 53.1 — Prompts for Automated Trading OpenAI technical analysis.
 */
export function buildAtOpenAiSystemPrompt(opts?: { withChartImage?: boolean }): string {
  const base = [
    "You are a technical analyst for FXCM ForexConnect market data.",
    "Use ONLY the evidence JSON provided by the server (and the chart image when supplied).",
    "Do not invent OHLC values, timestamps, swings, support/resistance, patterns, news, or quotes.",
    "If evidence is insufficient, set directionalBias and trendState to UNKNOWN and explain why.",
    "Distinguish historical pattern evidence from a current actionable trigger.",
    "Distinguish directional bias from entry readiness and risk eligibility — never authorize orders.",
    "Never claim win probability, calibrated edge, or guaranteed outcomes.",
    "Never claim access to market information that was not supplied.",
    "Respond with a single JSON object matching the required schema. No markdown.",
  ];
  if (opts?.withChartImage) {
    base.push(
      "A server-rendered candlestick chart image is attached. Use it together with the OHLC/quote JSON.",
      "Identify the selected instrument, timeframe, and observation time from the evidence.",
      "If the image and numeric evidence conflict, prefer the numeric OHLC and report the conflict in limitations.",
    );
  }
  return base.join(" ");
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
