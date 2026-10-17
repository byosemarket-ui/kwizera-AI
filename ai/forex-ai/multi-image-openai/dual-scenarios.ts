/**
 * Phase 50D — Evidence-grounded bullish and bearish price scenarios.
 * Uses swing structure / S-R / plan levels when present. Never invents targets.
 * Scenario paths are illustrations, not predicted price paths.
 */

import type { SnapshotStructureEvidenceSummary, SnapshotTradePlan } from "../snapshot-plans/types.js";

export const DUAL_SCENARIO_METHOD = "phase50d-dual-scenario-v1";

export interface ScenarioLevel {
  price: number | null;
  kind: "observed" | "derived" | "unavailable";
  provenance: string;
  unavailableReason: string | null;
}

export interface MarketSideScenario {
  side: "BULLISH" | "BEARISH";
  available: boolean;
  unavailableReason: string | null;
  reference: ScenarioLevel;
  entryZone: {
    lower: number | null;
    upper: number | null;
    reference: number | null;
    provenance: string;
    unavailableReason: string | null;
  };
  target1: ScenarioLevel;
  target2: ScenarioLevel;
  invalidation: ScenarioLevel;
  confirmationEvidence: string[];
  invalidationEvidence: string[];
  atrDisclosure: string | null;
}

export interface DualMarketScenarios {
  schemaVersion: "forex-dual-market-scenarios-v1";
  method: typeof DUAL_SCENARIO_METHOD;
  instrument: string;
  timeframe: string;
  dataStatus: string;
  referencePrice: number | null;
  referenceSource: string | null;
  referenceTimestampUtc: string | null;
  bullish: MarketSideScenario;
  bearish: MarketSideScenario;
  disclaimer: string;
}

function level(
  price: number | null | undefined,
  kind: ScenarioLevel["kind"],
  provenance: string,
  unavailableReason: string | null = null,
): ScenarioLevel {
  if (price == null || !Number.isFinite(price)) {
    return {
      price: null,
      kind: "unavailable",
      provenance,
      unavailableReason: unavailableReason ?? "Level not supported by verified structure.",
    };
  }
  return { price, kind, provenance, unavailableReason: null };
}

function emptySide(
  side: "BULLISH" | "BEARISH",
  reason: string,
  reference: ScenarioLevel,
): MarketSideScenario {
  return {
    side,
    available: false,
    unavailableReason: reason,
    reference,
    entryZone: {
      lower: null,
      upper: null,
      reference: null,
      provenance: "",
      unavailableReason: reason,
    },
    target1: level(null, "unavailable", "target1", reason),
    target2: level(null, "unavailable", "target2", reason),
    invalidation: level(null, "unavailable", "invalidation", reason),
    confirmationEvidence: [],
    invalidationEvidence: [reason],
    atrDisclosure: null,
  };
}

/**
 * Prefer plan levels when the plan intent matches the scenario side;
 * otherwise use swing / S-R structure only (no invented ATR targets).
 */
