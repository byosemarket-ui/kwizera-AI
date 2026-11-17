/**
 * STEP 3A — Rising / Falling / Unchanged classification.
 *
 * Spec: classify only when a broker-provided daily reference baseline is reliably available.
 * Do not invent direction from tick-to-tick frontend mid diffs.
 * Current HFM quote contract (STEP 2A) does not expose a daily reference price —
 * therefore movement counts remain UNAVAILABLE until a confirmed baseline field exists.
 */

import type { HfmMwMovementSummary } from "./types";

export const HFM_MW_MOVEMENT_BASELINE_FIELD = "dailyReferencePrice" as const;

export type HfmMwMovementBaselineSource = {
  /** Exact broker symbol. */
  symbol: string;
  /** Broker daily / session reference mid or close when exposed by backend. */
  dailyReferencePrice: number | null | undefined;
  /** Current mid used only when dailyReferencePrice is a finite number. */
  mid: number | null | undefined;
};

/**
 * Returns unavailable when no instrument has a finite daily reference baseline.
 * Never fabricates counts from screenshot or tick direction.
 */
export function computeMovementSummary(
  instruments: HfmMwMovementBaselineSource[] | null | undefined,
): HfmMwMovementSummary {
  if (!instruments || instruments.length === 0) {
    return {
      availability: "unavailable",
      rising: null,
      falling: null,
      unchanged: null,
      reason: "No instruments with a broker daily reference baseline are available.",
    };
  }

  const usable = instruments.filter(
    (row) =>
      typeof row.dailyReferencePrice === "number" &&
      Number.isFinite(row.dailyReferencePrice) &&
      typeof row.mid === "number" &&
      Number.isFinite(row.mid),
  );

  if (usable.length === 0) {
    return {
      availability: "unavailable",
      rising: null,
      falling: null,
      unchanged: null,
      reason:
        "HFM quote contract does not expose a daily reference baseline; rising/falling/unchanged are unavailable.",
    };
  }

  let rising = 0;
  let falling = 0;
  let unchanged = 0;
  for (const row of usable) {
    const mid = row.mid as number;
    const base = row.dailyReferencePrice as number;
    if (mid > base) rising += 1;
    else if (mid < base) falling += 1;
    else unchanged += 1;
  }

  return {
    availability: "available",
    rising,
    falling,
    unchanged,
    reason: null,
  };
}

/** Explicit unavailable result for overview cards when baseline API is absent. */
export function unavailableMovementSummary(reason?: string): HfmMwMovementSummary {
  return {
    availability: "unavailable",
    rising: null,
    falling: null,
    unchanged: null,
    reason:
      reason ??
      "Rising/Falling/Unchanged require a broker daily reference price; not provided by current HFM APIs.",
  };
}
