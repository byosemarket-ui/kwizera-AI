/**
 * Parse source-backed levels from candidate invalidationConditions tokens.
 * Never invents prices. RR only when entry + invalidation + ≥1 target are finite.
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
      if (/LEVELS_NOT_PROVIDED|LEVELS_PARTIAL/i.test(lim)) notes.push(lim);
    }
  }

  const entry = level("ENTRY", entryPrice, entrySide, entryProv);
  const invalidation = level("INVALIDATION", invalidationPrice, invSide, invProv);
  const stop = invalidationPrice != null
    ? level("STOP_REFERENCE", invalidationPrice, invSide, invProv)
    : null;

  let riskReward: number | null = null;
  const primaryTarget = targets[0]?.price ?? null;
  if (
    entryPrice != null
    && invalidationPrice != null
    && primaryTarget != null
    && entryPrice !== invalidationPrice
  ) {
    const risk = Math.abs(entryPrice - invalidationPrice);
    const reward = Math.abs(primaryTarget - entryPrice);
    if (risk > 0 && Number.isFinite(reward)) {
      riskReward = Math.round((reward / risk) * 1000) / 1000;
    }
  }

  let status: MifScenarioLevels["status"] = "LEVELS_NOT_PROVIDED";
  if (entryPrice != null && invalidationPrice != null && targets.length > 0) {
    status = "AVAILABLE_FROM_SOURCE";
  } else if (entryPrice != null || invalidationPrice != null || targets.length > 0) {
    status = "LEVELS_PARTIAL";
    notes.push("LEVELS_PARTIAL: incomplete source-backed levels; RR withheld");
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