export function buildDualMarketScenarios(input: {
  instrument: string;
  timeframe: string;
  dataStatus: string;
  referencePrice: number | null;
  referenceSource: string | null;
  referenceTimestampUtc: string | null;
  structure: SnapshotStructureEvidenceSummary | null;
  pullback: SnapshotTradePlan | null;
  breakout: SnapshotTradePlan | null;
  keyEvidence?: string[];
  invalidationConditions?: string[];
  bullishScenarioText?: string | null;
  bearishScenarioText?: string | null;
}): DualMarketScenarios {
  const disclaimer =
    "Bullish and bearish scenarios are evidence-grounded illustrations from verified structure — "
    + "not guaranteed forecasts, not calibrated target-hit probabilities, and not broker orders.";

  const refLevel = level(
    input.referencePrice,
    input.referencePrice != null ? "observed" : "unavailable",
    input.referenceSource ?? "reference",
    input.referencePrice == null ? "No reference price available." : null,
  );

  const structure = input.structure;
  const hi = structure?.lastSwingHigh ?? null;
  const lo = structure?.lastSwingLow ?? null;
  const support = structure?.zones.find((z) => z.side === "SUPPORT" && z.status === "ACTIVE") ?? null;
  const resistance = structure?.zones.find((z) => z.side === "RESISTANCE" && z.status === "ACTIVE") ?? null;

  const pickPlan = (side: "BUY" | "SELL"): SnapshotTradePlan | null => {
    const candidates = [input.pullback, input.breakout].filter(Boolean) as SnapshotTradePlan[];
    return candidates.find((p) => p.intent === side) ?? null;
  };

  const buildSide = (side: "BULLISH" | "BEARISH"): MarketSideScenario => {
    if (!structure || structure.insufficientHistory || !structure.dataUsable) {
      const reason = structure?.warnings[0]
        ?? "Structure evidence insufficient — scenario levels withheld.";
      return emptySide(side, reason, refLevel);
    }
    if (hi == null || lo == null || !(hi > lo)) {
      return emptySide(
        side,
        "Confirmed swing high/low not present — cannot responsibly place scenario targets.",
        refLevel,
      );
    }
    if (input.referencePrice == null || !Number.isFinite(input.referencePrice)) {
      return emptySide(side, "Reference price missing — scenario levels withheld.", refLevel);
    }

    const plan = pickPlan(side === "BULLISH" ? "BUY" : "SELL");
    const entryFromPlan = plan && !plan.entryZone.unavailableReason
      ? {
        lower: plan.entryZone.lower,
        upper: plan.entryZone.upper,
        reference: plan.entryZone.reference,
        provenance: `Phase 44 ${plan.planKind} entry zone (${plan.intent})`,
        unavailableReason: null as string | null,
      }
      : null;

    if (side === "BULLISH") {
      const entryZone = entryFromPlan ?? {
        lower: support?.low ?? lo,
        upper: support?.high ?? (lo + (hi - lo) * 0.25),
        reference: null as number | null,
        provenance: support
          ? "Active SUPPORT zone / last swing low (derived pullback watch)"
          : "Last swing low region (derived pullback watch)",
        unavailableReason: null as string | null,
      };
      if (entryZone.reference == null && entryZone.lower != null && entryZone.upper != null) {
        entryZone.reference = (entryZone.lower + entryZone.upper) / 2;
      }

      const tp1 = plan?.takeProfit.prices[0] ?? resistance?.low ?? hi;
      const tp2 = plan?.takeProfit.prices[1]
        ?? (resistance?.high != null && resistance.high > (tp1 ?? 0) ? resistance.high : null);
      const inv = plan?.stopLoss.price ?? lo;

      const tp1Prov = plan?.takeProfit.prices[0] != null
        ? `Phase 44 plan TP1 (${plan.planKind})`
        : resistance
          ? "Active RESISTANCE low (observed structure)"
          : "Last swing high (observed structure)";
      const tp2Prov = plan?.takeProfit.prices[1] != null
        ? `Phase 44 plan TP2 (${plan.planKind})`
        : resistance?.high != null
          ? "Active RESISTANCE high (observed structure)"
          : "Second bullish target not supported by verified structure";
      const invProv = plan?.stopLoss.price != null
        ? `Phase 44 structural stop (${plan.planKind})`
        : "Last swing low — structural invalidation (observed)";

      return {
        side,
        available: true,
        unavailableReason: null,
        reference: refLevel,
        entryZone,
        target1: level(tp1, plan?.takeProfit.prices[0] != null ? "derived" : "observed", tp1Prov),
        target2: level(
          tp2,
          plan?.takeProfit.prices[1] != null ? "derived" : (tp2 != null ? "observed" : "unavailable"),
          tp2Prov,
          tp2 == null ? "Second bullish target not supported by verified structure." : null,
        ),
        invalidation: level(inv, plan?.stopLoss.price != null ? "derived" : "observed", invProv),
        confirmationEvidence: [
          ...(input.keyEvidence ?? []).filter((e) => /bullish|higher|support|BOS.*BULLISH|VISIBLE_IN_IMAGE|CONFIRMED_BY_DATA/i.test(e)).slice(0, 4),
          input.bullishScenarioText ? `Narrative: ${input.bullishScenarioText.slice(0, 160)}` : "",
          structure.trendState === "BULLISH" ? "Structure trendState BULLISH." : "",
          "Requires acceptance / confirmation above entry zone — historical pattern alone is not a live trigger.",
        ].filter(Boolean),
        invalidationEvidence: [
          ...(input.invalidationConditions ?? []).slice(0, 3),
          inv != null ? `Close below ${inv} invalidates the bullish scenario.` : "",
        ].filter(Boolean),
        atrDisclosure: null,
      };
    }

    // BEARISH
    const entryZone = entryFromPlan ?? {
      lower: resistance?.low ?? (hi - (hi - lo) * 0.25),
      upper: resistance?.high ?? hi,
      reference: null as number | null,
      provenance: resistance
        ? "Active RESISTANCE zone / last swing high (derived pullback watch)"
        : "Last swing high region (derived pullback watch)",
      unavailableReason: null as string | null,
    };
    if (entryZone.reference == null && entryZone.lower != null && entryZone.upper != null) {
      entryZone.reference = (entryZone.lower + entryZone.upper) / 2;
    }

    const tp1 = plan?.takeProfit.prices[0] ?? support?.high ?? lo;
    const tp2 = plan?.takeProfit.prices[1]
      ?? (support?.low != null && support.low < (tp1 ?? Infinity) ? support.low : null);
    const inv = plan?.stopLoss.price ?? hi;

    const tp1Prov = plan?.takeProfit.prices[0] != null
      ? `Phase 44 plan TP1 (${plan.planKind})`
      : support
        ? "Active SUPPORT high (observed structure)"
        : "Last swing low (observed structure)";
    const tp2Prov = plan?.takeProfit.prices[1] != null
      ? `Phase 44 plan TP2 (${plan.planKind})`
      : support?.low != null
        ? "Active SUPPORT low (observed structure)"
        : "Second bearish target not supported by verified structure";
    const invProv = plan?.stopLoss.price != null
      ? `Phase 44 structural stop (${plan.planKind})`
      : "Last swing high — structural invalidation (observed)";

    return {
      side,
      available: true,
      unavailableReason: null,
      reference: refLevel,
      entryZone,
      target1: level(tp1, plan?.takeProfit.prices[0] != null ? "derived" : "observed", tp1Prov),
      target2: level(
        tp2,
        plan?.takeProfit.prices[1] != null ? "derived" : (tp2 != null ? "observed" : "unavailable"),
        tp2Prov,
        tp2 == null ? "Second bearish target not supported by verified structure." : null,
      ),
      invalidation: level(inv, plan?.stopLoss.price != null ? "derived" : "observed", invProv),
      confirmationEvidence: [
        ...(input.keyEvidence ?? []).filter((e) => /bearish|lower|resistance|BOS.*BEARISH|VISIBLE_IN_IMAGE|CONFIRMED_BY_DATA/i.test(e)).slice(0, 4),
        input.bearishScenarioText ? `Narrative: ${input.bearishScenarioText.slice(0, 160)}` : "",
        structure.trendState === "BEARISH" ? "Structure trendState BEARISH." : "",
        "Requires acceptance / confirmation below entry zone — historical pattern alone is not a live trigger.",
      ].filter(Boolean),
      invalidationEvidence: [
        ...(input.invalidationConditions ?? []).slice(0, 3),
        inv != null ? `Close above ${inv} invalidates the bearish scenario.` : "",
      ].filter(Boolean),
      atrDisclosure: null,
    };
  };

  return {
    schemaVersion: "forex-dual-market-scenarios-v1",
    method: DUAL_SCENARIO_METHOD,
    instrument: input.instrument,
    timeframe: input.timeframe,
    dataStatus: input.dataStatus,
    referencePrice: input.referencePrice,
    referenceSource: input.referenceSource,
    referenceTimestampUtc: input.referenceTimestampUtc,
    bullish: buildSide("BULLISH"),
    bearish: buildSide("BEARISH"),
    disclaimer,
  };
}
