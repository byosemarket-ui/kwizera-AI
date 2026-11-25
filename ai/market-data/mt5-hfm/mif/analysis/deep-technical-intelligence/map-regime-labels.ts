import type { MifMarketRegimeAssessment } from "../regime/types.js";
import type { MifMarketStructureAssessment } from "../market-structure/types.js";
import type { MifMomentumAssessment } from "../momentum/types.js";
import type {
  HfmDeepTechnicalTrendDirection,
  HfmDeepTechnicalTrendRegime,
  HfmDeepTechnicalTrendStrength,
} from "./types.js";

function dirFromRegime(regime: MifMarketRegimeAssessment | null | undefined): HfmDeepTechnicalTrendDirection {
  if (!regime) return "UNKNOWN";
  const d = String(regime.direction || "").toUpperCase();
  if (d === "UP") return "BULLISH";
  if (d === "DOWN") return "BEARISH";
  if (d === "NEUTRAL") return "NEUTRAL";
  return "UNKNOWN";
}

function dirFromStructure(
  structure: MifMarketStructureAssessment | null | undefined,
): HfmDeepTechnicalTrendDirection {
  if (!structure) return "UNKNOWN";
  const b = String(structure.bias || "").toUpperCase();
  if (b === "BULLISH") return "BULLISH";
  if (b === "BEARISH") return "BEARISH";
  if (b === "RANGING") return "NEUTRAL";
  return "UNKNOWN";
}

/**
 * Map existing regime + structure + momentum into Phase 06 presentation labels.
 * Preserves dimensional regime fields upstream; this is presentation only.
 */
export function mapDeepTechnicalTrendRegime(input: {
  regime?: MifMarketRegimeAssessment | null;
  marketStructure?: MifMarketStructureAssessment | null;
  momentum?: MifMomentumAssessment | null;
}): {
  direction: HfmDeepTechnicalTrendDirection;
  strength: HfmDeepTechnicalTrendStrength;
  label: HfmDeepTechnicalTrendRegime;
} {
  const regime = input.regime ?? null;
  const structure = input.marketStructure ?? null;
  const momentum = input.momentum ?? null;

  if (
    (!regime || regime.status === "INSUFFICIENT_DATA" || regime.status === "BLOCKED")
    && (!structure || structure.status === "INSUFFICIENT_DATA" || structure.status === "BLOCKED")
  ) {
    return {
      direction: "UNKNOWN",
      strength: "UNAVAILABLE",
      label: "INSUFFICIENT_DATA",
    };
  }

  const vol = String(regime?.volatility ?? "").toUpperCase();
  const structureDim = String(regime?.structure ?? "").toUpperCase();
  const composite = String(regime?.compositeLabel ?? "").toUpperCase();

  // Volatility-only presentation when structure is not directional.
  if (vol === "HIGH" || vol === "EXTREME" || composite === "HIGH_VOLATILITY") {
    if (structureDim === "RANGING" || composite === "RANGING") {
      // Prefer directional if clearly trending; else high-vol label.
    } else if (structureDim !== "TRENDING" && composite !== "TRENDING_UP" && composite !== "TRENDING_DOWN") {
      return {
        direction: dirFromRegime(regime) !== "UNKNOWN" ? dirFromRegime(regime) : dirFromStructure(structure),
        strength: "MODERATE",
        label: "HIGH_VOLATILITY",
      };
    }
  }
  if (vol === "LOW" || composite === "LOW_VOLATILITY") {
    if (structureDim === "RANGING" || composite === "RANGING") {
      return {
        direction: "NEUTRAL",
        strength: "WEAK",
        label: "LOW_VOLATILITY",
      };
    }
  }

  if (
    structureDim === "TRANSITION"
    || structureDim === "UNSTABLE"
    || composite === "TRANSITION"
    || composite === "UNSTABLE"
  ) {
    return {
      direction: "MIXED",
      strength: "WEAK",
      label: "TRANSITIONAL",
    };
  }

  // RANGE_BOUND only when regime structure is ranging (or regime absent and
  // structure bias alone says ranging). Do NOT let structure.bias=RANGING
  // silently override an explicit TRENDING regime — that produced false
  // regime-vs-DTI conflicts (methodology collapse, not independent disagreement).
  const regimeIsTrending =
    structureDim === "TRENDING"
    || composite === "TRENDING_UP"
    || composite === "TRENDING_DOWN";
  if (
    !regimeIsTrending
    && (structureDim === "RANGING" || composite === "RANGING" || structure?.bias === "RANGING")
  ) {
    return {
      direction: "NEUTRAL",
      strength: "NONE",
      label: "RANGE_BOUND",
    };
  }

  const dirRegime = dirFromRegime(regime);
  const dirStruct = dirFromStructure(structure);
  let direction: HfmDeepTechnicalTrendDirection = "UNKNOWN";
  if (dirRegime === dirStruct && dirRegime !== "UNKNOWN") {
    direction = dirRegime;
  } else if (dirRegime !== "UNKNOWN" && (dirStruct === "UNKNOWN" || dirStruct === "NEUTRAL")) {
    direction = dirRegime;
  } else if (dirStruct !== "UNKNOWN" && (dirRegime === "UNKNOWN" || dirRegime === "NEUTRAL")) {
    direction = dirStruct;
  } else if (dirRegime !== "UNKNOWN" && dirStruct !== "UNKNOWN" && dirRegime !== dirStruct) {
    direction = "MIXED";
  } else {
    direction = dirRegime !== "UNKNOWN" ? dirRegime : dirStruct;
  }

  const momDir = String(momentum?.direction || "").toUpperCase();
  const momAligned =
    (direction === "BULLISH" && (momDir === "UP" || momDir === "BULLISH"))
    || (direction === "BEARISH" && (momDir === "DOWN" || momDir === "BEARISH"));
  const momConflict =
    (direction === "BULLISH" && (momDir === "DOWN" || momDir === "BEARISH"))
    || (direction === "BEARISH" && (momDir === "UP" || momDir === "BULLISH"));

  let strength: HfmDeepTechnicalTrendStrength = "MODERATE";
  if (direction === "MIXED" || direction === "UNKNOWN" || direction === "NEUTRAL") {
    strength = direction === "NEUTRAL" ? "NONE" : "WEAK";
  } else if (momConflict) {
    strength = "WEAK";
  } else if (momAligned && structureDim === "TRENDING") {
    strength = "STRONG";
  } else if (structureDim === "TRENDING") {
    strength = "MODERATE";
  } else {
    strength = "WEAK";
  }

  if (direction === "BULLISH") {
    if (strength === "STRONG") return { direction, strength, label: "STRONG_BULLISH_TREND" };
    if (strength === "WEAK") return { direction, strength, label: "WEAK_BULLISH_TREND" };
    return { direction, strength, label: "BULLISH_TREND" };
  }
  if (direction === "BEARISH") {
    if (strength === "STRONG") return { direction, strength, label: "STRONG_BEARISH_TREND" };
    if (strength === "WEAK") return { direction, strength, label: "WEAK_BEARISH_TREND" };
    return { direction, strength, label: "BEARISH_TREND" };
  }
  if (direction === "NEUTRAL") {
    return { direction, strength: "NONE", label: "RANGE_BOUND" };
  }
  if (direction === "MIXED") {
    return { direction, strength: "WEAK", label: "TRANSITIONAL" };
  }
  return { direction: "UNKNOWN", strength: "UNAVAILABLE", label: "INSUFFICIENT_DATA" };
}
