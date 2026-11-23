import type { MifMtfRelationshipsAssessment } from "../mtf-relationships/types.js";
import type {
  HfmDeepTechnicalMtfAlignment,
  HfmDeepTechnicalTrendDirection,
} from "./types.js";

function bandToBias(dir: string | null | undefined): HfmDeepTechnicalTrendDirection {
  const d = String(dir || "").toUpperCase();
  if (d === "UP") return "BULLISH";
  if (d === "DOWN") return "BEARISH";
  if (d === "NEUTRAL") return "NEUTRAL";
  return "UNKNOWN";
}

/**
 * Map existing MTF relationships assessment into Phase 06 §11 alignment enums.
 * Preserves conflict — never averages opposing higher/lower bias into one side.
 */
export function mapDeepTechnicalMtfAlignment(input: {
  mtf: MifMtfRelationshipsAssessment | null | undefined;
  minFrames: number;
}): {
  alignment: HfmDeepTechnicalMtfAlignment;
  higher: HfmDeepTechnicalTrendDirection;
  intermediate: HfmDeepTechnicalTrendDirection;
  lower: HfmDeepTechnicalTrendDirection;
  framesEvaluated: string[];
  framesMissing: string[];
  conflictingTimeframes: string[];
  notes: string[];
  mtfEngineRelation: string | null;
  mtfAssessmentId: string | null;
} {
  const mtf = input.mtf ?? null;
  if (!mtf || mtf.status === "BLOCKED" || mtf.status === "INSUFFICIENT_DATA") {
    return {
      alignment: "INSUFFICIENT_TIMEFRAME_DATA",
      higher: "UNKNOWN",
      intermediate: "UNKNOWN",
      lower: "UNKNOWN",
      framesEvaluated: [],
      framesMissing: [],
      conflictingTimeframes: [],
      notes: [mtf ? `mtf_status=${mtf.status}` : "mtf_missing"],
      mtfEngineRelation: mtf?.directional?.relation ?? null,
      mtfAssessmentId: mtf?.assessmentId ?? null,
    };
  }

  const higher = bandToBias(mtf.directional?.higherDirection);
  const intermediate = bandToBias(mtf.directional?.intermediateDirection);
  const lower = bandToBias(mtf.directional?.lowerDirection);
  const relation = String(mtf.directional?.relation || "UNKNOWN");
  const framesEvaluated = [
    ...(mtf.higherSummary?.timeframesPresent ?? []),
    ...(mtf.intermediateSummary?.timeframesPresent ?? []),
    ...(mtf.lowerSummary?.timeframesPresent ?? []),
  ];
  const framesMissing = [
    ...(mtf.higherSummary?.timeframesMissing ?? []),
    ...(mtf.intermediateSummary?.timeframesMissing ?? []),
    ...(mtf.lowerSummary?.timeframesMissing ?? []),
  ];
  const conflictingTimeframes = [
    ...(mtf.directional?.opposingTimeframes ?? []),
    ...(mtf.conflicts?.disagreeingTimeframes ?? []),
  ].filter((v, i, a) => a.indexOf(v) === i);
  const notes: string[] = [
    `mtf_relation=${relation}`,
    mtf.directional?.explanation ?? "",
  ].filter(Boolean);

  if (framesEvaluated.length < input.minFrames) {
    return {
      alignment: "INSUFFICIENT_TIMEFRAME_DATA",
      higher,
      intermediate,
      lower,
      framesEvaluated,
      framesMissing,
      conflictingTimeframes,
      notes: [...notes, `need_min_frames=${input.minFrames}`],
      mtfEngineRelation: relation,
      mtfAssessmentId: mtf.assessmentId,
    };
  }

  // Explicit HTF vs LTF opposition (Phase 06 vocabulary).
  if (higher === "BULLISH" && lower === "BEARISH") {
    return {
      alignment: "HIGHER_TIMEFRAME_BULLISH_LOWER_TIMEFRAME_BEARISH",
      higher,
      intermediate,
      lower,
      framesEvaluated,
      framesMissing,
      conflictingTimeframes,
      notes,
      mtfEngineRelation: relation,
      mtfAssessmentId: mtf.assessmentId,
    };
  }
  if (higher === "BEARISH" && lower === "BULLISH") {
    return {
      alignment: "HIGHER_TIMEFRAME_BEARISH_LOWER_TIMEFRAME_BULLISH",
      higher,
      intermediate,
      lower,
      framesEvaluated,
      framesMissing,
      conflictingTimeframes,
      notes,
      mtfEngineRelation: relation,
      mtfAssessmentId: mtf.assessmentId,
    };
  }

  const structures = [
    mtf.higherSummary?.consensusStructure,
    mtf.intermediateSummary?.consensusStructure,
    mtf.lowerSummary?.consensusStructure,
  ]
    .filter(Boolean)
    .map((s) => String(s).toUpperCase());
  const rangingHeavy = structures.filter((s) => s === "RANGING").length >= 1
    && (higher === "NEUTRAL" || lower === "NEUTRAL" || intermediate === "NEUTRAL");

  if (
    relation === "CONFLICT"
    || (higher !== "UNKNOWN" && lower !== "UNKNOWN" && higher !== lower
      && higher !== "NEUTRAL" && lower !== "NEUTRAL")
  ) {
    if (rangingHeavy) {
      return {
        alignment: "RANGE_CONFLICT",
        higher,
        intermediate,
        lower,
        framesEvaluated,
        framesMissing,
        conflictingTimeframes,
        notes,
        mtfEngineRelation: relation,
        mtfAssessmentId: mtf.assessmentId,
      };
    }
    return {
      alignment: "MIXED_TIMEFRAME_EVIDENCE",
      higher,
      intermediate,
      lower,
      framesEvaluated,
      framesMissing,
      conflictingTimeframes,
      notes,
      mtfEngineRelation: relation,
      mtfAssessmentId: mtf.assessmentId,
    };
  }

  if (relation === "ALIGNMENT") {
    if (higher === "BULLISH" || (higher === "UNKNOWN" && intermediate === "BULLISH")) {
      return {
        alignment: "FULL_BULLISH_ALIGNMENT",
        higher,
        intermediate,
        lower,
        framesEvaluated,
        framesMissing,
        conflictingTimeframes,
        notes,
        mtfEngineRelation: relation,
        mtfAssessmentId: mtf.assessmentId,
      };
    }
    if (higher === "BEARISH" || (higher === "UNKNOWN" && intermediate === "BEARISH")) {
      return {
        alignment: "FULL_BEARISH_ALIGNMENT",
        higher,
        intermediate,
        lower,
        framesEvaluated,
        framesMissing,
        conflictingTimeframes,
        notes,
        mtfEngineRelation: relation,
        mtfAssessmentId: mtf.assessmentId,
      };
    }
  }

  if (relation === "PARTIAL_ALIGNMENT" || relation === "COUNTERTREND_PULLBACK") {
    const bias = higher !== "UNKNOWN" ? higher : intermediate;
    if (bias === "BULLISH") {
      return {
        alignment: "PARTIAL_BULLISH_ALIGNMENT",
        higher,
        intermediate,
        lower,
        framesEvaluated,
        framesMissing,
        conflictingTimeframes,
        notes,
        mtfEngineRelation: relation,
        mtfAssessmentId: mtf.assessmentId,
      };
    }
    if (bias === "BEARISH") {
      return {
        alignment: "PARTIAL_BEARISH_ALIGNMENT",
        higher,
        intermediate,
        lower,
        framesEvaluated,
        framesMissing,
        conflictingTimeframes,
        notes,
        mtfEngineRelation: relation,
        mtfAssessmentId: mtf.assessmentId,
      };
    }
  }

  if (
    relation === "TRANSITION"
    || relation === "POTENTIAL_REVERSAL"
    || relation === "UNKNOWN"
  ) {
    return {
      alignment: rangingHeavy ? "RANGE_CONFLICT" : "MIXED_TIMEFRAME_EVIDENCE",
      higher,
      intermediate,
      lower,
      framesEvaluated,
      framesMissing,
      conflictingTimeframes,
      notes,
      mtfEngineRelation: relation,
      mtfAssessmentId: mtf.assessmentId,
    };
  }

  return {
    alignment: "MIXED_TIMEFRAME_EVIDENCE",
    higher,
    intermediate,
    lower,
    framesEvaluated,
    framesMissing,
    conflictingTimeframes,
    notes,
    mtfEngineRelation: relation,
    mtfAssessmentId: mtf.assessmentId,
  };
}
