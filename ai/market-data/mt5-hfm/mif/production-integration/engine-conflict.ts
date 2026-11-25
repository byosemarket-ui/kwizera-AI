/**
 * Cross-engine conflict classification for HFM analytical engines.
 * Preserves genuine disagreements; never forces agreement.
 */
import type { MifMarketRegimeAssessment } from "../analysis/regime/types.js";
import type { MifMarketStructureAssessment } from "../analysis/market-structure/types.js";
import type { MifDeepTechnicalIntelligenceAssessment } from "../analysis/deep-technical-intelligence/types.js";

export type MifEngineConflictKind =
  | "AGREEMENT"
  | "GENUINE_CONFLICT"
  | "DIFFERENT_TIMEFRAME"
  | "DIFFERENT_METHODOLOGY"
  | "INSUFFICIENT_DATA"
  | "STALE_DATA"
  | "CALCULATION_ERROR";

export interface MifEngineConflictReport {
  kind: MifEngineConflictKind;
  engines: readonly string[];
  conclusions: readonly { engine: string; conclusion: string; timeframe: string | null }[];
  reasons: readonly string[];
  resolutionStatus: "UNRESOLVED" | "EXPLAINED" | "DATA_DEFECT";
  snapshotRefs: readonly string[];
  qualityLimitations: readonly string[];
}

function regimeStructureLabel(regime: MifMarketRegimeAssessment | null | undefined): string {
  if (!regime) return "ABSENT";
  return `${regime.structure}/${regime.direction}/${regime.volatility}`;
}

function dtiLabel(dti: MifDeepTechnicalIntelligenceAssessment | null | undefined): string {
  if (!dti) return "ABSENT";
  return `${dti.overallRegimeLabel}`;
}

/**
 * Classify market-regime vs DTI presentation vs structure bias.
 * DTI is a presentation overlay of regime+structure+momentum — disagreement with
 * regime.structure when structure.bias differs is DIFFERENT_METHODOLOGY unless both
 * claim the same horizon and contradict.
 */
