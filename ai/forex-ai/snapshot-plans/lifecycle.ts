/**
 * Bounded plan lifecycle — touch ≠ confirm; stale data blocks confirmation.
 */
import type {
  SnapshotPlanLifecycle,
  SnapshotStructureEvidenceSummary,
  SnapshotTradePlan,
} from "./types.js";

function priceInZone(price: number | null, lower: number | null, upper: number | null): boolean {
  if (price == null || lower == null || upper == null) return false;
  if (![price, lower, upper].every((n) => Number.isFinite(n))) return false;
  const lo = Math.min(lower, upper);
  const hi = Math.max(lower, upper);
  return price >= lo && price <= hi;
}

function quoteBlocksConfirmation(structure: SnapshotStructureEvidenceSummary): string | null {
  if (!structure.dataUsable) {
    return "Market data is incomplete or not evidence-ready — new setup confirmation is blocked.";
  }
  const f = String(structure.quoteFreshness ?? "").toUpperCase();
  if (!f || f === "UNAVAILABLE" || f === "STALE" || f === "ERROR") {
    return `Quote freshness is ${f || "missing"} — confirmation blocked.`;
  }
  // HISTORICAL_ONLY is usable for analysis but must not auto-confirm live setups.
  if (f === "HISTORICAL_ONLY") {
    return "Quote is HISTORICAL_ONLY — analytical plans may be created, but SETUP CONFIRMED is blocked.";
  }
  return null;
}

/**
 * Evaluate lifecycle from zone touch + confirmation evidence.
 * Never promotes to SETUP_CONFIRMED on zone touch alone.
 */
export function evaluatePlanLifecycle(input: {
  plan: Omit<SnapshotTradePlan, "lifecycle" | "lifecycleNote" | "confirmationStatus"> & {
    lifecycle?: SnapshotPlanLifecycle;
    lifecycleNote?: string;
    confirmationStatus?: SnapshotTradePlan["confirmationStatus"];
  };
  currentPrice: number | null;
  structure: SnapshotStructureEvidenceSummary;
  materialConflict: boolean;
  conflictReason?: string | null;
}): Pick<SnapshotTradePlan, "lifecycle" | "lifecycleNote" | "confirmationStatus"> {
  if (input.plan.intent === "WAIT" || input.plan.intent === "UNSUITABLE") {
    return {
      lifecycle: "PLAN_CREATED",
      lifecycleNote: "Plan marked WAIT/UNSUITABLE — no confirmation path until evidence improves.",
      confirmationStatus: "BLOCKED",
    };
  }

  if (input.materialConflict) {
    return {
      lifecycle: "WAIT_CONFLICT",
      lifecycleNote:
        input.conflictReason
        ?? "Material provider disagreement — this setup cannot be marked SETUP CONFIRMED.",
      confirmationStatus: "BLOCKED",
    };
  }

  const block = quoteBlocksConfirmation(input.structure);
  const inZone = priceInZone(
    input.currentPrice,
    input.plan.entryZone.lower,
    input.plan.entryZone.upper,
  );

  if (!inZone) {
    return {
      lifecycle: "PLAN_CREATED",
      lifecycleNote: "Plan created from snapshot evidence. Entry zone has not been reached.",
      confirmationStatus: "NOT_STARTED",
    };
  }

  // Zone touched — never SETUP_CONFIRMED here.
  if (block) {
    return {
      lifecycle: "ENTRY_ZONE_REACHED",
      lifecycleNote:
        `Entry zone reached at ${input.currentPrice}. ${block} Touch does not authorize a trade.`,
      confirmationStatus: "BLOCKED",
    };
  }

  // Require at least one confirmed structure event aligned with intent for MET.
  const wantBull = input.plan.intent === "BUY";
  const wantBear = input.plan.intent === "SELL";
  const confirmed = input.structure.events.some(
    (e) =>
      e.status === "CONFIRMED"
      && ((wantBull && e.direction === "BULLISH") || (wantBear && e.direction === "BEARISH")),
  );

  if (confirmed && input.plan.confirmationRequired.length > 0) {
    return {
      lifecycle: "SETUP_CONFIRMED",
      lifecycleNote:
        "Entry zone reached and aligned confirmed structure evidence met confirmation conditions. "
        + "This does not mean an order was submitted, filled, or profitable.",
      confirmationStatus: "MET",
    };
  }

  return {
    lifecycle: "CONFIRMATION_PENDING",
    lifecycleNote:
      "Entry zone reached. Waiting for defined price-action confirmation — touch alone is not confirmation.",
    confirmationStatus: "PENDING",
  };
}
