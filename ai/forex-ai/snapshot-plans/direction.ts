/**
 * Map analysis bias + structure evidence to Phase 44 market direction.
 */
import type { SnapshotMarketDirection, SnapshotStructureEvidenceSummary } from "./types.js";

export function directionMeaning(dir: SnapshotMarketDirection): string {
  switch (dir) {
    case "BULLISH":
      return "Price structure and evidence favor upside continuation or bullish scenarios.";
    case "BEARISH":
      return "Price structure and evidence favor downside continuation or bearish scenarios.";
    case "SIDEWAYS":
      return "Price is ranging between support and resistance without a clear directional break.";
    case "UNCERTAIN":
    default:
      return "Evidence is incomplete, conflicting, or too weak to assert a directional bias.";
  }
}

export function classifyMarketDirection(input: {
  marketBias: string | null | undefined;
  decision: string | null | undefined;
  structure: SnapshotStructureEvidenceSummary;
  keyEvidence: string[];
}): { direction: SnapshotMarketDirection; explanation: string } {
  const bias = String(input.marketBias ?? "").trim().toUpperCase();
  const decision = String(input.decision ?? "").trim().toUpperCase();
  const trend = input.structure.trendState;

  if (!input.structure.dataUsable || input.structure.insufficientHistory) {
    return {
      direction: "UNCERTAIN",
      explanation:
        "Instrument data is incomplete, stale, or insufficient for a reliable directional classification.",
    };
  }

  if (trend === "RANGE" || /SIDEWAYS|RANGE|RANGING|NEUTRAL/.test(bias)) {
    return {
      direction: "SIDEWAYS",
      explanation:
        "Structure or model bias indicates a ranging market. Directional BUY/SELL is not forced.",
    };
  }

  if (trend === "BULLISH" || bias === "BULLISH" || bias === "BULL") {
    return {
      direction: "BULLISH",
      explanation: [
        `Classified BULLISH from ${trend === "BULLISH" ? "structure trendState" : "model marketBias"}.`,
        decision === "SELL"
          ? "Model decision is SELL — treat as conflict risk; plans may still be bearish-leaning pullbacks only if evidence supports them."
          : "",
      ].filter(Boolean).join(" "),
    };
  }

  if (trend === "BEARISH" || bias === "BEARISH" || bias === "BEAR") {
    return {
      direction: "BEARISH",
      explanation: [
        `Classified BEARISH from ${trend === "BEARISH" ? "structure trendState" : "model marketBias"}.`,
        decision === "BUY"
          ? "Model decision is BUY — treat as conflict risk against bearish structure."
          : "",
      ].filter(Boolean).join(" "),
    };
  }

  // Phase 50C — completed BUY/SELL analysis decisions seed market-direction lean for plans.
  // Entry-plan WAIT remains possible when structure/zones are insufficient.
  if (decision === "BUY") {
    return {
      direction: "BULLISH",
      explanation:
        "Directional decision is BUY — market-direction lean BULLISH for plan context. "
        + "Entry readiness still depends on structure zones and confirmation.",
    };
  }
  if (decision === "SELL") {
    return {
      direction: "BEARISH",
      explanation:
        "Directional decision is SELL — market-direction lean BEARISH for plan context. "
        + "Entry readiness still depends on structure zones and confirmation.",
    };
  }

  if (decision === "WAIT" || decision === "NO_TRADE" || trend === "UNKNOWN" || !bias) {
    return {
      direction: "UNCERTAIN",
      explanation:
        "Bias/structure do not support a clear BULLISH, BEARISH, or SIDEWAYS classification.",
    };
  }

  return {
    direction: "UNCERTAIN",
    explanation: `Unrecognized bias "${input.marketBias ?? ""}" with structure trend ${trend ?? "null"}.`,
  };
}

export function confidenceDisplay(raw: string | null | undefined): string {
  const t = String(raw ?? "").trim();
  if (!t) return "N/A";
  // Never invent percentages; surface model-reported text only.
  if (/^\d+(\.\d+)?%?$/.test(t) && !t.includes("%")) {
    return `${t} (model-reported; not a calibrated profit probability)`;
  }
  return `${t} (model-reported; not a calibrated profit probability)`;
}
