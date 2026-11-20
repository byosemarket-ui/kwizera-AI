/**
 * Phase 5F STEP 3 — level parsing at snapshot boundary only.
 * Missing levels remain explicitly missing. Never fabricate prices.
 */
import { extractLevelsFromCandidateNotes } from "../production-integration/outcome-evaluation.js";
import type {
  MifPredictionLevelParseProvenance,
  MifPredictionLevels,
} from "./types.js";

function finiteOrNull(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function sideOrNull(s: "ABOVE" | "BELOW" | null | undefined): "ABOVE" | "BELOW" | null {
  return s === "ABOVE" || s === "BELOW" ? s : null;
}

function ref(price: number | null, side: "ABOVE" | "BELOW" | null) {
  return { price, side, present: price != null && Number.isFinite(price) };
}

/**
 * Parse structured + legacy note levels once. Preserves original evidence.
 */
export function buildPredictionLevels(input: {
  entryPrice?: number | null;
  entrySide?: "ABOVE" | "BELOW" | null;
  targetPrice?: number | null;
  targetSide?: "ABOVE" | "BELOW" | null;
  invalidationPrice?: number | null;
  invalidationSide?: "ABOVE" | "BELOW" | null;
  invalidationConditions?: readonly string[] | null;
  requiredConfirmations?: readonly string[] | null;
  thesis?: string | null;
  rationale?: string | null;
}): MifPredictionLevels {
  const originalEvidence = [
    ...(input.invalidationConditions ?? []),
    ...(input.requiredConfirmations ?? []),
    ...(input.thesis ? [input.thesis] : []),
    ...(input.rationale ? [input.rationale] : []),
  ];

  const hasStructured =
    finiteOrNull(input.entryPrice) != null
    || finiteOrNull(input.targetPrice) != null
    || finiteOrNull(input.invalidationPrice) != null
    || sideOrNull(input.targetSide) != null
    || sideOrNull(input.invalidationSide) != null;

  const parsed = extractLevelsFromCandidateNotes({
    invalidationConditions: input.invalidationConditions,
    requiredConfirmations: input.requiredConfirmations,
    thesis: input.thesis,
    rationale: input.rationale,
  });

  const hasParsed =
    finiteOrNull(parsed.entryPrice) != null
    || finiteOrNull(parsed.targetPrice) != null
    || finiteOrNull(parsed.invalidationPrice) != null;

  let provenance: MifPredictionLevelParseProvenance = "MISSING";
  if (hasStructured && hasParsed) provenance = "MIXED";
  else if (hasStructured) provenance = "STRUCTURED_INPUT";
  else if (hasParsed) provenance = "LEGACY_NOTES_PARSE";

  // Structured input wins when present; otherwise use parsed notes. Never invent.
  const entryPrice = finiteOrNull(input.entryPrice) ?? finiteOrNull(parsed.entryPrice);
  const targetPrice = finiteOrNull(input.targetPrice) ?? finiteOrNull(parsed.targetPrice);
  const invalidationPrice =
    finiteOrNull(input.invalidationPrice) ?? finiteOrNull(parsed.invalidationPrice);
  const targetSide = sideOrNull(input.targetSide) ?? sideOrNull(parsed.targetSide);
  const invalidationSide =
    sideOrNull(input.invalidationSide) ?? sideOrNull(parsed.invalidationSide);
  const entrySide = sideOrNull(input.entrySide);

  return {
    entry: ref(entryPrice, entrySide),
    target: ref(targetPrice, targetSide),
    invalidation: ref(invalidationPrice, invalidationSide),
    parseProvenance: provenance,
    originalEvidence,
  };
}

/** Infer target/invalidation sides from direction when price exists but side missing. */
export function applyDirectionalSides(
  levels: MifPredictionLevels,
  direction: string,
): MifPredictionLevels {
  const dir = String(direction || "").toUpperCase();
  if (dir !== "BUY" && dir !== "SELL") return levels;

  const targetSide =
    levels.target.side
    ?? (levels.target.present ? (dir === "BUY" ? "ABOVE" : "BELOW") : null);
  const invalidationSide =
    levels.invalidation.side
    ?? (levels.invalidation.present ? (dir === "BUY" ? "BELOW" : "ABOVE") : null);

  return {
    ...levels,
    target: { ...levels.target, side: targetSide },
    invalidation: { ...levels.invalidation, side: invalidationSide },
  };
}
