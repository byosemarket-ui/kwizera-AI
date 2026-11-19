/**
 * Phase 5C Step 3 — market regime relationships across timeframe bands.
 */
import type {
  MifMtfBandSummary,
  MifMtfNormalizedContext,
  MifMtfRegimeRelationship,
} from "./types.js";

export function analyzeRegimeRelationships(input: {
  higher: MifMtfBandSummary;
  intermediate: MifMtfBandSummary;
  lower: MifMtfBandSummary;
  contexts: readonly MifMtfNormalizedContext[];
}): MifMtfRegimeRelationship {
  const pickComposite = (band: string): string | null => {
    const rows = input.contexts.filter((c) => c.band === band && c.regimeComposite);
    if (!rows.length) return null;
    const uniq = [...new Set(rows.map((r) => r.regimeComposite!))];
    return uniq.length === 1 ? uniq[0]! : uniq.join("|");
  };

  const higherRegime = pickComposite("HIGHER") ?? input.higher.consensusStructure;
  const intermediateRegime = pickComposite("INTERMEDIATE") ?? input.intermediate.consensusStructure;
  const lowerRegime = pickComposite("LOWER") ?? input.lower.consensusStructure;

  const vols = input.contexts
    .filter((c) => c.available && c.volatility && c.volatility !== "UNKNOWN")
    .map((c) => c.volatility!);
  const volUniq = [...new Set(vols)];
  const volatilitySpread =
    volUniq.length === 0 ? null : volUniq.length === 1 ? volUniq[0]! : `MIXED:${volUniq.join(",")}`;

  const present = [higherRegime, intermediateRegime, lowerRegime].filter(Boolean);
  if (present.length === 0) {
    return {
      status: "INSUFFICIENT",
      higherRegime,
      intermediateRegime,
      lowerRegime,
      volatilitySpread,
      explanation: "no regime composites available across bands",
    };
  }

  const structs = input.contexts
    .filter((c) => c.available && c.structure)
    .map((c) => c.structure!);
  const hasTransition = structs.some((s) => s === "TRANSITION" || s === "UNSTABLE");
  const trending = structs.filter((s) => s === "TRENDING");
  const ranging = structs.filter((s) => s === "RANGING");
  const breakout = structs.filter((s) => s === "BREAKOUT");

  if (hasTransition) {
    return {
      status: "TRANSITION",
      higherRegime,
      intermediateRegime,
      lowerRegime,
      volatilitySpread,
      explanation: "transition/unstable regime evidence present on one or more timeframes",
    };
  }

  // Higher range + lower breakout — local breakout in larger range.
  if (
    input.higher.consensusStructure === "RANGING"
    && (input.lower.consensusStructure === "BREAKOUT" || input.intermediate.consensusStructure === "BREAKOUT")
  ) {
    return {
      status: "PARTIAL",
      higherRegime,
      intermediateRegime,
      lowerRegime,
      volatilitySpread,
      explanation: "higher-timeframe range with lower/intermediate breakout — local development inside larger range",
    };
  }

  if (trending.length >= 2 && ranging.length === 0 && breakout.length === 0) {
    const dirs = input.contexts
      .filter((c) => c.structure === "TRENDING")
      .map((c) => c.direction);
    const conflict = dirs.includes("UP") && dirs.includes("DOWN");
    if (conflict) {
      return {
        status: "CONFLICT",
        higherRegime,
        intermediateRegime,
        lowerRegime,
        volatilitySpread,
        explanation: "trending structure on multiple TFs but opposing directions — conflict preserved",
      };
    }
    return {
      status: "ALIGNED",
      higherRegime,
      intermediateRegime,
      lowerRegime,
      volatilitySpread,
      explanation: "trending regime alignment across available timeframes",
    };
  }

  if (trending.length > 0 && ranging.length > 0) {
    return {
      status: "PARTIAL",
      higherRegime,
      intermediateRegime,
      lowerRegime,
      volatilitySpread,
      explanation: "mixed trending and ranging regimes across timeframes",
    };
  }

  if (present.length === 1) {
    return {
      status: "INSUFFICIENT",
      higherRegime,
      intermediateRegime,
      lowerRegime,
      volatilitySpread,
      explanation: "regime evidence on only one band",
    };
  }

  return {
    status: "PARTIAL",
    higherRegime,
    intermediateRegime,
    lowerRegime,
    volatilitySpread,
    explanation: `regime relationship partial H=${higherRegime} I=${intermediateRegime} L=${lowerRegime}`,
  };
}
