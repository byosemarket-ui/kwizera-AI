/**
 * P8.A — extract and validate Charts trade-plan levels for MIF snapshots.
 * Missing or geometrically invalid levels → skip (never fabricate).
 */
import type { HfmReasoningTradePlan, HfmReasoningValidatedResult } from "../reasoning/types.js";
import type { HfmChartsResolvedLevels } from "./types.js";

function finiteOrNull(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Resolve a single entry price from the Charts entry zone.
 * Prefers midpoint when both bounds exist; otherwise the single finite bound.
 */
export function resolveEntryPrice(plan: HfmReasoningTradePlan): number | null {
  const low = finiteOrNull(plan.entryZone?.low);
  const high = finiteOrNull(plan.entryZone?.high);
  if (low != null && high != null) {
    if (high < low) return null;
    return (low + high) / 2;
  }
  return low ?? high;
}

export function extractChartsTradeLevels(
  result: HfmReasoningValidatedResult,
):
  | { ok: true; levels: HfmChartsResolvedLevels }
  | { ok: false; code: "MISSING_LEVELS" | "INVALID_LEVELS"; message: string } {
  const plan = result.tradePlan;
  const action = String(result.decision?.action || "").toUpperCase();
  if (action !== "BUY" && action !== "SELL") {
    return { ok: false, code: "INVALID_LEVELS", message: `levels only apply to BUY/SELL, got ${action}` };
  }

  const entryPrice = resolveEntryPrice(plan);
  const stopLoss = finiteOrNull(plan.stopLoss);
  const takeProfit = finiteOrNull(plan.takeProfitTargets?.[0]);
  const invalidationPrice = finiteOrNull(plan.invalidationPrice);

  const missing: string[] = [];
  if (entryPrice == null) missing.push("entry");
  if (stopLoss == null) missing.push("stopLoss");
  if (takeProfit == null) missing.push("takeProfit");
  if (invalidationPrice == null) missing.push("invalidation");
  if (missing.length) {
    return {
      ok: false,
      code: "MISSING_LEVELS",
      message: `missing required levels: ${missing.join(",")}`,
    };
  }

  const levels: HfmChartsResolvedLevels = {
    entryPrice: entryPrice!,
    stopLoss: stopLoss!,
    takeProfit: takeProfit!,
    invalidationPrice: invalidationPrice!,
  };

  if (action === "BUY") {
    if (!(levels.stopLoss < levels.entryPrice)) {
      return {
        ok: false,
        code: "INVALID_LEVELS",
        message: "BUY requires stopLoss < entry",
      };
    }
    if (!(levels.takeProfit > levels.entryPrice)) {
      return {
        ok: false,
        code: "INVALID_LEVELS",
        message: "BUY requires takeProfit > entry",
      };
    }
    if (!(levels.invalidationPrice < levels.entryPrice)) {
      return {
        ok: false,
        code: "INVALID_LEVELS",
        message: "BUY requires invalidation < entry",
      };
    }
  } else {
    if (!(levels.stopLoss > levels.entryPrice)) {
      return {
        ok: false,
        code: "INVALID_LEVELS",
        message: "SELL requires stopLoss > entry",
      };
    }
    if (!(levels.takeProfit < levels.entryPrice)) {
      return {
        ok: false,
        code: "INVALID_LEVELS",
        message: "SELL requires takeProfit < entry",
      };
    }
    if (!(levels.invalidationPrice > levels.entryPrice)) {
      return {
        ok: false,
        code: "INVALID_LEVELS",
        message: "SELL requires invalidation > entry",
      };
    }
  }

  return { ok: true, levels };
}
