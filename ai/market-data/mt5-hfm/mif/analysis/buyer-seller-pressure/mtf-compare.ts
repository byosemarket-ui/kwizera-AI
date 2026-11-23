/**
 * Phase 05 — multi-timeframe pressure context (no averaging of conflicts).
 */
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import type { MifBuyerSellerPressureAssessment } from "./types.js";
import type {
  HfmMultiTimeframePressureContext,
  HfmMtfPressureAlignment,
  HfmPressureDominantSide,
  HfmPressureTimeframeSummary,
} from "./types.js";

const HIGHER = new Set(["H4", "D1", "H1"]);
const LOWER = new Set(["M30", "M15", "M5", "M1"]);

function biasFromFrames(
  frames: readonly HfmPressureTimeframeSummary[],
  set: Set<string>,
): HfmPressureDominantSide {
  const sides = frames
    .filter((f) => f.available && !f.stale && set.has(f.timeframe))
    .map((f) => f.dominantSide)
    .filter((s) => s === "BUYERS_DOMINANT" || s === "SELLERS_DOMINANT");
  if (!sides.length) return "INSUFFICIENT_EVIDENCE";
  const buy = sides.filter((s) => s === "BUYERS_DOMINANT").length;
  const sell = sides.filter((s) => s === "SELLERS_DOMINANT").length;
  if (buy > 0 && sell > 0) return "MIXED";
  if (buy > sell) return "BUYERS_DOMINANT";
  if (sell > buy) return "SELLERS_DOMINANT";
  return "INSUFFICIENT_EVIDENCE";
}

export function buildMultiTimeframePressureContext(input: {
  providerSymbol: string;
  assessments: readonly MifBuyerSellerPressureAssessment[];
  /** Optional stale flags by timeframe. */
  staleByTimeframe?: Record<string, boolean>;
  assessedAt?: string;
}): HfmMultiTimeframePressureContext {
  const frames: HfmPressureTimeframeSummary[] = input.assessments.map((a) => ({
    timeframe: a.timeframe,
    available:
      a.status !== "BLOCKED"
      && a.status !== "INSUFFICIENT_DATA"
      && a.buyingPressureScore != null,
    stale: Boolean(input.staleByTimeframe?.[a.timeframe]),
    dominantSide: a.dominantSide,
    pressureImbalance: a.pressureImbalance,
    evidenceQuality: a.evidenceQuality,
    dataClassification: a.dataClassification,
    assessmentId: a.assessmentId,
  }));

  const usable = frames.filter((f) => f.available && !f.stale);
  const sides = usable
    .map((f) => f.dominantSide)
    .filter((s) => s === "BUYERS_DOMINANT" || s === "SELLERS_DOMINANT");
  let alignment: HfmMtfPressureAlignment = "INSUFFICIENT_DATA";
  const notes: string[] = [];
  if (usable.length < 2) {
    alignment = "INSUFFICIENT_DATA";
    notes.push("need_at_least_two_fresh_timeframes");
  } else {
    const buy = sides.filter((s) => s === "BUYERS_DOMINANT").length;
    const sell = sides.filter((s) => s === "SELLERS_DOMINANT").length;
    if (buy > 0 && sell > 0) {
      alignment = "CONFLICTING";
      notes.push("do_not_average_conflicting_timeframes");
    } else if (buy + sell === usable.length) {
      alignment = "ALIGNED";
    } else {
      alignment = "PARTIAL";
      notes.push("some_frames_balanced_or_mixed");
    }
  }

  return {
    providerId: MIF_PROVIDER_ID,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    assessedAt: input.assessedAt ?? new Date().toISOString(),
    frames,
    alignment,
    higherTimeframeBias: biasFromFrames(frames, HIGHER),
    lowerTimeframeBias: biasFromFrames(frames, LOWER),
    notes,
    doesNotAverageConflictingFrames: true,
  };
}
