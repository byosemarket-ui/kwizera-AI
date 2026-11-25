/**
 * Parse source-backed levels from candidate invalidationConditions tokens.
 * Never invents prices. RR only when entry + invalidation + ≥1 target are finite
 * and directional geometry is valid.
 */
import type { MifOpportunityCandidate } from "../opportunity-detection/types.js";
import type { MifScenarioDirection, MifScenarioLevel, MifScenarioLevels } from "./types.js";

function parseToken(conditions: readonly string[], key: string): number | null {
  const re = new RegExp(`^${key}=([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)$`);
  for (const raw of conditions) {
    const m = String(raw).trim().match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function parseSide(conditions: readonly string[], key: string): "ABOVE" | "BELOW" | "AT" | null {
  const re = new RegExp(`^${key}=(ABOVE|BELOW|AT)$`, "i");
  for (const raw of conditions) {
    const m = String(raw).trim().match(re);
    if (m) return String(m[1]).toUpperCase() as "ABOVE" | "BELOW" | "AT";
  }
  return null;
}

function level(
  kind: MifScenarioLevel["kind"],
  price: number | null,
  side: MifScenarioLevel["side"],
  provenance: string | null,
): MifScenarioLevel {
  return {
    kind,
    price,
    side,
    provenance: price != null ? provenance : null,
    source: price != null ? "CANDIDATE_NOTES" : "NONE",
  };
}

/**
 * Validate directional price geometry without inventing missing prices.
 * Returns null when geometry cannot yet be judged (e.g. only one side present).
 */
export function validateScenarioLevelGeometry(input: {
  side: MifScenarioDirection;
  entryPrice: number | null;
  invalidationPrice: number | null;
  targetPrice: number | null;
  invalidationSide?: MifScenarioLevel["side"];
  targetSide?: MifScenarioLevel["side"];
}): { ok: boolean; reasons: string[] } | null {
  const { side, entryPrice, invalidationPrice, targetPrice } = input;
  const reasons: string[] = [];

  const hasInv = invalidationPrice != null && Number.isFinite(invalidationPrice);
  const hasTarget = targetPrice != null && Number.isFinite(targetPrice);
  const hasEntry = entryPrice != null && Number.isFinite(entryPrice);

  if (!hasInv && !hasTarget && !hasEntry) return null;
  // Incomplete but not yet contradictory — defer until enough prices exist.
  if (!(hasInv && hasTarget) && !hasEntry) return null;
  if (hasEntry && !hasInv && !hasTarget) return null;

  if (hasInv && hasTarget && invalidationPrice === targetPrice) {
    reasons.push("GEOMETRY_INVALID:target_equals_invalidation");
  }

  if (side === "BEARISH") {
    // Bearish: targets must sit below invalidation (trade direction down).
    if (hasInv && hasTarget && (targetPrice as number) >= (invalidationPrice as number)) {
      reasons.push("GEOMETRY_INVALID:bearish_target_not_below_invalidation");
    }
    if (hasEntry && hasInv && (entryPrice as number) >= (invalidationPrice as number)) {
      reasons.push("GEOMETRY_INVALID:bearish_entry_not_below_invalidation");
    }
    if (hasEntry && hasTarget && (targetPrice as number) >= (entryPrice as number)) {
      reasons.push("GEOMETRY_INVALID:bearish_target_not_below_entry");
    }
    if (input.invalidationSide && input.invalidationSide !== "ABOVE" && input.invalidationSide !== "AT") {
      reasons.push("GEOMETRY_INVALID:bearish_invalidation_side_not_above");
    }
    if (input.targetSide && input.targetSide !== "BELOW" && input.targetSide !== "AT") {
      reasons.push("GEOMETRY_INVALID:bearish_target_side_not_below");
    }
  } else {
    // Bullish: targets must sit above invalidation (trade direction up).
    if (hasInv && hasTarget && (targetPrice as number) <= (invalidationPrice as number)) {
      reasons.push("GEOMETRY_INVALID:bullish_target_not_above_invalidation");
    }
    if (hasEntry && hasInv && (entryPrice as number) <= (invalidationPrice as number)) {
      reasons.push("GEOMETRY_INVALID:bullish_entry_not_above_invalidation");
    }
    if (hasEntry && hasTarget && (targetPrice as number) <= (entryPrice as number)) {
      reasons.push("GEOMETRY_INVALID:bullish_target_not_above_entry");
    }
    if (input.invalidationSide && input.invalidationSide !== "BELOW" && input.invalidationSide !== "AT") {
      reasons.push("GEOMETRY_INVALID:bullish_invalidation_side_not_below");
    }
    if (input.targetSide && input.targetSide !== "ABOVE" && input.targetSide !== "AT") {
      reasons.push("GEOMETRY_INVALID:bullish_target_side_not_above");
    }
  }

  if (!hasEntry && (hasInv || hasTarget)) {
    reasons.push("GEOMETRY_INCOMPLETE:entry_unavailable");
  }

  const fatal = reasons.filter((r) => r.startsWith("GEOMETRY_INVALID:"));
  if (fatal.length === 0 && reasons.includes("GEOMETRY_INCOMPLETE:entry_unavailable")) {
    // Incomplete without contradiction — still OK as partial.
    return { ok: true, reasons };
  }
  return { ok: fatal.length === 0, reasons };
}

/**
 * Aggregate levels from contributing candidates (first finite wins per kind; targets collect).
 */
export function buildScenarioLevels(input: {
  side: MifScenarioDirection;
  candidates: readonly MifOpportunityCandidate[];
}): MifScenarioLevels {
  const notes: string[] = [];
  let entryPrice: number | null = null;
  let invalidationPrice: number | null = null;
  let entrySide: MifScenarioLevel["side"] = null;
  let invSide: MifScenarioLevel["side"] = null;
  let entryProv: string | null = null;
  let invProv: string | null = null;
  const targets: MifScenarioLevel[] = [];
  const seenTargets = new Set<number>();

  for (const c of input.candidates) {
    const cond = c.invalidationConditions ?? [];
    if (entryPrice == null) {
      const e = parseToken(cond, "entryPrice");
      if (e != null) {
        entryPrice = e;
        entrySide = "AT";
        entryProv = `candidate:${c.candidateId}:entryPrice`;
      }
    }
    if (invalidationPrice == null) {
      const inv = parseToken(cond, "invalidationPrice");
      if (inv != null) {
        invalidationPrice = inv;
        invSide =
          parseSide(cond, "invalidationSide")
          ?? (input.side === "BULLISH" ? "BELOW" : "ABOVE");
        invProv = `candidate:${c.candidateId}:invalidationPrice`;
      }
    }
    const t = parseToken(cond, "targetPrice");
    if (t != null && !seenTargets.has(t)) {
      seenTargets.add(t);
      targets.push(
        level(
          "TARGET",
          t,
          parseSide(cond, "targetSide")
            ?? (input.side === "BULLISH" ? "ABOVE" : "BELOW"),
          `candidate:${c.candidateId}:targetPrice`,
        ),
      );
    }
    for (const lim of c.knownLimitations ?? []) {
      if (/LEVELS_NOT_PROVIDED|LEVELS_PARTIAL|GEOMETRY_INVALID/i.test(lim)) notes.push(lim);
    }
  }

  const entry = level("ENTRY", entryPrice, entrySide, entryProv);
  const invalidation = level("INVALIDATION", invalidationPrice, invSide, invProv);
  const stop = invalidationPrice != null
    ? level("STOP_REFERENCE", invalidationPrice, invSide, invProv)
    : null;

  const primaryTarget = targets[0]?.price ?? null;
  const geometry = validateScenarioLevelGeometry({
    side: input.side,
    entryPrice,
    invalidationPrice,
    targetPrice: primaryTarget,
    invalidationSide: invSide,
    targetSide: targets[0]?.side ?? null,
  });

  let riskReward: number | null = null;
  let status: MifScenarioLevels["status"] = "LEVELS_NOT_PROVIDED";

  if (geometry && !geometry.ok) {
    status = "LEVELS_INVALID_GEOMETRY";
    notes.push(...geometry.reasons);
    notes.push("LEVELS_INVALID_GEOMETRY: source-backed prices retained for audit; RR withheld; no fabricated correction");
    riskReward = null;
  } else if (entryPrice != null && invalidationPrice != null && targets.length > 0) {
    status = "AVAILABLE_FROM_SOURCE";
    if (entryPrice !== invalidationPrice) {
      const risk = Math.abs(entryPrice - invalidationPrice);
      const reward = Math.abs((primaryTarget as number) - entryPrice);
      if (risk > 0 && Number.isFinite(reward)) {
        riskReward = Math.round((reward / risk) * 1000) / 1000;
      }
    }
    if (geometry?.reasons.length) notes.push(...geometry.reasons);
  } else if (entryPrice != null || invalidationPrice != null || targets.length > 0) {
    status = "LEVELS_PARTIAL";
    notes.push("LEVELS_PARTIAL: incomplete source-backed levels; RR withheld");
    if (geometry?.reasons.length) notes.push(...geometry.reasons);
  } else {
    notes.push("LEVELS_NOT_PROVIDED");
  }

  void stop; // stop/invalidation share source-backed price; exposed as invalidation
  return {
    status,
    entry: entryPrice != null ? entry : null,
    invalidation: invalidationPrice != null ? invalidation : null,
    targets,
    riskReward,
    notes: [...new Set(notes)],
  };
}
