/**
 * Phase 53 / 53.1 / 53.2 — Prompts for Automated Trading OpenAI technical analysis.
 */
export function buildAtOpenAiSystemPrompt(opts?: { withChartImage?: boolean }): string {
  const base = [
    "You are a technical analyst for FXCM ForexConnect market data.",
    "Use ONLY the evidence JSON provided by the server (and the chart image when supplied).",
    "Do not invent OHLC values, timestamps, swings, support/resistance, patterns, news, or quotes.",
    "For an eligible prediction you MUST choose direction exactly BUY or SELL for the defined forecastHorizon.",
    "Do not return WAIT, HOLD, NEUTRAL, BOTH, or empty direction for a successful prediction.",
    "If evidence is insufficient or unusable, set dataQuality to INSUFFICIENT and explain why — do not invent BUY/SELL.",
    "Provide directionalConfidencePct as a finite number 0–100 estimating confidence in the chosen direction over the forecast horizon, conditional on supplied evidence.",
    "This percentage is NOT a calibrated win probability, profit probability, or guaranteed outcome.",
    "Base the estimate on evidence quality, structure alignment, timeframe agreement, confirmation vs contradiction, volatility, and freshness.",
    "Distinguish directional forecast from entry readiness and risk eligibility — never authorize orders.",
    "Never claim access to market information that was not supplied.",
    "Respond with a single JSON object matching the required schema. No markdown.",
  ];
  if (opts?.withChartImage) {
    base.push(
      "A server-rendered candlestick chart image is attached. Use it together with the OHLC/quote JSON.",
      "Identify the selected instrument, timeframe, and observation time from the evidence.",
      "If the image and numeric evidence conflict, prefer the numeric OHLC and report the conflict in limitations.",
    );
  } else {
    base.push(
      "No chart image is attached for this request. Do not claim you inspected a chart image.",
    );
  }
  return base.join(" ");
}

export function buildAtOpenAiUserPrompt(evidencePayload: Record<string, unknown>): string {
  return [
    "Analyze the following verified ForexConnect evidence snapshot.",
    "forecastHorizon is defined by the server — predict direction over that horizon only.",
    "Return JSON with keys:",
    "direction (BUY|SELL) — required for a successful prediction,",
    "directionalConfidencePct (0–100 finite number),",
    "directionalBias (BULLISH|BEARISH) matching direction,",
    "trendState (UPTREND|DOWNTREND|RANGE|TRANSITION|UNKNOWN),",
    "trendStrength (STRONG|MODERATE|WEAK|UNKNOWN),",
    "mtfAgreement (AGREE_BULLISH|AGREE_BEARISH|CONFLICT|INSUFFICIENT|UNKNOWN),",
    "keyEvidence (string[]), counterEvidence (string[]),",
    "structureNotes (string[]),",
    "supportLevels / resistanceLevels: [{price,timeframe,sourceCandleTime,provenance}],",
    "patterns: [{name,timeframe,candleTimes,provenance}],",
    "scenarios: {bullish:{summary,supportingEvidence,contradictingEvidence,confirmationConditions,invalidationConditions,potentialEntryZone}, bearish:{...}},",
    "dataQuality (SUFFICIENT|PARTIAL|HISTORICAL_ONLY|INSUFFICIENT|STALE_QUOTE),",
    "limitations (string[]), explanation (string) — include principal evidence for the BUY/SELL choice and confidence drivers.",
    "Price levels MUST reference prices present in the supplied series (or verified quote).",
    "",
    "EVIDENCE:",
    JSON.stringify(evidencePayload),
  ].join("\n");
}