export function classifyRegimeDtiStructureConflict(input: {
  regime?: MifMarketRegimeAssessment | null;
  marketStructure?: MifMarketStructureAssessment | null;
  deepTechnical?: MifDeepTechnicalIntelligenceAssessment | null;
}): MifEngineConflictReport {
  const regime = input.regime ?? null;
  const structure = input.marketStructure ?? null;
  const dti = input.deepTechnical ?? null;

  const conclusions: MifEngineConflictReport["conclusions"] = [];
  if (regime) {
    conclusions.push({
      engine: regime.engineId,
      conclusion: regimeStructureLabel(regime),
      timeframe: regime.timeframe ?? null,
    });
  }
  if (structure) {
    conclusions.push({
      engine: structure.engineId,
      conclusion: `bias=${structure.bias}`,
      timeframe: structure.timeframe ?? null,
    });
  }
  if (dti) {
    conclusions.push({
      engine: dti.engineId,
      conclusion: dtiLabel(dti),
      timeframe: dti.timeframe ?? null,
    });
  }

  const engines = conclusions.map((c) => c.engine);
  const snapshotRefs = [
    regime?.assessmentId,
    structure?.assessmentId,
    dti?.assessmentId,
  ].filter((x): x is string => !!x);

  if (!regime && !dti) {
    return {
      kind: "INSUFFICIENT_DATA",
      engines,
      conclusions,
      reasons: ["regime and DTI both absent"],
      resolutionStatus: "EXPLAINED",
      snapshotRefs,
      qualityLimitations: ["INSUFFICIENT_DATA"],
    };
  }

  const regimeStruct = String(regime?.structure ?? "").toUpperCase();
  const structureBias = String(structure?.bias ?? "").toUpperCase();
  const dtiRegime = String(dti?.overallRegimeLabel ?? "").toUpperCase();

  const tfMismatch =
    !!regime?.timeframe
    && !!dti?.timeframe
    && regime.timeframe !== dti.timeframe;

  if (tfMismatch) {
    return {
      kind: "DIFFERENT_TIMEFRAME",
      engines,
      conclusions,
      reasons: [
        `regime.timeframe=${regime!.timeframe} != dti.timeframe=${dti!.timeframe}`,
      ],
      resolutionStatus: "EXPLAINED",
      snapshotRefs,
      qualityLimitations: ["compare_only_after_aligning_timeframes"],
    };
  }

  // Structure bias RANGING while regime TRENDING — different engines/horizons.
  if (regimeStruct === "TRENDING" && structureBias === "RANGING") {
    const dtiIsRange = dtiRegime === "RANGE_BOUND" || dtiRegime.includes("RANGE");
    return {
      kind: dtiIsRange ? "DIFFERENT_METHODOLOGY" : "GENUINE_CONFLICT",
      engines,
      conclusions,
      reasons: [
        "market-regime structure=TRENDING while market-structure bias=RANGING",
        dtiIsRange
          ? "DTI presentation followed structure.bias → RANGE_BOUND (methodology overlay, not independent regime engine)"
          : `DTI label=${dtiRegime}`,
      ],
      resolutionStatus: "EXPLAINED",
      snapshotRefs,
      qualityLimitations: [
        "DTI_overallRegimeLabel_is_presentation_overlay",
        "do_not_treat_as_independent_regime_vote",
      ],
    };
  }

  // Regime TRENDING vs DTI RANGE_BOUND without structure ranging — genuine conflict or mapping defect.
  if (
    regimeStruct === "TRENDING"
    && (dtiRegime === "RANGE_BOUND" || dtiRegime.includes("RANGE"))
    && structureBias !== "RANGING"
  ) {
    return {
      kind: "GENUINE_CONFLICT",
      engines,
      conclusions,
      reasons: [
        `regime.structure=TRENDING but DTI.overallRegimeLabel=${dtiRegime}`,
        `structure.bias=${structureBias || "ABSENT"}`,
      ],
      resolutionStatus: "UNRESOLVED",
      snapshotRefs,
      qualityLimitations: ["AI_must_not_silently_prefer_one_engine"],
    };
  }

  // Agreement path: DTI bearish/bullish trend labels with regime TRENDING matching direction.
  if (regimeStruct === "TRENDING" && dti) {
    const dir = String(regime?.direction ?? "").toUpperCase();
    const bearishOk = dir === "DOWN" && dtiRegime.includes("BEARISH");
    const bullishOk = dir === "UP" && dtiRegime.includes("BULLISH");
    if (bearishOk || bullishOk) {
      return {
        kind: "AGREEMENT",
        engines,
        conclusions,
        reasons: ["regime TRENDING direction aligns with DTI trend presentation"],
        resolutionStatus: "EXPLAINED",
        snapshotRefs,
        qualityLimitations: [],
      };
    }
  }

  if (regimeStruct === "RANGING" && dtiRegime === "RANGE_BOUND") {
    return {
      kind: "AGREEMENT",
      engines,
      conclusions,
      reasons: ["regime RANGING aligns with DTI RANGE_BOUND"],
      resolutionStatus: "EXPLAINED",
      snapshotRefs,
      qualityLimitations: [],
    };
  }

  if (regime && dti && regimeStruct && dtiRegime && regimeStruct !== "UNKNOWN") {
    // Soft disagreement without hard conflict taxonomy match.
    const trendingVsRange =
      (regimeStruct === "TRENDING" && dtiRegime === "RANGE_BOUND")
      || (regimeStruct === "RANGING" && dtiRegime.includes("TREND"));
    if (trendingVsRange) {
      return {
        kind: "GENUINE_CONFLICT",
        engines,
        conclusions,
        reasons: [`regime=${regimeStructureLabel(regime)} vs dti=${dtiRegime}`],
        resolutionStatus: "UNRESOLVED",
        snapshotRefs,
        qualityLimitations: ["AI_must_not_silently_prefer_one_engine"],
      };
    }
  }

  return {
    kind: "AGREEMENT",
    engines,
    conclusions,
    reasons: ["no hard regime/DTI/structure contradiction detected"],
    resolutionStatus: "EXPLAINED",
    snapshotRefs,
    qualityLimitations: [],
  };
}

export function formatConflictNotes(report: MifEngineConflictReport): string {
  return [
    `conflictKind=${report.kind}`,
    `resolutionStatus=${report.resolutionStatus}`,
    `engines=${report.engines.join(",") || "none"}`,
    ...report.conclusions.map(
      (c) => `conclusion.${c.engine}=${c.conclusion}${c.timeframe ? `@${c.timeframe}` : ""}`,
    ),
    ...report.reasons.map((r, i) => `reason${i + 1}=${r.replace(/[;=]/g, ",")}`),
    ...report.qualityLimitations.map((q, i) => `limit${i + 1}=${q}`),
  ].join("; ");
}
