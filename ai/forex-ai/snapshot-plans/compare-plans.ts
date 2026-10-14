/**
 * Deterministic comparison of provider plan bundles (no AI cross-judgment).
 */
import type {
  SnapshotPlanBundle,
  SnapshotPlanComparison,
  SnapshotPlanFieldConflict,
  SnapshotTradePlan,
} from "./types.js";

function zoneKey(p: SnapshotTradePlan): string {
  if (p.entryZone.unavailableReason) return `unavailable:${p.entryZone.unavailableReason}`;
  return `${p.entryZone.lower ?? "null"}-${p.entryZone.upper ?? "null"}-${p.intent}`;
}

function materiallyDifferentZones(a: SnapshotTradePlan, b: SnapshotTradePlan): boolean {
  if (a.intent !== b.intent) return true;
  if (a.entryZone.reference == null || b.entryZone.reference == null) {
    return a.entryZone.unavailableReason !== b.entryZone.unavailableReason;
  }
  const midA = a.entryZone.reference;
  const midB = b.entryZone.reference;
  const span = Math.max(
    Math.abs((a.entryZone.upper ?? midA) - (a.entryZone.lower ?? midA)),
    Math.abs((b.entryZone.upper ?? midB) - (b.entryZone.lower ?? midB)),
    Math.abs(midA) * 0.001,
    1e-8,
  );
  return Math.abs(midA - midB) > span * 0.5;
}

function stopConflict(a: SnapshotTradePlan, b: SnapshotTradePlan): boolean {
  if (a.stopLoss.price == null || b.stopLoss.price == null) return false;
  if (a.intent !== b.intent) return true;
  const ref = Math.abs(a.entryZone.reference ?? a.stopLoss.price);
  return Math.abs(a.stopLoss.price - b.stopLoss.price) > Math.max(ref * 0.002, 1e-8);
}

export function compareSnapshotPlanBundles(input: {
  local: SnapshotPlanBundle | null;
  openai: SnapshotPlanBundle | null;
  localFailed: boolean;
  openaiFailed: boolean;
}): SnapshotPlanComparison {
  const conflicts: SnapshotPlanFieldConflict[] = [];

  if (input.localFailed && input.openaiFailed) {
    return {
      verdict: "INSUFFICIENT_DATA",
      directionAgree: null,
      pullbackConflict: false,
      breakoutConflict: false,
      conflicts: [],
      waitConflict: false,
      waitConflictReason: null,
      incomplete: true,
      note: "Both providers failed — plan comparison is incomplete.",
    };
  }

  if (input.localFailed || input.openaiFailed || !input.local || !input.openai) {
    return {
      verdict: "INSUFFICIENT_DATA",
      directionAgree: null,
      pullbackConflict: false,
      breakoutConflict: false,
      conflicts: [],
      waitConflict: false,
      waitConflictReason: null,
      incomplete: true,
      note:
        "Partial provider success — comparison is incomplete. Successful provider plans are shown independently.",
    };
  }

  const local = input.local;
  const openai = input.openai;
  const directionAgree = local.marketDirection === openai.marketDirection;
  if (!directionAgree) {
    conflicts.push({
      field: "marketDirection",
      localValue: local.marketDirection,
      openaiValue: openai.marketDirection,
      material: true,
    });
  }

  const pullbackConflict =
    local.pullback.intent !== openai.pullback.intent
    || materiallyDifferentZones(local.pullback, openai.pullback)
    || stopConflict(local.pullback, openai.pullback);

  if (pullbackConflict) {
    conflicts.push({
      field: "pullback",
      localValue: `${local.pullback.intent} ${zoneKey(local.pullback)}`,
      openaiValue: `${openai.pullback.intent} ${zoneKey(openai.pullback)}`,
      material: true,
    });
  }

  const breakoutConflict =
    local.breakout.intent !== openai.breakout.intent
    || materiallyDifferentZones(local.breakout, openai.breakout)
    || stopConflict(local.breakout, openai.breakout);

  if (breakoutConflict) {
    conflicts.push({
      field: "breakout",
      localValue: `${local.breakout.intent} ${zoneKey(local.breakout)}`,
      openaiValue: `${openai.breakout.intent} ${zoneKey(openai.breakout)}`,
      material: true,
    });
  }

  const material = conflicts.some((c) => c.material);
  const waitConflict = material && (!directionAgree || pullbackConflict || breakoutConflict);
  let verdict: SnapshotPlanComparison["verdict"];
  if (material && !directionAgree) verdict = "CONFLICT";
  else if (material) verdict = "CONFLICT";
  else if (
    local.pullback.intent === openai.pullback.intent
    && local.breakout.intent === openai.breakout.intent
    && directionAgree
  ) {
    verdict = "AGREEMENT";
  } else {
    verdict = "PARTIAL_AGREEMENT";
  }

  return {
    verdict,
    directionAgree,
    pullbackConflict,
    breakoutConflict,
    conflicts,
    waitConflict,
    waitConflictReason: waitConflict
      ? `WAIT / CONFLICT — material disagreement on ${conflicts.map((c) => c.field).join(", ")}. Affected setups must not be SETUP CONFIRMED.`
      : null,
    incomplete: false,
    note:
      verdict === "AGREEMENT"
        ? "Providers independently agree on direction and plan intents. This is not a merged trade recommendation."
        : verdict === "CONFLICT"
          ? "Providers conflict on material plan fields. Disagreement is shown as-is."
          : "Partial agreement — some fields align while others differ or lack data.",
  };
}

/** Apply WAIT_CONFLICT to plans when comparison says material conflict. */
export function applyWaitConflictToBundle(
  bundle: SnapshotPlanBundle,
  comparison: SnapshotPlanComparison,
): SnapshotPlanBundle {
  if (!comparison.waitConflict) return bundle;
  const reason = comparison.waitConflictReason ?? "WAIT / CONFLICT";
  const patch = (p: SnapshotTradePlan): SnapshotTradePlan => ({
    ...p,
    lifecycle: "WAIT_CONFLICT",
    lifecycleNote: reason,
    confirmationStatus: "BLOCKED",
  });
  return {
    ...bundle,
    pullback: comparison.pullbackConflict ? patch(bundle.pullback) : bundle.pullback,
    breakout: comparison.breakoutConflict ? patch(bundle.breakout) : bundle.breakout,
  };
}
