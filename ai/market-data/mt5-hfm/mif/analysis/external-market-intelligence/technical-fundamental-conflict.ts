/**
 * Preserve conflicts between optional technical bias and fundamental context.
 * Never averages into a forced directional decision.
 */
import type {
  HfmEventRiskClass,
  HfmTechnicalFundamentalAlignment,
} from "./types.js";

export function classifyTechnicalFundamentalAlignment(input: {
  technicalBias: "BULLISH" | "BEARISH" | "NEUTRAL" | "MIXED" | "UNKNOWN" | null;
  fundamentalBias: "BULLISH" | "BEARISH" | "NEUTRAL" | "MIXED" | "UNKNOWN" | null;
  eventRisk: HfmEventRiskClass;
  hasFundamentalEvents: boolean;
}): HfmTechnicalFundamentalAlignment {
  if (!input.hasFundamentalEvents) {
    return "INSUFFICIENT_FUNDAMENTAL_DATA";
  }

  const tech = input.technicalBias;
  const fund = input.fundamentalBias;

  if (
    input.eventRisk === "HIGH_EVENT_RISK"
    || input.eventRisk === "ELEVATED_EVENT_RISK"
  ) {
    // Elevated event risk can coexist with alignment/conflict — surface risk first
    // when fundamental directional bias is unavailable.
    if (!fund || fund === "UNKNOWN" || fund === "NEUTRAL") {
      return "FUNDAMENTAL_EVENT_RISK_ELEVATED";
    }
  }

  if (!tech || tech === "UNKNOWN" || !fund || fund === "UNKNOWN") {
    if (fund === "NEUTRAL" || tech === "NEUTRAL") return "FUNDAMENTAL_CONTEXT_NEUTRAL";
    if (tech === "MIXED" || fund === "MIXED") return "MIXED_EVIDENCE";
    return "INSUFFICIENT_FUNDAMENTAL_DATA";
  }

  if (tech === "MIXED" || fund === "MIXED") return "MIXED_EVIDENCE";

  if (tech === "BULLISH" && fund === "BULLISH") {
    return "TECHNICAL_AND_FUNDAMENTAL_ALIGNED_BULLISH";
  }
  if (tech === "BEARISH" && fund === "BEARISH") {
    return "TECHNICAL_AND_FUNDAMENTAL_ALIGNED_BEARISH";
  }
  if (tech === "BULLISH" && fund === "BEARISH") {
    return "TECHNICAL_BULLISH_FUNDAMENTAL_BEARISH";
  }
  if (tech === "BEARISH" && fund === "BULLISH") {
    return "TECHNICAL_BEARISH_FUNDAMENTAL_BULLISH";
  }
  if (tech === "NEUTRAL" && fund === "NEUTRAL") {
    return "FUNDAMENTAL_CONTEXT_NEUTRAL";
  }
  if (
    input.eventRisk === "HIGH_EVENT_RISK"
    || input.eventRisk === "ELEVATED_EVENT_RISK"
  ) {
    return "FUNDAMENTAL_EVENT_RISK_ELEVATED";
  }
  return "MIXED_EVIDENCE";
}

/**
 * Fundamental directional bias is intentionally conservative.
 * Surprises alone do NOT imply currency bullish/bearish without indicator taxonomy —
 * return NEUTRAL/UNKNOWN rather than inventing macro interpretation.
 */
export function deriveFundamentalBias(input: {
  releasedWithSurprise: number;
  hasRelevantEvents: boolean;
}): "BULLISH" | "BEARISH" | "NEUTRAL" | "MIXED" | "UNKNOWN" {
  if (!input.hasRelevantEvents) return "UNKNOWN";
  if (input.releasedWithSurprise > 0) {
    // Comparable surprises present but direction for currency is unspecified.
    return "NEUTRAL";
  }
  return "NEUTRAL";
}
