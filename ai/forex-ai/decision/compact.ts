/**
 * Compact factual lines for decision prompts (keep under Phase 21 budget).
 */
import { formatCompactFactsLine } from "../mtf/compact.js";
import type { ForexDecisionDeterministicPack } from "./types.js";

export function formatDecisionFactsBlock(pack: ForexDecisionDeterministicPack): string {
  const { mtf, alignment, scenario, entryZone, confirmation, invalidation, riskContext, decisionPosture } = pack;
  const lines: string[] = [
    `SYMBOL ${mtf.symbol} EXCHANGE BINANCE SPOT`,
    `PRICE ${entryZone.currentPrice ?? "UNAVAILABLE"}`,
    `DQ ${mtf.dataQuality}`,
    `ALIGN ${alignment.overall} HTF=${alignment.higherBias} LTF=${alignment.lowerState}`,
    `SCENARIO ${scenario.type} DIR=${scenario.direction}`,
    `POSTURE ${decisionPosture}`,
  ];

  for (const slot of mtf.slots) {
    lines.push(formatCompactFactsLine(slot.compact));
  }

  if (entryZone.status === "UNAVAILABLE") {
    lines.push(`ENTRY UNAVAILABLE: ${entryZone.unavailableReason}`);
  } else {
    lines.push(
      `ENTRY ${entryZone.status} ${entryZone.lowerBound}–${entryZone.upperBound} inv=${entryZone.invalidationLevel ?? "n/a"} tf=${entryZone.timeframe}`,
    );
  }

  lines.push(
    `CONFIRM ${confirmation.conditions.map((c) => `${c.id}:${c.status}`).join(",")}`,
  );
  lines.push(
    `INVALID ${invalidation.conditions.map((c) => `${c.id}:${c.status}`).join(",")}`,
  );
  lines.push(
    `RISK vol=${riskContext.volatility ?? "n/a"} atr=${riskContext.atr ?? "n/a"} conflict=${riskContext.timeframeConflict}`,
  );
  lines.push(
    `SL ${pack.stopLossCandidate ?? "null"} TP ${pack.takeProfitCandidates.join("|") || "none"} RR ${pack.riskReward.ratio ?? "null"}`,
  );

  return lines.join("\n");
}
