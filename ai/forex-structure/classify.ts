/**
 * HH/HL/LH/LL classification and trend state — market-structure-v1.
 *
 * Each confirmed swing is compared to the previous confirmed swing of the same kind.
 * Equal within epsilon → EQUAL_HIGH / EQUAL_LOW (never forced to HH/HL).
 *
 * Mixed trend handling:
 * - Count bullish labels (HH, HL) vs bearish (LH, LL) over the last up to 6 classifications.
 * - EQUAL_* labels are neutral and do not vote.
 * - Strict majority of bullish votes → BULLISH; bearish → BEARISH.
 * - Equal votes, or no votes among the window → RANGE (mixed / alternating without dominance).
 * - Confirmed swing count < minConfirmedSwingsForTrend → UNKNOWN (even if classifications exist).
 */

import type {
  ClassificationLabel,
  StructureRuleParams,
  StructureSwing,
  SwingClassification,
  TrendState,
} from "./types.js";
import { pricesEqualRel } from "./validate.js";

export function classifyConfirmedSwings(
  swings: StructureSwing[],
  params: StructureRuleParams,
): SwingClassification[] {
  const confirmed = swings
    .filter((s) => s.status === "CONFIRMED")
    .sort((a, b) => a.index - b.index);

  const classifications: SwingClassification[] = [];
  let lastHigh: StructureSwing | null = null;
  let lastLow: StructureSwing | null = null;

  for (const swing of confirmed) {
    if (swing.kind === "HIGH") {
      if (lastHigh) {
        let label: ClassificationLabel;
        if (pricesEqualRel(swing.price, lastHigh.price, params.equalHighLowEpsilonRel)) {
          label = "EQUAL_HIGH";
        } else if (swing.price > lastHigh.price) {
          label = "HH";
        } else {
          label = "LH";
        }
        classifications.push({
          swingId: swing.id,
          kind: "HIGH",
          label,
          price: swing.price,
          time: swing.time,
          priorSwingId: lastHigh.id,
          priorPrice: lastHigh.price,
          evidence: [
            `${label}: high ${swing.price} vs prior high ${lastHigh.price}`,
            `epsilonRel=${params.equalHighLowEpsilonRel}`,
          ],
        });
      }
      lastHigh = swing;
    } else {
      if (lastLow) {
        let label: ClassificationLabel;
        if (pricesEqualRel(swing.price, lastLow.price, params.equalHighLowEpsilonRel)) {
          label = "EQUAL_LOW";
        } else if (swing.price > lastLow.price) {
          label = "HL";
        } else {
          label = "LL";
        }
        classifications.push({
          swingId: swing.id,
          kind: "LOW",
          label,
          price: swing.price,
          time: swing.time,
          priorSwingId: lastLow.id,
          priorPrice: lastLow.price,
          evidence: [
            `${label}: low ${swing.price} vs prior low ${lastLow.price}`,
            `epsilonRel=${params.equalHighLowEpsilonRel}`,
          ],
        });
      }
      lastLow = swing;
    }
  }

  return classifications;
}

export function resolveTrendState(
  confirmedSwingCount: number,
  classifications: SwingClassification[],
  params: StructureRuleParams,
): TrendState {
  if (confirmedSwingCount < params.minConfirmedSwingsForTrend) {
    return "UNKNOWN";
  }

  const recent = classifications.slice(-6);
  let bullish = 0;
  let bearish = 0;
  for (const c of recent) {
    if (c.label === "HH" || c.label === "HL") bullish += 1;
    else if (c.label === "LH" || c.label === "LL") bearish += 1;
    // EQUAL_HIGH / EQUAL_LOW: neutral — no vote
  }

  if (bullish === 0 && bearish === 0) return "RANGE";
  if (bullish > bearish) return "BULLISH";
  if (bearish > bullish) return "BEARISH";
  // Equal bullish/bearish votes → mixed / no clear dominance
  return "RANGE";
}
